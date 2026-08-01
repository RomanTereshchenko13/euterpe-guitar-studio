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
       onKey:fn|undefined }        // optional: re-derive from a new context key

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
   adjusts nothing. Derived from the registry, so a drill opts in by having onKey. */
function applyDrillCtx(){
  const d=activeDrill(), on=!!(d && typeof d.onKey==='function');
  ['drill-ctx-div','drill-ctx-keylbl','drill-ctx-key'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.hidden=!on;
  });
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
