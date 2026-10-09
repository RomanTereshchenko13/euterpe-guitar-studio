/* ===================== Drill: Comp the progression =====================
   Comp a looping progression: play the right chord at the right time. A chosen
   progression cycles with a forced backing band; a big NOW (chord diagram) + a NEXT
   preview + a beat indicator land each change in time. Records comp:<progression>,
   scored by bars comped — and, with the mic on, by the timing error of the changes.

   The DOM ids stay `tg-*`: they're the shared vocabulary of the CSS and the smoke
   suite. PLAN step 9 merges this drill with Strumming & feel into "Rhythm guitar". */

let tgIdx = 1;          // selected progression (default I–V–vi–IV)
let tgDrill = null;
// tgDrill = { presetIdx, bars:[{pc,qi}…], bar, cycles, clock, playing }

/* Scored tier (13-scored.js). Comping is your own rhythm, so the drill scores the
   thing the exercise is about — LANDING THE CHANGE. The expected times are the bar
   downbeats; strums in between are your feel and land in `extra`, unpenalised.
   Tolerance is half a beat: a chord change is a coarser target than a 16th. */
const tgScore = scoredRun({
  micId:'drill-ctx-mic', statusId:'tg-status', scoreId:'tg-score', countKey:'on_changes',
  tol:()=>pulseSec()/2,
  onChange:()=>{ if(tgDrill) renderTarget(); },
});

// expand a preset's steps (offset, qi, bars) into one chord per bar, in the context key
function tgBuildBars(preset){
  const r=gRoot, out=[];
  preset.steps.forEach(([off,qi,b])=>{ const pc=mod(r+off,12); for(let k=0;k<Math.max(1,b);k++) out.push({pc, qi}); });
  return out;
}
function startComp(){
  tgDrill={ presetIdx:tgIdx, bars:tgBuildBars(SEQ_PRESETS[tgIdx]), bar:0, cycles:0, clock:null, playing:false };
  tgScore.clearScore();
  const home=document.getElementById('practice-home'), area=document.getElementById('tg-area');
  if(home) home.hidden=true; if(area) area.hidden=false;
  drillShellEnter();
  renderTarget();
}
function exitTarget(){
  targetStop();
  tgScore.release();     // never leave the mic open behind a closed drill
  tgDrill=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('tg-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  renderPractice();
}
function targetToggle(){ if(tgDrill && tgDrill.playing) targetStop(); else targetPlay(); }
function targetPlay(){
  if(!tgDrill || tgDrill.playing) return;
  audio();
  stopLoop();       // don't fight the reference loop / progression
  seqStop();
  drillRunStarted();                                 // fold the setup
  tgDrill.presetIdx=tgIdx; tgDrill.bars=tgBuildBars(SEQ_PRESETS[tgIdx]);
  tgDrill.bar=0; tgDrill.cycles=0; tgDrill.playing=true;
  tgScore.begin();                               // before the clock: a tick must not
  tgDrill.clock={ interval:()=>barSec(), tick:(time,count)=>targetTick(time,count) };
  addClock(tgDrill.clock);   // ...land in a run we then reset
  renderTarget();
}
function targetStop(){
  if(!tgDrill || !tgDrill.playing) return;
  if(tgDrill.clock){ removeClock(tgDrill.clock); tgDrill.clock=null; }
  clearVisualQ();
  tgDrill.playing=false;
  const sc=tgScore.end();
  const barsPlayed = tgDrill.cycles*tgDrill.bars.length + tgDrill.bar;
  if(barsPlayed>=1){
    recordSession('comp:'+SEQ_PRESETS[tgDrill.presetIdx].name, barsPlayed, undefined, scoredErr(sc));
    saveState();
    renderPractice();
  }
  renderTarget();
}
function targetTick(when, count){
  if(!tgDrill) return;
  const bars=tgDrill.bars; if(!bars.length) return;
  const i=count%bars.length;
  if(i===0 && count>0) tgDrill.cycles++;
  tgDrill.bar=i;
  const cur=bars[i], nxt=bars[(i+1)%bars.length], p=pulseSec();
  const ivs=QUALITIES[cur.qi].iv, base=48+cur.pc;
  if(tgScore.on()){
    // The change itself is the scored slot. The guide comp is muted: it lands exactly
    // on the downbeat being measured, so the app would be scoring its own speakers
    // (onsetSelfHeard). The band keeps the bar, which is what you comp against anyway.
    if(tgDrill.playing) tgScore.mark(when);
  } else {
    compStrum(base, ivs, when, 0.9, 0.028);                  // guide comp on the downbeat
    compStrum(base, ivs, when+midPulseSec(), 0.55, 0.022);   // softer push mid-bar (beat 3 in 4/4)
  }
  scheduleBand(cur.pc, cur.qi, when, true);                  // forced bass + groove bed
  for(let k=0;k<barBeats();k++) enqueueVisual(when+k*p, ()=>tgPulseBeat(k));
  enqueueVisual(when, ()=>renderTargetStage(cur, nxt));
}

/* ---- DOM paint (no-ops cleanly when the panel isn't in the DOM, e.g. some tests) ---- */
function renderTarget(){
  if(!tgDrill) return;
  const chips=document.getElementById('tg-progs');
  if(chips) chips.innerHTML=SEQ_PRESETS.map((p,i)=>`<button type="button" class="btn tg-prog${i===tgIdx?' active':''}" data-i="${i}" aria-pressed="${i===tgIdx}">${p.name}</button>`).join('');
  const beats=document.getElementById('tg-beats');
  if(beats) beats.innerHTML=Array.from({length:barBeats()},(_,k)=>`<span class="co-beat" data-k="${k}"></span>`).join('');
  renderTargetStage(tgDrill.bars[tgDrill.bar], tgDrill.bars[(tgDrill.bar+1)%tgDrill.bars.length]);
  const h=document.getElementById('tg-hits'); if(h) h.textContent = tgDrill.playing ? ('↻ '+tgDrill.cycles) : '';
  const pb=document.getElementById('tg-play'); if(pb){ pb.innerHTML=(tgDrill.playing?'&#9632; ':'&#9654; ')+t(tgDrill.playing?'sp_stop':'sp_play'); pb.classList.toggle('active', tgDrill.playing); pb.setAttribute('aria-pressed', tgDrill.playing?'true':'false'); }
  const hint=document.getElementById('tg-hint'); if(hint) hint.textContent=t(tgScore.on()?'co_hint_scored':'co_hint');
  tgScore.render();
  applyDrillCtx();
}
// comping shows the SHAPE — you have to fret it
function renderTargetStage(cur, nxt){
  const paint=(el, st)=>{ if(el) el.innerHTML = st ? cmChordBox(cmChord([st.pc, st.qi])) : ''; };
  paint(document.getElementById('tg-now'), cur);
  paint(document.getElementById('tg-next'), nxt);
  const nl=document.getElementById('tg-now-lab'); if(nl) nl.textContent=t('co_now');
  const xl=document.getElementById('tg-next-lab'); if(xl) xl.textContent=t('co_next');
}
function tgPulseBeat(k){
  document.querySelectorAll('#tg-beats .co-beat').forEach(d=>d.classList.toggle('on', +d.dataset.k===k));
}
// re-localize an in-flight drill on a language switch (called from applyLang)
function refreshTargetLang(){ if(tgDrill){ renderTarget(); tgScore.refreshLang(); } }

registerDrill({ id:'overchanges', area:'tg-area', tempo:true,   // bars ride barSec()
                tracks:[
                  { id:'comp', kind:'perf', sess:'comp', better:'high', unit:'bars', label:'drill_comp', scored:'mic', start:startComp }
                ],
                isActive:()=>!!tgDrill, exit:exitTarget, refreshLang:refreshTargetLang,
                setup:'tg-setup',
                mic:()=>tgScore.available(),
                // stops first: flipping the tier mid-run would change what's being measured
                onMic:()=>{ if(tgDrill&&tgDrill.playing) targetStop(); tgScore.toggle(); renderTarget(); },
                // the progression is stored resolved to the key, so a key change rebuilds the bars
                onKey:()=>{ if(!tgDrill) return;
                            tgDrill.bars=tgBuildBars(SEQ_PRESETS[tgIdx]);
                            if(tgDrill.bar>=tgDrill.bars.length) tgDrill.bar=0;
                            renderTarget(); } });

(function initOverChanges(){
  const area=document.getElementById('tg-area'); if(!area) return;
  const pl=document.getElementById('tg-play'); if(pl) pl.onclick=targetToggle;
  const pg=document.getElementById('tg-progs');
  if(pg) pg.addEventListener('click', e=>{ const btn=e.target.closest('.tg-prog'); if(btn){ tgIdx=+btn.dataset.i; if(tgDrill){ tgDrill.presetIdx=tgIdx; tgDrill.bars=tgBuildBars(SEQ_PRESETS[tgIdx]); if(tgDrill.bar>=tgDrill.bars.length) tgDrill.bar=0; } renderTarget(); } });
})();
