/* ===================== SETTINGS: language, the Settings sheet, tempo, the band ===================== */
document.getElementById('lang-switch').addEventListener('click',e=>{
  const b=e.target.closest('.langbtn'); if(!b||b.dataset.lang===lang) return;
  lang=b.dataset.lang; applyLang(); saveState();
});

/* ---- toolbar wiring ---- */
document.getElementById('tb-tuning').onchange=function(){
  const prevMidi=OPEN_MIDI.slice();
  tuningIdx=+this.value;
  if(TUNINGS[tuningIdx].custom) customTuning=prevMidi;   // seed Custom from the tuning you were on
  applyTuning(); buildTuner(); buildCustomTuning(); applyCustomTuningVis(); renderAllBoards(); saveState();
};
/* custom tuning: one select per string; re-apply so board, tuner and labels follow */
{ const cs=document.getElementById('tb-custom-strings');
  if(cs) cs.addEventListener('change', e=>{ const s=e.target.closest('.custom-str'); if(!s) return;
    customTuning[+s.dataset.i]=+s.value; applyTuning(); buildTuner(); renderAllBoards(); saveState(); }); }
/* master volume scales everything (masterOut, before the limiter). Before the first
   sound the bus doesn't exist, so masterVol is stashed for setupBus; a live change
   ramps, so dragging is click-free. */
{ const v=document.getElementById('tb-vol');
  if(v){ v.oninput=function(){ masterVol=(+this.value)/100;
      const vv=document.getElementById('tb-vol-val'); if(vv) vv.textContent=(+this.value)+'%';
      if(masterOut && actx) masterOut.gain.setTargetAtTime(masterVol, actx.currentTime, 0.01);
    };
    v.onchange=function(){ saveState(); }; } }
document.getElementById('tb-frets').onchange=function(){ fretRangeIdx=+this.value; renderAllBoards(); saveState(); };
{ const cp=document.getElementById('tb-capo'); if(cp) cp.onchange=function(){ capo=+this.value; renderAllBoards(); saveState(); }; }
/* a meter change alters bar length and beat grid, so re-paint the running drill */
{ const mt=document.getElementById('tb-meter'); if(mt) mt.onchange=function(){ setMeter(+this.value); paintTempoChip(); refreshDrillsLang(); saveState(); }; }
/* accessibility: a colour-blind-safe palette and per-function dot shapes, both pure
   body-class switches, both persisted */
function applyA11y(){
  if(typeof document==='undefined' || !document.body) return;
  document.body.classList.toggle('cb-palette', cbPalette);
  document.body.classList.toggle('fn-shapes', fnShapes);
  const p=document.getElementById('tb-cbpalette'); if(p){ p.classList.toggle('active', cbPalette); p.setAttribute('aria-pressed', cbPalette?'true':'false'); }
  const s=document.getElementById('tb-shapes');    if(s){ s.classList.toggle('active', fnShapes);  s.setAttribute('aria-pressed', fnShapes?'true':'false'); }
}
{ const p=document.getElementById('tb-cbpalette'); if(p) p.onclick=function(){ cbPalette=!cbPalette; applyA11y(); saveState(); };
  const s=document.getElementById('tb-shapes');    if(s) s.onclick=function(){ fnShapes=!fnShapes;  applyA11y(); saveState(); }; }

document.getElementById('tb-lefty').onclick=function(){ lefty=!lefty; this.classList.toggle('active',lefty); this.setAttribute('aria-pressed',lefty); renderAllBoards(); saveState(); };
/* the tempo sheet: the clocks read beat() live, so the tempo glides without restarting;
   the slider and the ±5 steppers share the one setter */
document.getElementById('tb-tempo').oninput=function(){ setTempo(+this.value); };
document.getElementById('tb-tempo').onchange=function(){ saveState(); };
{ const step=d=>{ setTempo(tempo+d); saveState(); };
  const sl=document.getElementById('tb-slower'); if(sl) sl.onclick=()=>step(-5);
  const fa=document.getElementById('tb-faster'); if(fa) fa.onclick=()=>step(5); }
document.getElementById('tb-metro').onclick=metroToggle;
document.getElementById('tb-bass').onclick=bassToggle;
document.getElementById('tb-drums').onclick=drumsToggle;
/* the chord sheet's "more" */
{ const a=document.getElementById('ch-quals-toggle'); if(a) a.onclick=()=>{ chQualsAdv=!chQualsAdv; buildChQuals(); markScrollables(); }; }
