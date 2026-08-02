/* ===================== WIRING ===================== */
/* ---- shared root picker, display mode, sub-view toggle, global play ---- */
/* Each render fn paints panel content for its mode and the ONE shared board only
   when its mode is active (isBoardMode), so a cross-view pass paints the board once. */
function renderContextViews(){ renderChords(); renderTriads(); renderArp(); renderIdentify(); renderScales(); renderNotes(); markScrollables(); }
function renderActiveContext(){
  if(currentTab==='harmony'){ (hView==='identify'?renderIdentify:hView==='triads'?renderTriads:hView==='arp'?renderArp:renderChords)(); }
  else if(currentTab==='scales'){ scView==='notes'?renderNotes():renderScales(); }
  markScrollables();
}
/* Practice progress readout (3b): the learner model's aggregate stats as chips, or
   an empty state until a drill (3c) writes the first attempt. Re-run on mode switch
   and language change. Shares renderProgressInto (14-drill-ear.js) with the Ear
   home — one learner model (spine #3), one readout. */
function renderPractice(){ renderProgressInto('practice-progress'); }

/* ---- one musical context (spine #1, 1a) ----
   gRoot/gRootLbl (key center) and scIdx (mode = selected scale) are the single
   source of truth shared by Harmony, Scales, Circle and Notes. setKey() is the
   ONE place they change, so the views never drift: pick a key once and every
   view follows. Pass `mode` to also move the scale (e.g. a circle click); omit
   it to keep the current mode (e.g. the root picker). */
function setKey(pc, lbl, mode){
  gRoot=pc; gRootLbl=lbl;
  if(Number.isInteger(mode) && SCALES[mode]) scIdx=mode;
  chVoicing=0; scOverlay=null;
  ntRoot=lbl;                                   // Notes reflects the shared root (#4)
  activateRoot(document.getElementById('g-roots'), gRoot);
  // the drills' shared key strip (13-drill-registry.js) tracks the same context root
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
function setHView(v){ hView=v;
  document.getElementById('sub-chords').hidden = v!=='chords';
  document.getElementById('sub-triads').hidden = v!=='triads';
  document.getElementById('sub-arp').hidden = v!=='arp';
  document.getElementById('sub-identify').hidden = v!=='identify';
  ['chords','triads','arp','identify'].forEach(k=>{ const b=document.getElementById('hv-'+k); if(b){ b.classList.toggle('active', k===v); b.setAttribute('aria-pressed', k===v?'true':'false'); } });
  const head = v==='identify'?'id':(v==='triads'?'tr':v==='arp'?'arp':'ch');
  document.getElementById('harmony-h').textContent = t(head+'_h');
  document.getElementById('harmony-p').textContent = t(head+'_p');
  applyHarmonyExtras();
  (v==='identify'?renderIdentify:v==='triads'?renderTriads:v==='arp'?renderArp:renderChords)();
  markScrollables(); updateGlobalPlay(); saveState();
}
document.getElementById('hv-chords').onclick=()=>setHView('chords');
document.getElementById('hv-triads').onclick=()=>setHView('triads');
document.getElementById('hv-arp').onclick=()=>setHView('arp');
document.getElementById('hv-identify').onclick=()=>setHView('identify');

/* Scales-tab sub-view (1b): Scale | Notes — mirrors the Harmony Chords/Triads
   toggle. The folded-in Notes mode reuses the shared board + the context root. */
function setScView(v){ scView=v;
  document.getElementById('sub-scale').hidden = v!=='scale';
  document.getElementById('sub-notes').hidden = v!=='notes';
  ['scale','notes'].forEach(k=>{ const b=document.getElementById('sv-'+k); b.classList.toggle('active', k===v); b.setAttribute('aria-pressed', k===v?'true':'false'); });
  document.getElementById('scales-h').textContent = t(v==='notes'?'nt_h':'sc_h');
  document.getElementById('scales-p').textContent = t(v==='notes'?'nt_p':'sc_p');
  applyContextBar();   // toggle the (dead-in-Notes) display switch with the sub-view (#4)
  v==='notes'?renderNotes():renderScales();
  markScrollables(); updateGlobalPlay(); saveState();
}
document.getElementById('sv-scale').onclick=()=>setScView('scale');
document.getElementById('sv-notes').onclick=()=>setScView('notes');

function applyContextBar(){
  // Phase 10/A1 — the bar shows wherever any of its groups still has a job. It used
  // to be hidden outright on Circle, which took the ROOT PICKER with it: the app's
  // single most important piece of state (spine #1) simply had no control on one of
  // its three reference tabs, and you set the key by knowing to click the wheel. The
  // groups already hide themselves individually, so the bar only has to stand down
  // when they all have.
  // A2 moved the view switch out of here entirely — see applyBoardRegion.
  const key = currentTab==='harmony' || currentTab==='scales' || currentTab==='circle';
  document.getElementById('context-bar').hidden = !key;
  // the Names/Intervals display toggle does nothing in the Notes reference (it always
  // shows note names) and there are no fretboard dots to label on Circle, so hide it
  // in both (#4) to keep the bar honest
  const cd=document.querySelector('.ctx-display');
  if(cd) cd.hidden = currentTab==='circle' || (currentTab==='scales' && scView==='notes');
}
function applyBoardRegion(){
  const show = (currentTab==='harmony' || currentTab==='scales');
  document.getElementById('board-region').hidden = !show;
  const bm=document.getElementById('board-meta'); if(bm) bm.hidden = !show;   // legend+hint follow the board
  // A2: the view switch is a lens ON the board, so it lives in #board-region and only
  // the active subject's group shows. It hides with the board for free — one fewer
  // thing to remember on a tab that has no neck.
  const vh=document.getElementById('ctx-view-harmony'); if(vh) vh.hidden = currentTab!=='harmony';
  const vs=document.getElementById('ctx-view-scales');  if(vs) vs.hidden = currentTab!=='scales';
}
/* voicing cards + sequencer (now below the board) belong only to Harmony's
   chord-tones view; hide them everywhere else so the board stays the last thing. */
function applyHarmonyExtras(){
  const on = currentTab==='harmony' && hView==='chords';
  const el=document.getElementById('harmony-extras'); if(el) el.hidden = !on;     // progression sequencer (full-width row)
  const sc=document.getElementById('shapes-card'); if(sc) sc.hidden = !on;        // chord-shape cards (full-width row below the neck)
  applyShapesPanel();
}
function globalPlay(){
  const boardEl=document.getElementById('board');
  if(currentTab==='harmony'){
    if(hView==='triads'){ const v=currentTriadVoicing(); animArpMidi(boardEl, v.midis); }
    else if(hView==='arp'){ const q=QUALITIES[chQual]; animRun(boardEl, 48+gRoot, q.iv.concat([12])); }   // run the arpeggio melodically up the neck
    else { const v=currentChordVoicing(); animArpMidi(boardEl, v.midis); }
  } else if(currentTab==='scales' && scView==='scale'){ const s=SCALES[scIdx]; animRun(boardEl, 48+gRoot, s.iv.concat([12])); }
  else if(currentTab==='circle'){
    const cofMinor=ctxCofMinor(), pc=gRoot, b=48+pc, iv=cofMinor?[0,3,7]:[0,4,7], bt=0.5;  // fixed cadence pace, independent of practice tempo
    [0,5,7,12].forEach((off,i)=>{ const base=b+off; iv.forEach((x,j)=>pluck(base+x, i*bt + j*0.018, Math.max(0.9, bt*1.4))); });
  }
}
function updateGlobalPlay(){
  const b=document.getElementById('g-play');
  if(b){
    // nothing to "listen" to in the notes view or the identify picker
    b.hidden = (currentTab==='scales' && scView==='notes') || (currentTab==='harmony' && hView==='identify');
    const cadence = currentTab==='circle';
    b.innerHTML='&#9654; '+t(cadence?'b_cadence':'b_listen');
    const tip=t(cadence?'b_cadence':'b_listen_tip');
    b.setAttribute('aria-label', tip); b.title=tip;
  }
  const lp=document.getElementById('g-loop');
  if(lp){
    // The single loop now applies to both harmony views: it loops the selected
    // chord voicing (chord-tones view) or the shown triad (triads view) as a
    // backing. It persists across tabs; the transport chip is the Stop.
    lp.hidden = !(currentTab==='harmony' && (hView==='chords' || hView==='triads'));
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
// one shared board, wired once (1b): a dot click sounds that string, Enter/Space plays focused.
wirePlay(document.getElementById('board'));
/* Identify (1c): in identify mode a board tap toggles that note into the picked
   set instead of just sounding it. Capture phase + stopPropagation so wirePlay's
   pluck doesn't also fire; a freshly-picked note still sounds, as feedback. */
document.getElementById('board').addEventListener('click', e=>{
  if(!isBoardMode('identify')) return;
  const d=e.target.closest('.dot'); if(!d || d.dataset.midi==null) return;
  e.stopPropagation();
  const midi=parseInt(d.dataset.midi), i=idSel.indexOf(midi);
  if(i>=0) idSel.splice(i,1); else { idSel.push(midi); pluck(midi); rippleDot(d); }
  _boardStagger=false; renderIdentify(); _boardStagger=true;   // a pick isn't a board-change
}, true);
document.getElementById('id-clear').onclick=()=>{ idSel=[]; renderIdentify(); };
/* the suggester's scale chips are the reference → practice seam (spine #2):
   jump to that scale, on the chord's root, in the Scales tab. */
document.getElementById('suggest-body').addEventListener('click', e=>{
  const b=e.target.closest('[data-scale]'); if(!b) return;
  const ch=currentHarmonyChord(); if(!ch) return;
  setKey(ch.rootPc, ROOTS[ch.rootPc], +b.dataset.scale);
  setScView('scale'); selectTab('scales');
});
/* chord cards: a dot click sounds that string; clicking elsewhere on a card
   selects that voicing (so Listen/Loop use it). Keyboard note-play stays on the
   fretboard, which is the fully focusable surface. */
document.getElementById('ch-diagram').addEventListener('click',e=>{
  const dot=e.target.closest('.cd-dot');
  if(dot && dot.dataset.midi!=null){ e.stopPropagation(); pluck(parseInt(dot.dataset.midi)); return; }
  const card=e.target.closest('.chordbox'); if(!card || card.dataset.v==null) return;
  chVoicing=+card.dataset.v; renderChordDiagram(); saveState();
});

/* "More / Fewer shapes": expand the collapsed shape library in place */
document.getElementById('cd-more').addEventListener('click',()=>{
  chShapesExpanded=!chShapesExpanded; renderChordDiagram();
});

/* triad cards: a dot click sounds that string. Inversion/string-set buttons are
   the selector here, so cards aren't separately selectable. */
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
/* reverse seam (Scales → Harmony, mirrors the suggester's Harmony → Scales jump,
   spine #2): open the overlaid diatonic chord in Harmony's chord-tones view, so
   the diatonic row is no longer a dead end — you can drill from "the V chord of
   this key" straight into its voicings. */
document.getElementById('sc-info').addEventListener('click', e=>{
  if(!e.target.closest('.sc-open-harmony') || !scOverlay) return;
  const pc=scOverlay.rootPc;
  setChord(pc, ROOTS[pc], triadQi(scOverlay.iv));
  setHView('chords'); selectTab('harmony');
});

/* a circle node picks the key: set the context root + a canonical mode
   (major → Ionian, minor → Aeolian). The wheel re-derives its highlight. */
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
// the circle already reflects the context; "open in scales" is now navigation.
document.getElementById('cof-open').onclick=function(){ selectTab('scales'); };
/* Circle → Harmony seam: open the current key's tonic chord (major or minor,
   from the wheel's ring) in Harmony's chord-tones view — the harmonic peer of
   "open in scales". */
{ const ch=document.getElementById('cof-harmony'); if(ch) ch.onclick=function(){ setChord(gRoot, gRootLbl, ctxCofMinor()?1:0); setHView('chords'); selectTab('harmony'); }; }

/* Notes view (#4): a single "Naturals only" toggle. The note to highlight is no
   longer picked here — it follows the shared Root (setKey sets ntRoot), so this
   view stays in lockstep with the rest of the app and sheds 17 redundant buttons. */
function applyNtFilter(){ const b=document.getElementById('nt-nat'); if(b){ const on=ntFilter==='nat'; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on?'true':'false'); } }
document.getElementById('nt-nat').onclick=function(){ ntFilter = ntFilter==='nat'?'all':'nat'; applyNtFilter(); renderNotes(); saveState(); };
applyNtFilter();

document.getElementById('aside-toggle').onclick=function(){ const b=document.getElementById('aside-body'); const hidden=b.style.display==='none'; b.style.display=hidden?'block':'none'; this.textContent=hidden?'−':'+'; this.setAttribute('aria-expanded', hidden); };
const _shapesTg=document.getElementById('shapes-toggle');
if(_shapesTg) _shapesTg.onclick=function(){ shapesOpen=!shapesOpen; applyShapesPanel(); saveState(); };

/* help toggle: one ? collapses/reveals BOTH the active view's description and the
   board's playing-hint, on every viewport now (was phone-only, description-only), so
   the default screen reads clean. A body-level class drives it because those two texts
   live in different subtrees (.main vs .board-meta); every ? button reflects the state. */
let helpOpen = false;
function applyHelpState(){
  document.body.classList.toggle('help-open', helpOpen);
  document.querySelectorAll('.ph-help').forEach(b=>{ b.classList.toggle('on', helpOpen); b.setAttribute('aria-expanded', helpOpen?'true':'false'); });
}
document.querySelectorAll('.ph-help').forEach(btn=>{ btn.addEventListener('click',()=>{ helpOpen=!helpOpen; applyHelpState(); }); });
applyHelpState();

function selectTab(name){
  // Playback (loop / progression) deliberately persists across tabs — it acts
  // as a backing track. The global transport chip lets you stop it from anywhere.
  currentTab=name;
  document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active', x.id==='panel-'+name));
  if(typeof applyNav==='function') applyNav();   // A2: the one nav follows the state, however it changed
  applyAsideState();
  applyContextBar();
  applyBoardRegion();
  applyHarmonyExtras();
  updateGlobalPlay();
  renderActiveContext();
  saveState();
}
// Phase 3a — the mode axis. Orthogonal to selectTab (the reference sub-axis): body
// classes drive the show/hide CSS, so reference content is untouched. Phase 4 added
// a third mode for ear training; it turned out to be a Practice pillar rather than a
// mode (same home shell, same progress card, same learner model), so it folded back
// in and the axis is Reference vs Practice again. Leaving Practice ends the running
// drill.
//
// Phase 10/A1 — playback no longer persists across MODES. It still persists across
// tabs, where it makes sense (same subject, same board, the transport genuinely acts
// as a backing track). A mode switch is different: a drill brings its own click, its
// own bed and its own scheduler, so a surviving reference loop just strummed the
// reference chord over the top of it, on a clock the drill doesn't control — and its
// controls are hidden in Practice, so it couldn't even be stopped. Reference owns the
// transport, Practice owns the drill.
function setMode(mode){
  currentMode = mode==='practice' ? 'practice' : 'reference';
  document.body.classList.toggle('mode-reference', currentMode==='reference');
  document.body.classList.toggle('mode-practice', currentMode==='practice');
  if(typeof applyNav==='function') applyNav();   // A2: one strip, painted from the live state
  if(currentMode==='reference'){
    // leaving Practice ends whatever was running. Registry-driven
    // (13-drill-registry.js): every drill self-registers, so this can't go stale
    // the way the old hand-written list did.
    exitAllDrills();
    applyAsideState(); applyContextBar(); applyBoardRegion(); applyHarmonyExtras(); renderActiveContext();
  } else {
    stopReferenceTransport();
    // entering Practice with no drill running: show the home view (a drill starter
    // swaps it for the drill's own area right after)
    if(!activeDrill()) showDrillHome();
    renderPractice();
  }
  updateGlobalPlay();
  saveState();
}
/* One navigation surface (Phase 10/A2). Four destinations, four panels: three
   reference subjects and Practice. `navTo` is the only entry point — it sets the mode
   the destination belongs to and, for a reference destination, the tab. Practice's
   panel is a real sibling section (#panel-practice), so all four are genuine tabpanels
   and the tablist semantics are honest rather than a shape forced onto a mode switch. */
function navTo(panel){
  if(panel==='practice'){ setMode('practice'); }
  else { if(currentMode!=='reference') setMode('reference'); selectTab(panel); }
  applyNav();
}
// paint the strip from the live state — called by setMode and selectTab, so the nav
// follows a keyboard shortcut, a seam jump or a restored share link, not just a click
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
// Practice: start the note-naming drill from its card (3c)
{ const s=document.getElementById('start-notes'); if(s) s.onclick=startDrill; }
// Seam (spine #2): jump from the reference Notes view into the drill on the same neck
{ const d=document.getElementById('nt-drill'); if(d) d.onclick=function(){ setMode('practice'); startDrill(); }; }
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
/* custom tuning: a per-string select changes one string's MIDI; re-apply so the
   board, tuner and string labels follow immediately. */
{ const cs=document.getElementById('tb-custom-strings');
  if(cs) cs.addEventListener('change', e=>{ const s=e.target.closest('.custom-str'); if(!s) return;
    customTuning[+s.dataset.i]=+s.value; applyTuning(); buildTuner(); renderAllBoards(); saveState(); }); }
/* master volume: scales the whole-app output (masterOut, before the limiter). Audio is
   lazy, so when the bus isn't up yet we just stash masterVol — setupBus reads it on
   first sound. setTargetAtTime ramps the live gain so dragging is click-free. */
{ const v=document.getElementById('tb-vol');
  if(v){ v.oninput=function(){ masterVol=(+this.value)/100;
      const vv=document.getElementById('tb-vol-val'); if(vv) vv.textContent=(+this.value)+'%';
      if(masterOut && actx) masterOut.gain.setTargetAtTime(masterVol, actx.currentTime, 0.01);
    };
    v.onchange=function(){ saveState(); }; } }
/* tuner: tap a string button to hold its reference pitch (05-audio tunerTone) */
{ const ts=document.getElementById('tb-tuner-strings');
  if(ts) ts.addEventListener('click', e=>{ const b=e.target.closest('[data-midi]'); if(b) tunerTone(+b.dataset.midi); }); }
document.getElementById('tb-frets').onchange=function(){ fretRangeIdx=+this.value; renderAllBoards(); saveState(); };
{ const cp=document.getElementById('tb-capo'); if(cp) cp.onchange=function(){ capo=+this.value; renderAllBoards(); saveState(); }; }
/* a meter change alters what an in-flight drill should be showing (bar length,
   beat grid), so re-paint the running drill via the registry rather than naming
   one drill here — the old call reached for the timing drill only. */
{ const mt=document.getElementById('tb-meter'); if(mt) mt.onchange=function(){ setMeter(+this.value); refreshDrillsLang(); saveState(); }; }
/* accessibility toggles (Phase 9 feel pass): a colour-blind-safe palette + distinct
   per-function dot shapes. Both are pure body-class switches — the CSS does the work
   (see styles.css), so there's nothing to repaint — and both persist. */
function applyA11y(){
  if(typeof document==='undefined' || !document.body) return;
  document.body.classList.toggle('cb-palette', cbPalette);
  document.body.classList.toggle('fn-shapes', fnShapes);
  const p=document.getElementById('tb-cbpalette'); if(p){ p.classList.toggle('active', cbPalette); p.setAttribute('aria-pressed', cbPalette?'true':'false'); }
  const s=document.getElementById('tb-shapes');    if(s){ s.classList.toggle('active', fnShapes);  s.setAttribute('aria-pressed', fnShapes?'true':'false'); }
}
{ const p=document.getElementById('tb-cbpalette'); if(p) p.onclick=function(){ cbPalette=!cbPalette; applyA11y(); saveState(); };
  const s=document.getElementById('tb-shapes');    if(s) s.onclick=function(){ fnShapes=!fnShapes;  applyA11y(); saveState(); }; }

/* ---- share a deep link (Phase 9 distribution) ----
   Copy a URL whose hash encodes the current key / scale / chord view; opening it
   lands a new visitor on that exact context (applyShareHash on load). */
function shareFallback(){ try{ location.hash=encodeShareState(); }catch(e){ /* ignore */ } }
{ const sb=document.getElementById('tb-share');
  if(sb) sb.onclick=function(){
    const url=shareURL();
    const flash=()=>{ sb.textContent=t('share_copied'); sb.classList.add('active'); setTimeout(()=>{ sb.textContent=t('share_btn'); sb.classList.remove('active'); }, 1400); };
    try{
      if(typeof navigator!=='undefined' && navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(url).then(flash).catch(()=>{ shareFallback(); flash(); });
      else { shareFallback(); flash(); }
    }catch(e){ shareFallback(); flash(); }
  }; }

/* ---- review routing (spine #3): the progress card's Review button drops into the
   track the queue named; the drills already prefer due items, so this just opens the
   right one.

   Phase 10/B1 — this was a hand-written `if(ns==='note') … else if(ns==='interval'
   …)` that covered four of the nine tracks, the second of the three lists that
   encoded the same knowledge incompletely. It now goes through the registry's own
   `start`, so a track is routable the moment it is declared. */
function startReview(track){
  setMode('practice');
  startTrack(track);
}
{ const h=document.getElementById('practice-progress');
  if(h) h.addEventListener('click', e=>{ const b=e.target.closest('[data-review]'); if(b) startReview(b.dataset.review); }); }
document.getElementById('tb-lefty').onclick=function(){ lefty=!lefty; this.classList.toggle('active',lefty); this.setAttribute('aria-pressed',lefty); renderAllBoards(); renderCircle(); saveState(); };
/* the metronome / loop / sequencer clocks read beat() live, so the tempo glides
   without restarting — just update the value and the label here. */
document.getElementById('tb-tempo').oninput=function(){ setTempo(+this.value); };
document.getElementById('tb-tempo').onchange=function(){ saveState(); };
/* The same tempo, stepped from the drill strip (A1). Both controls go through the one
   setter, so neither has to know the other exists. */
{ const step=d=>{ setTempo(tempo+d); saveState(); };
  const sl=document.getElementById('drill-ctx-slower'); if(sl) sl.onclick=()=>step(-5);
  const fa=document.getElementById('drill-ctx-faster'); if(fa) fa.onclick=()=>step(5); }
document.getElementById('tb-metro').onclick=metroToggle;
document.getElementById('tb-bass').onclick=bassToggle;
document.getElementById('tb-drums').onclick=drumsToggle;
document.getElementById('tb-stop').onclick=function(){ if(seqClock) seqStop(); else stopLoop(); };
document.getElementById('tb-toggle').onclick=function(){ toolbarOpen=!toolbarOpen; applyToolbarState(); saveState(); };
document.getElementById('backing-toggle').onclick=function(){ backingOpen=!backingOpen; applyBackingPanel(); saveState(); };
/* quality-picker disclosure (#1/#2): one toggle per picker, both flip the shared
   chQualsAdv and rebuild so chord + arp stay in lockstep */
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
    // build.js ships only the newest few releases (the full history was 15% of the
    // bundle); point at CHANGELOG.md for the rest.
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
/* ---- first-run welcome (onboarding) ----
   A one-time orientation card for brand-new visitors. Reuses the changelog overlay
   look; dismissing it (button / ✕ / backdrop / Escape) records welcomeSeen so it
   never returns. dismissWelcome no-ops when the card isn't open, so it's safe to
   call from the shared Escape handler. */
function showWelcome(){ const o=document.getElementById('welcome-overlay'); if(!o) return; o.hidden=false; o.classList.add('open');
  const f=document.getElementById('wc-go-look'); if(f) try{ f.focus(); }catch(_){} }
function dismissWelcome(){ const o=document.getElementById('welcome-overlay'); if(!o||o.hidden) return; o.classList.remove('open'); o.hidden=true; welcomeSeen=true; saveState(); }
/* "Tune the guitar" (Phase 10/A4). Two tuners exist and they are different tools —
   the mic one listens, the reference one plays a pitch at you — so route to whichever
   is actually available. 14-mic-tuner.js REMOVES #tb-mic when there's no secure
   context, which makes the button's presence the honest support test; without it,
   open Settings on the reference-tone tuner, the tool that still works there. */
function welcomeTune(){
  if(document.getElementById('tb-mic') && typeof micOpen==='function'){ micOpen(); return; }
  const tb=document.getElementById('toolbar'), tg=document.getElementById('tb-toggle');
  if(tb && tb.classList.contains('collapsed') && tg) tg.click();
  const row=document.querySelector('.tb-tuner'); if(row) try{ row.scrollIntoView({block:'nearest'}); }catch(_){}
}
{ const g=document.getElementById('wc-got');   if(g) g.onclick=dismissWelcome;
  const c=document.getElementById('wc-close'); if(c) c.onclick=dismissWelcome;
  /* Every answer routes. The card used to end in one Got it that landed you on chord
     tones in A minor no matter which of the two nouns you had just read — so what the
     visitor knew about themselves changed nothing. Dismiss first, then route, so the
     destination isn't rendered behind a modal. */
  const route=(id,go)=>{ const b=document.getElementById(id); if(b) b.onclick=()=>{ dismissWelcome(); go(); }; };
  route('wc-go-look',     ()=>navTo('harmony'));
  route('wc-go-practice', ()=>navTo('practice'));
  route('wc-go-tune',     welcomeTune);
  const o=document.getElementById('welcome-overlay'); if(o) o.addEventListener('click',e=>{ if(e.target.id==='welcome-overlay') dismissWelcome(); }); }

document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeChangelog(); closeKbd(); dismissWelcome(); } });

/* ---- global keyboard shortcuts (desktop power-use; also seeds Phase-3 drills) ----
   Space=Listen/Stop · L=Loop · M=Metronome · 1/2/3=tabs · A–G=key · [ ]=transpose · ?=help.
   Guards: ignored while typing in a field, while a modal is open, or with a Ctrl/Meta/Alt
   chord (so browser shortcuts survive). Space is only hijacked when focus is NOT on an
   interactive control, so a focused fretboard dot / button keeps its native Space. */
const NOTE_KEY = { a:9, b:11, c:0, d:2, e:4, f:5, g:7 };
function transposeKey(delta){ const pc=mod(gRoot+delta,12); setKey(pc, ROOTS[pc]); }
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  const tg=e.target;
  if(tg && (tg.tagName==='INPUT'||tg.tagName==='SELECT'||tg.tagName==='TEXTAREA'||tg.isContentEditable)) return;
  // modal open — the mic tuner counts too, or "a" would retune the app's key while
  // you're squinting at a needle (and it runs its own Escape handler).
  if(!document.getElementById('cl-overlay').hidden || !document.getElementById('kbd-overlay').hidden) return;
  { const mo=document.getElementById('mic-overlay'); if(mo && !mo.hidden) return; }
  const k=e.key;
  // Phase 10/A1 — Space / L / M drive the REFERENCE transport, which is scoped out of
  // Practice. Without this guard they'd still reach it from a drill screen: an
  // invisible metronome beating against the drill's own click, with no control on
  // screen to stop it. The shortcut follows the control it stands for.
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
  // A2: the number keys are the nav, in nav order — so 4 is Practice, which the
  // shortcuts had no key for while it was a separate axis
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

/* ---- graceful degradation when the browser has no Web Audio (Phase C+) ----
   Disable the transport controls with a hint instead of leaving dead buttons. */
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
  // First visit (no saved state): match the browser's preferred language —
  // Ukrainian if it asks for it, English otherwise — instead of always landing
  // on the hard-coded 'uk' default. The EN/UK toggle + localStorage take over
  // from the next visit on, so this only chooses the very first impression.
  try{ const nav=(navigator.languages&&navigator.languages[0])||navigator.language||''; lang = /^uk\b/i.test(nav) ? 'uk' : 'en'; }catch(_){ /* keep the 'uk' default */ }
  if(typeof window!=='undefined' && window.innerWidth<=600) fretRangeIdx=1;  // phones default to a 5-fret window
}
ntRoot=gRootLbl;   // Notes highlight follows the shared root (#4); keep them in sync from the first paint
applyTuning();
applyLang();
selectTab(currentTab);
setMode(currentMode);   // Phase 3a: apply the restored mode axis after the reference shell is up
markScrollables();
// re-measure swipe-group overflow when the viewport changes (rotate / resize), and once
// the webfont has loaded — button widths shift on the font swap, so a measure taken with
// the fallback font would mis-detect overflow and show / hide the fade incorrectly.
window.addEventListener('resize', markScrollables);
try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(markScrollables); }catch(_){}
applyAudioAvailability();
applyA11y();   // apply restored accessibility prefs (palette / shapes) on load
/* the drills' one shared key picker (13-drill-registry.js). Built once here rather than by
   each drill: they all set the same context root, and the running drill only has to say what
   to re-derive (onKey). CSS shows the row only while a drill is up. */
{ const dk=document.getElementById('drill-ctx-key');
  if(dk) buildRootBtns(dk, gRoot, (pc,r)=>{ setKey(pc,r); drillKeyChanged(); });
  // Quit was a seventh identical button, one per drill area. The registry already knows
  // which drill is running and how to end it, so the shell owns the button.
  const dq=document.getElementById('drill-ctx-quit');
  if(dq) dq.onclick=function(){ const d=activeDrill(); if(d && typeof d.exit==='function') d.exit(); }; }
/* Every drill starts from inside #practice-home — a drill card, or the progress
   card's Review button — so one delegated listener here keeps the shared strip in
   step with whichever drill just took over, with no per-drill bookkeeping. It
   bubbles after the starter's own onclick, so the drill's state is already set by
   the time applyDrillCtx() reads the registry. */
{ const ph=document.getElementById('practice-home');
  if(ph) ph.addEventListener('click', ()=>applyDrillCtx()); }
// Deep link (Phase 9): if the URL hash carries a shared context, apply it over the
// restored state now that the shell + setters are up, then strip the hash.
const fromShare = (typeof applyShareHash==='function') && applyShareHash();
document.getElementById('app-ver').textContent = 'v' + APP_VERSION;
// First-run onboarding: only a genuinely first visit (no saved state) leaves
// welcomeSeen false — returning users are grandfathered in loadState(). A visitor
// arriving via a share link goes straight to the shared view, not the welcome.
if(!welcomeSeen && !fromShare) showWelcome();

/* ---- test introspection hook (Phase C+) ----
   Built ONLY when a harness sets window.__GS_ALLOW_TEST__ before the page loads,
   so production carries zero footprint. Exposes pure musical helpers and a few
   state accessors so the committed jsdom suite can assert behaviour without
   reaching into closures. Never set this flag in the shipped app. */
if (typeof window!=='undefined' && window.__GS_ALLOW_TEST__) {
  window.__GS_TEST__ = {
    APP_VERSION, I18N, QUALITIES, TRIADS, SCALES, COF, FRET_RANGES, SEQ_PRESETS,
    fifthInterval, spellNote, rootParts, simpleName,
    diatonicTriads, isMajorFamily, ctxCofSel, ctxCofMinor, setKey,
    identifyChord, nearChords, scalesOverChord, triadQi, currentHarmonyChord, renderIdentify,
    setIdSel:(arr)=>{ idSel=arr.slice(); },
    chordVoicings, voicingMidi, currentChordVoicing, currentTriadVoicing, STD_LOW6_MIDI, TRI_TO_QUAL,
    cellW, boardWidth, leftFixed, FRET_LO, FRET_HI,
    schedAdvance, clocks, beat,
    // custom tuning (Phase 2)
    TUNINGS, applyTuning, tuningMidi, TUNE_LO, TUNE_HI,
    getOpenMidi:()=>OPEN_MIDI.slice(), getCustomTuning:()=>customTuning.slice(),
    setCustomTuning:(arr)=>{ customTuning=arr.slice(); }, setTuningIdx:(i)=>{ tuningIdx=i; applyTuning(); },
    // learner review + activity (spine #3)
    learnerReview, learnerActivity, startReview,
    // shareable deep links (Phase 9)
    encodeShareState, applyShareHash, shareURL,
    // drill registry (13): the one list the shell iterates instead of naming drills
    DRILLS, activeDrill, showDrillHome, exitAllDrills, refreshDrillsLang, drillKeyChanged, applyDrillCtx,
    // one practice model (Phase 10/B1)
    drillTracks, trackById, trackBySess, trackByItems, sessNs, startTrack, learnerTrend, learnerBest, scoredErr,
    selectTab, setMode, setHView, setScView, isBoardMode, loopToggle, seqPlay, seqAddCurrent, applyPreset, setChord,
    // one function, one home (Phase 10/A1)
    setTempo, getTempo:()=>tempo, stopReferenceTransport, transportActive, applyContextBar, updateGlobalPlay,
    renderAllBoards,
    // learner model (spine #3, 3b)
    recordAttempt, dueItems, recordSession, learnerStats, srsInterval, normalizeLearner,
    getLearner:()=>learner, resetLearner:()=>{ learner=newLearner(); }, LEARNER_V,
    setLearner:(l)=>{ learner=l; }, SESS_PER_ID, SESS_MAX, PERF_STALE_DAYS,
    // note-naming drill (3c)
    startDrill, drillAnswer, drillTargetsFor, exitDrill, DRILL_LEN, getDrill:()=>drill,
    // ear-training drills (Phase 4)
    startEar, earAnswer, earNext, earReplay, exitEar, getEar:()=>ear,
    earChoices:()=>(ear?ear.cfg.choices(ear.cur):[]), INTERVALS, EAR_QUAL_IDX, RHYTHMS,
    // chord-change fluency drill (Phase 5a)
    startChanges, cmBegin, cmTap, cmUntap, finishChanges, exitChanges, getCm:()=>cmDrill,
    CM_PAIRS, CM_DURS, cmPairId, cmPairBest,
    setCmPair:(i)=>{ cmPairIdx=i; if(cmDrill) cmDrill.pairIdx=i; }, setCmDur:(i)=>{ cmDurIdx=i; if(cmDrill) cmDrill.dur=CM_DURS[i]; },
    // strumming & feel lab (Phase 5b + 5d, merged)
    startStrum, spPlay, spStop, spToggle, exitStrum, getSp:()=>spDrill,
    STRUM_PATTERNS, setSpPattern:(i)=>{ spIdx=i; if(spDrill) spDrill.patIdx=i; },
    SP_SWINGS, setSpSwing:(i)=>{ spSwing=i; }, setSpAccent:(v)=>{ spAccent=!!v; },
    setSpMute:(v)=>{ spMute=!!v; }, setSpBand:(v)=>{ spBand=!!v; },
    // over-the-changes drill (Phase 5c + 6a/6b/6c, merged) — one machine, two modes
    startOverChanges, startComp, startTarget, getOcMode:()=>tgMode,
    setOcMode:(m)=>{ tgMode = (m==='chords') ? 'chords' : 'tones'; },
    targetPlay, targetStop, targetToggle, targetAnswer, exitTarget, getTg:()=>tgDrill,
    tgBuildBars, tgAccuracy, setTargetProg:(i)=>{ tgIdx=i; if(tgDrill){ tgDrill.presetIdx=i; tgDrill.bars=tgBuildBars(SEQ_PRESETS[i]); } },
    setTargetPos:(i)=>{ tgPos=i; if(tgDrill) tgDrill.win = i ? boxWindow(i) : null; },
    setTargetDeg:(i)=>{ tgDeg=i; if(tgDrill){ const c=tgDrill.bars[tgDrill.bar]; if(c) tgSetTargets(c); } },
    // call & response drill (Phase 6c)
    startCallResp, crAnswer, crReplay, exitCallResp, getCr:()=>cr, CR_ROUNDS, crPool, crMakeMotif,
    crToResponse:()=>{ if(cr){ cr.phase='response'; cr.respIdx=0; cr.wrongNote=0; } }, setCrPos:(i)=>{ crPos=i; },
    crNextRoundNow:()=>{ if(cr) crNewRound(); },   // test hook: skip the inter-round wait
    // subdivision & timing drill (Phase 7a)
    startTiming, sdToggle, exitTiming, getSd:()=>sd, SUBDIVS, SD_BEATS, sdPath,
    setSdSub:(i)=>{ sdSub=i; }, setSdPos:(i)=>{ sdPos=i; }, setSdNotes:(v)=>{ sdNotes=!!v; },
    sdTickNow:(t,c)=>sdTick(t,c),
    CAGED_BY_POS, isCAGEDScale,
    setFret:(i)=>{ fretRangeIdx=i; },
    setCapo:(i)=>{ capo=i; }, getCapo:()=>capo,
    // time signature / meter (Phase 7b)
    METERS, setMeter, curMeter, barBeats, pulseSec, barSec, midPulseSec,
    meterGroupStarts:()=>[...meterGroupStarts()], getMeterIdx:()=>meterIdx,
    // chromatic mic tuner (Phase 8 / F0). The pitch→readout maths is pure and
    // assertable here; the getUserMedia half needs a real browser (tools/mic-check.js).
    micSupported, micMidiFromHz, micCentsOff, micNearestString,
    micOpen, micClose, micStatus, micPaint, micPaintIdle, getMic:()=>mt,
    MT_FFT, MT_CLARITY, MT_IN_TUNE, MT_HZ_LO, MT_HZ_HI,
    // shared mic layer (13-mic.js) + onset detection & scoring (Phase 8 / F1).
    // The matching/scoring maths is pure, so it is asserted directly — the capture
    // half needs a real browser (tools/onset-check.js).
    micAcquire, micRelease, micReleaseAll, micLive, micErrKey,
    onsetSupported, onsetMatch, onsetScore, onsetVerdict, onsetFeel, onsetSelfHeard,
    onOnset, onsetActive, onsetRecent, onsetClear, onsetProcessorSrc,
    ON_REFRACTORY, ON_RATIO, ON_FLOOR, ON_HUMAN_MS, ON_SELF_HITRATE, ON_SELF_MIN_N,
    // latency calibration (14-calibration.js) — restored for F1, which is its first
    // real consumer; the v2.5.0 version was cut for having none.
    calOffsetSec, calSetMs, calCancel, calMedian, getCalMs:()=>calMs, CAL_MAX_MS, CAL_MIN_HITS,
    calMeasured, setCalKnown:(v)=>{ calKnown=!!v; },
    // the shared scored-run layer (13-scored.js) and its three consumers. The
    // controllers are exposed whole: _set() injects a run so the harness can drive
    // scoring end-to-end with no microphone attached.
    scoredRun, SC_TOL_MAX,
    sdScore, spScore, tgScore,
    // accessibility + onboarding (Phase 9 feel pass)
    applyA11y, showWelcome, dismissWelcome,
    setCbPalette:(v)=>{ cbPalette=!!v; }, setFnShapes:(v)=>{ fnShapes=!!v; }, setWelcomeSeen:(v)=>{ welcomeSeen=!!v; },
    getA11y:()=>({ cbPalette, fnShapes, welcomeSeen }),
    setChQual:(i)=>{ chQual=i; chVoicing=0; }, setChVoicing:(i)=>{ chVoicing=i; },
    setTriad:(q,set,inv)=>{ trQual=q; trSet=set; trInv=inv; },
    initAudio:()=>audio(),
    setCtxNow:(t)=>{ if(actx) actx.currentTime=t; },
    state:()=>({ gRoot, gRootLbl, scIdx, scView, chQual, chVoicing, currentTab, currentMode, hView,
                 loop:!!loopClock, loopMode, seq:!!seqClock, fretRangeIdx, lang, tempo,
                 cbPalette, fnShapes, welcomeSeen })
  };
}
