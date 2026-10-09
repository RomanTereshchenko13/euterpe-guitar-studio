/* ===================== Learner model =====================
   What you know: per-item history + an SM-2-lite spaced-repetition queue, plus a
   bounded buffer of recent sessions. It grows by ADDING id namespaces ("note:E",
   "interval:P5"), never by reshaping; a `v` bump + migration in normalizeLearner()
   is the only way the shape changes.

   Saved verbatim by saveState() and restored through normalizeLearner(), which
   bounds-checks everything — a tampered or garbage blob degrades to a fresh model,
   never throws. */

const LEARNER_V = 2;
const SRS_EASE_MIN = 1.3, SRS_EASE_MAX = 3.0, SRS_EASE_START = 2.5;
const DAY_MS = 86400000;
/* Retention is PER SESSION ID (newest kept), so a drill practised daily can't evict
   the history of one practised weekly; the global cap is only a safety ceiling. */
const SESS_MAX = 300;       // global safety ceiling (newest last)
const SESS_PER_ID = 20;     // per-session-id history depth — what a trend reads
const PERF_STALE_DAYS = 5;  // a performance track goes "due" when it's this cold
const PERF_TREND_N = 3;     // how many recent runs make up "recently"
const ITEMS_MAX = 5000;     // hard cap so a tampered store can't grow unbounded
const IDS_MAX = 400;        // ditto for the per-id best table
const ID_MAX = 64;          // max stable-id length

function newLearner(){ return { v: LEARNER_V, items: {}, sessions: [], best: {} }; }
// loadState() replaces this with the normalized saved model at boot
let learner = newLearner();

// fetch-or-create the per-item record for a stable id
function learnerItem(id){
  let it = learner.items[id];
  if(!it) it = learner.items[id] = { seen:0, correct:0, streak:0, ease:SRS_EASE_START, due:0 };
  return it;
}

// SM-2-lite interval: 1d, 6d, then ×ease each rep. Derived from streak + ease rather
// than stored, so the item shape stays {seen,correct,streak,ease,due}.
function srsInterval(streak, ease){
  if(streak<=1) return DAY_MS;
  if(streak===2) return 6*DAY_MS;
  return Math.round(6*DAY_MS * Math.pow(ease, streak-2));
}

// Record one attempt. A hit grows ease and pushes `due` out by the interval; a miss
// zeroes the streak, lowers ease and re-queues the item within the minute.
function recordAttempt(id, correct, now){
  now = (typeof now==='number') ? now : Date.now();
  const it = learnerItem(id);
  it.seen++;
  if(correct){
    it.correct++; it.streak++;
    it.ease = Math.min(SRS_EASE_MAX, it.ease + 0.1);
    it.due = now + srsInterval(it.streak, it.ease);
  } else {
    it.streak = 0;
    it.ease = Math.max(SRS_EASE_MIN, it.ease - 0.2);
    it.due = now + 60000;
  }
  return it;
}

// ids due now (optionally by id prefix), most overdue first
function dueItems(now, prefix){
  now = (typeof now==='number') ? now : Date.now();
  return Object.keys(learner.items)
    .filter(id => (!prefix || id.indexOf(prefix)===0) && learner.items[id].due <= now)
    .sort((a,b) => learner.items[a].due - learner.items[b].due);
}

/* Append a finished session (newest last), update the personal best, then prune.
   `extra.err` is a scored run's mean absolute timing error in ms, kept alongside the
   score rather than replacing it, so `score` means the same thing in old history. */
function recordSession(drill, score, now, extra){
  now = (typeof now==='number') ? now : Date.now();
  const id = String(drill);
  const s = { t: now, drill: id, score: lNum(score, 0) };
  if(extra && typeof extra==='object' && typeof extra.err==='number' && isFinite(extra.err))
    s.err = Math.max(0, extra.err);
  learner.sessions.push(s);
  learnerNoteBest(id, s);
  pruneSessions();
  progressPersist();   // 13-backup.js: there is now something worth keeping
}
/* Keep the newest SESS_PER_ID of each session id, then trim to the global ceiling. */
function pruneSessions(){
  const seen = {};
  const keep = [];
  for(let i=learner.sessions.length-1; i>=0; i--){        // newest → oldest
    const s = learner.sessions[i], n = (seen[s.drill]||0);
    if(n >= SESS_PER_ID) continue;
    seen[s.drill] = n+1; keep.push(s);
  }
  keep.reverse();                                          // back to oldest → newest
  learner.sessions = keep.length > SESS_MAX ? keep.slice(-SESS_MAX) : keep;
}
/* The personal best is STORED, not derived: it must outlive the history it came
   from. Direction comes from the registry track, defaulting to "higher is better". */
function learnerNoteBest(id, s){
  const tr = trackBySess(sessNs(id));
  const low = !!(tr && tr.better==='low');
  const cur = learner.best[id];
  if(!cur){
    if(Object.keys(learner.best).length >= IDS_MAX) return;
    learner.best[id] = { score: s.score, t: s.t };
  } else if(low ? s.score < cur.score : s.score > cur.score){
    cur.score = s.score; cur.t = s.t;
  }
  // the timing error is always "lower is better", whatever the track's own metric is
  const b = learner.best[id];
  if(typeof s.err==='number' && (typeof b.err!=='number' || s.err < b.err)) b.err = s.err;
}
// the stored personal best for one session id, or null
function learnerBest(id){ return learner.best[String(id)] || null; }

/* ---- the trend ----
   Turns a session id (or a whole namespace) into: latest, best, timing error and
   `dir` — the mean of the last PERF_TREND_N runs against the runs before them,
   oriented by the track's `better`. Within TREND_EPS it reads 'flat': a 1% wobble is
   not improvement. */
const TREND_EPS = 0.03;
function learnerTrend(idOrNs, now){
  now = (typeof now==='number') ? now : Date.now();
  const key = String(idOrNs);
  // exact session id first; fall back to every session in that namespace
  let runs = learner.sessions.filter(s => s.drill===key);
  const exact = runs.length>0;
  if(!exact) runs = learner.sessions.filter(s => sessNs(s.drill)===key);
  const tr = trackBySess(exact ? sessNs(key) : key);
  const low = !!(tr && tr.better==='low');
  const out = { id:key, n:runs.length, unit:(tr&&tr.unit)||'', better:low?'low':'high',
                last:null, lastT:0, best:null, bestErr:null, lastErr:null,
                dir:'flat', staleDays:null };
  if(!runs.length) return out;
  const last = runs[runs.length-1];
  out.last = last.score; out.lastT = last.t;
  out.lastErr = (typeof last.err==='number') ? last.err : null;
  out.staleDays = Math.max(0, (now - last.t) / DAY_MS);
  // the stored best when there is one (it outlives the buffer), else the buffer's own
  const stored = exact ? learnerBest(key) : null;
  out.best = stored ? stored.score
    : runs.reduce((b,s)=> b===null ? s.score : (low ? Math.min(b,s.score) : Math.max(b,s.score)), null);
  const errs = runs.filter(s=>typeof s.err==='number').map(s=>s.err);
  if(stored && typeof stored.err==='number') errs.push(stored.err);
  if(errs.length) out.bestErr = Math.min.apply(null, errs);
  // direction: recent mean vs the mean of what came before it
  if(runs.length >= 2){
    const cut = Math.max(1, runs.length - PERF_TREND_N);
    const mean = a => a.reduce((x,s)=>x+s.score, 0) / a.length;
    const recent = mean(runs.slice(cut)), earlier = mean(runs.slice(0, cut));
    const delta = (recent - earlier) * (low ? -1 : 1);
    const scale = Math.abs(earlier) || 1;
    out.dir = Math.abs(delta)/scale < TREND_EPS ? 'flat' : (delta > 0 ? 'up' : 'down');
  }
  return out;
}

// aggregates for the progress card's footer
function learnerStats(){
  const ids = Object.keys(learner.items);
  let seen=0, correct=0, bestStreak=0;
  ids.forEach(id => { const it=learner.items[id]; seen+=it.seen; correct+=it.correct; if(it.streak>bestStreak) bestStreak=it.streak; });
  return { items: ids.length, seen, correct, accuracy: seen ? correct/seen : 0, bestStreak, sessions: learner.sessions.length };
}

/* What to practise next. Recall namespaces come from the registry and count their
   overdue items; a performance track has no SRS date, so it falls due on its own
   terms:
     • STALENESS — PERF_STALE_DAYS since you last ran it, or you never have.
     • SLIPPAGE  — the recent runs trend down against the ones before them.
   `due` is the ordered queue (recall first — an overdue item is a fact, a cold drill a
   suggestion). Tracks no longer registered are skipped, so a cut drill's history stays
   stored but is never offered. */
function reviewNamespaces(){
  return drillTracks()
    .filter(tr => tr.kind==='recall' && tr.items).map(tr => tr.items);
}
function learnerReview(now){
  now=(typeof now==='number')?now:Date.now();
  const nss=reviewNamespaces();
  const by={}; nss.forEach(ns=>by[ns]=0); let total=0;
  Object.keys(learner.items).forEach(id=>{
    if(learner.items[id].due>now) return;
    const ns=id.slice(0, id.indexOf(':'));
    if(by[ns]===undefined) return;
    by[ns]++; total++;
  });
  let top=null, max=0; nss.forEach(ns=>{ if(by[ns]>max){ max=by[ns]; top=ns; } });
  // the ordered queue: overdue recall namespaces, then cold or slipping performance tracks
  const due=[];
  nss.slice().sort((a,b)=>by[b]-by[a]).forEach(ns=>{
    if(by[ns]>0){ const tr=trackByItems(ns); due.push({ track:tr?tr.id:ns, ns, kind:'recall', n:by[ns], reason:'due' }); }
  });
  drillTracks().forEach(tr=>{
    if(tr.kind!=='perf' || !tr.sess) return;
    const tn=learnerTrend(tr.sess, now);
    if(!tn.n){ due.push({ track:tr.id, ns:tr.sess, kind:'perf', n:0, reason:'new' }); return; }
    if(tn.staleDays >= PERF_STALE_DAYS) due.push({ track:tr.id, ns:tr.sess, kind:'perf', n:0, reason:'stale' });
    else if(tn.dir==='down') due.push({ track:tr.id, ns:tr.sess, kind:'perf', n:0, reason:'slipping' });
  });
  return { total, by, top, due };
}
/* Open a track by id, via the registry's own `start`. */
function startTrack(id){
  const tr = trackById(id);
  if(!tr || typeof tr.start!=='function') return false;
  /* The ONE door into a drill (cards, Review, seams, the session), so the header can
     name what was opened. A drill's start() called directly just leaves it unnamed. */
  setCurTrack(tr.id);
  tr.start();
  return true;
}
/* ---- the progress readout ----
   In order: WHAT'S NEXT (the queue), a row per track you have run — latest, direction,
   best, and the timing error for mic tiers — then the aggregates as a footer. */

// a track's latest score, in its own unit
function trendScore(tn){
  if(tn.last===null) return '';
  const v=Math.round(tn.last);
  if(tn.unit==='pct') return v+'%';
  if(tn.unit==='bars') return v+' '+t('unit_bars');
  if(tn.unit==='cpm') return v+t('unit_cpm');
  return String(v);
}
// ▲ / ▼ / → , already oriented by the track's `better`
function trendArrow(dir){ return dir==='up' ? '▲' : dir==='down' ? '▼' : '→'; }

function renderProgressInto(hostId){
  const host=document.getElementById(hostId); if(!host) return;
  const s=learnerStats();
  if(!s.seen && !s.sessions){ host.innerHTML='<div class="pp-empty">'+t('prog_empty')+'</div>'; return; }
  const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  let html='';

  /* WHAT'S NEXT: overdue items lead with a Review button; with none due, the first
     cold or slipping performance track takes the row. */
  const rev=learnerReview();
  if(rev.total>0 && rev.top){
    html+='<div class="pp-review"><span class="pp-review-n">'+t('prog_due')+' · '+rev.total+'</span>'+
      '<button type="button" class="btn play pp-review-btn" data-review="'+esc(rev.top)+'">'+t('prog_review')+'</button></div>';
  } else {
    const nxt=(rev.due||[]).find(d=>d.kind==='perf');
    const tr=nxt ? trackById(nxt.track) : null;
    if(tr && tr.label){
      html+='<div class="pp-review"><span class="pp-review-n">'+t('prog_next')+' · '+esc(t(tr.label))+'</span>'+
        '<button type="button" class="btn play pp-review-btn" data-review="'+esc(tr.id)+'">'+t('prog_start')+'</button></div>';
    }
  }

  /* a row per track you have run, most recent first; untouched tracks are left to the
     cards below */
  const rows=drillTracks()
    .filter(tr=>tr.sess)
    .map(tr=>({ tr, tn:learnerTrend(tr.sess) }))
    .filter(x=>x.tn.n>0)
    .sort((a,b)=>b.tn.lastT-a.tn.lastT);
  if(rows.length){
    html+='<div class="pp-sec">'+t('prog_yours')+'</div>';
    html+=rows.map(({tr,tn})=>{
      const sub=[];
      if(tn.best!==null) sub.push(t('prog_best')+' '+trendScore({ last:tn.best, unit:tn.unit }));
      // a mic tier's best timing error
      if(tn.bestErr!==null) sub.push(t('prog_timing')+' ±'+Math.round(tn.bestErr)+' '+t('on_ms'));
      sub.push(tn.n+' '+t('prog_runs'));
      /* a real <button> with data-track, so the row opens its drill (the delegated
         #practice-home listener handles it) */
      return '<button type="button" class="pp-row" data-track="'+esc(tr.id)+'">'+
        '<span class="pp-row-name">'+esc(t(tr.label))+'</span>'+
        '<span class="pp-row-val">'+esc(trendScore(tn))+
          ' <span class="pp-dir '+tn.dir+'">'+trendArrow(tn.dir)+'</span></span>'+
        '<span class="pp-row-sub">'+esc(sub.join(' · '))+'</span>'+
      '</button>';
    }).join('');
  }

  const stat=(val,lab)=>'<div class="pp-stat"><div class="pp-val">'+val+'</div><div class="pp-lab">'+lab+'</div></div>';
  const act=learnerActivity();
  html+='<div class="pp-stats">'+
    stat(Math.round(s.accuracy*100)+'%', t('prog_accuracy'))+
    stat(s.bestStreak, t('prog_streak'))+
    stat(act.days, t('prog_active'))+
    stat(s.sessions, t('prog_sessions'))+
  '</div>';
  host.innerHTML=html;
}

// distinct calendar days practised in the last `win` days (default 7)
function learnerActivity(now, win){
  now=(typeof now==='number')?now:Date.now(); win=win||7;
  const cutoff=now-win*DAY_MS, days={};
  learner.sessions.forEach(s=>{ if(s.t>=cutoff) days[Math.floor(s.t/DAY_MS)]=1; });
  return { days: Object.keys(days).length, window: win };
}

// ---- bounds-checked restore ----
function lInt(v, def){ return (Number.isFinite(v) && Math.floor(v)===v) ? v : (def||0); }
function lNum(v, def){ return (typeof v==='number' && isFinite(v)) ? v : (def||0); }
function lClampNum(v, lo, hi, def){ return (typeof v==='number' && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : def; }
function normalizeLearner(raw){
  const out = newLearner();
  if(!raw || typeof raw!=='object') return out;
  /* Version gate: v1 → v2 is purely additive (see below); anything older or newer than
     we know degrades to a fresh model rather than guessing. */
  if(raw.v !== LEARNER_V && raw.v !== 1) return out;
  if(raw.items && typeof raw.items==='object'){
    let n=0;
    for(const id of Object.keys(raw.items)){
      if(typeof id!=='string' || !id.length || id.length>ID_MAX) continue;
      if(++n > ITEMS_MAX) break;
      const it = raw.items[id];
      if(!it || typeof it!=='object') continue;
      const seen = Math.max(0, lInt(it.seen, 0));
      out.items[id] = {
        seen,
        correct: Math.min(seen, Math.max(0, lInt(it.correct, 0))),   // can't be correct more than seen
        streak:  Math.max(0, lInt(it.streak, 0)),
        ease:    lClampNum(it.ease, SRS_EASE_MIN, SRS_EASE_MAX, SRS_EASE_START),
        due:     Math.max(0, lInt(it.due, 0))
      };
    }
  }
  if(Array.isArray(raw.sessions)){
    out.sessions = raw.sessions
      .filter(s => s && typeof s==='object' && Number.isFinite(s.t))
      .slice(-SESS_MAX)
      .map(s => {
        const o = { t: s.t, drill: typeof s.drill==='string' ? s.drill.slice(0,32) : '', score: lNum(s.score, 0) };
        // optional since v2; a v1 entry simply doesn't have one
        if(typeof s.err==='number' && isFinite(s.err)) o.err = Math.max(0, s.err);
        return o;
      });
  }
  if(raw.best && typeof raw.best==='object'){
    let n=0;
    for(const id of Object.keys(raw.best)){
      if(typeof id!=='string' || !id.length || id.length>ID_MAX) continue;
      if(++n > IDS_MAX) break;
      const b=raw.best[id];
      if(!b || typeof b!=='object' || !Number.isFinite(b.score)) continue;
      const o = { score: b.score, t: Math.max(0, lInt(b.t, 0)) };
      if(typeof b.err==='number' && isFinite(b.err)) o.err = Math.max(0, b.err);
      out.best[id] = o;
    }
  }
  /* v1 → v2: a v1 store has no `best` table, so rebuild it from the sessions that
     survived. learnerNoteBest only replaces a strictly better number, so replaying is
     safe on a v2 store too. Retention is applied on read for the same reason. Both
     write through the module-level `learner`, so swap it for the duration. */
  const keep = learner;
  learner = out;
  try{
    out.sessions.forEach(s => learnerNoteBest(s.drill, s));
    pruneSessions();
  } finally { learner = keep; }
  return out;
}
