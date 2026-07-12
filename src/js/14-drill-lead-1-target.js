/* ===================== Drill: Chord-tone targeting (Phase 6a) =====================
   The LEAD pillar's table-stakes tier — playing OVER the changes. A chosen progression
   loops with a full backing band (bass + groove + a guide comp), and for the chord that
   is sounding NOW its chord tones light up as targets on a tappable neck. You aim for the
   lit tones; a tap on a chord tone lands (lights + sounds its degree), a tap off the chord
   buzzes. Each bar the targets move to the new chord, so you track the tones through the
   progression.

   Honest framing (roadmap): with no mic this trains WHERE the chord tones are — a
   location/recognition game, not soloing; don't market it as the latter. Tap input is
   scored on ACCURACY (right tones vs wrong notes), never on timing (touch latency corrupts
   timing — the coach-tier rule); real "play your guitar and get scored" waits on Phase 8/F2.
   A practiced run (≥1 bar) records a session (accuracy %), minting no per-item SRS — the
   looping shape derives from the sessions ring buffer, like the Rhythm coaches, so the
   pinned learner item shape (spine #3) stays untouched.

   Reuses SEQ_PRESETS + compBuildBars-style expansion (resolved to the context key, spine
   #1), scheduleBand(force)/compStrum for the band (06), the scheduler clock + enqueueVisual,
   the shared board paint (renderBoard, 07) on its OWN board, and playCue/pluck (05). */

let tgIdx = 1;          // selected progression (default I–V–vi–IV)
let tgDrill = null;
// tgDrill = { presetIdx, bars:[{pc,qi}…], bar, cycles, clock, playing,
//             hits, misses, targetPcs:Set(pc), degMap:{pc:lab}, found:Set("si:f") }

// expand a preset's steps (offset, qi, bars) into one chord per bar, in the context key
function tgBuildBars(preset){
  const r=gRoot, out=[];
  preset.steps.forEach(([off,qi,b])=>{ const pc=mod(r+off,12); for(let k=0;k<Math.max(1,b);k++) out.push({pc, qi}); });
  return out;
}
function startTarget(){
  tgDrill={ presetIdx:tgIdx, bars:tgBuildBars(SEQ_PRESETS[tgIdx]), bar:0, cycles:0, clock:null, playing:false,
            hits:0, misses:0, targetPcs:new Set(), degMap:{}, found:new Set() };
  const home=document.getElementById('practice-home'), area=document.getElementById('tg-area');
  if(home) home.hidden=true; if(area) area.hidden=false;
  renderTargetBoard();
  renderTarget();
}
function exitTarget(){
  targetStop();
  tgDrill=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('tg-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderPractice==='function') renderPractice();
}
function targetToggle(){ if(tgDrill && tgDrill.playing) targetStop(); else targetPlay(); }
function targetPlay(){
  if(!tgDrill || tgDrill.playing) return;
  audio();
  if(typeof stopLoop==='function') stopLoop();       // don't fight the reference loop / progression
  if(typeof seqStop==='function') seqStop();
  tgDrill.presetIdx=tgIdx; tgDrill.bars=tgBuildBars(SEQ_PRESETS[tgIdx]);
  tgDrill.bar=0; tgDrill.cycles=0; tgDrill.hits=0; tgDrill.misses=0; tgDrill.playing=true;
  tgDrill.clock={ interval:()=>beat()*4, tick:(time,count)=>targetTick(time,count) };
  if(typeof addClock==='function') addClock(tgDrill.clock);
  renderTarget();
}
function targetStop(){
  if(!tgDrill || !tgDrill.playing) return;
  if(tgDrill.clock){ if(typeof removeClock==='function') removeClock(tgDrill.clock); tgDrill.clock=null; }
  if(typeof clearVisualQ==='function') clearVisualQ();
  tgDrill.playing=false;
  const barsPlayed = tgDrill.cycles*tgDrill.bars.length + tgDrill.bar;
  if(barsPlayed>=1){ recordSession('target:'+SEQ_PRESETS[tgDrill.presetIdx].name, tgAccuracy()); saveState(); if(typeof renderPractice==='function') renderPractice(); }
  renderTarget();
}
// accuracy over the run: right tones / all taps, as a 0..100 int (0 when untapped)
function tgAccuracy(){ const tot=tgDrill.hits+tgDrill.misses; return tot ? Math.round(100*tgDrill.hits/tot) : 0; }
function targetTick(when, count){
  if(!tgDrill) return;
  const bars=tgDrill.bars; if(!bars.length) return;
  const i=count%bars.length;
  if(i===0 && count>0) tgDrill.cycles++;
  tgDrill.bar=i;
  const cur=bars[i], nxt=bars[(i+1)%bars.length], b=beat();
  const ivs=QUALITIES[cur.qi].iv, base=48+cur.pc;
  // the SCORING state (which tones are targets this bar) is set synchronously in the
  // tick so a tap always reads the current chord — only the DOM guides ride the visual
  // queue (which may lag/skip a frame). Reset the found set for the new bar.
  const pcs=new Set(), deg={};
  QUALITIES[cur.qi].lab.forEach((lab,idx)=>{ const pc=mod(cur.pc+ivs[idx],12); pcs.add(pc); deg[pc]=lab; });
  tgDrill.targetPcs=pcs; tgDrill.degMap=deg; tgDrill.found=new Set();
  compStrum(base, ivs, when, 0.62, 0.03);                    // light guide comp under your targeting
  scheduleBand(cur.pc, cur.qi, when, true);                  // forced bass + groove bed
  for(let k=0;k<4;k++) enqueueVisual(when+k*b, ()=>tgPulseBeat(k));
  enqueueVisual(when, ()=>{ markTargets(); renderTargetStage(cur, nxt); });
}
// paint/refresh which dots are lit targets, clearing the previous bar's hit/miss marks
function markTargets(){
  if(!tgDrill) return;
  document.querySelectorAll('#tg-board .dot.quiz').forEach(d=>{
    const pc=+d.dataset.pc;
    d.classList.remove('hit','miss'); d.textContent='';
    d.classList.toggle('target', tgDrill.targetPcs.has(pc));
  });
}

// one tap at (string,fret) while the loop runs. A chord tone not yet found this bar →
// hit (light its degree + sound it); an off-chord note → miss (buzz); a re-tap → ignored.
function targetAnswer(si, f){
  if(!tgDrill || !tgDrill.playing) return;
  const pc=(OPEN_MIDI[si]+f)%12, key=si+':'+f;
  if(tgDrill.targetPcs.has(pc)){
    if(tgDrill.found.has(key)) return;                       // already landed
    tgDrill.found.add(key); tgDrill.hits++;
    markTargetDot(si,f,'hit');
    pluck(OPEN_MIDI[si]+f);
  } else {
    tgDrill.misses++;
    markTargetDot(si,f,'miss');
    playCue('wrong');
  }
  renderTargetStats();
}

/* ---- DOM paint (no-ops cleanly when the panel isn't in the DOM, e.g. some tests) ---- */
function renderTargetBoard(){
  const el=document.getElementById('tg-board'); if(!el) return;
  renderBoard(el, (pc,si,f)=>{
    const d=document.createElement('div'); d.className='dot quiz';
    d.dataset.si=si; d.dataset.f=f; d.dataset.pc=pc; d.tabIndex=0; d.setAttribute('role','button');
    d.setAttribute('aria-label', SNAMES[si]+' '+f);        // the position, never the answer
    return d;
  });
  renderNums(document.getElementById('tg-nums'));
}
function renderTarget(){
  if(!tgDrill) return;
  const keyc=document.getElementById('tg-key');
  if(keyc) buildRootBtns(keyc, gRoot, (pc,r)=>{ setKey(pc,r); if(tgDrill){ tgDrill.bars=tgBuildBars(SEQ_PRESETS[tgIdx]); if(tgDrill.bar>=tgDrill.bars.length) tgDrill.bar=0; } renderTarget(); });
  const chips=document.getElementById('tg-progs');
  if(chips) chips.innerHTML=SEQ_PRESETS.map((p,i)=>`<button type="button" class="btn tg-prog${i===tgIdx?' active':''}" data-i="${i}" aria-pressed="${i===tgIdx}">${p.name}</button>`).join('');
  const beats=document.getElementById('tg-beats');
  if(beats) beats.innerHTML=[0,1,2,3].map(k=>`<span class="co-beat" data-k="${k}"></span>`).join('');
  const cur=tgDrill.bars[tgDrill.bar], nxt=tgDrill.bars[(tgDrill.bar+1)%tgDrill.bars.length];
  renderTargetStage(cur, nxt);
  renderTargetStats();
  const pb=document.getElementById('tg-play'); if(pb){ pb.innerHTML=(tgDrill.playing?'&#9632; ':'&#9654; ')+t(tgDrill.playing?'sp_stop':'sp_play'); pb.classList.toggle('active', tgDrill.playing); pb.setAttribute('aria-pressed', tgDrill.playing?'true':'false'); }
  const hint=document.getElementById('tg-hint'); if(hint) hint.textContent=t('tg_hint');
}
function tgChordName(st){ return st ? ROOTS[st.pc]+QUALITIES[st.qi].short : ''; }
function renderTargetStage(cur, nxt){
  const nowEl=document.getElementById('tg-now'); if(nowEl) nowEl.textContent=tgChordName(cur);
  const nxtEl=document.getElementById('tg-next'); if(nxtEl) nxtEl.textContent=tgChordName(nxt);
  const nl=document.getElementById('tg-now-lab'); if(nl) nl.textContent=t('co_now');
  const xl=document.getElementById('tg-next-lab'); if(xl) xl.textContent=t('co_next');
}
function renderTargetStats(){
  if(!tgDrill) return;
  const h=document.getElementById('tg-hits'); if(h) h.textContent=t('tg_hits')+' '+tgDrill.hits;
  const a=document.getElementById('tg-acc'); if(a) a.textContent = (tgDrill.hits+tgDrill.misses) ? (t('tg_acc')+' '+tgAccuracy()+'%') : '';
}
function tgPulseBeat(k){
  document.querySelectorAll('#tg-beats .co-beat').forEach(d=>d.classList.toggle('on', +d.dataset.k===k));
}
function markTargetDot(si,f,kind){
  const d=document.querySelector('#tg-board .dot.quiz[data-si="'+si+'"][data-f="'+f+'"]'); if(!d) return;
  if(kind==='hit'){ d.classList.add('hit'); d.textContent=(tgDrill.degMap[+d.dataset.pc]||''); rippleDot(d); }
  else { d.classList.add('miss'); setTimeout(()=>{ if(d) d.classList.remove('miss'); }, 420); }
}
// re-localize an in-flight targeting drill on a language switch (called from applyLang)
function refreshTargetLang(){ if(tgDrill) renderTarget(); }

/* card starter + in-drill controls — wired once at load (guarded so a missing panel
   never throws, mirroring initComp / initDrill). */
(function initTarget(){
  const card=document.getElementById('start-target'); if(!card) return;
  card.onclick=startTarget;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('tg-quit', exitTarget);
  wire('tg-play', targetToggle);
  const pg=document.getElementById('tg-progs');
  if(pg) pg.addEventListener('click', e=>{ const btn=e.target.closest('.tg-prog'); if(btn){ tgIdx=+btn.dataset.i; if(tgDrill){ tgDrill.presetIdx=tgIdx; tgDrill.bars=tgBuildBars(SEQ_PRESETS[tgIdx]); if(tgDrill.bar>=tgDrill.bars.length) tgDrill.bar=0; } renderTarget(); } });
  const b=document.getElementById('tg-board');
  if(b){
    const fire=d=>{ if(d) targetAnswer(parseInt(d.dataset.si,10), parseInt(d.dataset.f,10)); };
    b.addEventListener('click', e=>fire(e.target.closest('.dot.quiz')));
    b.addEventListener('keydown', e=>{ if(e.key!=='Enter'&&e.key!==' ') return; const d=e.target.closest('.dot.quiz'); if(!d) return; e.preventDefault(); fire(d); });
  }
})();
