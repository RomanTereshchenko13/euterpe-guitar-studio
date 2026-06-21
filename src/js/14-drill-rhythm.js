/* ===================== Drill: Chord-change fluency (Phase 5a) =====================
   The RHYTHM pillar's table-stakes coach tier — the famous "one-minute changes":
   pick a chord pair, the timer runs, and you switch between the two shapes as cleanly
   as you can, tapping the big counter on each clean change. At the end: changes made,
   changes per minute, and your personal best for that pair.

   Honest framing (roadmap): this is a COACH tier, not scored training — the app
   counts YOUR taps, it can't hear your guitar (mic scoring waits on Phase 8 / F1).
   That's no compromise here: counting yourself and beating your record IS the
   authentic form of this exercise, so the reward (a per-pair personal best) needs no
   mic. Reuses the chord diagrams (chordBoxSVG, 08), the cue bus for the count-in +
   a new-best fanfare (05), an optional metronome on its own scheduler clock
   (metroClick, 06), and the learner model's sessions ring buffer (13) — the best
   per pair is DERIVED by scanning sessions, so the pinned item shape is untouched. */

/* Classic open-chord change pairs, each [[pc,qi],[pc,qi]] (qi: 0=major, 1=minor).
   Only natural roots, so ROOTS[pc] labels stay clean (C/D/E/G/A). */
const CM_PAIRS = [
  [[9,0],[2,0]],   // A  – D
  [[9,0],[4,0]],   // A  – E
  [[2,0],[4,0]],   // D  – E
  [[0,0],[7,0]],   // C  – G
  [[7,0],[4,1]],   // G  – Em
  [[4,1],[9,1]],   // Em – Am
  [[0,0],[9,1]],   // C  – Am
  [[7,0],[2,0]],   // G  – D
  [[9,1],[2,1]],   // Am – Dm
  [[2,0],[7,0]],   // D  – G
];
const CM_DURS = [30, 60, 90];   // selectable session lengths (seconds)

let cmDurIdx = 1;        // default 60 s
let cmPairIdx = 0;       // selected preset pair (in-session preference)
let cmClick = false;     // optional metronome reference during the run
let cmDrill = null;
// cmDrill = { phase:'setup'|'run'|'done', pairIdx, dur, count, remaining, startT,
//             finished, ticker, clock, cpm, best, newBest }

function cmChord(spec){ const [pc,qi]=spec, q=QUALITIES[qi]; return { pc, qi, q, short:q.short, lbl:ROOTS[pc]+q.short }; }
function cmPairName(i){ const p=CM_PAIRS[i]; return cmChord(p[0]).lbl+' ↔ '+cmChord(p[1]).lbl; }
function cmPairId(i){ const p=CM_PAIRS[i]; return 'changes:'+cmChord(p[0]).lbl+'-'+cmChord(p[1]).lbl; }   // stable session id

/* Personal best (max changes-per-minute) for a pair, derived from the sessions ring
   buffer so the pinned learner item shape (spine #3) needs no new field. */
function cmPairBest(i){
  const id=cmPairId(i); let best=0;
  learner.sessions.forEach(s=>{ if(s.drill===id && s.score>best) best=s.score; });
  return best;
}

/* ---- lifecycle ---- */
function startChanges(){
  cmDrill={ phase:'setup', pairIdx:cmPairIdx, dur:CM_DURS[cmDurIdx] };
  const home=document.getElementById('practice-home'), area=document.getElementById('cm-area');
  if(home) home.hidden=true; if(area) area.hidden=false;
  renderCm();
}
function exitChanges(){
  cmStopClocks();
  cmDrill=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('cm-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderPractice==='function') renderPractice();
}
function cmBegin(){
  if(!cmDrill) return;
  cmStopClocks();   // safety when re-running from the summary
  cmDrill.phase='run'; cmDrill.pairIdx=cmPairIdx; cmDrill.dur=CM_DURS[cmDurIdx];
  cmDrill.count=0; cmDrill.remaining=cmDrill.dur; cmDrill.startT=Date.now();
  cmDrill.finished=false; cmDrill.cpm=0; cmDrill.newBest=false; cmDrill.best=cmPairBest(cmDrill.pairIdx);
  cmCountIn(); cmStartClocks(); renderCm();
}
function cmTap(){
  if(!cmDrill || cmDrill.phase!=='run') return;
  cmDrill.count++; renderCmCount();
  const el=document.getElementById('cm-tally'); if(el){ el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}
function cmUntap(){ if(!cmDrill || cmDrill.phase!=='run' || cmDrill.count<=0) return; cmDrill.count--; renderCmCount(); }
function finishChanges(){
  if(!cmDrill) return;
  cmStopClocks();
  cmDrill.phase='done'; cmDrill.finished=true;
  const cpm=Math.round(cmDrill.count / (cmDrill.dur/60));
  const prevBest=cmPairBest(cmDrill.pairIdx);
  cmDrill.cpm=cpm; cmDrill.newBest = cpm>0 && cpm>prevBest; cmDrill.best=Math.max(prevBest, cpm);
  recordSession(cmPairId(cmDrill.pairIdx), cpm);
  saveState();
  if(cmDrill.newBest) playCue('correct');
  if(typeof renderPractice==='function') renderPractice();
  renderCm();
}

/* ---- count-in + clocks (audio + the countdown ticker) ---- */
function cmCountIn(){
  const ctx=audio(); if(!ctx) return;
  const b=beat(), start=ctx.currentTime+0.05;
  for(let k=0;k<4;k++) cueBlip(start+k*b, k===3?1500:1100, 0.22, 0.05, 'square');   // "1-2-3-go"
}
function cmStartClocks(){
  cmDrill.ticker=setInterval(cmCountdown, 1000);
  if(cmClick){ audio();
    cmDrill.clock={ interval:()=>beat(), tick:(time,count)=>metroClick(time, count%4===0) };
    if(typeof addClock==='function') addClock(cmDrill.clock);
  }
}
function cmStopClocks(){
  if(cmDrill && cmDrill.ticker){ clearInterval(cmDrill.ticker); cmDrill.ticker=null; }
  if(cmDrill && cmDrill.clock){ if(typeof removeClock==='function') removeClock(cmDrill.clock); cmDrill.clock=null; }
}
function cmCountdown(){
  if(!cmDrill || cmDrill.phase!=='run') return;
  cmDrill.remaining--;
  if(cmDrill.remaining<=0){ cmDrill.remaining=0; finishChanges(); return; }
  renderCmTime();
}
function cmFmtTime(s){ s=Math.max(0,s|0); const m=Math.floor(s/60), ss=s%60; return m+':'+(ss<10?'0':'')+ss; }

/* ---- DOM paint (no-ops cleanly when the panel isn't in the DOM, e.g. some tests) ---- */
function renderCm(){
  if(!cmDrill) return;
  const setup=document.getElementById('cm-setup'), active=document.getElementById('cm-active'), sum=document.getElementById('cm-summary');
  if(!setup || !active || !sum) return;
  setup.hidden = cmDrill.phase!=='setup';
  active.hidden = cmDrill.phase!=='run';
  sum.hidden = cmDrill.phase!=='done';
  if(cmDrill.phase==='setup') renderCmSetup();
  else if(cmDrill.phase==='run') renderCmActive();
  else renderCmSummary();
}
function renderCmSetup(){
  if(!cmDrill) return;
  const pp=document.getElementById('cm-pairs');
  if(pp) pp.innerHTML=CM_PAIRS.map((p,i)=>`<button type="button" class="btn cm-pair${i===cmDrill.pairIdx?' active':''}" data-i="${i}" aria-pressed="${i===cmDrill.pairIdx}">${cmPairName(i)}</button>`).join('');
  const dd=document.getElementById('cm-durs');
  if(dd) dd.innerHTML=CM_DURS.map((d,i)=>`<button type="button" class="btn cm-dur${i===cmDurIdx?' active':''}" data-i="${i}" aria-pressed="${i===cmDurIdx}">${d}${t('cm_sec')}</button>`).join('');
  const ck=document.getElementById('cm-click');
  if(ck){ ck.classList.toggle('active', cmClick); ck.setAttribute('aria-pressed', cmClick?'true':'false'); ck.innerHTML='&#9833; '+t('cm_click'); }
  const bl=document.getElementById('cm-setup-best');
  if(bl){ const b=cmPairBest(cmDrill.pairIdx); bl.textContent = b>0 ? (t('cm_best')+' · '+b+' '+t('cm_cpm').toLowerCase()) : ''; }
  const sb=document.getElementById('cm-start-btn'); if(sb) sb.innerHTML='&#9654; '+t('cm_start');
}
function cmChordBox(c){
  const q=c.q, funcMap={};
  q.iv.forEach((iv,i)=>{ funcMap[mod(c.pc+iv,12)]=labClass(q.lab[i]); });
  const list=chordVoicings(c.pc, c.short, q.iv), v=list[0];
  return `<div class="cm-chordname">${c.lbl}</div>${v?chordBoxSVG(v, funcMap):''}`;
}
function renderCmActive(){
  if(!cmDrill) return;
  const p=CM_PAIRS[cmDrill.pairIdx];
  const a=document.getElementById('cm-chord-a'), b=document.getElementById('cm-chord-b');
  if(a) a.innerHTML=cmChordBox(cmChord(p[0]));
  if(b) b.innerHTML=cmChordBox(cmChord(p[1]));
  renderCmTime(); renderCmCount();
  const sub=document.getElementById('cm-sub'); if(sub) sub.textContent=t('cm_tap_hint');
  const ut=document.getElementById('cm-untap'); if(ut) ut.innerHTML='&minus; '+t('cm_undo');
  const st=document.getElementById('cm-stop'); if(st) st.textContent=t('cm_stop');
}
function renderCmTime(){ const tm=document.getElementById('cm-timer'); if(tm && cmDrill) tm.textContent=cmFmtTime(cmDrill.remaining); }
function renderCmCount(){
  const c=document.getElementById('cm-count-val'); if(c && cmDrill) c.textContent=cmDrill.count;
  const lab=document.getElementById('cm-count-lab'); if(lab) lab.textContent=t('cm_changes');
}
function renderCmSummary(){
  const el=document.getElementById('cm-summary'); if(!el || !cmDrill) return;
  const stat=(v,l)=>'<div class="pp-stat"><div class="pp-val">'+v+'</div><div class="pp-lab">'+l+'</div></div>';
  const title = cmDrill.newBest ? t('cm_newbest') : t('drill_complete');
  el.innerHTML='<div class="drill-done-title">'+title+'</div>'+
    '<div class="pp-stats">'+
      stat(cmDrill.count, t('cm_changes'))+
      stat(cmDrill.cpm, t('cm_cpm'))+
      stat(cmDrill.best, t('cm_best'))+
      stat(cmDrill.dur+t('cm_sec'), t('drill_time'))+
    '</div>'+
    '<div class="drill-actions"><button class="btn play" id="cm-again"></button><button class="btn" id="cm-done"></button></div>';
  const ag=document.getElementById('cm-again'); if(ag){ ag.innerHTML='&#9654; '+t('drill_again'); ag.onclick=cmBegin; }
  const dn=document.getElementById('cm-done');  if(dn){ dn.textContent=t('drill_done'); dn.onclick=exitChanges; }
}
// re-localize an in-flight changes drill on a language switch (called from applyLang)
function refreshChangesLang(){ if(cmDrill) renderCm(); }

/* card starter + in-drill controls — wired once at load (guarded so a missing panel
   never throws, mirroring initDrill / initEar). */
(function initChanges(){
  const card=document.getElementById('start-changes'); if(!card) return;
  card.onclick=startChanges;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('cm-quit',      exitChanges);
  wire('cm-start-btn', cmBegin);
  wire('cm-stop',      finishChanges);   // finish early
  wire('cm-tally',     cmTap);
  wire('cm-untap',     cmUntap);
  wire('cm-click',     ()=>{ cmClick=!cmClick; renderCmSetup(); });
  const pp=document.getElementById('cm-pairs');
  if(pp) pp.addEventListener('click', e=>{ const btn=e.target.closest('.cm-pair'); if(btn){ cmPairIdx=+btn.dataset.i; if(cmDrill) cmDrill.pairIdx=cmPairIdx; renderCmSetup(); } });
  const dd=document.getElementById('cm-durs');
  if(dd) dd.addEventListener('click', e=>{ const btn=e.target.closest('.cm-dur'); if(btn){ cmDurIdx=+btn.dataset.i; if(cmDrill) cmDrill.dur=CM_DURS[cmDurIdx]; renderCmSetup(); } });
})();


/* ===================== Drill: Strumming-pattern trainer (Phase 5b) =====================
   A coach VISUALIZER, not a quiz: a one-bar 4/4 pattern of down/up strums on an 8th-note
   grid, looped over the current context chord (spine #1) and highlighted slot-by-slot in
   time on the scheduler — so you SEE and HEAR the pattern and strum along. No score (coach
   tier): mic-scored timing waits on Phase 8/F1. A practiced run (≥1 full bar) lands a
   session in the learner's ring buffer (13) so the Practice progress reflects it, but it
   mints no per-item SRS (the pinned item shape stays untouched). Reuses strumMidi (05) for
   the directional sweep, an optional metroClick beat reference (06), and the scheduler. */

/* 8th-note slots over one 4/4 bar (index 0..7 = 1 & 2 & 3 & 4 &): 'D' down, 'U' up, '' miss.
   en/uk names inline (like INTERVALS/RHYTHMS) so the i18n symmetry check only guards I18N. */
const STRUM_PATTERNS = [
  { id:'downs',   en:'Quarter downstrokes', uk:'Чвертки вниз',         seg:['D','','D','','D','','D',''] },
  { id:'eighths', en:'Eighth down-up',      uk:'Вісімки вниз-вгору',   seg:['D','U','D','U','D','U','D','U'] },
  { id:'common',  en:'The common one',      uk:'Найпоширеніший',       seg:['D','','D','U','','U','D','U'] },   // D · D-U · _-U-D-U
  { id:'ddu_ddu', en:'Down, down-up ×2',    uk:'Вниз, вниз-вгору ×2',  seg:['D','','D','U','D','','D','U'] },
  { id:'folk',    en:'Folk / pop',          uk:'Фолк / поп',           seg:['D','','D','U','','U','','U'] },
];
function spName(p){ return lang==='en'?p.en:p.uk; }
function strumArrow(d){ return d==='D'?'↓':d==='U'?'↑':''; }   // ↓ / ↑

let spIdx = 0;          // selected pattern (in-session preference)
let spClick = false;    // optional beat-reference click
let spDrill = null;
// spDrill = { patIdx, slot, bars, clock, playing }

function startStrum(){
  spDrill={ patIdx:spIdx, slot:-1, bars:0, clock:null, playing:false };
  const home=document.getElementById('practice-home'), area=document.getElementById('sp-area');
  if(home) home.hidden=true; if(area) area.hidden=false;
  renderStrum();
}
function exitStrum(){
  spStop();
  spDrill=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('sp-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderPractice==='function') renderPractice();
}
function spToggle(){ if(spDrill && spDrill.playing) spStop(); else spPlay(); }
function spPlay(){
  if(!spDrill || spDrill.playing) return;
  audio();
  if(typeof stopLoop==='function') stopLoop();   // don't fight the reference loop / progression
  if(typeof seqStop==='function') seqStop();
  spDrill.patIdx=spIdx; spDrill.slot=-1; spDrill.bars=0; spDrill.playing=true;
  spDrill.clock={ interval:()=>beat()/2, tick:(time,count)=>spTick(time,count) };
  if(typeof addClock==='function') addClock(spDrill.clock);
  renderStrum();
}
function spStop(){
  if(!spDrill || !spDrill.playing) return;
  if(spDrill.clock){ if(typeof removeClock==='function') removeClock(spDrill.clock); spDrill.clock=null; }
  if(typeof clearVisualQ==='function') clearVisualQ();
  spDrill.playing=false; spDrill.slot=-1;
  if(spDrill.bars>=1){ recordSession('strum:'+STRUM_PATTERNS[spDrill.patIdx].id, spDrill.bars); saveState(); if(typeof renderPractice==='function') renderPractice(); }
  renderStrum();
}
function spTick(time, count){
  if(!spDrill) return;
  const seg=STRUM_PATTERNS[spDrill.patIdx].seg, slot=count%8;
  if(slot===0 && count>0) spDrill.bars++;        // a full bar wrapped
  spDrill.slot=slot;
  const dir=seg[slot];
  if(dir){ const v=currentChordVoicing();
    if(dir==='D') strumMidi(v.midis, time, 0.9, 0.022, +1);     // downstroke, low→high
    else strumMidi(v.midis, time, 0.72, 0.018, -1);             // upstroke, high→low (lighter)
  }
  if(spClick && slot%2===0) metroClick(time, slot===0);          // beat-reference click
  if(typeof enqueueVisual==='function') enqueueVisual(time, ()=>spHighlightSlot(slot));
}

/* ---- DOM paint ---- */
function renderStrum(){
  if(!spDrill) return;
  const chips=document.getElementById('sp-patterns');
  if(chips) chips.innerHTML=STRUM_PATTERNS.map((p,i)=>`<button type="button" class="btn sp-pat${i===spIdx?' active':''}" data-i="${i}" aria-pressed="${i===spIdx}" title="${spName(p)}" aria-label="${spName(p)}">${p.seg.map(d=>d?strumArrow(d):'·').join('')}</button>`).join('');
  const nm=document.getElementById('sp-name'); if(nm) nm.textContent=spName(STRUM_PATTERNS[spIdx]);
  const ch=document.getElementById('sp-chord'); if(ch) ch.textContent=t('sp_chord')+' · '+gRootLbl+QUALITIES[chQual].short;
  renderStrumGrid();
  const pb=document.getElementById('sp-play'); if(pb){ pb.innerHTML=(spDrill.playing?'&#9632; ':'&#9654; ')+t(spDrill.playing?'sp_stop':'sp_play'); pb.classList.toggle('active', spDrill.playing); pb.setAttribute('aria-pressed', spDrill.playing?'true':'false'); }
  const ck=document.getElementById('sp-click'); if(ck){ ck.classList.toggle('active', spClick); ck.setAttribute('aria-pressed', spClick?'true':'false'); ck.innerHTML='&#9833; '+t('cm_click'); }
  const hint=document.getElementById('sp-hint'); if(hint) hint.textContent=t('sp_hint');
}
function renderStrumGrid(){
  const g=document.getElementById('sp-grid'); if(!g) return;
  const seg=STRUM_PATTERNS[spIdx].seg;
  g.innerHTML=seg.map((d,i)=>{
    const isBeat=i%2===0;
    return `<div class="sp-cell${isBeat?' beat':''}${i===spDrill.slot?' on':''}" data-i="${i}">`+
      `<span class="sp-dir ${d?'has':'none'}">${d?strumArrow(d):''}</span>`+
      `<span class="sp-beat">${isBeat?(i/2+1):'&'}</span></div>`;
  }).join('');
}
function spHighlightSlot(slot){
  document.querySelectorAll('#sp-grid .sp-cell').forEach(c=>c.classList.toggle('on', +c.dataset.i===slot));
}
// re-localize an in-flight strum trainer on a language switch (called from applyLang)
function refreshStrumLang(){ if(spDrill) renderStrum(); }

(function initStrum(){
  const card=document.getElementById('start-strum'); if(!card) return;
  card.onclick=startStrum;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('sp-quit',  exitStrum);
  wire('sp-play',  spToggle);
  wire('sp-click', ()=>{ spClick=!spClick; renderStrum(); });
  const pp=document.getElementById('sp-patterns');
  if(pp) pp.addEventListener('click', e=>{ const btn=e.target.closest('.sp-pat'); if(btn){ spIdx=+btn.dataset.i; if(spDrill) spDrill.patIdx=spIdx; renderStrum(); } });
})();


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
