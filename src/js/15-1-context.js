/* ===================== CONTEXT: the one key, the views that read it, the view on screen ===================== */
/* ---- shared root picker, display mode, sub-view toggle ---- */
/* Only the view on screen paints, controls and board both. A hidden view is stale until
   it is shown, and every way of showing one — selectTab, setHView, setScView, setMode —
   ends here, so a key, tuning or language change costs one view, not five. The strip's
   sheets follow the same rule (paintSheets). */
function renderActiveContext(){
  if(currentMode!=='reference') return;
  if(currentTab==='harmony'){
    if(hView==='arp'){ buildArpPos(); renderArp(); paintHarmonyLens(); }
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
  chVoicing=0;
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
  paintHarmonyLens(); paintViewDesc();
  applyHarmonyExtras();
  renderActiveContext(); saveState();
}
/* Harmony's one switch: Chord tones · Triads · Arpeggio. Triads is Chord tones with
   chTriads on (both saved as they were), and disabled for a chord with no triad (sus, 11)
   rather than hidden, so the row doesn't jump as you move through the qualities. */
function harmonyLens(){ return hView==='arp' ? 'arp' : triadsOn() ? 'triads' : 'chords'; }
function setHarmonyLens(k){
  if(k==='triads' && chTriadIdx()<0) return;
  if(k!=='arp'){ const on=k==='triads'; if(chTriads!==on){ chTriads=on; chVoicing=0; } }
  setHView(k==='arp' ? 'arp' : 'chords');
  renderPlayBtn();
}
function paintHarmonyLens(){
  const cur=harmonyLens();
  ['chords','triads','arp'].forEach(k=>{ const b=document.getElementById('hv-'+k); if(b){ b.classList.toggle('active', k===cur); b.setAttribute('aria-pressed', k===cur?'true':'false'); } });
  const tb=document.getElementById('hv-triads');
  if(tb){ const has=chTriadIdx()>=0; tb.disabled=!has; tb.title = has ? '' : t('shape_no_triad'); }
}
['chords','triads','arp'].forEach(k=>{ document.getElementById('hv-'+k).onclick=()=>setHarmonyLens(k); });
/* the view's description, under the neck behind the lens's ? */
function paintViewDesc(){
  const el=document.getElementById('view-desc'); if(!el) return;
  el.textContent = t(currentTab==='scales' ? (scView==='notes'?'nt_p':'sc_p') : (hView==='arp'?'arp_p':'ch_p'));
}

/* Scales sub-view: Scale | Notes. Notes reuses the shared board and root. */
function setScView(v){ scView=v;
  document.getElementById('sub-scale').hidden = v!=='scale';
  document.getElementById('sub-notes').hidden = v!=='notes';
  ['scale','notes'].forEach(k=>{ const b=document.getElementById('sv-'+k); b.classList.toggle('active', k===v); b.setAttribute('aria-pressed', k===v?'true':'false'); });
  paintViewDesc();
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
  paintViewDesc();
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
