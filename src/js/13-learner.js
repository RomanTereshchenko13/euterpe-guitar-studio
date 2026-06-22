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

const LEARNER_V = 1;
const SRS_EASE_MIN = 1.3, SRS_EASE_MAX = 3.0, SRS_EASE_START = 2.5;
const DAY_MS = 86400000;
const SESS_MAX = 50;        // sessions ring buffer cap (newest last)
const ITEMS_MAX = 5000;     // hard cap so a tampered store can't grow unbounded
const ID_MAX = 64;          // max stable-id length

function newLearner(){ return { v: LEARNER_V, items: {}, sessions: [] }; }
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

// append a finished session to the bounded ring buffer (newest last)
function recordSession(drill, score, now){
  now = (typeof now==='number') ? now : Date.now();
  learner.sessions.push({ t: now, drill: String(drill), score: (typeof score==='number' && isFinite(score)) ? score : 0 });
  if(learner.sessions.length > SESS_MAX) learner.sessions.splice(0, learner.sessions.length - SESS_MAX);
}

// aggregate readout for the Practice progress card (and tests)
function learnerStats(){
  const ids = Object.keys(learner.items);
  let seen=0, correct=0, bestStreak=0;
  ids.forEach(id => { const it=learner.items[id]; seen+=it.seen; correct+=it.correct; if(it.streak>bestStreak) bestStreak=it.streak; });
  return { items: ids.length, seen, correct, accuracy: seen ? correct/seen : 0, bestStreak, sessions: learner.sessions.length };
}

// review queue summary for the progress card: how many items are due now, split by
// id namespace (the prefix before ':'), plus the namespace with the most due. The
// drills already bias toward due items internally; this surfaces the count so the
// loop closes back to the user ("N due — review now"). Only the SRS-bearing
// namespaces count (the rhythm coaches write sessions, not items).
const REVIEW_NS = ['note','interval','chordq','rhythm'];
function learnerReview(now){
  now=(typeof now==='number')?now:Date.now();
  const by={}; REVIEW_NS.forEach(ns=>by[ns]=0); let total=0;
  Object.keys(learner.items).forEach(id=>{
    if(learner.items[id].due>now) return;
    const ns=id.slice(0, id.indexOf(':'));
    if(by[ns]===undefined) return;
    by[ns]++; total++;
  });
  let top=null, max=0; REVIEW_NS.forEach(ns=>{ if(by[ns]>max){ max=by[ns]; top=ns; } });
  return { total, by, top };
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
function lClampNum(v, lo, hi, def){ return (typeof v==='number' && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : def; }
function normalizeLearner(raw){
  const out = newLearner();
  if(!raw || typeof raw!=='object') return out;
  if(raw.v !== LEARNER_V) return out;          // unknown version → fresh (future: migrate by raw.v)
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
      .map(s => ({ t: s.t, drill: typeof s.drill==='string' ? s.drill.slice(0,32) : '', score: (typeof s.score==='number' && isFinite(s.score)) ? s.score : 0 }));
  }
  return out;
}
