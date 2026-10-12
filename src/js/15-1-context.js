/* ===================== CONTEXT: the one key, the views that read it, the view on screen ===================== */
/* ---- shared root picker, display mode, sub-view toggle, global play ---- */
/* Only the view on screen paints, controls and board both. A hidden view is stale until
   it is shown, and every way of showing one — selectTab, setHView, setScView, setMode —
   ends here, so a key, tuning or language change costs one view, not five. */
function renderActiveContext(){
  if(currentMode!=='reference') return;
  if(currentTab==='harmony'){
    if(hView==='arp'){ buildArpQuals(); buildArpPos(); renderArp(); }
    else { buildChQuals(); renderChords(); }
  }
  else if(currentTab==='scales'){
    if(scView==='notes') renderNotes();
    else { buildScSelect(); buildScPos(); renderScales(); }
  }
  else if(currentTab==='circle') renderCircle();
  markScrollables();
}
/* The Practice home, painted from the model in one pass: progress from the learner
   model, badges and the session queue from the registry. Re-run on a mode switch and
   a language change. */
function renderPractice(){
  renderProgressInto('practice-progress');
  renderSessionCard();
  applySessionViews();
  paintDrillBadges();
}
/* The practice cards' tier badge comes from the registry (trackBadge), never from
   markup, so a card can't claim a tier its drill doesn't have. */
function paintDrillBadges(){
  document.querySelectorAll('#practice-home .drill-card[data-track]').forEach(card=>{
    const slot=card.querySelector('.dc-badge'); if(!slot) return;
    const tr=trackById(card.dataset.track);
    if(!tr){ slot.textContent=''; return; }
    const key=trackBadge(tr);
    slot.textContent=t(key);
    // spelled out, not assembled: a runtime-built class is invisible to the lint's dead-CSS check
    slot.className='dc-badge '+(key==='badge_mic'?'b-mic':key==='badge_acc'?'b-acc':'b-coach');
  });
}

/* ---- one musical context ----
   gRoot/gRootLbl (key center) and scIdx (mode = selected scale) are shared by Harmony,
   Scales, Circle and Notes, and setKey() is the ONE place they change, so the views
   never drift. Pass `mode` to also move the scale (a circle click); omit it to keep it. */
function setKey(pc, lbl, mode){
  gRoot=pc; gRootLbl=lbl;
  if(Number.isInteger(mode) && SCALES[mode]) scIdx=mode;
  chVoicing=0; scOverlay=null;
  ntRoot=lbl;                                   // Notes follows the shared root
  activateRoot(document.getElementById('g-roots'), gRoot);
  // the drill header's key picker tracks the same root
  { const dk=document.getElementById('drill-ctx-key'); if(dk) activateRoot(dk, gRoot); }
  renderActiveContext();
  saveState();
}
buildRootBtns(document.getElementById('g-roots'), gRoot, (pc,r)=>{ setKey(pc,r); });

function setGMode(m){ gMode=m;
  const on=document.getElementById(m==='names'?'g-names':'g-deg'), off=document.getElementById(m==='names'?'g-deg':'g-names');
  on.classList.add('active'); on.setAttribute('aria-pressed','true'); off.classList.remove('active'); off.setAttribute('aria-pressed','false');
  renderActiveContext(); saveState();
}
document.getElementById('g-names').onclick=()=>setGMode('names');
document.getElementById('g-deg').onclick=()=>setGMode('deg');

let hView='chords';
function setHView(v){ hView = v==='arp' ? 'arp' : 'chords'; v=hView;
  document.getElementById('sub-chords').hidden = v!=='chords';
  document.getElementById('sub-arp').hidden = v!=='arp';
  ['chords','arp'].forEach(k=>{ const b=document.getElementById('hv-'+k); if(b){ b.classList.toggle('active', k===v); b.setAttribute('aria-pressed', k===v?'true':'false'); } });
  const head = v==='arp'?'arp':'ch';
  document.getElementById('harmony-h').textContent = t(head+'_h');
  document.getElementById('harmony-p').textContent = t(head+'_p');
  applyHarmonyExtras();
  renderActiveContext(); updateGlobalPlay(); saveState();
}
document.getElementById('hv-chords').onclick=()=>setHView('chords');
document.getElementById('hv-arp').onclick=()=>setHView('arp');

/* Scales sub-view: Scale | Notes. Notes reuses the shared board and root. */
function setScView(v){ scView=v;
  document.getElementById('sub-scale').hidden = v!=='scale';
  document.getElementById('sub-notes').hidden = v!=='notes';
  ['scale','notes'].forEach(k=>{ const b=document.getElementById('sv-'+k); b.classList.toggle('active', k===v); b.setAttribute('aria-pressed', k===v?'true':'false'); });
  document.getElementById('scales-h').textContent = t(v==='notes'?'nt_h':'sc_h');
  document.getElementById('scales-p').textContent = t(v==='notes'?'nt_p':'sc_p');
  applyContextBar();   // the Names/Intervals switch does nothing in Notes
  renderActiveContext(); updateGlobalPlay(); saveState();
}
document.getElementById('sv-scale').onclick=()=>setScView('scale');
document.getElementById('sv-notes').onclick=()=>setScView('notes');

function applyContextBar(){
  // The bar shows wherever one of its groups has a job (the root picker matters on
  // Circle too); it stands down only when all of them have.
  const key = currentTab==='harmony' || currentTab==='scales' || currentTab==='circle';
  document.getElementById('context-bar').hidden = !key;
  // Names/Intervals does nothing in Notes (always names) or on Circle (no dots)
  const cd=document.querySelector('.ctx-display');
  if(cd) cd.hidden = currentTab==='circle' || (currentTab==='scales' && scView==='notes');
}
function applyBoardRegion(){
  const show = (currentTab==='harmony' || currentTab==='scales');
  document.getElementById('board-region').hidden = !show;
  const bm=document.getElementById('board-meta'); if(bm) bm.hidden = !show;   // legend + hint follow the board
  // the view switch is a lens on the board: only the active subject's group shows
  const vh=document.getElementById('ctx-view-harmony'); if(vh) vh.hidden = currentTab!=='harmony';
  const vs=document.getElementById('ctx-view-scales');  if(vs) vs.hidden = currentTab!=='scales';
  // ...and the heading above it names the same subject (Circle keeps its own in its panel)
  document.getElementById('view-head').hidden = !show;
  document.getElementById('vh-harmony').hidden = currentTab!=='harmony';
  document.getElementById('vh-scales').hidden  = currentTab!=='scales';
}
/* voicing cards + sequencer belong only to Harmony's chord-tones view. With triads
   on, the triad cards in the panel stand in for the chord shapes. */
function applyHarmonyExtras(){
  const on = currentTab==='harmony' && hView==='chords';
  const el=document.getElementById('harmony-extras'); if(el) el.hidden = !on;
  const sc=document.getElementById('shapes-card'); if(sc) sc.hidden = !on || triadsOn();
  applyShapesPanel();
}
function globalPlay(){
  const boardEl=document.getElementById('board');
  if(currentTab==='harmony'){
    if(isBoardMode('triads')){ const v=currentTriadVoicing(); animArpMidi(boardEl, v.midis); }
    else if(hView==='arp'){ const q=QUALITIES[chQual]; animRun(boardEl, 48+gRoot, q.iv.concat([12])); }   // run the arpeggio melodically up the neck
    else { const v=currentChordVoicing(); animArpMidi(boardEl, v.midis); }
  } else if(currentTab==='scales' && scView==='scale'){ const s=SCALES[scIdx]; animRun(boardEl, 48+gRoot, s.iv.concat([12])); }
  else if(currentTab==='circle'){
    const cofMinor=ctxCofMinor(), pc=gRoot, b=48+pc, iv=cofMinor?[0,3,7]:[0,4,7], bt=0.5;  // fixed cadence pace, independent of the tempo
    [0,5,7,12].forEach((off,i)=>{ const base=b+off; iv.forEach((x,j)=>pluck(base+x, i*bt + j*0.018, Math.max(0.9, bt*1.4))); });
  }
}
function updateGlobalPlay(){
  const b=document.getElementById('g-play');
  if(b){
    // nothing to "listen" to in the notes view
    b.hidden = currentTab==='scales' && scView==='notes';
    const cadence = currentTab==='circle';
    b.innerHTML='&#9654; '+t(cadence?'b_cadence':'b_listen');
    const tip=t(cadence?'b_cadence':'b_listen_tip');
    b.setAttribute('aria-label', tip); b.title=tip;
  }
  const lp=document.getElementById('g-loop');
  if(lp){
    // Loops the selected voicing (or the shown triad) as a backing; it persists
    // across tabs, and the transport chip is the Stop.
    lp.hidden = !(currentTab==='harmony' && hView==='chords');
    lp.classList.toggle('active', !!loopClock);
    lp.setAttribute('aria-pressed', loopClock?'true':'false');
    lp.innerHTML=(loopClock?'&#9632; ':'&#8635; ')+t('b_loop');
    const ltip=t(loopClock?'b_loop_stop_tip':'b_loop_tip');
    lp.setAttribute('aria-label', ltip); lp.title=ltip;
  }
}
document.getElementById('g-play').onclick=globalPlay;
document.getElementById('g-loop').onclick=loopToggle;
