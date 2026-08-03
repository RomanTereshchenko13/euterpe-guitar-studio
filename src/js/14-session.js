/* ===================== The timed practice session (Phase 10/B3) =====================
   The question a practice app exists to answer is "I have fifteen minutes — what do I
   do?", and until now this one had no answer to it. Every drill is an infinite loop you
   leave by hand: nothing picks what to play, nothing keeps time, nothing ends, and
   nothing tells you afterwards what the fifteen minutes were. The session is the ritual
   the app was missing, and it is deliberately thin — it owns no exercise of its own.

   What it is made of is already here:
     • WHAT to practise comes from B1's queue (learnerReview().due), which already ranks
       overdue recall above cold or slipping performance tracks, over all ten tracks
       rather than the four the old hardcoded list knew about.
     • HOW to open it is startTrack() — the one door in (B2), so each block arrives with
       the drill header naming the track the session chose, exactly as if you had picked
       the card yourself.
     • WHAT you did comes off the learner model's own ring buffer: the report reads the
       sessions written between the session's start and its end, so it reports what was
       actually recorded rather than a second tally kept in parallel.

   The clock is a plain interval, and every function that reads it takes `now` so the
   whole flow is drivable with no timers at all — which is what the harness does.

   Its one entanglement with the rest of the shell is deliberate: a session has to end
   when the player abandons it, and the two ways to abandon one (the header's Quit, and
   leaving Practice) both run through drillShellLeft() in the registry. So that calls
   sessionInterrupt(), and the session guards its own chaining with `sessChaining` —
   changing drill walks the same path, and a session that ended itself every time it
   changed drill would be a session of exactly one drill. */

const SESSION_MINS = [5, 10, 15, 20];
const SESSION_BLOCK_SEC = 300;     // roughly one drill per five minutes
const SESSION_TICK_MS = 500;       // how often the header's countdown re-reads the clock

let sessMins = 10;                 // the length you last chose (persisted, 12-toolbar-state.js)
let psess = null;                  // the running session, or null
let sessLast = null;               // the report waiting to be read, or null
let sessTimer = null;
let sessChaining = false;          // true only while the session itself changes drill

function sessionActive(){ return !!psess; }

/* The order to practise in. B1's queue first (it is already ranked), then everything
   else from the registry — a brand-new player has an empty queue and still deserves a
   full session, and someone who has practised everything recently has no due list at
   all. Padding from the registry rather than repeating the queue also means a 20-minute
   session never hands you the same drill twice. */
function sessionQueue(now){
  const out=[];
  const push=id=>{ if(id && out.indexOf(id)<0 && typeof trackById==='function' && trackById(id)) out.push(id); };
  if(typeof learnerReview==='function'){
    const rev=learnerReview(now);
    (rev.due||[]).forEach(d=>push(d.track));
  }
  if(typeof drillTracks==='function') drillTracks().forEach(tr=>push(tr.id));
  return out;
}
/* Pure: minutes in, blocks out. One block per SESSION_BLOCK_SEC, at least one, never
   more than there are distinct tracks to fill them, and the time split evenly over
   however many that turned out to be — so a 15-minute session on an app with two tracks
   is two 7½-minute blocks rather than three blocks with a hole in it. */
function sessionPlan(mins, now){
  now=(typeof now==='number')?now:Date.now();
  const total=Math.max(1, mins)*60;
  const q=sessionQueue(now);
  if(!q.length) return [];
  const n=Math.max(1, Math.min(q.length, Math.round(total/SESSION_BLOCK_SEC) || 1));
  const secs=Math.round(total/n);
  return q.slice(0, n).map(id=>({ track:id, secs }));
}

function sessionStart(mins, now){
  now=(typeof now==='number')?now:Date.now();
  mins = SESSION_MINS.indexOf(mins)>=0 ? mins : sessMins;
  if(psess) sessionEnd('quit', now);
  const plan=sessionPlan(mins, now);
  if(!plan.length) return false;
  sessLast=null; sessMins=mins;
  psess={ mins, plan, idx:-1, startedAt:now, blockEnds:now, endsAt:now+mins*60000 };
  if(typeof setMode==='function') setMode('practice');
  sessionAdvance(now);
  if(!psess) return false;                       // nothing would open — don't pretend
  if(typeof saveState==='function') saveState();
  sessionStartTimer();
  applySessionViews();
  return true;
}
/* Move to the next block (or finish). The previous drill is ended first: startTrack()
   opens a drill, it does not close one, because until now nothing ever started a drill
   while another was running. */
function sessionAdvance(now){
  if(!psess) return;
  now=(typeof now==='number')?now:Date.now();
  psess.idx++;
  if(psess.idx>=psess.plan.length){ sessionEnd('done', now); return; }
  const b=psess.plan[psess.idx];
  psess.blockEnds=Math.min(now + b.secs*1000, psess.endsAt);
  sessChaining=true;
  try{
    if(typeof exitAllDrills==='function') exitAllDrills();
    if(typeof startTrack==='function') startTrack(b.track);
  } finally { sessChaining=false; }
  if(typeof applyDrillCtx==='function') applyDrillCtx();
}
/* One tick. A block ends on its own clock OR when the drill inside it ends by itself —
   the note and ear drills are finite, and their summary screen keeps them active, so
   this fires when you press Done on it and not before. */
function sessionTick(now){
  if(!psess) return;
  now=(typeof now==='number')?now:Date.now();
  if(now>=psess.endsAt){ sessionEnd('done', now); return; }
  const running=(typeof activeDrill==='function') ? !!activeDrill() : true;
  if(now>=psess.blockEnds || !running){ sessionAdvance(now); return; }
  sessionPaint();
}
function sessionStartTimer(){
  if(sessTimer || typeof setInterval!=='function') return;
  sessTimer=setInterval(()=>{ try{ sessionTick(); }catch(_){} }, SESSION_TICK_MS);
}
/* End it and leave a report. `blocks` is what was actually reached, not what was
   planned: quitting after two of four should not be reported as four. */
function sessionEnd(reason, now){
  if(!psess) return null;
  const s=psess; psess=null;
  if(sessTimer && typeof clearInterval==='function'){ clearInterval(sessTimer); }
  sessTimer=null;
  now=(typeof now==='number')?now:Date.now();
  sessChaining=true;
  try{ if(typeof exitAllDrills==='function') exitAllDrills(); }
  finally{ sessChaining=false; }
  sessLast={ mins:s.mins, from:s.startedAt, to:now, reason:reason||'done',
             blocks:s.plan.slice(0, Math.max(0, Math.min(s.plan.length, s.idx+1))).map(b=>b.track) };
  applySessionViews();
  if(typeof applyDrillCtx==='function') applyDrillCtx();
  return sessLast;
}
// the header's Quit, or leaving Practice — both arrive here through drillShellLeft()
function sessionInterrupt(){ if(psess && !sessChaining) sessionEnd('quit'); }
// a drill started outside the session: whatever the last report said, it has been read
function sessionClearReport(){ if(sessLast){ sessLast=null; applySessionViews(); } }
function sessionDismiss(){ sessionClearReport(); if(typeof renderPractice==='function') renderPractice(); }

/* ---- paint ---- */
function sessionClock(sec){
  sec=Math.max(0, Math.round(sec));
  const m=Math.floor(sec/60), s=sec%60;
  return m+':'+(s<10?'0':'')+s;
}
/* The two header controls. Painted here for the same reason 13-scored.js still paints
   the mic's label after B2 moved the button to the shell: only the running session
   knows whether there is one. applyDrillCtx() calls this, so they follow every other
   thing that repaints the header. */
function sessionPaint(){
  const chip=document.getElementById('drill-ctx-sess');
  if(chip){
    if(psess){
      chip.hidden=false;
      chip.textContent=(psess.idx+1)+'/'+psess.plan.length+' · '+sessionClock((psess.blockEnds-Date.now())/1000);
    } else { chip.hidden=true; chip.textContent=''; }
  }
  const skip=document.getElementById('drill-ctx-skip');
  if(skip){ skip.hidden=!psess; if(psess && typeof t==='function') skip.textContent=t('sess_next'); }
}
/* The report is EXCLUSIVE inside the practice home: it is the closing screen of a
   ritual, and a summary competing for the screen with the picker that starts the next
   thing is neither. Both blocks it replaces are toggled by `hidden` here rather than by
   a body class, so there is no author display rule for the attribute to lose to — the
   trap A3 fell into when #practice-home got a display:grid. */
function applySessionViews(){
  const rep=document.getElementById('session-report');
  const show=!!sessLast;
  if(rep){ rep.hidden=!show; if(show) renderSessionReport(); }
  const top=document.getElementById('ph-top-block'); if(top) top.hidden=show;
  const list=document.querySelector('#practice-home .ph-drills'); if(list) list.hidden=show;
}
// the home's starter: the length chips + the button
function renderSessionCard(){
  const host=document.getElementById('sess-mins');
  if(host) host.innerHTML=SESSION_MINS.map(m=>
    '<button type="button" class="btn'+(m===sessMins?' active':'')+'" data-mins="'+m+'">'+m+' '+t('sess_min')+'</button>').join('');
  const b=document.getElementById('sess-start'); if(b) b.textContent=t('sess_start');
}
function renderSessionReport(){
  const host=document.getElementById('session-report'); if(!host || !sessLast) return;
  const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const mins=Math.max(1, Math.round((sessLast.to-sessLast.from)/60000));
  /* What you did, read off the learner model rather than tallied in parallel: every
     drill already writes a session when its run ends, so the honest report is "which of
     those landed inside my window". A block with no entry played but finished nothing
     — say so rather than inventing a zero. */
  const runs=(typeof learner!=='undefined' && learner && Array.isArray(learner.sessions) ? learner.sessions : [])
    .filter(s=>s.t>=sessLast.from && s.t<=sessLast.to);
  const rows=sessLast.blocks.map(id=>{
    const tr=(typeof trackById==='function') ? trackById(id) : null;
    if(!tr) return '';
    const mine=runs.filter(s=>(typeof sessNs==='function'?sessNs(s.drill):s.drill)===tr.sess);
    let val=t('sess_norun');
    if(mine.length){
      const low=tr.better==='low';
      const best=mine.reduce((b,s)=> b===null ? s.score : (low?Math.min(b,s.score):Math.max(b,s.score)), null);
      val=(typeof trendScore==='function') ? trendScore({ last:best, unit:tr.unit }) : String(Math.round(best));
    }
    return '<div class="sr-row"><span class="sr-name">'+esc(t(tr.label))+'</span>'+
           '<span class="sr-val">'+esc(val)+'</span></div>';
  }).join('');
  host.innerHTML='<div class="pp-title">'+t('sess_done_h')+'</div>'+
    /* "3 min · Drills: 2" rather than "2 drills": Ukrainian agrees a noun with its number
       in three forms (1 вправа · 2 вправи · 5 вправ), and a label followed by a colon is the
       one shape that is correct for every count without shipping a pluralizer. */
    '<div class="sr-lead">'+mins+' '+t('sess_min')+' · '+t('sess_drills')+': '+sessLast.blocks.length+'</div>'+
    (runs.length ? rows : rows+'<div class="pp-empty">'+t('sess_none')+'</div>')+
    '<div class="drill-bar"><button type="button" class="btn play" id="sess-close">'+t('drill_done')+'</button></div>';
}
