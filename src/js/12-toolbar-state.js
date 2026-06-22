/* ===================== TOOLBAR + PERSISTENCE ===================== */
function buildToolbar(){
  const tun=document.getElementById('tb-tuning');
  tun.innerHTML=TUNINGS.map((tu,i)=>`<option value="${i}"${i===tuningIdx?' selected':''}>${lang==='en'?tu.en:tu.uk}</option>`).join('');
  const fr=document.getElementById('tb-frets');
  fr.innerHTML=FRET_RANGES.map((r,i)=>`<option value="${i}"${i===fretRangeIdx?' selected':''}>${r.key?t(r.key):r.label}</option>`).join('');
  const cp=document.getElementById('tb-capo');
  if(cp) cp.innerHTML=Array.from({length:8},(_,i)=>`<option value="${i}"${i===capo?' selected':''}>${i===0?t('capo_off'):i}</option>`).join('');
  buildCustomTuning(); applyCustomTuningVis();
  const tp=document.getElementById('tb-tempo'); tp.value=tempo;
  document.getElementById('tb-bpm').textContent=tempo+' BPM';
  const vol=document.getElementById('tb-vol'); if(vol) vol.value=Math.round(masterVol*100);
  const vv=document.getElementById('tb-vol-val'); if(vv) vv.textContent=Math.round(masterVol*100)+'%';
  buildTuner();
  const lb=document.getElementById('tb-lefty'); lb.classList.toggle('active', lefty); lb.setAttribute('aria-pressed', lefty);
  if(typeof applyA11y==='function') applyA11y();   // keep the accessibility toggles in sync after a rebuild (e.g. language switch)
  applyToolbarState();
}
/* reference-tone tuner: one button per open string of the current tuning, low → high
   (E A D G B e in standard), each holding a sustained pitch (tunerTone). Rebuilt from
   the live OPEN_MIDI/SNAMES whenever the tuning changes (so a Drop-D switch re-labels). */
function buildTuner(){
  const ts=document.getElementById('tb-tuner-strings'); if(!ts) return;
  // OPEN_MIDI / SNAMES are stored high → low (string 1 first); reverse for the
  // conventional low-to-high reading order on the tuner.
  ts.innerHTML = OPEN_MIDI.map((m,i)=>({m, nm:SNAMES[i]})).reverse()
    .map(o=>`<button class="btn tuner-str" data-midi="${o.m}" aria-label="${o.nm}">${o.nm}</button>`).join('');
}
function applyToolbarState(){
  const tb=document.getElementById('toolbar'), tg=document.getElementById('tb-toggle');
  tb.classList.toggle('collapsed', !toolbarOpen);
  tg.classList.toggle('open', toolbarOpen);
  tg.setAttribute('aria-expanded', toolbarOpen);
}
/* custom tuning (Phase 2): six per-string note selects (high → low, matching the
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
   change. Delegates to renderContextViews — the ONE complete fan-out (incl. the
   arp + identify views) — so a newly-added view can never be left off this list.
   It previously listed only chords/triads/scales/notes, which silently froze the
   Arpeggio and Identify boards on a tuning/fret/capo/lefty change (they weren't
   re-rendered, so isBoardMode never re-painted the shared #board for them). */
function renderAllBoards(){ renderContextViews(); }
/* the mobile tab strip scrolls horizontally when its labels overflow (esp. in
   English); fade the right edge while more tabs sit off-screen — and drop the
   fade once scrolled to the end — so the cut-off tab reads as "more →", not
   clipped. Mirrors the fretboard's .scrollable hint. */
function syncTabsScroll(){
  const el=document.getElementById('tabs'); if(!el) return;
  const max=el.scrollWidth - el.clientWidth;
  el.classList.toggle('scrollable', max>1 && el.scrollLeft < max-1);
}
/* re-fit responsive fret cells when the viewport width changes (rotation/resize) */
if(typeof window!=='undefined'){
  let _rzT=null, _rzW=window.innerWidth;
  window.addEventListener('resize', ()=>{
    syncTabsScroll();
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
// Phase 3a: the primary navigation axis (mode), orthogonal to currentTab. Reference
// nests Harmony/Scales/Circle; Practice is its own surface. Defaults to reference so
// older saves (no `mode`) and the existing reference behaviour are untouched.
let currentMode='reference';
function saveState(){ try{ localStorage.setItem(LS_KEY, JSON.stringify({
  lang, mode:currentMode, tab:currentTab, tuningIdx, customTuning, fretRangeIdx, tempo, masterVol, lefty, toolbarOpen, backingOpen, shapesOpen, capo,
  calMs, cbPalette, fnShapes, welcomeSeen,
  gRoot, gRootLbl, gMode, hView, scView,
  chQual, arpPos, scIdx, scPos, scOverlay,
  chVoicing,
  trQual, trSet, trInv,
  ntRoot, ntFilter,
  seq, seqLoopOn,
  bassOn, grooveOn,
  learner   // spine #3: learner model (13-learner.js); saved verbatim, restored via normalizeLearner
})); }catch(e){ devWarn('state could not be saved (localStorage unavailable?)', e); } }
function loadState(){ try{
  const s=JSON.parse(localStorage.getItem(LS_KEY)||'null'); if(!s) return false;
  if(s.lang==='uk'||s.lang==='en') lang=s.lang;
  if(s.mode==='reference'||s.mode==='practice'||s.mode==='ear') currentMode=s.mode;   // mode axis (3a; Ear added in Phase 4) — default reference
  if(Number.isInteger(s.tuningIdx)&&TUNINGS[s.tuningIdx]) tuningIdx=s.tuningIdx;
  if(Array.isArray(s.customTuning)&&s.customTuning.length===6&&s.customTuning.every(m=>Number.isInteger(m)&&m>=TUNE_LO&&m<=TUNE_HI)) customTuning=s.customTuning.slice();
  if(typeof s.calMs==='number'&&isFinite(s.calMs)) calMs=clampCal(s.calMs);   // 05-audio bounds (CAL_MIN..CAL_MAX)
  if(Number.isInteger(s.fretRangeIdx)&&FRET_RANGES[s.fretRangeIdx]) fretRangeIdx=s.fretRangeIdx;
  if(Number.isInteger(s.capo)&&s.capo>=0&&s.capo<=11) capo=s.capo;
  if(typeof s.tempo==='number'&&s.tempo>=40&&s.tempo<=200) tempo=s.tempo;
  if(typeof s.masterVol==='number'&&s.masterVol>=0&&s.masterVol<=1) masterVol=s.masterVol;
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
  if(Number.isInteger(s.gRoot)&&s.gRoot>=0&&s.gRoot<12){ gRoot=s.gRoot; if(typeof s.gRootLbl==='string') gRootLbl=s.gRootLbl; }
  if(s.gMode==='names'||s.gMode==='deg') gMode=s.gMode;
  if(s.hView==='chords'||s.hView==='triads'||s.hView==='arp') hView=s.hView;   // identify stays transient (idSel is scratch)
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
  if(Number.isInteger(s.trQual)&&TRIADS[s.trQual]) trQual=s.trQual;
  if(Number.isInteger(s.trSet)&&STRING_SETS[s.trSet]) trSet=s.trSet;
  if(Number.isInteger(s.trInv)&&s.trInv>=0&&s.trInv<=3) trInv=s.trInv;
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

/* ---- shareable deep links (Phase 9 distribution) ----
   Encode the musical context (the things a "look at this" link should carry) into
   the URL hash, so a backend-less single-file build is still addressable: open the
   link and the app lands on that key / scale / chord view. Applied once on load via
   applyShareHash() then stripped (so later navigation isn't re-pinned), and
   persisted to localStorage from there on like any other state. The setters it
   drives (setKey / setScView / setHView / selectTab / setMode) live in wiring-init
   and exist by the time init calls this. */
function encodeShareState(){
  const p=new URLSearchParams();
  p.set('m', currentMode);
  p.set('t', currentTab);
  p.set('k', String(gRoot));
  p.set('r', gRootLbl);
  p.set('s', String(scIdx));
  if(currentTab==='harmony'){ p.set('hv', hView); p.set('q', String(chQual)); }
  if(currentTab==='scales')  p.set('sv', scView);
  return p.toString();
}
function shareURL(){
  const base=(typeof location!=='undefined') ? (location.origin+location.pathname) : '';
  return base + '#' + encodeShareState();
}
function applyShareHash(){
  if(typeof location==='undefined') return false;
  const h=(location.hash||'').replace(/^#/, ''); if(!h) return false;
  let p; try{ p=new URLSearchParams(h); }catch(e){ devWarn('bad share hash', e); return false; }
  if(!p.has('k') && !p.has('t') && !p.has('s')) return false;   // not one of ours
  const k=parseInt(p.get('k'),10), r=p.get('r'), s=parseInt(p.get('s'),10);
  if(Number.isInteger(k) && k>=0 && k<12){
    const lbl=(typeof r==='string' && r) ? r : ROOTS[k];
    setKey(k, lbl, (Number.isInteger(s) && SCALES[s]) ? s : undefined);
  } else if(Number.isInteger(s) && SCALES[s]){ scIdx=s; }
  const sv=p.get('sv'); if(sv==='scale'||sv==='notes') setScView(sv);
  const hv=p.get('hv'); if(hv==='chords'||hv==='triads'||hv==='arp'||hv==='identify') setHView(hv);
  const q=parseInt(p.get('q'),10); if(Number.isInteger(q) && QUALITIES[q]){ chQual=q; chVoicing=0; }
  const tab=p.get('t'); if(tab==='harmony'||tab==='scales'||tab==='circle') selectTab(tab);
  const m=p.get('m'); setMode(m==='practice'||m==='ear'?m:'reference');
  // strip the hash so a reload / later nav isn't re-pinned to the shared state
  try{ history.replaceState(null, '', location.pathname+location.search); }catch(e){ /* ignore */ }
  return true;
}

