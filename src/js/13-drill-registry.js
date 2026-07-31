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
     { id, mode:'practice'|'ear', area:'<area element id>',
       isActive:()=>boolean,       // is this drill running right now?
       exit:fn,                    // tear it down + restore the home view
       refreshLang:fn|undefined }  // optional: re-paint an in-flight drill

   Load order note: this file sits at slot 13 so DRILLS exists before the slot-14
   drill files register into it (a `const` is not hoisted the way a function
   declaration is, so the ordering here is load-bearing). */

const DRILLS = [];

function registerDrill(d){ DRILLS.push(d); return d; }

// a drill's isActive() reads its own module-level state; guard so one broken
// drill can never take down a mode switch.
function drillIsActive(d){ try{ return !!d.isActive(); }catch(_){ return false; } }

// the running drill (optionally restricted to one mode), or null
function activeDrill(mode){
  return DRILLS.find(d => (!mode || d.mode===mode) && drillIsActive(d)) || null;
}

// end every running drill that does NOT belong to `mode` (pass 'reference' to end them all)
function exitDrillsExcept(mode){
  DRILLS.forEach(d=>{ if(d.mode!==mode && drillIsActive(d) && typeof d.exit==='function') d.exit(); });
}

function drillHomeId(mode){ return mode==='ear' ? 'ear-home' : 'practice-home'; }

// show a mode's home view and hide every drill area belonging to that mode
function showDrillHome(mode){
  const home=document.getElementById(drillHomeId(mode));
  if(home) home.hidden=false;
  DRILLS.forEach(d=>{
    if(d.mode!==mode || !d.area) return;
    const a=document.getElementById(d.area); if(a) a.hidden=true;
  });
}

/* re-paint whatever drill is in flight. Called on a language switch (applyLang)
   and on a meter change — both change what a running drill should be showing.
   At most one drill is ever active, so this is cheap. */
function refreshDrillsLang(){
  DRILLS.forEach(d=>{ if(typeof d.refreshLang==='function' && drillIsActive(d)) d.refreshLang(); });
}
