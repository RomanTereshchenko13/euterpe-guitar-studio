/* ===================== LATENCY CALIBRATION =====================
   A detected onset arrives late by however long the whole audio stack takes, so without
   this offset every timing score measures the browser and the buffer size, and every
   player reads as dragging.

   It measures the ROUND TRIP (output + air + input) with no human in the loop: play a
   click, catch it with the onset detector, take the delta — a tap test would add your
   reaction time. Median over several clicks, so one stray noise can't shift it.

   On headphones the mic can't hear the speaker, so there is nothing to measure; it says
   so rather than storing a wrong number, and the manual slider covers that case. */

const CAL_CLICKS = 7;        // clicks per run; median of what comes back
const CAL_SPACING = 0.55;    // s between clicks — beyond any plausible round trip
const CAL_WINDOW = 0.45;     // s after a click to still count an echo as that click
const CAL_MIN_HITS = 3;      // fewer than this and we refuse to store a number
const CAL_MAX_MS = 400;      // sanity ceiling: beyond this it isn't latency, it's a bug

let calMs = 0;               // the stored round-trip offset, ms (persisted)
let calKnown = false;        // ever ESTABLISHED — measured or set by hand? (persisted)
let calRun = null;           // in-flight run

/* The accessor the scorers use, in seconds like everything on the audio clock. */
function calOffsetSec(){ return calMs/1000; }

/* a short broadband click, sharper than the metronome tick, so the detector catches it */
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
    // schedule every click up front on the audio clock: we compare against the SCHEDULED
    // times, then wait out the run in wall time
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
    // teardown only — a `return` in a finally would swallow an exception thrown above
    off();
    onsetStop();
    wasCancelled = !!(calRun && calRun.cancelled);
    calRun = null;
  }
  if(wasCancelled) return { ok:false, key:'cal_cancelled' };

  // pair each click with the first onset inside its window; an unheard click adds nothing
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

/* Bounds-checked wherever it is set (measurement, slider, restored state).
   `known` separates "established" from the 0 it starts at: 0 would claim an instant
   round trip, and a player who never measured would be told, as fact, that they drag.
   A hand-set value counts as known — the player asserted it. */
function calSetMs(ms, known){
  calMs = Math.max(0, Math.min(CAL_MAX_MS, Math.round(Number(ms)||0)));
  if(known !== undefined) calKnown = !!known;
  saveState();
  calRender();
}
/* Has the round trip been established? (13-scored.js) */
function calMeasured(){ return calKnown; }

function calRender(){
  const v=document.getElementById('cal-val'); if(v) v.textContent=calMs+' '+t('on_ms');
  const s=document.getElementById('cal-slider'); if(s && String(s.value)!==String(calMs)) s.value=calMs;
}
/* the measured number stays in `ms`, so a language switch re-localizes the sentence
   and keeps the reading */
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
/* re-localize a message already on screen */
function calRefreshLang(){
  calRender();
  const el=document.getElementById('cal-status');
  if(el && !el.hidden && el.dataset.key)
    el.textContent=calStatusText(el.dataset.key, el.dataset.ms!=null ? Number(el.dataset.ms) : null);
  const b=document.getElementById('cal-run'); if(b) b.textContent=t('cal_run');
}

(function initCalibration(){
  const row=document.getElementById('cal-row');
  // no mic path: the measurement can't run, and an offset you can't verify is worse than
  // none — nothing uses it without the mic anyway. Remove the row.
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
