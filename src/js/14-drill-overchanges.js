/* ===================== Drill: Over the changes (Phase 5c + 6a/6b/6c, merged) =====================
   One machine, two things to practise over a looping progression: COMP it (play the right
   chord at the right time — the Rhythm pillar) or play its CHORD TONES (aim at the tones of
   the chord that is sounding — the Lead pillar). A chosen progression cycles with a forced
   backing band; a big NOW + a NEXT preview + a beat indicator land each change in time.

   This was two drills. "Comp the progression" (5c) and "Chord-tone targeting" (6a/6b/6c) ran
   the same SEQ_PRESETS through the same bar expansion, on the same barSec() clock, with the
   same scheduleBand(force)+compStrum bed, the same NOW/NEXT stage and the same beat dots —
   6a's markup even reused 5c's co-stage/co-slot/co-beats CSS. The only real differences are
   what you're asked to play and how it's scored, which is now a mode:

     chords  — a loud guide comp + a mid-bar push, chord DIAGRAMS in NOW/NEXT, no board.
               Records comp:<progression> scored by bars comped. Coach tier.
     tones   — a lighter comp so your line sits on top, chord NAMES in NOW/NEXT, and a
               tappable neck whose lit dots are the current chord's tones. Position windows
               them to one arpeggio box (6b, Phase 2's boxWindow); Target narrows them to a
               single degree (6c). Records target:<progression> scored by accuracy.

   Both session namespaces are kept, so progress recorded before the merge still reads.

   Honest framing (roadmap): with no mic, `tones` trains WHERE the chord tones are — a
   location/recognition game, not soloing. Tap input is scored on ACCURACY (right tones vs
   wrong notes), never on timing (touch latency corrupts timing — the coach-tier rule); real
   "play your guitar and get scored" waits on Phase 8/F2. Neither mode mints per-item SRS —
   the looping shape derives from the sessions ring buffer, so the pinned learner item shape
   (spine #3) stays untouched.

   The DOM ids stay `tg-*` from the targeting drill: they're the shared vocabulary of the CSS
   and the smoke suite, and renaming them would be churn with no user-visible effect. */

let tgIdx = 1;          // selected progression (default I–V–vi–IV)
let tgMode = 'tones';   // 'chords' (comp it) | 'tones' (play its chord tones)
let tgDrill = null;

/* Phase 8/F1 scored tier — `chords` mode only (13-scored.js).
   WHAT IT SCORES, and why it isn't every strum: comping is your own rhythm. The
   drill has no business telling you how many times to hit the chord inside a bar,
   so it scores the thing the exercise is actually about — LANDING THE CHANGE. The
   expected times are the bar downbeats; strums you play in between are your feel,
   and land in `extra`, which is not penalised. Hence the count row says "changes",
   not "played": it is the number of changes you arrived on in time.
   Tolerance is half a beat — a chord change is a coarser target than a 16th, and
   a stricter window would just measure strum-spread noise.
   `tones` mode stays tap-scored on accuracy: touch latency corrupts timing, which
   is the coach-tier rule, and real lead scoring waits on F2. */
const tgScore = scoredRun({
  micId:'drill-ctx-mic', statusId:'tg-status', scoreId:'tg-score', countKey:'on_changes',
  tol:()=>pulseSec()/2,
  onChange:()=>{ if(tgDrill) renderTarget(); },
});
// only comping is mic-scorable today, so the toggle exists only there
function tgScorable(){ return !tgTones(); }
// tgDrill = { presetIdx, bars:[{pc,qi}…], bar, cycles, clock, playing, hits, misses,
//             targetPcs:Set(pc), chordPcs:Set(pc), degMap:{pc:lab}, found:Set("si:f"), win:[lo,hi]|null }

let tgPos = 0;         // 0 = whole neck; 1–5 = one arpeggio box (6b, reuses Phase 2 boxWindow)
let tgDeg = 0;         // 0 = all chord tones; else a target degree (6c: land on ONE tone through the changes)
// target-degree families → the labClass they match (index = tgDeg): root / third / fifth / seventh
const TG_DEG_CLASS = [null, 'd-root', 'd-third', 'd-fifth', 'd-sev'];
function tgTones(){ return tgMode==='tones'; }

// expand a preset's steps (offset, qi, bars) into one chord per bar, in the context key
function tgBuildBars(preset){
  const r=gRoot, out=[];
  preset.steps.forEach(([off,qi,b])=>{ const pc=mod(r+off,12); for(let k=0;k<Math.max(1,b);k++) out.push({pc, qi}); });
  return out;
}
// the current chord's tones → the bar's SCORED targets + the full chord set. Kept in one
// place so the idle board (before Play) and each tick agree. In target-note mode (6c,
// tgDeg>0) only the chosen degree lights/scores as a hit; the other chord tones stay
// `chordPcs` so tapping them is neutral (a valid solo note), not a miss. Doesn't touch `found`.
function tgSetTargets(chord){
  const q=QUALITIES[chord.qi], chordPcs=new Set(), targetPcs=new Set(), deg={};
  const want=TG_DEG_CLASS[tgDeg];
  q.lab.forEach((lab,idx)=>{
    const pc=mod(chord.pc+q.iv[idx],12);
    chordPcs.add(pc);
    if(!want || labClass(lab)===want){ targetPcs.add(pc); deg[pc]=lab; }
  });
  // if the chord lacks the chosen degree (e.g. a 7th on a triad), nothing lights that bar
  // — an honest "lay out" rest, itself a phrasing lesson.
  tgDrill.targetPcs=targetPcs; tgDrill.chordPcs=chordPcs; tgDrill.degMap=deg;
}
// both practice-home cards land here; each one just picks the mode it teaches
function startOverChanges(mode){
  tgMode = (mode==='chords') ? 'chords' : 'tones';
  tgDrill={ presetIdx:tgIdx, bars:tgBuildBars(SEQ_PRESETS[tgIdx]), bar:0, cycles:0, clock:null, playing:false,
            hits:0, misses:0, targetPcs:new Set(), chordPcs:new Set(), degMap:{}, found:new Set(), win:null };
  tgSetTargets(tgDrill.bars[0]);          // light the first chord on the idle board
  tgScore.clearScore();
  if(tgTones()) tgScore.setOn(false);     // the lead mode has no mic tier to be in
  const home=document.getElementById('practice-home'), area=document.getElementById('tg-area');
  if(home) home.hidden=true; if(area) area.hidden=false;
  drillShellEnter();          // B2
  renderTargetBoard();
  renderTarget();
}
function startComp(){ startOverChanges('chords'); }
function startTarget(){ startOverChanges('tones'); }
function exitTarget(){
  targetStop();
  tgScore.release();     // never leave the mic open behind a closed drill
  tgDrill=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('tg-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderPractice==='function') renderPractice();
}
function targetToggle(){ if(tgDrill && tgDrill.playing) targetStop(); else targetPlay(); }
function targetPlay(){
  if(!tgDrill || tgDrill.playing) return;
  audio();
  if(typeof stopLoop==='function') stopLoop();       // don't fight the reference loop / progression
  if(typeof seqStop==='function') seqStop();
  drillRunStarted();                                 // B2: fold the setup
  tgDrill.presetIdx=tgIdx; tgDrill.bars=tgBuildBars(SEQ_PRESETS[tgIdx]);
  tgDrill.bar=0; tgDrill.cycles=0; tgDrill.hits=0; tgDrill.misses=0; tgDrill.found=new Set(); tgDrill.playing=true;
  tgScore.begin();                               // before the clock: a tick must not
  tgDrill.clock={ interval:()=>barSec(), tick:(time,count)=>targetTick(time,count) };
  if(typeof addClock==='function') addClock(tgDrill.clock);   // ...land in a run we then reset
  renderTarget();
}
function targetStop(){
  if(!tgDrill || !tgDrill.playing) return;
  if(tgDrill.clock){ if(typeof removeClock==='function') removeClock(tgDrill.clock); tgDrill.clock=null; }
  if(typeof clearVisualQ==='function') clearVisualQ();
  tgDrill.playing=false;
  const sc=tgScore.end();
  const barsPlayed = tgDrill.cycles*tgDrill.bars.length + tgDrill.bar;
  // each mode keeps its own session namespace + score, so pre-merge history still reads:
  // comping is scored by bars played, targeting by tap accuracy. Only comping has a
  // scored tier, so only it carries a timing error (B1); `tones` stays tap-scored.
  if(barsPlayed>=1){
    const name=SEQ_PRESETS[tgDrill.presetIdx].name;
    if(tgTones()) recordSession('target:'+name, tgAccuracy());
    else recordSession('comp:'+name, barsPlayed, undefined, scoredErr(sc));
    saveState();
    if(typeof renderPractice==='function') renderPractice();
  }
  renderTarget();
}
// accuracy over the run: right tones / all taps, as a 0..100 int (0 when untapped)
function tgAccuracy(){ const tot=tgDrill.hits+tgDrill.misses; return tot ? Math.round(100*tgDrill.hits/tot) : 0; }
function targetTick(when, count){
  if(!tgDrill) return;
  const bars=tgDrill.bars; if(!bars.length) return;
  const i=count%bars.length;
  if(i===0 && count>0) tgDrill.cycles++;
  tgDrill.bar=i;
  const cur=bars[i], nxt=bars[(i+1)%bars.length], p=pulseSec();
  const ivs=QUALITIES[cur.qi].iv, base=48+cur.pc;
  // the SCORING state (which tones are targets this bar) is set synchronously in the
  // tick so a tap always reads the current chord — only the DOM guides ride the visual
  // queue (which may lag/skip a frame). Reset the found set for the new bar.
  tgSetTargets(cur); tgDrill.found=new Set();
  if(tgTones()){
    compStrum(base, ivs, when, 0.62, 0.03);                  // light guide comp under your targeting
  } else if(tgScore.on()){
    // F1: the change itself is the scored slot. The guide comp is muted for the same
    // reason as the strum drill's — it lands exactly on the downbeat being measured,
    // so the app would be scoring its own speakers (onsetSelfHeard). The band keeps
    // the bar, which is what you comp against anyway.
    if(tgDrill.playing) tgScore.mark(when);
  } else {
    compStrum(base, ivs, when, 0.9, 0.028);                  // guide comp on the downbeat
    compStrum(base, ivs, when+midPulseSec(), 0.55, 0.022);   // softer push mid-bar (beat 3 in 4/4)
  }
  scheduleBand(cur.pc, cur.qi, when, true);                  // forced bass + groove bed
  for(let k=0;k<barBeats();k++) enqueueVisual(when+k*p, ()=>tgPulseBeat(k));
  enqueueVisual(when, ()=>{ if(tgTones()) markTargets(); renderTargetStage(cur, nxt); });
}
// whether fret f is inside the drilled shape (always true on the whole-neck mode)
function tgInWin(f){ const w=tgDrill&&tgDrill.win; return !w || (f>=w[0] && f<=w[1]); }
// paint/refresh which dots are lit targets, clearing the previous bar's hit/miss marks.
// In a box (6b) only the tones INSIDE the window light, so you drill one moveable shape.
function markTargets(){
  if(!tgDrill) return;
  document.querySelectorAll('#tg-board .dot.quiz').forEach(d=>{
    const pc=+d.dataset.pc;
    d.classList.remove('hit','miss'); d.textContent='';
    d.classList.toggle('target', tgDrill.targetPcs.has(pc) && tgInWin(+d.dataset.f));
  });
}

// one tap at (string,fret) while the loop runs. A target tone not yet found this bar →
// hit (light its degree + sound it); an off-chord note → miss (buzz); a re-tap → ignored.
// In box mode (6b) taps OUTSIDE the shape are ignored. In target-note mode (6c) a chord
// tone that isn't the chosen target is NEUTRAL — a valid solo note that just sounds, no
// score either way — so only landing on the prompted tone is rewarded and only off-chord
// notes buzz. Comping mode has no board, so taps can't reach here.
function targetAnswer(si, f){
  if(!tgDrill || !tgDrill.playing || !tgTones()) return;
  if(!tgInWin(f)) return;                                    // 6b: outside the shape → ignore
  const pc=(OPEN_MIDI[si]+f)%12, key=si+':'+f;
  if(tgDrill.targetPcs.has(pc)){
    if(tgDrill.found.has(key)) return;                       // already landed
    tgDrill.found.add(key); tgDrill.hits++;
    markTargetDot(si,f,'hit');
    pluck(OPEN_MIDI[si]+f);
  } else if(tgDrill.chordPcs.has(pc)){
    pluck(OPEN_MIDI[si]+f);                                  // 6c: another chord tone — neutral, just sounds
  } else {
    tgDrill.misses++;
    markTargetDot(si,f,'miss');
    playCue('wrong');
  }
  renderTargetStats();
}

/* ---- DOM paint (no-ops cleanly when the panel isn't in the DOM, e.g. some tests) ---- */
function renderTargetBoard(){
  const el=document.getElementById('tg-board'); if(!el) return;
  renderBoard(el, (pc,si,f)=>{
    const d=document.createElement('div'); d.className='dot quiz';
    d.dataset.si=si; d.dataset.f=f; d.dataset.pc=pc; d.tabIndex=0; d.setAttribute('role','button');
    d.setAttribute('aria-label', SNAMES[si]+' '+f);        // the position, never the answer
    return d;
  });
  renderNums(document.getElementById('tg-nums'));
}
function renderTarget(){
  if(!tgDrill) return;
  const tones=tgTones();
  // the mode switch is the first control: it's what the two old cards used to be
  segButtons('tg-mode', [{label:t('oc_chords')},{label:t('oc_tones')}], tones?1:0,
    i=>{ tgMode = i ? 'tones' : 'chords';
         // switching to the lead mode leaves the mic tier behind — it only scores comping
         if(tgTones()){ tgScore.release(); tgScore.setOn(false); tgScore.clearScore(); }
         const c=tgDrill.bars[tgDrill.bar]; if(c) tgSetTargets(c); renderTarget(); });
  const chips=document.getElementById('tg-progs');
  if(chips) chips.innerHTML=SEQ_PRESETS.map((p,i)=>`<button type="button" class="btn tg-prog${i===tgIdx?' active':''}" data-i="${i}" aria-pressed="${i===tgIdx}">${p.name}</button>`).join('');
  // the lead-only controls + the neck only exist in `tones` mode; comping needs neither
  const toneRows=document.getElementById('tg-tone-rows'); if(toneRows) toneRows.hidden=!tones;
  const boardWrap=document.getElementById('tg-board-wrap'); if(boardWrap) boardWrap.hidden=!tones;
  if(tones){
    // arpeggio-position picker (6b): All (whole neck) + boxes 1–5, reusing Phase 2's boxWindow
    segButtons('tg-pos', [t('pos_all'),'1','2','3','4','5'].map(label=>({label})), tgPos,
      i=>{ tgPos=i; renderTarget(); });
    tgDrill.win = tgPos ? boxWindow(tgPos) : null;
    // target-note picker (6c): All chord tones, or land on ONE degree through the changes
    segButtons('tg-deg', [{label:t('pos_all')},{label:'1',aria:t('leg_root')},{label:'3',aria:t('leg_third')},
                          {label:'5',aria:t('leg_fifth')},{label:'7',aria:t('leg_seventh')}], tgDeg,
      i=>{ tgDeg=i; const c=tgDrill.bars[tgDrill.bar]; if(c) tgSetTargets(c); renderTarget(); });
  } else {
    tgDrill.win = null;
  }
  const beats=document.getElementById('tg-beats');
  if(beats) beats.innerHTML=Array.from({length:barBeats()},(_,k)=>`<span class="co-beat" data-k="${k}"></span>`).join('');
  const cur=tgDrill.bars[tgDrill.bar], nxt=tgDrill.bars[(tgDrill.bar+1)%tgDrill.bars.length];
  renderTargetStage(cur, nxt);
  if(tones) markTargets();                           // reflect current chord + shape on the board
  renderTargetStats();
  const pb=document.getElementById('tg-play'); if(pb){ pb.innerHTML=(tgDrill.playing?'&#9632; ':'&#9654; ')+t(tgDrill.playing?'sp_stop':'sp_play'); pb.classList.toggle('active', tgDrill.playing); pb.setAttribute('aria-pressed', tgDrill.playing?'true':'false'); }
  const hint=document.getElementById('tg-hint');
  if(hint) hint.textContent = tones ? t('tg_hint') : t(tgScore.on()?'co_hint_scored':'co_hint');
  /* the mic tier belongs to comping only. B2: the button is the shell's, and the shell
     asks mic() — which is tgScorable() AND onset availability — so the lead mode simply
     never shows it. This used to be a hand-hide of #tg-mic that left its .divider on
     screen as a floating vertical rule under PROGRESSION; both are gone with the row. */
  tgScore.render();
  applyDrillCtx();
  if(tones){ const sc=document.getElementById('tg-score'); if(sc) sc.hidden=true;
             const stt=document.getElementById('tg-status'); if(stt) stt.hidden=true; }
}
function tgChordName(st){ return st ? ROOTS[st.pc]+QUALITIES[st.qi].short : ''; }
/* comping shows the SHAPE (you have to fret it); targeting shows the NAME (you're finding
   its tones yourself, and a diagram would just answer the question). */
function renderTargetStage(cur, nxt){
  const tones=tgTones();
  const paint=(el, st)=>{ if(!el) return;
    if(!st){ el.innerHTML=''; return; }
    if(tones) el.textContent=tgChordName(st);
    else el.innerHTML=cmChordBox(cmChord([st.pc, st.qi]));
  };
  paint(document.getElementById('tg-now'), cur);
  paint(document.getElementById('tg-next'), nxt);
  const nl=document.getElementById('tg-now-lab'); if(nl) nl.textContent=t('co_now');
  const xl=document.getElementById('tg-next-lab'); if(xl) xl.textContent=t('co_next');
}
function renderTargetStats(){
  if(!tgDrill) return;
  const tones=tgTones();
  const h=document.getElementById('tg-hits');
  if(h) h.textContent = tones ? (t('tg_hits')+' '+tgDrill.hits) : (tgDrill.playing ? ('↻ '+tgDrill.cycles) : '');
  const a=document.getElementById('tg-acc');
  if(a) a.textContent = (tones && (tgDrill.hits+tgDrill.misses)) ? (t('tg_acc')+' '+tgAccuracy()+'%') : '';
}
function tgPulseBeat(k){
  document.querySelectorAll('#tg-beats .co-beat').forEach(d=>d.classList.toggle('on', +d.dataset.k===k));
}
function markTargetDot(si,f,kind){
  const d=document.querySelector('#tg-board .dot.quiz[data-si="'+si+'"][data-f="'+f+'"]'); if(!d) return;
  if(kind==='hit'){ d.classList.add('hit'); d.textContent=(tgDrill.degMap[+d.dataset.pc]||''); rippleDot(d); }
  else { d.classList.add('miss'); setTimeout(()=>{ if(d) d.classList.remove('miss'); }, 420); }
}
// re-localize an in-flight drill on a language switch (called from applyLang)
function refreshTargetLang(){ if(tgDrill){ renderTarget(); tgScore.refreshLang(); } }

/* card starters + in-drill controls — wired once at load (guarded so a missing panel
   never throws, mirroring initDrill). */
registerDrill({ id:'overchanges', area:'tg-area', tempo:true,   // bars ride barSec() — A1 gives it the shell's stepper
                /* Two tracks behind one entry (B1): the merge put comping and
                   chord-tone targeting in one machine, but they are separate skills
                   with different metrics, opened from different practice cards, and
                   the model has to keep them apart. */
                tracks:[
                  { id:'comp',   kind:'perf', sess:'comp',   better:'high', unit:'bars', label:'drill_comp',   start:startComp },
                  { id:'target', kind:'perf', sess:'target', better:'high', unit:'pct',  label:'drill_target', start:startTarget }
                ],
                isActive:()=>!!tgDrill, exit:exitTarget, refreshLang:refreshTargetLang,
                setup:'tg-setup',
                // comping only — the lead mode stays tap-scored until F2
                mic:()=>tgScorable() && tgScore.available(),
                // stops first: flipping the tier mid-run would change what's being measured
                onMic:()=>{ if(tgDrill&&tgDrill.playing) targetStop(); tgScore.toggle(); renderTarget(); },
                // the progression is stored resolved to the key, so a key change rebuilds the bars
                onKey:()=>{ if(!tgDrill) return;
                            tgDrill.bars=tgBuildBars(SEQ_PRESETS[tgIdx]);
                            if(tgDrill.bar>=tgDrill.bars.length) tgDrill.bar=0;
                            const c=tgDrill.bars[tgDrill.bar]; if(c) tgSetTargets(c);
                            renderTarget(); } });

(function initOverChanges(){
  const area=document.getElementById('tg-area'); if(!area) return;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('tg-play', targetToggle);
  const pg=document.getElementById('tg-progs');
  if(pg) pg.addEventListener('click', e=>{ const btn=e.target.closest('.tg-prog'); if(btn){ tgIdx=+btn.dataset.i; if(tgDrill){ tgDrill.presetIdx=tgIdx; tgDrill.bars=tgBuildBars(SEQ_PRESETS[tgIdx]); if(tgDrill.bar>=tgDrill.bars.length) tgDrill.bar=0; } renderTarget(); } });
  const b=document.getElementById('tg-board');
  if(b){
    const fire=d=>{ if(d) targetAnswer(parseInt(d.dataset.si,10), parseInt(d.dataset.f,10)); };
    b.addEventListener('click', e=>fire(e.target.closest('.dot.quiz')));
    b.addEventListener('keydown', e=>{ if(e.key!=='Enter'&&e.key!==' ') return; const d=e.target.closest('.dot.quiz'); if(!d) return; e.preventDefault(); fire(d); });
  }
})();
