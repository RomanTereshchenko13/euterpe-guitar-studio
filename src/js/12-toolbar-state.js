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
  applyA11y();   // keep the accessibility toggles in sync after a rebuild (language switch)
  applyToolbarState();
}
/* ---- tempo: one setter, every readout ----
   Two controls show `tempo` (the header slider and the drill header's stepper), so one
   place clamps it — to the slider's own range — and repaints both. */
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
/* custom tuning: six per-string selects (high → low, like the board), shown only for
   the Custom tuning; each option is a MIDI pitch labelled note + octave. */
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
/* the chord-shape card's open/closed state is persisted (shapesOpen) */
function applyShapesPanel(){
  const body=document.getElementById('shapes-body'), tg=document.getElementById('shapes-toggle');
  if(body) body.style.display = shapesOpen ? '' : 'none';
  if(tg){ tg.textContent = shapesOpen ? '−' : '+'; tg.setAttribute('aria-expanded', shapesOpen); }
}
function applyAsideState(){
  const show = ASIDE_TABS.includes(currentTab);
  const aside=document.querySelector('.aside');
  if(aside) aside.style.display = show ? '' : 'none';
  // drop the suggester column on tabs that don't use it, so the board takes the width
  const layout=document.querySelector('.layout'); if(layout) layout.classList.toggle('no-aside', !show);
}
/* Repaint every board-bearing view after a tuning / fret-range / capo / lefty change,
   via the ONE complete fan-out, so no view can be left off. */
function renderAllBoards(){ renderContextViews(); }
/* re-fit the fret cells when the viewport width changes */
if(typeof window!=='undefined'){
  let _rzT=null, _rzW=window.innerWidth;
  window.addEventListener('resize', ()=>{
    if(window.innerWidth===_rzW) return;          // ignore height-only changes (mobile URL bar)
    _rzW=window.innerWidth;
    clearTimeout(_rzT); _rzT=setTimeout(()=>{ renderAllBoards(); renderCircle&&renderCircle(); }, 150);
  });
}

/* When the header last condensed or expanded: the magnetic neck waits for that
   animation, or its own nudge lands as a second little jump. */
let _hdrToggleAt=0;

/* magnetic neck (phone portrait): when a scroll comes to rest with the sticky neck
   just barely unpinned, settle it back into place. Only within a narrow band, so a
   deliberate scroll up to the controls is never trapped. */
if(typeof window!=='undefined'){
  let _magT=null;
  const magnetNeck=()=>{
    if(window.innerWidth>940 || window.innerHeight<=500) return;   // portrait single-column only (landscape un-pins the neck)
    if(Date.now()-_hdrToggleAt < 400) return;                  // don't nudge over a header condense/expand transition
    const br=document.getElementById('board-region');
    if(!br || br.hidden) return;
    const pin=parseFloat(getComputedStyle(br).top)||0;         // sticky offset (0, or the safe-area inset in a PWA)
    const d=br.getBoundingClientRect().top - pin;              // how far the neck top sits below the pin line
    if(d>1 && d<=64) window.scrollBy({top:d, left:0, behavior:'smooth'});
  };
  window.addEventListener('scroll', ()=>{ clearTimeout(_magT); _magT=setTimeout(magnetNeck, 110); }, {passive:true});
}

/* condensing sticky header (phone): past the brand the header slims (.scrolled) so the
   nav stays reachable, and --hdr-h tracks its live height every frame so the board
   pinned below it follows smoothly. */
if(typeof window!=='undefined'){
  const hdr=document.querySelector('header');
  // A bottom spacer keeps the total page height constant as the header condenses.
  // Without it, shrinking the sticky header shortens the page; near the bottom that
  // clamps scrollY back across the trigger and the header flaps between states.
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
  // Two sentinels at fixed document offsets give hysteresis (condense past ~64px, expand
  // under ~16px), and resizing the header never moves them. baseH is captured at the
  // moment of condensing, while the header is still at its full height.
  if(hdr && typeof IntersectionObserver!=='undefined'){
    const mk=h=>{ const s=document.createElement('div'); s.setAttribute('aria-hidden','true');
      s.style.cssText='position:absolute;top:0;left:0;width:1px;height:'+h+'px;pointer-events:none;';
      document.body.appendChild(s); return s; };
    new IntersectionObserver(es=>{ if(!es[0].isIntersecting && !hdr.classList.contains('scrolled') && window.innerHeight>500){
      baseH=hdr.offsetHeight; hdr.classList.add('scrolled'); _hdrToggleAt=Date.now(); setHdrH();   // capture the expanded height, then condense (portrait only)
    } }, {threshold:0}).observe(mk(64));
    new IntersectionObserver(es=>{ if(es[0].isIntersecting && hdr.classList.contains('scrolled')){
      hdr.classList.remove('scrolled'); _hdrToggleAt=Date.now();
    } }, {threshold:0}).observe(mk(16));
  }
  window.addEventListener('resize', ()=>{
    // rotating into landscape: expand and reset the spacer, or a portrait condense would
    // leave a phantom gap at the bottom
    if(window.innerHeight<=500 && hdr && hdr.classList.contains('scrolled')){ hdr.classList.remove('scrolled'); _hdrToggleAt=Date.now(); }
    setHdrH();
  });
  // the entry's size, not offsetHeight: reading that would force a reflow every frame
  if(typeof ResizeObserver!=='undefined' && hdr) new ResizeObserver(es=>{
    const box=es[0].borderBoxSize && es[0].borderBoxSize[0];
    setHdrH(box ? box.blockSize : undefined);
  }).observe(hdr);
  if(hdr) baseH=hdr.offsetHeight;   // expanded height at load (recaptured on each condense)
  setHdrH();
}

const LS_KEY='guitarStudio.v1';
let currentTab='harmony';
// the mode axis, orthogonal to currentTab; a save with no `mode` opens on Reference
let currentMode='reference';
/* The one list of what is saved. Export (13-backup.js) reads the same snapshot, so a
   backup file can't drift from what the browser keeps. */
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
  calMs, calKnown,   // round-trip latency + whether it was ever measured
  drillSeen,         // tracks already run once — the first-run hint reveal
  sessMins,          // how long your practice session usually is
  learner   // learner model: saved verbatim, restored via normalizeLearner
}; }
/* Set by an import just before it reloads, so no save can put the old progress back. */
let saveBlocked=false;
function saveState(){ if(saveBlocked) return;
  try{ localStorage.setItem(LS_KEY, JSON.stringify(snapshotState())); }
  catch(e){ devWarn('state could not be saved (localStorage unavailable?)', e); saveFailed(); } }
function loadState(){ try{
  const s=JSON.parse(localStorage.getItem(LS_KEY)||'null'); if(!s) return false;
  if(s.lang==='uk'||s.lang==='en') lang=s.lang;
  // an old save pinned to the retired 'ear' mode opens on Practice, where the ear drills live
  if(s.mode==='practice'||s.mode==='ear') currentMode='practice';
  else if(s.mode==='reference') currentMode='reference';
  if(Number.isInteger(s.tuningIdx)&&TUNINGS[s.tuningIdx]) tuningIdx=s.tuningIdx;
  if(Array.isArray(s.customTuning)&&s.customTuning.length===6&&s.customTuning.every(m=>Number.isInteger(m)&&m>=TUNE_LO&&m<=TUNE_HI)) customTuning=s.customTuning.slice();
  if(Number.isInteger(s.fretRangeIdx)&&FRET_RANGES[s.fretRangeIdx]) fretRangeIdx=s.fretRangeIdx;
  if(Number.isInteger(s.capo)&&s.capo>=0&&s.capo<=11) capo=s.capo;
  if(typeof s.tempo==='number'&&s.tempo>=40&&s.tempo<=200) tempo=s.tempo;
  if(Number.isInteger(s.meterIdx)&&METERS[s.meterIdx]) meterIdx=s.meterIdx;
  if(typeof s.masterVol==='number'&&s.masterVol>=0&&s.masterVol<=1) masterVol=s.masterVol;
  // bounded by the measurement's own ceiling, so a corrupted save can't skew every score
  if(typeof s.calMs==='number'&&s.calMs>=0&&s.calMs<=CAL_MAX_MS) calMs=s.calMs;
  // a save from before calKnown with a real latency was measured: don't re-prompt it
  calKnown = (typeof s.calKnown==='boolean') ? s.calKnown : (calMs>0);
  if(typeof s.lefty==='boolean') lefty=s.lefty;
  if(typeof s.toolbarOpen==='boolean') toolbarOpen=s.toolbarOpen;
  if(typeof s.backingOpen==='boolean') backingOpen=s.backingOpen;
  if(typeof s.shapesOpen==='boolean') shapesOpen=s.shapesOpen;
  if(typeof s.cbPalette==='boolean') cbPalette=s.cbPalette;
  if(typeof s.fnShapes==='boolean') fnShapes=s.fnShapes;
  // a save with no welcomeSeen predates onboarding — a returning visitor, so no welcome
  welcomeSeen = (typeof s.welcomeSeen==='boolean') ? s.welcomeSeen : true;
  /* rebuilt key by key and bounded, so a tampered blob can't inject arbitrary keys */
  if(s.drillSeen && typeof s.drillSeen==='object' && !Array.isArray(s.drillSeen)){
    const out={}; let n=0;
    for(const k of Object.keys(s.drillSeen)){
      if(typeof k!=='string' || !k.length || k.length>32 || ++n>64) continue;
      if(s.drillSeen[k]) out[k]=1;
    }
    drillSeen=out;
  }
  // restored only if it is still a length we offer
  if(typeof SESSION_MINS!=='undefined' && SESSION_MINS.indexOf(s.sessMins)>=0) sessMins=s.sessMins;
  if(Number.isInteger(s.gRoot)&&s.gRoot>=0&&s.gRoot<12){ gRoot=s.gRoot; if(typeof s.gRootLbl==='string') gRootLbl=s.gRootLbl; }
  if(s.gMode==='names'||s.gMode==='deg') gMode=s.gMode;
  if(s.hView==='chords'||s.hView==='arp') hView=s.hView;
  if(s.scView==='scale'||s.scView==='notes') scView=s.scView;
  if(typeof s.tab==='string'){
    if(s.tab==='chords'||s.tab==='triads') currentTab='harmony';          // old Chords / Triads tabs merged into Harmony
    else if(s.tab==='notes'){ currentTab='scales'; scView='notes'; }      // Notes became a view of Scales
    else currentTab=s.tab;
  }
  // ---- working musical state ----
  if(Number.isInteger(s.chQual)&&QUALITIES[s.chQual]) chQual=s.chQual;
  if(Number.isInteger(s.arpPos)&&s.arpPos>=0&&s.arpPos<=5) arpPos=s.arpPos;
  if(Number.isInteger(s.chVoicing)&&s.chVoicing>=0&&s.chVoicing<6) chVoicing=s.chVoicing;  // clamped again at render against the real list length
  if(Number.isInteger(s.scIdx)&&SCALES[s.scIdx]) scIdx=s.scIdx;
  if(Number.isInteger(s.scPos)&&s.scPos>=0&&s.scPos<=5) scPos=s.scPos;
  if(s.scOverlay&&typeof s.scOverlay==='object'&&Number.isInteger(s.scOverlay.rootPc)&&Array.isArray(s.scOverlay.iv)&&typeof s.scOverlay.tag==='string')
    scOverlay={rootPc:mod(s.scOverlay.rootPc,12), iv:s.scOverlay.iv.slice(), tag:s.scOverlay.tag};
  if(Number.isInteger(s.trSet)&&STRING_SETS[s.trSet]) trSet=s.trSet;
  if(Number.isInteger(s.trInv)&&s.trInv>=0&&s.trInv<=3) trInv=s.trInv;
  if(typeof s.chTriads==='boolean') chTriads=s.chTriads;
  /* Triads became a toggle on Chord tones (v2.17.0): a save that was on the Triads view
     opens on Chord tones with triads on, on the triad it had picked (trQual). */
  if(s.hView==='triads' || s.tab==='triads'){
    hView='chords'; chTriads=true; chVoicing=0;
    if(Number.isInteger(s.trQual)&&TRIADS[s.trQual]) chQual=TRI_TO_QUAL[s.trQual];
  }
  // the circle's selection is derived from gRoot + scIdx; old cofSel/cofMinor are ignored
  if(s.ntFilter==='all'||s.ntFilter==='nat') ntFilter=s.ntFilter;
  if(s.ntRoot===''||NAT.includes(s.ntRoot)||SHARP.includes(s.ntRoot)||FLAT.includes(s.ntRoot)) ntRoot=s.ntRoot;
  learner = normalizeLearner(s.learner);   // bounds-checked restore (garbage → fresh model)
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
   Cut in v2.17.0. An old #k=…&t=… link still opens the app: the hash is ignored and
   cleared, so it never pins or breaks anything. */
function clearOldShareHash(){
  if(typeof location==='undefined') return;
  const h=(location.hash||'').replace(/^#/, ''); if(!h) return;
  let p; try{ p=new URLSearchParams(h); }catch(_){ return; }
  if(!p.has('k') && !p.has('t') && !p.has('s')) return;   // not one of ours
  try{ history.replaceState(null, '', location.pathname+location.search); }catch(_){ /* ignore */ }
}
