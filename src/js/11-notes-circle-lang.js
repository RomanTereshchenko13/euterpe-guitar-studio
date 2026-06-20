/* ===================== ALL NOTES ===================== */
const NAT=['C','D','E','F','G','A','B'], SHARP=['C#','D#','F#','G#','A#'], FLAT=['Db','Eb','Gb','Ab','Bb'];
let ntFilter='all', ntRoot='';
function ntMatch(note){ if(!ntRoot) return false; if(note===ntRoot) return true; if(ENHARM[note]===ntRoot) return true; const rev=Object.entries(ENHARM).find(([,v])=>v===ntRoot); return rev && rev[0]===note; }
function renderNotes(){
  if(!isBoardMode('notes')) return;
  paintBoard((pc,si,f)=>{
    const note=NOTES[pc], sharp=note.includes('#'), root=ntMatch(note);
    if(ntFilter==='nat' && sharp && !root) return null;
    let label=note; if(root && ENHARM[note] && FLAT.includes(ntRoot)) label=ENHARM[note];
    return makeDot(root?'d-root':(sharp?'d-sharp':'d-natural'), label, OPEN_MIDI[si]+f);
  }, notesLegendHTML(), '');
}

/* ===================== CIRCLE OF FIFTHS ===================== */
const COF=[
  {i:0,  maj:'C',  majPc:0,  sig:0,  min:'Am',  minPc:9},
  {i:1,  maj:'G',  majPc:7,  sig:1,  min:'Em',  minPc:4},
  {i:2,  maj:'D',  majPc:2,  sig:2,  min:'Bm',  minPc:11},
  {i:3,  maj:'A',  majPc:9,  sig:3,  min:'F♯m', minPc:6},
  {i:4,  maj:'E',  majPc:4,  sig:4,  min:'C♯m', minPc:1},
  {i:5,  maj:'B',  majPc:11, sig:5,  min:'G♯m', minPc:8},
  {i:6,  maj:'G♭', majPc:6,  sig:6,  min:'E♭m', minPc:3, enh:'F♯ / G♭'},
  {i:7,  maj:'D♭', majPc:1,  sig:-5, min:'B♭m', minPc:10},
  {i:8,  maj:'A♭', majPc:8,  sig:-4, min:'Fm',  minPc:5},
  {i:9,  maj:'E♭', majPc:3,  sig:-3, min:'Cm',  minPc:0},
  {i:10, maj:'B♭', majPc:10, sig:-2, min:'Gm',  minPc:7},
  {i:11, maj:'F',  majPc:5,  sig:-1, min:'Dm',  minPc:2},
];
const SHARP_ORDER=['F','C','G','D','A','E','B'], FLAT_ORDER=['B','E','A','D','G','C','F'];
const ROMAN_MAJ=['I','ii','iii','IV','V','vi','vii°'], ROMAN_MIN=['i','ii°','III','iv','v','VI','VII'];
const MAJ_IV=[0,2,4,5,7,9,11], MIN_IV=[0,2,3,5,7,8,10];
function sigText(sig){
  if(sig===0) return t('cof_sig0');
  if(sig===6) return '6 ♯ / 6 ♭';
  if(sig>0) return sig+' ♯ — '+SHARP_ORDER.slice(0,sig).map(x=>x+'♯').join(' ');
  const a=-sig; return a+' ♭ — '+FLAT_ORDER.slice(0,a).map(x=>x+'♭').join(' ');
}
function buildDia(rootPc, sc, flat){
  // One diatonic source (1a): the circle spells each chord by key signature.
  return diatonicTriads(rootPc, sc).map(c=> noteName(c.rootPc, flat)+c.suf);
}
/* Circle as a projection of the one musical context (1a): instead of its own
   selection state, the wheel shows the current key. The major/minor ring is
   derived from the mode (major-third family → outer ring), and the highlighted
   node is the COF entry whose major (or relative-minor) note is the context
   root. Circle clicks set the context via setKey(); these never persist. */
function ctxCofMinor(){ return !isMajorFamily(scIdx); }
function ctxCofSel(){ const minor=ctxCofMinor(); const i=COF.findIndex(c=>(minor?c.minPc:c.majPc)===gRoot); return i<0?0:i; }
function pcToRootLabel(pc){ const i=ROOTS.findIndex(r=> (FLAT_ROOTS[r]!==undefined?FLAT_ROOTS[r]:NOTES.indexOf(r))===pc ); return ROOTS[i]; }
function activateRoot(container, pc){ [...container.children].forEach(b=>{ const lbl=b.textContent; const p=FLAT_ROOTS[lbl]!==undefined?FLAT_ROOTS[lbl]:NOTES.indexOf(lbl); b.classList.toggle('active', p===pc); }); }
function cofXY(i,r){ const a=(-90+i*30)*Math.PI/180; return [180+r*Math.cos(a), 180+r*Math.sin(a)]; }
function renderCircle(){
  const cofSel=ctxCofSel(), cofMinor=ctxCofMinor();
  const RO=132, RI=85, rMaj=27, rMin=21, dom=(cofSel+1)%12, sub=(cofSel+11)%12;
  let s=`<circle cx="180" cy="180" r="${RO}" fill="none" stroke="var(--border)" stroke-width="1"/><circle cx="180" cy="180" r="${RI}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  // 1d: a connecting arc through subdominant → tonic → dominant (drawn behind the
  // nodes), animated on each render so a key change reads as a visible relation.
  const arcR=cofMinor?RI:RO;
  const [asx,asy]=cofXY(sub,arcR), [atx,aty]=cofXY(cofSel,arcR), [adx,ady]=cofXY(dom,arcR);
  s+=`<path class="cof-arc" d="M ${asx.toFixed(1)} ${asy.toFixed(1)} L ${atx.toFixed(1)} ${aty.toFixed(1)} L ${adx.toFixed(1)} ${ady.toFixed(1)}"/>`;
  COF.forEach(c=>{
    const i=c.i;
    let mfill='var(--bg-panel-2)', mtext='var(--text)', nfill='var(--bg-panel)', ntext='var(--text-dim)';
    const setRole=()=>{
      if(i===cofSel) return ['var(--root)','#0e1408'];
      if(i===dom) return ['var(--third)','#1f1405'];
      if(i===sub) return ['var(--fifth)','#07203a'];
      return null;
    };
    if(!cofMinor){
      const r=setRole(); if(r){mfill=r[0];mtext=r[1];}
      if(i===cofSel){nfill='var(--seventh)';ntext='#2a0a16';}
    } else {
      const r=setRole(); if(r){nfill=r[0];ntext=r[1];}
      if(i===cofSel){mfill='var(--seventh)';mtext='#2a0a16';}
    }
    const [mx,my]=cofXY(i,RO), [nx,ny]=cofXY(i,RI);
    s+=`<g class="cof-node" data-i="${i}" data-type="maj" tabindex="0" role="button" aria-label="${c.maj} ${t('major_word')}"><circle cx="${mx}" cy="${my}" r="${rMaj}" fill="${mfill}" stroke="var(--border-strong)" stroke-width="1.5"/><text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" font-size="15" fill="${mtext}">${c.maj}</text></g>`;
    s+=`<g class="cof-node" data-i="${i}" data-type="min" tabindex="0" role="button" aria-label="${c.min}"><circle cx="${nx}" cy="${ny}" r="${rMin}" fill="${nfill}" stroke="var(--border)" stroke-width="1.2"/><text x="${nx}" y="${ny}" text-anchor="middle" dominant-baseline="central" font-size="10.5" fill="${ntext}">${c.min}</text></g>`;
  });
  document.getElementById('cof-svg').innerHTML=s;
  renderCofInfo();
}
function renderCofInfo(){
  const cofSel=ctxCofSel(), cofMinor=ctxCofMinor();
  const c=COF[cofSel], useFlat=(c.sig<0||c.sig===6);
  const keyPc=cofMinor?c.minPc:c.majPc;
  const dia=buildDia(keyPc, cofMinor?MIN_IV:MAJ_IV, useFlat);
  const roman=cofMinor?ROMAN_MIN:ROMAN_MAJ;
  const keyName=cofMinor?c.min:(c.enh||c.maj), kind=cofMinor?t('min_word'):t('major_word');
  const rel=cofMinor?`${t('cof_rel_major')}: ${(c.enh||c.maj)} ${t('major_word')}`:`${t('cof_rel_minor')}: ${c.min}`;
  const sub=COF[(cofSel+11)%12], dom=COF[(cofSel+1)%12];
  const subL=cofMinor?sub.min:sub.maj, domL=cofMinor?dom.min:dom.maj;
  const diaHtml=dia.map((ch,idx)=>`<span style="display:inline-block;min-width:48px"><b style="color:var(--text-faint)">${roman[idx]}</b> ${ch}</span>`).join(' ');
  document.getElementById('cof-info').innerHTML=
    `<div class="big">${keyName} ${kind}</div>`+
    `<div class="sub">${t('cof_sig')}: ${sigText(c.sig)}</div>`+
    `<div class="sub">${rel}</div>`+
    `<div class="sub">${t('cof_neighbors')}: ${subL} (${t('cof_subdom')}) · ${domL} (${t('cof_dom')})</div>`+
    `<div class="sub" style="margin-top:9px;line-height:2">${diaHtml}</div>`;
}

/* ===================== APPLY LANGUAGE ===================== */
function applyLang(){
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if(I18N[lang][k]!==undefined) el.textContent=I18N[lang][k]; });
  document.title = lang==='en' ? 'Euterpe — Guitar Studio' : 'Euterpe — Гітарна студія';
  document.getElementById('cof-open').textContent=t('b_open_scales');
  { const ch=document.getElementById('cof-harmony'); if(ch) ch.textContent=t('b_open_harmony'); }
  const setPair=(onId,offId)=>{ const a=document.getElementById(onId),b=document.getElementById(offId); if(a){a.classList.add('active');a.setAttribute('aria-pressed','true');} if(b){b.classList.remove('active');b.setAttribute('aria-pressed','false');} };
  gMode==='names'?setPair('g-names','g-deg'):setPair('g-deg','g-names');
  applyNtFilter();
  buildChQuals(); buildArpQuals(); buildArpPos(); buildTrQuals(); buildTrSets(); buildTrInvs(); buildScSelect(); buildScPos();
  buildToolbar(); setMetroLabel(); setLoopLabel(); setBandLabels(); setBackingToggle(); applyBackingPanel();
  buildSeqPresets(); renderSeq(); setSeqTransport();
  { const o=document.getElementById('cl-overlay'); if(o && !o.hidden) renderChangelog(); }
  renderChords(); renderArp(); renderTriads(); renderScales(); renderNotes(); renderCircle();
  if(typeof renderPractice==='function') renderPractice();   // 3b: re-localize the progress chips
  if(typeof renderEar==='function') renderEar();             // Phase 4: ear progress chips
  if(typeof refreshEarLang==='function') refreshEarLang();   // re-localize an in-flight ear prompt
  setHView(hView); setScView(scView); updateGlobalPlay();
  if(typeof applyAudioAvailability==='function') applyAudioAvailability();
  activateRoot(document.getElementById('g-roots'), gRoot);
  document.querySelectorAll('.langbtn').forEach(b=>b.classList.toggle('active', b.dataset.lang===lang));
  document.querySelectorAll('.ph-help').forEach(b=>b.setAttribute('aria-label', t('ph_help')));
  if(typeof syncTabsScroll==='function') syncTabsScroll();
}

