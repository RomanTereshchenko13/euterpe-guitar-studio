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

/* Alternate tunings, defined by MIDI note per string (high -> low). */
const TUNINGS = [
  {id:'standard', en:'Standard (E A D G B e)', uk:'Стандартний (E A D G B e)', midi:[64,59,55,50,45,40]},
  {id:'dropd',    en:'Drop D (D A D G B e)',   uk:'Drop D (D A D G B e)',      midi:[64,59,55,50,45,38]},
  {id:'dadgad',   en:'DADGAD',                 uk:'DADGAD',                    midi:[62,57,55,50,45,38]},
  {id:'openg',    en:'Open G (D G D G B d)',   uk:'Open G (D G D G B d)',      midi:[62,59,55,50,43,38]},
];
let tuningIdx = 0, lefty = false;
function applyTuning(){
  const m = TUNINGS[tuningIdx].midi;
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

/* tempo (BPM) drives all playback timing + the metronome. */
let tempo = 90;
function beat(){ return 60/tempo; }

/* collapsible toolbar; default open on wide screens, collapsed on phones */
let toolbarOpen = (typeof window!=='undefined' && window.innerWidth>700);
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

