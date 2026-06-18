/* ===================== TOOLBAR + PERSISTENCE ===================== */
function buildToolbar(){
  const tun=document.getElementById('tb-tuning');
  tun.innerHTML=TUNINGS.map((tu,i)=>`<option value="${i}"${i===tuningIdx?' selected':''}>${lang==='en'?tu.en:tu.uk}</option>`).join('');
  const fr=document.getElementById('tb-frets');
  fr.innerHTML=FRET_RANGES.map((r,i)=>`<option value="${i}"${i===fretRangeIdx?' selected':''}>${r.key?t(r.key):r.label}</option>`).join('');
  const cp=document.getElementById('tb-capo');
  if(cp) cp.innerHTML=Array.from({length:8},(_,i)=>`<option value="${i}"${i===capo?' selected':''}>${i===0?t('capo_off'):i}</option>`).join('');
  const tp=document.getElementById('tb-tempo'); tp.value=tempo;
  document.getElementById('tb-bpm').textContent=tempo+' BPM';
  const lb=document.getElementById('tb-lefty'); lb.classList.toggle('active', lefty); lb.setAttribute('aria-pressed', lefty);
  applyToolbarState();
}
function applyToolbarState(){
  const tb=document.getElementById('toolbar'), tg=document.getElementById('tb-toggle');
  tb.classList.toggle('collapsed', !toolbarOpen);
  tg.classList.toggle('open', toolbarOpen);
  tg.setAttribute('aria-expanded', toolbarOpen);
}
function applyBackingPanel(){
  const p=document.getElementById('backing-panel'), tg=document.getElementById('backing-toggle');
  if(p) p.classList.toggle('collapsed', !backingOpen);
  if(tg){ tg.classList.toggle('open', backingOpen); tg.setAttribute('aria-expanded', backingOpen); }
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
function saveState(){ try{ localStorage.setItem(LS_KEY, JSON.stringify({
  lang, tab:currentTab, tuningIdx, fretRangeIdx, tempo, lefty, toolbarOpen, backingOpen, capo,
  gRoot, gRootLbl, gMode, hView, scView,
  chQual, arpPos, scIdx, scPos, scOverlay,
  chVoicing,
  trQual, trSet, trInv,
  ntRoot, ntFilter,
  seq, seqLoopOn,
  bassOn, grooveOn
})); }catch(e){ devWarn('state could not be saved (localStorage unavailable?)', e); } }
function loadState(){ try{
  const s=JSON.parse(localStorage.getItem(LS_KEY)||'null'); if(!s) return false;
  if(s.lang==='uk'||s.lang==='en') lang=s.lang;
  if(Number.isInteger(s.tuningIdx)&&TUNINGS[s.tuningIdx]) tuningIdx=s.tuningIdx;
  if(Number.isInteger(s.fretRangeIdx)&&FRET_RANGES[s.fretRangeIdx]) fretRangeIdx=s.fretRangeIdx;
  if(Number.isInteger(s.capo)&&s.capo>=0&&s.capo<=11) capo=s.capo;
  if(typeof s.tempo==='number'&&s.tempo>=40&&s.tempo<=200) tempo=s.tempo;
  if(typeof s.lefty==='boolean') lefty=s.lefty;
  if(typeof s.toolbarOpen==='boolean') toolbarOpen=s.toolbarOpen;
  if(typeof s.backingOpen==='boolean') backingOpen=s.backingOpen;
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
  if(typeof s.seqLoopOn==='boolean') seqLoopOn=s.seqLoopOn;
  if(typeof s.bassOn==='boolean') bassOn=s.bassOn;
  if(typeof s.grooveOn==='boolean') grooveOn=s.grooveOn;
  if(Array.isArray(s.seq)){
    seq = s.seq
      .filter(st=>st&&Number.isInteger(st.pc)&&st.pc>=0&&st.pc<12&&Number.isInteger(st.qi)&&st.qi>=0&&st.qi<QUALITIES.length)
      .map(st=>({pc:st.pc, lbl:(typeof st.lbl==='string'?st.lbl:ROOTS[st.pc]), qi:st.qi, bars:([1,2,4].includes(st.bars)?st.bars:1)}));
  }
}catch(e){ devWarn('saved state could not be restored; using defaults', e); return false; } return true; }

