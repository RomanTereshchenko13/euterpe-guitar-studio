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
  const keyc=document.getElementById('sp-key');
  if(keyc) buildRootBtns(keyc, gRoot, (pc,r)=>{ setKey(pc,r); renderStrum(); });
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
