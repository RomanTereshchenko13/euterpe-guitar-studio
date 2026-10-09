/* ===================== CONSTANTS ===================== */
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ROOTS = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const FLAT_ROOTS = {'Eb':3,'Ab':8,'Bb':10};
const FLAT_MAP = {1:'Db',3:'Eb',6:'Gb',8:'Ab',10:'Bb'};
const ENHARM = {'C#':'Db','D#':'Eb','F#':'Gb','G#':'Ab','A#':'Bb'};
/* tuning state is mutable. Strings run high → low, like the board's rows. */
let OPEN = [4,11,7,2,9,4];
let OPEN_MIDI = [64,59,55,50,45,40];
let SNAMES = ['e','B','G','D','A','E'];
const FRETS = 22;
const DOTS = [3,5,7,9,12,15,17,19,21];

/* Tunings as MIDI per string (high → low). The last entry, Custom, reads the mutable
   `customTuning` instead, so any per-string tuning works without a new preset. */
const TUNINGS = [
  {id:'standard', en:'Standard (E A D G B e)', uk:'Стандартний (E A D G B e)', midi:[64,59,55,50,45,40]},
  {id:'dropd',    en:'Drop D (D A D G B e)',   uk:'Drop D (D A D G B e)',      midi:[64,59,55,50,45,38]},
  {id:'dadgad',   en:'DADGAD',                 uk:'DADGAD',                    midi:[62,57,55,50,45,38]},
  {id:'openg',    en:'Open G (D G D G B d)',   uk:'Open G (D G D G B d)',      midi:[62,59,55,50,43,38]},
  {id:'custom',   en:'Custom',                 uk:'Власний',                   custom:true},
];
/* the live custom tuning (high → low MIDI), persisted */
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

/* capo: a movable nut at fret `capo` (0 = none). It moves your hand, not the pitches,
   so the note at every fret is unchanged; the board only dims the frets behind it. */
let capo = 0;

/* tempo (BPM) drives all playback timing + the metronome. */
let tempo = 90;
function beat(){ return 60/tempo; }

/* time signature: beats per bar + the note value that gets the pulse (a pulse of
   unit 4 = beat(), unit 8 = beat()/2). `groups` start accent groups (metronome + drum
   feel); `kick`/`snare` are drum hits in pulse indices. 4/4 reproduces the plain
   beat()*4 bar exactly. */
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
function barSec(){ return pulseSec()*curMeter().beats; }   // whole bar
function midPulseSec(){ return Math.floor(barBeats()/2)*pulseSec(); }   // the mid-bar "push" (beat 3 in 4/4)
/* pulse indices that start an accent group (0, 3 for 6/8 …) → metronome + beat accents */
function meterGroupStarts(){ const g=curMeter().groups, s=new Set(); let a=0; for(const n of g){ s.add(a); a+=n; } return s; }
function setMeter(i){ if(Number.isInteger(i) && i>=0 && i<METERS.length) meterIdx=i; }

/* Settings start closed: they are setup, not actions, and one tap away is the right
   distance. The choice is persisted. */
let toolbarOpen = false;
/* the backing band (metronome + bass/drums) has its own collapsible panel, closed */
let backingOpen = false;
/* the chord-shape voicing cards (right rail) are collapsible + persisted, default open */
let shapesOpen = true;
/* accessibility: a colour-blind-safe (Okabe–Ito) palette and per-function dot shapes,
   so note roles read without relying on hue. Body classes via applyA11y(); persisted. */
let cbPalette = false, fnShapes = false;
/* first-run welcome, shown only on a visit with no saved state */
let welcomeSeen = false;
/* the chord-reference sidebar is only shown on chord-oriented tabs */
const ASIDE_TABS = ['harmony'];

function mod(n,m){ return ((n%m)+m)%m; }
/* dev-only: surfaces errors that would otherwise be swallowed, without breaking playback */
function devWarn(){ try{ if(typeof console!=='undefined' && console.warn) console.warn.apply(console, ['[GuitarStudio]'].concat([].slice.call(arguments))); }catch(_){} }
/* Note labels stay ASCII in data ('Eb', 'C#' — saves and session ids) and get ♭/♯
   only where they reach the screen, here. */
function noteTxt(lbl){ return String(lbl).replace('#','♯').replace(/^([A-G])b/,'$1♭'); }
function noteName(pc, flat){ return noteTxt((flat && FLAT_MAP[pc]) ? FLAT_MAP[pc] : NOTES[pc]); }
function useFlatFor(label){ return /^[A-G][b♭]/.test(label) || label === 'F'; }

/* spelling by scale degree: the right letter + accidental (Cm → Eb, not D#), ♯4 vs ♭5,
   and a plain enharmonic name instead of a double accidental */
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

/* The seven stacked-thirds triads of a 7-note scale `sc` rooted at `rootPc`, as
   { rootPc, deg, suf, iv }: suffix ('', m, dim, aug, or '?' for a non-tertian triad)
   and intervals — quality only; spelling is the caller's (Scales by degree, the circle
   by key signature). The one diatonic source for both views. */
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

