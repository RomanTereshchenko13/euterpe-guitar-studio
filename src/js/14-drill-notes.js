/* ===================== Drill: fretboard note-naming (Phase 3c) =====================
   The first Practice drill and the first WRITER to the learner model (13-learner.js):
   the app names a note, you tap every instance of it on the neck. Reuses the shared
   board paint (renderBoard/renderNums, 07) on the drill's OWN board element inside the
   Practice panel, the cue bus (playCue, 05) for correct/wrong feedback, and pluck()
   so a correct tap also sounds the note.

   Honest framing (roadmap): tap input → scored on ACCURACY (clean prompts), not on
   timing precision — touch latency corrupts timing, so the elapsed time is shown as
   pace info, never as the score. Latency calibration is deliberately NOT here: this
   drill has no beat-locked scoring window, so it needs no offset; calibration lands
   with the first windowed (rhythm/timing) drill that actually consumes it.

   A session is DRILL_LEN note prompts, SRS-weighted (due notes first — what you've
   missed resurfaces), each recorded to the learner; the session score (clean-prompt
   accuracy) is pushed to the sessions ring buffer. */

const DRILL_LEN = 6;
let drill = null;
// drill = { queue:[pc…], total, done, correctPrompts, totalWrong, startT, finished,
//           targetPc, targets:Set("si:f"), wrongThis }

function drillShuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const tmp=a[i]; a[i]=a[j]; a[j]=tmp; } return a; }

// the session's note queue: due naturals first (SRS resurfacing), then the rest,
// each block shuffled, capped at DRILL_LEN. On a fresh model every due is 0 → all
// "due" → simply shuffled naturals.
function buildQueue(){
  const now=Date.now(), naturals=NAT.map(n=>NOTES.indexOf(n));
  const due=naturals.filter(pc=>((learner.items['note:'+NOTES[pc]]||{due:0}).due)<=now);
  const rest=naturals.filter(pc=>due.indexOf(pc)<0);
  return drillShuffle(due).concat(drillShuffle(rest)).slice(0, DRILL_LEN);
}

// every (string,fret) position of pitch-class `pc` in the current fret window —
// mirrors renderBoard's cell set exactly (open string when lo<=1, then lo..hi).
function drillTargetsFor(pc){
  const set=new Set(), lo=FRET_LO(), hi=FRET_HI(), showOpen=lo<=1;
  for(let si=0; si<6; si++){
    if(showOpen && (OPEN_MIDI[si]%12)===pc) set.add(si+':0');
    for(let f=lo; f<=hi; f++){ if(((OPEN_MIDI[si]+f)%12)===pc) set.add(si+':'+f); }
  }
  return set;
}

function startDrill(){
  drill={ queue:buildQueue(), total:0, done:0, correctPrompts:0, totalWrong:0, startT:Date.now(), finished:false, targetPc:null, targets:null, wrongThis:0 };
  drill.total=drill.queue.length;
  const home=document.getElementById('practice-home'), area=document.getElementById('drill-area'),
        act=document.getElementById('drill-active'), sum=document.getElementById('drill-summary');
  if(home) home.hidden=true; if(area) area.hidden=false; if(act) act.hidden=false; if(sum) sum.hidden=true;
  renderDrillBoard();
  nextPrompt();
}

function exitDrill(){
  drill=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('drill-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderPractice==='function') renderPractice();
}

function nextPrompt(){
  if(!drill.queue.length){ finishDrill(); return; }
  drill.targetPc=drill.queue.shift();
  drill.targets=drillTargetsFor(drill.targetPc);
  drill.wrongThis=0;
  clearDrillMarks();
  setPromptUI();
}

// one tap at (string,fret). Correct unfound target → light + sound; once all are
// found the prompt is scored (clean = no wrong taps) and recorded, then advances.
// A tap on the wrong note → miss flash + buzz; a re-tap of a found target → ignored.
function drillAnswer(si, f){
  if(!drill || drill.finished) return;
  const key=si+':'+f, pc=(OPEN_MIDI[si]+f)%12;
  if(pc===drill.targetPc && drill.targets && drill.targets.has(key)){
    drill.targets.delete(key);
    markDrillDot(si,f,'hit');
    pluck(OPEN_MIDI[si]+f);
    if(drill.targets.size===0){
      recordAttempt('note:'+NOTES[drill.targetPc], drill.wrongThis===0);
      drill.done++; if(drill.wrongThis===0) drill.correctPrompts++;
      playCue('correct');
      nextPrompt();
    }
  } else if(pc!==drill.targetPc){
    drill.wrongThis++; drill.totalWrong++;
    markDrillDot(si,f,'miss');
    playCue('wrong');
  }
}

function finishDrill(){
  drill.finished=true;
  const elapsed=Math.max(0, Math.round((Date.now()-drill.startT)/1000));
  const acc=drill.total ? drill.correctPrompts/drill.total : 0;
  recordSession('notes', Math.round(acc*100));
  saveState();
  if(typeof renderPractice==='function') renderPractice();
  renderDrillSummary(elapsed, acc);
}

/* ---- DOM paint (no-ops cleanly when the panel isn't in the DOM, e.g. some tests) ---- */
function renderDrillBoard(){
  const el=document.getElementById('drill-board'); if(!el) return;
  renderBoard(el, (pc,si,f)=>{
    const d=document.createElement('div'); d.className='dot quiz';
    d.dataset.si=si; d.dataset.f=f; d.tabIndex=0; d.setAttribute('role','button');
    d.setAttribute('aria-label', SNAMES[si]+' '+f);   // the position, never the answer
    return d;
  });
  renderNums(document.getElementById('drill-nums'));
}
function clearDrillMarks(){
  document.querySelectorAll('#drill-board .dot.quiz').forEach(d=>{ d.classList.remove('hit','miss'); d.textContent=''; });
}
function setPromptUI(){
  const p=document.getElementById('drill-prompt'); if(p) p.innerHTML=t('drill_find_pre')+' <span class="drill-target">'+NOTES[drill.targetPc]+'</span>';
  const c=document.getElementById('drill-count'); if(c) c.textContent=Math.min(drill.done+1, drill.total)+' / '+drill.total;
}
function markDrillDot(si,f,kind){
  const d=document.querySelector('#drill-board .dot.quiz[data-si="'+si+'"][data-f="'+f+'"]'); if(!d) return;
  if(kind==='hit'){ d.classList.add('hit'); d.textContent=NOTES[(OPEN_MIDI[si]+f)%12]; rippleDot(d); }
  else { d.classList.remove('hit'); d.classList.add('miss'); setTimeout(()=>{ if(d) d.classList.remove('miss'); }, 480); }
}
function renderDrillSummary(elapsed, acc){
  const el=document.getElementById('drill-summary'); if(!el) return;
  const act=document.getElementById('drill-active'); if(act) act.hidden=true;
  const stat=(v,l)=>'<div class="pp-stat"><div class="pp-val">'+v+'</div><div class="pp-lab">'+l+'</div></div>';
  el.innerHTML='<div class="drill-done-title">'+t('drill_complete')+'</div>'+
    '<div class="pp-stats">'+
      stat(Math.round(acc*100)+'%', t('drill_score'))+
      stat(drill.correctPrompts+' / '+drill.total, t('drill_clean'))+
      stat(drill.totalWrong, t('drill_misses'))+
      stat(elapsed+'s', t('drill_time'))+
    '</div>'+
    '<div class="drill-actions"><button class="btn play" id="drill-again"></button><button class="btn" id="drill-done"></button></div>';
  el.hidden=false;
  const ag=document.getElementById('drill-again'); if(ag){ ag.textContent=t('drill_again'); ag.onclick=startDrill; }
  const dn=document.getElementById('drill-done');  if(dn){ dn.textContent=t('drill_done');  dn.onclick=exitDrill; }
}

/* board tap/keys + quit — wired once at load (the markup is parsed before this
   script runs; guarded so a missing panel never throws). */
(function initDrill(){
  const b=document.getElementById('drill-board'); if(!b) return;
  const fire=d=>{ if(d) drillAnswer(parseInt(d.dataset.si,10), parseInt(d.dataset.f,10)); };
  b.addEventListener('click', e=>fire(e.target.closest('.dot.quiz')));
  b.addEventListener('keydown', e=>{ if(e.key!=='Enter'&&e.key!==' ') return; const d=e.target.closest('.dot.quiz'); if(!d) return; e.preventDefault(); fire(d); });
  const q=document.getElementById('drill-quit'); if(q) q.onclick=exitDrill;
})();
