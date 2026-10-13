/* ===================== PLAY: the reference ▶, and the fallback when there is no Web Audio ===================== */
/* ---- the one ▶ in Reference: a play/stop toggle for the backing ----
   It plays what the drawer says — the chord on a loop, or the progression when there is
   one — with whatever band the drawer has on (the Jam). Whatever is sounding, the same
   press stops it. */
function refPlayToggle(){
  if(seqClock) seqStop();
  else if(loopClock) stopLoop();
  else { audio(); if(playSrc==='prog' && seq.length) seqPlay(); else loopToggle(); }
  renderPlayBtn();
}

/* ---- no Web Audio: disable the playback controls with a hint, not dead buttons ---- */
function applyAudioAvailability(){
  if(typeof window==='undefined') return true;
  const ok = !!(window.AudioContext || window.webkitAudioContext);
  if(ok){ const w=document.getElementById('audio-warn'); if(w) w.remove(); return true; }
  ['g-play','tb-metro','cof-cadence'].forEach(id=>{
    const el=document.getElementById(id); if(el){ el.disabled=true; el.setAttribute('aria-disabled','true'); el.title=t('audio_off'); }
  });
  const row=document.getElementById('strip-row');
  if(row && !document.getElementById('audio-warn')){
    const w=document.createElement('span'); w.id='audio-warn'; w.className='audio-warn'; w.textContent=t('audio_off'); row.appendChild(w);
  }
  devWarn('Web Audio unavailable; playback controls disabled');
  return false;
}
