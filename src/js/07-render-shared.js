/* ===================== SHARED ===================== */
/* JS-driven motion checks reduced-motion itself (the CSS reset only covers CSS
   animation). False where matchMedia is missing (jsdom), so motion is skipped there. */
function motionOK(){
  if(typeof window==='undefined' || typeof window.matchMedia!=='function') return false;
  try{ return !window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return true; }
}
/* Whether the next board paint should play the change-stagger. Default on;
   playback-driven repaints (the progression following its chords) turn it off so
   the neck doesn't re-fade on every bar. */
let _boardStagger=true;
function renderNums(el){
  const lo=FRET_LO(), hi=FRET_HI(), showOpen=lo<=1;
  let html='';
  for(let f=lo; f<=hi; f++){ html+=`<div class="fretnum ${DOTS.includes(f)?'mark':''}">${f}</div>`; }
  el.innerHTML=html;
  el.style.marginLeft = (showOpen?67:30)+'px';
  el.style.paddingLeft = (showOpen?7:0)+'px';
  el.style.minWidth = boardWidth()+'px';
  el.classList.toggle('lefty', lefty);
}
/* Fret-cell width comes from the width actually available, with a readable floor: a
   ≤5-fret window fits with no horizontal scroll, and only "All frets" falls below the
   floor and scrolls. .board and .fretnums share boardWidth(), so dots and numbers
   stay aligned. */
const CELL_MIN = 34, CELL_MAX = 200;
/* Measured from the board's own .scroll container (the board's column differs from
   the controls' between layouts); .main, then the viewport, for jsdom. */
function availW(){
  if(typeof document==='undefined') return 976;
  const el=document.querySelector('.board-region .scroll') || document.querySelector('.main');
  const w = el && el.clientWidth ? el.clientWidth : ((typeof window!=='undefined'?window.innerWidth:1024) - 48);
  return Math.max(280, w);
}
function leftFixed(){ return FRET_LO()<=1 ? 67 : 30; }
function cellW(){
  const n = FRET_HI() - FRET_LO() + 1;
  const fit = Math.floor((availW() - leftFixed()) / Math.max(1,n));
  return Math.max(CELL_MIN, Math.min(CELL_MAX, fit));
}
function boardWidth(){ return leftFixed() + (FRET_HI()-FRET_LO()+1)*cellW(); }
function renderBoard(boardEl, cellFn){
  clearPlayHighlights();
  boardEl.innerHTML='';
  const lo=FRET_LO(), hi=FRET_HI(), showOpen=lo<=1, stag=_boardStagger;
  const delay=col=>Math.min(col*12,150)+'ms';        // left-to-right change-stagger
  SNAMES.forEach((sn,si)=>{
    const row=document.createElement('div'); row.className='srow';
    const lab=document.createElement('div'); lab.className='slabel'; lab.textContent=sn; row.appendChild(lab);
    if(showOpen){
      const open=document.createElement('div'); open.className='ocell'+(capo>0?' subcapo':'');
      const odot=cellFn(OPEN[si]%12, si, 0);
      if(odot){ if(stag) odot.style.animationDelay=delay(0); open.appendChild(odot); }
      row.appendChild(open);
      const nut=document.createElement('div'); nut.className='nut'; row.appendChild(nut);
    }
    for(let f=lo; f<=hi; f++){
      const pc=(OPEN[si]+f)%12;
      const cell=document.createElement('div'); cell.className='cell';
      // capo: dim the frets behind it and mark its fret as the new nut — pitches don't move,
      // so the lit tones stay put
      if(capo>0){ if(f<capo) cell.classList.add('subcapo'); else if(f===capo) cell.classList.add('capo-at'); }
      // inlays: a single dot between the centre strings, a double one at 12/24
      if(INLAY_DOUBLE.has(f)){ if(si===2||si===4) cell.classList.add('inlay'); }
      else if(INLAY_SINGLE.has(f)){ if(si===3) cell.classList.add('inlay'); }
      const dot=cellFn(pc,si,f);
      if(dot){ if(stag) dot.style.animationDelay=delay(showOpen?f-lo+1:f-lo); cell.appendChild(dot); }
      row.appendChild(cell);
    }
    boardEl.appendChild(row);
  });
  const panel=boardEl.closest('.board'); if(panel){ panel.style.minWidth=boardWidth()+'px'; panel.classList.toggle('lefty', lefty); panel.classList.toggle('anim', stag); }
  // hint that the neck scrolls (only the wide "All frets" view overflows)
  const sc=boardEl.closest('.scroll'); if(sc){ sc.classList.toggle('scrollable', sc.scrollWidth > sc.clientWidth + 1); }
}
const INLAY_SINGLE = new Set(DOTS.filter(f=>f!==12&&f!==24));
const INLAY_DOUBLE = new Set([12,24]);
/* swipe affordance (phone): a control row that overflows its track fades its right
   edge so the clipped buttons read as "more — swipe →". A no-op where groups wrap.
   Re-run after a context change rebuilds the groups. */
function markScrollables(){
  if(typeof document==='undefined') return;
  document.querySelectorAll('.row > .group, #ch-quals .group, #arp-quals .group').forEach(g=>{
    g.classList.toggle('scrollable', g.scrollWidth > g.clientWidth + 1);
  });
}
/* Heuristic fingering for a fretted shape (`frets` by display column; null = muted,
   0 = open). An index barre when the lowest fret is played on 2+ strings with a higher
   fret above it; otherwise fingers ascend by fret, then string. Returns {col: 1..4}. */
function chordFingers(frets){
  const fretted=frets.map((fr,i)=>({i,fr})).filter(o=>o.fr!=null&&o.fr>0)
                     .sort((a,b)=> a.fr-b.fr || a.i-b.i);
  const map={};
  if(!fretted.length) return map;
  const minF=fretted[0].fr;
  const atMin=fretted.filter(o=>o.fr===minF);
  const higher=fretted.filter(o=>o.fr>minF);
  let next=1;
  if(atMin.length>=2 && higher.length>=1){          // index bars the lowest fret
    atMin.forEach(o=>{ map[o.i]=1; }); next=2;
    higher.forEach(o=>{ map[o.i]=Math.min(next++,4); });
  } else {
    fretted.forEach(o=>{ map[o.i]=Math.min(next++,4); });
  }
  return map;
}
/* Chord/triad diagram scaffold: the SVG frame, fret and string lines, the nut (when
   the box starts at fret 1) and the "Nfr" label for `cols` strings. Returns the markup
   plus coordinate helpers so each caller draws its own dots. `dims.span` fixes the row
   count (chord boxes: 4); omit it to fit the shape (triad cards). */
function fretGrid(frets, cols, dims){
  const played=frets.filter(x=>x!=null && x>0);
  const minF=played.length?Math.min(...played):0;
  const maxF=played.length?Math.max(...played):0;
  const baseFret=(maxF<=4?1:minF);
  const rows=dims.span!=null ? dims.span : Math.max(3, maxF-baseFret+1);
  const {W,H,padX,padTop,padBot,posDX}=dims;
  const gw=(W-padX*2)/(cols-1), gh=(H-padTop-padBot)/rows;
  const x=i=>padX+i*gw, y=r=>padTop+r*gh;
  let svg=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  for(let r=0;r<=rows;r++){ const isNut=(baseFret===1 && r===0); svg+=`<line class="${isNut?'cd-nut':'cd-fret'}" x1="${x(0)}" y1="${y(r)}" x2="${x(cols-1)}" y2="${y(r)}"/>`; }
  for(let i=0;i<cols;i++){ svg+=`<line class="cd-string" x1="${x(i)}" y1="${y(0)}" x2="${x(i)}" y2="${y(rows)}"/>`; }
  if(baseFret>1){ svg+=`<text class="cd-pos" x="${x(0)-posDX}" y="${y(0)+gh*0.7}" text-anchor="end">${baseFret}fr</text>`; }
  return {svg, x, y, gh, baseFret, rows, padTop};
}
function makeDot(cls,text,midi){
  const d=document.createElement('div'); d.className='dot '+cls; d.textContent=text;
  if(midi!=null){ d.dataset.midi=midi; d.tabIndex=0; d.setAttribute('role','button'); }
  else { d.setAttribute('role','img'); }
  d.setAttribute('aria-label',text);
  return d;
}
/* pluck ripple: a one-shot halo from a tapped dot, skipped under reduced motion */
function rippleDot(d){
  if(!d || !motionOK()) return;
  const r=document.createElement('span'); r.className='ripple';
  d.appendChild(r);
  setTimeout(()=>{ if(r.parentNode) r.parentNode.removeChild(r); }, 640);
}
function wirePlay(boardEl){
  const trigger=d=>{ if(d==null||d.dataset.midi==null) return; pluck(parseInt(d.dataset.midi)); d.classList.add('playing'); rippleDot(d); setTimeout(()=>d.classList.remove('playing'), 420); };
  boardEl.addEventListener('click',e=>{ trigger(e.target.closest('.dot')); });
  boardEl.addEventListener('keydown',e=>{ if(e.key!=='Enter'&&e.key!==' ') return; const d=e.target.closest('.dot'); if(d&&d.dataset.midi!=null){ e.preventDefault(); trigger(d); } });
}
/* ---- one shared board ----
   Every board view paints into #board. isBoardMode() says whether a render function
   owns it right now (so cross-view passes paint once); paintBoard() draws the board,
   numbers, legend and hint. */
function isBoardMode(mode){
  if(mode==='chords')   return currentTab==='harmony' && hView==='chords' && !triadsOn();
  if(mode==='triads')   return currentTab==='harmony' && hView==='chords' && triadsOn();
  if(mode==='arp')      return currentTab==='harmony' && hView==='arp';
  if(mode==='scale')    return currentTab==='scales'  && scView==='scale';
  if(mode==='notes')    return currentTab==='scales'  && scView==='notes';
  return false;
}
function paintBoard(cellFn, legendHTML, hintHTML){
  renderBoard(document.getElementById('board'), cellFn);
  renderNums(document.getElementById('nums'));
  document.getElementById('legend').innerHTML = legendHTML || '';
  document.getElementById('hint').innerHTML = hintHTML || '';
}
/* A legend chip: swatch + name + an optional degree ("3 / ♭3") in its own span, which
   phones drop so the legend fits one line. */
function legChip(varName, key, deg){ return `<div class="leg"><span class="leg-dot" style="background:var(${varName})"></span><span class="leg-nm">${t(key)}</span>${deg?`<span class="leg-deg">${deg}</span>`:''}</div>`; }
function chordLegendHTML(){ return legChip('--root','leg_root','1')+legChip('--third','leg_third','3 / ♭3')+legChip('--fifth','leg_fifth','5')+legChip('--seventh','leg_seventh','7 / ♭7')+legChip('--ext','leg_ext','6 · 9 · 11 · 13'); }
function triadLegendHTML(){ return legChip('--root','leg_root','1')+legChip('--third','leg_third','3 / ♭3')+legChip('--fifth','leg_fifth','5'); }
function notesLegendHTML(){ return legChip('--natural','leg_nat')+legChip('--sharp','leg_sharpflat')+legChip('--root','leg_highlight'); }
function scaleLegendHTML(){
  if(scOverlay) return legChip('--root','leg_root','1')+legChip('--third','leg_third','3 / ♭3')+legChip('--fifth','leg_fifth','5')+legChip('--seventh','leg_seventh','7 / ♭7')+
    `<div class="leg"><span class="leg-dot" style="background:rgba(220,200,160,0.4)"></span><span class="leg-nm">${t('leg_sc_other')}</span></div>`;
  const ivs=SCALES[scIdx].iv;
  const present=new Set(ivs.map(iv=>scClass(iv, ivs)));
  let out=legChip('--root','leg_root','1')+legChip('--third','leg_third','3 / ♭3');
  if(present.has('d-fifth')) out+=legChip('--fifth','leg_fifth','5');
  if(present.has('d-sev')) out+=legChip('--seventh','leg_seventh','7 / ♭7');
  if(present.has('d-other')) out+=`<div class="leg"><span class="leg-dot" style="background:var(--sc-other)"></span><span class="leg-nm">${t('leg_sc_other')}</span></div>`;
  return out;
}
function buildRootBtns(container, current, onPick){
  container.innerHTML='';
  ROOTS.forEach(r=>{
    const pc = FLAT_ROOTS[r]!==undefined ? FLAT_ROOTS[r] : NOTES.indexOf(r);
    const b=document.createElement('button'); b.className='btn'+(pc===current?' active':''); b.textContent=noteTxt(r); b.dataset.pc=pc; b.setAttribute('aria-pressed', pc===current);
    b.onclick=()=>{ [...container.children].forEach(x=>{x.classList.remove('active');x.setAttribute('aria-pressed','false');}); b.classList.add('active'); b.setAttribute('aria-pressed','true'); onPick(pc,r); };
    container.appendChild(b);
  });
}
/* Segmented buttons: one .btn per item, the active one marked (class + aria-pressed),
   each wired to onPick(i). title/aria are set only when given. */
function segButtons(containerId, items, activeIdx, onPick){
  const c=document.getElementById(containerId); if(!c) return; c.innerHTML='';
  items.forEach((it,i)=>{
    const b=document.createElement('button');
    b.className='btn'+(i===activeIdx?' active':'');
    b.textContent=it.label;
    if(it.title!=null) b.title=it.title;
    if(it.aria!=null) b.setAttribute('aria-label', it.aria);
    b.setAttribute('aria-pressed', i===activeIdx);
    b.onclick=()=>onPick(i);
    c.appendChild(b);
  });
}

