/* ===================== CONSTANTS ===================== */
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ROOTS = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const FLAT_ROOTS = {'Eb':3,'Ab':8,'Bb':10};
const FLAT_MAP = {1:'Db',3:'Eb',6:'Gb',8:'Ab',10:'Bb'};
const ENHARM = {'C#':'Db','D#':'Eb','F#':'Gb','G#':'Ab','A#':'Bb'};
/* tuning state is mutable (changed by the tuning selector). Strings ordered
   high -> low to match the on-screen board (top row = high string). */
let OPEN = [4,11,7,2,9,4];
let OPEN_MIDI = [64,59,55,50,45,40];
let SNAMES = ['e','B','G','D','A','E'];
const FRETS = 22;
const DOTS = [3,5,7,9,12,15,17,19,21];

/* Alternate tunings, defined by MIDI note per string (high -> low). The last
   entry is the user-editable Custom tuning (Phase 2): it carries no fixed `midi`,
   reading the mutable `customTuning` below instead, so any per-string tuning works
   without a new preset. The board/highlight math is already tuning-driven, so a
   custom MIDI per string just flows through applyTuning like any preset. */
const TUNINGS = [
  {id:'standard', en:'Standard (E A D G B e)', uk:'Стандартний (E A D G B e)', midi:[64,59,55,50,45,40]},
  {id:'dropd',    en:'Drop D (D A D G B e)',   uk:'Drop D (D A D G B e)',      midi:[64,59,55,50,45,38]},
  {id:'dadgad',   en:'DADGAD',                 uk:'DADGAD',                    midi:[62,57,55,50,45,38]},
  {id:'openg',    en:'Open G (D G D G B d)',   uk:'Open G (D G D G B d)',      midi:[62,59,55,50,43,38]},
  {id:'custom',   en:'Custom',                 uk:'Власний',                   custom:true},
];
/* the live custom tuning (high -> low MIDI), used when the Custom entry is selected.
   Seeded from / clamped against the standard tuning; persisted via saveState. */
let customTuning = [64,59,55,50,45,40];
const TUNE_LO = 34, TUNE_HI = 69;   // editor range: Bb1 … A4 (covers every common guitar tuning)
let tuningIdx = 0, lefty = false;
function tuningMidi(){ return TUNINGS[tuningIdx].custom ? customTuning : TUNINGS[tuningIdx].midi; }
function applyTuning(){
  const m = tuningMidi();
  OPEN_MIDI = m.slice();
  OPEN = m.map(x=>mod(x,12));
  SNAMES = m.map(x=>{ const n=NOTES[mod(x,12)]; return n.replace('#','♯'); });
}

/* fret window (mobile zoom). lo<=1 means open strings + nut are shown. */
const FRET_RANGES = [
  {lo:1, hi:22, key:'frets_all'},
  {lo:1, hi:5,  label:'1–5'},
  {lo:5, hi:9,  label:'5–9'},
  {lo:9, hi:12, label:'9–12'},
];
let fretRangeIdx = 0;
function FRET_LO(){ return FRET_RANGES[fretRangeIdx].lo; }
function FRET_HI(){ return FRET_RANGES[fretRangeIdx].hi; }

/* capo (Phase 2): a movable nut at fret `capo` (0 = none). A capo doesn't move
   pitches — it moves your hand — so the note at every physical fret is unchanged
   and the highlighting math stays untouched. The board only dims the frets behind
   the capo and draws the capo bar, so a shape reads as "playable from here up". */
let capo = 0;

/* tempo (BPM) drives all playback timing + the metronome. */
let tempo = 90;
function beat(){ return 60/tempo; }

/* time signature / meter (Phase 7b): beats per bar + the note value that gets the
   pulse. 4/4 is the default and reproduces the old hard-wired bar math EXACTLY (the
   backing band, sequencer and metronome were all `beat()*4` / `count%4`). A pulse is
   a note of value `unit`, so a quarter (unit 4) = beat(), an eighth (unit 8) = beat()/2.
   `groups` splits the bar into accent groups — a strong bar-start + a medium group-
   start — driving the metronome accent + the drum feel; `kick`/`snare` are drum hits
   in PULSE indices so each meter grooves sensibly (4/4 keeps kick 1&3 / snare 2&4). */
const METERS = [
  { id:'2/4',  beats:2,  unit:4, groups:[2],       kick:[0],   snare:[1] },
  { id:'3/4',  beats:3,  unit:4, groups:[3],       kick:[0],   snare:[1,2] },
  { id:'4/4',  beats:4,  unit:4, groups:[4],       kick:[0,2], snare:[1,3] },
  { id:'6/8',  beats:6,  unit:8, groups:[3,3],     kick:[0,3], snare:[3] },
  { id:'12/8', beats:12, unit:8, groups:[3,3,3,3], kick:[0,6], snare:[3,9] },
];
let meterIdx = 2;                                          // default 4/4
function curMeter(){ return METERS[meterIdx]; }
function barBeats(){ return curMeter().beats; }            // pulses per bar
function pulseSec(){ return beat()*(4/curMeter().unit); }  // one pulse (unit-note) duration
function barSec(){ return pulseSec()*curMeter().beats; }   // whole bar (== beat()*4 for 4/4)
function midPulseSec(){ return Math.floor(barBeats()/2)*pulseSec(); }   // the mid-bar "push" (beat 3 in 4/4)
/* pulse indices that start an accent group (0, 3 for 6/8 …) → metronome + beat accents */
function meterGroupStarts(){ const g=curMeter().groups, s=new Set(); let a=0; for(const n of g){ s.add(a); a+=n; } return s; }
function setMeter(i){ if(Number.isInteger(i) && i>=0 && i<METERS.length) meterIdx=i; }

/* collapsible toolbar, default closed everywhere. It used to open itself on any
   viewport over 700x500, which put eleven setup controls (tuning, frets, capo,
   meter, a11y, share…) between a first-time desktop visitor and the neck — exactly
   the console the transport bar's disclosure toggles exist to avoid. They're setup,
   not actions: one tap away is the right distance. The choice is persisted, so
   anyone who wants it open keeps it open. */
let toolbarOpen = false;
/* the backing band (metronome + bass/drums) lives in its own collapsible panel,
   default closed — secondary jam-along tools, kept out of the lean transport bar */
let backingOpen = false;
/* the chord-shape voicing cards (right rail) are collapsible + persisted, default open */
let shapesOpen = true;
/* accessibility prefs (Phase 9 feel pass): a colour-blind-safe (Okabe–Ito) palette
   and distinct per-function dot shapes, so note roles (root/3rd/5th/7th/ext) read
   without relying on hue. Off by default; applied as body classes by applyA11y()
   and persisted via saveState()/loadState(). */
let cbPalette = false, fnShapes = false;
/* first-run onboarding: a one-time welcome card shown only to brand-new visitors
   (no saved state); dismissing it sets welcomeSeen so it never returns. */
let welcomeSeen = false;
/* the chord-reference sidebar is only shown on chord-oriented tabs */
const ASIDE_TABS = ['harmony'];

function mod(n,m){ return ((n%m)+m)%m; }
/* dev-only diagnostic: surfaces errors that were previously swallowed silently,
   without breaking playback for the user. No effect on the shipped behaviour. */
function devWarn(){ try{ if(typeof console!=='undefined' && console.warn) console.warn.apply(console, ['[GuitarStudio]'].concat([].slice.call(arguments))); }catch(_){} }
function noteName(pc, flat){ return (flat && FLAT_MAP[pc]) ? FLAT_MAP[pc] : NOTES[pc]; }
function useFlatFor(label){ return FLAT_ROOTS[label] !== undefined || label === 'F'; }

/* note spelling by scale degree: gives correct letter+accidental (Cm -> Eb, not D#),
   distinguishes ♯4 vs ♭5, and falls back to a simple enharmonic name to avoid double accidentals */
const LET = ['C','D','E','F','G','A','B'];
const LET_PC = [0,2,4,5,7,9,11];
const ACC = {'-1':'♭','0':'','1':'♯'};
const DEG_OF = {0:1,3:3,4:3,6:5,7:5,8:5,10:7,11:7}; // chord interval -> diatonic degree
function rootParts(lbl){
  const li = LET.indexOf(lbl[0]); let acc=0;
  for(let i=1;i<lbl.length;i++){ const c=lbl[i]; if(c==='#'||c==='♯')acc++; else if(c==='b'||c==='♭')acc--; }
  return {li, acc};
}
function simpleName(pc, rootLbl){ return noteName(pc, useFlatFor(rootLbl)); }
function spellNote(rootLbl, pc, degree){
  if(!degree) return simpleName(pc, rootLbl);
  const {li}=rootParts(rootLbl);
  const idx=mod(li+(degree-1),7);
  let acc=mod(pc-LET_PC[idx],12); if(acc>6) acc-=12;
  if(acc<-1||acc>1) return simpleName(pc, rootLbl); // avoid double sharps/flats
  return LET[idx]+ACC[acc];
}

/* One diatonic source (spine, 1a). The seven stacked-thirds triads of a 7-note
   scale `sc` (semitone offsets) rooted at pitch-class `rootPc`, as a list of
   { rootPc, deg, suf, iv }: the chord-quality suffix ('', m, dim, aug, or '?'
   for a non-tertian triad) and its interval set — QUALITY only. Spelling stays
   the caller's job (the scales view spells by degree, the circle by key
   signature). Collapses the formerly duplicated logic in diatonic() and
   buildDia(), which disagreed on the aug / '?' fallback. */
function diatonicTriads(rootPc, sc){
  const res=[];
  for(let d=0; d<7; d++){
    const r=sc[d], th=sc[(d+2)%7], fi=sc[(d+4)%7];
    const t3=mod(th-r,12), t5=mod(fi-r,12);
    let suf, iv;
    if(t3===4&&t5===7){ suf='';    iv=[0,4,7]; }
    else if(t3===3&&t5===7){ suf='m';   iv=[0,3,7]; }
    else if(t3===3&&t5===6){ suf='dim'; iv=[0,3,6]; }
    else if(t3===4&&t5===8){ suf='aug'; iv=[0,4,8]; }
    else { suf='?'; iv=[0,t3,t5]; }
    res.push({ rootPc:mod(rootPc+r,12), deg:d, suf, iv });
  }
  return res;
}

