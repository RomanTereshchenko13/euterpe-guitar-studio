/* ===================== KEYBOARD SHORTCUTS ===================== */
/* ---- keyboard shortcuts ----
   Space=Listen/Stop · L=Loop · M=Metronome · 1–4=nav · A–G=key · [ ]=transpose · ?=help.
   Ignored while typing, while a modal is open, or with Ctrl/Meta/Alt (browser shortcuts
   survive). Space is taken only when focus is NOT on a control, so a focused dot or
   button keeps its native Space. */
const NOTE_KEY = { a:9, b:11, c:0, d:2, e:4, f:5, g:7 };
function transposeKey(delta){ const pc=mod(keyRoot+delta,12); setKey(pc, ROOTS[pc]); }
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  const tg=e.target;
  if(tg && (tg.tagName==='INPUT'||tg.tagName==='SELECT'||tg.tagName==='TEXTAREA'||tg.isContentEditable)) return;
  // a modal is open — the tuner counts too, or "a" would retune the key mid-tuning
  if(!document.getElementById('cl-overlay').hidden || !document.getElementById('kbd-overlay').hidden) return;
  { const mo=document.getElementById('mic-overlay'); if(mo && !mo.hidden) return; }
  const k=e.key;
  // Space / L / M drive the REFERENCE transport, which Practice hides; from a drill
  // they would start a metronome nobody can see or stop.
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
  // the number keys are the nav, in nav order
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
