/* ===================== SHARED MIC INPUT (Phase 8) =====================
   One microphone, many consumers. F0's tuner acquired the mic itself; F1 adds a
   second consumer (onset detection) and the calibration round-trip is a third, so
   the acquisition, the permission prompt and the error vocabulary move here rather
   than being copy-pasted per feature. Two features asking `getUserMedia`
   independently would mean two permission flows, two live streams and two
   recording indicators for one microphone.

   REFCOUNTED, not a singleton-with-a-boolean: the tuner and a scored drill can be
   open at once, and whoever stops second is the one that must actually release the
   device. `micAcquire()` hands out a shared MediaStreamAudioSourceNode and bumps
   the count; `micRelease()` drops it and stops the tracks at zero. Stopping the
   tracks (not just disconnecting) is what clears the browser's recording dot — a
   disconnected-but-live stream still reads as "this tab is listening".

   Secure-context rule (same as 16-pwa.js): getUserMedia only exists on https /
   localhost, so everything here degrades to "unsupported" rather than throwing on
   a file:// dist copy or in jsdom. Callers check micSupported() and hide their
   entry points; nothing in the app is allowed to present a control that can only
   ever report an error.

   Loads at slot 13 — ahead of every slot-14 consumer, since `let micStream` and
   friends are not hoisted. */

/* Can this build even ask for a mic? Secure context + the API + Web Audio. */
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

/* Map a getUserMedia rejection to an i18n key. Callers show it verbatim; the
   distinctions matter because the user's next action differs in each case
   (re-allow in site settings vs plug a mic in vs quit the other app). */
function micErrKey(err){
  const name = err && err.name;
  if(name==='NotAllowedError' || name==='SecurityError') return 'mic_denied';
  if(name==='NotFoundError' || name==='OverconstrainedError') return 'mic_nodev';
  if(name==='NotReadableError' || name==='AbortError') return 'mic_busy';
  return 'mic_err';
}

/* Acquire (or join) the shared mic. Resolves { ok:true, src } or { ok:false, key }.
   NEVER call this outside a user gesture — the permission prompt must be something
   the user asked for. */
function micAcquire(){
  if(!micSupported()) return Promise.resolve({ ok:false, key:'mic_unsupported' });
  const ctx = audio();
  if(!ctx) return Promise.resolve({ ok:false, key:'mic_unsupported' });
  if(micSrc){ micUsers++; return Promise.resolve({ ok:true, src:micSrc }); }
  if(micPending) return micPending.then(r=>{ if(r.ok) micUsers++; return r; });
  // Voice-call DSP is actively harmful for both consumers: AGC pumps the level
  // (which destroys onset dynamics), noise suppression carves out sustained tones
  // (which destroys pitch), and echo cancellation can gate the string entirely.
  // Ask for the raw signal.
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

/* Hard release regardless of refcount — for pagehide / tab-hide, where "some
   other feature still thinks it's using the mic" is not a good enough reason to
   keep listening. Consumers re-acquire when they next start. */
function micReleaseAll(){ micUsers = 0; micRelease(); }

function micLive(){ return !!micSrc; }
