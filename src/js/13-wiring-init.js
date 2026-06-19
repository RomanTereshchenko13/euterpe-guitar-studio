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
document.getElementById('tabs').addEventListener('scroll', syncTabsScroll, {passive:true});
document.getElementById('lang-switch').addEventListener('click',e=>{
  const b=e.target.closest('.langbtn'); if(!b||b.dataset.lang===lang) return;
  lang=b.dataset.lang; applyLang(); saveState();
});

/* ---- toolbar wiring ---- */
document.getElementById('tb-tuning').onchange=function(){ tuningIdx=+this.value; applyTuning(); renderAllBoards(); saveState(); };
document.getElementById('tb-frets').onchange=function(){ fretRangeIdx=+this.value; renderAllBoards(); saveState(); };
{ const cp=document.getElementById('tb-capo'); if(cp) cp.onchange=function(){ capo=+this.value; renderAllBoards(); saveState(); }; }
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
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeChangelog(); closeKbd(); } });

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
  if(k==='1'){ selectTab('harmony'); return; }
  if(k==='2'){ selectTab('scales'); return; }
  if(k==='3'){ selectTab('circle'); return; }
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
syncTabsScroll();
markScrollables();
// re-measure swipe-group overflow when the viewport changes (rotate / resize), and once
// the webfont has loaded — button widths shift on the font swap, so a measure taken with
// the fallback font would mis-detect overflow and show / hide the fade incorrectly.
window.addEventListener('resize', markScrollables);
try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(markScrollables); }catch(_){}
applyAudioAvailability();
document.getElementById('app-ver').textContent = 'v' + APP_VERSION;

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
    selectTab, setHView, setScView, isBoardMode, loopToggle, seqPlay, seqAddCurrent, applyPreset, setChord,
    renderAllBoards,
    CAGED_BY_POS, isCAGEDScale,
    setFret:(i)=>{ fretRangeIdx=i; },
    setCapo:(i)=>{ capo=i; }, getCapo:()=>capo,
    setChQual:(i)=>{ chQual=i; chVoicing=0; }, setChVoicing:(i)=>{ chVoicing=i; },
    setTriad:(q,set,inv)=>{ trQual=q; trSet=set; trInv=inv; },
    initAudio:()=>audio(),
    setCtxNow:(t)=>{ if(actx) actx.currentTime=t; },
    state:()=>({ gRoot, gRootLbl, scIdx, scView, chQual, chVoicing, currentTab, hView,
                 loop:!!loopClock, loopMode, seq:!!seqClock, fretRangeIdx, lang, tempo })
  };
}
