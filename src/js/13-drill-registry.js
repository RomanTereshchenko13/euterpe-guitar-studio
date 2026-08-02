/* ===================== Drill registry =====================
   ONE place every drill announces itself, so the shell never carries a
   hand-maintained list of drills.

   Why this exists: the shell needs to do four things generically — end a
   running drill when you leave its mode, decide whether a mode's home view
   should be showing, hide that mode's drill areas, and re-render an in-flight
   drill on a language / meter change. Before this, each of those was an inline
   list in 15-wiring-init.js / 11-notes-circle-lang.js that had to be edited by
   hand for every new drill. Two of those four lists had already drifted (the
   Phase 7a timing drill was missing from both, so re-entering Practice while it
   ran painted the home view on top of the running drill).

   Now each drill file calls registerDrill() at load and the shell iterates
   DRILLS. Adding a drill is: one file + its markup. Nothing to remember.

   An entry:
     { id, area:'<area element id>',
       isActive:()=>boolean,       // is this drill running right now?
       exit:fn,                    // tear it down + restore the home view
       refreshLang:fn|undefined,   // optional: re-paint an in-flight drill
       onKey:fn|undefined,         // optional: re-derive from a new context key
       tempo:true|undefined,       // optional: this drill runs on the shared tempo
       tracks:[...] }              // what this drill teaches + how its result is measured

   TRACKS (Phase 10/B1). A drill is not the unit the learner model cares about — a
   *track* is. Over-the-changes is one drill with two tracks (comping and chord-tone
   targeting, different metrics, opened from different cards); ear training is one
   drill with three. And the note drill has both kinds at once: per-item recall AND a
   per-round accuracy. So the registry declares tracks, and the model reads them:

     { id:'note',                 // stable track id
       kind:'recall'|'perf',      // recall → SRS-scheduled · perf → trended, with a best
       items:'note',              // recall only: the item-id namespace ("note:E")
       sess:'notes',              // the session drill-id namespace ("timing:8ths")
       better:'high'|'low',       // perf only: which direction is improvement
       unit:'pct'|'bars'|'cpm',   // perf only: what the number is, for the readout
       start:fn }                 // open this track — the review router's one map

   Before this, three separate hand-maintained lists encoded the same knowledge and
   all three were incomplete: REVIEW_NS hardcoded four namespaces, startReview()
   hardcoded the ns→starter mapping, and nothing at all knew which sessions were
   comparable to which. Six of the nine tracks were invisible to "what should I
   practise next?" — not ranked low, absent from its vocabulary.

   There used to be a `mode` field too ('practice' | 'ear'), because ear training was
   its own top-level mode with its own duplicate home view. It's a pillar like Rhythm
   or Lead, not a mode, so it folded into Practice and the field became a constant —
   every drill now lives under one home, and the mode axis is Reference vs Practice.

   Load order note: this file sits at slot 13 so DRILLS exists before the slot-14
   drill files register into it (a `const` is not hoisted the way a function
   declaration is, so the ordering here is load-bearing). */

const DRILLS = [];

function registerDrill(d){ DRILLS.push(d); return d; }

// a drill's isActive() reads its own module-level state; guard so one broken
// drill can never take down a mode switch.
function drillIsActive(d){ try{ return !!d.isActive(); }catch(_){ return false; } }

// the running drill, or null
function activeDrill(){
  return DRILLS.find(drillIsActive) || null;
}

// end every running drill (leaving Practice, or starting a different drill)
function exitAllDrills(){
  DRILLS.forEach(d=>{ if(drillIsActive(d) && typeof d.exit==='function') d.exit(); });
}

/* The shared drill key picker (#drill-ctx) changed the context key. Every practice drill
   used to carry its own copy of that row — six identical markup blocks all calling the same
   setKey — so the row moved to the shell and the drill now only says what it has to re-derive
   when the key moves (rebuild its bars, restart its round, repaint its board). Optional: a
   drill with nothing key-dependent just omits onKey. */
function drillKeyChanged(){
  const d=activeDrill();
  if(d && typeof d.onKey==='function'){ try{ d.onKey(); }catch(_){} }
}

/* The strip's Quit is universal, but its key picker only means something to a drill
   that declares onKey() — the ear, note-naming and one-minute-changes drills don't
   re-derive from the key, so showing them a key picker would be a control that
   adjusts nothing. Derived from the registry, so a drill opts in by having onKey.

   Tempo (Phase 10/A1) works the same way and for the same reason: four of the nine
   drills ride the shared scheduler and five don't, so `tempo:true` opts a drill into
   the stepper rather than the shell hard-coding which drills are timed. Both halves
   are *derived*, which is the whole point of the strip — a drill declares what it
   needs and never touches this markup. */
function applyDrillCtx(){
  const d=activeDrill();
  const key=!!(d && typeof d.onKey==='function'), tmp=!!(d && d.tempo);
  ['drill-ctx-div','drill-ctx-keylbl','drill-ctx-key'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.hidden=!key;
  });
  ['drill-ctx-tdiv','drill-ctx-tlbl','drill-ctx-tempo'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.hidden=!tmp;
  });
  // the stepper's readout is only painted here, so it can't go stale behind a
  // tempo change made from the header slider while a drill is open
  if(tmp && typeof setTempo==='function') setTempo(tempo);
}

/* ---- tracks (Phase 10/B1): the learner model's view of the registry ----
   Flat list of every declared track, each carrying a back-ref to its drill. Read
   lazily (never cached) because drills register at load slot 14, after this file. */
function drillTracks(){
  const out=[];
  DRILLS.forEach(d=>{ (d.tracks||[]).forEach(tr=>{ out.push(Object.assign({ drill:d }, tr)); }); });
  return out;
}
// the track whose recall items live under this id namespace ("note", "interval")
function trackByItems(ns){ return drillTracks().find(tr => tr.items===ns) || null; }
// the track whose sessions are recorded under this drill-id namespace ("timing", "comp")
function trackBySess(ns){ return drillTracks().find(tr => tr.sess===ns) || null; }
// a track by its own id — what the review router is handed
function trackById(id){ return drillTracks().find(tr => tr.id===id) || null; }
/* The session ids drills write are "<namespace>:<variant>" ("timing:8ths",
   "changes:C-G"), except the three ear tracks, which have no variant. One splitter,
   so every reader agrees on where the namespace ends. */
function sessNs(drillId){
  const s=String(drillId||''), i=s.indexOf(':');
  return i<0 ? s : s.slice(0,i);
}

// show the practice home and hide every drill area
function showDrillHome(){
  const home=document.getElementById('practice-home');
  if(home) home.hidden=false;
  DRILLS.forEach(d=>{
    if(!d.area) return;
    const a=document.getElementById(d.area); if(a) a.hidden=true;
  });
  applyDrillCtx();
}

/* re-paint whatever drill is in flight. Called on a language switch (applyLang)
   and on a meter change — both change what a running drill should be showing.
   At most one drill is ever active, so this is cheap. */
function refreshDrillsLang(){
  DRILLS.forEach(d=>{ if(typeof d.refreshLang==='function' && drillIsActive(d)) d.refreshLang(); });
}
