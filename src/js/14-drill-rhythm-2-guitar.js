/* ===================== Drill: Rhythm guitar =====================
   Strumming and comping as one drill: a one-bar pattern of down/up strums — or your own
   rhythm ("free") — over one chord or over a progression (a preset in the key, or the
   one built in the ▶ drawer). Each 8th-note slot is lit in time; swing, a backbeat
   accent, palm muting and a band shape the feel; over a progression NOW/NEXT show the
   shapes to fret. The bar is always 8 eighths (4/4).

   With the mic on, a scored run (13-scored.js). What is expected depends on the rhythm:
   a pattern's own strums, swing applied — where the drill actually put them — or, free,
   the bar downbeats: landing the change is the job, the strums in between are yours.
   Scoring MUTES the guide guitar, which lands on exactly the slots being measured, so
   it would score the app instead of you. A run of ≥1 bar records
   rhythm:<over>:<pattern>; the track also reads the strum:* and comp:* history of the
   two drills it replaced. DOM ids stay `sp-*`. */

/* 8th-note slots over one bar (0..7 = 1 & 2 & 3 & 4 &): 'D' down, 'U' up, '' miss.
   en/uk inline so the i18n check only guards I18N. */
const STRUM_PATTERNS = [
  { id:'downs',   en:'Quarter downstrokes', uk:'Чвертки вниз',         seg:['D','','D','','D','','D',''] },
  { id:'eighths', en:'Eighth down-up',      uk:'Вісімки вниз-вгору',   seg:['D','U','D','U','D','U','D','U'] },
  { id:'common',  en:'The common one',      uk:'Найпоширеніший',       seg:['D','','D','U','','U','D','U'] },   // D · D-U · _-U-D-U
  { id:'ddu_ddu', en:'Down, down-up ×2',    uk:'Вниз, вниз-вгору ×2',  seg:['D','','D','U','D','','D','U'] },
  { id:'folk',    en:'Folk / pop',          uk:'Фолк / поп',           seg:['D','','D','U','','U','','U'] },
];
/* how far the off-beats are pushed late, as a fraction of an 8th */
const SP_SWINGS = [
  { id:'straight', amt:0,    en:'Straight', uk:'Рівно' },
  { id:'swing',    amt:0.20, en:'Swing',    uk:'Свінг' },
  { id:'shuffle',  amt:0.33, en:'Shuffle',  uk:'Шафл' },
];
function spName(p){ return lang==='en'?p.en:p.uk; }
function strumArrow(d){ return d==='D'?'↓':d==='U'?'↑':''; }   // ↓ / ↑

let spIdx = 0;          // selected pattern; -1 = free (your own rhythm, scored on the changes)
let spOver = 'chord';   // what it is played over: 'chord' (the strip's chord) | 'prog'
let spProg = 1;         // the progression: a SEQ_PRESETS index (default I–V–vi–IV), or -1 = the ▶ drawer's
let spSwing = 0;        // index into SP_SWINGS — straight by default, so a pattern reads as written
let spAccent = false;   // backbeat (2 & 4) accent
let spMute = false;     // palm-mute the strum
let spBand = false;     // drums + bass underneath
let spClick = false;    // optional beat-reference click
let spDrill = null;
// spDrill = { patIdx, over, prog, bars:[{pc,qi,lbl}…], bar, slot, barsPlayed, clock, playing }

function spFree(){ return spIdx < 0; }
/* Half an 8th for a pattern — its own resolution, so a hit means "that strum"; half a
   beat for a change, a coarser target. */
const spScore = scoredRun({
  micId:'drill-ctx-mic', statusId:'sp-status', scoreId:'sp-score',
  countKey:()=>spFree() ? 'on_changes' : 'on_played',
  tol:()=>spFree() ? beat()/2 : beat()/4,
  onChange:()=>{ if(spDrill) renderStrum(); },
});

/* ---- what it is played over ---- */
/* a preset laid on the key, one chord per bar, spelled in it */
function presetBars(preset){
  const dg=keyDegrees(), out=[];
  preset.steps.forEach(([off,qi,b])=>{
    const pc=mod(keyRoot+off,12), d=dg.find(x=>x.rootPc===pc);
    for(let k=0;k<Math.max(1,b);k++) out.push({ pc, qi, lbl:d?d.lbl:ROOTS[pc] });
  });
  return out;
}
/* the ▶ drawer's progression is offered once there is one */
function spYoursOffered(){ return seq.length>0; }
function spBars(){
  if(spOver!=='prog') return [{ pc:chRoot, qi:chQual, lbl:chLbl }];
  if(spProg<0 && spYoursOffered()){
    const out=[]; seq.forEach(st=>{ for(let k=0;k<Math.max(1,st.bars);k++) out.push({ pc:st.pc, qi:st.qi, lbl:st.lbl }); });
    return out;
  }
  return presetBars(SEQ_PRESETS[spProg] || SEQ_PRESETS[1]);
}
/* the voicing to strum: the selected shape card over the chord, the first shape of
   each chord over a progression */
function spMidis(ch){
  if(spDrill && spDrill.over!=='prog') return currentChordVoicing().midis;
  const q=QUALITIES[ch.qi], v=chordVoicings(ch.pc, q.short, q.iv)[0];
  return v ? voicingMidi(v) : q.iv.map(iv=>48+ch.pc+iv);
}
function spSessId(){
  const d=spDrill, what = d.over!=='prog' ? 'chord' : (d.prog<0 ? 'yours' : SEQ_PRESETS[d.prog].name);
  return 'rhythm:'+what+':'+(d.patIdx<0 ? 'free' : STRUM_PATTERNS[d.patIdx].id);
}

/* ---- lifecycle ---- */
function beginStrum(){
  spDrill={ patIdx:spIdx, over:spOver, prog:spProg, bars:spBars(), bar:0, slot:-1, barsPlayed:0, clock:null, playing:false };
  spScore.clearScore();
  renderStrum();
}
function endStrum(){
  spStop();
  spScore.release();     // never leave the mic open behind a closed drill
  spDrill=null;
}
function spToggle(){ if(spDrill && spDrill.playing) spStop(); else spPlay(); }
function spPlay(){
  if(!spDrill || spDrill.playing) return;
  audio();
  stopLoop();   // don't fight the reference loop / progression
  seqStop();
  drillRunStarted();                             // fold the setup
  Object.assign(spDrill, { patIdx:spIdx, over:spOver, prog:spProg, bars:spBars(), bar:0, slot:-1, barsPlayed:0, playing:true });
  spScore.begin();                               // before the clock: a tick must not
  spDrill.clock={ interval:()=>beat()/2, tick:(time,count)=>spTick(time,count) };
  addClock(spDrill.clock);   // ...land in a run we then reset
  renderStrum();
}
function spStop(){
  if(!spDrill || !spDrill.playing) return;
  if(spDrill.clock){ removeClock(spDrill.clock); spDrill.clock=null; }
  clearVisualQ();
  spDrill.playing=false; spDrill.slot=-1;
  const sc=spScore.end();
  // bars played stays the score; a scored run's timing error rides along
  if(spDrill.barsPlayed>=1) drillRecord(spSessId(), spDrill.barsPlayed, scoredErr(sc));
  renderStrum();
}
/* A setup change mid-run follows along — except one that changes what a scored run is
   measuring (pattern ↔ free), which stops it first. */
function spSet(fn){
  const wasFree=spFree();
  fn();
  if(spDrill && spDrill.playing && wasFree!==spFree()) spStop();
  if(spDrill){
    spDrill.patIdx=spIdx; spDrill.over=spOver; spDrill.prog=spProg;
    spDrill.bars=spBars(); if(spDrill.bar>=spDrill.bars.length) spDrill.bar=0;
  }
  renderStrum();
}
/* a strum that can be palm-muted (short) or open — pluckAt sets per-note duration,
   which strumMidi doesn't */
function spStrum(midis, when, vel, dir, muted){
  if(!midis.length) return;
  const order = dir<0 ? midis.slice().reverse() : midis.slice();
  const spread = muted?0.012:0.02, dur = muted?0.14:1.6;
  order.forEach((m,i)=>{ const tt=when + i*spread + (Math.random()*0.004-0.002); pluckAt(m, tt, dur, Math.max(0.25, vel - i*0.012)); });
}
function spTick(time, count){
  if(!spDrill) return;
  const slot=count%8;
  if(slot===0 && count>0){ spDrill.barsPlayed++; spDrill.bar=(spDrill.bar+1)%spDrill.bars.length; }   // a full bar wrapped
  spDrill.slot=slot;
  const ch=spDrill.bars[spDrill.bar], nxt=spDrill.bars[(spDrill.bar+1)%spDrill.bars.length];
  const b=beat(), beatPos=slot%2===0;
  const swDelay = beatPos ? 0 : SP_SWINGS[spSwing].amt*(b/2);   // push the off-beats late
  const backbeat = (slot===2 || slot===6);
  if(spDrill.patIdx<0){
    // free: the change is the scored slot; with the mic off a guide comp marks it
    if(slot===0){
      if(spDrill.playing) spScore.mark(time);
      if(!spScore.on()){
        const base=48+ch.pc, ivs=QUALITIES[ch.qi].iv;
        compStrum(base, ivs, time, 0.9, 0.028);
        compStrum(base, ivs, time+2*b, 0.55, 0.022);             // softer push on beat 3
      }
    }
  } else {
    // a pattern: only its slots sound — the empty ones are where the hand misses
    const dir=STRUM_PATTERNS[spDrill.patIdx].seg[slot];
    if(dir){
      // expected at time+swDelay, swing and all: scoring the un-swung slot would mark a
      // correctly swung player late
      if(spDrill.playing) spScore.mark(time+swDelay);
      if(!spScore.on()){
        let vel = dir==='D' ? 0.9 : 0.72;          // upstrokes lighter
        if(spAccent && backbeat) vel += 0.12;
        spStrum(spMidis(ch), time+swDelay, vel, dir==='D'?+1:-1, spMute);
      }
    }
  }
  // band: hats on every 8th (swung with the guitar), kick 1 & 3, snare on the backbeat,
  // bass on the bar's chord
  if(spBand){
    hatHit(time+swDelay, slot===0 ? 1 : (beatPos ? 0.7 : 0.45));
    if(slot===0) kickHit(time, 1);
    if(slot===4) kickHit(time, 0.9);
    if(backbeat) snareHit(time, spAccent ? 1.0 : 0.8);
    if(slot===0) bassNote(time, 36+ch.pc, b*1.9, 0.95);
    if(slot===4) bassNote(time, 36+ch.pc+fifthInterval(ch.qi), b*1.7, 0.8);
  }
  if(spClick && beatPos) metroClick(time, slot===0);              // beat-reference click
  enqueueVisual(time, ()=>{ spHighlightSlot(slot); if(beatPos) spPulseBeat(slot/2); if(slot===0) renderSpStage(ch, nxt); });
}

/* ---- DOM paint ---- */
function renderStrum(){
  if(!spDrill) return;
  segButtons('sp-over', [{label:t('pl_chord')},{label:t('pl_prog')}], spOver==='prog'?1:0, i=>spSet(()=>{ spOver=i?'prog':'chord'; }));
  const pr=document.getElementById('sp-progs-row'); if(pr) pr.hidden = spOver!=='prog';
  const pg=document.getElementById('sp-progs');
  if(pg){
    const yours=spYoursOffered(), cur=(spProg<0 && !yours) ? 1 : spProg;
    pg.innerHTML=SEQ_PRESETS.map((p,i)=>`<button type="button" class="btn sp-prog${i===cur?' active':''}" data-i="${i}" aria-pressed="${i===cur}">${p.name}</button>`).join('')+
      (yours ? `<button type="button" class="btn sp-prog${cur<0?' active':''}" data-i="-1" aria-pressed="${cur<0}">${t('sp_yours')}</button>` : '');
  }
  const chips=document.getElementById('sp-patterns');
  if(chips) chips.innerHTML=STRUM_PATTERNS.map((p,i)=>`<button type="button" class="btn sp-pat${i===spIdx?' active':''}" data-i="${i}" aria-pressed="${i===spIdx}" title="${spName(p)}" aria-label="${spName(p)}">${p.seg.map(d=>d?strumArrow(d):'·').join('')}</button>`).join('')+
    `<button type="button" class="btn sp-pat${spFree()?' active':''}" data-i="-1" aria-pressed="${spFree()}">${t('sp_free')}</button>`;
  const sw=document.getElementById('sp-swings');
  if(sw) sw.innerHTML=SP_SWINGS.map((s,i)=>`<button type="button" class="btn sp-swing${i===spSwing?' active':''}" data-i="${i}" aria-pressed="${i===spSwing}">${spName(s)}</button>`).join('');
  const nm=document.getElementById('sp-name'); if(nm) nm.textContent = spFree() ? t('sp_free') : spName(STRUM_PATTERNS[spIdx]);
  const prog=spOver==='prog';
  const ch=document.getElementById('sp-chord');
  if(ch){ ch.hidden=prog; ch.textContent=t('sp_chord')+' · '+noteTxt(chLbl)+QUALITIES[chQual].short; }
  const stage=document.getElementById('sp-stage'); if(stage) stage.hidden=!prog;
  if(prog) renderSpStage(spDrill.bars[spDrill.bar], spDrill.bars[(spDrill.bar+1)%spDrill.bars.length]);
  const g=document.getElementById('sp-grid'); if(g) g.hidden=spFree();
  const bt=document.getElementById('sp-beats');
  if(bt){ bt.hidden=!spFree(); bt.innerHTML=Array.from({length:4},(_,k)=>`<span class="co-beat" data-k="${k}"></span>`).join(''); }
  renderStrumGrid();
  const toggle=(id,on,label)=>{ const el=document.getElementById(id); if(!el) return;
    el.textContent=t(label); el.classList.toggle('active', on); el.setAttribute('aria-pressed', on?'true':'false'); };
  toggle('sp-accent', spAccent, 'sp_accent');
  toggle('sp-mute',   spMute,   'sp_mute');
  toggle('sp-band',   spBand,   'sp_band');
  const ck=document.getElementById('sp-click'); if(ck){ ck.classList.toggle('active', spClick); ck.setAttribute('aria-pressed', spClick?'true':'false'); ck.innerHTML='&#9833; '+t('cm_click'); }
  // the hint has to say which tier you're in — and that the guide guitar goes quiet
  const hint=document.getElementById('sp-hint');
  if(hint) hint.textContent=t(spFree() ? (spScore.on()?'co_hint_scored':'co_hint') : (spScore.on()?'sp_hint_scored':'sp_hint'));
  spScore.render();
  applyDrillCtx();     // the shell owns the mic's visibility, the strip's chips and its ▶
}
function renderStrumGrid(){
  const g=document.getElementById('sp-grid'); if(!g) return;
  if(spFree()){ g.innerHTML=''; return; }
  const seg=STRUM_PATTERNS[spIdx].seg;
  g.innerHTML=seg.map((d,i)=>{
    const isBeat=i%2===0, accent=spAccent&&(i===2||i===6);
    return `<div class="sp-cell${isBeat?' beat':''}${accent?' accent':''}${i===spDrill.slot?' on':''}" data-i="${i}">`+
      `<span class="sp-dir ${d?'has':'none'}">${d?strumArrow(d):''}</span>`+
      `<span class="sp-beat">${isBeat?(i/2+1):'&'}</span></div>`;
  }).join('');
}
// over a progression you have to fret it, so NOW and NEXT show the shapes
function renderSpStage(cur, nxt){
  const paint=(id, st)=>{ const el=document.getElementById(id); if(el) el.innerHTML = st ? cmChordBox(cmChord([st.pc, st.qi], st.lbl)) : ''; };
  paint('sp-now', cur); paint('sp-next', nxt);
  const nl=document.getElementById('sp-now-lab'); if(nl) nl.textContent=t('co_now');
  const xl=document.getElementById('sp-next-lab'); if(xl) xl.textContent=t('co_next');
}
function spHighlightSlot(slot){
  document.querySelectorAll('#sp-grid .sp-cell').forEach(c=>c.classList.toggle('on', +c.dataset.i===slot));
}
function spPulseBeat(k){
  document.querySelectorAll('#sp-beats .co-beat').forEach(d=>d.classList.toggle('on', +d.dataset.k===k));
}
// re-localize an in-flight drill on a language switch
function refreshStrumLang(){ if(spDrill){ renderStrum(); spScore.refreshLang(); } }

/* ids are 'rhythm-guitar': plain 'rhythm' was the Rhythm ear drill cut in step 1, whose
   history (rhythm:* items, a drillSeen key) is still in the store */
registerDrill({ id:'rhythm-guitar', area:'sp-area', tempo:true, setup:'sp-setup',   // the 8th-note clock is beat()-driven
                // over the chord it reads the chord; over a preset progression, the key
                chord:()=>spOver!=='prog', key:()=>spOver==='prog',
                play:spToggle, playing:()=>!!(spDrill && spDrill.playing),
                tracks:[{ id:'rhythm-guitar', kind:'perf', sess:'rhythm', reads:['strum','comp'], label:'drill_rhythm',
                          better:'high', unit:'bars', scored:'mic' }],
                begin:beginStrum, end:endStrum, isActive:()=>!!spDrill, refreshLang:refreshStrumLang,
                mic:()=>spScore.available(), micOn:()=>spScore.on(),
                // stop first: switching tiers mid-run would change what a score in progress measures
                onMic:()=>{ if(spDrill&&spDrill.playing) spStop();
                            spScore.toggle();
                            // scoring mutes the guide guitar, so with no click and no band there would be
                            // nothing to play against — turn the click on
                            if(spScore.on() && !spClick && !spBand) spClick=true;
                            renderStrum(); },
                // a new key re-lays a preset progression; the chord is read live
                onKey:()=>{ if(!spDrill) return; spSet(()=>{}); } });

(function initStrum(){
  const area=document.getElementById('sp-area'); if(!area) return;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('sp-click',  ()=>{ spClick=!spClick;   renderStrum(); });
  wire('sp-accent', ()=>{ spAccent=!spAccent; renderStrum(); });
  wire('sp-mute',   ()=>{ spMute=!spMute;     renderStrum(); });
  wire('sp-band',   ()=>{ spBand=!spBand;     renderStrum(); });
  const pick=(hostId, cls, set)=>{ const h=document.getElementById(hostId); if(!h) return;
    h.addEventListener('click', e=>{ const btn=e.target.closest('.'+cls); if(btn) spSet(()=>set(+btn.dataset.i)); }); };
  pick('sp-patterns', 'sp-pat',   i=>{ spIdx=i; });
  pick('sp-swings',   'sp-swing', i=>{ spSwing=i; });
  pick('sp-progs',    'sp-prog',  i=>{ spProg=i; });
})();
