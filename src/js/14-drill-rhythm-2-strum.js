/* ===================== Drill: Strumming & feel (Phase 5b + 5d, merged) =====================
   A coach LAB, not a quiz: a one-bar pattern of down/up strums on an 8th-note grid, looped
   over the current context chord (spine #1) and highlighted slot-by-slot in time — so you SEE
   and HEAR it and strum along. On top of the pattern sit the things that make a groove FEEL
   right: swing (straight → shuffle), a backbeat accent, palm-mute dynamics, and an optional
   drums+bass band.

   This was two drills. "Strumming patterns" (5b) owned the pattern grid and an optional click;
   "Groove & feel" (5d) owned swing/accent/mute over a fixed down-on-beats comp with a band.
   They were one machine — same 8th-note clock, same context chord, same coach tier, same
   session record — split across two cards, and neither could reach the other's half. Merged,
   the combinations that were previously unreachable (a swung folk pattern, a palm-muted
   "common one", any pattern over the band) just work.

   Coach tier — no timing score (Phase 8/F1); a practiced run (>=1 full bar) records a session
   in the learner's ring buffer (13) so Practice progress reflects it, minting no per-item SRS.
   Reuses the drum/bass primitives (hatHit/kickHit/snareHit/bassNote, 06), pluckAt (05) for a
   mute-able strum, metroClick (06) for the beat reference, and the shared scheduler. */

/* 8th-note slots over one bar (index 0..7 = 1 & 2 & 3 & 4 &): 'D' down, 'U' up, '' miss.
   en/uk names inline (like INTERVALS/RHYTHMS) so the i18n symmetry check only guards I18N. */
const STRUM_PATTERNS = [
  { id:'downs',   en:'Quarter downstrokes', uk:'Чвертки вниз',         seg:['D','','D','','D','','D',''] },
  { id:'eighths', en:'Eighth down-up',      uk:'Вісімки вниз-вгору',   seg:['D','U','D','U','D','U','D','U'] },
  { id:'common',  en:'The common one',      uk:'Найпоширеніший',       seg:['D','','D','U','','U','D','U'] },   // D · D-U · _-U-D-U
  { id:'ddu_ddu', en:'Down, down-up ×2',    uk:'Вниз, вниз-вгору ×2',  seg:['D','','D','U','D','','D','U'] },
  { id:'folk',    en:'Folk / pop',          uk:'Фолк / поп',           seg:['D','','D','U','','U','','U'] },
];
/* how far the off-beats are pushed late, as a fraction of an 8th — the difference between
   a stiff pattern and one that grooves. */
const SP_SWINGS = [
  { id:'straight', amt:0,    en:'Straight', uk:'Рівно' },
  { id:'swing',    amt:0.20, en:'Swing',    uk:'Свінг' },
  { id:'shuffle',  amt:0.33, en:'Shuffle',  uk:'Шафл' },
];
function spName(p){ return lang==='en'?p.en:p.uk; }
function strumArrow(d){ return d==='D'?'↓':d==='U'?'↑':''; }   // ↓ / ↑

let spIdx = 0;          // selected pattern (in-session preference)
let spSwing = 0;        // index into SP_SWINGS — straight by default, so a pattern reads as written
let spAccent = false;   // backbeat (2 & 4) accent
let spMute = false;     // palm-mute the strum
let spBand = false;     // drums + bass underneath
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
/* a strum that can be palm-muted (short, chunky) or open (ringing) — pluckAt lets us set
   per-note duration, which strumMidi (05) doesn't expose. */
function spStrum(midis, when, vel, dir, muted){
  if(!midis.length) return;
  const order = dir<0 ? midis.slice().reverse() : midis.slice();
  const spread = muted?0.012:0.02, dur = muted?0.14:1.6;
  order.forEach((m,i)=>{ const tt=when + i*spread + (Math.random()*0.004-0.002); pluckAt(m, tt, dur, Math.max(0.25, vel - i*0.012)); });
}
function spTick(time, count){
  if(!spDrill) return;
  const seg=STRUM_PATTERNS[spDrill.patIdx].seg, slot=count%8;
  if(slot===0 && count>0) spDrill.bars++;        // a full bar wrapped
  spDrill.slot=slot;
  const b=beat(), beatPos=slot%2===0;
  const swDelay = beatPos ? 0 : SP_SWINGS[spSwing].amt*(b/2);   // push the off-beats late
  const backbeat = (slot===2 || slot===6);
  // guitar: only the pattern's slots sound — the empty ones are where the hand misses
  const dir=seg[slot];
  if(dir){
    let vel = dir==='D' ? 0.9 : 0.72;            // upstrokes lighter
    if(spAccent && backbeat) vel += 0.12;
    spStrum(currentChordVoicing().midis, time+swDelay, vel, dir==='D'?+1:-1, spMute);
  }
  // band: hats on every 8th (swung with the guitar), kick 1 & 3, snare on the backbeat
  if(spBand){
    hatHit(time+swDelay, slot===0 ? 1 : (beatPos ? 0.7 : 0.45));
    if(slot===0) kickHit(time, 1);
    if(slot===4) kickHit(time, 0.9);
    if(backbeat) snareHit(time, spAccent ? 1.0 : 0.8);
    if(slot===0) bassNote(time, 36+gRoot, b*1.9, 0.95);
    if(slot===4) bassNote(time, 36+gRoot+fifthInterval(chQual), b*1.7, 0.8);
  }
  if(spClick && beatPos) metroClick(time, slot===0);              // beat-reference click
  if(typeof enqueueVisual==='function') enqueueVisual(time, ()=>spHighlightSlot(slot));
}

/* ---- DOM paint ---- */
function renderStrum(){
  if(!spDrill) return;
  const chips=document.getElementById('sp-patterns');
  if(chips) chips.innerHTML=STRUM_PATTERNS.map((p,i)=>`<button type="button" class="btn sp-pat${i===spIdx?' active':''}" data-i="${i}" aria-pressed="${i===spIdx}" title="${spName(p)}" aria-label="${spName(p)}">${p.seg.map(d=>d?strumArrow(d):'·').join('')}</button>`).join('');
  const sw=document.getElementById('sp-swings');
  if(sw) sw.innerHTML=SP_SWINGS.map((s,i)=>`<button type="button" class="btn sp-swing${i===spSwing?' active':''}" data-i="${i}" aria-pressed="${i===spSwing}">${spName(s)}</button>`).join('');
  const nm=document.getElementById('sp-name'); if(nm) nm.textContent=spName(STRUM_PATTERNS[spIdx]);
  const ch=document.getElementById('sp-chord'); if(ch) ch.textContent=t('sp_chord')+' · '+gRootLbl+QUALITIES[chQual].short;
  renderStrumGrid();
  const toggle=(id,on,label)=>{ const el=document.getElementById(id); if(!el) return;
    el.textContent=t(label); el.classList.toggle('active', on); el.setAttribute('aria-pressed', on?'true':'false'); };
  toggle('sp-accent', spAccent, 'sp_accent');
  toggle('sp-mute',   spMute,   'sp_mute');
  toggle('sp-band',   spBand,   'sp_band');
  const pb=document.getElementById('sp-play'); if(pb){ pb.innerHTML=(spDrill.playing?'&#9632; ':'&#9654; ')+t(spDrill.playing?'sp_stop':'sp_play'); pb.classList.toggle('active', spDrill.playing); pb.setAttribute('aria-pressed', spDrill.playing?'true':'false'); }
  const ck=document.getElementById('sp-click'); if(ck){ ck.classList.toggle('active', spClick); ck.setAttribute('aria-pressed', spClick?'true':'false'); ck.innerHTML='&#9833; '+t('cm_click'); }
  const hint=document.getElementById('sp-hint'); if(hint) hint.textContent=t('sp_hint');
}
function renderStrumGrid(){
  const g=document.getElementById('sp-grid'); if(!g) return;
  const seg=STRUM_PATTERNS[spIdx].seg;
  g.innerHTML=seg.map((d,i)=>{
    const isBeat=i%2===0, accent=spAccent&&(i===2||i===6);
    return `<div class="sp-cell${isBeat?' beat':''}${accent?' accent':''}${i===spDrill.slot?' on':''}" data-i="${i}">`+
      `<span class="sp-dir ${d?'has':'none'}">${d?strumArrow(d):''}</span>`+
      `<span class="sp-beat">${isBeat?(i/2+1):'&'}</span></div>`;
  }).join('');
}
function spHighlightSlot(slot){
  document.querySelectorAll('#sp-grid .sp-cell').forEach(c=>c.classList.toggle('on', +c.dataset.i===slot));
}
// re-localize an in-flight strum trainer on a language switch (called from applyLang)
function refreshStrumLang(){ if(spDrill) renderStrum(); }

registerDrill({ id:'strum', area:'sp-area',
                isActive:()=>!!spDrill, exit:exitStrum, refreshLang:refreshStrumLang,
                // the loop reads currentChordVoicing() live, so a key change only needs a repaint
                onKey:()=>{ if(spDrill) renderStrum(); } });

(function initStrum(){
  const card=document.getElementById('start-strum'); if(!card) return;
  card.onclick=startStrum;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('sp-play',   spToggle);
  wire('sp-click',  ()=>{ spClick=!spClick;   renderStrum(); });
  wire('sp-accent', ()=>{ spAccent=!spAccent; renderStrum(); });
  wire('sp-mute',   ()=>{ spMute=!spMute;     renderStrum(); });
  wire('sp-band',   ()=>{ spBand=!spBand;     renderStrum(); });
  const pick=(hostId, cls, set)=>{ const h=document.getElementById(hostId); if(!h) return;
    h.addEventListener('click', e=>{ const btn=e.target.closest('.'+cls); if(btn){ set(+btn.dataset.i); renderStrum(); } }); };
  pick('sp-patterns', 'sp-pat',   i=>{ spIdx=i; if(spDrill) spDrill.patIdx=i; });
  pick('sp-swings',   'sp-swing', i=>{ spSwing=i; });
})();
