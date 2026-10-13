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
    return makeDot(root?'d-root':(sharp?'d-sharp':'d-natural'), noteTxt(label), OPEN_MIDI[si]+f);
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
const MAJ_IV=[0,2,4,5,7,9,11], MIN_IV=[0,2,3,5,7,8,10];
function sigText(sig){
  if(sig===0) return t('cof_sig0');
  if(sig===6) return '6 ♯ / 6 ♭';
  if(sig>0) return sig+' ♯ — '+SHARP_ORDER.slice(0,sig).map(x=>x+'♯').join(' ');
  const a=-sig; return a+' ♭ — '+FLAT_ORDER.slice(0,a).map(x=>x+'♭').join(' ');
}
/* The wheel is the key picker (the strip's key sheet) and shows the current key
   instead of keeping its own selection: the ring comes from the mode (major third →
   outer ring), the node from the root. Clicks go through setKey(); nothing here persists. The chord is marked on top of the key: a
   major- or minor-triad chord rings its node (ii in C rings Dm). */
function ctxCofMinor(){ return !isMajorFamily(scIdx); }
function ctxCofSel(){ const minor=ctxCofMinor(); const i=COF.findIndex(c=>(minor?c.minPc:c.majPc)===keyRoot); return i<0?0:i; }
function pcToRootLabel(pc){ const i=ROOTS.findIndex(r=> (FLAT_ROOTS[r]!==undefined?FLAT_ROOTS[r]:NOTES.indexOf(r))===pc ); return ROOTS[i]; }
function activateRoot(container, pc){ [...container.children].forEach(b=>{ const on=+b.dataset.pc===pc; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on?'true':'false'); }); }
/* the ring the chord sits on, or null: unmarked when it is the key's own tonic chord
   (the key already shows it) or has no plain major/minor triad (sus, dim, aug, 11) */
function cofChordRing(){
  const iv=QUALITIES[chQual].iv, ring = iv[2]!==7 ? null : iv[1]===4 ? 'maj' : iv[1]===3 ? 'min' : null;
  return (chRoot===keyRoot && ring===(ctxCofMinor()?'min':'maj')) ? null : ring;
}
let _cofArcKey='';
function cofXY(i,r){ const a=(-90+i*30)*Math.PI/180; return [180+r*Math.cos(a), 180+r*Math.sin(a)]; }
function renderCircle(){
  const cofSel=ctxCofSel(), cofMinor=ctxCofMinor();
  const RO=132, RI=85, rMaj=27, rMin=21, dom=(cofSel+1)%12, sub=(cofSel+11)%12, ring=cofChordRing();
  // the arc draws in on a new key only; a chord moving under the same key leaves it drawn
  const arcKey=keyRoot+':'+scIdx, still=arcKey===_cofArcKey; _cofArcKey=arcKey;
  let s=`<circle cx="180" cy="180" r="${RO}" fill="none" stroke="var(--border)" stroke-width="1"/><circle cx="180" cy="180" r="${RI}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  // an arc through subdominant → tonic → dominant, behind the nodes, animated on each
  // render so a key change reads as a visible relation
  const arcR=cofMinor?RI:RO;
  const [asx,asy]=cofXY(sub,arcR), [atx,aty]=cofXY(cofSel,arcR), [adx,ady]=cofXY(dom,arcR);
  s+=`<path class="cof-arc${still?' still':''}" d="M ${asx.toFixed(1)} ${asy.toFixed(1)} L ${atx.toFixed(1)} ${aty.toFixed(1)} L ${adx.toFixed(1)} ${ady.toFixed(1)}"/>`;
  /* The colours mean on the circle what they mean on the neck: the tonic is the root's
     green, V the fifth's blue. IV and the relative key carry no colour of their own,
     only a ring. */
  const MARK='var(--text-dim)';
  COF.forEach(c=>{
    const i=c.i;
    let mfill='var(--bg-panel-2)', mtext='var(--text)', nfill='var(--bg-panel)', ntext='var(--text-dim)';
    let mstroke='var(--border-strong)', mw=1.5, nstroke='var(--border)', nw=1.2;
    const role = i===cofSel ? ['var(--root)','#0e1408'] : i===dom ? ['var(--fifth)','#07203a'] : null;
    if(!cofMinor){
      if(role){ mfill=role[0]; mtext=role[1]; }
      if(i===sub){ mstroke=MARK; mw=2.5; }
      if(i===cofSel){ nstroke=MARK; nw=2.5; ntext='var(--text)'; }
    } else {
      if(role){ nfill=role[0]; ntext=role[1]; }
      if(i===sub){ nstroke=MARK; nw=2.5; ntext='var(--text)'; }
      if(i===cofSel){ mstroke=MARK; mw=2.5; }
    }
    const [mx,my]=cofXY(i,RO), [nx,ny]=cofXY(i,RI);
    const majCh=ring==='maj' && c.majPc===chRoot, minCh=ring==='min' && c.minPc===chRoot;
    s+=`<g class="cof-node${majCh?' cof-chord':''}" data-i="${i}" data-type="maj" tabindex="0" role="button" aria-label="${c.maj} ${t('major_word')}"><circle cx="${mx}" cy="${my}" r="${rMaj}" fill="${mfill}" stroke="${mstroke}" stroke-width="${mw}"/><text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" font-size="15" fill="${mtext}">${c.maj}</text></g>`;
    s+=`<g class="cof-node${minCh?' cof-chord':''}" data-i="${i}" data-type="min" tabindex="0" role="button" aria-label="${c.min}"><circle cx="${nx}" cy="${ny}" r="${rMin}" fill="${nfill}" stroke="${nstroke}" stroke-width="${nw}"/><text x="${nx}" y="${ny}" text-anchor="middle" dominant-baseline="central" font-size="10.5" fill="${ntext}">${c.min}</text></g>`;
  });
  document.getElementById('cof-svg').innerHTML=s;
  renderCofInfo();
}
/* The key panel: the key by its own name, the signature it is written in, its relative
   (for a mode, the major it shares its notes with) and its neighbours on the circle. The
   key's chords are the chord sheet's degree row (keyDegrees), not repeated here. */
function renderCofInfo(){
  const cofSel=ctxCofSel(), cofMinor=ctxCofMinor(), c=COF[cofSel];
  const off=MODE_OFF[scIdx], mode=off!==undefined && scIdx!==5;
  // the major whose signature the key is written in: a mode's parent; any other scale
  // (pentatonic, blues, harmonic or melodic minor) its family's major or minor key
  const sigPc=mod(keyRoot-(off!==undefined ? off : cofMinor ? 9 : 0), 12), sk=COF.find(k=>k.majPc===sigPc);
  const rel = mode ? `${t('samenotes')} ${sk.enh||sk.maj} ${t('major_word')} ${t('mode_tail')}`
    : cofMinor ? `${t('cof_rel_major')}: ${c.enh||c.maj} ${t('major_word')}` : `${t('cof_rel_minor')}: ${c.min}`;
  const sub=COF[(cofSel+11)%12], dom=COF[(cofSel+1)%12];
  const subL=cofMinor?sub.min:sub.maj, domL=cofMinor?dom.min:dom.maj;
  document.getElementById('cof-info').innerHTML=
    `<div class="big">${noteTxt(keyLbl)} ${sKeyName(SCALES[scIdx])}</div>`+
    `<div class="sub">${t('cof_sig')}: ${sigText(sk.sig)}</div>`+
    `<div class="sub">${rel}</div>`+
    `<div class="sub">${t('cof_neighbors')}: ${subL} (${t('cof_subdom')}) · ${domL} (${t('cof_dom')})</div>`;
}

/* ===================== APPLY LANGUAGE ===================== */
function applyLang(){
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if(I18N[lang][k]!==undefined) el.textContent=I18N[lang][k]; });
  document.title = lang==='en' ? 'Euterpe — Guitar Studio' : 'Euterpe — Гітарна студія';
  const setPair=(onId,offId)=>{ const a=document.getElementById(onId),b=document.getElementById(offId); if(a){a.classList.add('active');a.setAttribute('aria-pressed','true');} if(b){b.classList.remove('active');b.setAttribute('aria-pressed','false');} };
  gMode==='names'?setPair('g-names','g-deg'):setPair('g-deg','g-names');
  applyNtFilter();
  buildArpPos(); buildTrSets(); buildTrInvs(); buildScPos();
  buildToolbar(); setMetroLabel(); setBandLabels(); setBackingToggle();
  buildSeqPresets(); renderSeq(); setSeqTransport();
  { const o=document.getElementById('cl-overlay'); if(o && !o.hidden) renderChangelog(); }
  renderPractice();
  refreshDrillsLang();   // re-localize the drill in flight, and the drill header, whose name and setup handle
  // are painted from i18n, not data-i18n
  applyDrillCtx();
  setHView(hView); setScView(scView);
  renderStrip();   // chip labels, ▶ and any open sheet are painted from i18n
  applyAudioAvailability();
  micRefreshLang();
  calRefreshLang();
  document.querySelectorAll('.langbtn').forEach(b=>b.classList.toggle('active', b.dataset.lang===lang));
  document.querySelectorAll('.ph-help').forEach(b=>b.setAttribute('aria-label', t('ph_help')));
  /* the view switch has no visible label (its buttons name themselves next to the
     neck), so the group is named for screen readers */
  { const bl=document.getElementById('board-lens'); if(bl) bl.setAttribute('aria-label', t('lbl_view')); }
}

