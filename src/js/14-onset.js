/* ===================== ONSET DETECTION (Phase 8 / F1) =====================
   "When did you play?" — attack detection on the mic signal. This is the first
   SCORING feature in the app: everything before it was a coach that couldn't hear
   you. Hand-rolled, per the dependency policy — unlike pitch (where re-deriving
   McLeod badly is a real risk, hence the vendored detector), energy-based onset
   detection is genuinely the light lift, and a strum's transient is a big obvious
   event rather than a subtle one.

   WHY AN AudioWorklet, when the tuner is happy on the main thread: a tuner needle
   only has to be *approximately* live, but a timing score IS the timestamp. A
   requestAnimationFrame loop samples at ~16.7 ms and stalls under layout, which
   would put ±16 ms of pure harness noise into a measurement whose whole job is to
   tell "tight" from "rushing" — at 120 BPM a sixteenth is 125 ms, so that noise is
   an eighth of the grid. The worklet sees every 128-sample block (2.7 ms at 48k)
   on the audio thread and timestamps against the audio clock, so what we report is
   the player's error, not the browser's.

   The single-file guarantee survives: AudioWorklet.addModule needs a URL, so the
   processor source below is turned into a Blob URL at runtime. That is an
   in-memory object URL, NOT a network fetch — the app still ships as one file and
   still works offline. Where AudioWorklet is missing we fall back to a ScriptProcessor
   (deprecated but universally present, and still audio-thread-driven) rather than
   rAF, so onset TIMES stay honest even on the fallback path.

   Scoring rule the whole phase rests on: a detected time is only meaningful after
   the round-trip latency is subtracted (13-mic.js → 14-calibration.js). Raw onset
   times measure the audio stack, not the player. */

/* Detector constants. Tuned for a plucked/strummed steel string in a room, and
   deliberately conservative: a missed onset costs one unscored note, a false
   onset corrupts the score of a note you played correctly. */
const ON_REFRACTORY = 0.055;   // s — two picks closer than this are one attack (>16ths at 200bpm)
const ON_RATIO = 2.6;          // attack when fast envelope exceeds the slow baseline by this factor
const ON_FLOOR = 0.004;        // absolute RMS floor, so room tone can't trigger anything
const ON_FAST_MS = 3;          // fast envelope: tracks the attack itself
const ON_SLOW_MS = 180;        // slow envelope: the adaptive baseline the attack must beat
const ON_MAX_EVENTS = 512;     // ring cap, so a long run can't grow without bound

/* The worklet processor, as source text. Kept as a string because it has to be
   compiled in a *different global scope* (AudioWorkletGlobalScope) — it cannot see
   anything in this file, so everything it needs is baked in below. */
function onsetProcessorSrc(){
  return `
class OnsetDetector extends AudioWorkletProcessor {
  constructor(opts){
    super();
    const o = (opts && opts.processorOptions) || {};
    this.refractory = o.refractory;
    this.ratio = o.ratio;
    this.floor = o.floor;
    // one-pole smoothing coefficients derived from the time constants
    this.aFast = 1 - Math.exp(-1 / (sampleRate * o.fastMs / 1000));
    this.aSlow = 1 - Math.exp(-1 / (sampleRate * o.slowMs / 1000));
    this.fast = 0; this.slow = 0; this.prev = 0;
    this.last = -1e9;
    this.armed = true;
  }
  process(inputs){
    const ch = inputs[0] && inputs[0][0];
    if(!ch) return true;
    for(let i=0;i<ch.length;i++){
      // Pre-emphasis (y = x - 0.97*x[n-1]) before the envelope: a pick attack is a
      // broadband transient, while the energy that lingers between notes is mostly
      // low-frequency body ring. Differencing tilts the detector toward the attack
      // and away from the sustain, which is the cheap half of spectral flux.
      const x = ch[i];
      const y = x - 0.97 * this.prev;
      this.prev = x;
      const mag = y < 0 ? -y : y;
      this.fast += (mag - this.fast) * this.aFast;
      this.slow += (mag - this.slow) * this.aSlow;
      const tSample = currentTime + i / sampleRate;
      if(this.armed){
        if(this.fast > this.slow * this.ratio + this.floor && tSample - this.last > this.refractory){
          this.last = tSample;
          this.armed = false;
          // Report the audio-clock time of the sample that crossed. Consistently a
          // touch late (the envelope needs a few samples to rise), which is exactly
          // the kind of fixed bias the round-trip calibration absorbs.
          this.port.postMessage({ t: tSample, level: this.fast });
        }
      } else if(this.fast < this.slow * this.ratio * 0.6){
        // Re-arm only once the envelope has fallen well back toward the baseline,
        // so one attack's decay can't ring the trigger a second time.
        this.armed = true;
      }
    }
    return true;
  }
}
registerProcessor('euterpe-onset', OnsetDetector);
`;
}

let onsetNode = null;      // AudioWorkletNode | ScriptProcessorNode
let onsetSink = null;      // muted gain keeping the node pulled by the graph
let onsetModuleUrl = null; // the Blob URL, revoked when we're done with it
let onsetEvents = [];      // ring of detected times (audio clock, UNcorrected)
let onsetOn = false;
let onsetListeners = [];   // fn(timeSec) called live — the drills score from here

function onsetSupported(){
  return micSupported() && typeof AudioWorkletNode !== 'undefined';
}

/* Register a live listener. Returns an unsubscribe fn. Listeners get the RAW
   audio-clock time; correcting for latency is the scorer's job, because only the
   scorer knows whether it's comparing against a scheduled time. */
function onOnset(fn){
  onsetListeners.push(fn);
  return ()=>{ onsetListeners = onsetListeners.filter(f=>f!==fn); };
}

function onsetPush(t, level){
  onsetEvents.push({ t, level });
  if(onsetEvents.length>ON_MAX_EVENTS) onsetEvents.shift();
  onsetListeners.slice().forEach(fn=>{ try{ fn(t, level); }catch(e){ devWarn('onset listener failed', e); } });
}

/* Start listening. Gesture-gated (it acquires the mic). Resolves
   { ok:true } or { ok:false, key } with an i18n key the caller can display. */
async function onsetStart(){
  if(onsetOn) return { ok:true };
  const ctx=audio();
  if(!ctx) return { ok:false, key:'mic_unsupported' };
  const got = await micAcquire();
  if(!got.ok) return got;
  try{
    const opts = { refractory:ON_REFRACTORY, ratio:ON_RATIO, floor:ON_FLOOR,
                   fastMs:ON_FAST_MS, slowMs:ON_SLOW_MS };
    if(typeof AudioWorkletNode !== 'undefined' && ctx.audioWorklet){
      if(!onsetModuleUrl){
        const blob = new Blob([onsetProcessorSrc()], { type:'application/javascript' });
        onsetModuleUrl = URL.createObjectURL(blob);
        await ctx.audioWorklet.addModule(onsetModuleUrl);
      }
      onsetNode = new AudioWorkletNode(ctx, 'euterpe-onset', { processorOptions:opts });
      onsetNode.port.onmessage = e=>{ const d=e.data; if(d && typeof d.t==='number') onsetPush(d.t, d.level); };
    } else {
      onsetNode = onsetFallbackNode(ctx, opts);
      if(!onsetNode){ micRelease(); return { ok:false, key:'mic_unsupported' }; }
    }
    got.src.connect(onsetNode);
    // A node with no downstream connection may never be pulled by the graph, so
    // park it behind a silent gain. Zero gain means nothing reaches the speakers —
    // routing the mic to the output would be a feedback loop, not a monitor.
    onsetSink = ctx.createGain();
    onsetSink.gain.value = 0;
    onsetNode.connect(onsetSink);
    onsetSink.connect(ctx.destination);
    onsetOn = true;
    onsetEvents = [];
    return { ok:true };
  }catch(err){
    devWarn('onset: worklet setup failed', err);
    micRelease();
    return { ok:false, key:'mic_err' };
  }
}

/* ScriptProcessor fallback. Deprecated, but it still runs off the audio graph with
   real block timestamps, which rAF does not — so timing stays trustworthy where
   AudioWorklet is missing. Same detector maths as the worklet, main-thread copy. */
function onsetFallbackNode(ctx, o){
  if(!ctx.createScriptProcessor) return null;
  const node = ctx.createScriptProcessor(256, 1, 1);
  const aFast = 1 - Math.exp(-1/(ctx.sampleRate*o.fastMs/1000));
  const aSlow = 1 - Math.exp(-1/(ctx.sampleRate*o.slowMs/1000));
  let fast=0, slow=0, prev=0, last=-1e9, armed=true;
  node.onaudioprocess = e=>{
    const ch=e.inputBuffer.getChannelData(0);
    // playbackTime is the audio-clock time of the block's first sample
    const base = (typeof e.playbackTime==='number') ? e.playbackTime : ctx.currentTime;
    for(let i=0;i<ch.length;i++){
      const x=ch[i], y=x-0.97*prev; prev=x;
      const mag = y<0 ? -y : y;
      fast += (mag-fast)*aFast;
      slow += (mag-slow)*aSlow;
      const tS = base + i/ctx.sampleRate;
      if(armed){
        if(fast > slow*o.ratio + o.floor && tS-last > o.refractory){
          last=tS; armed=false; onsetPush(tS, fast);
        }
      } else if(fast < slow*o.ratio*0.6){ armed=true; }
    }
  };
  return node;
}

function onsetStop(){
  if(!onsetOn) return;
  onsetOn = false;
  try{ if(onsetNode){ onsetNode.port ? (onsetNode.port.onmessage=null) : (onsetNode.onaudioprocess=null); onsetNode.disconnect(); } }catch(_){}
  try{ if(onsetSink) onsetSink.disconnect(); }catch(_){}
  onsetNode = null; onsetSink = null;
  micRelease();
}

function onsetActive(){ return onsetOn; }
function onsetRecent(){ return onsetEvents.slice(); }
function onsetClear(){ onsetEvents = []; }

/* ---- scoring helpers (pure — asserted directly by the harness) -------------
   These are deliberately free of any DOM or audio dependency: the whole point of
   F1 is that the numbers are defensible, so they have to be testable without a
   microphone in the room. */

/* Match detected times to expected grid times. Greedy nearest-match within
   `tol` seconds, each expected slot claimed at most once — a flam of two picks
   around one beat scores as one hit plus one extra, not two hits.
   Returns { hits:[{expected, actual, err}], missed:[expected…], extra:[actual…] }
   where err is SIGNED: negative = early (rushing), positive = late (dragging). */
function onsetMatch(expected, actual, tol){
  const hits=[], missed=[], usedActual=new Set();
  expected.forEach(e=>{
    let bestI=-1, bestD=Infinity;
    for(let i=0;i<actual.length;i++){
      if(usedActual.has(i)) continue;
      const d=Math.abs(actual[i]-e);
      if(d<bestD){ bestD=d; bestI=i; }
    }
    if(bestI>=0 && bestD<=tol){ usedActual.add(bestI); hits.push({ expected:e, actual:actual[bestI], err:actual[bestI]-e }); }
    else missed.push(e);
  });
  const extra=actual.filter((_,i)=>!usedActual.has(i));
  return { hits, missed, extra };
}

/* Turn a match into the numbers a player can act on.
     meanAbsMs — how tight you are, the headline
     biasMs    — signed: are you consistently early or late? (rushing vs dragging)
     spreadMs  — standard deviation: evenness, independent of bias. A player who is
                 40 ms late on EVERY note is even but mis-calibrated; one who is
                 ±40 ms at random is not. Those need different advice, so they are
                 reported separately rather than collapsed into one number.
     hitRate   — fraction of expected slots actually played */
function onsetScore(match){
  const errs=match.hits.map(h=>h.err*1000);
  const n=errs.length;
  const total=match.hits.length+match.missed.length;
  if(!n) return { n:0, meanAbsMs:0, biasMs:0, spreadMs:0, hitRate:0, extra:match.extra.length };
  const bias=errs.reduce((a,b)=>a+b,0)/n;
  const meanAbs=errs.reduce((a,b)=>a+Math.abs(b),0)/n;
  const variance=errs.reduce((a,b)=>a+(b-bias)*(b-bias),0)/n;
  return { n, meanAbsMs:meanAbs, biasMs:bias, spreadMs:Math.sqrt(variance),
           hitRate: total ? n/total : 0, extra:match.extra.length };
}

/* The verdict band. Thresholds are deliberately honest about what the measurement
   can support: the worklet timestamps to ~2.7 ms and the round-trip calibration
   resolves to a few ms, so a "tight" band below ~15 ms would be claiming precision
   the setup doesn't have. ~20 ms is also roughly where a listener starts to hear
   a note as displaced, which is the thing the player actually cares about. */
function onsetVerdict(scoreObj){
  if(!scoreObj.n) return 'on_none';
  if(scoreObj.meanAbsMs <= 20) return 'on_tight';
  if(scoreObj.meanAbsMs <= 45) return 'on_close';
  return 'on_loose';
}
/* Rushing / dragging only reads as a real tendency once the bias is bigger than a
   sensible slice of the spread — otherwise it's noise with a sign. */
function onsetFeel(scoreObj){
  if(!scoreObj.n) return null;
  if(Math.abs(scoreObj.biasMs) < 12 || Math.abs(scoreObj.biasMs) < scoreObj.spreadMs*0.6) return null;
  return scoreObj.biasMs < 0 ? 'on_rushing' : 'on_dragging';
}
