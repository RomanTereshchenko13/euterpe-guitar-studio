/* ===================== KEYBOARD SHORTCUTS ===================== */
/* ---- keyboard shortcuts ----
   Space=the strip's ▶ · M=click with ▶ · 1–3=nav · K=key sheet · A–G=key · [ ]=transpose · ?=help.
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
  if(k===' '||k==='Spacebar'){
    if(tg && tg.closest && tg.closest('button,a,[role="button"],[tabindex]')) return;   // let the focused control keep Space
    // the strip's ▶ — the backing in Reference, the running drill's verb in Practice
    const gp=document.getElementById('g-play');
    if(!gp || gp.disabled || gp.closest('[hidden]')) return;
    e.preventDefault();
    stripPlay();
    return;
  }
  if(k==='?'){ e.preventDefault(); openKbd(); return; }
  // the number keys are the nav, in nav order
  if(k==='1'){ navTo('harmony'); return; }
  if(k==='2'){ navTo('scales'); return; }
  if(k==='3'){ navTo('practice'); return; }
  if(k==='['){ transposeKey(-1); return; }
  if(k===']'){ transposeKey(1); return; }
  const lk = k.length===1 ? k.toLowerCase() : '';
  // K opens the key sheet (where the circle lives) wherever the strip offers the key
  if(lk==='k'){ if(chipOffered('key')) toggleSheet('key'); return; }
  // M is the tempo sheet's click, wherever the strip offers the tempo
  if(lk==='m'){ const mb=document.getElementById('tb-metro'); if(chipOffered('tempo') && mb && !mb.disabled) clickToggle(); return; }
  if(lk && NOTE_KEY[lk]!==undefined){ const pc=NOTE_KEY[lk]; setKey(pc, ROOTS[pc]); return; }
});
