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
const MODE_OFF={1:2,2:4,3:5,4:7,5:9,6:11};
const BOX_OFFSETS=[0,3,5,7,10];
let scIdx=5, scPos=0, scOverlay=null;
let diaList=[];
function scClass(iv){ if(iv===0)return'd-root'; if(iv===3||iv===4)return'd-third'; return'd-other'; }
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
  const win=boxWindow(scPos);
  let ovMap=null; if(scOverlay){ ovMap={}; scOverlay.iv.forEach(iv=>ovMap[(scOverlay.rootPc+iv)%12]=iv); }
  renderBoard(document.getElementById('sc-board'),(pc,si,f)=>{
    if(map[pc]===undefined) return null;
    if(win && (f<win[0]||f>win[1])) return null;
    let cls;
    if(ovMap){ cls = (ovMap[pc]!==undefined) ? chDegClass(ovMap[pc]) : 'd-dim'; }
    else { cls = scClass(map[pc]); }
    return makeDot(cls, gMode==='names'?scName(pc):SDEG[map[pc]], OPEN_MIDI[si]+f);
  });
  renderNums(document.getElementById('sc-nums'));
  const notes=s.iv.map(iv=>scName((gRoot+iv)%12)).join(' – ');
  const degs=s.iv.map(iv=>SDEG[iv]).join(' ');
  let html=`<div class="big">${gRootLbl} ${sName(s)}: ${notes}</div><div class="sub">${t('degrees_word')}: ${degs}</div>`;
  if(MODE_OFF[scIdx]!==undefined){ const pr=noteName((gRoot-MODE_OFF[scIdx]+120)%12,flat); html+=`<div class="sub">${t('samenotes')} ${pr} ${t('major_word')} ${t('mode_tail')}</div>`; }
  if(scOverlay){ html+=`<div class="sub" style="color:var(--third)">${t('overlay_msg')}</div>`; }
  document.getElementById('sc-info').innerHTML=html;
  const leg=document.getElementById('sc-legend');
  if(scOverlay){ leg.innerHTML=
    `<div class="leg"><span class="leg-dot" style="background:var(--root)"></span>${t('leg_root')}</div>`+
    `<div class="leg"><span class="leg-dot" style="background:var(--third)"></span>${t('leg_third')}</div>`+
    `<div class="leg"><span class="leg-dot" style="background:var(--fifth)"></span>${t('leg_fifth')}</div>`+
    `<div class="leg"><span class="leg-dot" style="background:var(--seventh)"></span>${t('leg_seventh')}</div>`+
    `<div class="leg"><span class="leg-dot" style="background:rgba(220,200,160,0.4)"></span>${t('leg_sc_other')}</div>`; }
  else { leg.innerHTML=
    `<div class="leg"><span class="leg-dot" style="background:var(--root)"></span>${t('leg_root')}</div>`+
    `<div class="leg"><span class="leg-dot" style="background:var(--third)"></span>${t('leg_third')}</div>`+
    `<div class="leg"><span class="leg-dot" style="background:var(--fifth)"></span>${t('leg_sc_other')}</div>`; }
  renderDiatonic();
}
function buildScSelect(){
  const sel=document.getElementById('sc-select'); sel.innerHTML='';
  SCALES.forEach((s,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=sName(s); if(i===scIdx)o.selected=true; sel.appendChild(o); });
}
function buildScPos(){
  const c=document.getElementById('sc-pos'); c.innerHTML='';
  const labels=[t('pos_all'),'1','2','3','4','5'];
  labels.forEach((lab,i)=>{ const b=document.createElement('button'); b.className='btn'+(i===scPos?' active':''); b.textContent=lab; b.setAttribute('aria-pressed', i===scPos);
    b.onclick=()=>{ scPos=i; buildScPos(); renderScales(); saveState(); }; c.appendChild(b); });
}

