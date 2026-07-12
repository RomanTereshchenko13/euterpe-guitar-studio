/* ===================== AUDIO =====================
   Plucked-string synthesis (Karplus-Strong): a short noise burst is fed
   through a short delay line with a damping low-pass in the feedback loop.
   This reproduces the inharmonic, brighter-then-mellowing decay of a real
   string — high strings fade faster than low ones, just like the real thing.
   Voices run through a shared bus: gentle compressor (keeps chords from
   clipping) + a small convolution reverb for body/room. All offline. */
let actx, master, backing, leadTarget, cue, bass, groove, masterOut, busReady=false;
/* user-facing master volume (whole-app output trim, 0..1). Persisted; read into
   masterOut.gain when the bus is built (audio is lazy, created on first gesture). */
let masterVol=1;
function audio(){
  if(!actx){ try{ actx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } setupBus(); }
  if(actx && actx.state==='suspended'){ actx.resume(); }
  return actx;
}
/* Room/body impulse response for the convolution reverb. Not flat white noise (that
   fizzes and reads as "fake reverb") but a shaped space: a sparse cluster of early
   reflections — the size/shape cue of a small wooden room — over a diffuse noise tail
   that decays exponentially AND darkens over time via a progressive one-pole low-pass,
   because air + surface absorption damp the highs first, like a real space. Early
   reflections are sign-flipped + sample-skewed per channel for a natural stereo image.
   `decay` is now the exponential rate (e-foldings across the IR), not a polynomial
   exponent. The ConvolverNode normalizes by default, so this only shapes the colour —
   the wet amount stays set by revGain. Built once at setup. */
function makeIR(dur, decay){
  const rate=actx.sampleRate, len=Math.max(1,Math.floor(rate*dur));
  const buf=actx.createBuffer(2,len,rate);
  const ER=[[7,0.30],[13,0.26],[19,0.20],[29,0.15],[41,0.10],[55,0.07]];   // [delayMs, gain]
  for(let ch=0; ch<2; ch++){
    const d=buf.getChannelData(ch), sign=ch?-1:1, skew=ch?Math.round(rate*0.0006):0;
    let lp=0;
    for(let i=0;i<len;i++){
      const t=i/len;
      const env=Math.exp(-decay*t);                         // exponential diffuse decay
      const a=0.06+0.5*t;                                   // LP coeff grows with t → tail loses treble
      lp += a*((Math.random()*2-1)*env - lp);
      d[i]=lp;
    }
    ER.forEach(([ms,g],k)=>{ const idx=Math.floor(rate*ms/1000)+skew; if(idx<len) d[idx]+=sign*g*(k%2?0.85:1); });
  }
  return buf;
}
function setupBus(){
  if(busReady) return; busReady=true;
  master=actx.createGain(); master.gain.value=0.8;
  const comp=actx.createDynamicsCompressor();
  comp.threshold.value=-16; comp.knee.value=22; comp.ratio.value=3.2;
  comp.attack.value=0.003; comp.release.value=0.25;
  const rev=actx.createConvolver(); rev.buffer=makeIR(1.3, 5.5);   // ~1.3s small-room tail, exponential decay
  const revGain=actx.createGain(); revGain.gain.value=0.14;
  // body resonance: fixed peaking modes color every note like a guitar box
  // (air/Helmholtz ~100 Hz, top plate ~200 Hz, mid cluster ~430 Hz)
  const body=[ [100,1.1,4.0], [200,1.6,3.0], [430,2.2,2.6] ].map(([f,q,g])=>{
    const b=actx.createBiquadFilter(); b.type='peaking'; b.frequency.value=f; b.Q.value=q; b.gain.value=g; return b;
  });
  // user master volume, then a final brickwall limiter so a loud volume or a dense
  // extended chord can't clip the output (the comp above glues, this one catches peaks).
  masterOut=actx.createGain(); masterOut.gain.value=masterVol;
  const limiter=actx.createDynamicsCompressor();
  limiter.threshold.value=-1.5; limiter.knee.value=0; limiter.ratio.value=20;
  limiter.attack.value=0.002; limiter.release.value=0.12;
  master.connect(body[0]); body[0].connect(body[1]); body[1].connect(body[2]);  // dry, through the body
  body[2].connect(comp); comp.connect(masterOut); masterOut.connect(limiter); limiter.connect(actx.destination);
  master.connect(revGain); revGain.connect(rev); rev.connect(comp);             // wet (room)
  // Named buses (Phase B) so later features can balance/duck independently:
  //   backing    — the guitar voice (plucks, loop, sequencer); gets body + room.
  //   leadTarget — reserved for Practice-mode target tones; same colour as backing.
  //   cue        — UI clicks/cues (metronome, count-in, correct/wrong). Skips the
  //                guitar body + reverb so it stays dry and crisp, but shares the limiter.
  backing=actx.createGain();    backing.gain.value=1.0;    backing.connect(master);
  leadTarget=actx.createGain(); leadTarget.gain.value=1.0; leadTarget.connect(master);
  cue=actx.createGain();        cue.gain.value=0.9;        cue.connect(comp);
  // Backing band (Phase C): bass + groove go straight to the limiter, skipping the
  // guitar body resonance + room reverb so the low end stays tight and the drums dry.
  bass=actx.createGain();       bass.gain.value=0.9;       bass.connect(comp);
  groove=actx.createGain();     groove.gain.value=0.85;    groove.connect(comp);
}
/* stereo width: a guitar isn't a point source — spread the voice across the field by
   register (low strings centred, trebles wider) so chords/scales gain width instead of
   collapsing to mono. A tiny random jitter keeps repeated notes from stacking on one
   spot. Degrades to mono where StereoPannerNode is missing (old browsers / jsdom). */
function makePanner(p){ if(!actx.createStereoPanner) return null; const n=actx.createStereoPanner(); n.pan.value=Math.max(-1,Math.min(1,p)); return n; }
function panForMidi(midi){ return Math.max(-0.35, Math.min(0.35, (midi-57)/55)) + (Math.random()*0.06-0.03); }
/* Karplus-Strong buffer, cached per (pitch, string character). Fixed long render;
   the per-voice gain envelope decides how long each note actually rings.
   Adds: pick-position comb on the excitation, a fractional-delay allpass in the
   loop for accurate tuning across the register (integer delay alone goes ~10-20
   cents flat up high), and a woundness bias so low/wound strings ring longer and
   keep more harmonic energy (metallic) while trebles are rounder. */
const ksCache={};
function ksBuffer(freq, wound){
  const rate=actx.sampleRate, key=Math.round(freq*10)+'_'+wound;
  if(ksCache[key]) return ksCache[key];
  const a0=0.5 + 0.12*wound;            // loss-filter mix; higher = brighter, more metallic sustain
  const baseDelay=1 - a0;               // loss filter averages with a newer neighbor → it SHORTENS the loop by ~(1-a0)
  const Dtarget=rate/freq;
  let residual=Dtarget + baseDelay;     // ...so aim long by that much; the allpass takes the fractional remainder
  let N=Math.floor(residual);
  let delta=residual - N;               // fractional remainder handled by the allpass
  if(N<2){ N=2; delta=0; }
  const c=(1-delta)/(1+delta);          // first-order allpass coefficient for fractional delay
  const len=Math.floor(rate*2.8);
  const buf=actx.createBuffer(1, len, rate), out=buf.getChannelData(0);
  // excitation: white noise softened twice → warmer pick, less banjo-like
  const burst=new Float32Array(N);
  let s1=0, s2=0;
  for(let i=0;i<N;i++){ const w=Math.random()*2-1; s1=0.55*s1+0.45*w; s2=0.5*s2+0.5*s1; burst[i]=s2; }
  // pick position: comb the burst (null harmonics at ~1/pickPos); trebles a touch nearer the bridge
  const pickPos=0.12 + 0.05*(1-wound);
  const pd=Math.max(1, Math.round(N*pickPos));
  const delay=new Float32Array(N);
  for(let i=0;i<N;i++){ delay[i]=burst[i] - 0.9*(i>=pd?burst[i-pd]:0); }
  const decay=0.9965 - Math.min(0.02, freq/45000) + 0.0008*wound;   // lower/wound strings ring a little longer
  let idx=0, xprev=0, yprev=0;
  for(let n=0;n<len;n++){
    const cur=delay[idx]; out[n]=cur;
    const nxt=delay[(idx+1)%N];
    const v=decay*(a0*cur + (1-a0)*nxt);   // loss low-pass = string damping
    const y=c*v + xprev - c*yprev;         // fractional-delay allpass = accurate tuning
    xprev=v; yprev=y;
    delay[idx]=y;
    idx=(idx+1)%N;
  }
  ksCache[key]=buf; return buf;
}
function pluck(midi, t0, dur, vel){ const ctx=audio(); if(!ctx) return; pluckAt(midi, ctx.currentTime+(t0||0), dur, vel); }
function pluckAt(midi, when, dur, vel){
  const ctx=audio(); if(!ctx) return;
  dur=dur||1.5;
  vel=Math.max(0.05, Math.min(1, (vel==null?0.82:vel) * (0.94+Math.random()*0.12)));  // touch of humanization
  const now=when;
  const freq=440*Math.pow(2,(midi-69)/12);
  const wound = freq<185 ? 1 : (freq<300 ? 0.5 : 0);     // register-based string character (wound low → plain high)
  const src=ctx.createBufferSource(); src.buffer=ksBuffer(freq, wound);
  src.detune.value=(Math.random()*8-4);                 // tiny human detune (cents)
  const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=85;
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=0.4;
  const open=Math.min(9000, (freq*7+2200)*(0.7+0.5*vel));  // harder pluck = brighter
  lp.frequency.setValueAtTime(open, now);
  lp.frequency.exponentialRampToValueAtTime(Math.max(650, freq*3), now+Math.min(dur,1.6)); // ...mellowing
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.5*(0.4+0.6*vel), now+0.006);  // harder pluck = louder
  g.gain.exponentialRampToValueAtTime(0.0001, now+dur+0.35);
  const pan=makePanner(panForMidi(midi));
  src.connect(hp); hp.connect(lp); lp.connect(g);
  if(pan){ g.connect(pan); pan.connect(backing); } else { g.connect(backing); }
  src.start(now); src.stop(now+Math.min(dur+0.5, 2.7));
}
/* ---- tuner: a sustained reference tone per open string (no mic needed) ----
   Plays the pitch of one open string of the current tuning so you can tune a real
   guitar by ear against it. A clean triangle+sine with a soft attack/release, held
   ~2.6 s, through the guitar bus so it shares the app's body/room colour and the
   master volume. Mono-stable: a fresh tap fades out the previous tone (no pile-up). */
let _tunerVoice=null;
function tunerStop(){
  if(!_tunerVoice) return;
  const v=_tunerVoice; _tunerVoice=null;
  try{ const now=actx.currentTime;
    v.g.gain.cancelScheduledValues(now); v.g.gain.setValueAtTime(Math.max(0.0001, v.g.gain.value), now);
    v.g.gain.exponentialRampToValueAtTime(0.0001, now+0.08);
    v.o.stop(now+0.1); v.o2.stop(now+0.1);
  }catch(e){ /* already stopped */ }
}
function tunerTone(midi){
  const ctx=audio(); if(!ctx) return; tunerStop();
  const now=ctx.currentTime, freq=440*Math.pow(2,(midi-69)/12), dur=2.6;
  const o=ctx.createOscillator();  o.type='triangle'; o.frequency.setValueAtTime(freq, now);
  const o2=ctx.createOscillator(); o2.type='sine';    o2.frequency.setValueAtTime(freq, now); o2.detune.value=3;  // faint shimmer
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.3, now+0.03);          // soft attack
  g.gain.setValueAtTime(0.3, now+dur-0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, now+dur);        // soft release
  o.connect(g); o2.connect(g); g.connect(backing);
  o.start(now); o2.start(now); o.stop(now+dur+0.05); o2.stop(now+dur+0.05);
  _tunerVoice={o, o2, g};
}
/* ---- synced visual highlighting ---- */
let playTimers=[];
function clearPlayHighlights(){ playTimers.forEach(clearTimeout); playTimers=[]; document.querySelectorAll('.dot.playing').forEach(d=>d.classList.remove('playing')); }
function setDotPlaying(boardEl, pc, on){ boardEl.querySelectorAll('.dot').forEach(d=>{ if(d.dataset.midi!=null && mod(parseInt(d.dataset.midi),12)===pc) d.classList.toggle('playing', on); }); }
function flashAt(boardEl, pc, atMs){ playTimers.push(setTimeout(()=>setDotPlaying(boardEl,pc,true), atMs)); }
function pulseAt(boardEl, pc, atMs, lenMs){ flashAt(boardEl,pc,atMs); playTimers.push(setTimeout(()=>setDotPlaying(boardEl,pc,false), atMs+lenMs)); }

/* ===================== TRANSPORT SCHEDULER (Phase B) =====================
   "Two clocks": a coarse setInterval wakes every SCHED_MS and *queues* audio
   events up to LOOKAHEAD seconds ahead on the sample-accurate audio clock, so
   the metronome / loop / sequencer no longer drift the way bare setInterval
   playback does (worst on mobile and in background tabs). Each repeating job is
   a "clock":  { interval():seconds, tick(time,count), next, count }.  interval()
   is read live, so dragging the tempo slider glides instead of restarting.
   Dot-lighting rides the same scheduled times through a requestAnimationFrame
   queue that fires each event once the audio clock passes it — visuals stay
   locked to the sound instead of to jittery setTimeouts. */
const SCHED_MS=25, LOOKAHEAD=0.1, SCHED_LEAD=0.06;
const clocks=new Set();
let schedTimer=null;
function schedAdvance(){
  if(!actx) return;
  const horizon=actx.currentTime+LOOKAHEAD;
  clocks.forEach(c=>{ while(c.next<horizon){ c.tick(c.next, c.count); c.count++; c.next+=Math.max(0.02, c.interval()); } });
}
function addClock(c){ audio(); c.count=0; c.next=actx.currentTime+SCHED_LEAD; clocks.add(c); if(!schedTimer) schedTimer=setInterval(schedAdvance, SCHED_MS); schedAdvance(); }
function removeClock(c){ clocks.delete(c); if(clocks.size===0 && schedTimer){ clearInterval(schedTimer); schedTimer=null; } }

/* visual events scheduled on the audio clock, drained by rAF (not setTimeout) */
const visualQ=[]; let visRAF=null;
function enqueueVisual(time, fn){ visualQ.push({time, fn}); if(!visRAF) visRAF=requestAnimationFrame(visualDrain); }
function clearVisualQ(){ visualQ.length=0; }
function visualDrain(){
  visRAF=null;
  if(!actx) return;
  const now=actx.currentTime;
  visualQ.sort((a,b)=>a.time-b.time);
  while(visualQ.length && visualQ[0].time<=now){ const v=visualQ.shift(); try{ v.fn(); }catch(e){ devWarn('visual callback failed', e); } }
  if(visualQ.length || clocks.size) visRAF=requestAnimationFrame(visualDrain);
}

/* ===================== TIMING CALIBRATION (Phase 3 debt) =====================
   A one-time round-trip latency offset (ms) the scoring window will subtract so a
   tap that *felt* on the beat scores on the beat. Built now (cheap) ahead of the
   first scored/mic tier that consumes it — no scored tap drill exists yet, so this
   only measures + stores the offset and exposes calOffsetSec() for later (the
   roadmap calls it out as needed for tap windows now and reused by mic windows).

   Measure: a steady click runs on the cue bus; the player taps along; each tap is
   matched to its nearest scheduled beat and a trimmed mean of the deltas is the
   offset. The averaging (calcLatencyOffset) is pure + unit-tested; the live tap
   loop rides the same two-clocks scheduler as everything else. */
let calMs = 0;                                       // stored offset, ms (positive = taps land late)
const CAL_MIN = -100, CAL_MAX = 300, CAL_TAPS = 8;   // slider bounds + taps per test
function calOffsetSec(){ return calMs/1000; }        // future scoring windows read this
function clampCal(v){ return Math.max(CAL_MIN, Math.min(CAL_MAX, Math.round(v))); }
// robust centre of the tap deltas: with enough taps, drop the single fastest +
// slowest then mean the rest (kills one fumbled tap); otherwise mean them all.
// Pure, so the harness can assert it directly.
function calcLatencyOffset(deltas){
  const a=(deltas||[]).filter(d=>typeof d==='number' && isFinite(d)).sort((x,y)=>x-y);
  if(!a.length) return 0;
  const trimmed = a.length>=4 ? a.slice(1, a.length-1) : a;
  return clampCal(trimmed.reduce((s,d)=>s+d,0)/trimmed.length);
}
let cal=null;   // { beats:[audioTime…], deltas:[ms…], clock } while a tap test runs
function calStart(){
  const ctx=audio(); if(!ctx) return null;
  calCancel();
  cal={ beats:[], deltas:[], clock:null };
  cal.clock={ interval:()=>beat(), tick:(time,count)=>{ cal.beats.push(time); if(typeof metroClick==='function') metroClick(time, count%4===0); if(cal.beats.length>32) cal.beats.shift(); } };
  if(typeof addClock==='function') addClock(cal.clock);
  return cal;
}
function calCancel(){ if(cal && cal.clock && typeof removeClock==='function') removeClock(cal.clock); cal=null; }
// one tap: match it to the nearest scheduled beat, record the signed delta (ms).
// Returns the running tap count so the UI can advance / finish at CAL_TAPS.
function calTap(now){
  if(!cal) return 0;
  now = (typeof now==='number') ? now : (actx?actx.currentTime:0);
  if(cal.beats.length){
    let nearest=cal.beats[0];
    for(let i=1;i<cal.beats.length;i++){ if(Math.abs(cal.beats[i]-now)<Math.abs(nearest-now)) nearest=cal.beats[i]; }
    cal.deltas.push((now-nearest)*1000);
  }
  return cal.deltas.length;
}
// finish: compute + store the offset from the collected taps, stop the click.
function calFinish(){
  if(!cal) return calMs;
  const off=calcLatencyOffset(cal.deltas);
  calCancel();
  calMs=off;
  return calMs;
}
function setCalMs(v){ calMs=clampCal(typeof v==='number'?v:0); return calMs; }

/* ---- cue sounds (cue bus): short synthesized UI feedback. The metronome uses
   the cue bus; correct / wrong / count-in are foundation primitives consumed by
   Practice, Ear-training and Rhythm modes (roadmap phases D, E, G). ---- */
function cueBlip(when, freq, peak, len, type){
  const ctx=audio(); if(!ctx) return;
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type=type||'square'; o.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when+0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when+len);
  o.connect(g).connect(cue); o.start(when); o.stop(when+len+0.02);
}
function playCue(kind, when){
  const ctx=audio(); if(!ctx) return; when=when||ctx.currentTime;
  if(kind==='correct'){ cueBlip(when, 880, 0.26, 0.09, 'triangle'); cueBlip(when+0.085, 1318.5, 0.26, 0.12, 'triangle'); }  // rising two-tone
  else if(kind==='wrong'){ cueBlip(when, 220, 0.28, 0.16, 'sawtooth'); cueBlip(when+0.005, 207, 0.2, 0.18, 'sawtooth'); }     // low detuned buzz
  else { cueBlip(when, 1500, 0.24, 0.05, 'square'); }                                                                         // count-in tick
}

/* chord/triad: roll up, each note lights and stays lit so the shape builds, then clears */
/* arpeggio + scale animations share the visual timer pool */
/* PREVIEW_STEP: one-shot "Listen" previews arpeggiate at a fixed, pleasant rate
   that is intentionally NOT tied to the practice tempo — Listen is "what does this
   sound like", not part of the groove, so it shouldn't crawl when you slow the
   metronome down. (Loop / progression Play DO follow the tempo: they're backings.) */
const PREVIEW_STEP=0.15;
function animRun(boardEl, base, ivs){
  clearPlayHighlights();
  const step=PREVIEW_STEP, dur=Math.min(0.5, step*1.6);
  ivs.forEach((iv,i)=>{ pluck(base+iv, i*step, dur); pulseAt(boardEl, mod(base+iv,12), i*step*1000, step*1000*0.96); });
}
/* Listen for an explicit voicing: arpeggiate the real MIDI notes (low->high) and
   flash their pitch classes on the given board. Used by the selectable chord
   cards and by the triad view, so Listen matches the shape on screen. */
function animArpMidi(boardEl, midis){
  clearPlayHighlights();
  const step=PREVIEW_STEP;
  midis.forEach((m,i)=>{ pluck(m, i*step, 1.7); if(boardEl) flashAt(boardEl, mod(m,12), i*step*1000); });
  playTimers.push(setTimeout(clearPlayHighlights, ((Math.max(1,midis.length)-1)*step + 1.7)*1000));
}
/* directional strum of explicit MIDI notes: sweeps low->high (down) or high->low
   (up) with a small inter-string delay, micro-timing jitter and a touch of
   top-string emphasis on downstrokes, so a strum reads as a sweep, not a stack. */
function strumMidi(midis, when, vel, spread, dir){
  if(!midis.length) return;
  const order = dir<0 ? midis.slice().reverse() : midis.slice();
  const barSec=beat()*4, n=order.length;
  order.forEach((m,i)=>{
    const tt=when + i*spread + (Math.random()*0.005-0.0025);
    let v=vel*(0.9+Math.random()*0.14) - i*0.012;
    if(dir>=0 && i>=n-2) v+=0.05;                 // brighten the top of a downstroke
    pluckAt(m, tt, Math.min(barSec+0.4,2.4), Math.max(0.4, v));
  });
}

