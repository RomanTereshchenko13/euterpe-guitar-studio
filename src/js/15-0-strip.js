/* ===================== THE CONTEXT STRIP: key · chord · tempo · ▶ · tuner · ⚙ ===================== */
/* One row directly above the neck in Reference and above the drill stage in Practice.
   It is one element, moved between the two slots (placeStrip), so both layers share one
   layout grammar and one set of listeners. Each chip opens a sheet under the row, one
   sheet at a time. What the row offers is derived: Reference shows every chip; a drill
   shows the ones its registry entry declares (key, chord, tempo, play). */

const SHEET_IDS   = { key:'sheet-key', chord:'sheet-chord', tempo:'sheet-tempo', play:'backing-panel', settings:'toolbar' };
const SHEET_CHIPS = { key:'chip-key',  chord:'chip-chord',  tempo:'chip-tempo',  play:'backing-toggle', settings:'tb-toggle' };

function sheetIsOpen(k){
  return k==='key' ? keySheetOpen : k==='chord' ? chordSheetOpen : k==='tempo' ? tempoSheetOpen
       : k==='play' ? backingOpen : k==='settings' ? toolbarOpen : false;
}
function setSheetFlag(k, on){
  if(k==='key') keySheetOpen=on; else if(k==='chord') chordSheetOpen=on; else if(k==='tempo') tempoSheetOpen=on;
  else if(k==='play') backingOpen=on; else if(k==='settings') toolbarOpen=on;
}
/* Is this chip on screen? A sheet whose chip is not stays shut but keeps its flag, so
   the drawer is back where it was when Practice hands the strip back. */
function chipOffered(k){
  if(k==='settings' || currentMode!=='practice') return true;
  if(k==='play') return false;                     // the drawer is the reference transport's
  const d=activeDrill(); if(!d) return false;
  return k==='key' ? !!d.key : k==='chord' ? !!d.chord : k==='tempo' ? !!d.tempo : false;
}
function sheetShown(k){ return sheetIsOpen(k) && chipOffered(k); }

/* one sheet at a time: opening one closes the rest */
function toggleSheet(k){
  const on=!sheetShown(k);
  Object.keys(SHEET_IDS).forEach(o=>setSheetFlag(o, false));
  if(on && chipOffered(k)) setSheetFlag(k, true);
  applySheets(); paintSheets();
  saveState();
}
/* Escape, or the ✕: returns whether anything was open */
function closeSheets(){
  if(!Object.keys(SHEET_IDS).some(sheetShown)) return false;
  Object.keys(SHEET_IDS).forEach(o=>setSheetFlag(o, false));
  applySheets(); saveState();
  return true;
}
function applySheets(){
  let any=false;
  Object.keys(SHEET_IDS).forEach(k=>{
    const on=sheetShown(k);
    const el=document.getElementById(SHEET_IDS[k]); if(el) el.hidden=!on;
    const chip=document.getElementById(SHEET_CHIPS[k]);
    if(chip){ chip.classList.toggle('open', on); chip.setAttribute('aria-expanded', on?'true':'false'); }
    any = any || on;
  });
  const host=document.getElementById('sheets'); if(host) host.hidden=!any;
}
/* The open sheets' contents. A shut sheet is stale until it opens, like a hidden view. */
function paintSheets(){
  if(sheetShown('key'))   repaintKeepingFocus(document.getElementById('sheet-key'), renderKeySheet);
  if(sheetShown('chord')) repaintKeepingFocus(document.getElementById('sheet-chord'), renderChordSheet);
  if(sheetShown('play'))  renderPlaySheet();
  markScrollables();
}
/* A pick inside a sheet repaints the buttons it was made on; a keyboard player keeps
   their place on the one that now stands for the same thing. */
const FOCUS_KEYS=['data-deg','data-sc','data-pc','data-i','data-type','aria-label'];
function repaintKeepingFocus(host, paint){
  const a=document.activeElement, inside=!!(host && a && a!==host && host.contains(a));
  const sig=el=>FOCUS_KEYS.map(n=>el.getAttribute(n)).join('|'), was=inside ? sig(a) : null;
  paint();
  if(!inside || host.contains(a)) return;
  const m=[...host.querySelectorAll('button, [tabindex]')].find(el=>sig(el)===was);
  if(m) m.focus({preventScroll:true});
}

function renderKeySheet(){
  buildScFams();
  renderCircle();
  const cd=document.getElementById('cof-cadence'); if(cd) cd.textContent=t('b_cadence').replace('{cad}', keyCadenceName());
}
function renderChordSheet(){ renderDegrees(); buildChQuals(); }
function renderPlaySheet(){
  segButtons('pl-src', [{label:t('pl_chord')},{label:t('pl_prog')}], playSrc==='prog'?1:0, i=>setPlaySrc(i?'prog':'chord'));
  setBandLabels();
}
/* what ▶ plays; switching while it sounds switches what is sounding */
function setPlaySrc(v){
  playSrc = v==='prog' ? 'prog' : 'chord';
  if(loopClock || seqClock){ stopLoop(); seqStop(); refPlayToggle(); }
  renderPlaySheet(); renderPlayBtn(); saveState();
}

/* ---- the row ---- */
function chipHTML(txt){ return '<span class="chip-val">'+txt+'</span><span class="chev" aria-hidden="true">▾</span>'; }
function paintTempoChip(){
  const c=document.getElementById('chip-tempo'); if(!c) return;
  const m=curMeter().id;
  c.innerHTML='<span class="chip-ico" aria-hidden="true">♩</span>'+chipHTML(tempo+' · '+m);
  c.setAttribute('aria-label', t('tb_tempo')+': '+tempo+' BPM, '+m); c.title=t('tb_tempo');
}
function renderStrip(){
  const pr=currentMode==='practice', d=pr ? activeDrill() : null;
  const show=(id,on)=>{ const el=document.getElementById(id); if(el) el.hidden=!on; };
  ['key','chord','tempo','play'].forEach(k=>show(SHEET_CHIPS[k], chipOffered(k)));
  show('chip-play', !pr || !!(d && d.play));
  const kn=noteTxt(keyLbl)+' '+sKeyName(SCALES[scIdx]);
  const ck=document.getElementById('chip-key');
  if(ck){ ck.innerHTML=chipHTML(kn); ck.setAttribute('aria-label', t('strip_key')+': '+kn); ck.title=t('strip_key'); }
  const cn=noteTxt(chLbl)+QUALITIES[chQual].short;
  const cc=document.getElementById('chip-chord');
  if(cc){ cc.innerHTML=chipHTML(cn); cc.setAttribute('aria-label', t('lbl_chord')+': '+cn); cc.title=t('lbl_chord'); }
  paintTempoChip();
  // the root buttons are twelve and static, so they track the key even while shut
  activateRoot(document.getElementById('g-roots'), keyRoot);
  const label=(id,key)=>{ const el=document.getElementById(id); if(el){ el.setAttribute('aria-label', t(key)); el.title=t(key); } };
  label('backing-toggle', 'pl_h'); label('tb-toggle', 'tb_settings'); label('tb-tuner', 'tuner_open');
  renderPlayBtn();
  applySheets(); paintSheets();
}
/* The one ▶. In Reference it is the backing transport — the chord on a loop or the
   progression, with whatever band the drawer has on; in a drill it is that drill's own
   verb (Play, Start, Replay), and its label says which. */
function renderPlayBtn(){
  const b=document.getElementById('g-play'); if(!b) return;
  let on=false, txt, tip, toggle=true;
  if(currentMode==='practice'){
    const d=activeDrill(); if(!d || !d.play) return;
    toggle=typeof d.playing==='function';
    on=toggle && !!d.playing();
    tip=txt=t(d.playKey ? d.playKey() : (on?'sp_stop':'sp_play'));
  } else {
    on=!!(loopClock || seqClock);
    const prog = seqClock || (playSrc==='prog' && seq.length>0);
    txt = loopClock ? loopChordLabel() : seqClock ? seqChordName({lbl:chLbl, qi:chQual})
        : prog ? t('seq_title') : noteTxt(chLbl)+QUALITIES[chQual].short;
    tip = on ? t('sp_stop') : t(prog ? 'pl_play_prog' : 'pl_play_chord');
  }
  b.innerHTML='<span class="strip-pulse" aria-hidden="true"></span><span class="chip-ico" aria-hidden="true">'+(on?'■':'▶')+'</span><span class="chip-txt">'+txt+'</span>';
  b.classList.toggle('active', on);
  b.setAttribute('aria-label', tip); b.title=tip;
  if(toggle) b.setAttribute('aria-pressed', on?'true':'false'); else b.removeAttribute('aria-pressed');
}
function stripPlay(){
  if(currentMode==='practice'){ const d=activeDrill(); if(d && d.play){ d.play(); applyDrillCtx(); } return; }
  refPlayToggle();
}
/* the strip lives above the neck in Reference, under the drill header in Practice */
function placeStrip(){
  const s=document.getElementById('strip'), slot=document.getElementById(currentMode==='practice' ? 'strip-drill' : 'strip-ref');
  if(s && slot && s.parentNode!==slot) slot.appendChild(s);
}

(function initStrip(){
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  Object.keys(SHEET_CHIPS).forEach(k=>wire(SHEET_CHIPS[k], ()=>toggleSheet(k)));
  wire('g-play', stripPlay);
  wire('cof-cadence', playCadence);
  wire('pl-jam', jamToggle);
  // every sheet's ✕: shut it and hand focus back to its chip
  const host=document.getElementById('sheets');
  if(host) host.addEventListener('click', e=>{
    const x=e.target.closest('[data-close]'); if(!x) return;
    const sh=x.closest('.sheet'), k=sh && Object.keys(SHEET_IDS).find(o=>SHEET_IDS[o]===sh.id); if(!k) return;
    setSheetFlag(k, false); applySheets(); saveState();
    const chip=document.getElementById(SHEET_CHIPS[k]); if(chip) chip.focus();
  });
  const fams=document.getElementById('sc-fams');
  if(fams) fams.addEventListener('click', e=>{ const b=e.target.closest('[data-sc]'); if(b) setScale(+b.dataset.sc); });
  wire('sc-fams-toggle', ()=>{ scFamsAdv=!scFamsAdv; buildScFams(); markScrollables(); });
})();
