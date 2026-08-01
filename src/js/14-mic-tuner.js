/* ===================== CHROMATIC MIC TUNER (Phase 8 / F0) =====================
   Play any note; see which note it is and how many cents sharp or flat.

   This is the de-risking slice of the mic phase, and it is deliberately the
   *easy* half: a sustained note, one string at a time. It needs no AudioWorklet
   (a needle updating ~20x/s on the main thread is fine), no latency
   compensation (nobody perceives 80 ms of lag on a tuner), no onset detection
   and no polyphony. What it DOES buy is the whole plumbing layer the scored
   tiers (F1 onset, F2 pitch) need anyway — gesture-gated permission, device and
   in-use errors, a clean enable/disable lifecycle — plus the first honest test
   of the vendored pitch detector against the gentlest possible input.

   It COMPLEMENTS the reference-tone tuner in 05-audio.js (tunerTone), which
   stays for tuning by ear and for anyone with no working mic.

   Secure-context rule: getUserMedia only exists on https / localhost. So, like
   the PWA sidecar in 16-pwa.js, this self-disables rather than throwing — on a
   file:// dist copy and in jsdom the entry button is simply removed, because a
   control that can't do anything shouldn't be on screen.

   LOAD ORDER — this is why it's slot 14 and not 17, next to the PWA sidecar it
   otherwise resembles: applyLang (11) calls micRefreshLang, and applyLang first
   runs from wiring-init (15). `let mt` below is NOT hoisted, so loading after 15
   makes that first call throw on the temporal dead zone — the same trap that
   pins the drill registry to slot 13, ahead of the slot-14 drills. Anything
   wiring-init or applyLang reaches into has to be defined before them.  */

/* Detection window. 2048 samples @44.1kHz ≈ 46 ms ≈ 3.8 periods of low E
   (82.4 Hz) — MPM wants at least two periods of the lowest pitch you care
   about, so this is the smallest power of two that still tracks a 6th string. */
const MT_FFT = 2048;
/* Gates. Clarity is MPM's own confidence: a clean plucked string sits ~0.95+,
   while white noise measured ~0.41, so 0.9 rejects room noise without being
   fussy. RMS additionally ignores near-silence between plucks. */
const MT_CLARITY = 0.9, MT_RMS = 0.008;
/* Guitar range with headroom: low E (82.4) down a tone to D (73), up to the
   high e 12th fret and beyond. Anything outside is a harmonic or a mis-read. */
const MT_HZ_LO = 60, MT_HZ_HI = 1400;
/* Readings kept for the median filter. At ~60 fps this is ~0.1 s of history —
   long enough to kill a single-frame octave flip, short enough to feel live. */
const MT_HIST = 7;
/* |cents| within this reads as in tune. ±5 is the standard tuner tolerance and
   is well inside what the detector resolves (measured <0.05 cents on synthetic
   tones), so the needle's honesty is limited by the guitar, not the maths. */
const MT_IN_TUNE = 5;
/* Frames of silence before the readout clears, so it doesn't blank between
   plucks (~0.7 s at 60 fps). */
const MT_HOLD = 40;

let mt = null;          // live session: { stream, src, analyser, detector, buf, raf, hist, quiet }
/* Needle smoothing, kept OUTSIDE the session object on purpose: the readout is a
   pure function of "a MIDI number arrived" plus this one easing value, so it can
   be driven (and asserted) with no mic attached. null == no reading yet. */
let mtCents = null;

/* Can this build even ask for a mic? Secure context + the API + Web Audio.
   Checked before the entry point is shown, so the button never lies. */
function micSupported(){
  if(typeof window==='undefined' || typeof navigator==='undefined') return false;
  if(!window.isSecureContext) return false;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  return !!(window.AudioContext || window.webkitAudioContext);
}

/* ---- pitch → musical readout ---------------------------------------------- */
function micMidiFromHz(hz){ return 69 + 12*Math.log2(hz/440); }
/* Cents off the nearest equal-tempered semitone, in [-50, +50). */
function micCentsOff(midi){ return (midi - Math.round(midi))*100; }
/* Nearest open string of the CURRENT tuning, so the hint re-labels itself for
   Drop D / DADGAD / Open G exactly like the reference tuner does. Returns the
   string index into OPEN_MIDI/SNAMES, not a fixed E-A-D-G-B-e assumption. */
function micNearestString(midi){
  let best=0, bestD=Infinity;
  for(let i=0;i<OPEN_MIDI.length;i++){ const d=Math.abs(midi-OPEN_MIDI[i]); if(d<bestD){ bestD=d; best=i; } }
  return best;
}

/* ---- the live loop -------------------------------------------------------- */
/* Median of the recent MIDI readings. MPM's failure mode on a plucked string is
   an occasional octave jump (it latches a harmonic for one frame); a median
   discards that outright, where an average would smear it across the needle. */
function micMedian(a){ const s=a.slice().sort((x,y)=>x-y); return s[(s.length-1)>>1]; }

function micFrame(){
  if(!mt) return;
  mt.raf = requestAnimationFrame(micFrame);
  mt.analyser.getFloatTimeDomainData(mt.buf);
  const [hz, clarity] = mt.detector.findPitch(mt.buf, mt.rate);
  const good = hz>=MT_HZ_LO && hz<=MT_HZ_HI && clarity>=MT_CLARITY;
  if(good){
    mt.quiet = 0;
    mt.hist.push(micMidiFromHz(hz));
    if(mt.hist.length>MT_HIST) mt.hist.shift();
    micPaint(micMedian(mt.hist));
  } else if(mt.hist.length){
    // Nothing usable this frame: hold the last reading briefly so the display
    // doesn't strobe between plucks, then fall back to "play a string".
    if(++mt.quiet > MT_HOLD){ mt.hist.length=0; micPaintIdle(); }
  }
}

/* ---- rendering ------------------------------------------------------------ */
function micEl(id){ return document.getElementById(id); }

function micPaintIdle(){
  mtCents=null;                    // next reading starts the easing fresh
  const n=micEl('mt-note'); if(n) n.textContent='—';
  const o=micEl('mt-oct');  if(o) o.textContent='';
  const c=micEl('mt-cents');if(c) c.textContent='';
  const s=micEl('mt-string');if(s) s.textContent=t('mic_play_hint');
  const nd=micEl('mt-needle'); if(nd) nd.style.left='50%';
  const g=micEl('mt-gauge'); if(g){ g.classList.remove('in-tune'); g.removeAttribute('data-dir'); }
}

function micPaint(midi){
  const near=Math.round(midi), cents=micCentsOff(midi);
  // Ease the needle toward the new value so it glides instead of twitching;
  // the NUMBER shows the smoothed value too, so readout and needle never disagree.
  mtCents = (mtCents==null) ? cents : mtCents + (cents-mtCents)*0.35;
  const shown=mtCents;
  const n=micEl('mt-note');
  if(n) n.textContent=NOTES[mod(near,12)].replace('#','♯');
  const o=micEl('mt-oct');
  if(o) o.textContent=String(Math.floor(near/12)-1);
  const c=micEl('mt-cents');
  if(c) c.textContent=(shown>0?'+':'')+shown.toFixed(0)+' ' + t('mic_cents');
  const si=micNearestString(near);
  const s=micEl('mt-string');
  if(s) s.textContent = t('mic_string')+': '+SNAMES[si]+' ('+midiLabel(OPEN_MIDI[si])+')';
  const nd=micEl('mt-needle');
  if(nd) nd.style.left = (50 + Math.max(-50, Math.min(50, shown))).toFixed(1)+'%';
  const g=micEl('mt-gauge');
  if(g){
    const inTune=Math.abs(shown)<=MT_IN_TUNE;
    g.classList.toggle('in-tune', inTune);
    if(inTune) g.removeAttribute('data-dir');
    else g.setAttribute('data-dir', shown<0 ? 'flat' : 'sharp');
  }
}

/* One place for every "why isn't this working" line. The key is stashed on the
   element so a language switch can re-render the message that's on screen
   (micRefreshLang) without the caller having to remember what it said. */
function micStatus(key){
  const el=micEl('mt-status'); if(!el) return;
  if(key) el.dataset.key=key; else delete el.dataset.key;
  el.textContent = key ? t(key) : '';
  el.hidden = !key;
}

/* ---- lifecycle ------------------------------------------------------------ */
/* Gesture-gated: only ever called from a click, never on load. */
async function micStart(){
  if(mt) return;
  if(!micSupported()){ micStatus('mic_unsupported'); return; }
  const ctx=audio();
  if(!ctx){ micStatus('mic_unsupported'); return; }
  // Speaker → mic feedback is real, and the reference tone is the loudest thing
  // this app can be doing while you tune. Silence it before we listen.
  tunerStop();
  micStatus('mic_asking');
  let stream;
  try{
    // The browser's voice-call DSP is actively harmful here: AGC pumps the level,
    // noise suppression carves out sustained tones and echo cancellation can gate
    // the string entirely. Ask for the raw signal.
    stream = await navigator.mediaDevices.getUserMedia({
      audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false }
    });
  }catch(err){
    const name = err && err.name;
    if(name==='NotAllowedError' || name==='SecurityError') micStatus('mic_denied');
    else if(name==='NotFoundError' || name==='OverconstrainedError') micStatus('mic_nodev');
    else if(name==='NotReadableError' || name==='AbortError') micStatus('mic_busy');
    else micStatus('mic_err');
    devWarn('mic tuner: getUserMedia failed', err);
    micSyncButtons(false);
    return;
  }
  const src=ctx.createMediaStreamSource(stream);
  const analyser=ctx.createAnalyser();
  analyser.fftSize=MT_FFT;
  // Deliberately NOT connected to ctx.destination: routing the mic to the
  // speakers is a feedback loop, not a monitor.
  src.connect(analyser);
  const detector=PitchDetector.forFloat32Array(analyser.fftSize);
  detector.minVolumeDecibels = 20*Math.log10(MT_RMS);
  mt={ stream, src, analyser, detector,
       buf:new Float32Array(analyser.fftSize), rate:ctx.sampleRate,
       raf:null, hist:[], quiet:0 };
  micStatus(null);
  micPaintIdle();
  micSyncButtons(true);
  mt.raf=requestAnimationFrame(micFrame);
}

function micStop(){
  if(!mt) return;
  const s=mt;
  mt=null;
  if(s.raf) cancelAnimationFrame(s.raf);
  try{ s.src.disconnect(); }catch(_){}
  // Releasing the tracks is what actually drops the browser's recording
  // indicator — without it the tab looks like it's still listening.
  try{ s.stream.getTracks().forEach(tr=>tr.stop()); }catch(_){}
  micSyncButtons(false);
  micPaintIdle();
}

function micSyncButtons(on){
  const b=micEl('mt-toggle');
  if(b){ b.textContent = on ? t('mic_stop') : t('mic_start'); b.classList.toggle('play', !on); }
  const g=micEl('mt-gauge'); if(g) g.classList.toggle('live', on);
}

/* ---- overlay open / close ------------------------------------------------- */
/* The overlay chrome follows the changelog/help modals exactly: `hidden` for
   assistive tech + the keyboard guard, `.open` for the CSS that actually shows
   it. Both, always, or one of the two consumers is wrong. */
function micOpen(){
  const o=micEl('mic-overlay'); if(!o) return;
  o.hidden=false; o.classList.add('open');
  micStatus(null);
  micPaintIdle();
  micSyncButtons(!!mt);
  const b=micEl('mt-toggle'); if(b) try{ b.focus(); }catch(_){}
}
function micClose(){
  micStop();                       // closing the panel always releases the mic
  const o=micEl('mic-overlay'); if(!o) return;
  o.classList.remove('open'); o.hidden=true;
}

/* re-localize a panel that's already open when the language flips (called from
   applyLang in 11-notes-circle-lang.js, guarded so load order can't bite). */
function micRefreshLang(){
  micSyncButtons(!!mt);
  if(!mt) micPaintIdle();
  const st=micEl('mt-status');
  if(st && !st.hidden && st.dataset.key) st.textContent=t(st.dataset.key);
}

/* ---- wiring (self-contained, like the PWA sidecar) ------------------------- */
(function(){
  const open=micEl('tb-mic');
  // No secure context / no getUserMedia → remove the entry point entirely rather
  // than leave a button that can only ever report an error. The reference-tone
  // tuner beside it still works, so the feature degrades to "tune by ear".
  if(!micSupported()){ if(open && open.parentNode) open.parentNode.removeChild(open); return; }
  if(open) open.onclick=micOpen;
  const close=micEl('mt-close'); if(close) close.onclick=micClose;
  const tog=micEl('mt-toggle'); if(tog) tog.onclick=()=>{ mt ? micStop() : micStart(); };
  const ov=micEl('mic-overlay');
  // Click the backdrop (not the panel) to dismiss, matching the changelog overlay.
  if(ov) ov.addEventListener('click', e=>{ if(e.target===ov) micClose(); });
  document.addEventListener('keydown', e=>{
    const o=micEl('mic-overlay');
    if(e.key==='Escape' && o && !o.hidden){ e.preventDefault(); micClose(); }
  });
  // Never keep the mic open in a backgrounded tab — it's a privacy smell and the
  // rAF loop is throttled to uselessness there anyway.
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) micStop(); });
  addEventListener('pagehide', micStop);
})();
