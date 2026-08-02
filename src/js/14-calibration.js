/* ===================== LATENCY CALIBRATION (Phase 8 / F1) =====================
   Restores the offset that shipped in v2.5.0 and was cut in v2.11.0 for having no
   caller. It has one now: F1 scores you against scheduled times, and a detected
   onset arrives late by however long the whole audio stack takes. Without this,
   a timing score measures the browser, the buffer size and the speaker distance —
   not the player. Every reading would be "dragging".

   WHAT CHANGED vs v2.5.0. The old version was a TAP test: a click played, you
   tapped along, and it averaged your nearest-beat deltas. That measures *output*
   latency plus your reaction and touch latency — fine for a tap-scored drill,
   which is exactly the tier the roadmap forbids ever shipping. What mic scoring
   needs is the ROUND TRIP: output latency + travel through the air + input
   latency. So the app now measures it directly, with no human in the loop: play a
   click, listen for it with the F1 onset detector, take the delta. The user's
   reaction time is not part of the answer, so it can't pollute it.

   Median, not mean, over several clicks: a single miss (a door closing on click 3)
   should not shift the offset, and the distribution here is tight-with-outliers
   rather than noisy-around-a-centre.

   HEADPHONES are the honest failure case: if the mic can't hear the speaker there
   is no round trip to measure, and we say so rather than storing a wrong number.
   The manual slider stays for exactly that case. */

const CAL_CLICKS = 7;        // clicks per run; median of what comes back
const CAL_SPACING = 0.55;    // s between clicks — beyond any plausible round trip
const CAL_WINDOW = 0.45;     // s after a click to still count an echo as that click
const CAL_MIN_HITS = 3;      // fewer than this and we refuse to store a number
const CAL_MAX_MS = 400;      // sanity ceiling: beyond this it isn't latency, it's a bug

let calMs = 0;               // the stored round-trip offset, ms. Persisted.
let calKnown = false;        // has it ever been ESTABLISHED (measured or set by hand)? Persisted.
let calRun = null;           // in-flight run

/* The one accessor the scorers use. Seconds, because everything on the audio
   clock is in seconds. */
function calOffsetSec(){ return calMs/1000; }

/* A short, broadband click: the thing we're timing has to be easy for an onset
   detector to catch, so this is deliberately sharper than the metronome tick. */
function calClick(when){
  const ctx=audio(); if(!ctx) return;
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type='square'; o.frequency.setValueAtTime(2400, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.5, when+0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, when+0.03);
  o.connect(g).connect(cue); o.start(when); o.stop(when+0.05);
}

/* Run the round trip. Resolves { ok:true, ms, hits } or { ok:false, key }.
   Gesture-gated (it starts the mic). */
async function calRunTest(onProgress){
  if(calRun) return { ok:false, key:'cal_busy' };
  const ctx=audio();
  if(!ctx) return { ok:false, key:'mic_unsupported' };
  const started = await onsetStart();
  if(!started.ok) return started;

  const emitted=[], heard=[];
  const off = onOnset(t=>{ heard.push(t); });
  calRun = { cancelled:false };
  let wasCancelled = false;
  try{
    // Schedule all the clicks up front on the audio clock so their times are exact,
    // then wait out the run in wall time. The times we compare against are the
    // SCHEDULED ones — that's the whole point.
    const t0 = ctx.currentTime + 0.3;
    for(let i=0;i<CAL_CLICKS;i++){
      const when = t0 + i*CAL_SPACING;
      emitted.push(when);
      calClick(when);
    }
    for(let i=0;i<CAL_CLICKS;i++){
      await calSleep(CAL_SPACING*1000);
      if(calRun && calRun.cancelled) break;
      if(onProgress) try{ onProgress((i+1)/CAL_CLICKS); }catch(_){}
    }
    await calSleep(CAL_WINDOW*1000);
  } finally {
    // Teardown only. A `return` in here would swallow any exception thrown above,
    // so the cancelled check happens after the block, not inside it.
    off();
    onsetStop();
    wasCancelled = !!(calRun && calRun.cancelled);
    calRun = null;
  }
  if(wasCancelled) return { ok:false, key:'cal_cancelled' };

  // Pair each click with the first onset that lands inside its window. A click we
  // never heard contributes nothing rather than a guess.
  const deltas=[];
  emitted.forEach(when=>{
    const hit = heard.find(t=> t>=when && t-when<=CAL_WINDOW);
    if(hit!=null) deltas.push((hit-when)*1000);
  });
  if(deltas.length<CAL_MIN_HITS) return { ok:false, key:'cal_unheard' };
  const ms = calMedian(deltas);
  if(!(ms>=0 && ms<=CAL_MAX_MS)) return { ok:false, key:'cal_unheard' };
  calSetMs(ms, true);
  return { ok:true, ms, hits:deltas.length };
}

function calCancel(){ if(calRun) calRun.cancelled=true; }
function calSleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function calMedian(a){ const s=a.slice().sort((x,y)=>x-y); const n=s.length;
  return n%2 ? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2; }

/* Bounds-checked everywhere it can be set (test result, slider, restored state) —
   same discipline as the rest of the persisted catalogue.
   `known` (Phase 10/A4) records whether this number was ever ESTABLISHED, as opposed
   to being the 0 it starts at. Nothing could tell those two apart before, and they are
   not the same claim: 0 means "the round trip is instant", which is true of no device
   ever made. A player who has not measured was being scored against an offset of zero
   and told, as fact, that they drag — by exactly the buffer size. The flag is what lets
   the scorer say "I can't judge this yet" instead of judging it wrongly.
   A hand-set slider counts as known: the player asserted a value, and refusing to
   believe them would be the same arrogance in the other direction. */
function calSetMs(ms, known){
  calMs = Math.max(0, Math.min(CAL_MAX_MS, Math.round(Number(ms)||0)));
  if(known !== undefined) calKnown = !!known;
  if(typeof saveState==='function') saveState();
  calRender();
}
/* Has the round trip actually been established? Consumed by 13-scored.js. */
function calMeasured(){ return calKnown; }

function calRender(){
  const v=document.getElementById('cal-val'); if(v) v.textContent=calMs+' '+t('on_ms');
  const s=document.getElementById('cal-slider'); if(s && String(s.value)!==String(calMs)) s.value=calMs;
}
/* The measured number rides in `ms` rather than being baked into the text, so a
   language flip can re-localize the sentence AND keep the reading. */
function calStatus(key, ms){
  const el=document.getElementById('cal-status'); if(!el) return;
  if(key) el.dataset.key=key; else delete el.dataset.key;
  if(ms!=null) el.dataset.ms=String(Math.round(ms)); else delete el.dataset.ms;
  el.textContent = key ? calStatusText(key, ms) : '';
  el.hidden = !key;
}
function calStatusText(key, ms){
  return t(key) + (ms!=null ? ' ' + Math.round(ms) + ' ' + t('on_ms') : '');
}
/* re-localize a message that's already on screen when the language flips */
function calRefreshLang(){
  calRender();
  const el=document.getElementById('cal-status');
  if(el && !el.hidden && el.dataset.key)
    el.textContent=calStatusText(el.dataset.key, el.dataset.ms!=null ? Number(el.dataset.ms) : null);
  const b=document.getElementById('cal-run'); if(b) b.textContent=t('cal_run');
}

(function initCalibration(){
  const row=document.getElementById('cal-row');
  // No mic path at all → the round-trip test can't run, so don't show a control
  // that can only fail. The manual slider goes with it: an offset you can't verify
  // is worse than no offset, and nothing consumes it without the mic anyway.
  if(!row) return;
  if(!micSupported()){ if(row.parentNode) row.parentNode.removeChild(row); return; }
  const run=document.getElementById('cal-run');
  const slider=document.getElementById('cal-slider');
  if(slider) slider.oninput=()=>calSetMs(slider.value, true);
  if(run) run.onclick=async ()=>{
    run.disabled=true;
    calStatus('cal_running');
    const r=await calRunTest();
    run.disabled=false;
    if(r.ok) calStatus('cal_done', r.ms);
    else calStatus(r.key);
  };
  calRender();
})();
