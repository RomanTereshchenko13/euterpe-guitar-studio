/* ===================== SCALES ===================== */
const SDEG=['1','♭2','2','♭3','3','4','♭5','5','♭6','6','♭7','7'];
const SCALES=[
  {iv:[0,2,4,5,7,9,11],en:'Major (Ionian)',uk:'Мажор (іонійський)'},
  {iv:[0,2,3,5,7,9,10],en:'Dorian',uk:'Дорійський'},
  {iv:[0,1,3,5,7,8,10],en:'Phrygian',uk:'Фригійський'},
  {iv:[0,2,4,6,7,9,11],en:'Lydian',uk:'Лідійський'},
  {iv:[0,2,4,5,7,9,10],en:'Mixolydian',uk:'Міксолідійський'},
  {iv:[0,2,3,5,7,8,10],en:'Aeolian (natural minor)',uk:'Еолійський (нат. мінор)'},
  {iv:[0,1,3,5,6,8,10],en:'Locrian',uk:'Локрійський'},
  {iv:[0,3,5,7,10],en:'Minor pentatonic',uk:'Мінорна пентатоніка'},
  {iv:[0,2,4,7,9],en:'Major pentatonic',uk:'Мажорна пентатоніка'},
  {iv:[0,3,5,6,7,10],en:'Blues (minor)',uk:'Блюзова (мінорна)'},
  {iv:[0,2,3,5,7,8,11],en:'Harmonic minor',uk:'Гармонічний мінор'},
  {iv:[0,2,3,5,7,9,11],en:'Melodic minor',uk:'Мелодичний мінор'},
];
function sName(s){ return lang==='en'?s.en:s.uk; }
/* mode family for the circle projection (1a): a major third (interval 4) puts a
   scale on the circle's major ring, a minor third (3) on the minor ring. */
function isMajorFamily(i){ return SCALES[i].iv.includes(4); }
/* scale-over-chord (1c): scale indices (rooted at rootPc) that contain every
   chord tone — i.e. scales you can play over that chord. */
function scalesOverChord(rootPc, chordPcs){
  const need=chordPcs.map(pc=>mod(pc,12));
  const out=[];
  SCALES.forEach((s,i)=>{
    const sp=new Set(s.iv.map(iv=>mod(rootPc+iv,12)));
    if(need.every(pc=>sp.has(pc))) out.push(i);
  });
  return out;
}
/* reverse seam (Scales/Circle → Harmony, 1c follow-up): map a diatonic triad's
   interval set to the Harmony chord-quality index, so an overlaid scale chord (or
   the circle's tonic) can open in the chord-tones view. Mirrors TRI_TO_QUAL
   (maj/m/dim/aug → QUALITIES); non-tertian triads ('?') fall back to major. */
function triadQi(iv){
  const t3=iv[1], t5=iv[2];
  const tri = (t3===3&&t5===6) ? 2 : (t3===4&&t5===8) ? 3 : (t3===3) ? 1 : 0;
  return TRI_TO_QUAL[tri];
}
const MODE_OFF={1:2,2:4,3:5,4:7,5:9,6:11};
const BOX_OFFSETS=[0,3,5,7,10];
/* CAGED (Phase 2): the app's five scale positions cycle through the five movable
   chord shapes. With positions anchored at (root−4)+BOX_OFFSETS, position 1..5
   land on the E·D·C·A·G shapes going up the neck. This mapping is exact only for
   the MAJOR scale (Ionian), where the scale root IS the parent-major root; for
   modes the boxes anchor to the mode root, not the parent, so the letters would
   be wrong — so CAGED labels are shown for Ionian only (isCAGEDScale). */
const CAGED_BY_POS=['E','D','C','A','G'];
function isCAGEDScale(){ return scIdx===0; }
function cagedShapeName(letter){ return lang==='en' ? letter+'-shape' : 'форма '+letter; }
let scIdx=5, scPos=0, scOverlay=null;
let scView='scale';   // Scales-tab sub-view: 'scale' | 'notes' (folded-in Notes mode, 1b)
let diaList=[];
/* Scale-degree coloring: paint the tonic-seventh skeleton (1·3·5·7) with the
   app's semantic interval colors and leave the passing tones (2·4·6) neutral, so
   the fifth keeps its blue instead of being swallowed by a generic "other" that
   reused fifth-blue. The fifth is iv 7, or iv 6 only when no perfect-5 is present
   (Locrian/blues ♭5 is the fifth; Lydian's ♯4 and any ♭6 stay passing tones). */
function scClass(iv, ivs){
  if(iv===0) return 'd-root';
  if(iv===3||iv===4) return 'd-third';
  if(iv===7 || (iv===6 && !ivs.includes(7))) return 'd-fifth';
  if(iv===10||iv===11) return 'd-sev';
  return 'd-other';
}
function boxWindow(pos){ if(!pos) return null; const anchor=(gRoot-4+12)%12; const start=anchor+BOX_OFFSETS[pos-1]; return [start, start+4]; }
function diatonic(){
  const iv=SCALES[scIdx].iv; if(iv.length!==7) return [];
  // One diatonic source (1a): quality comes from the shared diatonicTriads()
  // helper; the scales view spells each root by its diatonic degree.
  return diatonicTriads(gRoot, iv).map(c=>({
    label: spellNote(gRootLbl, c.rootPc, c.deg+1)+c.suf,
    rootPc: c.rootPc, iv: c.iv, tag: 'dia'+c.deg
  }));
}
function renderDiatonic(){
  const cont=document.getElementById('sc-diatonic'); diaList=diatonic();
  if(diaList.length===0){ cont.innerHTML=`<span class="muted">${t('dia_na')}</span>`; return; }
  cont.innerHTML = diaList.map((c,i)=>`<button class="btn dia${scOverlay&&scOverlay.tag===c.tag?' active':''}" data-i="${i}">${c.label}</button>`).join('') + `<button class="btn" data-clear="1">${t('b_clear')}</button>`;
}
function renderScales(){
  const s=SCALES[scIdx], flat=useFlatFor(gRootLbl);
  const seven = s.iv.length===7;
  const map={}, deg={}; s.iv.forEach((iv,di)=>{ const pc=(gRoot+iv)%12; map[pc]=iv; deg[pc]=di+1; });
  const scName = pc => seven ? spellNote(gRootLbl, pc, deg[pc]) : simpleName(pc, gRootLbl);
  // panel content (info + diatonic)
  const notes=s.iv.map(iv=>scName((gRoot+iv)%12)).join(' – ');
  const degs=s.iv.map(iv=>SDEG[iv]).join(' ');
  let html=`<div class="big">${gRootLbl} ${sName(s)}: ${notes}</div><div class="sub">${t('degrees_word')}: ${degs}</div>`;
  if(MODE_OFF[scIdx]!==undefined){ const pr=noteName((gRoot-MODE_OFF[scIdx]+120)%12,flat); html+=`<div class="sub">${t('samenotes')} ${pr} ${t('major_word')} ${t('mode_tail')}</div>`; }
  if(isCAGEDScale() && scPos>0){ const letter=CAGED_BY_POS[scPos-1]; html+=`<div class="sub">CAGED · ${cagedShapeName(letter)} — ${t('caged_desc')}</div>`; }
  if(scOverlay){ html+=`<div class="sub" style="color:var(--third)">${t('overlay_msg')} <button class="btn dia sc-open-harmony" type="button">${t('b_open_harmony')} →</button></div>`; }
  document.getElementById('sc-info').innerHTML=html;
  renderDiatonic();
  // shared board: only when the Scale view is active
  if(isBoardMode('scale')){
    const win=boxWindow(scPos);
    let ovMap=null; if(scOverlay){ ovMap={}; scOverlay.iv.forEach(iv=>ovMap[(scOverlay.rootPc+iv)%12]=iv); }
    paintBoard((pc,si,f)=>{
      if(map[pc]===undefined) return null;
      if(win && (f<win[0]||f>win[1])) return null;
      let cls;
      if(ovMap){ cls = (ovMap[pc]!==undefined) ? chDegClass(ovMap[pc]) : 'd-dim'; }
      else { cls = scClass(map[pc], s.iv); }
      return makeDot(cls, gMode==='names'?scName(pc):SDEG[map[pc]], OPEN_MIDI[si]+f);
    }, scaleLegendHTML(), '');
  }
}
function buildScSelect(){
  const sel=document.getElementById('sc-select'); sel.innerHTML='';
  SCALES.forEach((s,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=sName(s); if(i===scIdx)o.selected=true; sel.appendChild(o); });
}
function buildScPos(){
  const c=document.getElementById('sc-pos'); c.innerHTML='';
  const caged=isCAGEDScale();
  const labels=[t('pos_all'),'1','2','3','4','5'];
  labels.forEach((lab,i)=>{
    const b=document.createElement('button'); b.className='btn'+(i===scPos?' active':'');
    if(caged && i>=1){ const letter=CAGED_BY_POS[i-1]; const title=t('lbl_pos')+' '+i+' · '+cagedShapeName(letter); b.textContent=letter; b.title=title; b.setAttribute('aria-label', title); }
    else { b.textContent=lab; b.setAttribute('aria-label', lab); }
    b.setAttribute('aria-pressed', i===scPos);
    b.onclick=()=>{ scPos=i; buildScPos(); renderScales(); saveState(); }; c.appendChild(b);
  });
}

