/* ===================== Learner model (spine #3) =====================
   Phase 3b. The app's memory of what you know: per-item history + an SM-2-lite
   spaced-repetition queue, plus a bounded ring buffer of recent sessions. Every
   later practice phase mints items into this same shape — it grows by ADDING id
   namespaces (e.g. "note:E:str6", "interval:P5"), never by reshaping. A `v` bump
   + migration in normalizeLearner() is the only sanctioned way the shape changes.

   Persistence rides saveState()/loadState() (12-toolbar-state.js): saved verbatim,
   restored through normalizeLearner() with the same bounds-checked discipline as
   the rest of the state — a tampered/garbage blob degrades to a fresh model, never
   throws. No UI of its own beyond the small progress readout in the Practice panel
   (rendered by renderPractice() in wiring-init); the note-naming drill (3c) is the
   first writer. */

const LEARNER_V = 2;
const SRS_EASE_MIN = 1.3, SRS_EASE_MAX = 3.0, SRS_EASE_START = 2.5;
const DAY_MS = 86400000;
/* Retention (Phase 10/B1). SESS_MAX was one global cap of 50 across nine tracks — so
   roughly five entries each, and a drill practised daily evicted the history of one
   practised weekly. A trend needs its own runway, so the cap is now PER SESSION ID
   (newest kept), with the global figure demoted to a safety ceiling against a
   tampered store. */
const SESS_MAX = 300;       // global safety ceiling (newest last)
const SESS_PER_ID = 20;     // per-session-id history depth — what a trend reads
const PERF_STALE_DAYS = 5;  // a performance track goes "due" when it's this cold
const PERF_TREND_N = 3;     // how many recent runs make up "recently"
const ITEMS_MAX = 5000;     // hard cap so a tampered store can't grow unbounded
const IDS_MAX = 400;        // ditto for the per-id best table
const ID_MAX = 64;          // max stable-id length

function newLearner(){ return { v: LEARNER_V, items: {}, sessions: [], best: {} }; }
// The single mutable learner instance. loadState() reassigns it from storage
// (normalized) at boot; until then it's an empty, valid model.
let learner = newLearner();

// fetch-or-create the per-item record for a stable id
function learnerItem(id){
  let it = learner.items[id];
  if(!it) it = learner.items[id] = { seen:0, correct:0, streak:0, ease:SRS_EASE_START, due:0 };
  return it;
}

// SM-2-lite interval from the current streak + ease: 1d, 6d, then ×ease each rep.
// Derived from streak+ease (not a stored interval) so the {seen,correct,streak,
// ease,due} shape stays as pinned.
function srsInterval(streak, ease){
  if(streak<=1) return DAY_MS;
  if(streak===2) return 6*DAY_MS;
  return Math.round(6*DAY_MS * Math.pow(ease, streak-2));
}

// Record one attempt on an item; returns the updated record. `correct` drives the
// SRS: a hit grows ease + pushes `due` out by the interval; a miss zeroes the
// streak, nudges ease down, and re-queues the item to relearn within the minute.
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

// ids that are due now (optionally namespaced by id prefix), most-overdue first —
// the queue the drills read to decide what to resurface next.
function dueItems(now, prefix){
  now = (typeof now==='number') ? now : Date.now();
  return Object.keys(learner.items)
    .filter(id => (!prefix || id.indexOf(prefix)===0) && learner.items[id].due <= now)
    .sort((a,b) => learner.items[a].due - learner.items[b].due);
}

/* Append a finished session (newest last), update the personal best, then prune.
   `extra` carries anything the session number itself can't: today that is `err`, the
   scored tiers' mean absolute timing error in ms. The count and the error are two
   different measurements of one run — `score` stays "bars played" so pre-F1 history
   keeps meaning what it meant, and the mic result rides alongside instead of being
   computed, displayed once and thrown away (which is what happened until B1). */
function recordSession(drill, score, now, extra){
  now = (typeof now==='number') ? now : Date.now();
  const id = String(drill);
  const s = { t: now, drill: id, score: lNum(score, 0) };
  if(extra && typeof extra==='object' && typeof extra.err==='number' && isFinite(extra.err))
    s.err = Math.max(0, extra.err);
  learner.sessions.push(s);
  learnerNoteBest(id, s);
  pruneSessions();
}
/* Keep the newest SESS_PER_ID of each session id, then trim oldest-first to the
   global ceiling. Per-id, so a weekly drill's history isn't evicted by a daily one. */
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
/* The personal best has to be STORED, not derived: it is the one number that must
   outlive the history it came from. Direction comes from the registry track (a
   changes-per-minute best is the highest, a timing error the lowest), defaulting to
   "higher is better" so an undeclared track still records something sane. */
function learnerNoteBest(id, s){
  const tr = (typeof trackBySess==='function') ? trackBySess(sessNs(id)) : null;
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

/* ---- the trend (Phase 10/B1) ----
   The ring buffer has always been a time series and nothing ever read it as one:
   learnerStats() returned five all-time aggregates, so the app could not say "your
   timing error went from 45 ms to 28 ms over six sessions" — which is the sentence
   the six unscored coach tiers were supposed to earn their keep on. This is the one
   helper that turns a session id (or a whole namespace) into a story.

   `dir` is the direction of travel: the mean of the last PERF_TREND_N runs against
   the mean of the ones before them, oriented by the track's `better`. Below
   TREND_EPS of the earlier mean it reads 'flat' rather than inventing a trend out of
   noise — a 1% wobble is not improvement. */
const TREND_EPS = 0.03;
function learnerTrend(idOrNs, now){
  now = (typeof now==='number') ? now : Date.now();
  const key = String(idOrNs);
  // exact session id first; fall back to every session in that namespace
  let runs = learner.sessions.filter(s => s.drill===key);
  const exact = runs.length>0;
  if(!exact) runs = learner.sessions.filter(s => sessNs(s.drill)===key);
  const tr = (typeof trackBySess==='function') ? trackBySess(exact ? sessNs(key) : key) : null;
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

// aggregate readout for the Practice progress card (and tests)
function learnerStats(){
  const ids = Object.keys(learner.items);
  let seen=0, correct=0, bestStreak=0;
  ids.forEach(id => { const it=learner.items[id]; seen+=it.seen; correct+=it.correct; if(it.streak>bestStreak) bestStreak=it.streak; });
  return { items: ids.length, seen, correct, accuracy: seen ? correct/seen : 0, bestStreak, sessions: learner.sessions.length };
}

/* Review queue summary for the progress card: how many items are due now, split by
   id namespace (the prefix before ':'), plus the namespace with the most due. The
   drills already bias toward due items internally; this surfaces the count so the
   loop closes back to the user ("N due — review now").

   Phase 10/B1 — this used to open with `const REVIEW_NS = ['note','interval',
   'chordq','rhythm']`, four strings that were the app's entire answer to "what
   should I practise next?". Six of the nine tracks were not ranked low by it; they
   were absent from its vocabulary, because a performance track has no SM-2 date to
   be overdue against. So the recall half is now derived from the registry, and the
   performance half falls due on its own terms:
     • STALENESS — it has been PERF_STALE_DAYS since you last ran it, or you never have.
     • SLIPPAGE  — the recent runs trend down against the ones before them.
   `due` is the ordered queue (recall first — an overdue SRS item is a fact, a cold
   drill is a suggestion). `total`/`by`/`top` keep their old meaning for the card. */
function reviewNamespaces(){
  return (typeof drillTracks==='function' ? drillTracks() : [])
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
  (typeof drillTracks==='function' ? drillTracks() : []).forEach(tr=>{
    if(tr.kind!=='perf' || !tr.sess) return;
    const tn=learnerTrend(tr.sess, now);
    if(!tn.n){ due.push({ track:tr.id, ns:tr.sess, kind:'perf', n:0, reason:'new' }); return; }
    if(tn.staleDays >= PERF_STALE_DAYS) due.push({ track:tr.id, ns:tr.sess, kind:'perf', n:0, reason:'stale' });
    else if(tn.dir==='down') due.push({ track:tr.id, ns:tr.sess, kind:'perf', n:0, reason:'slipping' });
  });
  return { total, by, top, due };
}
/* Open a track by id — the registry's own `start`, so the shell no longer carries a
   hand-written ns → starter map that quietly covered four of nine tracks. */
function startTrack(id){
  const tr = (typeof trackById==='function') ? trackById(id) : null;
  if(!tr || typeof tr.start!=='function') return false;
  /* Phase 10/B2 — this is now the ONE door into a drill: the practice cards, the
     review button, the reference seams and the timed session all come through here,
     which is what lets the shared header name the drill you actually opened. A drill's
     own start() stays callable directly (the tests do that), it just leaves the header
     unnamed — so the door records the choice, not the drill. */
  if(typeof setCurTrack==='function') setCurTrack(tr.id);
  tr.start();
  return true;
}
// recent-activity readout: distinct calendar days practised within the last `win`
// days (default 7), from the sessions ring buffer — powers the "active days" stat
// that makes the unscored coach tiers feel rewarding without a score.
function learnerActivity(now, win){
  now=(typeof now==='number')?now:Date.now(); win=win||7;
  const cutoff=now-win*DAY_MS, days={};
  learner.sessions.forEach(s=>{ if(s.t>=cutoff) days[Math.floor(s.t/DAY_MS)]=1; });
  return { days: Object.keys(days).length, window: win };
}

// ---- bounds-checked restore (mirrors loadState's defensive idiom) ----
function lInt(v, def){ return (Number.isFinite(v) && Math.floor(v)===v) ? v : (def||0); }
function lNum(v, def){ return (typeof v==='number' && isFinite(v)) ? v : (def||0); }
function lClampNum(v, lo, hi, def){ return (typeof v==='number' && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : def; }
function normalizeLearner(raw){
  const out = newLearner();
  if(!raw || typeof raw!=='object') return out;
  /* Version gate. v1 → v2 (Phase 10/B1) is the model's first migration, and it is
     PURELY ADDITIVE: `items` and `sessions` carry over untouched, and `best` — the
     one field that can't be derived once its history rolls off — is rebuilt from the
     sessions we still hold. Nothing a player did is lost, which is the whole bar
     Phase 3 set for a `v` bump. Anything older or newer than we know still degrades
     to a fresh model rather than guessing. */
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
  /* The v1 → v2 migration proper. A v1 store has no `best` table, so rebuild it from
     the sessions that survived — learnerNoteBest only ever replaces a strictly better
     number, so replaying every session is safe on a v2 store too (it heals a table
     that predates a track's first run rather than clobbering it). The per-id
     retention policy is applied on read for the same reason: a v1 store's flat
     50-entry buffer lands in the shape every reader now expects.
     Both write through the module-level `learner`, so swap it for the duration. */
  const keep = learner;
  learner = out;
  try{
    out.sessions.forEach(s => learnerNoteBest(s.drill, s));
    pruneSessions();
  } finally { learner = keep; }
  return out;
}
