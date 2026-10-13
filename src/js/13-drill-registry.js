/* ===================== Drill registry =====================
   Every drill announces itself here, so the shell (mode switch, home view, language
   repaint, drill header, the strip) iterates DRILLS instead of keeping its own list.

   An entry:
     { id, area:'<area element id>',
       begin:fn(arg),              // set up its state + paint its stage (the shell does the rest)
       end:fn,                     // stop its clocks, release the mic, drop its state
       isActive:()=>boolean,       // is this drill running right now?
       refreshLang:fn|undefined,   // optional: re-paint an in-flight drill
       onKey:fn|undefined,         // optional: re-derive from a new key or chord
       key:true|fn|undefined,      // optional: it reads the key → the strip's key chip
       chord:true|fn|undefined,    // optional: it reads the chord → the strip's chord chip
                                   //   (a function when it depends on the drill's setup)
       tempo:true|undefined,       // optional: it runs on the shared tempo → the tempo chip
       play:fn|undefined,          // optional: the strip's ▶ in this drill
       playing:()=>boolean|undefined,  // optional: ▶ is a play/stop toggle (■ while true)
       playKey:()=>'<i18n key>'|undefined,  // optional: what ▶ says (Start, Replay …)
       setup:'<element id>'|undefined,  // optional: the disclosure the shell folds
       mic:()=>boolean|undefined,  // optional: does it offer a scored tier right now?
       micOn:()=>boolean|undefined,  // optional: is that tier switched on?
       onMic:fn|undefined,         // optional: the shared mic button was pressed
       tracks:[...] }              // what this drill teaches + how its result is measured

   The learner model works in TRACKS, not drills: ear training is one drill with two
   tracks, and the note drill has both kinds (per-item recall AND a per-round score).

     { id:'note',                 // stable track id
       kind:'recall'|'perf',      // recall → SRS-scheduled · perf → trended, with a best
       items:'note',              // recall only: the item-id namespace ("note:E")
       sess:'notes',              // the session drill-id namespace ("timing:8ths")
       reads:['strum',…],         // optional: older namespaces this track carries on
       better:'high'|'low',       // perf only: which direction is improvement
       unit:'pct'|'bars'|'cpm',   // perf only: what the number is, for the readout
       metric:'err',              // optional: the headline and trend are the timing error
       scored:'mic',              // optional: it listens — the card's 🎤
       arg:any }                  // optional: handed to the drill's begin()

   `scored` is declared, not derived from mic(): mic() says whether the tier can run on
   this device right now, the card's 🎤 says what kind of drill this is on any device.

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

// end every running drill (leaving Practice, or the session changing block)
function exitAllDrills(){
  DRILLS.forEach(d=>{ if(drillIsActive(d)) drillClose(d); });
  drillShellLeft();
}
/* The header's Quit: the player abandons the drill (and a timed session with it). Both
   ways out (this and exitAllDrills) end in drillShellLeft(), so the header never keeps
   naming a drill that isn't running. Focus goes back to the card that opened it. */
function quitDrill(){
  const d=activeDrill(), tr=curTrack;
  if(d) drillClose(d);
  drillShellLeft();
  focusTrackCard(tr);
}
/* Quit and a mode switch are the two ways a player abandons a timed session, so this
   is where the session learns it is over. sessionInterrupt() is a no-op while the
   session itself is chaining from one block to the next. */
function drillShellLeft(){
  sessionInterrupt();
  setCurTrack(null); applyDrillCtx();
}

/* ---- the lifecycle: the registry opens and closes every drill ----
   A drill provides begin(arg) (its state and the first paint of its stage) and end()
   (stop its clocks, release the mic, drop its state). Everything around them is here:
   one area shown and the home hidden, the header named and focused; on the way out the
   area hidden, the home repainted, focus back on the card. */
function drillOpen(d, arg){
  if(!d) return;
  DRILLS.forEach(o=>{ if(drillIsActive(o)) o.end(); });   // one drill at a time; Again restarts
  const home=document.getElementById('practice-home'); if(home) home.hidden=true;
  DRILLS.forEach(o=>{ const a=o.area && document.getElementById(o.area); if(a) a.hidden = o!==d; });
  d.begin(arg);
  drillShellEnter();
  const nm=document.getElementById('drill-ctx-name'); if(nm && nm.textContent) nm.focus();
}
function drillClose(d){
  if(drillIsActive(d)) d.end();
  const a=d.area && document.getElementById(d.area); if(a) a.hidden=true;
  const home=document.getElementById('practice-home'); if(home) home.hidden=false;
  renderPractice();
}
/* A finished drill's Done: closes it like Quit but leaves a timed session running —
   the session moves on to its next block by itself. */
function drillDone(d){
  d = d || activeDrill(); if(!d) return;
  const tr=curTrack;
  drillClose(d);
  setCurTrack(null); applyDrillCtx();
  focusTrackCard(tr);
}
function focusTrackCard(id){
  if(!id) return;
  const card=document.querySelector('#practice-home .drill-card[data-track="'+id+'"]');
  if(card && !card.closest('[hidden]')) card.focus();
}
function drillById(id){ return DRILLS.find(d=>d.id===id) || null; }

/* A run that counts: recorded, saved, the home behind the drill repainted, and the
   result said aloud in the live region — the summary and score lines are only seen. */
function drillRecord(sessId, score, err){
  recordSession(sessId, score, undefined, err);
  saveState();
  renderPractice();
  const tr=trackBySess(sessNs(sessId));
  // a track scored on its timing error says that, when the run has one
  const said = tr && tr.metric==='err' && err ? { last:err.err, unit:'ms' } : { last:score, unit:tr ? tr.unit : '' };
  const live=document.getElementById('drill-live');
  if(live) live.textContent=(tr && tr.label ? t(tr.label)+': ' : '')+trendScore(said);
}

/* The finite drills' summary (notes, ear): stats, a way back to what teaches the misses,
   Again and Done. `stats` is [[value, label]…]; Again reopens the same track. */
function renderDrillSummary(hostId, activeId, o){
  const el=document.getElementById(hostId); if(!el) return;
  const act=document.getElementById(activeId); if(act) act.hidden=true;
  const stat=(v,l)=>'<div class="pp-stat"><div class="pp-val">'+v+'</div><div class="pp-lab">'+l+'</div></div>';
  const review=o.review || [];
  el.innerHTML='<div class="drill-done-title">'+t('drill_complete')+'</div>'+
    '<div class="pp-stats">'+o.stats.map(s=>stat(s[0], s[1])).join('')+'</div>'+
    drillReviewHTML(review)+
    '<div class="drill-actions"><button class="btn play" data-sum="again"></button><button class="btn" data-sum="done"></button></div>';
  el.hidden=false;
  wireDrillReview(el, review);
  const ag=el.querySelector('[data-sum="again"]'); ag.textContent=t('drill_again'); ag.onclick=o.again;
  const dn=el.querySelector('[data-sum="done"]');  dn.textContent=t('drill_done');  dn.onclick=()=>drillDone();
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
/* Called when a run actually begins (▶): fold the setup and the hint — a picker you have
   already used and a paragraph you have already read are the least useful things on
   screen while playing, and the stage moves up under the strip. Re-opening either
   mid-run is one tap. */
function drillRunStarted(){
  if(!drillSetupOpen && !drillHintOpen) return;
  drillSetupOpen=false; drillHintOpen=false;
  applyDrillCtx();
}

/* The header and the strip are derived from the running drill: the strip's key, chord
   and tempo chips and its ▶ from what the entry declares, the mic only when mic() says
   so. A drill declares what it needs and never touches this markup. */
function applyDrillCtx(){
  const d=activeDrill();
  const q=document.getElementById('drill-ctx-quit');
  if(q){ q.setAttribute('aria-label', t('drill_quit')); q.title=t('drill_quit'); }

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
  // the latency, in the mic flow: its button while the mic is on, its box when offered
  applyCalBox(drillMicOn());
  // the timed session's block counter and Next, painted by the session module
  sessionPaint();
  renderStrip();
}
/* is the running drill's scored tier switched on? */
function drillMicOn(){
  const d=activeDrill();
  if(!d || typeof d.micOn!=='function') return false;
  try{ return !!d.micOn(); }catch(_){ return false; }
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
// the track whose sessions are recorded under this drill-id namespace ("timing"), or
// that carries it on from a drill it replaced ("comp" → rhythm)
function trackBySess(ns){ return drillTracks().find(tr => tr.sess===ns || (tr.reads||[]).includes(ns)) || null; }
// the namespaces a track's history lives under: its own, then the ones it carries on
function sessFamily(ns){ const tr=drillTracks().find(x=>x.sess===ns); return tr ? [tr.sess].concat(tr.reads||[]) : [ns]; }
// a track by its own id
function trackById(id){ return drillTracks().find(tr => tr.id===id) || null; }
/* Does this track listen? The card's one 🎤, derived from the registry, so a card can't
   claim a mic its drill doesn't have. */
function trackMic(tr){ return !!(tr && tr.scored==='mic'); }
/* Session ids are "<namespace>:<variant>" ("timing:8ths"), except the ear tracks,
   which have no variant. One splitter, so every reader agrees. */
function sessNs(drillId){
  const s=String(drillId||''), i=s.indexOf(':');
  return i<0 ? s : s.slice(0,i);
}

/* A finished drill's way back to what teaches the misses: "Review on the neck" and one
   button per missed thing, each {label, open} where open() goes to that Reference view.
   Nothing missed, no row. */
function drillReviewHTML(items){
  if(!items.length) return '';
  return '<div class="drill-review"><span class="ctrl-label">'+t('sum_review')+'</span><div class="group">'+
    items.map((it,i)=>'<button type="button" class="btn dia" data-rv="'+i+'">'+it.label+' →</button>').join('')+'</div></div>';
}
function wireDrillReview(host, items){
  host.querySelectorAll('[data-rv]').forEach(b=>{ b.onclick=()=>items[+b.dataset.rv].open(); });
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
