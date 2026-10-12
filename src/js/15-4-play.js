/* ===================== PLAY: the Jam toggle, and the fallback when there is no Web Audio ===================== */
/* ---- "Jam over this": bass + drums + loop in one tap, and the same tap stops it ----
   Plays the progression when the player has built one, the current chord otherwise.
   Every button carrying data-jam is this toggle (the aside's and Arpeggio's). */
function jamActive(){ return !!(typeof seqClock!=='undefined' && seqClock) || !!(typeof loopClock!=='undefined' && loopClock); }
function renderJamBtn(){
  const on=jamActive();
  document.querySelectorAll('[data-jam]').forEach(b=>{
    b.textContent=t(on?'seam_jam_stop':'seam_jam');
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on?'true':'false');
  });
}
function jamToggle(){
  if(jamActive()){ if(seqClock) seqStop(); else stopLoop(); renderJamBtn(); return; }
  audio();
  if(!bassOn) bassToggle();
  if(!grooveOn) drumsToggle();
  /* Enabling the band may already have started the single-chord loop
     (ensureBacking), so start the loop only if nothing is sounding yet —
     loopToggle() would otherwise turn it straight back off. */
  if(seq.length){ if(!seqClock) seqPlay(); }
  else if(!loopClock) loopToggle();
  renderJamBtn();
}
document.querySelectorAll('[data-jam]').forEach(b=>{ b.onclick=jamToggle; });

/* ---- no Web Audio: disable the transport controls with a hint, not dead buttons ---- */
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
