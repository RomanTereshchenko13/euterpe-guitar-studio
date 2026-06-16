/* ===================== WIRING ===================== */
/* ---- shared root picker, display mode, sub-view toggle, global play ---- */
/* Each render fn paints panel content for its mode and the ONE shared board only
   when its mode is active (isBoardMode), so a cross-view pass paints the board once. */
function renderContextViews(){ renderChords(); renderTriads(); renderIdentify(); renderScales(); renderNotes(); }
function renderActiveContext(){
  if(currentTab==='harmony'){ (hView==='identify'?renderIdentify:hView==='triads'?renderTriads:renderChords)(); }
  else if(currentTab==='scales'){ scView==='notes'?renderNotes():renderScales(); }
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
  ntRoot=lbl;                                   // Notes reflects the shared root
  activateRoot(document.getElementById('g-roots'), gRoot);
  document.querySelectorAll('[data-root]').forEach(b=>b.classList.toggle('active', b.dataset.root===ntRoot));
  buildChQuals(); buildScSelect(); buildScPos();
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
  document.getElementById('sub-identify').hidden = v!=='identify';
  ['chords','triads','identify'].forEach(k=>{ const b=document.getElementById('hv-'+k); b.classList.toggle('active', k===v); b.setAttribute('aria-pressed', k===v?'true':'false'); });
  const head = v==='identify'?'id':(v==='triads'?'tr':'ch');
  document.getElementById('harmony-h').textContent = t(head+'_h');
  document.getElementById('harmony-p').textContent = t(head+'_p');
  applyHarmonyExtras();
  (v==='identify'?renderIdentify:v==='triads'?renderTriads:renderChords)();
  updateGlobalPlay(); saveState();
}
document.getElementById('hv-chords').onclick=()=>setHView('chords');
document.getElementById('hv-triads').onclick=()=>setHView('triads');
document.getElementById('hv-identify').onclick=()=>setHView('identify');

/* Scales-tab sub-view (1b): Scale | Notes — mirrors the Harmony Chords/Triads
   toggle. The folded-in Notes mode reuses the shared board + the context root. */
function setScView(v){ scView=v;
  document.getElementById('sub-scale').hidden = v!=='scale';
  document.getElementById('sub-notes').hidden = v!=='notes';
  ['scale','notes'].forEach(k=>{ const b=document.getElementById('sv-'+k); b.classList.toggle('active', k===v); b.setAttribute('aria-pressed', k===v?'true':'false'); });
  document.getElementById('scales-h').textContent = t(v==='notes'?'nt_h':'sc_h');
  document.getElementById('scales-p').textContent = t(v==='notes'?'nt_p':'sc_p');
  v==='notes'?renderNotes():renderScales();
  updateGlobalPlay(); saveState();
}
document.getElementById('sv-scale').onclick=()=>setScView('scale');
document.getElementById('sv-notes').onclick=()=>setScView('notes');

function applyContextBar(){ document.getElementById('context-bar').hidden = !(currentTab==='harmony' || currentTab==='scales'); }
function applyBoardRegion(){ document.getElementById('board-region').hidden = !(currentTab==='harmony' || currentTab==='scales'); }
/* voicing cards + sequencer (now below the board) belong only to Harmony's
   chord-tones view; hide them everywhere else so the board stays the last thing. */
function applyHarmonyExtras(){ const el=document.getElementById('harmony-extras'); if(el) el.hidden = !(currentTab==='harmony' && hView==='chords'); }
function globalPlay(){
  const boardEl=document.getElementById('board');
  if(currentTab==='harmony'){
    if(hView==='triads'){ const v=currentTriadVoicing(); animArpMidi(boardEl, v.midis); }
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
    lp.hidden = !(currentTab==='harmony' && hView!=='identify');
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

(function(){ const mk=(arr,cont)=>arr.forEach(n=>{ const b=document.createElement('button'); b.className='btn'; b.textContent=n; b.dataset.root=n; cont.appendChild(b); }); mk(NAT,document.getElementById('nt-natural')); mk(SHARP,document.getElementById('nt-sharp')); mk(FLAT,document.getElementById('nt-flat')); })();
document.getElementById('nt-all').onclick=function(){ntFilter='all';this.classList.add('active');this.setAttribute('aria-pressed','true');const o=document.getElementById('nt-nat');o.classList.remove('active');o.setAttribute('aria-pressed','false');renderNotes();saveState();};
document.getElementById('nt-nat').onclick=function(){ntFilter='nat';this.classList.add('active');this.setAttribute('aria-pressed','true');const o=document.getElementById('nt-all');o.classList.remove('active');o.setAttribute('aria-pressed','false');renderNotes();saveState();};
document.getElementById('nt-reset').onclick=function(){ntRoot='';document.querySelectorAll('[data-root]').forEach(b=>b.classList.remove('active'));renderNotes();saveState();};
document.getElementById('sub-notes').addEventListener('click',e=>{
  const b=e.target.closest('[data-root]'); if(!b) return; const n=b.dataset.root;
  document.querySelectorAll('[data-root]').forEach(x=>x.classList.remove('active'));
  if(n===ntRoot){ ntRoot=''; } else { ntRoot=n; b.classList.add('active'); }
  renderNotes(); saveState();
});

document.getElementById('aside-toggle').onclick=function(){ const b=document.getElementById('aside-body'); const hidden=b.style.display==='none'; b.style.display=hidden?'block':'none'; this.textContent=hidden?'−':'+'; this.setAttribute('aria-expanded', hidden); };

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

/* ---- changelog modal ---- */
function renderChangelog(){
  const body=document.getElementById('cl-body'); if(!body) return;
  body.innerHTML = CHANGELOG.map((r,i)=>{
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
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeChangelog(); });

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
if(!hadState && typeof window!=='undefined' && window.innerWidth<=600) fretRangeIdx=1;  // phones default to a 5-fret window
applyTuning();
applyLang();
selectTab(currentTab);
syncTabsScroll();
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
    identifyChord, nearChords, scalesOverChord, currentHarmonyChord, renderIdentify,
    setIdSel:(arr)=>{ idSel=arr.slice(); },
    chordVoicings, voicingMidi, currentChordVoicing, currentTriadVoicing, STD_LOW6_MIDI, TRI_TO_QUAL,
    cellW, boardWidth, leftFixed, FRET_LO, FRET_HI,
    schedAdvance, clocks, beat,
    selectTab, setHView, setScView, isBoardMode, loopToggle, seqPlay, seqAddCurrent, applyPreset, setChord,
    setFret:(i)=>{ fretRangeIdx=i; },
    setChQual:(i)=>{ chQual=i; chVoicing=0; }, setChVoicing:(i)=>{ chVoicing=i; },
    setTriad:(q,set,inv)=>{ trQual=q; trSet=set; trInv=inv; },
    initAudio:()=>audio(),
    setCtxNow:(t)=>{ if(actx) actx.currentTime=t; },
    state:()=>({ gRoot, gRootLbl, scIdx, scView, chQual, chVoicing, currentTab, hView,
                 loop:!!loopClock, loopMode, seq:!!seqClock, fretRangeIdx, lang, tempo })
  };
}
