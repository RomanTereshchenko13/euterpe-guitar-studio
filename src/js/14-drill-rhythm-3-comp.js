/* ===================== Drill: Comp the progression (Phase 5c) =====================
   The rhythm-side mirror of chord-tone targeting: a chosen progression cycles with a
   full backing band (bass + groove + a guide comp) and you play the RIGHT CHORD at the
   RIGHT TIME. A big NOW chord + a NEXT preview + a 4-beat indicator make the change
   land in time. Reuses the sequencer presets (SEQ_PRESETS, 06) resolved to the context
   key (spine #1), compStrum + scheduleBand(force) for the band, the scheduler clock,
   and cmChord/cmChordBox for the diagrams. Coach tier — no timing score (Phase 8/F1);
   a practiced run (≥1 bar) records a session (bars comped), minting no per-item SRS. */

let coIdx = 1;          // selected progression (default I–V–vi–IV)
let coDrill = null;
// coDrill = { presetIdx, bars:[{pc,qi}…], bar, cycles, clock, playing }

// expand a preset's steps (offset, qi, bars) into one chord per bar, in the context key
function compBuildBars(preset){
  const r=gRoot, out=[];
  preset.steps.forEach(([off,qi,b])=>{ const pc=mod(r+off,12); for(let k=0;k<Math.max(1,b);k++) out.push({pc, qi}); });
  return out;
}
function startComp(){
  coDrill={ presetIdx:coIdx, bars:compBuildBars(SEQ_PRESETS[coIdx]), bar:0, cycles:0, clock:null, playing:false };
  const home=document.getElementById('practice-home'), area=document.getElementById('co-area');
  if(home) home.hidden=true; if(area) area.hidden=false;
  renderComp();
}
function exitComp(){
  compStop();
  coDrill=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('co-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderPractice==='function') renderPractice();
}
function compToggle(){ if(coDrill && coDrill.playing) compStop(); else compPlay(); }
function compPlay(){
  if(!coDrill || coDrill.playing) return;
  audio();
  if(typeof stopLoop==='function') stopLoop();
  if(typeof seqStop==='function') seqStop();
  coDrill.presetIdx=coIdx; coDrill.bars=compBuildBars(SEQ_PRESETS[coIdx]);
  coDrill.bar=0; coDrill.cycles=0; coDrill.playing=true;
  coDrill.clock={ interval:()=>beat()*4, tick:(time,count)=>compTick(time,count) };
  if(typeof addClock==='function') addClock(coDrill.clock);
  renderComp();
}
function compStop(){
  if(!coDrill || !coDrill.playing) return;
  if(coDrill.clock){ if(typeof removeClock==='function') removeClock(coDrill.clock); coDrill.clock=null; }
  if(typeof clearVisualQ==='function') clearVisualQ();
  coDrill.playing=false;
  const barsPlayed = coDrill.cycles*coDrill.bars.length + coDrill.bar;
  if(barsPlayed>=1){ recordSession('comp:'+SEQ_PRESETS[coDrill.presetIdx].name, barsPlayed); saveState(); if(typeof renderPractice==='function') renderPractice(); }
  renderComp();
}
function compTick(when, count){
  if(!coDrill) return;
  const bars=coDrill.bars; if(!bars.length) return;
  const i=count%bars.length;
  if(i===0 && count>0) coDrill.cycles++;
  coDrill.bar=i;
  const cur=bars[i], nxt=bars[(i+1)%bars.length], b=beat();
  const ivs=QUALITIES[cur.qi].iv, base=48+cur.pc;
  compStrum(base, ivs, when, 0.9, 0.028);                    // guide comp on the downbeat
  compStrum(base, ivs, when+2*b, 0.55, 0.022);               // softer push on beat 3
  scheduleBand(cur.pc, cur.qi, when, true);                  // forced bass + groove bed
  for(let k=0;k<4;k++) enqueueVisual(when+k*b, ()=>compPulseBeat(k));
  enqueueVisual(when, ()=>renderCompStage(cur, nxt));
}

/* ---- DOM paint ---- */
function renderComp(){
  if(!coDrill) return;
  const keyc=document.getElementById('co-key');
  if(keyc) buildRootBtns(keyc, gRoot, (pc,r)=>{ setKey(pc,r); if(coDrill){ coDrill.bars=compBuildBars(SEQ_PRESETS[coIdx]); if(coDrill.bar>=coDrill.bars.length) coDrill.bar=0; } renderComp(); });
  const chips=document.getElementById('co-progs');
  if(chips) chips.innerHTML=SEQ_PRESETS.map((p,i)=>`<button type="button" class="btn co-prog${i===coIdx?' active':''}" data-i="${i}" aria-pressed="${i===coIdx}">${p.name}</button>`).join('');
  const beats=document.getElementById('co-beats');
  if(beats) beats.innerHTML=[0,1,2,3].map(k=>`<span class="co-beat" data-k="${k}"></span>`).join('');
  const cur=coDrill.bars[coDrill.bar], nxt=coDrill.bars[(coDrill.bar+1)%coDrill.bars.length];
  renderCompStage(cur, nxt);
  const pb=document.getElementById('co-play'); if(pb){ pb.innerHTML=(coDrill.playing?'&#9632; ':'&#9654; ')+t(coDrill.playing?'sp_stop':'sp_play'); pb.classList.toggle('active', coDrill.playing); pb.setAttribute('aria-pressed', coDrill.playing?'true':'false'); }
  const cy=document.getElementById('co-cycles'); if(cy) cy.textContent = coDrill.playing ? ('↻ '+coDrill.cycles) : '';
  const hint=document.getElementById('co-hint'); if(hint) hint.textContent=t('co_hint');
}
function renderCompStage(cur, nxt){
  const nowEl=document.getElementById('co-now'); if(nowEl) nowEl.innerHTML = cur ? cmChordBox(cmChord([cur.pc,cur.qi])) : '';
  const nxtEl=document.getElementById('co-next'); if(nxtEl) nxtEl.innerHTML = nxt ? cmChordBox(cmChord([nxt.pc,nxt.qi])) : '';
  const nl=document.getElementById('co-now-lab'); if(nl) nl.textContent=t('co_now');
  const xl=document.getElementById('co-next-lab'); if(xl) xl.textContent=t('co_next');
}
function compPulseBeat(k){
  document.querySelectorAll('#co-beats .co-beat').forEach(d=>d.classList.toggle('on', +d.dataset.k===k));
}
// re-localize an in-flight comping drill on a language switch (called from applyLang)
function refreshCompLang(){ if(coDrill) renderComp(); }

(function initComp(){
  const card=document.getElementById('start-comp'); if(!card) return;
  card.onclick=startComp;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('co-quit', exitComp);
  wire('co-play', compToggle);
  const pg=document.getElementById('co-progs');
  if(pg) pg.addEventListener('click', e=>{ const btn=e.target.closest('.co-prog'); if(btn){ coIdx=+btn.dataset.i; if(coDrill){ coDrill.presetIdx=coIdx; coDrill.bars=compBuildBars(SEQ_PRESETS[coIdx]); if(coDrill.bar>=coDrill.bars.length) coDrill.bar=0; } renderComp(); } });
})();
