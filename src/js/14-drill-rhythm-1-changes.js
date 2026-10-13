/* ===================== Drill: Chord-change fluency =====================
   One-minute changes: pick a chord pair — a classic open pair, or your own, any root and
   quality, so barre chords too — the timer runs, switch between the shapes as
   cleanly as you can and tap the counter on each clean change. At the end: changes,
   changes per minute, and your best for that pair. It counts your taps, not your guitar
   — and counting yourself to beat your record is the exercise. */

/* Classic open-chord pairs, [[pc,qi],[pc,qi]] (qi 0 = major, 1 = minor); natural roots
   only, so the labels stay clean. */
const CM_PAIRS = [
  [[9,0],[2,0]],   // A  – D
  [[9,0],[4,0]],   // A  – E
  [[2,0],[4,0]],   // D  – E
  [[0,0],[7,0]],   // C  – G
  [[7,0],[4,1]],   // G  – Em
  [[4,1],[9,1]],   // Em – Am
  [[0,0],[9,1]],   // C  – Am
  [[7,0],[2,0]],   // G  – D
  [[9,1],[2,1]],   // Am – Dm
  [[2,0],[7,0]],   // D  – G
];
const CM_DURS = [30, 60, 90];   // selectable session lengths (seconds)
/* the qualities your own pair can use, by QUALITIES index: maj · m · 7 · maj7 · m7 · sus2 · sus4 */
const CM_QUALS = [0, 1, 6, 7, 8, 2, 3];

let cmDurIdx = 1;        // default 60 s
let cmPairIdx = 0;       // selected pair; -1 = your own (cmCustom)
let cmCustom = [[5,0],[10,0]];   // your pair, [[pc,qi],[pc,qi]] (persisted) — F – B♭: two barres
let cmClick = false;     // optional metronome reference during the run
let cmDrill = null;
// cmDrill = { phase:'setup'|'run'|'done', pairIdx, dur, count, remaining, startT,
//             finished, ticker, clock, cpm, best, newBest }

/* `lbl` is ASCII ('Bbm'), as session ids need; noteTxt() it for display. A root spelled
   in a key (a progression's) can be passed in. */
function cmChord(spec, root){ const [pc,qi]=spec, q=QUALITIES[qi]; return { pc, qi, q, short:q.short, lbl:(root||ROOTS[pc])+q.short }; }
function cmPair(i){ return i<0 ? cmCustom : CM_PAIRS[i]; }
function cmPairName(i){ const p=cmPair(i); return noteTxt(cmChord(p[0]).lbl)+' ↔ '+noteTxt(cmChord(p[1]).lbl); }
function cmPairId(i){ const p=cmPair(i); return 'changes:'+cmChord(p[0]).lbl+'-'+cmChord(p[1]).lbl; }   // stable session id

/* The best changes-per-minute for a pair: a stored per-id best, so it outlives the
   history it came from. */
function cmPairBest(i){
  const b=learnerBest(cmPairId(i));
  return b ? b.score : 0;
}

/* ---- lifecycle ---- */
function beginChanges(){
  cmDrill={ phase:'setup', pairIdx:cmPairIdx, dur:CM_DURS[cmDurIdx] };
  renderCm();
}
function endChanges(){
  cmStopClocks();
  cmDrill=null;
}
function cmBegin(){
  if(!cmDrill) return;
  cmStopClocks();   // safety when re-running from the summary
  cmDrill.phase='run'; cmDrill.pairIdx=cmPairIdx; cmDrill.dur=CM_DURS[cmDurIdx];
  cmDrill.count=0; cmDrill.remaining=cmDrill.dur; cmDrill.startT=Date.now();
  cmDrill.finished=false; cmDrill.cpm=0; cmDrill.newBest=false; cmDrill.best=cmPairBest(cmDrill.pairIdx);
  cmCountIn(); cmStartClocks(); renderCm();
}
function cmTap(){
  if(!cmDrill || cmDrill.phase!=='run') return;
  cmDrill.count++; renderCmCount();
  const el=document.getElementById('cm-tally'); if(el){ el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}
function cmUntap(){ if(!cmDrill || cmDrill.phase!=='run' || cmDrill.count<=0) return; cmDrill.count--; renderCmCount(); }
function finishChanges(){
  if(!cmDrill) return;
  cmStopClocks();
  cmDrill.phase='done'; cmDrill.finished=true;
  const cpm=Math.round(cmDrill.count / (cmDrill.dur/60));
  const prevBest=cmPairBest(cmDrill.pairIdx);
  cmDrill.cpm=cpm; cmDrill.newBest = cpm>0 && cpm>prevBest; cmDrill.best=Math.max(prevBest, cpm);
  drillRecord(cmPairId(cmDrill.pairIdx), cpm);
  if(cmDrill.newBest) playCue('correct');
  renderCm();
}

/* ---- count-in + clocks (audio + the countdown ticker) ---- */
function cmCountIn(){
  const ctx=audio(); if(!ctx) return;
  const b=beat(), start=ctx.currentTime+0.05;
  for(let k=0;k<4;k++) cueBlip(start+k*b, k===3?1500:1100, 0.22, 0.05, 'square');   // "1-2-3-go"
}
function cmStartClocks(){
  cmDrill.ticker=setInterval(cmCountdown, 1000);
  if(cmClick){ audio();
    cmDrill.clock={ interval:()=>beat(), tick:(time,count)=>metroClick(time, count%4===0) };
    addClock(cmDrill.clock);
  }
}
function cmStopClocks(){
  if(cmDrill && cmDrill.ticker){ clearInterval(cmDrill.ticker); cmDrill.ticker=null; }
  if(cmDrill && cmDrill.clock){ removeClock(cmDrill.clock); cmDrill.clock=null; }
}
function cmCountdown(){
  if(!cmDrill || cmDrill.phase!=='run') return;
  cmDrill.remaining--;
  if(cmDrill.remaining<=0){ cmDrill.remaining=0; finishChanges(); return; }
  renderCmTime();
}
function cmFmtTime(s){ s=Math.max(0,s|0); const m=Math.floor(s/60), ss=s%60; return m+':'+(ss<10?'0':'')+ss; }

/* ---- DOM paint ---- */
function renderCm(){
  if(!cmDrill) return;
  const setup=document.getElementById('cm-setup'), active=document.getElementById('cm-active'), sum=document.getElementById('cm-summary');
  if(!setup || !active || !sum) return;
  setup.hidden = cmDrill.phase!=='setup';
  active.hidden = cmDrill.phase!=='run';
  sum.hidden = cmDrill.phase!=='done';
  if(cmDrill.phase==='setup') renderCmSetup();
  else if(cmDrill.phase==='run') renderCmActive();
  else renderCmSummary();
  applyDrillCtx();     // the strip's ▶ is Start, or Finish while the clock runs
}
function renderCmSetup(){
  if(!cmDrill) return;
  const pp=document.getElementById('cm-pairs');
  if(pp) pp.innerHTML=CM_PAIRS.map((p,i)=>`<button type="button" class="btn cm-pair${i===cmDrill.pairIdx?' active':''}" data-i="${i}" aria-pressed="${i===cmDrill.pairIdx}">${cmPairName(i)}</button>`).join('')+
    `<button type="button" class="btn cm-pair${cmDrill.pairIdx<0?' active':''}" data-i="-1" aria-pressed="${cmDrill.pairIdx<0}">${t('cm_yours')}</button>`;
  // your own pair: a root and a quality for each chord
  const cu=document.getElementById('cm-custom');
  if(cu){
    cu.hidden = cmDrill.pairIdx>=0;
    if(cmDrill.pairIdx<0) cu.innerHTML=cmCustom.map(([pc,qi],k)=>
      `<select class="cm-sel" data-k="${k}" data-part="pc" aria-label="${t('lbl_root')} ${k+1}">`+
        ROOTS.map(r=>{ const p=FLAT_ROOTS[r]!==undefined?FLAT_ROOTS[r]:NOTES.indexOf(r); return `<option value="${p}"${p===pc?' selected':''}>${noteTxt(r)}</option>`; }).join('')+'</select>'+
      `<select class="cm-sel" data-k="${k}" data-part="qi" aria-label="${t('lbl_quality')} ${k+1}">`+
        CM_QUALS.map(i=>`<option value="${i}"${i===qi?' selected':''}>${QUALITIES[i].short||'maj'}</option>`).join('')+'</select>'
    ).join('<span class="cm-swap" aria-hidden="true">↔</span>');
  }
  const dd=document.getElementById('cm-durs');
  if(dd) dd.innerHTML=CM_DURS.map((d,i)=>`<button type="button" class="btn cm-dur${i===cmDurIdx?' active':''}" data-i="${i}" aria-pressed="${i===cmDurIdx}">${d}${t('cm_sec')}</button>`).join('');
  const ck=document.getElementById('cm-click');
  if(ck){ ck.classList.toggle('active', cmClick); ck.setAttribute('aria-pressed', cmClick?'true':'false'); ck.innerHTML='&#9833; '+t('cm_click'); }
  const bl=document.getElementById('cm-setup-best');
  if(bl){ const b=cmPairBest(cmDrill.pairIdx); bl.textContent = b>0 ? (t('cm_best')+' · '+b+' '+t('cm_cpm').toLowerCase()) : ''; }
}
function cmChordBox(c){
  const q=c.q, funcMap={};
  q.iv.forEach((iv,i)=>{ funcMap[mod(c.pc+iv,12)]=labClass(q.lab[i]); });
  const list=chordVoicings(c.pc, c.short, q.iv), v=list[0];
  return `<div class="cm-chordname">${noteTxt(c.lbl)}</div>${v?chordBoxSVG(v, funcMap):''}`;
}
function renderCmActive(){
  if(!cmDrill) return;
  const p=cmPair(cmDrill.pairIdx);
  const a=document.getElementById('cm-chord-a'), b=document.getElementById('cm-chord-b');
  if(a) a.innerHTML=cmChordBox(cmChord(p[0]));
  if(b) b.innerHTML=cmChordBox(cmChord(p[1]));
  renderCmTime(); renderCmCount();
  const sub=document.getElementById('cm-sub'); if(sub) sub.textContent=t('cm_tap_hint');
  const ut=document.getElementById('cm-untap'); if(ut) ut.innerHTML='&minus; '+t('cm_undo');
}
function renderCmTime(){ const tm=document.getElementById('cm-timer'); if(tm && cmDrill) tm.textContent=cmFmtTime(cmDrill.remaining); }
function renderCmCount(){
  const c=document.getElementById('cm-count-val'); if(c && cmDrill) c.textContent=cmDrill.count;
  const lab=document.getElementById('cm-count-lab'); if(lab) lab.textContent=t('cm_changes');
}
function renderCmSummary(){
  const el=document.getElementById('cm-summary'); if(!el || !cmDrill) return;
  const stat=(v,l)=>'<div class="pp-stat"><div class="pp-val">'+v+'</div><div class="pp-lab">'+l+'</div></div>';
  const title = cmDrill.newBest ? t('cm_newbest') : t('drill_complete');
  el.innerHTML='<div class="drill-done-title">'+title+'</div>'+
    '<div class="pp-stats">'+
      stat(cmDrill.count, t('cm_changes'))+
      stat(cmDrill.cpm, t('cm_cpm'))+
      stat(cmDrill.best, t('cm_best'))+
      stat(cmDrill.dur+t('cm_sec'), t('drill_time'))+
    '</div>'+
    '<div class="drill-actions"><button class="btn play" id="cm-again"></button><button class="btn" id="cm-done"></button></div>';
  const ag=document.getElementById('cm-again'); if(ag){ ag.innerHTML='&#9654; '+t('drill_again'); ag.onclick=cmBegin; }
  const dn=document.getElementById('cm-done');  if(dn){ dn.textContent=t('drill_done'); dn.onclick=()=>drillDone(); }
}
// re-localize an in-flight drill on a language switch
function refreshChangesLang(){ if(cmDrill) renderCm(); }

/* in-drill controls, wired once at load */
registerDrill({ id:'changes', area:'cm-area', tempo:true,   // the optional click rides pulseSec()
                // ▶ starts the clock (or a fresh run from the summary); ■ finishes early
                play:()=>{ if(cmDrill && cmDrill.phase==='run') finishChanges(); else cmBegin(); },
                playing:()=>!!(cmDrill && cmDrill.phase==='run'),
                playKey:()=>(cmDrill && cmDrill.phase==='run') ? 'cm_stop' : 'cm_start',
                // the one coach track: it counts YOUR taps, not your guitar
                tracks:[{ id:'changes', kind:'perf', sess:'changes', label:'drill_changes',
                          better:'high', unit:'cpm' }],
                begin:beginChanges, end:endChanges, isActive:()=>!!cmDrill, refreshLang:refreshChangesLang });

(function initChanges(){
  const area=document.getElementById('cm-area'); if(!area) return;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('cm-tally',     cmTap);
  wire('cm-untap',     cmUntap);
  wire('cm-click',     ()=>{ cmClick=!cmClick; renderCmSetup(); });
  const pp=document.getElementById('cm-pairs');
  if(pp) pp.addEventListener('click', e=>{ const btn=e.target.closest('.cm-pair'); if(btn){ cmPairIdx=+btn.dataset.i; if(cmDrill) cmDrill.pairIdx=cmPairIdx; renderCmSetup(); } });
  const cu=document.getElementById('cm-custom');
  if(cu) cu.addEventListener('change', e=>{ const s=e.target.closest('.cm-sel'); if(!s) return;
    const k=+s.dataset.k, v=+s.value;
    if(s.dataset.part==='pc' && v>=0 && v<12) cmCustom[k][0]=v;
    if(s.dataset.part==='qi' && CM_QUALS.includes(v)) cmCustom[k][1]=v;
    cmCustom=cmCustom.map(x=>x.slice()); renderCmSetup(); saveState(); });
  const dd=document.getElementById('cm-durs');
  if(dd) dd.addEventListener('click', e=>{ const btn=e.target.closest('.cm-dur'); if(btn){ cmDurIdx=+btn.dataset.i; if(cmDrill) cmDrill.dur=CM_DURS[cmDurIdx]; renderCmSetup(); } });
})();
