/* ===================== WIRING ===================== */
/* ---- shared root picker, display mode, sub-view toggle, global play ---- */
/* Each render fn paints its panel, and the ONE shared board only when its view is
   active (isBoardMode), so a cross-view pass paints the board once. */
function renderContextViews(){ renderChords(); renderArp(); renderScales(); renderNotes(); markScrollables(); }
function renderActiveContext(){
  if(currentTab==='harmony'){ (hView==='arp'?renderArp:renderChords)(); }
  else if(currentTab==='scales'){ scView==='notes'?renderNotes():renderScales(); }
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
  buildChQuals(); buildArpQuals(); buildArpPos(); buildScSelect(); buildScPos();
  renderContextViews(); renderCircle(); renderNotes();
  saveState();
}
buildRootBtns(document.getElementById('g-roots'), gRoot, (pc,r)=>{ setKey(pc,r); });

function setGMode(m){ gMode=m;
  const on=document.getElementById(m==='names'?'g-names':'g-deg'), off=document.getElementById(m==='names'?'g-deg':'g-names');
  on.classList.add('active'); on.setAttribute('aria-pressed','true'); off.classList.remove('active'); off.setAttribute('aria-pressed','false');
  renderContextViews(); saveState();
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
  (v==='arp'?renderArp:renderChords)();
  markScrollables(); updateGlobalPlay(); saveState();
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
  v==='notes'?renderNotes():renderScales();
  markScrollables(); updateGlobalPlay(); saveState();
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

setLoopLabel();

buildSeqPresets();
document.getElementById('seq-add').onclick=seqAddCurrent;
document.getElementById('seq-clear').onclick=seqClear;
document.getElementById('seq-play').onclick=seqPlay;
document.getElementById('seq-loopbtn').onclick=seqLoopToggle;
document.getElementById('seq-presets').addEventListener('click',e=>{ const b=e.target.closest('[data-p]'); if(b) applyPreset(SEQ_PRESETS[+b.dataset.p]); });
document.getElementById('seq-strip').addEventListener('click',e=>{
  const x=e.target.closest('[data-x]'); if(x){ seq.splice(+x.dataset.x,1); seqStepIdx=-1; if(!seq.length) seqStop(); renderSeq(); if(seqClock) seqRebuild(); saveState(); return; }
  const bb=e.target.closest('[data-bars]'); if(bb){ const i=+bb.dataset.bars, cur=seq[i].bars; seq[i].bars = cur>=4?1:(cur===1?2:4); renderSeq(); if(seqClock) seqRebuild(); saveState(); return; }
  const chip=e.target.closest('.seq-chip'); if(chip){ const st=seq[+chip.dataset.i]; if(st) setChord(st.pc, st.lbl, st.qi); }
});
renderSeq(); setSeqTransport();
// the shared board: a dot click sounds that string, Enter/Space plays the focused one
wirePlay(document.getElementById('board'));
/* the suggester's scale chips jump to that scale, on the chord's root, in Scales */
document.getElementById('suggest-body').addEventListener('click', e=>{
  const b=e.target.closest('[data-scale]'); if(!b) return;
  const ch=currentHarmonyChord(); if(!ch) return;
  setKey(ch.rootPc, ROOTS[ch.rootPc], +b.dataset.scale);
  setScView('scale'); selectTab('scales');
});
/* chord cards: a dot click sounds that string; clicking elsewhere on a card selects
   that voicing (so Listen/Loop use it). Keyboard note-play stays on the fretboard. */
document.getElementById('ch-diagram').addEventListener('click',e=>{
  const dot=e.target.closest('.cd-dot');
  if(dot && dot.dataset.midi!=null){ e.stopPropagation(); pluck(parseInt(dot.dataset.midi)); return; }
  const card=e.target.closest('.chordbox'); if(!card || card.dataset.v==null) return;
  chVoicing=+card.dataset.v; renderChordDiagram(); saveState();
});

document.getElementById('cd-more').addEventListener('click',()=>{
  chShapesExpanded=!chShapesExpanded; renderChordDiagram();
});

/* triad cards: a dot click sounds that string (set/inversion buttons select) */
document.getElementById('tr-diagram').addEventListener('click',e=>{
  const dot=e.target.closest('.cd-dot');
  if(dot && dot.dataset.midi!=null){ pluck(parseInt(dot.dataset.midi)); }
});

document.getElementById('sc-select').onchange=function(){ scIdx=parseInt(this.value); scOverlay=null; renderScales(); renderCircle(); saveState(); };
document.getElementById('sc-diatonic').addEventListener('click',e=>{
  if(e.target.closest('[data-clear]')){ scOverlay=null; renderScales(); saveState(); return; }
  const b=e.target.closest('.dia'); if(!b) return; const c=diaList[+b.dataset.i];
  scOverlay = (scOverlay && scOverlay.tag===c.tag) ? null : {rootPc:c.rootPc, iv:c.iv, tag:c.tag};
  renderScales(); saveState();
});
/* Scales → Harmony: open the overlaid diatonic chord in Chord tones, so "the V chord
   of this key" leads straight to its voicings. */
document.getElementById('sc-info').addEventListener('click', e=>{
  if(!e.target.closest('.sc-open-harmony') || !scOverlay) return;
  const pc=scOverlay.rootPc;
  setChord(pc, ROOTS[pc], triadQi(scOverlay.iv));
  setHView('chords'); selectTab('harmony');
});

/* a circle node picks the key: major → Ionian, minor → Aeolian */
function selectCircleNode(g){
  const i=+g.dataset.i, minor=(g.dataset.type==='min'), pc=minor?COF[i].minPc:COF[i].majPc;
  setKey(pc, pcToRootLabel(pc), minor?5:0);
}
document.getElementById('cof-svg').addEventListener('click',e=>{
  const g=e.target.closest('.cof-node'); if(g) selectCircleNode(g);
});
document.getElementById('cof-svg').addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ') return;
  const g=e.target.closest('.cof-node'); if(g){ selectCircleNode(g); e.preventDefault(); }
});
document.getElementById('cof-open').onclick=function(){ selectTab('scales'); };
/* Circle → Harmony: open the key's tonic chord (major or minor, from the ring) */
{ const ch=document.getElementById('cof-harmony'); if(ch) ch.onclick=function(){ setChord(gRoot, gRootLbl, ctxCofMinor()?1:0); setHView('chords'); selectTab('harmony'); }; }

/* Notes: one "Naturals only" toggle; the highlighted note follows the shared root. */
function applyNtFilter(){ const b=document.getElementById('nt-nat'); if(b){ const on=ntFilter==='nat'; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on?'true':'false'); } }
document.getElementById('nt-nat').onclick=function(){ ntFilter = ntFilter==='nat'?'all':'nat'; applyNtFilter(); renderNotes(); saveState(); };
applyNtFilter();

document.getElementById('aside-toggle').onclick=function(){ const b=document.getElementById('aside-body'); const hidden=b.style.display==='none'; b.style.display=hidden?'block':'none'; this.textContent=hidden?'−':'+'; this.setAttribute('aria-expanded', hidden); };
const _shapesTg=document.getElementById('shapes-toggle');
if(_shapesTg) _shapesTg.onclick=function(){ shapesOpen=!shapesOpen; applyShapesPanel(); saveState(); };

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
  // Playback persists across tabs on purpose — it is a backing track; the transport
  // chip stops it from anywhere.
  currentTab=name;
  document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active', x.id==='panel-'+name));
  applyNav();
  applyAsideState();
  applyContextBar();
  applyBoardRegion();
  applyHarmonyExtras();
  updateGlobalPlay();
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
  if(currentMode==='reference'){
    // leaving Practice ends whatever was running
    exitAllDrills();
    applyAsideState(); applyContextBar(); applyBoardRegion(); applyHarmonyExtras(); renderActiveContext();
  } else {
    stopReferenceTransport();
    // entering Practice with no drill running: show the home (a drill starter swaps it
    // for its own area right after)
    if(!activeDrill()) showDrillHome();
    renderPractice();
  }
  updateGlobalPlay();
  saveState();
}
/* One navigation: three reference subjects and Practice, each a real tabpanel.
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
     circle                 → changes  the keys' chords, switched cleanly

   Arpeggio has no drill seam: its notes are practised over the band, so its button is
   a Jam toggle (below). Everything else goes through startTrack(), like every door. */
const SEAM_TRACKS = { chords:'comp', scale:'timing', notes:'note', circle:'changes' };
document.addEventListener('click', e=>{
  const b=e.target.closest('[data-seam]'); if(!b) return;
  const track=SEAM_TRACKS[b.dataset.seam]; if(!track) return;
  setMode('practice');
  startTrack(track);
});
/* ---- "Jam over this": bass + drums + loop in one tap, and the same tap stops it ----
   Plays the progression when the player has built one, the current chord otherwise.
   Every button carrying data-jam is this toggle (the aside's and Arpeggio's). */
function jamActive(){ return !!(typeof seqClock!=='undefined' && seqClock) || !!(typeof loopClock!=='undefined' && loopClock); }
function renderJamBtn(){
  const on=jamActive();
  document.querySelectorAll('[data-jam]').forEach(b=>{
    b.textContent=t(on?'seam_jam_stop':'seam_jam');
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on?'true':'false');
  });
}
function jamToggle(){
  if(jamActive()){ if(seqClock) seqStop(); else stopLoop(); renderJamBtn(); return; }
  audio();
  if(!bassOn) bassToggle();
  if(!grooveOn) drumsToggle();
  /* Enabling the band may already have started the single-chord loop
     (ensureBacking), so start the loop only if nothing is sounding yet —
     loopToggle() would otherwise turn it straight back off. */
  if(seq.length){ if(!seqClock) seqPlay(); }
  else if(!loopClock) loopToggle();
  renderJamBtn();
}
document.querySelectorAll('[data-jam]').forEach(b=>{ b.onclick=jamToggle; });
document.getElementById('lang-switch').addEventListener('click',e=>{
  const b=e.target.closest('.langbtn'); if(!b||b.dataset.lang===lang) return;
  lang=b.dataset.lang; applyLang(); saveState();
});

/* ---- toolbar wiring ---- */
document.getElementById('tb-tuning').onchange=function(){
  const prevMidi=OPEN_MIDI.slice();
  tuningIdx=+this.value;
  if(TUNINGS[tuningIdx].custom) customTuning=prevMidi;   // seed Custom from the tuning you were on
  applyTuning(); buildTuner(); buildCustomTuning(); applyCustomTuningVis(); renderAllBoards(); saveState();
};
/* custom tuning: one select per string; re-apply so board, tuner and labels follow */
{ const cs=document.getElementById('tb-custom-strings');
  if(cs) cs.addEventListener('change', e=>{ const s=e.target.closest('.custom-str'); if(!s) return;
    customTuning[+s.dataset.i]=+s.value; applyTuning(); buildTuner(); renderAllBoards(); saveState(); }); }
/* master volume scales everything (masterOut, before the limiter). Before the first
   sound the bus doesn't exist, so masterVol is stashed for setupBus; a live change
   ramps, so dragging is click-free. */
{ const v=document.getElementById('tb-vol');
  if(v){ v.oninput=function(){ masterVol=(+this.value)/100;
      const vv=document.getElementById('tb-vol-val'); if(vv) vv.textContent=(+this.value)+'%';
      if(masterOut && actx) masterOut.gain.setTargetAtTime(masterVol, actx.currentTime, 0.01);
    };
    v.onchange=function(){ saveState(); }; } }
document.getElementById('tb-frets').onchange=function(){ fretRangeIdx=+this.value; renderAllBoards(); saveState(); };
{ const cp=document.getElementById('tb-capo'); if(cp) cp.onchange=function(){ capo=+this.value; renderAllBoards(); saveState(); }; }
/* a meter change alters bar length and beat grid, so re-paint the running drill */
{ const mt=document.getElementById('tb-meter'); if(mt) mt.onchange=function(){ setMeter(+this.value); refreshDrillsLang(); saveState(); }; }
/* accessibility: a colour-blind-safe palette and per-function dot shapes, both pure
   body-class switches, both persisted */
function applyA11y(){
  if(typeof document==='undefined' || !document.body) return;
  document.body.classList.toggle('cb-palette', cbPalette);
  document.body.classList.toggle('fn-shapes', fnShapes);
  const p=document.getElementById('tb-cbpalette'); if(p){ p.classList.toggle('active', cbPalette); p.setAttribute('aria-pressed', cbPalette?'true':'false'); }
  const s=document.getElementById('tb-shapes');    if(s){ s.classList.toggle('active', fnShapes);  s.setAttribute('aria-pressed', fnShapes?'true':'false'); }
}
{ const p=document.getElementById('tb-cbpalette'); if(p) p.onclick=function(){ cbPalette=!cbPalette; applyA11y(); saveState(); };
  const s=document.getElementById('tb-shapes');    if(s) s.onclick=function(){ fnShapes=!fnShapes;  applyA11y(); saveState(); }; }

/* ---- review routing: the progress card's Review opens the track the queue named;
   the drills already prefer due items. */
function startReview(track){
  setMode('practice');
  startTrack(track);
}
{ const h=document.getElementById('practice-progress');
  if(h) h.addEventListener('click', e=>{ const b=e.target.closest('[data-review]'); if(b) startReview(b.dataset.review); }); }
document.getElementById('tb-lefty').onclick=function(){ lefty=!lefty; this.classList.toggle('active',lefty); this.setAttribute('aria-pressed',lefty); renderAllBoards(); renderCircle(); saveState(); };
/* the clocks read beat() live, so the tempo glides without restarting */
document.getElementById('tb-tempo').oninput=function(){ setTempo(+this.value); };
document.getElementById('tb-tempo').onchange=function(){ saveState(); };
/* the same tempo, stepped from the drill header; both controls use the one setter */
{ const step=d=>{ setTempo(tempo+d); saveState(); };
  const sl=document.getElementById('drill-ctx-slower'); if(sl) sl.onclick=()=>step(-5);
  const fa=document.getElementById('drill-ctx-faster'); if(fa) fa.onclick=()=>step(5); }
document.getElementById('tb-metro').onclick=metroToggle;
document.getElementById('tb-bass').onclick=bassToggle;
document.getElementById('tb-drums').onclick=drumsToggle;
document.getElementById('tb-stop').onclick=function(){ if(seqClock) seqStop(); else stopLoop(); };
document.getElementById('tb-toggle').onclick=function(){ toolbarOpen=!toolbarOpen; applyToolbarState(); saveState(); };
document.getElementById('backing-toggle').onclick=function(){ backingOpen=!backingOpen; applyBackingPanel(); saveState(); };
/* "more" on either quality picker flips the shared chQualsAdv, so both stay in step */
function qualMoreToggle(){ chQualsAdv=!chQualsAdv; buildChQuals(); buildArpQuals(); markScrollables(); }
{ const a=document.getElementById('ch-quals-toggle'); if(a) a.onclick=qualMoreToggle;
  const b=document.getElementById('arp-quals-toggle'); if(b) b.onclick=qualMoreToggle; }

/* ---- changelog modal ---- */
function renderChangelog(){
  const body=document.getElementById('cl-body'); if(!body) return;
  body.innerHTML = CHANGELOG.map(r=>{
    const cur = r.v===APP_VERSION;
    const bullets=(r[lang]||r.en).map(li=>`<li>${li}</li>`).join('');
    return `<div class="cl-rel${cur?' current':''}"><div class="cl-rel-head">`+
      `<span class="cl-ver">v${r.v}</span>`+
      (cur?`<span class="cl-badge">${t('cl_current')}</span>`:'')+
      `<span class="cl-date">${r.date}</span></div><ul>${bullets}</ul></div>`;
  }).join('') +
    // only the newest few releases ship in the bundle; CHANGELOG.md has the rest
    `<p class="cl-older"><a href="https://github.com/RomanTereshchenko13/euterpe-guitar-studio/blob/main/CHANGELOG.md" target="_blank" rel="noopener">${t('cl_older')}</a></p>`;
}
function openChangelog(){ const o=document.getElementById('cl-overlay'); renderChangelog(); o.hidden=false; o.classList.add('open'); }
function closeChangelog(){ const o=document.getElementById('cl-overlay'); o.classList.remove('open'); o.hidden=true; }
document.getElementById('app-ver').onclick=openChangelog;
document.getElementById('cl-close').onclick=closeChangelog;
document.getElementById('cl-overlay').addEventListener('click',e=>{ if(e.target.id==='cl-overlay') closeChangelog(); });

/* ---- keyboard-shortcuts cheat-sheet ---- */
function openKbd(){ const o=document.getElementById('kbd-overlay'); if(!o) return; o.hidden=false; o.classList.add('open'); }
function closeKbd(){ const o=document.getElementById('kbd-overlay'); if(!o) return; o.classList.remove('open'); o.hidden=true; }
{ const c=document.getElementById('kbd-close'); if(c) c.onclick=closeKbd;
  const ov=document.getElementById('kbd-overlay'); if(ov) ov.addEventListener('click',e=>{ if(e.target.id==='kbd-overlay') closeKbd(); });
  const ob=document.getElementById('kbd-open'); if(ob) ob.onclick=openKbd; }
/* ---- first-run welcome ----
   A one-time card for new visitors; dismissing it records welcomeSeen. dismissWelcome
   is a no-op when the card isn't open, so the shared Escape handler can call it. */
function showWelcome(){ const o=document.getElementById('welcome-overlay'); if(!o) return; o.hidden=false; o.classList.add('open');
  const f=document.getElementById('wc-go-look'); if(f) try{ f.focus(); }catch(_){} }
function dismissWelcome(){ const o=document.getElementById('welcome-overlay'); if(!o||o.hidden) return; o.classList.remove('open'); o.hidden=true; welcomeSeen=true; saveState(); }
{ const g=document.getElementById('wc-got');   if(g) g.onclick=dismissWelcome;
  const c=document.getElementById('wc-close'); if(c) c.onclick=dismissWelcome;
  /* Each answer routes somewhere. Dismiss first, so the destination isn't rendered
     behind the modal. */
  const route=(id,go)=>{ const b=document.getElementById(id); if(b) b.onclick=()=>{ dismissWelcome(); go(); }; };
  route('wc-go-look',     ()=>navTo('harmony'));
  route('wc-go-practice', ()=>navTo('practice'));
  route('wc-go-tune',     micOpen);
  const o=document.getElementById('welcome-overlay'); if(o) o.addEventListener('click',e=>{ if(e.target.id==='welcome-overlay') dismissWelcome(); }); }

document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeChangelog(); closeKbd(); dismissWelcome(); } });

/* ---- keyboard shortcuts ----
   Space=Listen/Stop · L=Loop · M=Metronome · 1–4=nav · A–G=key · [ ]=transpose · ?=help.
   Ignored while typing, while a modal is open, or with Ctrl/Meta/Alt (browser shortcuts
   survive). Space is taken only when focus is NOT on a control, so a focused dot or
   button keeps its native Space. */
const NOTE_KEY = { a:9, b:11, c:0, d:2, e:4, f:5, g:7 };
function transposeKey(delta){ const pc=mod(gRoot+delta,12); setKey(pc, ROOTS[pc]); }
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  const tg=e.target;
  if(tg && (tg.tagName==='INPUT'||tg.tagName==='SELECT'||tg.tagName==='TEXTAREA'||tg.isContentEditable)) return;
  // a modal is open — the tuner counts too, or "a" would retune the key mid-tuning
  if(!document.getElementById('cl-overlay').hidden || !document.getElementById('kbd-overlay').hidden) return;
  { const mo=document.getElementById('mic-overlay'); if(mo && !mo.hidden) return; }
  const k=e.key;
  // Space / L / M drive the REFERENCE transport, which Practice hides; from a drill
  // they would start a metronome nobody can see or stop.
  const refTransport = currentMode!=='practice';
  if(k===' '||k==='Spacebar'){
    if(tg && tg.closest && tg.closest('button,a,[role="button"],[tabindex]')) return;   // let the focused control keep Space
    if(!refTransport) return;
    e.preventDefault();
    if(typeof seqClock!=='undefined' && seqClock) seqStop();
    else if(typeof loopClock!=='undefined' && loopClock) stopLoop();
    else globalPlay();
    return;
  }
  if(k==='?'){ e.preventDefault(); openKbd(); return; }
  // the number keys are the nav, in nav order
  if(k==='1'){ navTo('harmony'); return; }
  if(k==='2'){ navTo('scales'); return; }
  if(k==='3'){ navTo('circle'); return; }
  if(k==='4'){ navTo('practice'); return; }
  if(k==='['){ transposeKey(-1); return; }
  if(k===']'){ transposeKey(1); return; }
  const lk = k.length===1 ? k.toLowerCase() : '';
  if(lk==='l'){ const lp=document.getElementById('g-loop'); if(refTransport && lp && !lp.hidden && !lp.disabled) loopToggle(); return; }
  if(lk==='m'){ const mb=document.getElementById('tb-metro'); if(refTransport && mb && !mb.disabled) metroToggle(); return; }
  if(lk && NOTE_KEY[lk]!==undefined){ const pc=NOTE_KEY[lk]; setKey(pc, ROOTS[pc]); return; }
});

/* ---- no Web Audio: disable the transport controls with a hint, not dead buttons ---- */
function applyAudioAvailability(){
  if(typeof window==='undefined') return true;
  const ok = !!(window.AudioContext || window.webkitAudioContext);
  if(ok){ const w=document.getElementById('audio-warn'); if(w) w.remove(); return true; }
  ['g-play','g-loop','tb-metro','tb-bass','tb-drums','seq-play','seq-loopbtn'].forEach(id=>{
    const el=document.getElementById(id); if(el){ el.disabled=true; el.setAttribute('aria-disabled','true'); el.title=t('audio_off'); }
  });
  const bar=document.querySelector('.tb-bar');
  if(bar && !document.getElementById('audio-warn')){
    const w=document.createElement('span'); w.id='audio-warn'; w.className='audio-warn'; w.textContent=t('audio_off'); bar.appendChild(w);
  }
  devWarn('Web Audio unavailable; playback controls disabled');
  return false;
}

/* ---- init: restore saved state, apply tuning, render, restore tab ---- */
const hadState = loadState();
if(!hadState){
  // First visit: Ukrainian if the browser asks for it, English otherwise; the EN/UK
  // toggle takes over from the next visit on.
  try{ const nav=(navigator.languages&&navigator.languages[0])||navigator.language||''; lang = /^uk\b/i.test(nav) ? 'uk' : 'en'; }catch(_){ /* keep the 'uk' default */ }
  if(typeof window!=='undefined' && window.innerWidth<=600) fretRangeIdx=1;  // phones default to a 5-fret window
}
ntRoot=gRootLbl;   // Notes follows the shared root from the first paint
applyTuning();
applyLang();
selectTab(currentTab);
setMode(currentMode);   // apply the restored mode axis after the reference shell is up
markScrollables();
// re-measure swipe-group overflow on resize and once the webfont has loaded (button
// widths change on the font swap)
window.addEventListener('resize', markScrollables);
try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(markScrollables); }catch(_){}
applyAudioAvailability();
applyA11y();   // apply restored accessibility prefs (palette / shapes) on load
/* the drill header's one key picker: every drill sets the same root, and the running
   drill only says what to re-derive (onKey) */
{ const dk=document.getElementById('drill-ctx-key');
  if(dk) buildRootBtns(dk, gRoot, (pc,r)=>{ setKey(pc,r); drillKeyChanged(); });
  const dq=document.getElementById('drill-ctx-quit');
  if(dq) dq.onclick=quitDrill; }
/* Every drill starts inside #practice-home — a card or the progress card's Review —
   through one listener: each carries data-track, and startTrack() opens it. */
{ const ph=document.getElementById('practice-home');
  if(ph) ph.addEventListener('click', e=>{
    const card=e.target.closest('[data-track]');
    if(card) startTrack(card.dataset.track);
    applyDrillCtx();
  }); }
/* the drill header's own controls. The mic goes to the running drill: each scored
   drill has its own tier semantics. */
{ const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('drill-ctx-setup', drillSetupToggle);
  wire('drill-ctx-help',  drillHintToggle);
  wire('drill-ctx-mic',   drillMicToggle);
  // end the block early, keep the session
  wire('drill-ctx-skip',  ()=>sessionAdvance()); }
/* the session's length chips and the report's Done are painted by the session
   module, so both are delegated */
{ const m=document.getElementById('sess-mins');
  if(m) m.addEventListener('click', e=>{
    const b=e.target.closest('[data-mins]'); if(!b) return;
    sessMins=+b.dataset.mins; renderSessionCard(); saveState();
  });
  const s=document.getElementById('sess-start'); if(s) s.onclick=()=>sessionStart(sessMins);
  const r=document.getElementById('session-report');
  if(r) r.addEventListener('click', e=>{ if(e.target.closest('#sess-close')) sessionDismiss(); }); }
clearOldShareHash();
document.getElementById('app-ver').textContent = 'v' + APP_VERSION;
// only a genuinely first visit leaves welcomeSeen false (see loadState)
if(!welcomeSeen) showWelcome();

/* ---- test introspection hook ----
   Built ONLY when a harness sets window.__GS_ALLOW_TEST__ before load, so production
   carries none of it. Never set this flag in the shipped app. */
if (typeof window!=='undefined' && window.__GS_ALLOW_TEST__) {
  window.__GS_TEST__ = {
    APP_VERSION, I18N, QUALITIES, TRIADS, SCALES, COF, FRET_RANGES, SEQ_PRESETS,
    fifthInterval, spellNote, rootParts, simpleName,
    diatonicTriads, isMajorFamily, ctxCofSel, ctxCofMinor, setKey, noteTxt,
    scalesOverChord, triadQi, currentHarmonyChord,
    chordVoicings, voicingMidi, currentChordVoicing, currentTriadVoicing, STD_LOW6_MIDI, TRI_TO_QUAL,
    cellW, boardWidth, leftFixed, FRET_LO, FRET_HI,
    schedAdvance, clocks, beat,
    // custom tuning
    TUNINGS, applyTuning, tuningMidi, TUNE_LO, TUNE_HI,
    getOpenMidi:()=>OPEN_MIDI.slice(), getCustomTuning:()=>customTuning.slice(),
    setCustomTuning:(arr)=>{ customTuning=arr.slice(); }, setTuningIdx:(i)=>{ tuningIdx=i; applyTuning(); },
    // learner review + activity
    learnerReview, learnerActivity, startReview,
    clearOldShareHash,
    // drill registry
    DRILLS, activeDrill, showDrillHome, exitAllDrills, refreshDrillsLang, drillKeyChanged, applyDrillCtx,
    // one drill shell
    drillSetupToggle, drillHintToggle, drillMicToggle, drillRunStarted, setCurTrack, quitDrill,
    getCurTrack:()=>curTrack, getDrillSeen:()=>drillSeen, setDrillSeen:(o)=>{ drillSeen=o||{}; },
    // the practice model
    drillTracks, trackById, trackBySess, trackByItems, sessNs, startTrack, learnerTrend, learnerBest, scoredErr,
    /* the timed session + the seams; every step takes `now`, so no timers are needed */
    SESSION_MINS, sessionPlan, sessionQueue, sessionStart, sessionAdvance, sessionTick,
    sessionEnd, sessionActive, sessionDismiss, sessionClock, renderSessionCard,
    getSession:()=>psess, getSessReport:()=>sessLast,
    getSessMins:()=>sessMins, setSessMins:(m)=>{ sessMins=m; },
    SEAM_TRACKS, jamToggle, jamActive, renderJamBtn,
    // progress narrative + card badges
    trackBadge, paintDrillBadges, renderProgressInto, renderPractice, trendScore,
    selectTab, setMode, setHView, setScView, isBoardMode, loopToggle, seqPlay, seqAddCurrent, applyPreset, setChord,
    // shell
    setTempo, getTempo:()=>tempo, stopReferenceTransport, transportActive, applyContextBar, updateGlobalPlay,
    renderAllBoards,
    // learner model
    recordAttempt, dueItems, recordSession, learnerStats, srsInterval, normalizeLearner,
    getLearner:()=>learner, resetLearner:()=>{ learner=newLearner(); }, LEARNER_V,
    setLearner:(l)=>{ learner=l; }, SESS_PER_ID, SESS_MAX, PERF_STALE_DAYS,
    // progress backup
    saveState, loadState, snapshotState, progressPayload, progressParse, progressApply, progressFileName, saveFailed,
    BACKUP_FORMAT, getSaveBlocked:()=>saveBlocked, setSaveBlocked:(v)=>{ saveBlocked=!!v; },
    resetSaveFailShown:()=>{ saveFailShown=false; },
    // note-naming drill
    startDrill, drillAnswer, drillTargetsFor, exitDrill, DRILL_LEN, getDrill:()=>drill,
    // ear-training drills
    startEar, earAnswer, earNext, earReplay, exitEar, getEar:()=>ear,
    earChoices:()=>(ear?ear.cfg.choices():[]), INTERVALS, EAR_QUAL_IDX,
    // chord-change fluency drill
    startChanges, cmBegin, cmTap, cmUntap, finishChanges, exitChanges, getCm:()=>cmDrill,
    CM_PAIRS, CM_DURS, cmPairId, cmPairBest,
    setCmPair:(i)=>{ cmPairIdx=i; if(cmDrill) cmDrill.pairIdx=i; }, setCmDur:(i)=>{ cmDurIdx=i; if(cmDrill) cmDrill.dur=CM_DURS[i]; },
    // strumming & feel lab
    startStrum, spPlay, spStop, spToggle, exitStrum, getSp:()=>spDrill,
    STRUM_PATTERNS, setSpPattern:(i)=>{ spIdx=i; if(spDrill) spDrill.patIdx=i; },
    SP_SWINGS, setSpSwing:(i)=>{ spSwing=i; }, setSpAccent:(v)=>{ spAccent=!!v; },
    setSpMute:(v)=>{ spMute=!!v; }, setSpBand:(v)=>{ spBand=!!v; },
    // comp-the-progression drill
    startComp, targetPlay, targetStop, targetToggle, exitTarget, getTg:()=>tgDrill,
    tgBuildBars, setTargetProg:(i)=>{ tgIdx=i; if(tgDrill){ tgDrill.presetIdx=i; tgDrill.bars=tgBuildBars(SEQ_PRESETS[i]); } },
    // subdivision & timing drill
    startTiming, sdToggle, exitTiming, getSd:()=>sd, SUBDIVS, SD_BEATS, sdPath,
    setSdSub:(i)=>{ sdSub=i; }, setSdPos:(i)=>{ sdPos=i; }, setSdNotes:(v)=>{ sdNotes=!!v; },
    sdTickNow:(t,c)=>sdTick(t,c),
    CAGED_BY_POS, isCAGEDScale,
    setFret:(i)=>{ fretRangeIdx=i; },
    setCapo:(i)=>{ capo=i; }, getCapo:()=>capo,
    // time signature / meter
    METERS, setMeter, curMeter, barBeats, pulseSec, barSec, midPulseSec,
    meterGroupStarts:()=>[...meterGroupStarts()], getMeterIdx:()=>meterIdx,
    // mic tuner: the pitch maths is pure; capture needs a browser (tools/mic-check.js)
    micSupported, micMidiFromHz, micCentsOff, micNearestString,
    micOpen, micClose, micStatus, micPaint, micPaintIdle, getMic:()=>mt, buildTuner, tunerEarShow, tunerEarOpen,
    MT_FFT, MT_CLARITY, MT_IN_TUNE, MT_HZ_LO, MT_HZ_HI,
    // shared mic layer + onset detection; capture needs a browser (tools/onset-check.js)
    micAcquire, micRelease, micReleaseAll, micLive, micErrKey,
    onsetSupported, onsetMatch, onsetScore, onsetVerdict, onsetFeel, onsetSelfHeard,
    onOnset, onsetActive, onsetRecent, onsetClear, onsetProcessorSrc,
    ON_REFRACTORY, ON_RATIO, ON_FLOOR, ON_HUMAN_MS, ON_SELF_HITRATE, ON_SELF_MIN_N,
    // latency calibration
    calOffsetSec, calSetMs, calCancel, calMedian, getCalMs:()=>calMs, CAL_MAX_MS, CAL_MIN_HITS,
    calMeasured, setCalKnown:(v)=>{ calKnown=!!v; },
    // the shared scored-run layer and its consumers; _set() injects a run, so scoring
    // is driven end to end with no microphone
    scoredRun, SC_TOL_MAX,
    sdScore, spScore, tgScore,
    // accessibility + onboarding
    applyA11y, showWelcome, dismissWelcome,
    setCbPalette:(v)=>{ cbPalette=!!v; }, setFnShapes:(v)=>{ fnShapes=!!v; }, setWelcomeSeen:(v)=>{ welcomeSeen=!!v; },
    getA11y:()=>({ cbPalette, fnShapes, welcomeSeen }),
    setChQual:(i)=>{ chQual=i; chVoicing=0; }, setChVoicing:(i)=>{ chVoicing=i; },
    setTriad:(set,inv)=>{ trSet=set; trInv=inv; }, setChTriads:(v)=>{ chTriads=!!v; },
    chTriadIdx, triadsOn,
    initAudio:()=>audio(),
    setCtxNow:(t)=>{ if(actx) actx.currentTime=t; },
    state:()=>({ gRoot, gRootLbl, scIdx, scView, chQual, chVoicing, chTriads, currentTab, currentMode, hView,
                 loop:!!loopClock, loopMode, seq:!!seqClock, fretRangeIdx, lang, tempo,
                 cbPalette, fnShapes, welcomeSeen })
  };
}
