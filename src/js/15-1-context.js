/* ===================== CONTEXT: the one key, the views that read it, the view on screen ===================== */
/* ---- shared root picker, display mode, sub-view toggle ---- */
/* Only the view on screen paints, controls and board both. A hidden view is stale until
   it is shown, and every way of showing one — selectTab, setHView, setScView, setMode —
   ends here, so a key, tuning or language change costs one view, not five. The strip's
   sheets follow the same rule (paintSheets). */
function renderActiveContext(){
  if(currentMode!=='reference') return;
  if(currentTab==='harmony'){
    if(hView==='arp'){ buildArpPos(); renderArp(); }
    else renderChords();
  }
  else if(currentTab==='scales'){
    if(scView==='notes') renderNotes();
    else { buildScPos(); renderScales(); }
  }
  markScrollables();
}
/* The Practice home, painted from the model in one pass: progress from the learner
   model, the cards and the session queue from the registry. Re-run on a mode switch and
   a language change. */
function renderPractice(){
  renderProgressInto('practice-progress');
  renderSessionCard();
  applySessionViews();
  paintDrillCards();
}
/* Each card says, from the model and never from markup: whether the drill listens (one
   🎤), whether it is due (a dot — overdue items, gone cold, or slipping; not merely
   new), and its last result with the direction of travel. */
function paintDrillCards(){
  const due=new Set((learnerReview().due||[]).filter(d=>d.reason!=='new').map(d=>d.track));
  document.querySelectorAll('#practice-home .drill-card[data-track]').forEach(card=>{
    const tr=trackById(card.dataset.track);
    const tags=card.querySelector('.dc-tags'), last=card.querySelector('.dc-last');
    if(tags) tags.innerHTML = !tr ? '' :
      (trackMic(tr) ? '<span class="dc-mic" title="'+t('badge_mic')+'" role="img" aria-label="'+t('badge_mic')+'">🎤</span>' : '')+
      (due.has(tr.id) ? '<span class="dc-due" title="'+t('prog_due')+'" role="img" aria-label="'+t('prog_due')+'"></span>' : '');
    if(!last) return;
    const tn = tr && tr.sess ? learnerTrend(tr.sess) : null;
    if(!tn || !tn.n){ last.textContent=''; return; }
    last.innerHTML = tn.last===null ? t('prog_unscored')
      : trendScore(tn)+(tn.scored>1 ? ' <span class="pp-dir '+tn.dir+'">'+trendArrow(tn.dir)+'</span>' : '');
  });
}

/* ---- one key ----
   keyRoot/keyLbl (key center) and scIdx (its scale) are what Scales, the circle and Notes
   show, and setKey() is the ONE place they change, so the views never drift. Pass
   `mode` to also move the scale (a circle click); omit it to keep it. A new key brings
   the chord home to its tonic root, quality kept (setChord moves it within the key). A
   running drill that reads the key re-derives from it. */
function setKey(pc, lbl, mode){
  keyRoot=pc; keyLbl=lbl;
  if(Number.isInteger(mode) && SCALES[mode]) scIdx=mode;
  chRoot=pc; chLbl=lbl;
  chVoicing=0; scOverlay=null;
  ntRoot=lbl;                                   // Notes follows the shared root
  renderActiveContext(); renderStrip(); drillKeyChanged();
  saveState();
}
buildRootBtns(document.getElementById('g-roots'), keyRoot, (pc,r)=>{ setKey(pc,r); });

/* Names | Intervals, on the board's lens */
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
  renderActiveContext(); saveState();
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
  applyBoardRegion();   // the Names/Intervals switch does nothing in Notes
  renderActiveContext(); saveState();
}
document.getElementById('sv-scale').onclick=()=>setScView('scale');
document.getElementById('sv-notes').onclick=()=>setScView('notes');

/* Both reference subjects show the neck; the lens shows the active subject's view
   switch, and Names/Intervals wherever the dots have labels to switch (not Notes). */
function applyBoardRegion(){
  const vh=document.getElementById('ctx-view-harmony'); if(vh) vh.hidden = currentTab!=='harmony';
  const vs=document.getElementById('ctx-view-scales');  if(vs) vs.hidden = currentTab!=='scales';
  const cd=document.getElementById('ctx-display');      if(cd) cd.hidden = currentTab==='scales' && scView==='notes';
  // ...and the heading above the strip names the same subject
  document.getElementById('vh-harmony').hidden = currentTab!=='harmony';
  document.getElementById('vh-scales').hidden  = currentTab!=='scales';
}
/* the voicing cards belong only to Harmony's chord-tones view. With triads on, the
   triad cards in the panel stand in for the chord shapes. */
function applyHarmonyExtras(){
  const on = currentTab==='harmony' && hView==='chords';
  const sc=document.getElementById('shapes-card'); if(sc) sc.hidden = !on || triadsOn();
  applyShapesPanel();
}
/* the key sheet's cadence: the key's own I–IV–V–I, at a fixed pace independent of the tempo */
function playCadence(){
  const b=48+keyRoot, bt=0.5;
  keyCadence().forEach((c,i)=>{ const base=b+c.off; c.iv.forEach((x,j)=>pluck(base+x, i*bt + j*0.018, Math.max(0.9, bt*1.4))); });
}
