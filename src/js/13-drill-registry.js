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
       setup:'<element id>'|undefined,  // optional: the disclosure the shell folds (B2)
       mic:()=>boolean|undefined,  // optional: does it offer a scored tier right now? (B2)
       onMic:fn|undefined,         // optional: the shared mic button was pressed (B2)
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
  drillShellLeft();
}
/* The one way OUT, for the header's Quit. Both doors — this and exitAllDrills — end by
   forgetting which track was open, so the header can't keep naming a drill that isn't
   running. (The drills' own exit() functions restore the home view; what they have never
   known about is the shell around them, and B2 kept it that way.) */
function quitDrill(){
  const d=activeDrill();
  if(d && typeof d.exit==='function') d.exit();
  drillShellLeft();
}
function drillShellLeft(){ setCurTrack(null); applyDrillCtx(); }

/* The shared drill key picker (#drill-ctx) changed the context key. Every practice drill
   used to carry its own copy of that row — six identical markup blocks all calling the same
   setKey — so the row moved to the shell and the drill now only says what it has to re-derive
   when the key moves (rebuild its bars, restart its round, repaint its board). Optional: a
   drill with nothing key-dependent just omits onKey. */
function drillKeyChanged(){
  const d=activeDrill();
  if(d && typeof d.onKey==='function'){ try{ d.onKey(); }catch(_){} }
}

/* ---- THE DRILL SHELL (Phase 10/B2) ----
   Which track is running. The practice cards, the review router, the seams and the
   timed session all open a drill through startTrack(), so the shell always knows what
   the player asked for — which is how the header can finally say WHICH DRILL THIS IS.
   Nine drills used to render under one <h2>Практика</h2> and never name themselves; a
   drill's own `.drill-head` showed the chord, the hit count or the round instead.
   It is the TRACK and not the drill because two of the seven entries carry more than
   one (over-the-changes is comping *or* targeting; ear training is three skills), and
   "Over the changes" is not what the player pressed. */
let curTrack = null;
function setCurTrack(id){ curTrack = id || null; }
function curTrackObj(){ return curTrack && typeof trackById==='function' ? trackById(curTrack) : null; }

/* The setup disclosure's open state, and the hint's. Neither is per-drill state, since
   one drill runs at a time; both are re-derived on every start (drillShellEnter). */
let drillSetupOpen = true, drillHintOpen = false;
/* Which tracks the player has already run at least once — the ONE thing here that
   persists (12-toolbar-state.js). Collapsing a drill's instructions is a kindness to
   someone who knows the drill and an ambush for a first-timer, for whom that paragraph
   is the only instruction on screen; so the reveal is per track and happens once. */
let drillSeen = {};

/* Called by every drill's start(): reset the shell for a fresh drill. The setup opens
   (you are about to configure a run), and the hint opens only if this track is new. */
function drillShellEnter(){
  drillSetupOpen = true;
  const tr = curTrack;
  drillHintOpen = !(tr && drillSeen[tr]);
  if(tr && !drillSeen[tr]){ drillSeen[tr]=1; if(typeof saveState==='function') saveState(); }
  applyDrillCtx();
}
/* Called by a drill when its run actually begins (Play, or the timed run's Start). The
   setup folds here rather than on a timer or a guess: a picker you have already used is
   the least useful thing on the screen while you are playing, and it was taking the top
   half of a phone viewport with it. Re-opening it mid-run is one tap and allowed. */
function drillRunStarted(){
  if(!drillSetupOpen) return;
  drillSetupOpen=false;
  applyDrillCtx();
}

/* The strip's Quit is universal, but its key picker only means something to a drill
   that declares onKey() — the ear, note-naming and one-minute-changes drills don't
   re-derive from the key, so showing them a key picker would be a control that
   adjusts nothing. Derived from the registry, so a drill opts in by having onKey.

   Tempo (Phase 10/A1) works the same way and for the same reason: four of the nine
   drills ride the shared scheduler and five don't, so `tempo:true` opts a drill into
   the stepper rather than the shell hard-coding which drills are timed.

   B2 adds three more derived halves — the name, the setup handle and the mic — on the
   same principle, which is the whole point of the header: a drill declares what it
   needs and never touches this markup. */
function applyDrillCtx(){
  const d=activeDrill();
  const key=!!(d && typeof d.onKey==='function'), tmp=!!(d && d.tempo);
  const show=(id,on)=>{ const el=document.getElementById(id); if(el) el.hidden=!on; };
  ['drill-ctx-keylbl','drill-ctx-key'].forEach(id=>show(id,key));
  ['drill-ctx-tlbl','drill-ctx-tempo'].forEach(id=>show(id,tmp));
  /* Both dividers that used to sit in this strip are gone (B2). The key picker is twelve
     buttons and wraps at phone widths, so a divider between the two groups reliably
     landed at the START of a line — where it is not a separator but a stray vertical
     rule, the same defect B2 fixed under PROGRESSION. ТОНАЛЬНІСТЬ / ТЕМП already say
     where one group ends and the next begins. */
  // the stepper's readout is only painted here, so it can't go stale behind a
  // tempo change made from the header slider while a drill is open
  if(tmp && typeof setTempo==='function') setTempo(tempo);

  // the name — from the track the player opened, not from the drill that hosts it
  const nm=document.getElementById('drill-ctx-name');
  if(nm){ const tr=curTrackObj(); nm.textContent = tr && tr.label && typeof t==='function' ? t(tr.label) : ''; }

  /* the setup handle. Only for a drill that HAS a setup: the note-naming, ear and
     call-and-response drills configure nothing, and a disclosure over an empty box is
     worse than no disclosure. One-minute changes is the odd one out for the opposite
     reason — its setup is a whole exclusive step, not a disclosure. */
  const hasSetup=!!(d && d.setup && document.getElementById(d.setup));
  const sb=document.getElementById('drill-ctx-setup');
  if(sb){
    sb.hidden=!hasSetup;
    if(hasSetup && typeof t==='function'){
      sb.textContent=t('drill_setup')+(drillSetupOpen?' ▴':' ▾');
      sb.classList.toggle('active', drillSetupOpen);
      sb.setAttribute('aria-expanded', drillSetupOpen?'true':'false');
      if(d.setup) sb.setAttribute('aria-controls', d.setup);
    }
  }
  if(document.body){
    /* `Практика` is the panel's heading, and while a drill is running it is the WRONG
       heading — the header below it now names the drill, so the two together read as a
       breadcrumb nobody asked for, costing a band of the phone viewport at the point
       where B2 was busy reclaiming one. */
    document.body.classList.toggle('drill-running', !!d);
    document.body.classList.toggle('drill-setup-open', hasSetup && drillSetupOpen);
    document.body.classList.toggle('drill-help-open', drillHintOpen);
  }
  const hb=document.getElementById('drill-ctx-help');
  if(hb){ hb.classList.toggle('on', drillHintOpen); hb.setAttribute('aria-expanded', drillHintOpen?'true':'false'); }

  /* the mic. Visibility is the SHELL's call (a drill either offers a scored tier right
     now or it doesn't); the label and pressed state stay 13-scored.js's, because only
     the running scoredRun knows whether it is listening. */
  const mb=document.getElementById('drill-ctx-mic');
  if(mb){
    let on=false;
    if(d && typeof d.mic==='function'){ try{ on=!!d.mic(); }catch(_){ on=false; } }
    mb.hidden=!on;
  }
}
// the shared mic button was pressed → hand it to whichever drill is running
function drillMicToggle(){
  const d=activeDrill();
  if(d && typeof d.onMic==='function'){ try{ d.onMic(); }catch(_){} }
}
// the setup / hint disclosures, from the two header buttons
function drillSetupToggle(){ drillSetupOpen=!drillSetupOpen; applyDrillCtx(); }
function drillHintToggle(){ drillHintOpen=!drillHintOpen; applyDrillCtx(); }

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
  setCurTrack(null);
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
