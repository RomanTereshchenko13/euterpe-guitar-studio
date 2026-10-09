/* ===================== Drill: Subdivision & timing =====================
   Pick a subdivision (quarters → 16ths) and a tempo; an accented click ticks the grid
   (bar downbeat > beat > subdivision), a visual grid pulses each slot, and the key's
   scale is walked note by note in one box so there is something to play. With the mic
   on, a scored run (13-scored.js). A run of ≥1 bar records a session. */

/* subdivisions per beat; en/uk inline so the i18n check only guards the I18N table */
const SUBDIVS = [
  { id:'quarter',   div:1, en:'Quarter notes', uk:'Чвертки' },
  { id:'eighth',    div:2, en:'Eighth notes',  uk:'Вісімки' },
  { id:'triplet',   div:3, en:'Triplets',      uk:'Тріолі' },
  { id:'sixteenth', div:4, en:'Sixteenths',    uk:'Шістнадцятки' },
];
function sdSubName(s){ return lang==='en'?s.en:s.uk; }
const SD_BEATS = 4;   // the grid is always one 4/4 bar — it does not follow the time signature

let sdSub = 1;        // index into SUBDIVS (default eighths)
let sdPos = 1;        // neck box (1–5, boxWindow) the scale is walked inside
let sdNotes = true;   // walk a scale note per tick (off = pure metronome grid)
let sd = null;
let sdLit = null;     // the currently-lit board dot (so we can clear it next tick)
// sd = { playing, clock, count, bars, div, path, pathIdx }

/* Every grid tick is a slot you're expected to play, so the tolerance is half a
   subdivision — wider would steal the neighbouring slot's note. */
const sdScore = scoredRun({
  micId:'drill-ctx-mic', statusId:'sd-status', scoreId:'sd-score', countKey:'on_played',
  tol:()=>beat()/(sd?sd.div:2)/2,
  onChange:()=>{ if(sd) renderTiming(); },
});

/* the key's scale notes inside the box, walked up then down (turnarounds not repeated),
   so consecutive notes are neighbours. Returns [{si,f,midi}…]. */
function sdPath(){
  const s=SCALES[scIdx], win=boxWindow(sdPos)||[0,4], lo=win[0], hi=win[1];
  const scPcs=new Set(s.iv.map(iv=>mod(gRoot+iv,12))), pool=[];
  for(let si=0; si<6; si++) for(let f=lo; f<=hi; f++){ const midi=OPEN_MIDI[si]+f; if(scPcs.has(midi%12)) pool.push({si, f, midi}); }
  pool.sort((a,b)=>a.midi-b.midi);
  if(pool.length<2) return pool;
  return pool.concat(pool.slice(1,-1).reverse());   // up then down (no repeated turnaround)
}

/* a 3-level click on the cue bus: bar downbeat (2) > beat (1) > subdivision (0) */
function sdClick(when, level){
  const ctx=audio(); if(!ctx) return;
  const o=ctx.createOscillator(), g=ctx.createGain();
  const freq = level===2 ? 2093 : level===1 ? 1319 : 880;     // C7 / E6 / A5
  const peak = level===2 ? 0.34 : level===1 ? 0.22 : 0.11;
  o.type='square'; o.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when+0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when+0.045);
  o.connect(g).connect(cue); o.start(when); o.stop(when+0.06);
}

/* ---- lifecycle ---- */
function startTiming(){
  sd={ playing:false, clock:null, count:0, bars:0, div:SUBDIVS[sdSub].div, path:[], pathIdx:0 };
  sdScore.clearScore();
  const home=document.getElementById('practice-home'), area=document.getElementById('sd-area');
  if(home) home.hidden=true; if(area) area.hidden=false;
  drillShellEnter();          // name the header, open the setup, reveal the hint once
  sdRenderBoard();
  renderTiming();
}
function exitTiming(){
  sdStop();
  sdScore.release();     // never leave the mic open behind a closed drill
  sd=null; sdLit=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('sd-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  renderPractice();
}
function sdToggle(){ if(sd && sd.playing) sdStop(); else sdPlay(); }
function sdPlay(){
  if(!sd || sd.playing) return;
  audio();
  stopLoop();   // don't fight the reference loop / progression
  seqStop();
  drillRunStarted();                             // fold the setup — the run owns the screen
  sd.playing=true; sd.count=0; sd.bars=0; sd.pathIdx=0;
  sd.div=SUBDIVS[sdSub].div; sd.path=sdPath();
  sdScore.begin();                               // before the clock: a tick must not
  sd.clock={ interval:()=>beat()/sd.div, tick:(time,count)=>sdTick(time,count) };
  addClock(sd.clock);       // ...land in a run we then reset
  renderTiming();
}
function sdStop(){
  if(!sd || !sd.playing) return;
  if(sd.clock){ removeClock(sd.clock); sd.clock=null; }
  clearVisualQ();
  sd.playing=false;
  if(sdLit){ sdLit.classList.remove('on'); sdLit=null; }
  document.querySelectorAll('#sd-grid .sd-cell.on').forEach(c=>c.classList.remove('on'));
  const sc=sdScore.end();
  if(sd.bars>=1){
    // The score stays "bars played", and a scored run's timing error rides alongside as
    // `err`, so the timing trend can be charted.
    recordSession('timing:'+SUBDIVS[sdSub].id, sd.bars, undefined, scoredErr(sc));
    saveState();
    renderPractice();
  }
  renderTiming();
}
/* a subdivision / box / key change applies live, without dropping the bar count */
function sdRestart(){
  if(!sd || !sd.playing) return;
  if(sd.clock) removeClock(sd.clock);
  clearVisualQ();
  sd.div=SUBDIVS[sdSub].div; sd.path=sdPath(); sd.pathIdx=0;
  sd.clock={ interval:()=>beat()/sd.div, tick:(time,count)=>sdTick(time,count) };
  addClock(sd.clock);
}
function sdTick(when, count){
  if(!sd) return;
  const div=sd.div, perBar=div*SD_BEATS, pos=count%perBar, sub=pos%div;
  if(pos===0 && count>0) sd.bars++;
  const level = pos===0 ? 2 : sub===0 ? 1 : 0;                 // bar downbeat > beat > subdivision
  sdClick(when, level);
  // remember where the grid WAS on the audio clock: scoring compares against these
  // scheduled times, never wall-clock guesses
  if(sd.playing) sdScore.mark(when);
  if(sdNotes && sd.path.length){
    const n=sd.path[sd.pathIdx % sd.path.length]; sd.pathIdx++;
    pluckAt(n.midi, when, Math.min(0.5, beat()/div*0.9), 0.82);
    enqueueVisual(when, ()=>sdLightNote(n.si, n.f));
  }
  enqueueVisual(when, ()=>sdHighlightCell(pos));
}

/* ---- DOM paint (no-ops cleanly when the panel isn't in the DOM, e.g. some tests) ---- */
function renderTiming(){
  if(!sd) return;
  segButtons('sd-subs', SUBDIVS.map(s=>({label:sdSubName(s)})), sdSub, i=>{ sdSub=i; renderSdGrid(); sdRestart(); renderTiming(); });
  segButtons('sd-pos', ['1','2','3','4','5'].map(label=>({label})), sdPos-1, i=>{ sdPos=i+1; sdPaintScale(); sdRestart(); });
  const tt=document.getElementById('sd-title'); if(tt) tt.textContent=noteTxt(gRootLbl)+' · '+sName(SCALES[scIdx]);
  const nb=document.getElementById('sd-notes'); if(nb){ nb.textContent=t('sd_notes'); nb.classList.toggle('active', sdNotes); nb.setAttribute('aria-pressed', sdNotes?'true':'false'); }
  renderSdGrid();
  const pb=document.getElementById('sd-play'); if(pb){ pb.innerHTML=(sd.playing?'&#9632; ':'&#9654; ')+t(sd.playing?'sp_stop':'sp_play'); pb.classList.toggle('active', sd.playing); pb.setAttribute('aria-pressed', sd.playing?'true':'false'); }
  // with the mic off this is a coach that cannot hear you, and the hint says so
  const hint=document.getElementById('sd-hint'); if(hint) hint.textContent=t(sdScore.on()?'sd_hint_scored':'sd_hint');
  sdScore.render();
  applyDrillCtx();     // the mic's visibility is the shell's, and it follows availability
}
/* one grid row of SD_BEATS·div cells; downbeat and beats read stronger, with the beat
   number under each beat cell */
function renderSdGrid(){
  const g=document.getElementById('sd-grid'); if(!g) return;
  const div=SUBDIVS[sdSub].div, n=SD_BEATS*div, cur=(sd&&sd.playing)?-2:-1, cells=[];
  for(let pos=0; pos<n; pos++){
    const sub=pos%div, beatIdx=Math.floor(pos/div);
    const cls = pos===0 ? 'down' : sub===0 ? 'beat' : 'sub';
    cells.push(`<div class="sd-cell ${cls}${pos===cur?' on':''}" data-pos="${pos}"><span class="sd-lab">${sub===0?(beatIdx+1):''}</span></div>`);
  }
  g.style.gridTemplateColumns='repeat('+n+', 1fr)';
  g.innerHTML=cells.join('');
}
function sdHighlightCell(pos){
  document.querySelectorAll('#sd-grid .sd-cell').forEach(c=>c.classList.toggle('on', +c.dataset.pos===pos));
}
function sdRenderBoard(){
  const el=document.getElementById('sd-board'); if(!el) return;
  renderBoard(el, (pc,si,f)=>{ const d=document.createElement('div'); d.className='dot sd-dot'; d.dataset.si=si; d.dataset.f=f; return d; });
  renderNums(document.getElementById('sd-nums'));
  sdLit=null;
  sdPaintScale();
}
/* dim-light the box palette so you always see the shape you're walking (even paused) */
function sdPaintScale(){
  const s=SCALES[scIdx], win=boxWindow(sdPos)||[0,4], lo=win[0], hi=win[1];
  const scPcs=new Set(s.iv.map(iv=>mod(gRoot+iv,12)));
  document.querySelectorAll('#sd-board .sd-dot').forEach(d=>{
    const si=+d.dataset.si, f=+d.dataset.f, inBox=f>=lo&&f<=hi&&scPcs.has((OPEN_MIDI[si]+f)%12);
    d.classList.toggle('pal', inBox);
  });
}
function sdLightNote(si, f){
  if(sdLit) sdLit.classList.remove('on');
  const d=document.querySelector('#sd-board .sd-dot[data-si="'+si+'"][data-f="'+f+'"]');
  if(d){ d.classList.add('on'); rippleDot(d); }
  sdLit=d||null;
}
// re-localize an in-flight drill on a language switch
function refreshTimingLang(){
  if(!sd) return;
  renderTiming();
  sdScore.refreshLang();
}

registerDrill({ id:'timing', area:'sd-area', tempo:true, setup:'sd-setup',
                tracks:[{ id:'timing', kind:'perf', sess:'timing', label:'drill_timing',
                          better:'high', unit:'bars', scored:'mic', start:startTiming }],
                isActive:()=>!!sd, exit:exitTiming, refreshLang:refreshTimingLang,
                // the header's mic, offered wherever onset detection can run
                mic:()=>sdScore.available(),
                // stop first: switching tiers mid-run would change what a score in progress measures
                onMic:()=>{ if(sd&&sd.playing) sdStop(); sdScore.toggle(); renderTiming(); },
                // the grid walks the key's scale, so a key change repaints the board and restarts
                onKey:()=>{ if(!sd) return; sdRenderBoard(); sdRestart(); renderTiming(); } });

(function initTiming(){
  const area=document.getElementById('sd-area'); if(!area) return;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('sd-play',   sdToggle);
  wire('sd-notes',  ()=>{ sdNotes=!sdNotes; if(!sdNotes && sdLit){ sdLit.classList.remove('on'); sdLit=null; } renderTiming(); });
})();
