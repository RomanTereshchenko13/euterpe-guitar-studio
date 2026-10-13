/* ===================== NAVIGATION: help, tabs, the mode axis, seams into and out of Practice ===================== */
/* One ? folds both the view's description and the board hint. A body class drives it
   because the two texts live in different subtrees (.main vs .board-meta). */
let helpOpen = false;
function applyHelpState(){
  document.body.classList.toggle('help-open', helpOpen);
  document.querySelectorAll('.ph-help').forEach(b=>{ b.classList.toggle('on', helpOpen); b.setAttribute('aria-expanded', helpOpen?'true':'false'); });
}
document.querySelectorAll('.ph-help').forEach(btn=>{ btn.addEventListener('click',()=>{ helpOpen=!helpOpen; applyHelpState(); }); });
applyHelpState();

function selectTab(name){
  // Playback persists across tabs on purpose — it is a backing track; the strip's ▶,
  // on both tabs, stops it.
  currentTab = name==='scales' ? 'scales' : 'harmony';
  document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active', x.id==='panel-'+currentTab));
  applyNav();
  applyAsideState();
  applyBoardRegion();
  applyHarmonyExtras();
  renderActiveContext();
  saveState();
}
// The mode axis: Reference vs Practice, orthogonal to selectTab; body classes drive
// the show/hide CSS. Leaving Practice ends the running drill.
//
// Playback does NOT persist across modes: a drill brings its own click, bed and
// scheduler, and a surviving reference loop would play over it with its controls
// hidden. Reference owns the transport, Practice owns the drill.
function setMode(mode){
  currentMode = mode==='practice' ? 'practice' : 'reference';
  document.body.classList.toggle('mode-reference', currentMode==='reference');
  document.body.classList.toggle('mode-practice', currentMode==='practice');
  applyNav();
  placeStrip();   // above the neck, or under the drill header
  if(currentMode==='reference'){
    // leaving Practice ends whatever was running
    exitAllDrills();
    applyAsideState(); applyBoardRegion(); applyHarmonyExtras(); renderActiveContext();
  } else {
    stopReferenceTransport();
    // entering Practice with no drill running: show the home (a drill starter swaps it
    // for its own area right after)
    if(!activeDrill()) showDrillHome();
    renderPractice();
  }
  renderStrip();
  saveState();
}
/* One navigation: two reference subjects and Practice, each a real tabpanel.
   navTo() sets the mode the destination belongs to and, for a reference one, the tab. */
function navTo(panel){
  if(panel==='practice'){ setMode('practice'); }
  else { if(currentMode!=='reference') setMode('reference'); selectTab(panel); }
  applyNav();
}
// painted from the live state, so the nav follows shortcuts and seam jumps too
function applyNav(){
  const cur = currentMode==='practice' ? 'practice' : currentTab;
  document.querySelectorAll('.navbtn').forEach(b=>{
    const on = b.dataset.panel===cur;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on?'true':'false');
    b.tabIndex = on?0:-1;
  });
}
(function initNav(){
  const nav=document.getElementById('mainnav'); if(!nav) return;
  nav.setAttribute('role','tablist');
  document.querySelectorAll('.navbtn').forEach(b=>{
    b.setAttribute('role','tab'); b.id='tab-'+b.dataset.panel;
    b.setAttribute('aria-controls','panel-'+b.dataset.panel);
  });
  document.querySelectorAll('.panel, .practice-panel').forEach(p=>{
    p.setAttribute('role','tabpanel'); p.setAttribute('aria-labelledby','tab-'+p.id.replace('panel-',''));
  });
  nav.addEventListener('keydown',e=>{
    if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft') return;
    const btns=[...document.querySelectorAll('.navbtn')], cur=btns.findIndex(x=>x.classList.contains('active'));
    const nxt=btns[(cur+(e.key==='ArrowRight'?1:btns.length-1))%btns.length];
    navTo(nxt.dataset.panel); nxt.focus(); e.preventDefault();
  });
  nav.addEventListener('click',e=>{
    const b=e.target.closest('.navbtn'); if(!b) return;
    navTo(b.dataset.panel);
  });
  applyNav();
})();
/* ---- "Drill this": a reference view opens the drill about what is on screen ----
   The one curated view → track map:

     chord tones (+ triads) → comp     the chord on screen, changed on time under a band
     scale                  → timing   this scale, walked in one box on the beat
     notes                  → note     find every instance of the note

   Arpeggio has no drill seam: its notes are practised over the band (▶ with the Jam).
   Everything else goes through startTrack(), like every door. */
const SEAM_TRACKS = { chords:'comp', scale:'timing', notes:'note' };
document.addEventListener('click', e=>{
  const b=e.target.closest('[data-seam]'); if(!b) return;
  const track=SEAM_TRACKS[b.dataset.seam]; if(!track) return;
  setMode('practice');
  startTrack(track);
});
/* ---- the way back: a drill summary's "Review on the neck" ----
   Leaving Practice ends the drill; the page starts at the top, where the view's heading
   and neck are. */
function openReference(tab, sub){
  navTo(tab);
  if(tab==='harmony') setHView(sub); else setScView(sub);
  (document.scrollingElement || document.documentElement).scrollTop = 0;
}
/* ---- review routing: the progress card's Review opens the track the queue named;
   the drills already prefer due items. */
function startReview(track){
  setMode('practice');
  startTrack(track);
}
{ const h=document.getElementById('practice-progress');
  if(h) h.addEventListener('click', e=>{ const b=e.target.closest('[data-review]'); if(b) startReview(b.dataset.review); }); }
