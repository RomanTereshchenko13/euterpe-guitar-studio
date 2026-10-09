/* ===================== BACKING BAND =====================
   Turns the loop / sequencer into a jam-along bed: bass on root + fifth, a humanized
   guitar comp with a softer push mid-bar, and an optional groove (kick, snare, hats).
   Everything is scheduled per bar from loopStrum / seqStrumStep, so it shares the bar
   start and the chord and can't drift. */
let bassOn=false, grooveOn=false;

/* the chord's actual fifth — perfect, ♭5 (dim / dim7 / m7♭5) or ♯5 (aug) — so the
   bass never clashes */
function fifthInterval(qi){ const q=QUALITIES[qi]; const k=q.deg.indexOf(5); return k>=0 ? q.iv[k] : 7; }

/* short white-noise buffer, cached, for the hi-hat */
let _noiseBuf=null;
function noiseBuf(){ if(_noiseBuf) return _noiseBuf;
  const n=Math.floor(actx.sampleRate*0.1), b=actx.createBuffer(1,n,actx.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=Math.random()*2-1; _noiseBuf=b; return b; }

/* bass: triangle + a quieter sine an octave down, through a plucky low-pass that opens
   with velocity then closes */
function bassNote(when, midi, dur, vel){
  const ctx=audio(); if(!ctx) return;
  vel=Math.max(0.2, Math.min(1, vel==null?0.9:vel));
  const freq=440*Math.pow(2,(midi-69)/12);
  const tri=ctx.createOscillator(); tri.type='triangle'; tri.frequency.setValueAtTime(freq, when); tri.detune.value=(Math.random()*6-3);
  const sub=ctx.createOscillator(); sub.type='sine';     sub.frequency.setValueAtTime(freq/2, when);
  const subG=ctx.createGain(); subG.gain.value=0.45;
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=0.7;
  const open=Math.min(2600, freq*6+420)*(0.6+0.5*vel);
  lp.frequency.setValueAtTime(open, when);
  lp.frequency.exponentialRampToValueAtTime(Math.max(170, freq*2.2), when+Math.min(dur,0.7));
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.42*(0.5+0.5*vel), when+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when+dur+0.12);
  tri.connect(lp); sub.connect(subG); subG.connect(lp); lp.connect(g); g.connect(bass);
  tri.start(when); tri.stop(when+dur+0.2); sub.start(when); sub.stop(when+dur+0.2);
}
/* kick: a sine dropping in pitch with a fast decay, plus a short high-passed noise
   click so the attack reads on small speakers */
function kickHit(when, vel){
  const ctx=audio(); if(!ctx) return; vel=vel==null?1:vel;
  const o=ctx.createOscillator(); o.type='sine';
  o.frequency.setValueAtTime(130, when); o.frequency.exponentialRampToValueAtTime(45, when+0.1);   // a touch more punch
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.9*vel, when+0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when+0.16);
  o.connect(g).connect(groove); o.start(when); o.stop(when+0.2);
  const click=ctx.createBufferSource(); click.buffer=noiseBuf();
  const chp=ctx.createBiquadFilter(); chp.type='highpass'; chp.frequency.value=1800;
  const cg=ctx.createGain();
  cg.gain.setValueAtTime(0.45*vel, when);
  cg.gain.exponentialRampToValueAtTime(0.0001, when+0.02);
  click.connect(chp).connect(cg).connect(groove); click.start(when); click.stop(when+0.03);
}
/* snare: bandpassed noise over a short tonal body, the backbeat */
function snareHit(when, vel){
  const ctx=audio(); if(!ctx) return; vel=vel==null?0.9:vel;
  const src=ctx.createBufferSource(); src.buffer=noiseBuf();
  const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1850; bp.Q.value=0.8;
  const ng=ctx.createGain();
  ng.gain.setValueAtTime(0.0001, when);
  ng.gain.exponentialRampToValueAtTime(0.5*vel, when+0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, when+0.13);
  src.connect(bp).connect(ng).connect(groove); src.start(when); src.stop(when+0.16);
  // a brighter high-passed noise layer for snap
  const src2=ctx.createBufferSource(); src2.buffer=noiseBuf();
  const hp2=ctx.createBiquadFilter(); hp2.type='highpass'; hp2.frequency.value=3500;
  const ng2=ctx.createGain();
  ng2.gain.setValueAtTime(0.0001, when);
  ng2.gain.exponentialRampToValueAtTime(0.26*vel, when+0.002);
  ng2.gain.exponentialRampToValueAtTime(0.0001, when+0.10);
  src2.connect(hp2).connect(ng2).connect(groove); src2.start(when); src2.stop(when+0.12);
  const o=ctx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(190, when);
  const og=ctx.createGain();
  og.gain.setValueAtTime(0.0001, when);
  og.gain.exponentialRampToValueAtTime(0.3*vel, when+0.003);
  og.gain.exponentialRampToValueAtTime(0.0001, when+0.09);
  o.connect(og).connect(groove); o.start(when); o.stop(when+0.12);
}
/* hi-hat: filtered white noise, very short */
function hatHit(when, vel){
  const ctx=audio(); if(!ctx) return; vel=vel==null?0.6:vel;
  const src=ctx.createBufferSource(); src.buffer=noiseBuf();
  const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=7200;
  const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=10000; bp.Q.value=1.1;   // metallic edge, less pure white
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.22*vel, when+0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when+0.05);
  const pan=makePanner(0.18);   // hats sit slightly off-centre (kick/snare/bass stay centred, as in a real mix)
  src.connect(hp).connect(bp).connect(g); if(pan){ g.connect(pan); pan.connect(groove); } else { g.connect(groove); }
  src.start(when); src.stop(when+0.08);
}

/* humanized comp: micro-timing jitter, per-note velocity and a roll-off down the strum,
   so repeated bars don't sound machine-stamped */
function compStrum(base, ivs, when, vel, spread){
  const bs=barSec();
  ivs.forEach((iv,i)=>{
    const tt=when + i*spread + (Math.random()*0.006-0.003);
    const v=vel*(0.9+Math.random()*0.16) - i*0.015;
    pluckAt(base+iv, tt, Math.min(bs+0.4,2.4), Math.max(0.4, v));
  });
}

/* One bar of the band (bass + groove) for a chord at bar start `when`. The loop and
   the sequencer follow the user's bass/drums toggles; a drill passes `force` to
   always lay the bed — comping needs something to play over — without flipping them. */
function scheduleBand(pc, qi, when, force){
  const b=beat(), p=pulseSec(), m=curMeter(), fifth=fifthInterval(qi), bassRoot=36+pc, bOn=force||bassOn, gOn=force||grooveOn;
  if(bOn){
    bassNote(when,                                     bassRoot,       p*1.9, 0.95);  // root on beat 1
    bassNote(when+midPulseSec()+(Math.random()*0.012-0.006), bassRoot+fifth, p*1.7, 0.8);  // fifth mid-bar (beat 3 in 4/4)
  }
  if(gOn){
    const half=b/2, nEighths=Math.max(1, Math.round(barSec()/half));                 // 8th-note hats across the bar
    for(let k=0;k<nEighths;k++){
      const tt=when + k*half + (Math.random()*0.010-0.005);
      hatHit(tt, k===0 ? 1 : (k%2===0 ? 0.7 : 0.5));                                  // accent the downbeat
    }
    m.kick.forEach(pi=>kickHit(when+pi*p, pi===0 ? 1 : 0.9));                         // kick pattern per meter (1&3 in 4/4)
    m.snare.forEach(pi=>snareHit(when+pi*p, 0.9));                                    // backbeat per meter (2&4 in 4/4)
  }
}
function bandActive(){ return bassOn || grooveOn; }

/* ---- metronome (scheduler clock → cue bus) ---- */
let metroClock=null;
function metroClick(when, accent){
  const ctx=audio(); if(!ctx) return;
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type='square'; o.frequency.setValueAtTime(accent?1760:1100, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(accent?0.32:0.2, when+0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when+0.05);
  o.connect(g).connect(cue); o.start(when); o.stop(when+0.06);
}
function metroToggle(){
  const btn=document.getElementById('tb-metro');
  if(metroClock){ removeClock(metroClock); metroClock=null; btn.classList.remove('active'); btn.setAttribute('aria-pressed','false'); setMetroLabel(); setBackingToggle(); syncWakeLock(); return; }
  audio();
  metroClock={ interval:()=>pulseSec(), tick:(time,count)=>metroClick(time, meterGroupStarts().has(count%barBeats())) };
  addClock(metroClock);
  btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); setMetroLabel(); setBackingToggle(); syncWakeLock();
}
function setMetroLabel(){ const b=document.getElementById('tb-metro'); b.innerHTML=(metroClock?'&#9632; ':'&#9654; ')+t(metroClock?'tb_metro_on':'tb_metro_off'); b.setAttribute('aria-label', t('tb_metro_off')); }
/* tint the collapsed Backing toggle while anything in it is running */
function setBackingToggle(){ const b=document.getElementById('backing-toggle'); if(b) b.classList.toggle('on', !!metroClock || bandActive()); }
/* ---- bass + drums toggles ----
   Turning one on while nothing plays starts the single-chord loop, so the band has a
   bar to ride; turning it off leaves the loop running (Stop or Loop ends it). While
   something plays they join on the next bar. Persisted. */
function ensureBacking(){ if(!loopClock && !seqClock) loopToggle(); }   // loopToggle starts when idle
function setBandLabels(){
  const bb=document.getElementById('tb-bass');
  if(bb){ bb.innerHTML='&#9834; '+t('tb_bass'); bb.classList.toggle('active', bassOn); bb.setAttribute('aria-pressed', bassOn?'true':'false'); bb.setAttribute('aria-label', t('tb_bass')); }
  const db=document.getElementById('tb-drums');
  if(db){ db.innerHTML='&#9835; '+t('tb_drums'); db.classList.toggle('active', grooveOn); db.setAttribute('aria-pressed', grooveOn?'true':'false'); db.setAttribute('aria-label', t('tb_drums')); }
}
function bassToggle(){ audio(); bassOn=!bassOn; if(bassOn) ensureBacking(); setBandLabels(); setBackingToggle(); saveState(); }
function drumsToggle(){ audio(); grooveOn=!grooveOn; if(grooveOn) ensureBacking(); setBandLabels(); setBackingToggle(); saveState(); }

/* ---- single-chord / single-triad loop: re-strums the current voicing every bar ----
   loopMode (chord vs triad) is captured at start, but the voicing is read live, so a
   change of root, quality, card or triad shape mid-loop follows along. */
let loopClock=null, loopMode='chord';
function loopStrum(when){
  const ctx=audio(); if(!ctx) return;
  const bs=barSec();
  let midis, pcs, boardId='board', pc, qi;
  if(loopMode==='triad' && chTriadIdx()>=0){   // the chord may have lost its triad mid-loop (sus)
    const v=currentTriadVoicing();
    midis=v.midis; pcs=v.pcs; pc=gRoot; qi=TRI_TO_QUAL[chTriadIdx()];
  } else {
    const v=currentChordVoicing();
    midis=v.midis; pcs=v.pcs; pc=gRoot; qi=chQual;
  }
  strumMidi(midis, when, 0.9, 0.026, +1);                 // humanized downstrum
  if(bandActive()) strumMidi(midis, when+midPulseSec(), 0.55, 0.02, +1);   // softer push mid-bar (beat 3 in 4/4)
  scheduleBand(pc, qi, when);                             // bass + groove bed (no-op if both off)
  enqueueBeats(when);                                     // transport beat pulse
  enqueueVisual(when, ()=>{ const b=document.getElementById(boardId); if(b) pcs.forEach(p=>setDotPlaying(b, p, true)); updateGlobalTransport(); });
  enqueueVisual(when+bs*0.85, ()=>{ const b=document.getElementById(boardId); if(b) pcs.forEach(p=>setDotPlaying(b, p, false)); });
}
function stopLoopVisual(){ document.querySelectorAll('#board .dot.playing').forEach(d=>d.classList.remove('playing')); }
function loopToggle(){
  const btn=document.getElementById('g-loop');
  if(loopClock){ removeClock(loopClock); loopClock=null; clearVisualQ(); stopLoopVisual();
    btn.classList.remove('active'); btn.setAttribute('aria-pressed','false'); setLoopLabel(); return; }
  seqStop();
  loopMode = isBoardMode('triads') ? 'triad' : 'chord';
  audio();
  loopClock={ interval:()=>barSec(), tick:(time)=>loopStrum(time) };
  addClock(loopClock);
  btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); setLoopLabel();
}
function stopLoop(){ if(!loopClock) return; removeClock(loopClock); loopClock=null; clearVisualQ(); stopLoopVisual();
  const b=document.getElementById('g-loop'); if(b){ b.classList.remove('active'); b.setAttribute('aria-pressed','false'); } setLoopLabel(); }
function setLoopLabel(){ const b=document.getElementById('g-loop'); if(!b) return; b.innerHTML=(loopClock?'&#9632; ':'&#8635; ')+t('b_loop'); b.setAttribute('aria-label', t(loopClock?'b_loop_stop_tip':'b_loop_tip')); b.title=t(loopClock?'b_loop_stop_tip':'b_loop_tip'); updateGlobalTransport(); }

/* Stop everything the reference transport owns, on entering Practice: a drill brings
   its own click and bed on its own scheduler, and the reference loop would play over
   it. metroToggle() is the metronome's only stop, so it's called as one. */
function stopReferenceTransport(){
  if(seqClock) seqStop();
  stopLoop();
  if(metroClock) metroToggle();
}

/* ---- global transport chip: what is sounding, readable and stoppable from any tab ---- */
/* beat pulse: pump the transport dot on each scheduled beat, from the same per-bar
   enqueue as the dot-lighting, so the tempo is seen in step with the sound */
function pulseTransport(strong){
  const d=document.querySelector('.tb-transport-dot'); if(!d) return;
  d.classList.remove('bp','bp-strong'); void d.offsetWidth;     // restart the animation
  d.classList.add(strong?'bp-strong':'bp');
}
function enqueueBeats(when){ const p=pulseSec(), n=barBeats(), starts=meterGroupStarts(); for(let k=0;k<n;k++) enqueueVisual(when+k*p, ()=>pulseTransport(k===0 || starts.has(k))); }
function loopChordLabel(){ return noteTxt(gRootLbl)+(loopMode==='triad' && chTriadIdx()>=0 ? curTriad().short : QUALITIES[chQual].short); }
function updateGlobalTransport(){
  const wrap=document.getElementById('tb-transport'); if(!wrap) return;
  const label=document.getElementById('tb-transport-label');
  const stop=document.getElementById('tb-stop');
  stop.innerHTML='&#9632; '+t('tb_stop'); stop.setAttribute('aria-label', t('tb_stop'));
  if(seqClock){ label.textContent=t('tb_now_seq')+' · '+noteTxt(gRootLbl)+QUALITIES[chQual].short; wrap.hidden=false; }
  else if(loopClock){ label.textContent=t('tb_now_loop')+' · '+loopChordLabel(); wrap.hidden=false; }
  else { wrap.hidden=true; }
  // the Jam buttons follow the transport, including when something else stops it
  renderJamBtn();
  syncWakeLock();
}

/* ---- screen wake lock ----
   Keep a phone awake while anything sounds; re-acquired on return to visibility (the
   browser drops it when hidden). Silently absent where the API is (iOS < 16.4, http). */
let _wakeLock=null, _wakeReq=false;
function transportActive(){ return !!(metroClock || loopClock || seqClock); }
function syncWakeLock(){
  if(typeof navigator==='undefined' || !navigator.wakeLock) return;
  const want=transportActive();
  if(want && !_wakeLock && !_wakeReq){
    _wakeReq=true;
    navigator.wakeLock.request('screen').then(wl=>{
      _wakeReq=false;
      if(!transportActive()){ wl.release().catch(()=>{}); return; }   // stopped while the request was in flight
      _wakeLock=wl; wl.addEventListener('release', ()=>{ _wakeLock=null; });
    }).catch(()=>{ _wakeReq=false; });                                 // permission / gesture / unsupported — ignore
  } else if(!want && _wakeLock){
    const wl=_wakeLock; _wakeLock=null; wl.release().catch(()=>{});
  }
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') syncWakeLock(); });
}

/* ---- chord progression sequencer ----
   Steps {pc,lbl,qi,bars}, walked bar by bar: re-strums each bar, follows the chord on
   the fretboard, highlights the chip, optionally cycles. Mutually exclusive with the
   single-chord loop. */
const SEQ_PRESETS = [
  { name:'ii–V–I',     steps:[[2,8,1],[7,6,1],[0,7,2]] },                 // Dm7 · G7 · Cmaj7
  { name:'I–V–vi–IV',  steps:[[0,0,1],[7,0,1],[9,1,1],[5,0,1]] },         // C · G · Am · F
  { name:'I–IV–V',     steps:[[0,0,1],[5,0,1],[7,0,1]] },                 // C · F · G
  { name:'i–iv–V',     steps:[[0,1,1],[5,1,1],[7,6,1]] },                 // Cm · Fm · G7
  { name:'Blues 12',   steps:[[0,6,1],[0,6,1],[0,6,1],[0,6,1],[5,6,1],[5,6,1],[0,6,1],[0,6,1],[7,6,1],[5,6,1],[0,6,1],[7,6,1]] },
];
let seq=[], seqClock=null, seqLoopOn=true, seqBar=0, seqStepIdx=-1, seqBarMap=[], seqSaved=null;

function syncChordButtons(){
  const rc=document.getElementById('g-roots');
  if(rc){ [...rc.children].forEach(b=>{ const on=+b.dataset.pc===gRoot; b.classList.toggle('active',on); b.setAttribute('aria-pressed', on?'true':'false'); }); }
  buildChQuals();
}
function setChord(pc,lbl,qi){ gRoot=pc; gRootLbl=lbl; chQual=qi; syncChordButtons(); renderChords(); }
function seqChordName(st){ return noteTxt(st.lbl) + QUALITIES[st.qi].short; }
function renderSeq(){
  const strip=document.getElementById('seq-strip'); if(!strip) return;
  if(!seq.length){ strip.innerHTML=`<span class="seq-empty">${t('seq_empty')}</span>`; return; }
  strip.innerHTML = seq.map((st,i)=>
    `<span class="seq-chip${i===seqStepIdx?' active':''}" data-i="${i}"><span class="nm">${seqChordName(st)}</span>`+
    `<span class="bars" data-bars="${i}" title="${t('seq_bars')}">${st.bars}</span>`+
    `<span class="x" data-x="${i}" aria-label="remove">×</span></span>`).join('');
}
function buildSeqPresets(){ const c=document.getElementById('seq-presets'); if(!c) return;
  c.innerHTML=SEQ_PRESETS.map((p,i)=>`<button class="btn seq-preset" data-p="${i}">${p.name}</button>`).join(''); }
function applyPreset(p){ const r=gRoot; seq=p.steps.map(([off,qi,bars])=>{ const pc=mod(r+off,12); return {pc, lbl:ROOTS[pc], qi, bars}; }); seqStepIdx=-1; renderSeq(); if(seqClock) seqRebuild(); saveState(); }
function seqAddCurrent(){ seq.push({pc:gRoot, lbl:gRootLbl, qi:chQual, bars:1}); renderSeq(); if(seqClock) seqRebuild(); saveState(); }
function seqBuildMap(){ seqBarMap=[]; seq.forEach((st,i)=>{ for(let b=0;b<Math.max(1,st.bars);b++) seqBarMap.push(i); }); }
function seqStrumStep(i, when){
  const st=seq[i]; if(!st) return;
  const ivs=QUALITIES[st.qi].iv, base=48+st.pc, bs=barSec();
  compStrum(base, ivs, when, 0.9, 0.028);                 // humanized downbeat strum
  if(bandActive()) compStrum(base, ivs, when+midPulseSec(), 0.55, 0.022);   // softer push mid-bar (beat 3 in 4/4)
  scheduleBand(st.pc, st.qi, when);                       // bass + groove follow the step's chord
  enqueueBeats(when);                                     // transport beat pulse
  const pcs=ivs.map(iv=>mod(base+iv,12));
  enqueueVisual(when, ()=>{
    // chord changed → follow on board + chip, without the board-change stagger:
    // this is playback, not a user edit
    if(i!==seqStepIdx){ seqStepIdx=i; _boardStagger=false; setChord(st.pc, st.lbl, st.qi); _boardStagger=true; renderSeq(); updateGlobalTransport(); }
    const b=document.getElementById('board'); pcs.forEach(pc=>setDotPlaying(b, pc, true));
  });
  enqueueVisual(when+bs*0.85, ()=>{ const b=document.getElementById('board'); pcs.forEach(pc=>setDotPlaying(b, pc, false)); });
}
function seqTick(when){
  if(!seqBarMap.length){ seqStop(); return; }
  seqStrumStep(seqBarMap[seqBar], when);
  seqBar++;
  if(seqBar>=seqBarMap.length){
    if(seqLoopOn){ seqBar=0; }
    else { removeClock(seqClock); seqClock=null; setSeqTransport(); enqueueVisual(when+barSec(), ()=>seqStop()); }  // stop after the final bar rings
  }
}
function seqPlay(){
  if(!seq.length) return;
  if(seqClock){ seqStop(); return; }      // transport is a play/stop toggle
  stopLoop(); audio();
  seqSaved={pc:gRoot, lbl:gRootLbl, qi:chQual};
  seqBuildMap(); seqBar=0; seqStepIdx=-1;
  seqClock={ interval:()=>barSec(), tick:(time)=>seqTick(time) };
  addClock(seqClock);
  setSeqTransport();
}
function seqStop(){
  if(seqClock){ removeClock(seqClock); seqClock=null; }
  clearVisualQ(); stopLoopVisual();
  seqStepIdx=-1;
  if(seqSaved){ setChord(seqSaved.pc, seqSaved.lbl, seqSaved.qi); seqSaved=null; }
  renderSeq(); setSeqTransport();
}
function seqRebuild(){ if(seqClock){ seqBuildMap(); if(seqBar>=seqBarMap.length) seqBar=0; } }  // clock keeps ticking; just refresh the map
function seqLoopToggle(){ seqLoopOn=!seqLoopOn; setSeqTransport(); saveState(); }
function seqClear(){ seq=[]; if(seqClock) seqStop(); seqStepIdx=-1; renderSeq(); saveState(); }
function setSeqTransport(){
  // these act on the whole PROGRESSION, the header's Listen/Loop on the current chord —
  // the tooltips say so
  const p=document.getElementById('seq-play'); if(p){ p.innerHTML=(seqClock?'&#9632; ':'&#9654; ')+t('seq_play'); p.setAttribute('aria-label', t('seq_play_tip')); p.title=t('seq_play_tip'); p.classList.toggle('active', !!seqClock); }
  const l=document.getElementById('seq-loopbtn'); if(l){ l.innerHTML='&#8635; '+t('seq_loop'); l.setAttribute('aria-label', t('seq_loop_tip')); l.title=t('seq_loop_tip'); l.classList.toggle('active', seqLoopOn); l.setAttribute('aria-pressed', seqLoopOn?'true':'false'); }
  updateGlobalTransport();
}

