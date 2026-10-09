/* ===================== SHARED MIC INPUT =====================
   One microphone for every consumer (tuner, onset detection, calibration): one
   permission prompt, one stream, one recording indicator.

   REFCOUNTED: the tuner and a scored drill can be open at once, and whoever stops last
   releases the device. micRelease() stops the tracks at zero — only that clears the
   browser's recording dot; a disconnected-but-live stream still reads as listening.

   getUserMedia exists only on https / localhost, so everything here degrades to
   "unsupported" rather than throwing; callers check micSupported() and hide their
   entry points.

   Slot 13, ahead of every slot-14 consumer: `let micStream` and friends aren't hoisted. */

/* Can this build ask for a mic at all? Secure context + the API + Web Audio. */
function micSupported(){
  if(typeof window==='undefined' || typeof navigator==='undefined') return false;
  if(!window.isSecureContext) return false;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  return !!(window.AudioContext || window.webkitAudioContext);
}

let micStream = null;    // the one live MediaStream
let micSrc = null;       // its MediaStreamAudioSourceNode, shared by all consumers
let micUsers = 0;        // refcount
let micPending = null;   // in-flight acquire, so two simultaneous callers share one prompt

/* A getUserMedia rejection as an i18n key: the user's next step differs in each case
   (re-allow in site settings, plug a mic in, quit the other app). */
function micErrKey(err){
  const name = err && err.name;
  if(name==='NotAllowedError' || name==='SecurityError') return 'mic_denied';
  if(name==='NotFoundError' || name==='OverconstrainedError') return 'mic_nodev';
  if(name==='NotReadableError' || name==='AbortError') return 'mic_busy';
  return 'mic_err';
}

/* Acquire (or join) the shared mic: { ok:true, src } or { ok:false, key }. Only ever
   from a user gesture — the prompt must be something the user asked for. */
function micAcquire(){
  if(!micSupported()) return Promise.resolve({ ok:false, key:'mic_unsupported' });
  const ctx = audio();
  if(!ctx) return Promise.resolve({ ok:false, key:'mic_unsupported' });
  if(micSrc){ micUsers++; return Promise.resolve({ ok:true, src:micSrc }); }
  if(micPending) return micPending.then(r=>{ if(r.ok) micUsers++; return r; });
  // Ask for the raw signal: AGC pumps the level (destroys onset dynamics), noise
  // suppression carves out sustained tones (destroys pitch), and echo cancellation can
  // gate the string entirely.
  micPending = navigator.mediaDevices.getUserMedia({
    audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false }
  }).then(stream=>{
    micStream = stream;
    micSrc = ctx.createMediaStreamSource(stream);
    micUsers = 1;
    micPending = null;
    return { ok:true, src:micSrc };
  }).catch(err=>{
    micPending = null;
    devWarn('mic: getUserMedia failed', err);
    return { ok:false, key:micErrKey(err) };
  });
  return micPending;
}

/* Drop one reference. At zero the device is genuinely released. */
function micRelease(){
  if(micUsers>0) micUsers--;
  if(micUsers>0 || !micStream) return;
  try{ if(micSrc) micSrc.disconnect(); }catch(_){}
  try{ micStream.getTracks().forEach(tr=>tr.stop()); }catch(_){}
  micSrc = null; micStream = null;
}

/* Hard release regardless of the refcount, for a hidden tab or pagehide; consumers
   re-acquire when they next start. */
function micReleaseAll(){ micUsers = 0; micRelease(); }

function micLive(){ return !!micSrc; }
