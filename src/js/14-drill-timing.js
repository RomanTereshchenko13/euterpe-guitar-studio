/* ===================== Drill: Subdivision & timing (Phase 7a) =====================
   The Foundations coach that serves BOTH pillars — subdivision command. Pick a
   subdivision (quarters → 8ths → triplets → 16ths) + tempo; an accented click grid
   ticks it out (bar downbeat > beat > subdivision), a visual grid pulses each slot,
   and the current key's scale (SCALES[scIdx] rooted at gRoot, spine #1) is WALKED
   note-by-note across the grid in one Phase-2 box so there's something to play. A
   smart visual metronome. Two tiers: a screen-only coach, and — with the mic on —
   a scored run via the shared 13-scored.js layer (Phase 8/F1). A practiced run
   (≥1 full bar) lands a session in the learner's ring buffer (13) so Practice
   progress reflects it, minting no per-item SRS.

   Reuses the two-clocks scheduler (05: addClock/beat/enqueueVisual), the cue bus for
   the click, pluckAt (05) for the walked notes, the shared board paint (renderBoard,
   07) on its OWN display board, boxWindow (10) for the shape, and an in-drill key +
   position + tempo picker (the roadmap's "tempo reachability" for a timed coach). */

/* subdivisions per beat: 1 = quarter, 2 = eighth, 3 = triplet, 4 = sixteenth.
   en/uk names inline (like STRUM_PATTERNS/SP_SWINGS) so the i18n symmetry check only
   guards the I18N table. */
const SUBDIVS = [
  { id:'quarter',   div:1, en:'Quarter notes', uk:'Чвертки' },
  { id:'eighth',    div:2, en:'Eighth notes',  uk:'Вісімки' },
  { id:'triplet',   div:3, en:'Triplets',      uk:'Тріолі' },
  { id:'sixteenth', div:4, en:'Sixteenths',    uk:'Шістнадцятки' },
];
function sdSubName(s){ return lang==='en'?s.en:s.uk; }
const SD_BEATS = 4;   // 4/4 for now — meters (3/4, 6/8…) land with Phase 7b (time signatures)

let sdSub = 1;        // index into SUBDIVS (default eighths — the workhorse subdivision)
let sdPos = 1;        // neck box (1–5, Phase 2 boxWindow) the scale is walked inside
let sdNotes = true;   // walk a scale note per tick (off = pure metronome grid)
let sd = null;
let sdLit = null;     // the currently-lit board dot (so we can clear it next tick)
// sd = { playing, clock, count, bars, div, path, pathIdx }

/* Phase 8/F1 scored tier (13-scored.js). Every grid tick is a slot you're expected
   to play, so the tolerance is half a subdivision — matching wider than that would
   start stealing the neighbouring slot's note. */
const sdScore = scoredRun({
  micId:'drill-ctx-mic', statusId:'sd-status', scoreId:'sd-score', countKey:'on_played',
  tol:()=>beat()/(sd?sd.div:2)/2,
  onChange:()=>{ if(sd) renderTiming(); },
});

/* the scale-note positions of the current key inside the chosen box, walked ascending
   then descending (turnaround endpoints dropped) so consecutive notes are neighbours —
   a smooth run up and down the shape, not leaps. Returns [{si,f,midi}…]. */
function sdPath(){
  const s=SCALES[scIdx], win=boxWindow(sdPos)||[0,4], lo=win[0], hi=win[1];
  const scPcs=new Set(s.iv.map(iv=>mod(gRoot+iv,12))), pool=[];
  for(let si=0; si<6; si++) for(let f=lo; f<=hi; f++){ const midi=OPEN_MIDI[si]+f; if(scPcs.has(midi%12)) pool.push({si, f, midi}); }
  pool.sort((a,b)=>a.midi-b.midi);
  if(pool.length<2) return pool;
  return pool.concat(pool.slice(1,-1).reverse());   // up then down (no repeated turnaround)
}

/* a 3-level click on the cue bus: bar downbeat (2) > beat (1) > subdivision (0), so the
   pulse of the bar is audible under the even subdivisions. Mirrors metroClick (06) but
   with a third, quieter tier for the in-between subdivisions. */
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
  drillShellEnter();          // B2: name the header, open the setup, reveal the hint once
  sdRenderBoard();
  renderTiming();
}
function exitTiming(){
  sdStop();
  sdScore.release();     // belt and braces: never leave the mic open behind a closed drill
  sd=null; sdLit=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('sd-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderPractice==='function') renderPractice();
}
function sdToggle(){ if(sd && sd.playing) sdStop(); else sdPlay(); }
function sdPlay(){
  if(!sd || sd.playing) return;
  audio();
  if(typeof stopLoop==='function') stopLoop();   // don't fight the reference loop / progression
  if(typeof seqStop==='function') seqStop();
  drillRunStarted();                             // B2: fold the setup — the run owns the screen
  sd.playing=true; sd.count=0; sd.bars=0; sd.pathIdx=0;
  sd.div=SUBDIVS[sdSub].div; sd.path=sdPath();
  sdScore.begin();                               // before the clock: a tick must not
  sd.clock={ interval:()=>beat()/sd.div, tick:(time,count)=>sdTick(time,count) };
  if(typeof addClock==='function') addClock(sd.clock);       // ...land in a run we then reset
  renderTiming();
}
function sdStop(){
  if(!sd || !sd.playing) return;
  if(sd.clock){ if(typeof removeClock==='function') removeClock(sd.clock); sd.clock=null; }
  if(typeof clearVisualQ==='function') clearVisualQ();
  sd.playing=false;
  if(sdLit){ sdLit.classList.remove('on'); sdLit=null; }
  document.querySelectorAll('#sd-grid .sd-cell.on').forEach(c=>c.classList.remove('on'));
  const sc=sdScore.end();
  if(sd.bars>=1){
    // The session value stays "bars played" so pre-F1 history keeps the same shape
    // and the progress card doesn't have to know two kinds of timing session. The
    // score is a richer read-out of the run, not a different record — so as of
    // Phase 10/B1 it rides ALONGSIDE as `err` instead of being shown once and
    // discarded, which is what "the timing trend in milliseconds" needs to exist.
    recordSession('timing:'+SUBDIVS[sdSub].id, sd.bars, undefined, scoredErr(sc));
    saveState();
    if(typeof renderPractice==='function') renderPractice();
  }
  renderTiming();
}
/* apply a subdivision / box / key change live: rebuild the path + clock without dropping
   the accumulated bar count, so tweaking mid-run doesn't reset your session. */
function sdRestart(){
  if(!sd || !sd.playing) return;
  if(sd.clock && typeof removeClock==='function') removeClock(sd.clock);
  if(typeof clearVisualQ==='function') clearVisualQ();
  sd.div=SUBDIVS[sdSub].div; sd.path=sdPath(); sd.pathIdx=0;
  sd.clock={ interval:()=>beat()/sd.div, tick:(time,count)=>sdTick(time,count) };
  if(typeof addClock==='function') addClock(sd.clock);
}
function sdTick(when, count){
  if(!sd) return;
  const div=sd.div, perBar=div*SD_BEATS, pos=count%perBar, sub=pos%div;
  if(pos===0 && count>0) sd.bars++;
  const level = pos===0 ? 2 : sub===0 ? 1 : 0;                 // bar downbeat > beat > subdivision
  sdClick(when, level);
  // F1: remember where the grid actually WAS on the audio clock. Scoring compares
  // against these scheduled times, never against wall-clock guesses.
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
  const tt=document.getElementById('sd-title'); if(tt) tt.textContent=gRootLbl+' · '+sName(SCALES[scIdx]);
  const nb=document.getElementById('sd-notes'); if(nb){ nb.textContent=t('sd_notes'); nb.classList.toggle('active', sdNotes); nb.setAttribute('aria-pressed', sdNotes?'true':'false'); }
  renderSdGrid();
  const pb=document.getElementById('sd-play'); if(pb){ pb.innerHTML=(sd.playing?'&#9632; ':'&#9654; ')+t(sd.playing?'sp_stop':'sp_play'); pb.classList.toggle('active', sd.playing); pb.setAttribute('aria-pressed', sd.playing?'true':'false'); }
  // The hint has to tell the truth about which tier you're in: with the mic off this
  // is still a coach that cannot hear you, and saying otherwise would be the exact
  // over-claim the roadmap warns against.
  const hint=document.getElementById('sd-hint'); if(hint) hint.textContent=t(sdScore.on()?'sd_hint_scored':'sd_hint');
  sdScore.render();
  applyDrillCtx();     // B2: the mic's visibility is the shell's, and it follows availability
}
/* one grid row of SD_BEATS·div cells: the bar downbeat + beats read stronger than the
   in-between subdivisions, with the beat number under each beat cell. */
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
  if(d){ d.classList.add('on'); if(typeof rippleDot==='function') rippleDot(d); }
  sdLit=d||null;
}
/* The private tempo stepper this drill used to carry lived here (sdSetTempo), together
   with the code that kept the header slider in sync with it. Phase 10/A1 collapsed the
   two controls into one: the drill declares `tempo:true` below and the shell's
   #drill-ctx stepper drives the shared setTempo(). */
// re-localize an in-flight timing drill on a language switch (called from applyLang)
function refreshTimingLang(){
  if(!sd) return;
  renderTiming();
  sdScore.refreshLang();
}

registerDrill({ id:'timing', area:'sd-area', tempo:true, setup:'sd-setup',
                tracks:[{ id:'timing', kind:'perf', sess:'timing', label:'drill_timing',
                          better:'high', unit:'bars', start:startTiming }],
                isActive:()=>!!sd, exit:exitTiming, refreshLang:refreshTimingLang,
                // B2: the shared header's mic, offered wherever onset detection can run
                mic:()=>sdScore.available(),
                // Toggling the mic mid-run would change the tier under a score in progress,
                // so it stops first and the next run is measured cleanly from its first tick.
                onMic:()=>{ if(sd&&sd.playing) sdStop(); sdScore.toggle(); renderTiming(); },
                // the grid walks the key's scale, so a key change repaints the board and restarts
                onKey:()=>{ if(!sd) return; sdRenderBoard(); sdRestart(); renderTiming(); } });

(function initTiming(){
  const area=document.getElementById('sd-area'); if(!area) return;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('sd-play',   sdToggle);
  wire('sd-notes',  ()=>{ sdNotes=!sdNotes; if(!sdNotes && sdLit){ sdLit.classList.remove('on'); sdLit=null; } renderTiming(); });
})();
