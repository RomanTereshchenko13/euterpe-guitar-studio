/* ===================== THE TUNER =====================
   Play any note; see which note it is and how many cents sharp or flat. The same
   panel plays a reference tone per open string (tunerTone, 05-audio.js) to tune by
   ear — one tap away when the mic works, the whole panel when it doesn't.

   getUserMedia exists only on https / localhost, so on file:// and in jsdom the mic
   half hides itself rather than offering a control that can only fail.

   Slot 14, not 17: applyLang (11) calls micRefreshLang and first runs from 15, and
   `let mt` below is not hoisted — loaded after 15, that first call hits the TDZ. */

/* 2048 samples @44.1kHz ≈ 46 ms ≈ 3.8 periods of low E: MPM wants at least two
   periods of the lowest pitch, and this is the smallest power of two that has them. */
const MT_FFT = 2048;
/* Clarity is MPM's confidence: a clean string sits ~0.95+, white noise measured ~0.41.
   RMS ignores near-silence between plucks. */
const MT_CLARITY = 0.9, MT_RMS = 0.008;
/* guitar range with headroom (Drop D's 73 Hz up past the 12th fret); outside is a
   harmonic or a mis-read */
const MT_HZ_LO = 60, MT_HZ_HI = 1400;
/* readings in the median filter: ~0.1 s, enough to kill a one-frame octave flip */
const MT_HIST = 7;
/* |cents| within this reads as in tune — the standard ±5 */
const MT_IN_TUNE = 5;
/* frames of silence before the readout clears (~0.7 s), so it doesn't blank between plucks */
const MT_HOLD = 40;

let mt = null;          // live session: { stream, src, analyser, detector, buf, raf, hist, quiet }
/* Needle smoothing lives outside the session, so the readout can be driven (and
   tested) with no mic attached. null = no reading yet. */
let mtCents = null;
/* Stop/close while an acquire is still awaiting the permission prompt: micStart()
   gives the mic back instead of starting. */
let mtClosing = false;

/* Acquisition, permission and errors live in 13-mic.js (one mic, one prompt, shared
   with onset detection and calibration). */

/* ---- pitch → musical readout ---------------------------------------------- */
function micMidiFromHz(hz){ return 69 + 12*Math.log2(hz/440); }
/* Cents off the nearest equal-tempered semitone, in [-50, +50). */
function micCentsOff(midi){ return (midi - Math.round(midi))*100; }
/* Nearest open string of the CURRENT tuning, so Drop D and the rest re-label. */
function micNearestString(midi){
  let best=0, bestD=Infinity;
  for(let i=0;i<OPEN_MIDI.length;i++){ const d=Math.abs(midi-OPEN_MIDI[i]); if(d<bestD){ bestD=d; best=i; } }
  return best;
}

/* ---- the live loop -------------------------------------------------------- */
/* MPM sometimes latches a harmonic for one frame (an octave jump); a median drops it,
   an average would smear it across the needle. */
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
    // nothing usable: hold the last reading briefly, then fall back to "play a string"
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
  // ease the needle so it glides; the number shows the eased value too, so they agree
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

/* Every "why isn't this working" line. The key is kept on the element so a language
   switch can re-render it (micRefreshLang). */
function micStatus(key){
  const el=micEl('mt-status'); if(!el) return;
  if(key) el.dataset.key=key; else delete el.dataset.key;
  el.textContent = key ? t(key) : '';
  el.hidden = !key;
}

/* ---- lifecycle ------------------------------------------------------------ */
/* Gesture-gated: only ever called from a click. */
async function micStart(){
  if(mt) return;
  if(!micSupported()){ micStatus('mic_unsupported'); return; }
  const ctx=audio();
  if(!ctx){ micStatus('mic_unsupported'); return; }
  // the reference tone is the loudest thing the app can be playing — silence it first
  tunerStop();
  micStatus('mic_asking');
  mtClosing = false;               // a Stop/close from before this start doesn't count
  const got = await micAcquire();
  // no mic after all (denied, missing, busy): the by-ear strings are the way on
  if(!got.ok){ micStatus(got.key); micSyncButtons(false); tunerEarShow(true); return; }
  // the user may have hit Stop or closed the panel during the permission prompt
  if(mtClosing){ mtClosing=false; micRelease(); micSyncButtons(false); return; }
  const analyser=ctx.createAnalyser();
  analyser.fftSize=MT_FFT;
  // NOT connected to the speakers: that would be a feedback loop, not a monitor
  got.src.connect(analyser);
  const detector=PitchDetector.forFloat32Array(analyser.fftSize);
  detector.minVolumeDecibels = 20*Math.log10(MT_RMS);
  mt={ src:got.src, analyser, detector,
       buf:new Float32Array(analyser.fftSize), rate:ctx.sampleRate,
       raf:null, hist:[], quiet:0 };
  micStatus(null);
  micPaintIdle();
  micSyncButtons(true);
  mt.raf=requestAnimationFrame(micFrame);
}

function micStop(){
  if(!mt){
    // an acquire may be mid-prompt: record the intent, micStart() unwinds on resolve
    mtClosing = true;
    micSyncButtons(false);
    return;
  }
  const s=mt;
  mt=null;
  if(s.raf) cancelAnimationFrame(s.raf);
  // disconnect OUR analyser only: the source is shared (13-mic.js), and micRelease()
  // stops the device once the last consumer lets go
  try{ s.analyser.disconnect(); }catch(_){}
  try{ s.src.disconnect(s.analyser); }catch(_){}
  micRelease();
  micSyncButtons(false);
  micPaintIdle();
}

function micSyncButtons(on){
  const b=micEl('mt-toggle');
  if(b){ b.textContent = on ? t('mic_stop') : t('mic_start'); b.classList.toggle('play', !on); }
  const g=micEl('mt-gauge'); if(g) g.classList.toggle('live', on);
}

/* ---- overlay open / close ------------------------------------------------- */
/* Like the other modals: `hidden` for assistive tech and the keyboard guard, `.open`
   for the CSS that shows it. Always both. */
function micOpen(){
  const o=micEl('mic-overlay'); if(!o) return;
  o.hidden=false; o.classList.add('open');
  micStatus(null);
  micPaintIdle();
  micSyncButtons(!!mt);
  const b=micSupported() ? micEl('mt-toggle') : document.querySelector('#mt-strings .tuner-str');
  if(b) try{ b.focus(); }catch(_){}
}
function micClose(){
  micStop();                       // closing the panel always releases the mic
  tunerStop();                     // ...and silences a reference tone
  const o=micEl('mic-overlay'); if(!o) return;
  o.classList.remove('open'); o.hidden=true;
}

/* ---- tune by ear ----------------------------------------------------------- */
/* One button per open string, low → high, each holding a reference pitch. Rebuilt
   on a tuning change. OPEN_MIDI / SNAMES are stored high → low, hence the reverse. */
function buildTuner(){
  const ts=micEl('mt-strings'); if(!ts) return;
  ts.innerHTML = OPEN_MIDI.map((m,i)=>({m, nm:SNAMES[i]})).reverse()
    .map(o=>`<button class="btn tuner-str" data-midi="${o.m}" aria-label="${o.nm}">${o.nm}</button>`).join('');
}
/* The strings' disclosure. Where there is no mic they are the whole panel, so the
   toggle hides and the strings stay open. */
function tunerEarShow(on){
  const body=micEl('mt-ear-body'), tg=micEl('mt-ear-toggle'), always=!micSupported();
  if(body) body.hidden = !(on || always);
  if(tg){ tg.hidden=always; tg.textContent=t('tuner_ear')+(on?' ▴':' ▾'); tg.setAttribute('aria-expanded', on?'true':'false'); }
}
function tunerEarOpen(){ const b=micEl('mt-ear-body'); return !!b && !b.hidden; }

/* re-localize an open panel on a language switch (from applyLang) */
function micRefreshLang(){
  micSyncButtons(!!mt);
  if(!mt) micPaintIdle();
  const st=micEl('mt-status');
  if(st && !st.hidden && st.dataset.key) st.textContent=t(st.dataset.key);
  tunerEarShow(tunerEarOpen());
}

/* ---- wiring --------------------------------------------------------------- */
(function(){
  const open=micEl('tb-tuner'); if(open) open.onclick=micOpen;
  const close=micEl('mt-close'); if(close) close.onclick=micClose;
  const strings=micEl('mt-strings');
  // a reference tone with the mic listening would just move the needle, so it stops it
  if(strings) strings.addEventListener('click', e=>{ const b=e.target.closest('[data-midi]'); if(!b) return; if(mt) micStop(); tunerTone(+b.dataset.midi); });
  // no mic path: hide the mic half; the panel is the by-ear strings
  if(!micSupported()){
    const m=micEl('mt-mic'); if(m) m.hidden=true;
  } else {
    const tog=micEl('mt-toggle'); if(tog) tog.onclick=()=>{ mt ? micStop() : micStart(); };
    const et=micEl('mt-ear-toggle'); if(et) et.onclick=()=>tunerEarShow(!tunerEarOpen());
  }
  tunerEarShow(false);
  const ov=micEl('mic-overlay');
  // click the backdrop (not the panel) to dismiss
  if(ov) ov.addEventListener('click', e=>{ if(e.target===ov) micClose(); });
  document.addEventListener('keydown', e=>{
    const o=micEl('mic-overlay');
    if(e.key==='Escape' && o && !o.hidden){ e.preventDefault(); micClose(); }
  });
  // never keep the mic open in a hidden tab — the hard release overrides the refcount
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden){ micStop(); micReleaseAll(); } });
  addEventListener('pagehide', ()=>{ micStop(); micReleaseAll(); });
})();
