/* ===================== REFERENCE PANELS: progression drawer, chord cards, scales, circle, notes ===================== */
/* the progression, in the ▶ drawer: what ▶ plays when the drawer says "the progression" */
buildSeqPresets();
document.getElementById('seq-add').onclick=seqAddCurrent;
document.getElementById('seq-clear').onclick=seqClear;
document.getElementById('seq-loopbtn').onclick=seqLoopToggle;
document.getElementById('seq-presets').addEventListener('click',e=>{ const b=e.target.closest('[data-p]'); if(b) applyPreset(SEQ_PRESETS[+b.dataset.p]); });
document.getElementById('seq-strip').addEventListener('click',e=>{
  const x=e.target.closest('[data-x]'); if(x){ seq.splice(+x.dataset.x,1); seqStepIdx=-1; if(!seq.length) seqStop(); renderSeq(); if(seqClock) seqRebuild(); saveState(); return; }
  const bb=e.target.closest('[data-bars]'); if(bb){ const i=+bb.dataset.bars, cur=seq[i].bars; seq[i].bars = cur>=4?1:(cur===1?2:4); renderSeq(); if(seqClock) seqRebuild(); saveState(); return; }
  const chip=e.target.closest('.seq-chip'); if(chip){ const st=seq[+chip.dataset.i]; if(st){ chVoicing=0; setChord(st.pc, st.lbl, st.qi); saveState(); } }
});
renderSeq(); setSeqTransport();
// the shared board: a dot click sounds that string, Enter/Space plays the focused one
wirePlay(document.getElementById('board'));
/* the suggester's scale chips jump to that scale, on the chord's root, in Scales: the
   key moves to the chord, so the chord stays what it was */
document.getElementById('suggest-body').addEventListener('click', e=>{
  const b=e.target.closest('[data-scale]'); if(!b) return;
  const ch=currentHarmonyChord(); if(!ch) return;
  setKey(ch.rootPc, ch.rootLbl, +b.dataset.scale);
  setScView('scale'); selectTab('scales');
});
/* chord cards: a dot click sounds that string; clicking elsewhere on a card selects
   that voicing (so ▶ plays it), strums it, and rings it on the neck — repainted
   without the change-stagger, since only the rings moved. Keyboard note-play stays on
   the fretboard. */
document.getElementById('ch-diagram').addEventListener('click',e=>{
  const dot=e.target.closest('.cd-dot');
  if(dot && dot.dataset.midi!=null){ e.stopPropagation(); pluck(parseInt(dot.dataset.midi)); return; }
  const card=e.target.closest('.chordbox'); if(!card || card.dataset.v==null) return;
  chVoicing=+card.dataset.v;
  _boardStagger=false; renderChords(); _boardStagger=true;
  currentChordVoicing().midis.forEach((m,i)=>pluck(m, i*0.03));
  const sel=document.querySelector('#ch-diagram .chordbox.sel'); if(sel) sel.focus({preventScroll:true});   // the click rebuilt the cards
  saveState();
});

document.getElementById('cd-more').addEventListener('click',()=>{
  chShapesExpanded=!chShapesExpanded; renderChordDiagram();
});

/* triad cards: a dot click sounds that string (set/inversion buttons select) */
document.getElementById('tr-diagram').addEventListener('click',e=>{
  const dot=e.target.closest('.cd-dot');
  if(dot && dot.dataset.midi!=null){ pluck(parseInt(dot.dataset.midi)); }
});

/* the strip's chord over the scale; the chord itself is picked in the chord sheet */
document.getElementById('sc-chord').onclick=()=>{ scShowChord=!scShowChord; renderScales(); };

/* a circle node (the key sheet) picks the key: major → Ionian, minor → Aeolian */
function selectCircleNode(g){
  const i=+g.dataset.i, minor=(g.dataset.type==='min'), pc=minor?COF[i].minPc:COF[i].majPc;
  setKey(pc, pcToRootLabel(pc), minor?5:0);
}
document.getElementById('cof-svg').addEventListener('click',e=>{
  const g=e.target.closest('.cof-node'); if(g) selectCircleNode(g);
});
document.getElementById('cof-svg').addEventListener('keydown',e=>{
  if(e.key!=='Enter'&&e.key!==' ') return;
  const g=e.target.closest('.cof-node'); if(g){ selectCircleNode(g); e.preventDefault(); }
});
/* the chord sheet: a degree of the key becomes the chord; the key stays */
document.getElementById('h-degrees').addEventListener('click', e=>{
  const b=e.target.closest('[data-deg]'); if(!b) return;
  const d=keyDegrees()[+b.dataset.deg]; if(!d) return;
  chVoicing=0; chShapesExpanded=false; setChord(d.rootPc, d.lbl, d.qi); saveState();
});

/* Notes: one "Naturals only" toggle; the highlighted note follows the shared root. */
function applyNtFilter(){ const b=document.getElementById('nt-nat'); if(b){ const on=ntFilter==='nat'; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on?'true':'false'); } }
document.getElementById('nt-nat').onclick=function(){ ntFilter = ntFilter==='nat'?'all':'nat'; applyNtFilter(); renderNotes(); saveState(); };
applyNtFilter();

document.getElementById('aside-toggle').onclick=function(){ const b=document.getElementById('aside-body'); const hidden=b.style.display==='none'; b.style.display=hidden?'block':'none'; this.textContent=hidden?'−':'+'; this.setAttribute('aria-expanded', hidden); };
const _shapesTg=document.getElementById('shapes-toggle');
if(_shapesTg) _shapesTg.onclick=function(){ shapesOpen=!shapesOpen; applyShapesPanel(); saveState(); };
