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
  applySheets();
}
/* ---- tempo: one setter, every readout ----
   The strip's tempo sheet is the one control (slider and ±5 steppers, in Reference and
   drills alike); this clamps to the slider's own range and repaints the chip too. */
function setTempo(bpm){
  tempo = Math.max(40, Math.min(200, Math.round(bpm)));
  const r=document.getElementById('tb-tempo');  if(r) r.value=tempo;
  const b=document.getElementById('tb-bpm');    if(b) b.textContent=tempo+' BPM';
  paintTempoChip();
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
/* After a tuning / fret-range / capo / lefty change: the view on screen repaints now,
   the others when they are shown (renderActiveContext). */
function renderAllBoards(){ renderActiveContext(); }
/* re-fit the fret cells when the viewport width changes */
if(typeof window!=='undefined'){
  let _rzT=null, _rzW=window.innerWidth;
  window.addEventListener('resize', ()=>{
    if(window.innerWidth===_rzW) return;          // ignore height-only changes (mobile URL bar)
    _rzW=window.innerWidth;
    clearTimeout(_rzT); _rzT=setTimeout(()=>{ renderAllBoards(); }, 150);
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
/* ---- what is saved: declared once ----
   One row per saved field: [key in the save, read, get, set]. `read` takes the value
   out of a save, bounds-checked, and returns undefined to keep the default, so a
   tampered or half-written save can't set a value the UI has no state for.
   snapshotState() and loadState() are both derived from this list, and export
   (13-backup.js) reads the same snapshot, so a backup can't drift from what the browser
   keeps. Adding a saved setting is one row here. Built per call: the tables the checks
   name live in later files. */
const svBool = v => typeof v==='boolean' ? v : undefined;
const svOneOf = (...xs) => v => xs.includes(v) ? v : undefined;
const svInt = (lo, hi) => v => Number.isInteger(v) && v>=lo && v<=hi ? v : undefined;
const svNum = (lo, hi) => v => typeof v==='number' && v>=lo && v<=hi ? v : undefined;
const svIdx = arr => v => Number.isInteger(v) && arr[v]!==undefined ? v : undefined;
function savedFields(){ return [
  ['lang',         svOneOf('uk','en'),                    ()=>lang,         v=>{ lang=v; }],
  ['mode',         svOneOf('reference','practice'),       ()=>currentMode,  v=>{ currentMode=v; }],
  // any other tab would open on no panel at all
  ['tab',          svOneOf('harmony','scales'),           ()=>currentTab,   v=>{ currentTab=v; }],
  ['tuningIdx',    svIdx(TUNINGS),                        ()=>tuningIdx,    v=>{ tuningIdx=v; }],
  ['customTuning', v=>Array.isArray(v) && v.length===6 && v.every(m=>svInt(TUNE_LO, TUNE_HI)(m)!==undefined) ? v.slice() : undefined,
                                                          ()=>customTuning, v=>{ customTuning=v; }],
  ['fretRangeIdx', svIdx(FRET_RANGES),                    ()=>fretRangeIdx, v=>{ fretRangeIdx=v; }],
  ['tempo',        svNum(40, 200),                        ()=>tempo,        v=>{ tempo=v; }],
  ['meterIdx',     svIdx(METERS),                         ()=>meterIdx,     v=>{ meterIdx=v; }],
  ['masterVol',    svNum(0, 1),                           ()=>masterVol,    v=>{ masterVol=v; }],
  ['lefty',        svBool,                                ()=>lefty,        v=>{ lefty=v; }],
  // the Settings sheet and the ▶ drawer (the Backing panel it replaced keeps its name)
  ['toolbarOpen',  svBool,                                ()=>toolbarOpen,  v=>{ toolbarOpen=v; }],
  ['backingOpen',  svBool,                                ()=>backingOpen,  v=>{ backingOpen=v; }],
  ['shapesOpen',   svBool,                                ()=>shapesOpen,   v=>{ shapesOpen=v; }],
  ['capo',         svInt(0, 11),                          ()=>capo,         v=>{ capo=v; }],
  ['cbPalette',    svBool,                                ()=>cbPalette,    v=>{ cbPalette=v; }],
  ['fnShapes',     svBool,                                ()=>fnShapes,     v=>{ fnShapes=v; }],
  ['welcomeSeen',  svBool,                                ()=>welcomeSeen,  v=>{ welcomeSeen=v; }],
  // the key keeps the save names it had when it was the only root ('gRoot', 'gRootLbl');
  // a label only means something next to the root it spells
  ['gRoot',        svInt(0, 11),                          ()=>keyRoot,      v=>{ keyRoot=v; }],
  ['gRootLbl',     (v,s)=>typeof v==='string' && svInt(0, 11)(s.gRoot)!==undefined ? v : undefined,
                                                          ()=>keyLbl,       v=>{ keyLbl=v; }],
  ['chRoot',       svInt(0, 11),                          ()=>chRoot,       v=>{ chRoot=v; }],
  ['chLbl',        (v,s)=>typeof v==='string' && svInt(0, 11)(s.chRoot)!==undefined ? v : undefined,
                                                          ()=>chLbl,        v=>{ chLbl=v; }],
  ['gMode',        svOneOf('names','deg'),                ()=>gMode,        v=>{ gMode=v; }],
  ['hView',        svOneOf('chords','arp'),               ()=>hView,        v=>{ hView=v; }],
  ['scView',       svOneOf('scale','notes'),              ()=>scView,       v=>{ scView=v; }],
  ['chQual',       svIdx(QUALITIES),                      ()=>chQual,       v=>{ chQual=v; }],
  ['arpPos',       svInt(0, 5),                           ()=>arpPos,       v=>{ arpPos=v; }],
  ['scIdx',        svIdx(SCALES),                         ()=>scIdx,        v=>{ scIdx=v; }],
  ['scPos',        svInt(0, 5),                           ()=>scPos,        v=>{ scPos=v; }],
  // clamped again at render against the real list length
  ['chVoicing',    svInt(0, 5),                           ()=>chVoicing,    v=>{ chVoicing=v; }],
  ['chTriads',     svBool,                                ()=>chTriads,     v=>{ chTriads=v; }],
  ['trSet',        svIdx(STRING_SETS),                    ()=>trSet,        v=>{ trSet=v; }],
  ['trInv',        svInt(0, 3),                           ()=>trInv,        v=>{ trInv=v; }],
  ['ntRoot',       v=>v==='' || NAT.includes(v) || SHARP.includes(v) || FLAT.includes(v) ? v : undefined,
                                                          ()=>ntRoot,       v=>{ ntRoot=v; }],
  ['ntFilter',     svOneOf('all','nat'),                  ()=>ntFilter,     v=>{ ntFilter=v; }],
  ['seq',          v=>Array.isArray(v) ? v
                       .filter(st=>st && svInt(0, 11)(st.pc)!==undefined && svIdx(QUALITIES)(st.qi)!==undefined)
                       .map(st=>({pc:st.pc, lbl:(typeof st.lbl==='string'?st.lbl:ROOTS[st.pc]), qi:st.qi, bars:([1,2,4].includes(st.bars)?st.bars:1)}))
                       : undefined,                       ()=>seq,          v=>{ seq=v; }],
  ['seqLoopOn',    svBool,                                ()=>seqLoopOn,    v=>{ seqLoopOn=v; }],
  ['playSrc',      svOneOf('chord','prog'),               ()=>playSrc,      v=>{ playSrc=v; }],
  ['bassOn',       svBool,                                ()=>bassOn,       v=>{ bassOn=v; }],
  ['grooveOn',     svBool,                                ()=>grooveOn,     v=>{ grooveOn=v; }],
  // the tempo sheet's "click with ▶" (new in v2.19.0; absent = off)
  ['clickOn',      svBool,                                ()=>clickOn,      v=>{ clickOn=v; }],
  // round-trip latency, bounded by the measurement's own ceiling so a bad save can't skew every score
  ['calMs',        svNum(0, CAL_MAX_MS),                  ()=>calMs,        v=>{ calMs=v; }],
  ['calKnown',     svBool,                                ()=>calKnown,     v=>{ calKnown=v; }],
  // tracks already run once (the first-run hint); rebuilt key by key and bounded
  ['drillSeen',    v=>{ if(!v || typeof v!=='object' || Array.isArray(v)) return undefined;
                        const out={}; let n=0;
                        for(const k of Object.keys(v)){ if(!k.length || k.length>32 || ++n>64) continue; if(v[k]) out[k]=1; }
                        return out; },                    ()=>drillSeen,    v=>{ drillSeen=v; }],
  // one-minute changes: your own pair, two [root, quality] (a quality the picker offers)
  ['cmCustom',     v=>Array.isArray(v) && v.length===2 && v.every(c=>Array.isArray(c) && svInt(0, 11)(c[0])!==undefined && CM_QUALS.includes(c[1]))
                       ? v.map(c=>[c[0], c[1]]) : undefined, ()=>cmCustom, v=>{ cmCustom=v; }]
]; }

/* Old saves, brought up to the current shape before the fields read them. Each rule
   rewrites keys this build reads from keys an older build wrote; tests/compat.js runs
   real saves from past releases through it. */
function migrateSave(raw){
  const s=Object.assign({}, raw);
  if(s.mode==='ear') s.mode='practice';                        // the ear drills moved into Practice
  if(s.tab==='chords') s.tab='harmony';                        // the Chords tab merged into Harmony
  if(s.tab==='notes'){ s.tab='scales'; s.scView='notes'; }     // Notes became a view of Scales
  // the circle became the key picker (PLAN step 8): a save on its tab opens Scales with
  // the key sheet open, where the circle now lives (`keySheet` is read once, never saved)
  if(s.tab==='circle'){ s.tab='scales'; s.keySheet=true; }
  // Triads became a toggle on Chord tones (v2.17.0): a save on the Triads tab or view opens
  // on Chord tones with triads on, on the triad it had picked
  if(s.tab==='triads' || s.hView==='triads'){
    if(s.tab==='triads') s.tab='harmony';
    s.hView='chords'; s.chTriads=true; s.chVoicing=0;
    if(svIdx(TRIADS)(s.trQual)!==undefined) s.chQual=TRI_TO_QUAL[s.trQual];
  }
  // a save from before calKnown with a real latency was measured: don't re-prompt it
  if(typeof s.calKnown!=='boolean') s.calKnown = svNum(0, CAL_MAX_MS)(s.calMs)>0;
  // a save from before onboarding is a returning visitor: no welcome
  if(typeof s.welcomeSeen!=='boolean') s.welcomeSeen=true;
  // one root was both key and chord until the chord got its own: it starts on the key's
  // tonic, so the save opens on the chord it showed
  if(svInt(0, 11)(s.chRoot)===undefined && svInt(0, 11)(s.gRoot)!==undefined){ s.chRoot=s.gRoot; s.chLbl=s.gRootLbl; }
  return s;
}

/* ---- progress under its own key ----
   The learner model is the one thing clicking around can't rebuild, so it is stored apart
   from the settings: a settings save that throws, or a settings blob that won't parse,
   can't take it along. Older builds kept it inside the settings (`learner`); that copy is
   read until the first save writes this key. */
const LS_PROGRESS='guitarStudio.progress.v1';
/* A newer app's progress that this build can't read is left alone rather than
   overwritten with an empty model (someone opening an older copy, or a rollback). */
let progressFrozen=false;

function settingsSnapshot(){
  const o={};
  savedFields().forEach(([k,,get])=>{ o[k]=get(); });
  return o;
}
/* Everything that is saved, settings and progress, in one object: what export writes
   and import reads. */
function snapshotState(){ return Object.assign(settingsSnapshot(), { learner }); }

/* Set by an import just before it reloads, so no save can put the old progress back. */
let saveBlocked=false;
function saveState(){ if(saveBlocked) return;
  let progressSaved=progressFrozen;
  if(!progressFrozen){
    try{ localStorage.setItem(LS_PROGRESS, JSON.stringify(learner)); progressSaved=true; }
    catch(e){
      // keep the progress with the settings instead, and drop the stale copy so the next
      // load can't prefer it
      devWarn('progress could not be saved under its own key', e);
      try{ localStorage.removeItem(LS_PROGRESS); }catch(_){ /* the settings copy still loads */ }
    }
  }
  try{
    const s=settingsSnapshot();
    if(!progressSaved) s.learner=learner;
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  }catch(e){ devWarn('state could not be saved (localStorage unavailable?)', e); saveFailed(); } }

/* Returns whether there were saved settings (no settings → the first-visit language guess).
   Progress loads either way. */
function loadState(){
  let raw=null;
  try{ raw=JSON.parse(localStorage.getItem(LS_KEY)||'null'); }catch(e){ devWarn('saved settings could not be read; using defaults', e); }
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) raw=null;
  loadProgress(raw);
  if(!raw) return false;
  try{
    const s=migrateSave(raw);
    savedFields().forEach(([k,read,,set])=>{ const v=read(s[k], s); if(v!==undefined) set(v); });
    if(s.keySheet===true) keySheetOpen=true;
  }catch(e){ devWarn('saved state could not be restored; using defaults', e); return false; }
  return true;
}
function loadProgress(settings){
  let p=null;
  try{ p=JSON.parse(localStorage.getItem(LS_PROGRESS)||'null'); }catch(e){ devWarn('saved progress could not be read', e); }
  if(!p || typeof p!=='object') p = settings ? settings.learner : null;   // saved by an older build, with the settings
  progressFrozen = !!p && typeof p==='object' && typeof p.v==='number' && p.v>LEARNER_V;
  learner = normalizeLearner(p);   // bounds-checked (garbage → fresh model)
}

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
