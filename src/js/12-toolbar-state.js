/* ===================== TOOLBAR + PERSISTENCE ===================== */
function buildToolbar(){
  const tun=document.getElementById('tb-tuning');
  tun.innerHTML=TUNINGS.map((tu,i)=>`<option value="${i}"${i===tuningIdx?' selected':''}>${lang==='en'?tu.en:tu.uk}</option>`).join('');
  const fr=document.getElementById('tb-frets');
  fr.innerHTML=FRET_RANGES.map((r,i)=>`<option value="${i}"${i===fretRangeIdx?' selected':''}>${r.key?t(r.key):r.label}</option>`).join('');
  const cp=document.getElementById('tb-capo');
  if(cp) cp.innerHTML=Array.from({length:8},(_,i)=>`<option value="${i}"${i===capo?' selected':''}>${i===0?t('capo_off'):i}</option>`).join('');
  const mt=document.getElementById('tb-meter');
  if(mt) mt.innerHTML=METERS.map((m,i)=>`<option value="${i}"${i===meterIdx?' selected':''}>${m.id}</option>`).join('');
  buildCustomTuning(); applyCustomTuningVis();
  const tp=document.getElementById('tb-tempo'); tp.value=tempo;
  document.getElementById('tb-bpm').textContent=tempo+' BPM';
  const vol=document.getElementById('tb-vol'); if(vol) vol.value=Math.round(masterVol*100);
  const vv=document.getElementById('tb-vol-val'); if(vv) vv.textContent=Math.round(masterVol*100)+'%';
  buildTuner();
  const lb=document.getElementById('tb-lefty'); lb.classList.toggle('active', lefty); lb.setAttribute('aria-pressed', lefty);
  applyA11y();   // keep the accessibility toggles in sync after a rebuild (e.g. language switch)
  applyToolbarState();
}
/* ---- tempo: one setter, every readout ----
   `tempo` is one global that two controls display — the header slider and the drill
   strip's stepper — so it needs one place that clamps it and repaints both. Before
   this the timing drill kept a private copy of exactly this function, which is how the
   app ended up with two tempo controls that each knew how to sync the other. Callers
   pass BPM; the clamp mirrors the slider's own min/max so the stepper can't walk past
   what the slider allows. Returns nothing — read `tempo`. */
function setTempo(bpm){
  tempo = Math.max(40, Math.min(200, Math.round(bpm)));
  const r=document.getElementById('tb-tempo');  if(r) r.value=tempo;
  const b=document.getElementById('tb-bpm');    if(b) b.textContent=tempo+' BPM';
  const d=document.getElementById('drill-ctx-bpm'); if(d) d.textContent=tempo+' BPM';
}

function applyToolbarState(){
  const tb=document.getElementById('toolbar'), tg=document.getElementById('tb-toggle');
  tb.classList.toggle('collapsed', !toolbarOpen);
  tg.classList.toggle('open', toolbarOpen);
  tg.setAttribute('aria-expanded', toolbarOpen);
}
/* custom tuning: six per-string note selects (high → low, matching the
   board's top-to-bottom string order), shown only when the Custom tuning is picked.
   Each option is a MIDI pitch labelled note+octave; the board/highlight math is
   already tuning-driven, so changing one rebuilds customTuning and re-applies. */
function midiLabel(m){ return NOTES[mod(m,12)].replace('#','♯') + (Math.floor(m/12)-1); }
function buildCustomTuning(){
  const host=document.getElementById('tb-custom-strings'); if(!host) return;
  host.innerHTML = customTuning.map((m,i)=>{
    let opts='';
    for(let v=TUNE_HI; v>=TUNE_LO; v--) opts += `<option value="${v}"${v===m?' selected':''}>${midiLabel(v)}</option>`;
    return `<select class="custom-str" data-i="${i}" aria-label="string ${i+1}">${opts}</select>`;
  }).join('');
}
function applyCustomTuningVis(){ const g=document.getElementById('tb-custom'); if(g) g.hidden = !TUNINGS[tuningIdx].custom; }
function applyBackingPanel(){
  const p=document.getElementById('backing-panel'), tg=document.getElementById('backing-toggle');
  if(p) p.classList.toggle('collapsed', !backingOpen);
  if(tg){ tg.classList.toggle('open', backingOpen); tg.setAttribute('aria-expanded', backingOpen); }
}
/* collapsible chord-shape card in the right rail; mirrors the suggester's inline
   show/hide but its open/closed state is persisted (shapesOpen) */
function applyShapesPanel(){
  const body=document.getElementById('shapes-body'), tg=document.getElementById('shapes-toggle');
  if(body) body.style.display = shapesOpen ? '' : 'none';
  if(tg){ tg.textContent = shapesOpen ? '−' : '+'; tg.setAttribute('aria-expanded', shapesOpen); }
}
function applyAsideState(){
  const show = ASIDE_TABS.includes(currentTab);
  const aside=document.querySelector('.aside');
  if(aside) aside.style.display = show ? '' : 'none';
  // drop the reserved suggester column on tabs that don't use it (1e), so the
  // board + controls take the full width instead of leaving a 234px gap
  const layout=document.querySelector('.layout'); if(layout) layout.classList.toggle('no-aside', !show);
}
/* Repaint every board-bearing view after a tuning / fret-range / capo / lefty
   change. Delegates to renderContextViews — the ONE complete fan-out — so a
   newly-added view can never be left off this list. */
function renderAllBoards(){ renderContextViews(); }
/* A2: syncTabsScroll() lived here — it faded the right edge of the mobile tab
   strip while more tabs sat off-screen. The strip is gone: at that width the nav is
   a fixed 4-item bottom bar with nothing to scroll. */
/* re-fit responsive fret cells when the viewport width changes (rotation/resize) */
if(typeof window!=='undefined'){
  let _rzT=null, _rzW=window.innerWidth;
  window.addEventListener('resize', ()=>{
    if(window.innerWidth===_rzW) return;          // ignore height-only changes (mobile URL bar)
    _rzW=window.innerWidth;
    clearTimeout(_rzT); _rzT=setTimeout(()=>{ renderAllBoards(); renderCircle&&renderCircle(); }, 150);
  });
}

/* Timestamp of the last header condense/expand. The magnetic neck (below) reads it so it
   doesn't fire its own scroll nudge while the header is still animating between sizes —
   otherwise that nudge lands ~110ms after a condense as a second, separate little jump. */
let _hdrToggleAt=0;

/* magnetic neck (mobile shell): the board is sticky in the single-column layout.
   When a scroll comes to rest with the neck just *barely* unpinned — its top only a
   few px below the pin line — gently settle it back into the pinned position, so a
   small scroll doesn't drop it (it "unpins too easily" otherwise). Acts only within a
   narrow band, so a deliberate scroll up to the controls is never trapped. */
if(typeof window!=='undefined'){
  let _magT=null;
  const magnetNeck=()=>{
    if(window.innerWidth>940 || window.innerHeight<=500) return;   // portrait single-column only (landscape un-pins the neck, see CSS)
    if(Date.now()-_hdrToggleAt < 400) return;                  // don't nudge over a header condense/expand transition
    const br=document.getElementById('board-region');
    if(!br || br.hidden) return;
    const pin=parseFloat(getComputedStyle(br).top)||0;         // sticky offset (0, or the safe-area inset in a PWA)
    const d=br.getBoundingClientRect().top - pin;              // how far the neck top sits below the pin line
    if(d>1 && d<=64) window.scrollBy({top:d, left:0, behavior:'smooth'});
  };
  window.addEventListener('scroll', ()=>{ clearTimeout(_magT); _magT=setTimeout(magnetNeck, 110); }, {passive:true});
}

/* condensing sticky header (mobile shell): once you scroll past the brand the header
   slims (CSS .scrolled, ≤940 only) so tabs + transport stay reachable. The sticky board
   pins directly below it, so we keep --hdr-h in sync with the live header height — and as
   the header *animates* between sizes the ResizeObserver fires every frame, so the pinned
   board tracks it smoothly instead of snapping. */
if(typeof window!=='undefined'){
  const hdr=document.querySelector('header');
  // A bottom spacer holds the *total document height constant* as the header condenses. This
  // is what finally kills the "loops between two states in one spot" jitter: the header is
  // position:sticky, so shrinking it shortens the page, and near the page bottom that clamps
  // the scroll position — and because the header now animates, the clamp drags scrollY back
  // across the trigger every frame, sustaining a condense/expand loop a dead-band can't outrun
  // (the height delta is far larger than any sane band). Backfilling exactly the height the
  // header gives up means the scroll range never moves, so a toggle can't reposition the scroll
  // under itself, and the trigger only ever fires from a real, deliberate scroll.
  let spacer=null, baseH=0;
  if(hdr){
    spacer=document.createElement('div');
    spacer.setAttribute('aria-hidden','true');
    spacer.style.cssText='width:100%;height:0;pointer-events:none;';
    document.body.appendChild(spacer);
  }
  const setHdrH=(h)=>{
    if(!hdr) return;
    if(h==null) h=hdr.offsetHeight;                                  // explicit calls (init/resize); the per-frame path passes the size in
    document.documentElement.style.setProperty('--hdr-h', h+'px');   // sticky board offsets below the live header height
    if(spacer) spacer.style.height=Math.max(0, baseH-h)+'px';        // backfill the condensed delta → constant page height
  };
  // Two sentinels at fixed document offsets give a hysteresis dead-band (condense past ~64px,
  // expand only back under ~16px) so a tiny scroll near the line can't flap the state. They are
  // anchored to the document, not window.scrollY, so the header resizing never moves the trigger.
  // baseH (the full, expanded height) is captured at the instant we condense, while the header
  // is still static — never mid-animation — so the spacer always backfills against the real
  // expanded size rather than a transitional one.
  if(hdr && typeof IntersectionObserver!=='undefined'){
    const mk=h=>{ const s=document.createElement('div'); s.setAttribute('aria-hidden','true');
      s.style.cssText='position:absolute;top:0;left:0;width:1px;height:'+h+'px;pointer-events:none;';
      document.body.appendChild(s); return s; };
    new IntersectionObserver(es=>{ if(!es[0].isIntersecting && !hdr.classList.contains('scrolled') && window.innerHeight>500){
      baseH=hdr.offsetHeight; hdr.classList.add('scrolled'); _hdrToggleAt=Date.now(); setHdrH();   // capture expanded height, then condense (portrait only — landscape header scrolls away static)
    } }, {threshold:0}).observe(mk(64));
    new IntersectionObserver(es=>{ if(es[0].isIntersecting && hdr.classList.contains('scrolled')){
      hdr.classList.remove('scrolled'); _hdrToggleAt=Date.now();
    } }, {threshold:0}).observe(mk(16));
  }
  window.addEventListener('resize', ()=>{
    // Rotating into a short (landscape) viewport: drop any condensed state so the now-static
    // header expands back and the spacer resets to 0 — otherwise a condense from portrait would
    // leave a phantom bottom gap (the spacer backfill no longer has a sticky header to offset).
    if(window.innerHeight<=500 && hdr && hdr.classList.contains('scrolled')){ hdr.classList.remove('scrolled'); _hdrToggleAt=Date.now(); }
    setHdrH();
  });
  // Use the entry's reported size rather than reading offsetHeight — the latter forces a
  // synchronous reflow on every animation frame as the header condenses (mobile jank); the
  // entry already carries the new size, so the per-frame path stays layout-thrash-free.
  if(typeof ResizeObserver!=='undefined' && hdr) new ResizeObserver(es=>{
    const box=es[0].borderBoxSize && es[0].borderBoxSize[0];
    setHdrH(box ? box.blockSize : undefined);
  }).observe(hdr);
  if(hdr) baseH=hdr.offsetHeight;   // expanded height at load (until the first condense recaptures it)
  setHdrH();
}

const LS_KEY='guitarStudio.v1';
let currentTab='harmony';
// the primary navigation axis (mode), orthogonal to currentTab. Reference
// nests Harmony/Scales/Circle; Practice is its own surface. Defaults to reference so
// older saves (no `mode`) and the existing reference behaviour are untouched.
let currentMode='reference';
/* The one list of what is saved. Export (13-backup.js) reads the same snapshot, so a
   backup file can't drift from what the browser actually keeps. */
function snapshotState(){ return {
  lang, mode:currentMode, tab:currentTab, tuningIdx, customTuning, fretRangeIdx, tempo, meterIdx, masterVol, lefty, toolbarOpen, backingOpen, shapesOpen, capo,
  cbPalette, fnShapes, welcomeSeen,
  gRoot, gRootLbl, gMode, hView, scView,
  chQual, arpPos, scIdx, scPos, scOverlay,
  chVoicing, chTriads,
  trSet, trInv,
  ntRoot, ntFilter,
  seq, seqLoopOn,
  bassOn, grooveOn,
  calMs, calKnown,   // round-trip latency + whether it was ever established
  drillSeen,         // tracks already run once — drives the first-run hint reveal
  sessMins,          // how long your practice session usually is
  learner   // spine #3: learner model (13-learner.js); saved verbatim, restored via normalizeLearner
}; }
/* Set by an import just before it reloads: the in-memory state is the OLD progress, and
   any save between the write and the reload would put it straight back. */
let saveBlocked=false;
function saveState(){ if(saveBlocked) return;
  try{ localStorage.setItem(LS_KEY, JSON.stringify(snapshotState())); }
  catch(e){ devWarn('state could not be saved (localStorage unavailable?)', e); saveFailed(); } }
function loadState(){ try{
  const s=JSON.parse(localStorage.getItem(LS_KEY)||'null'); if(!s) return false;
  if(s.lang==='uk'||s.lang==='en') lang=s.lang;
  // mode axis — default reference. The old 'ear' mode folded into Practice,
  // so an older save that pinned it lands on Practice rather than falling back to
  // Reference: the ear drills are still right there, one group down.
  if(s.mode==='practice'||s.mode==='ear') currentMode='practice';
  else if(s.mode==='reference') currentMode='reference';
  if(Number.isInteger(s.tuningIdx)&&TUNINGS[s.tuningIdx]) tuningIdx=s.tuningIdx;
  if(Array.isArray(s.customTuning)&&s.customTuning.length===6&&s.customTuning.every(m=>Number.isInteger(m)&&m>=TUNE_LO&&m<=TUNE_HI)) customTuning=s.customTuning.slice();
  if(Number.isInteger(s.fretRangeIdx)&&FRET_RANGES[s.fretRangeIdx]) fretRangeIdx=s.fretRangeIdx;
  if(Number.isInteger(s.capo)&&s.capo>=0&&s.capo<=11) capo=s.capo;
  if(typeof s.tempo==='number'&&s.tempo>=40&&s.tempo<=200) tempo=s.tempo;
  if(Number.isInteger(s.meterIdx)&&METERS[s.meterIdx]) meterIdx=s.meterIdx;   // 7b time signature
  if(typeof s.masterVol==='number'&&s.masterVol>=0&&s.masterVol<=1) masterVol=s.masterVol;
  // F1 round-trip latency. Bounded by the same ceiling the measurement itself
  // rejects above, so a hand-edited or corrupted save can't skew every timing score.
  if(typeof s.calMs==='number'&&s.calMs>=0&&s.calMs<=CAL_MAX_MS) calMs=s.calMs;
  // A save predating the flag but carrying a non-zero latency was measured by the
  // old build — grandfather it in rather than re-prompt someone already calibrated.
  calKnown = (typeof s.calKnown==='boolean') ? s.calKnown : (calMs>0);
  if(typeof s.lefty==='boolean') lefty=s.lefty;
  if(typeof s.toolbarOpen==='boolean') toolbarOpen=s.toolbarOpen;
  if(typeof s.backingOpen==='boolean') backingOpen=s.backingOpen;
  if(typeof s.shapesOpen==='boolean') shapesOpen=s.shapesOpen;
  if(typeof s.cbPalette==='boolean') cbPalette=s.cbPalette;
  if(typeof s.fnShapes==='boolean') fnShapes=s.fnShapes;
  // grandfather existing users: a save with no welcomeSeen field is a returning
  // visitor (predates onboarding), so don't pop the welcome at them — only a
  // genuinely first visit (no saved state at all) leaves welcomeSeen false.
  welcomeSeen = (typeof s.welcomeSeen==='boolean') ? s.welcomeSeen : true;
  /* Which drills the player has already met (B2). Rebuilt key-by-key rather than
     assigned, so a tampered or stale blob can't put a non-track key in front of the
     hint logic — and bounded for the same reason the learner model's tables are. */
  if(s.drillSeen && typeof s.drillSeen==='object' && !Array.isArray(s.drillSeen)){
    const out={}; let n=0;
    for(const k of Object.keys(s.drillSeen)){
      if(typeof k!=='string' || !k.length || k.length>32 || ++n>64) continue;
      if(s.drillSeen[k]) out[k]=1;
    }
    drillSeen=out;
  }
  // B3: the session length you last chose, restored only if it is still one we offer
  if(typeof SESSION_MINS!=='undefined' && SESSION_MINS.indexOf(s.sessMins)>=0) sessMins=s.sessMins;
  if(Number.isInteger(s.gRoot)&&s.gRoot>=0&&s.gRoot<12){ gRoot=s.gRoot; if(typeof s.gRootLbl==='string') gRootLbl=s.gRootLbl; }
  if(s.gMode==='names'||s.gMode==='deg') gMode=s.gMode;
  if(s.hView==='chords'||s.hView==='arp') hView=s.hView;
  if(s.scView==='scale'||s.scView==='notes') scView=s.scView;
  if(typeof s.tab==='string'){
    if(s.tab==='chords'||s.tab==='triads') currentTab='harmony';          // migrate old merged tabs
    else if(s.tab==='notes'){ currentTab='scales'; scView='notes'; }      // 1b: Notes folded into Scales
    else currentTab=s.tab;
  }
  // ---- working musical state (added in 1.6.1) ----
  if(Number.isInteger(s.chQual)&&QUALITIES[s.chQual]) chQual=s.chQual;
  if(Number.isInteger(s.arpPos)&&s.arpPos>=0&&s.arpPos<=5) arpPos=s.arpPos;
  if(Number.isInteger(s.chVoicing)&&s.chVoicing>=0&&s.chVoicing<6) chVoicing=s.chVoicing;  // clamped again at render against the actual list length
  if(Number.isInteger(s.scIdx)&&SCALES[s.scIdx]) scIdx=s.scIdx;
  if(Number.isInteger(s.scPos)&&s.scPos>=0&&s.scPos<=5) scPos=s.scPos;
  if(s.scOverlay&&typeof s.scOverlay==='object'&&Number.isInteger(s.scOverlay.rootPc)&&Array.isArray(s.scOverlay.iv)&&typeof s.scOverlay.tag==='string')
    scOverlay={rootPc:mod(s.scOverlay.rootPc,12), iv:s.scOverlay.iv.slice(), tag:s.scOverlay.tag};
  if(Number.isInteger(s.trSet)&&STRING_SETS[s.trSet]) trSet=s.trSet;
  if(Number.isInteger(s.trInv)&&s.trInv>=0&&s.trInv<=3) trInv=s.trInv;
  if(typeof s.chTriads==='boolean') chTriads=s.chTriads;
  /* v2.17.0: Triads stopped being a view of its own and became a toggle on Chord
     tones, whose chord now picks the triad. A save that was looking at triads opens on
     Chord tones with triads on, on the triad quality it had picked (trQual). */
  if(s.hView==='triads' || s.tab==='triads'){
    hView='chords'; chTriads=true; chVoicing=0;
    if(Number.isInteger(s.trQual)&&TRIADS[s.trQual]) chQual=TRI_TO_QUAL[s.trQual];
  }
  // circle selection is no longer persisted — it is derived from the context
  // (gRoot + scIdx) at render time (1a). Older saves with cofSel/cofMinor are
  // simply ignored.
  if(s.ntFilter==='all'||s.ntFilter==='nat') ntFilter=s.ntFilter;
  if(s.ntRoot===''||NAT.includes(s.ntRoot)||SHARP.includes(s.ntRoot)||FLAT.includes(s.ntRoot)) ntRoot=s.ntRoot;
  learner = normalizeLearner(s.learner);   // spine #3: bounds-checked restore (garbage → fresh model)
  if(typeof s.seqLoopOn==='boolean') seqLoopOn=s.seqLoopOn;
  if(typeof s.bassOn==='boolean') bassOn=s.bassOn;
  if(typeof s.grooveOn==='boolean') grooveOn=s.grooveOn;
  if(Array.isArray(s.seq)){
    seq = s.seq
      .filter(st=>st&&Number.isInteger(st.pc)&&st.pc>=0&&st.pc<12&&Number.isInteger(st.qi)&&st.qi>=0&&st.qi<QUALITIES.length)
      .map(st=>({pc:st.pc, lbl:(typeof st.lbl==='string'?st.lbl:ROOTS[st.pc]), qi:st.qi, bars:([1,2,4].includes(st.bars)?st.bars:1)}));
  }
}catch(e){ devWarn('saved state could not be restored; using defaults', e); return false; } return true; }

/* ---- old share links ----
   Share links (#k=…&t=…) were cut in v2.17.0. An old link still opens the app: the
   hash is ignored and cleared, so it never pins or breaks anything. */
function clearOldShareHash(){
  if(typeof location==='undefined') return;
  const h=(location.hash||'').replace(/^#/, ''); if(!h) return;
  let p; try{ p=new URLSearchParams(h); }catch(_){ return; }
  if(!p.has('k') && !p.has('t') && !p.has('s')) return;   // not one of ours
  try{ history.replaceState(null, '', location.pathname+location.search); }catch(_){ /* ignore */ }
}
