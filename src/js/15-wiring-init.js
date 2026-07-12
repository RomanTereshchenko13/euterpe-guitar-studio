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
  document.getElementById('context-bar').hidden = !(currentTab==='harmony' || currentTab==='scales');
  // only the active tab's view switch lives in the shared bar (1e)
  const vh=document.getElementById('ctx-view-harmony'); if(vh) vh.hidden = currentTab!=='harmony';
  const vs=document.getElementById('ctx-view-scales');  if(vs) vs.hidden = currentTab!=='scales';
  // the Names/Intervals display toggle does nothing in the Notes reference (it always
  // shows note names), so hide it there (#4) to keep the bar honest
  const cd=document.querySelector('.ctx-display'); if(cd) cd.hidden = (currentTab==='scales' && scView==='notes');
}
function applyBoardRegion(){
  const show = (currentTab==='harmony' || currentTab==='scales');
  document.getElementById('board-region').hidden = !show;
  const bm=document.getElementById('board-meta'); if(bm) bm.hidden = !show;   // legend+hint follow the board
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
  document.querySelectorAll('.tab').forEach(x=>{ const on=x.dataset.panel===name; x.classList.toggle('active',on); x.setAttribute('aria-selected',on); x.tabIndex=on?0:-1; });
  document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active', x.id==='panel-'+name));
  applyAsideState();
  applyContextBar();
  applyBoardRegion();
  applyHarmonyExtras();
  updateGlobalPlay();
  renderActiveContext();
  saveState();
}
// Phase 3a — the mode axis, extended to three modes in Phase 4 (Reference ·
// Practice · Ear). Orthogonal to selectTab (the reference sub-axis): body classes
// drive the show/hide CSS, so reference content is untouched. `mode-activity` is
// set for either activity mode so the "collapse the reference shell" rule stays one
// list. Leaving an activity mode ends its running drill; playback persists across
// modes (the transport bar acts as a backing track, like it does across tabs).
function setMode(mode){
  currentMode = (mode==='practice'||mode==='ear') ? mode : 'reference';
  document.body.classList.toggle('mode-reference', currentMode==='reference');
  document.body.classList.toggle('mode-practice', currentMode==='practice');
  document.body.classList.toggle('mode-ear', currentMode==='ear');
  document.body.classList.toggle('mode-activity', currentMode!=='reference');
  document.querySelectorAll('.modebtn').forEach(b=>{
    const on=b.dataset.mode===currentMode; b.classList.toggle('active',on); b.setAttribute('aria-pressed',on?'true':'false');
  });
  // end the other modes' running drills when we leave them
  if(currentMode!=='practice' && typeof drill!=='undefined' && drill) exitDrill();
  if(currentMode!=='practice' && typeof cmDrill!=='undefined' && cmDrill) exitChanges();
  if(currentMode!=='practice' && typeof spDrill!=='undefined' && spDrill) exitStrum();
  if(currentMode!=='practice' && typeof coDrill!=='undefined' && coDrill) exitComp();
  if(currentMode!=='practice' && typeof gfDrill!=='undefined' && gfDrill) exitGroove();
  if(currentMode!=='practice' && typeof tgDrill!=='undefined' && tgDrill) exitTarget();
  if(currentMode!=='ear' && typeof ear!=='undefined' && ear) exitEar();
  if(currentMode==='reference'){
    applyAsideState(); applyContextBar(); applyBoardRegion(); applyHarmonyExtras(); renderActiveContext();
  } else if(currentMode==='practice'){
    // entering Practice with no drill running: show the home view (drill starters
    // swap it for the active drill area right after)
    const anyDrill=(typeof drill!=='undefined' && drill) || (typeof cmDrill!=='undefined' && cmDrill) || (typeof spDrill!=='undefined' && spDrill) || (typeof coDrill!=='undefined' && coDrill) || (typeof gfDrill!=='undefined' && gfDrill) || (typeof tgDrill!=='undefined' && tgDrill);
    if(!anyDrill){
      const home=document.getElementById('practice-home');
      if(home) home.hidden=false;
      ['drill-area','cm-area','sp-area','co-area','gf-area','tg-area'].forEach(id=>{ const a=document.getElementById(id); if(a) a.hidden=true; });
    }
    renderPractice();
  } else {   // ear
    if(!(typeof ear!=='undefined' && ear)){
      const home=document.getElementById('ear-home'), area=document.getElementById('ear-area');
      if(home) home.hidden=false; if(area) area.hidden=true;
    }
    renderEar();
  }
  updateGlobalPlay();
  saveState();
}
(function initTabs(){
  const tablist=document.getElementById('tabs'); tablist.setAttribute('role','tablist');
  document.querySelectorAll('.tab').forEach(tb=>{ tb.setAttribute('role','tab'); tb.id='tab-'+tb.dataset.panel; tb.setAttribute('aria-controls','panel-'+tb.dataset.panel); const on=tb.classList.contains('active'); tb.setAttribute('aria-selected',on); tb.tabIndex=on?0:-1; });
  document.querySelectorAll('.panel').forEach(p=>{ p.setAttribute('role','tabpanel'); p.setAttribute('aria-labelledby','tab-'+p.id.replace('panel-','')); });
  tablist.addEventListener('keydown',e=>{
    if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft') return;
    const tabs=[...document.querySelectorAll('.tab')], cur=tabs.findIndex(x=>x.classList.contains('active'));
    const nxt=tabs[(cur+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
    selectTab(nxt.dataset.panel); nxt.focus(); e.preventDefault();
  });
})();
document.getElementById('tabs').addEventListener('click',e=>{
  const tb=e.target.closest('.tab'); if(!tb) return;
  selectTab(tb.dataset.panel);
});
document.getElementById('modenav').addEventListener('click',e=>{
  const b=e.target.closest('.modebtn'); if(!b) return;
  setMode(b.dataset.mode);
});
// Practice: start the note-naming drill from its card (3c)
{ const s=document.getElementById('start-notes'); if(s) s.onclick=startDrill; }
// Seam (spine #2): jump from the reference Notes view into the drill on the same neck
{ const d=document.getElementById('nt-drill'); if(d) d.onclick=function(){ setMode('practice'); startDrill(); }; }
document.getElementById('tabs').addEventListener('scroll', syncTabsScroll, {passive:true});
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

/* ---- timing calibration (Phase 3 debt) ----
   The Tap-test button is a tiny state machine: first click starts the click track,
   each later click is a tap matched to the nearest beat; at CAL_TAPS it computes +
   stores the offset (calMs). The slider sets it by hand. calOffsetSec() is the
   value future scored/mic windows will read; nothing consumes it on screen yet. */
function calBtnLabel(){
  const b=document.getElementById('tb-cal-tap'); if(!b) return;
  if(cal){ b.classList.add('active'); b.textContent=t('cal_tapnow')+' '+cal.deltas.length+'/'+CAL_TAPS; }
  else { b.classList.remove('active'); b.textContent=t('cal_test'); }
}
function applyCal(){
  const s=document.getElementById('tb-cal'); if(s) s.value=calMs;
  const v=document.getElementById('tb-cal-val'); if(v) v.textContent=calMs+' '+t('cal_unit');
  calBtnLabel();
}
{ const cb=document.getElementById('tb-cal-tap');
  if(cb) cb.onclick=function(){
    if(!cal){ calStart(); calBtnLabel(); return; }
    const n=calTap();
    if(n>=CAL_TAPS){ calFinish(); applyCal(); saveState(); }
    else calBtnLabel();
  };
  const cs=document.getElementById('tb-cal');
  if(cs){ cs.oninput=function(){ setCalMs(+this.value); applyCal(); }; cs.onchange=saveState; } }

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
   drill for the namespace with the most overdue items; the drills already prefer
   due items, so this just opens the right one. */
function startReview(ns){
  if(ns==='note'){ setMode('practice'); startDrill(); }
  else if(ns==='interval'){ setMode('ear'); startEar('interval'); }
  else if(ns==='chordq'){ setMode('ear'); startEar('chordq'); }
  else if(ns==='rhythm'){ setMode('ear'); startEar('rhythm'); }
}
['practice-progress','ear-progress'].forEach(id=>{ const h=document.getElementById(id);
  if(h) h.addEventListener('click', e=>{ const b=e.target.closest('[data-review]'); if(b) startReview(b.dataset.review); }); });
document.getElementById('tb-lefty').onclick=function(){ lefty=!lefty; this.classList.toggle('active',lefty); this.setAttribute('aria-pressed',lefty); renderAllBoards(); renderCircle(); saveState(); };
/* the metronome / loop / sequencer clocks read beat() live, so the tempo glides
   without restarting — just update the value and the label here. */
document.getElementById('tb-tempo').oninput=function(){ tempo=+this.value; document.getElementById('tb-bpm').textContent=tempo+' BPM'; };
document.getElementById('tb-tempo').onchange=function(){ saveState(); };
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
  }).join('');
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
function showWelcome(){ const o=document.getElementById('welcome-overlay'); if(!o) return; o.hidden=false; o.classList.add('open'); const g=document.getElementById('wc-got'); if(g) try{ g.focus(); }catch(_){} }
function dismissWelcome(){ const o=document.getElementById('welcome-overlay'); if(!o||o.hidden) return; o.classList.remove('open'); o.hidden=true; welcomeSeen=true; saveState(); }
{ const g=document.getElementById('wc-got');   if(g) g.onclick=dismissWelcome;
  const c=document.getElementById('wc-close'); if(c) c.onclick=dismissWelcome;
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
  if(!document.getElementById('cl-overlay').hidden || !document.getElementById('kbd-overlay').hidden) return;  // modal open
  const k=e.key;
  if(k===' '||k==='Spacebar'){
    if(tg && tg.closest && tg.closest('button,a,[role="button"],[tabindex]')) return;   // let the focused control keep Space
    e.preventDefault();
    if(typeof seqClock!=='undefined' && seqClock) seqStop();
    else if(typeof loopClock!=='undefined' && loopClock) stopLoop();
    else globalPlay();
    return;
  }
  if(k==='?'){ e.preventDefault(); openKbd(); return; }
  if(k==='1'){ setMode('reference'); selectTab('harmony'); return; }   // 1/2/3 also exit Practice
  if(k==='2'){ setMode('reference'); selectTab('scales'); return; }
  if(k==='3'){ setMode('reference'); selectTab('circle'); return; }
  if(k==='['){ transposeKey(-1); return; }
  if(k===']'){ transposeKey(1); return; }
  const lk = k.length===1 ? k.toLowerCase() : '';
  if(lk==='l'){ const lp=document.getElementById('g-loop'); if(lp && !lp.hidden && !lp.disabled) loopToggle(); return; }
  if(lk==='m'){ const mb=document.getElementById('tb-metro'); if(mb && !mb.disabled) metroToggle(); return; }
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
syncTabsScroll();
markScrollables();
// re-measure swipe-group overflow when the viewport changes (rotate / resize), and once
// the webfont has loaded — button widths shift on the font swap, so a measure taken with
// the fallback font would mis-detect overflow and show / hide the fade incorrectly.
window.addEventListener('resize', markScrollables);
try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(markScrollables); }catch(_){}
applyAudioAvailability();
applyA11y();   // apply restored accessibility prefs (palette / shapes) on load
applyCal();    // reflect the restored timing-calibration offset in the toolbar
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
    // timing calibration (Phase 3 debt)
    calcLatencyOffset, calOffsetSec, setCalMs, getCalMs:()=>calMs, CAL_MIN, CAL_MAX, CAL_TAPS,
    calStart, calTap, calFinish, calCancel, getCal:()=>cal,
    // learner review + activity (spine #3)
    learnerReview, learnerActivity, startReview,
    // shareable deep links (Phase 9)
    encodeShareState, applyShareHash, shareURL,
    selectTab, setMode, setHView, setScView, isBoardMode, loopToggle, seqPlay, seqAddCurrent, applyPreset, setChord,
    renderAllBoards,
    // learner model (spine #3, 3b)
    recordAttempt, dueItems, recordSession, learnerStats, srsInterval, normalizeLearner,
    getLearner:()=>learner, resetLearner:()=>{ learner=newLearner(); }, LEARNER_V,
    // note-naming drill (3c)
    startDrill, drillAnswer, drillTargetsFor, exitDrill, DRILL_LEN, getDrill:()=>drill,
    // ear-training drills (Phase 4)
    startEar, earAnswer, earNext, earReplay, exitEar, getEar:()=>ear,
    earChoices:()=>(ear?ear.cfg.choices(ear.cur):[]), INTERVALS, EAR_QUAL_IDX, RHYTHMS,
    // chord-change fluency drill (Phase 5a)
    startChanges, cmBegin, cmTap, cmUntap, finishChanges, exitChanges, getCm:()=>cmDrill,
    CM_PAIRS, CM_DURS, cmPairId, cmPairBest,
    setCmPair:(i)=>{ cmPairIdx=i; if(cmDrill) cmDrill.pairIdx=i; }, setCmDur:(i)=>{ cmDurIdx=i; if(cmDrill) cmDrill.dur=CM_DURS[i]; },
    // strumming-pattern trainer (Phase 5b)
    startStrum, spPlay, spStop, spToggle, exitStrum, getSp:()=>spDrill,
    STRUM_PATTERNS, setSpPattern:(i)=>{ spIdx=i; if(spDrill) spDrill.patIdx=i; },
    // comp-the-progression drill (Phase 5c)
    startComp, compPlay, compStop, compToggle, exitComp, getCo:()=>coDrill,
    compBuildBars, setCompProg:(i)=>{ coIdx=i; if(coDrill){ coDrill.presetIdx=i; coDrill.bars=compBuildBars(SEQ_PRESETS[i]); } },
    // groove & feel drill (Phase 5d)
    startGroove, groovePlay, grooveStop, grooveToggle, exitGroove, getGf:()=>gfDrill,
    GF_SWINGS, setGfSwing:(i)=>{ gfSwing=i; }, setGfAccent:(v)=>{ gfAccent=!!v; }, setGfMute:(v)=>{ gfMute=!!v; },
    // chord-tone targeting drill (Phase 6a)
    startTarget, targetPlay, targetStop, targetToggle, targetAnswer, exitTarget, getTg:()=>tgDrill,
    tgBuildBars, tgAccuracy, setTargetProg:(i)=>{ tgIdx=i; if(tgDrill){ tgDrill.presetIdx=i; tgDrill.bars=tgBuildBars(SEQ_PRESETS[i]); } },
    setTargetPos:(i)=>{ tgPos=i; if(tgDrill) tgDrill.win = i ? boxWindow(i) : null; },
    setTargetDeg:(i)=>{ tgDeg=i; if(tgDrill){ const c=tgDrill.bars[tgDrill.bar]; if(c) tgSetTargets(c); } },
    CAGED_BY_POS, isCAGEDScale,
    setFret:(i)=>{ fretRangeIdx=i; },
    setCapo:(i)=>{ capo=i; }, getCapo:()=>capo,
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
