/* ===================== ONSET DETECTION =====================
   "When did you play?" — energy-based attack detection on the mic signal. Hand-rolled:
   a strum's transient is a big, obvious event (unlike pitch, which is vendored).

   An AudioWorklet, not rAF: a timing score IS the timestamp, and a rAF loop samples
   at ~16.7 ms and stalls under layout — at 120 BPM that is an eighth of a sixteenth's
   window in pure noise. The worklet sees every 128-sample block on the audio thread
   and timestamps against the audio clock. Where AudioWorklet is missing, a
   ScriptProcessor (still audio-thread driven) stands in, never rAF.

   addModule needs a URL, so the processor source becomes a Blob URL at runtime — an
   in-memory object, not a fetch; the app stays one offline file.

   A detected time means something only after the round-trip latency is subtracted
   (14-calibration.js); raw times measure the audio stack, not the player. */

/* Tuned for a steel string in a room, and conservative: a missed onset costs one
   unscored note, a false one corrupts the score of a note you played right. */
const ON_REFRACTORY = 0.055;   // s — two picks closer than this are one attack (>16ths at 200bpm)
const ON_RATIO = 2.6;          // attack when fast envelope exceeds the slow baseline by this factor
const ON_FLOOR = 0.004;        // absolute RMS floor, so room tone can't trigger anything
const ON_FAST_MS = 3;          // fast envelope: tracks the attack itself
const ON_SLOW_MS = 180;        // slow envelope: the adaptive baseline the attack must beat
const ON_MAX_EVENTS = 512;     // ring cap, so a long run can't grow without bound

/* The worklet processor as source text: it compiles in AudioWorkletGlobalScope and
   can't see anything in this file, so everything it needs is baked in. */
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

/* Register a live listener; returns an unsubscribe fn. Listeners get the RAW audio-clock
   time — only the scorer knows what to correct it against. */
function onOnset(fn){
  onsetListeners.push(fn);
  return ()=>{ onsetListeners = onsetListeners.filter(f=>f!==fn); };
}

function onsetPush(t, level){
  onsetEvents.push({ t, level });
  if(onsetEvents.length>ON_MAX_EVENTS) onsetEvents.shift();
  onsetListeners.slice().forEach(fn=>{ try{ fn(t, level); }catch(e){ devWarn('onset listener failed', e); } });
}

/* Start listening (gesture-gated: it acquires the mic). Resolves { ok:true } or
   { ok:false, key } with an i18n key to display. */
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
    // a node with no downstream connection may never be pulled, so park it behind a
    // silent gain — never the speakers, which would be a feedback loop
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

/* ScriptProcessor fallback: deprecated, but it runs off the audio graph with real block
   timestamps. Same detector maths as the worklet. */
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

/* ---- scoring helpers (pure, so the numbers are testable with no microphone) ---- */

/* Match detected times to expected grid times: greedy nearest-match within `tol` s,
   each slot claimed once — a flam around one beat is one hit plus one extra.
   Returns { hits:[{expected, actual, err}], missed:[expected…], extra:[actual…] };
   err is SIGNED: negative = early (rushing), positive = late (dragging). */
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

/* The numbers a player can act on:
     meanAbsMs — how tight you are, the headline
     biasMs    — signed: consistently early or late?
     spreadMs  — standard deviation: evenness. 40 ms late on EVERY note is even but
                 mis-calibrated, ±40 ms at random is not; they need different advice.
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

/* The verdict bands. The setup resolves a few ms, so "tight" below ~15 ms would claim
   precision it doesn't have; ~20 ms is about where a listener hears a note as displaced. */
function onsetVerdict(scoreObj){
  if(!scoreObj.n) return 'on_none';
  if(scoreObj.meanAbsMs <= 20) return 'on_tight';
  if(scoreObj.meanAbsMs <= 45) return 'on_close';
  return 'on_loose';
}
/* Rushing / dragging is a real tendency only when the bias is a sensible slice of the
   spread — otherwise it is noise with a sign. */
function onsetFeel(scoreObj){
  if(!scoreObj.n) return null;
  if(Math.abs(scoreObj.biasMs) < 12 || Math.abs(scoreObj.biasMs) < scoreObj.spreadMs*0.6) return null;
  return scoreObj.biasMs < 0 ? 'on_rushing' : 'on_dragging';
}

/* THE SELF-HEARING GUARD.
   On speakers the mic hears the app's own click, comp and band, which land on the grid
   EXACTLY — after the latency correction they read as a flawless hit on every slot, so
   a player who put the guitar down would score "Tight · 32/32". Timing can't separate
   the two: a perfect note is supposed to arrive with the guide.

   But nobody plays thirty notes within a few ms of the grid; trained hands sit around
   ±10–20 ms, the machine at ~0. So: essentially every slot hit AND a spread tighter
   than any hand, over a long enough run, means the mic is hearing the speakers — refuse
   the score and suggest headphones. Conservative, because a false accusation calls a
   good player a liar. */
const ON_HUMAN_MS = 6;         // tightest spread a human hand plausibly sustains
const ON_SELF_HITRATE = 0.95;  // ...while also hitting essentially every slot
const ON_SELF_MIN_N = 8;       // ...over a run long enough to mean something
function onsetSelfHeard(scoreObj){
  return !!scoreObj && scoreObj.n >= ON_SELF_MIN_N
    && scoreObj.hitRate >= ON_SELF_HITRATE
    && scoreObj.spreadMs < ON_HUMAN_MS;
}
