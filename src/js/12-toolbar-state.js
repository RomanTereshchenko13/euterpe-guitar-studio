/* ===================== TOOLBAR + PERSISTENCE ===================== */
function buildToolbar(){
  const tun=document.getElementById('tb-tuning');
  tun.innerHTML=TUNINGS.map((tu,i)=>`<option value="${i}"${i===tuningIdx?' selected':''}>${lang==='en'?tu.en:tu.uk}</option>`).join('');
  const fr=document.getElementById('tb-frets');
  fr.innerHTML=FRET_RANGES.map((r,i)=>`<option value="${i}"${i===fretRangeIdx?' selected':''}>${r.key?t(r.key):r.label}</option>`).join('');
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
function applyAsideState(){
  const show = ASIDE_TABS.includes(currentTab);
  const aside=document.querySelector('.aside');
  if(aside) aside.style.display = show ? '' : 'none';
  // drop the reserved suggester column on tabs that don't use it (1e), so the
  // board + controls take the full width instead of leaving a 234px gap
  const layout=document.querySelector('.layout'); if(layout) layout.classList.toggle('no-aside', !show);
}
function renderAllBoards(){ renderChords(); renderTriads(); renderScales(); renderNotes(); }
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

const LS_KEY='guitarStudio.v1';
let currentTab='harmony';
function saveState(){ try{ localStorage.setItem(LS_KEY, JSON.stringify({
  lang, tab:currentTab, tuningIdx, fretRangeIdx, tempo, lefty, toolbarOpen,
  gRoot, gRootLbl, gMode, hView, scView,
  chQual, scIdx, scPos, scOverlay,
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
  if(typeof s.tempo==='number'&&s.tempo>=40&&s.tempo<=200) tempo=s.tempo;
  if(typeof s.lefty==='boolean') lefty=s.lefty;
  if(typeof s.toolbarOpen==='boolean') toolbarOpen=s.toolbarOpen;
  if(Number.isInteger(s.gRoot)&&s.gRoot>=0&&s.gRoot<12){ gRoot=s.gRoot; if(typeof s.gRootLbl==='string') gRootLbl=s.gRootLbl; }
  if(s.gMode==='names'||s.gMode==='deg') gMode=s.gMode;
  if(s.hView==='chords'||s.hView==='triads') hView=s.hView;
  if(s.scView==='scale'||s.scView==='notes') scView=s.scView;
  if(typeof s.tab==='string'){
    if(s.tab==='chords'||s.tab==='triads') currentTab='harmony';          // migrate old merged tabs
    else if(s.tab==='notes'){ currentTab='scales'; scView='notes'; }      // 1b: Notes folded into Scales
    else currentTab=s.tab;
  }
  // ---- working musical state (added in 1.6.1) ----
  if(Number.isInteger(s.chQual)&&QUALITIES[s.chQual]) chQual=s.chQual;
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

