/* ===================== CHORD TONES ===================== */
const DEG_LABEL={0:'1',3:'♭3',4:'3',6:'♭5',7:'5',8:'♯5',10:'♭7',11:'7'};  // triad/overlay use (interval -> label)
/* Chord qualities carry three parallel arrays so a single semitone interval can
   mean different things in different chords (the interval-ambiguity problem):
     iv  — semitone offsets (octave-aware: 9=14, 11=17, 13=21) for highlighting + audio
     lab — display label per tone ('1','♭3','♭7','9','♯9','13', …)
     deg — diatonic letter degree (1-7) that drives correct spelling
           (9→2nd letter, 11→4th, 13→6th, etc.)
   Colour is derived from the label, not the raw interval, via labClass(). */
const QUALITIES=[
  {short:'',     iv:[0,4,7],          lab:['1','3','5'],                deg:[1,3,5],         en:'Major',uk:'Мажор'},
  {short:'m',    iv:[0,3,7],          lab:['1','♭3','5'],               deg:[1,3,5],         en:'Minor',uk:'Мінор'},
  {short:'sus2', iv:[0,2,7],          lab:['1','2','5'],                deg:[1,2,5],         en:'Sus2',uk:'Sus2'},
  {short:'sus4', iv:[0,5,7],          lab:['1','4','5'],                deg:[1,4,5],         en:'Sus4',uk:'Sus4'},
  {short:'6',    iv:[0,4,7,9],        lab:['1','3','5','6'],            deg:[1,3,5,6],       en:'Sixth',uk:'Секст-акорд'},
  {short:'m6',   iv:[0,3,7,9],        lab:['1','♭3','5','6'],           deg:[1,3,5,6],       en:'Minor 6',uk:'Мінорний 6'},
  {short:'7',    iv:[0,4,7,10],       lab:['1','3','5','♭7'],           deg:[1,3,5,7],       en:'Dom 7',uk:'Домінант 7'},
  {short:'maj7', iv:[0,4,7,11],       lab:['1','3','5','7'],            deg:[1,3,5,7],       en:'Maj 7',uk:'Мажор 7'},
  {short:'m7',   iv:[0,3,7,10],       lab:['1','♭3','5','♭7'],          deg:[1,3,5,7],       en:'Min 7',uk:'Мінор 7'},
  {short:'m7♭5', iv:[0,3,6,10],       lab:['1','♭3','♭5','♭7'],         deg:[1,3,5,7],       en:'Half-dim (m7♭5)',uk:'Напівзменш. (m7♭5)'},
  {short:'dim',  iv:[0,3,6],          lab:['1','♭3','♭5'],              deg:[1,3,5],         en:'Dim',uk:'Зменшений'},
  {short:'dim7', iv:[0,3,6,9],        lab:['1','♭3','♭5','♭♭7'],        deg:[1,3,5,7],       en:'Dim 7',uk:'Зменшений 7'},
  {short:'aug',  iv:[0,4,8],          lab:['1','3','♯5'],               deg:[1,3,5],         en:'Aug',uk:'Збільшений'},
  {short:'add9', iv:[0,4,7,14],       lab:['1','3','5','9'],            deg:[1,3,5,2],       en:'Add 9',uk:'Add 9'},
  {short:'9',    iv:[0,4,7,10,14],    lab:['1','3','5','♭7','9'],       deg:[1,3,5,7,2],     en:'Dom 9',uk:'Домінант 9'},
  {short:'maj9', iv:[0,4,7,11,14],    lab:['1','3','5','7','9'],        deg:[1,3,5,7,2],     en:'Maj 9',uk:'Мажор 9'},
  {short:'m9',   iv:[0,3,7,10,14],    lab:['1','♭3','5','♭7','9'],      deg:[1,3,5,7,2],     en:'Min 9',uk:'Мінор 9'},
  {short:'11',   iv:[0,7,10,14,17],   lab:['1','5','♭7','9','11'],      deg:[1,5,7,2,4],     en:'Dom 11',uk:'Домінант 11'},
  {short:'13',   iv:[0,4,7,10,14,21], lab:['1','3','5','♭7','9','13'],  deg:[1,3,5,7,2,6],   en:'Dom 13',uk:'Домінант 13'},
  {short:'7♭9',  iv:[0,4,7,10,13],    lab:['1','3','5','♭7','♭9'],      deg:[1,3,5,7,2],     en:'7♭9',uk:'7♭9'},
  {short:'7♯9',  iv:[0,4,7,10,15],    lab:['1','3','5','♭7','♯9'],      deg:[1,3,5,7,2],     en:'7♯9 (Hendrix)',uk:'7♯9 (Гендрікс)'},
];
function qName(q){ return lang==='en'?q.en:q.uk; }
/* colour by degree label (label-driven, robust across the whole vocabulary) */
function labClass(lab){
  if(lab==='1') return 'd-root';
  if(lab==='3'||lab==='♭3') return 'd-third';
  if(lab==='5'||lab==='♭5'||lab==='♯5') return 'd-fifth';
  if(lab==='7'||lab==='♭7'||lab==='♭♭7') return 'd-sev';
  return 'd-ext';   // 2 · 4 · 6 · 9 · ♭9 · ♯9 · 11 · ♯11 · 13 · ♭13
}
/* =================== APP MUSICAL STATE (single catalogue) ===================
   State guardrail (Phase C+): the persisted musical state is intentionally a
   small set of top-level lets, each declared next to the view that owns it.
   To stop later phases (Practice / ear / rhythm) from multiplying ad-hoc
   globals, keep ALL persisted state in this catalogue and route it through
   saveState()/loadState() with a bounds-checked restore. Current members:
     context   : gRoot, gRootLbl (root) + scIdx (mode)   (set via setKey)
     display   : gMode (note-names vs degrees)     (this block)
     view      : hView (chords|triads), scView (scale|notes)  (sub-view per tab)
     chords    : chQual                            (this block)
     triads    : trQual, trSet, trInv              (~"TRIADS view")
     scales    : scPos, scOverlay                  (~"SCALES view")
     notes     : ntFilter, ntRoot                  (Notes sub-view of Scales, 1b)
     circle    : (derived from context; not persisted)
     transport : tempo, lefty, bassOn, grooveOn, seqLoopOn, seq[]
     ui        : lang, currentTab, tuningIdx, fretRangeIdx, toolbarOpen
   New phases: add fields here (or in a `practice = {…}` object), then extend
   saveState()/loadState() — do not introduce free-floating globals elsewhere.

   The musical CONTEXT (spine #1, 1a) is the shared key center + mode that every
   key-centric view reflects: gRoot/gRootLbl (root) + scIdx (mode = scale). It is
   set in ONE place — setKey() — and Harmony, Scales, Circle and Notes all follow.
   The circle's selection is DERIVED from (gRoot, scIdx), not stored.
   ========================================================================== */
/* shared musical context (the spine): one key center (gRoot/gRootLbl) + mode
   (scIdx, in the scales block) across Harmony, Scales, Circle and Notes, set via
   setKey(). gMode is the note-name/degree display toggle, not the musical mode. */
let gRoot=9, gRootLbl='A', gMode='names';
let chQual=1;
let chVoicing=0;   // index of the selected voicing card (open / E-barre / A-barre / computed)
function chDegClass(iv){ if(iv===0)return'd-root'; if(iv===3||iv===4)return'd-third'; if([6,7,8].includes(iv))return'd-fifth'; return'd-sev'; }
function buildChQuals(){
  const c=document.getElementById('ch-quals'); c.innerHTML='';
  QUALITIES.forEach((q,i)=>{ const b=document.createElement('button'); b.className='btn'+(i===chQual?' active':'');
    b.textContent=q.short||'maj'; b.title=qName(q); b.setAttribute('aria-label', qName(q)); b.setAttribute('aria-pressed', i===chQual);
    b.onclick=()=>{ chQual=i; chVoicing=0; buildChQuals(); renderChords(); saveState(); }; c.appendChild(b); });
}
function renderChords(){
  const q=QUALITIES[chQual];
  // panel content (always current so a tab switch shows the latest)
  const notes=q.iv.map((iv,i)=>spellNote(gRootLbl,(gRoot+iv)%12,q.deg[i])).join(' – ');
  const degs=q.lab.join('  ');
  document.getElementById('ch-info').innerHTML=`<div class="big">${gRootLbl}${q.short} · ${qName(q)}: ${notes}</div><div class="sub">${t('intervals_word')}: ${degs}</div>`;
  renderChordDiagram();
  // shared board: only when chord tones is the active mode
  if(isBoardMode('chords')){
    const map={}; q.iv.forEach((iv,i)=>{ map[(gRoot+iv)%12]={lab:q.lab[i], deg:q.deg[i]}; });
    paintBoard((pc,si,f)=>{
      const m=map[pc]; if(m===undefined) return null;
      return makeDot(labClass(m.lab), gMode==='names'?spellNote(gRootLbl,pc,m.deg):m.lab, OPEN_MIDI[si]+f);
    }, chordLegendHTML(), t('ch_hint'));
  }
}

/* ---- Open / barre chord diagrams (standard-tuning reference) ----
   Movable templates per quality, root on the 6th ("E") or 5th ("A") string.
   Offsets are relative to the barre fret; null = muted string. We pick the
   shape that sits lowest on the neck (and use an open shape when the barre
   lands at fret 0). The result is the standard chord shape a guitarist learns. */
const CHORD_SHAPES = {
  '':     { E:[0,2,2,1,0,0], A:[null,0,2,2,2,0] },
  'm':    { E:[0,2,2,0,0,0], A:[null,0,2,2,1,0] },
  '7':    { E:[0,2,0,1,0,0], A:[null,0,2,0,2,0] },
  'maj7': { E:[0,2,1,1,0,0], A:[null,0,2,1,2,0] },
  'm7':   { E:[0,2,0,0,0,0], A:[null,0,2,0,1,0] },
  'dim':  { A:[null,0,1,2,1,null] },
  'aug':  { A:[null,0,3,2,2,1] },
};
const STD_OPEN = [4,11,7,2,9,4];        // standard tuning, high->low (board order)
const STD_LOW6 = [4,9,2,7,11,4];        // string6..string1 pitch classes (low->high)
/* curated open-position shapes (low6 -> high1; null = muted). Keyed pc_quality. */
const OPEN_OVERRIDES = {
  '0_':[null,3,2,0,1,0], '9_':[null,0,2,2,2,0], '7_':[3,2,0,0,0,3], '4_':[0,2,2,1,0,0], '2_':[null,null,0,2,3,2],
  '9_m':[null,0,2,2,1,0], '4_m':[0,2,2,0,0,0], '2_m':[null,null,0,2,3,1],
  '9_7':[null,0,2,0,2,0], '11_7':[null,2,1,2,0,2], '0_7':[null,3,2,3,1,0], '2_7':[null,null,0,2,1,2], '4_7':[0,2,0,1,0,0], '7_7':[3,2,0,0,0,1],
  '0_maj7':[null,3,2,0,0,0], '9_maj7':[null,0,2,1,2,0], '2_maj7':[null,null,0,2,2,2], '4_maj7':[0,2,1,1,0,0], '5_maj7':[null,null,3,2,1,0], '7_maj7':[3,2,0,0,0,2],
  '9_m7':[null,0,2,0,1,0], '2_m7':[null,null,0,2,1,1], '4_m7':[0,2,0,0,0,0],
};
/* MIDI of each string at fret 0, string6 -> string1 (standard tuning). The chord
   diagrams are an explicit standard-tuning reference, so card playback is voiced
   from here regardless of the board's current (possibly alternate) tuning. */
const STD_LOW6_MIDI = [40,45,50,55,59,64];   // E2 A2 D3 G3 B3 E4
function voicingMidi(v){ const out=[]; v.frets.forEach((fr,s)=>{ if(fr!=null) out.push(STD_LOW6_MIDI[s]+fr); }); return out; }  // low -> high

/* Canonical voicing set for a chord: the open shape (where one exists) plus the
   E-shape (root on string 6) and A-shape (root on string 5) barre forms, deduped
   by their resolved fret array so an open shape that equals a barre-at-fret-0
   isn't drawn twice. Extended qualities with no template fall back to one
   computed voicing. Ordered open-first, then by ascending barre fret. The render
   and the Listen/Loop playback both read THIS list, so they always agree. */
function chordVoicings(rootPc, short, ivs){
  const out=[], seen={};
  const add=(frets, barre, shape, generated)=>{
    if(!frets) return;
    const key=frets.map(f=>f==null?'x':f).join(',');
    if(seen[key]) return; seen[key]=1;
    out.push({frets:frets.slice(), barre, shape, generated:!!generated});
  };
  const ov=OPEN_OVERRIDES[rootPc+'_'+short];
  if(ov) add(ov, 0, 'open', false);
  const tmpl=CHORD_SHAPES[short];
  if(tmpl){
    if(tmpl.E){ const barre=mod(rootPc-4,12); add(tmpl.E.map(o=>o==null?null:barre+o), barre, barre===0?'open':'E', false); }
    if(tmpl.A){ const barre=mod(rootPc-9,12); add(tmpl.A.map(o=>o==null?null:barre+o), barre, barre===0?'open':'A', false); }
  }
  if(out.length===0){ const g=genVoicing(rootPc, ivs); if(g) add(g.frets, g.barre, 'computed', true); }
  out.sort((a,b)=> (a.shape==='open'?-1:b.shape==='open'?1:0) || (a.barre-b.barre) );
  return out;
}
/* The voicing the transport should sound: the selected card (clamped). Returns
   real MIDI (low->high) plus the pitch classes to light on the board. */
function currentChordVoicing(){
  const q=QUALITIES[chQual];
  const list=chordVoicings(gRoot, q.short, q.iv);
  if(!list.length){                                   // safety net: stacked from the root
    const base=48+gRoot, midis=q.iv.map(iv=>base+iv);
    return {midis, pcs:[...new Set(midis.map(m=>mod(m,12)))], list, idx:0};
  }
  const idx=Math.max(0, Math.min(chVoicing, list.length-1));
  const midis=voicingMidi(list[idx]);
  return {midis, pcs:[...new Set(midis.map(m=>mod(m,12)))], list, idx};
}
/* Generalized voicing generator — removes the need to hand-curate a shape for
   every quality. Given the chord's pitch classes, it scans 4-fret windows up
   the neck and, on each string, takes the lowest fret in the window that lands
   on a chord tone; it then mutes leading strings until the root sits in the
   bass. Scored for coverage, string count, compactness and low position. Every
   sounded note is a real chord tone by construction. Used only when no curated
   open/barre shape exists, and labelled as a computed voicing. */
function genVoicing(rootPc, ivs){
  const need=[...new Set(ivs.map(i=>mod(rootPc+i,12)))];
  let best=null, bestScore=-1e9;
  for(let base=0; base<=12; base++){
    const frets=[];                                   // index 0..5 = string6..string1 (low->high)
    for(let s=0;s<6;s++){
      const openPc=mod(STD_LOW6[s],12); let chosen=null;
      for(let f=Math.max(0,base); f<=base+3; f++){ if(need.includes(mod(openPc+f,12))){ chosen=f; break; } }
      frets.push(chosen);
    }
    // mute leading strings until the bass note is the root
    let lo=0; while(lo<6 && (frets[lo]==null || mod(STD_LOW6[lo]+frets[lo],12)!==rootPc)){ frets[lo]=null; lo++; }
    if(lo>=6) continue;                               // no root in the bass within this window
    const cov=new Set(); let count=0; const span=[];
    for(let s=0;s<6;s++){ if(frets[s]!=null){ cov.add(mod(STD_LOW6[s]+frets[s],12)); count++; if(frets[s]>0) span.push(frets[s]); } }
    if(count<3) continue;                              // too thin to be a useful chord
    const width=span.length?Math.max(...span)-Math.min(...span):0;
    if(width>4) continue;
    const missing=need.filter(pc=>!cov.has(pc)).length;
    const score=-missing*100 + count*8 - base*1.5 - width*2;
    if(score>bestScore){ bestScore=score; best={frets:frets.slice(), base}; }
  }
  if(!best) return null;
  const played=best.frets.filter(x=>x!=null&&x>0);
  return {frets:best.frets, barre:played.length?Math.min(...played):0, generated:true};
}
/* Draw one chord-box SVG. funcMap: pitch-class -> d-* class, so card dots are
   coloured by their role in the chord (root/third/fifth/seventh/extension),
   matching the fretboard. Each dot carries data-midi so a click sounds it. */
function chordBoxSVG(v, funcMap){
  const frets=v.frets;                      // low6 .. high1
  const played=frets.filter(x=>x!==null && x>0);
  const minF=played.length?Math.min(...played):0;
  const maxF=played.length?Math.max(...played):0;
  const baseFret = (maxF<=4 ? 1 : minF);
  const span=4, W=120, H=140, padX=16, padTop=26, padBot=18;
  const cols=6, rows=span;
  const gw=(W-padX*2)/(cols-1), gh=(H-padTop-padBot)/rows;
  const x=i=>padX+i*gw, y=r=>padTop+r*gh;
  let s=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  for(let r=0;r<=rows;r++){ const isNut=(baseFret===1 && r===0); s+=`<line class="${isNut?'cd-nut':'cd-fret'}" x1="${x(0)}" y1="${y(r)}" x2="${x(5)}" y2="${y(r)}"/>`; }
  for(let i=0;i<6;i++){ s+=`<line class="cd-string" x1="${x(i)}" y1="${y(0)}" x2="${x(i)}" y2="${y(rows)}"/>`; }
  if(baseFret>1){ s+=`<text class="cd-pos" x="${x(0)-9}" y="${y(0)+gh*0.7}" text-anchor="end">${baseFret}fr</text>`; }
  const fing=chordFingers(frets);
  frets.forEach((fr,li)=>{
    const sx=x(li);                          // low E at left
    const stringPc=mod(STD_LOW6[li],12);
    if(fr===null){ s+=`<text class="cd-mark" x="${sx}" y="${padTop-9}" text-anchor="middle">×</text>`; return; }
    if(fr===0){ s+=`<text class="cd-mark" x="${sx}" y="${padTop-9}" text-anchor="middle">○</text>`; return; }
    const r=fr-baseFret; if(r<0||r>=rows) return;
    const cy=y(r)+gh/2;
    const notePc=mod(stringPc+fr,12);
    const cls=funcMap[notePc] || 'd-fifth';
    const midi=STD_LOW6_MIDI[li]+fr;
    s+=`<circle class="cd-dot ${cls}" data-midi="${midi}" cx="${sx}" cy="${cy}" r="7.5"/>`;
    if(fing[li]) s+=`<text class="cd-fing" x="${sx}" y="${cy}" text-anchor="middle">${fing[li]}</text>`;
  });
  s+=`</svg>`; return s;
}
function voicingCaption(v){
  if(v.generated) return v.barre>0 ? `${t('cd_calc')} · ${t('cd_barre')} ${v.barre}` : t('cd_calc');
  if(v.shape==='open') return t('cd_open');
  const name = v.shape==='E' ? t('cd_eshape') : v.shape==='A' ? t('cd_ashape') : t('cd_barre');
  const tail = tuningIdx!==0 ? ` · ${t('cd_std')}` : '';
  return `${name} · ${v.barre}${t('cd_fret')}${tail}`;
}
function renderChordDiagram(){
  const cont=document.getElementById('ch-diagram');
  const q=QUALITIES[chQual], short=q.short;
  const funcMap={}; q.iv.forEach((iv,i)=>{ funcMap[mod(gRoot+iv,12)]=labClass(q.lab[i]); });
  const list=chordVoicings(gRoot, short, q.iv);
  if(!list.length){ cont.innerHTML=`<div class="chordbox"><div class="cb-name">${gRootLbl}${short}</div><div class="cb-cap">${t('cd_na')}</div></div>`; return; }
  if(chVoicing>list.length-1) chVoicing=0;             // clamp after a quality change
  cont.innerHTML = list.map((v,i)=>
    `<button type="button" class="chordbox${i===chVoicing?' sel':''}" data-v="${i}" aria-pressed="${i===chVoicing}">`+
    `<div class="cb-name">${gRootLbl}${short}</div>${chordBoxSVG(v, funcMap)}`+
    `<div class="cb-cap">${voicingCaption(v)}</div></button>`).join('');
}

