/* ===================== TRIADS =====================
   A toggle on Chord tones, not a view of its own: the triad shown is the triad
   inside the chosen chord (Am7 → Am, m7♭5 → dim), on one three-string set, by
   inversion. A chord with no third or no fifth (sus2, sus4, 11) has no triad. */
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
let trSet=0, trInv=1;
// the TRIADS index of the chosen chord's triad, or -1 when it has none
function chTriadIdx(){
  const iv=QUALITIES[chQual].iv;
  const third=iv.includes(4)?4:iv.includes(3)?3:-1;
  const fifth=iv.includes(7)?7:iv.includes(6)?6:iv.includes(8)?8:-1;
  return TRIADS.findIndex(tr=>tr.iv[1]===third && tr.iv[2]===fifth);
}
// is the neck showing triads right now? (the toggle is on AND the chord has one)
function triadsOn(){ return chTriads && chTriadIdx()>=0; }
function curTriad(){ return TRIADS[Math.max(0, chTriadIdx())]; }
function nearestFret(open, pc, ref){
  let base=mod(pc-open,12), best=base, bd=Math.abs(base-ref);
  [base-12, base+12, base+24].forEach(c=>{ if(Math.abs(c-ref)<bd){ bd=Math.abs(c-ref); best=c; } });
  return best;
}
function triFuncClass(o, iv){ if(o===0)return'd-root'; if(o===iv[1])return'd-third'; return'd-fifth'; }
function triLabel(o, iv, pc){ return gMode==='names' ? spellNote(gRootLbl,pc,DEG_OF[o]) : (o===0?'1':(o===iv[1]?DEG_LABEL[iv[1]]:DEG_LABEL[iv[2]])); }
function triadCells(){
  const tri=curTriad(), iv=tri.iv, set=STRING_SETS[trSet];
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
/* shift a triad pattern up by octaves until every fret is ≥ 1 — a movable block, no
   open strings — so cards and playback match */
function normalizeTriPat(notes){
  let mn=Math.min(...notes.map(n=>n.fr)), sh=0;
  while(mn+sh<1) sh+=12;
  return notes.map(n=>({si:n.si, fr:n.fr+sh, o:n.o}));
}
const TRI_TO_QUAL=[0,1,10,12];   // triad index -> QUALITIES index (maj/m/dim/aug) for the bass's true fifth
/* the triad the transport sounds: the selected inversion (root position when "all" is
   shown), in its real register */
function currentTriadVoicing(){
  const {pats}=triadCells();
  const p = (trInv===0) ? (pats.find(x=>x.inv===0)||pats[0]) : pats[0];
  const notes=normalizeTriPat(p.notes);
  const midis=notes.map(n=>OPEN_MIDI[n.si]+n.fr).sort((a,b)=>a-b);   // low -> high
  return {midis, pcs:[...new Set(midis.map(m=>mod(m,12)))]};
}
/* one compact 3-string triad card; dots carry data-midi so a click sounds them */
function triadCardSVG(notes, iv){
  const frets=notes.map(n=>n.fr);
  const {svg, x, y, gh, baseFret, rows}=fretGrid(frets, 3, {W:82,H:120,padX:15,padTop:22,padBot:14,posDX:8});
  let s=svg;
  const fing=chordFingers(frets);
  notes.forEach((n,col)=>{                 // col 0 = lowest string of the set
    const r=n.fr-baseFret; if(r<0||r>=rows) return;
    const cy=y(r)+gh/2;
    const cls=triFuncClass(n.o,iv);
    const midi=OPEN_MIDI[n.si]+n.fr;
    s+=`<circle class="cd-dot ${cls}" data-midi="${midi}" cx="${x(col)}" cy="${cy}" r="7.5"/>`;
    if(fing[col]) s+=`<text class="cd-fing" x="${x(col)}" y="${cy}" text-anchor="middle">${fing[col]}</text>`;
  });
  s+=`</svg>`; return s;
}
function renderTriadCards(){
  const cont=document.getElementById('tr-diagram'); if(!cont) return;
  const {pats,iv}=triadCells(), tri=curTriad(), set=STRING_SETS[trSet];
  const invName=[t('inv_root'),t('inv_1st'),t('inv_2nd')];
  cont.innerHTML = pats.map(p=>{
    const notes=normalizeTriPat(p.notes);
    return `<div class="chordbox tri"><div class="cb-name">${noteTxt(gRootLbl)}${tri.short} · ${invName[p.inv]}</div>`+
           `${triadCardSVG(notes, iv)}<div class="cb-cap">${t('strings_word')} ${set.label}</div></div>`;
  }).join('');
}
function buildTrSets(){
  segButtons('tr-sets', STRING_SETS.map(s=>({label:s.label})), trSet,
    i=>{ trSet=i; buildTrSets(); renderTriads(); saveState(); });
}
function buildTrInvs(){
  segButtons('tr-invs', [t('inv_all'),t('inv_root'),t('inv_1st'),t('inv_2nd')].map(label=>({label})), trInv,
    i=>{ trInv=i; buildTrInvs(); renderTriads(); saveState(); });
}
function renderTriads(){
  const {cells,iv}=triadCells(), tri=curTriad(), set=STRING_SETS[trSet];
  const notes=iv.map(i=>spellNote(gRootLbl,mod(gRoot+i,12),DEG_OF[i])).join(' – ');
  const invDesc=[t('inv_all_desc'),t('inv_root_desc'),t('inv_1st_desc'),t('inv_2nd_desc')][trInv];
  document.getElementById('tr-info').innerHTML=
    `<div class="big">${noteTxt(gRootLbl)}${tri.short} · ${qName(tri)} · ${t('strings_word')} ${set.label}: ${notes}</div><div class="sub">${invDesc}</div>`;
  renderTriadCards();
  if(isBoardMode('triads')){
    paintBoard((pc,si,f)=>{
      const o=cells[si+'_'+f]; if(o===undefined) return null;
      return makeDot(triFuncClass(o,iv), triLabel(o,iv,pc), OPEN_MIDI[si]+f);
    }, triadLegendHTML(), t('tr_hint'));
  }
}

