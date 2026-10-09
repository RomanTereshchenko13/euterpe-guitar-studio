/* ===================== The timed practice session =====================
   "I have fifteen minutes — what do I do?" Pick a length; the session picks the drills,
   keeps time, ends by itself and reports. It owns no exercise of its own:
     • WHAT to practise comes from learnerReview().due (overdue recall first, then cold
       or slipping performance tracks);
     • each block opens through startTrack(), so the header names it as usual;
     • the report reads the sessions the drills recorded inside its window.

   Every function that reads the clock takes `now`, so the flow runs with no timers.

   Quit and leaving Practice both run through drillShellLeft(), which calls
   sessionInterrupt(); `sessChaining` keeps the session's own drill changes (the same
   path) from ending it. */

const SESSION_MINS = [5, 10, 15, 20];
const SESSION_BLOCK_SEC = 300;     // roughly one drill per five minutes
const SESSION_TICK_MS = 500;       // how often the header's countdown re-reads the clock

let sessMins = 10;                 // the length you last chose (persisted)
let psess = null;                  // the running session, or null
let sessLast = null;               // the report waiting to be read, or null
let sessTimer = null;
let sessChaining = false;          // true only while the session itself changes drill

function sessionActive(){ return !!psess; }

/* The order to practise in: the due queue first, then every other registered track,
   so a new player still gets a full session and no drill comes up twice. */
function sessionQueue(now){
  const out=[];
  const push=id=>{ if(id && out.indexOf(id)<0 && trackById(id)) out.push(id); };
  (learnerReview(now).due||[]).forEach(d=>push(d.track));
  drillTracks().forEach(tr=>push(tr.id));
  return out;
}
/* Pure: minutes in, blocks out. One block per SESSION_BLOCK_SEC, at least one, never
   more than there are tracks, the time split evenly — two tracks in 15 minutes make two
   7½-minute blocks, not three with a hole. */
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
  setMode('practice');
  sessionAdvance(now);
  if(!psess) return false;                       // nothing would open — don't pretend
  saveState();
  sessionStartTimer();
  applySessionViews();
  return true;
}
/* Next block, or finish. The previous drill is ended first: startTrack() opens a
   drill, it never closes one. */
function sessionAdvance(now){
  if(!psess) return;
  now=(typeof now==='number')?now:Date.now();
  psess.idx++;
  if(psess.idx>=psess.plan.length){ sessionEnd('done', now); return; }
  const b=psess.plan[psess.idx];
  psess.blockEnds=Math.min(now + b.secs*1000, psess.endsAt);
  sessChaining=true;
  try{
    exitAllDrills();
    startTrack(b.track);
  } finally { sessChaining=false; }
  applyDrillCtx();
}
/* A block ends on its clock OR when its drill ends itself — the note and ear drills
   are finite, and their summary keeps them active until you press Done. */
function sessionTick(now){
  if(!psess) return;
  now=(typeof now==='number')?now:Date.now();
  if(now>=psess.endsAt){ sessionEnd('done', now); return; }
  const running=!!activeDrill();
  if(now>=psess.blockEnds || !running){ sessionAdvance(now); return; }
  sessionPaint();
}
function sessionStartTimer(){
  if(sessTimer || typeof setInterval!=='function') return;
  sessTimer=setInterval(()=>{ try{ sessionTick(); }catch(_){} }, SESSION_TICK_MS);
}
/* End it and leave a report. `blocks` is what was reached, not what was planned. */
function sessionEnd(reason, now){
  if(!psess) return null;
  const s=psess; psess=null;
  if(sessTimer && typeof clearInterval==='function'){ clearInterval(sessTimer); }
  sessTimer=null;
  now=(typeof now==='number')?now:Date.now();
  sessChaining=true;
  try{ exitAllDrills(); }
  finally{ sessChaining=false; }
  sessLast={ mins:s.mins, from:s.startedAt, to:now, reason:reason||'done',
             blocks:s.plan.slice(0, Math.max(0, Math.min(s.plan.length, s.idx+1))).map(b=>b.track) };
  applySessionViews();
  applyDrillCtx();
  return sessLast;
}
// the header's Quit, or leaving Practice (via drillShellLeft)
function sessionInterrupt(){ if(psess && !sessChaining) sessionEnd('quit'); }
// a drill started outside the session: whatever the last report said, it has been read
function sessionClearReport(){ if(sessLast){ sessLast=null; applySessionViews(); } }
function sessionDismiss(){ sessionClearReport(); renderPractice(); }

/* ---- paint ---- */
function sessionClock(sec){
  sec=Math.max(0, Math.round(sec));
  const m=Math.floor(sec/60), s=sec%60;
  return m+':'+(s<10?'0':'')+s;
}
/* The header's block counter and Next: only the session knows whether there is one.
   applyDrillCtx() calls this, so they repaint with the rest of the header. */
function sessionPaint(){
  const chip=document.getElementById('drill-ctx-sess');
  if(chip){
    if(psess){
      chip.hidden=false;
      chip.textContent=(psess.idx+1)+'/'+psess.plan.length+' · '+sessionClock((psess.blockEnds-Date.now())/1000);
    } else { chip.hidden=true; chip.textContent=''; }
  }
  const skip=document.getElementById('drill-ctx-skip');
  if(skip){ skip.hidden=!psess; if(psess) skip.textContent=t('sess_next'); }
}
/* The report replaces the home's blocks while it is up — `hidden` here rather than a
   body class, so no author display rule can override it. */
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
  /* Read off the learner model: the sessions that landed inside this window. A block
     with none was played but finished nothing — say so rather than invent a zero. */
  const runs=(typeof learner!=='undefined' && learner && Array.isArray(learner.sessions) ? learner.sessions : [])
    .filter(s=>s.t>=sessLast.from && s.t<=sessLast.to);
  const rows=sessLast.blocks.map(id=>{
    const tr=trackById(id);
    if(!tr) return '';
    const mine=runs.filter(s=>sessNs(s.drill)===tr.sess);
    let val=t('sess_norun');
    if(mine.length){
      const low=tr.better==='low';
      const best=mine.reduce((b,s)=> b===null ? s.score : (low?Math.min(b,s.score):Math.max(b,s.score)), null);
      val=trendScore({ last:best, unit:tr.unit });
    }
    return '<div class="sr-row"><span class="sr-name">'+esc(t(tr.label))+'</span>'+
           '<span class="sr-val">'+esc(val)+'</span></div>';
  }).join('');
  host.innerHTML='<div class="pp-title">'+t('sess_done_h')+'</div>'+
    /* "3 min · Drills: 2", not "2 drills": Ukrainian has three plural forms (1 вправа ·
       2 вправи · 5 вправ), and a label with a colon is correct for every count. */
    '<div class="sr-lead">'+mins+' '+t('sess_min')+' · '+t('sess_drills')+': '+sessLast.blocks.length+'</div>'+
    (runs.length ? rows : rows+'<div class="pp-empty">'+t('sess_none')+'</div>')+
    '<div class="drill-bar"><button type="button" class="btn play" id="sess-close">'+t('drill_done')+'</button></div>';
}
