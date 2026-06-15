/* ===================== BACKING BAND (Phase C) =====================
   Turns the loop / sequencer into a jam-along bed: a synthesized bass plays
   root + fifth under the chord, the guitar comp is humanized (velocity accent +
   micro-timing) with a softer push on beat 3, and an optional filtered-noise
   groove (kick on 1 & 3, 8th-note hats) supplies the pulse. Everything is
   scheduled per-bar from inside loopStrum / seqStrumStep, so it shares the bar
   start time and current chord and stays perfectly aligned to Phase B's clock —
   no separate drifting timer. Bass + groove only sound while a backing runs. */
let bassOn=false, grooveOn=false;

/* the chord's actual fifth, derived from its degree map: perfect (7) for most,
   flat-5 (6) for dim / dim7 / m7b5, sharp-5 (8) for aug — so the bass never clashes. */
function fifthInterval(qi){ const q=QUALITIES[qi]; const k=q.deg.indexOf(5); return k>=0 ? q.iv[k] : 7; }

/* short white-noise buffer, cached, for the hi-hat */
let _noiseBuf=null;
function noiseBuf(){ if(_noiseBuf) return _noiseBuf;
  const n=Math.floor(actx.sampleRate*0.1), b=actx.createBuffer(1,n,actx.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=Math.random()*2-1; _noiseBuf=b; return b; }

/* bass voice: triangle fundamental + a quieter sine sub an octave down, through a
   plucky lowpass that opens with velocity then closes — rounded, felt-not-heard. */
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
/* kick: a sine that drops in pitch with a fast amp decay */
function kickHit(when, vel){
  const ctx=audio(); if(!ctx) return; vel=vel==null?1:vel;
  const o=ctx.createOscillator(); o.type='sine';
  o.frequency.setValueAtTime(125, when); o.frequency.exponentialRampToValueAtTime(46, when+0.11);
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.9*vel, when+0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when+0.16);
  o.connect(g).connect(groove); o.start(when); o.stop(when+0.2);
}
/* hi-hat: filtered white noise, very short */
function hatHit(when, vel){
  const ctx=audio(); if(!ctx) return; vel=vel==null?0.6:vel;
  const src=ctx.createBufferSource(); src.buffer=noiseBuf();
  const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=7200;
  const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.22*vel, when+0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when+0.05);
  src.connect(hp).connect(g).connect(groove); src.start(when); src.stop(when+0.08);
}

/* humanized chord comp: micro-timing jitter + per-note velocity variation and a
   slight roll-off down the strum, so repeated bars don't sound machine-stamped. */
function compStrum(base, ivs, when, vel, spread){
  const barSec=beat()*4;
  ivs.forEach((iv,i)=>{
    const tt=when + i*spread + (Math.random()*0.006-0.003);
    const v=vel*(0.9+Math.random()*0.16) - i*0.015;
    pluckAt(base+iv, tt, Math.min(barSec+0.4,2.4), Math.max(0.4, v));
  });
}

/* schedule one bar of the band (bass + groove) for a given chord at bar-start `when`.
   Called from loopStrum / seqStrumStep so it always matches the bar and chord. */
function scheduleBand(pc, qi, when){
  const b=beat(), fifth=fifthInterval(qi), bassRoot=36+pc;
  if(bassOn){
    bassNote(when,                                   bassRoot,       b*1.9, 0.95);  // root on beat 1
    bassNote(when+2*b + (Math.random()*0.012-0.006), bassRoot+fifth, b*1.7, 0.8);   // fifth on beat 3
  }
  if(grooveOn){
    for(let k=0;k<8;k++){                                                            // 8th-note hats
      const tt=when + k*(b/2) + (Math.random()*0.010-0.005);
      hatHit(tt, k===0 ? 1 : (k%2===0 ? 0.7 : 0.5));                                 // accent the downbeat
    }
    kickHit(when,     1);                                                            // kick on 1
    kickHit(when+2*b, 0.9);                                                          // kick on 3
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
  if(metroClock){ removeClock(metroClock); metroClock=null; btn.classList.remove('active'); btn.setAttribute('aria-pressed','false'); setMetroLabel(); return; }
  audio();
  metroClock={ interval:()=>beat(), tick:(time,count)=>metroClick(time, count%4===0) };
  addClock(metroClock);
  btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); setMetroLabel();
}
function setMetroLabel(){ const b=document.getElementById('tb-metro'); b.innerHTML=(metroClock?'&#9632; ':'&#9654; ')+t(metroClock?'tb_metro_on':'tb_metro_off'); b.setAttribute('aria-label', t('tb_metro_off')); }
/* ---- backing band toggles (bass + groove). They take effect on the next bar
   of whatever backing is running, and persist across reloads. ---- */
function setBandLabels(){
  const bb=document.getElementById('tb-bass');
  if(bb){ bb.innerHTML='&#9834; '+t('tb_bass'); bb.classList.toggle('active', bassOn); bb.setAttribute('aria-pressed', bassOn?'true':'false'); bb.setAttribute('aria-label', t('tb_bass')); }
  const db=document.getElementById('tb-drums');
  if(db){ db.innerHTML='&#9835; '+t('tb_drums'); db.classList.toggle('active', grooveOn); db.setAttribute('aria-pressed', grooveOn?'true':'false'); db.setAttribute('aria-label', t('tb_drums')); }
}
function bassToggle(){ audio(); bassOn=!bassOn; setBandLabels(); saveState(); }
function drumsToggle(){ audio(); grooveOn=!grooveOn; setBandLabels(); saveState(); }
function retempo(){}  /* no-op: the metro clock reads beat() live, so tempo glides without a restart */

/* ---- single-chord / single-triad loop: re-strums the current voicing at the top
   of every bar. loopMode is captured at start (chord vs triad) but the voicing is
   read live, so changing root, quality, the selected card, or the triad
   inversion/string set mid-loop follows along. Bar interval read live; dots ride
   the audio-clock queue. The strum sweeps low->high rather than stacking. */
let loopClock=null, loopMode='chord';
function loopStrum(when){
  const ctx=audio(); if(!ctx) return;
  const barSec=beat()*4;
  let midis, pcs, boardId, pc, qi;
  if(loopMode==='triad'){
    const v=currentTriadVoicing();
    midis=v.midis; pcs=v.pcs; boardId='tr-board'; pc=gRoot; qi=TRI_TO_QUAL[trQual];
  } else {
    const v=currentChordVoicing();
    midis=v.midis; pcs=v.pcs; boardId='ch-board'; pc=gRoot; qi=chQual;
  }
  strumMidi(midis, when, 0.9, 0.026, +1);                 // humanized downstrum
  if(bandActive()) strumMidi(midis, when+2*beat(), 0.55, 0.02, +1);   // softer push on beat 3
  scheduleBand(pc, qi, when);                             // bass + groove bed (no-op if both off)
  enqueueVisual(when, ()=>{ const b=document.getElementById(boardId); if(b) pcs.forEach(p=>setDotPlaying(b, p, true)); updateGlobalTransport(); });
  enqueueVisual(when+barSec*0.85, ()=>{ const b=document.getElementById(boardId); if(b) pcs.forEach(p=>setDotPlaying(b, p, false)); });
}
function stopLoopVisual(){ document.querySelectorAll('#ch-board .dot.playing, #tr-board .dot.playing').forEach(d=>d.classList.remove('playing')); }
function loopToggle(){
  const btn=document.getElementById('g-loop');
  if(loopClock){ removeClock(loopClock); loopClock=null; clearVisualQ(); stopLoopVisual();
    btn.classList.remove('active'); btn.setAttribute('aria-pressed','false'); setLoopLabel(); return; }
  if(typeof seqStop==='function') seqStop();
  loopMode = (currentTab==='harmony' && hView==='triads') ? 'triad' : 'chord';
  audio();
  loopClock={ interval:()=>beat()*4, tick:(time)=>loopStrum(time) };
  addClock(loopClock);
  btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); setLoopLabel();
}
function stopLoop(){ if(!loopClock) return; removeClock(loopClock); loopClock=null; clearVisualQ(); stopLoopVisual();
  const b=document.getElementById('g-loop'); if(b){ b.classList.remove('active'); b.setAttribute('aria-pressed','false'); } setLoopLabel(); }
function reloopTempo(){}  /* no-op: the loop clock reads beat() live, so tempo glides */
function setLoopLabel(){ const b=document.getElementById('g-loop'); if(!b) return; b.innerHTML=(loopClock?'&#9632; ':'&#8635; ')+t('b_loop'); b.setAttribute('aria-label', t(loopClock?'b_loop_stop_tip':'b_loop_tip')); b.title=t(loopClock?'b_loop_stop_tip':'b_loop_tip'); updateGlobalTransport(); }

/* ---- global transport chip (timing bar) ----
   Mirrors whatever is currently sounding (single-chord/triad loop or progression)
   so it can be read and stopped from any tab. The Listen/Loop controls now
   live together in the timing bar; the progression Play stays with its strip. */
function loopChordLabel(){ return loopMode==='triad' ? gRootLbl+TRIADS[trQual].short : gRootLbl+QUALITIES[chQual].short; }
function updateGlobalTransport(){
  const wrap=document.getElementById('tb-transport'); if(!wrap) return;
  const label=document.getElementById('tb-transport-label');
  const stop=document.getElementById('tb-stop');
  stop.innerHTML='&#9632; '+t('tb_stop'); stop.setAttribute('aria-label', t('tb_stop'));
  if(seqClock){ label.textContent=t('tb_now_seq')+' · '+gRootLbl+QUALITIES[chQual].short; wrap.hidden=false; }
  else if(loopClock){ label.textContent=t('tb_now_loop')+' · '+loopChordLabel(); wrap.hidden=false; }
  else { wrap.hidden=true; }
}

/* ---- chord progression sequencer ----
   A progression is a list of steps {pc,lbl,qi,bars}. On play it walks the steps
   bar by bar (re-strumming each bar), follows the active chord on the fretboard,
   highlights the active chip, and optionally cycles. Shares the loop's visual
   timer pool and is mutually exclusive with the single-chord loop. */
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
  if(rc){ [...rc.children].forEach(b=>{ const pc=FLAT_ROOTS[b.textContent]!==undefined?FLAT_ROOTS[b.textContent]:NOTES.indexOf(b.textContent); const on=pc===gRoot; b.classList.toggle('active',on); b.setAttribute('aria-pressed', on?'true':'false'); }); }
  buildChQuals();
}
function setChord(pc,lbl,qi){ gRoot=pc; gRootLbl=lbl; chQual=qi; syncChordButtons(); renderChords(); }
function seqChordName(st){ return st.lbl + QUALITIES[st.qi].short; }
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
  const ivs=QUALITIES[st.qi].iv, base=48+st.pc, barSec=beat()*4;
  compStrum(base, ivs, when, 0.9, 0.028);                 // humanized downbeat strum
  if(bandActive()) compStrum(base, ivs, when+2*beat(), 0.55, 0.022);   // softer push on beat 3
  scheduleBand(st.pc, st.qi, when);                       // bass + groove follow the step's chord
  const pcs=ivs.map(iv=>mod(base+iv,12));
  enqueueVisual(when, ()=>{
    if(i!==seqStepIdx){ seqStepIdx=i; setChord(st.pc, st.lbl, st.qi); renderSeq(); updateGlobalTransport(); }  // chord changed → follow on board + chip
    const b=document.getElementById('ch-board'); pcs.forEach(pc=>setDotPlaying(b, pc, true));
  });
  enqueueVisual(when+barSec*0.85, ()=>{ const b=document.getElementById('ch-board'); pcs.forEach(pc=>setDotPlaying(b, pc, false)); });
}
function seqTick(when){
  if(!seqBarMap.length){ seqStop(); return; }
  seqStrumStep(seqBarMap[seqBar], when);
  seqBar++;
  if(seqBar>=seqBarMap.length){
    if(seqLoopOn){ seqBar=0; }
    else { removeClock(seqClock); seqClock=null; setSeqTransport(); enqueueVisual(when+beat()*4, ()=>seqStop()); }  // stop after the final bar rings
  }
}
function seqPlay(){
  if(!seq.length) return;
  if(seqClock){ seqStop(); return; }      // transport is a play/stop toggle
  stopLoop(); audio();
  seqSaved={pc:gRoot, lbl:gRootLbl, qi:chQual};
  seqBuildMap(); seqBar=0; seqStepIdx=-1;
  seqClock={ interval:()=>beat()*4, tick:(time)=>seqTick(time) };
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
function reseqTempo(){}  /* no-op: the seq clock reads beat() live, so tempo glides */
function seqLoopToggle(){ seqLoopOn=!seqLoopOn; setSeqTransport(); saveState(); }
function seqClear(){ seq=[]; if(seqClock) seqStop(); seqStepIdx=-1; renderSeq(); saveState(); }
function setSeqTransport(){
  const p=document.getElementById('seq-play'); if(p){ p.innerHTML=(seqClock?'&#9632; ':'&#9654; ')+t('seq_play'); p.setAttribute('aria-label', t('seq_play')); p.classList.toggle('active', !!seqClock); }
  const l=document.getElementById('seq-loopbtn'); if(l){ l.innerHTML='&#8635; '+t('seq_loop'); l.classList.toggle('active', seqLoopOn); l.setAttribute('aria-pressed', seqLoopOn?'true':'false'); }
  updateGlobalTransport();
}

