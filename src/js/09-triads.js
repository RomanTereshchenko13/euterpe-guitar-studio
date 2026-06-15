/* ===================== TRIADS ===================== */
const TRIADS=[
  {short:'',iv:[0,4,7],en:'Major',uk:'Мажор'},
  {short:'m',iv:[0,3,7],en:'Minor',uk:'Мінор'},
  {short:'dim',iv:[0,3,6],en:'Dim',uk:'Зменшений'},
  {short:'aug',iv:[0,4,8],en:'Aug',uk:'Збільшений'},
];
const STRING_SETS=[
  {label:'1·2·3', idx:[2,1,0]},
  {label:'2·3·4', idx:[3,2,1]},
  {label:'3·4·5', idx:[4,3,2]},
  {label:'4·5·6', idx:[5,4,3]},
];
const ROT=[[0,1,2],[1,2,0],[2,0,1]];
let trQual=0, trSet=0, trInv=1;
function nearestFret(open, pc, ref){
  let base=mod(pc-open,12), best=base, bd=Math.abs(base-ref);
  [base-12, base+12, base+24].forEach(c=>{ if(Math.abs(c-ref)<bd){ bd=Math.abs(c-ref); best=c; } });
  return best;
}
function triFuncClass(o, iv){ if(o===0)return'd-root'; if(o===iv[1])return'd-third'; return'd-fifth'; }
function triLabel(o, iv, pc, flat){ return gMode==='names' ? spellNote(gRootLbl,pc,DEG_OF[o]) : (o===0?'1':(o===iv[1]?DEG_LABEL[iv[1]]:DEG_LABEL[iv[2]])); }
function triadCells(){
  const tri=TRIADS[trQual], iv=tri.iv, set=STRING_SETS[trSet];
  const invs = trInv===0 ? [0,1,2] : [trInv-1];
  const [low,mid,high]=set.idx;
  const cells={}, pats=[];
  invs.forEach(inv=>{
    const order=ROT[inv].map(i=>iv[i]);              // intervals bottom -> top
    const pcs=order.map(o=>mod(gRoot+o,12));
    const lf=mod(pcs[0]-OPEN[low],12);
    const mf=nearestFret(OPEN[mid],pcs[1],lf);
    const hf=nearestFret(OPEN[high],pcs[2],mf);
    const pat=[[low,lf,order[0]],[mid,mf,order[1]],[high,hf,order[2]]];
    pats.push({inv, notes:pat.map(([si,fr,o])=>({si,fr,o}))});
    const mn=Math.min(lf,mf,hf), mx=Math.max(lf,mf,hf);
    for(let k=-2;k<=3;k++){ const sh=12*k; if(mn+sh<0||mx+sh>FRETS) continue;
      pat.forEach(([si,fr,o])=>{ cells[si+'_'+(fr+sh)]=o; }); }
  });
  return {cells, iv, pats};
}
/* shift a triad pattern up by octaves until it is a fully-fretted movable block
   (every fret >= 1). This drops open strings — matching the "movable shape"
   teaching of the triad view — and keeps card display and playback identical. */
function normalizeTriPat(notes){
  let mn=Math.min(...notes.map(n=>n.fr)), sh=0;
  while(mn+sh<1) sh+=12;
  return notes.map(n=>({si:n.si, fr:n.fr+sh, o:n.o}));
}
const TRI_TO_QUAL=[0,1,10,12];   // triad index -> QUALITIES index (maj/m/dim/aug) for the bass's true fifth
/* the triad voicing the transport should sound: the selected inversion (root
   position when "all" is shown), in its real register on the current tuning. */
function currentTriadVoicing(){
  const {pats}=triadCells();
  const p = (trInv===0) ? (pats.find(x=>x.inv===0)||pats[0]) : pats[0];
  const notes=normalizeTriPat(p.notes);
  const midis=notes.map(n=>OPEN_MIDI[n.si]+n.fr).sort((a,b)=>a-b);   // low -> high
  return {midis, pcs:[...new Set(midis.map(m=>mod(m,12)))]};
}
/* one compact 3-string triad block. Dots carry data-midi so a click sounds the
   note; colours follow the chord function (root/third/fifth). */
function triadCardSVG(notes, iv){
  const frets=notes.map(n=>n.fr);
  const minF=Math.min(...frets), maxF=Math.max(...frets);
  const baseFret=(maxF<=4?1:minF);
  const span=Math.max(3, maxF-baseFret+1);
  const W=82, H=120, padX=15, padTop=22, padBot=14;
  const cols=3, rows=span;
  const gw=(W-padX*2)/(cols-1), gh=(H-padTop-padBot)/rows;
  const x=i=>padX+i*gw, y=r=>padTop+r*gh;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  for(let r=0;r<=rows;r++){ const isNut=(baseFret===1 && r===0); s+=`<line class="${isNut?'cd-nut':'cd-fret'}" x1="${x(0)}" y1="${y(r)}" x2="${x(2)}" y2="${y(r)}"/>`; }
  for(let i=0;i<3;i++){ s+=`<line class="cd-string" x1="${x(i)}" y1="${y(0)}" x2="${x(i)}" y2="${y(rows)}"/>`; }
  if(baseFret>1){ s+=`<text class="cd-pos" x="${x(0)-8}" y="${y(0)+gh*0.7}" text-anchor="end">${baseFret}fr</text>`; }
  notes.forEach((n,col)=>{                 // col 0 = lowest string of the set
    const r=n.fr-baseFret; if(r<0||r>=rows) return;
    const cy=y(r)+gh/2;
    const cls=triFuncClass(n.o,iv);
    const midi=OPEN_MIDI[n.si]+n.fr;
    s+=`<circle class="cd-dot ${cls}" data-midi="${midi}" cx="${x(col)}" cy="${cy}" r="6.5"/>`;
  });
  s+=`</svg>`; return s;
}
function renderTriadCards(){
  const cont=document.getElementById('tr-diagram'); if(!cont) return;
  const {pats,iv}=triadCells(), tri=TRIADS[trQual], set=STRING_SETS[trSet];
  const invName=[t('inv_root'),t('inv_1st'),t('inv_2nd')];
  cont.innerHTML = pats.map(p=>{
    const notes=normalizeTriPat(p.notes);
    return `<div class="chordbox tri"><div class="cb-name">${gRootLbl}${tri.short} · ${invName[p.inv]}</div>`+
           `${triadCardSVG(notes, iv)}<div class="cb-cap">${t('strings_word')} ${set.label}</div></div>`;
  }).join('');
}
function buildTrQuals(){
  const c=document.getElementById('tr-quals'); c.innerHTML='';
  TRIADS.forEach((q,i)=>{ const b=document.createElement('button'); b.className='btn'+(i===trQual?' active':''); b.textContent=qName(q); b.setAttribute('aria-pressed', i===trQual);
    b.onclick=()=>{ trQual=i; buildTrQuals(); renderTriads(); saveState(); }; c.appendChild(b); });
}
function buildTrSets(){
  const c=document.getElementById('tr-sets'); c.innerHTML='';
  STRING_SETS.forEach((s,i)=>{ const b=document.createElement('button'); b.className='btn'+(i===trSet?' active':''); b.textContent=s.label; b.setAttribute('aria-pressed', i===trSet);
    b.onclick=()=>{ trSet=i; buildTrSets(); renderTriads(); saveState(); }; c.appendChild(b); });
}
function buildTrInvs(){
  const c=document.getElementById('tr-invs'); c.innerHTML='';
  const labels=[t('inv_all'),t('inv_root'),t('inv_1st'),t('inv_2nd')];
  labels.forEach((lab,i)=>{ const b=document.createElement('button'); b.className='btn'+(i===trInv?' active':''); b.textContent=lab; b.setAttribute('aria-pressed', i===trInv);
    b.onclick=()=>{ trInv=i; buildTrInvs(); renderTriads(); saveState(); }; c.appendChild(b); });
}
function renderTriads(){
  const {cells,iv}=triadCells(), tri=TRIADS[trQual], set=STRING_SETS[trSet];
  renderBoard(document.getElementById('tr-board'),(pc,si,f)=>{
    const o=cells[si+'_'+f]; if(o===undefined) return null;
    return makeDot(triFuncClass(o,iv), triLabel(o,iv,pc), OPEN_MIDI[si]+f);
  });
  renderNums(document.getElementById('tr-nums'));
  const notes=iv.map(i=>spellNote(gRootLbl,mod(gRoot+i,12),DEG_OF[i])).join(' – ');
  const invDesc=[t('inv_all_desc'),t('inv_root_desc'),t('inv_1st_desc'),t('inv_2nd_desc')][trInv];
  document.getElementById('tr-info').innerHTML=
    `<div class="big">${gRootLbl}${tri.short} · ${qName(tri)} · ${t('strings_word')} ${set.label}: ${notes}</div><div class="sub">${invDesc}</div>`;
  renderTriadCards();
}

