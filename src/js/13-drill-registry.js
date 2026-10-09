/* ===================== Drill registry =====================
   Every drill announces itself here, so the shell (mode switch, home view, language
   repaint, drill header) iterates DRILLS instead of keeping its own list of drills.

   An entry:
     { id, area:'<area element id>',
       isActive:()=>boolean,       // is this drill running right now?
       exit:fn,                    // tear it down + restore the home view
       refreshLang:fn|undefined,   // optional: re-paint an in-flight drill
       onKey:fn|undefined,         // optional: re-derive from a new context key
       tempo:true|undefined,       // optional: this drill runs on the shared tempo
       setup:'<element id>'|undefined,  // optional: the disclosure the shell folds
       mic:()=>boolean|undefined,  // optional: does it offer a scored tier right now?
       onMic:fn|undefined,         // optional: the shared mic button was pressed
       tracks:[...] }              // what this drill teaches + how its result is measured

   The learner model works in TRACKS, not drills: ear training is one drill with two
   tracks, and the note drill has both kinds (per-item recall AND a per-round score).

     { id:'note',                 // stable track id
       kind:'recall'|'perf',      // recall → SRS-scheduled · perf → trended, with a best
       items:'note',              // recall only: the item-id namespace ("note:E")
       sess:'notes',              // the session drill-id namespace ("timing:8ths")
       better:'high'|'low',       // perf only: which direction is improvement
       unit:'pct'|'bars'|'cpm',   // perf only: what the number is, for the readout
       scored:'mic'|'acc',        // optional: what tier this track offers
       start:fn }                 // open this track

   `scored` is declared, not derived from mic(): mic() says whether the tier can run on
   this device right now, the card badge says what kind of drill this is on any device.
   Omitted means 'coach' — the drill hands you a number to beat and judges nothing.

   Slot 13 is load-bearing: DRILLS is a const, so it must exist before the slot-14
   drill files register into it. */

const DRILLS = [];

function registerDrill(d){ DRILLS.push(d); return d; }

// guarded, so one broken drill can never take down a mode switch
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
/* The header's Quit. Both ways out (this and exitAllDrills) end in drillShellLeft(),
   so the header never keeps naming a drill that isn't running. */
function quitDrill(){
  const d=activeDrill();
  if(d && typeof d.exit==='function') d.exit();
  drillShellLeft();
}
/* Quit and a mode switch are the two ways a player abandons a timed session, so this
   is where the session learns it is over. sessionInterrupt() is a no-op while the
   session itself is chaining from one block to the next. */
function drillShellLeft(){
  sessionInterrupt();
  setCurTrack(null); applyDrillCtx();
}

/* The shared key picker changed the context key: tell the running drill to re-derive
   (bars, round, board). Drills with nothing key-dependent omit onKey. */
function drillKeyChanged(){
  const d=activeDrill();
  if(d && typeof d.onKey==='function'){ try{ d.onKey(); }catch(_){} }
}

/* ---- THE DRILL SHELL ----
   Which track is running. Every door into a drill goes through startTrack(), so the
   header can name the TRACK the player picked — not the drill hosting it (ear
   training hosts two). */
let curTrack = null;
function setCurTrack(id){ curTrack = id || null; }
function curTrackObj(){ return curTrack ? trackById(curTrack) : null; }

// the setup and hint disclosures; one drill runs at a time, re-derived on every start
let drillSetupOpen = true, drillHintOpen = false;
/* Tracks the player has run at least once (persisted). The hint opens only on a
   first meeting: it is the only instruction a first-timer has. */
let drillSeen = {};

// every drill's start(): the setup opens, the hint opens only if this track is new
function drillShellEnter(){
  // a drill is starting, so whatever the last timed session reported has been read
  sessionClearReport();
  drillSetupOpen = true;
  const tr = curTrack;
  drillHintOpen = !(tr && drillSeen[tr]);
  if(tr && !drillSeen[tr]){ drillSeen[tr]=1; saveState(); }
  applyDrillCtx();
}
/* Called when a run actually begins (Play / Start): fold the setup — a picker you
   have already used is the least useful thing on screen while playing. Re-opening
   it mid-run is one tap. */
function drillRunStarted(){
  if(!drillSetupOpen) return;
  drillSetupOpen=false;
  applyDrillCtx();
}

/* The header is derived from the running drill: the key picker shows only for a drill
   with onKey(), the tempo stepper only for `tempo:true`, the mic only when mic() says
   so. A drill declares what it needs and never touches this markup. */
function applyDrillCtx(){
  const d=activeDrill();
  const key=!!(d && typeof d.onKey==='function'), tmp=!!(d && d.tempo);
  const show=(id,on)=>{ const el=document.getElementById(id); if(el) el.hidden=!on; };
  ['drill-ctx-keylbl','drill-ctx-key'].forEach(id=>show(id,key));
  ['drill-ctx-tlbl','drill-ctx-tempo'].forEach(id=>show(id,tmp));
  // the stepper's readout is only painted here, so keep it in step with the header slider
  if(tmp) setTempo(tempo);

  // the name comes from the track the player opened, not from the drill that hosts it
  const nm=document.getElementById('drill-ctx-name');
  if(nm){ const tr=curTrackObj(); nm.textContent = tr && tr.label ? t(tr.label) : ''; }

  /* the setup handle, only for a drill that HAS a setup — a disclosure over an empty
     box is worse than none */
  const hasSetup=!!(d && d.setup && document.getElementById(d.setup));
  const sb=document.getElementById('drill-ctx-setup');
  if(sb){
    sb.hidden=!hasSetup;
    if(hasSetup){
      sb.textContent=t('drill_setup')+(drillSetupOpen?' ▴':' ▾');
      sb.classList.toggle('active', drillSetupOpen);
      sb.setAttribute('aria-expanded', drillSetupOpen?'true':'false');
      if(d.setup) sb.setAttribute('aria-controls', d.setup);
    }
  }
  if(document.body){
    // the panel's own heading would sit above the drill header that already names it
    document.body.classList.toggle('drill-running', !!d);
    document.body.classList.toggle('drill-setup-open', hasSetup && drillSetupOpen);
    document.body.classList.toggle('drill-help-open', drillHintOpen);
  }
  const hb=document.getElementById('drill-ctx-help');
  if(hb){ hb.classList.toggle('on', drillHintOpen); hb.setAttribute('aria-expanded', drillHintOpen?'true':'false'); }

  /* the mic: visibility is the shell's call; the label and pressed state belong to
     13-scored.js, which knows whether it is listening */
  const mb=document.getElementById('drill-ctx-mic');
  if(mb){
    let on=false;
    if(d && typeof d.mic==='function'){ try{ on=!!d.mic(); }catch(_){ on=false; } }
    mb.hidden=!on;
  }
  // the timed session's block counter and Next, painted by the session module
  sessionPaint();
}
// the shared mic button was pressed → hand it to whichever drill is running
function drillMicToggle(){
  const d=activeDrill();
  if(d && typeof d.onMic==='function'){ try{ d.onMic(); }catch(_){} }
}
// the setup / hint disclosures, from the two header buttons
function drillSetupToggle(){ drillSetupOpen=!drillSetupOpen; applyDrillCtx(); }
function drillHintToggle(){ drillHintOpen=!drillHintOpen; applyDrillCtx(); }

/* ---- tracks: the learner model's view of the registry ----
   Read lazily (never cached): drills register at slot 14, after this file. */
function drillTracks(){
  const out=[];
  DRILLS.forEach(d=>{ (d.tracks||[]).forEach(tr=>{ out.push(Object.assign({ drill:d }, tr)); }); });
  return out;
}
// the track whose recall items live under this id namespace ("note", "interval")
function trackByItems(ns){ return drillTracks().find(tr => tr.items===ns) || null; }
// the track whose sessions are recorded under this drill-id namespace ("timing", "comp")
function trackBySess(ns){ return drillTracks().find(tr => tr.sess===ns) || null; }
// a track by its own id
function trackById(id){ return drillTracks().find(tr => tr.id===id) || null; }
/* What tier a track offers, as a badge key — derived from the registry, so a card
   can't claim a tier its drill doesn't have. */
function trackBadge(tr){
  const s = tr && tr.scored;
  return s==='mic' ? 'badge_mic' : s==='acc' ? 'badge_acc' : 'badge_coach';
}
/* Session ids are "<namespace>:<variant>" ("timing:8ths"), except the ear tracks,
   which have no variant. One splitter, so every reader agrees. */
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

/* re-paint the drill in flight, on a language switch or a meter change */
function refreshDrillsLang(){
  DRILLS.forEach(d=>{ if(typeof d.refreshLang==='function' && drillIsActive(d)) d.refreshLang(); });
}
