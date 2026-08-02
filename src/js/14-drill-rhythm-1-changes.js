/* ===================== Drill: Chord-change fluency (Phase 5a) =====================
   The RHYTHM pillar's table-stakes coach tier — the famous "one-minute changes":
   pick a chord pair, the timer runs, and you switch between the two shapes as cleanly
   as you can, tapping the big counter on each clean change. At the end: changes made,
   changes per minute, and your personal best for that pair.

   Honest framing (roadmap): this is a COACH tier, not scored training — the app
   counts YOUR taps, it can't hear your guitar (mic scoring waits on Phase 8 / F1).
   That's no compromise here: counting yourself and beating your record IS the
   authentic form of this exercise, so the reward (a per-pair personal best) needs no
   mic. Reuses the chord diagrams (chordBoxSVG, 08), the cue bus for the count-in +
   a new-best fanfare (05), an optional metronome on its own scheduler clock
   (metroClick, 06), and the learner model's sessions ring buffer (13) — the best
   per pair is DERIVED by scanning sessions, so the pinned item shape is untouched. */

/* Classic open-chord change pairs, each [[pc,qi],[pc,qi]] (qi: 0=major, 1=minor).
   Only natural roots, so ROOTS[pc] labels stay clean (C/D/E/G/A). */
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

let cmDurIdx = 1;        // default 60 s
let cmPairIdx = 0;       // selected preset pair (in-session preference)
let cmClick = false;     // optional metronome reference during the run
let cmDrill = null;
// cmDrill = { phase:'setup'|'run'|'done', pairIdx, dur, count, remaining, startT,
//             finished, ticker, clock, cpm, best, newBest }

function cmChord(spec){ const [pc,qi]=spec, q=QUALITIES[qi]; return { pc, qi, q, short:q.short, lbl:ROOTS[pc]+q.short }; }
function cmPairName(i){ const p=CM_PAIRS[i]; return cmChord(p[0]).lbl+' ↔ '+cmChord(p[1]).lbl; }
function cmPairId(i){ const p=CM_PAIRS[i]; return 'changes:'+cmChord(p[0]).lbl+'-'+cmChord(p[1]).lbl; }   // stable session id

/* Personal best (max changes-per-minute) for a pair. This used to scan the sessions
   ring buffer by hand, which meant the best silently reset once 50 sessions across
   nine drills pushed this pair's runs off the end. Phase 10/B1 made the best a
   stored, per-id fact for exactly that reason — one helper, every track. */
function cmPairBest(i){
  const b=learnerBest(cmPairId(i));
  return b ? b.score : 0;
}

/* ---- lifecycle ---- */
function startChanges(){
  cmDrill={ phase:'setup', pairIdx:cmPairIdx, dur:CM_DURS[cmDurIdx] };
  const home=document.getElementById('practice-home'), area=document.getElementById('cm-area');
  if(home) home.hidden=true; if(area) area.hidden=false;
  renderCm();
}
function exitChanges(){
  cmStopClocks();
  cmDrill=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('cm-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderPractice==='function') renderPractice();
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
  recordSession(cmPairId(cmDrill.pairIdx), cpm);
  saveState();
  if(cmDrill.newBest) playCue('correct');
  if(typeof renderPractice==='function') renderPractice();
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
    if(typeof addClock==='function') addClock(cmDrill.clock);
  }
}
function cmStopClocks(){
  if(cmDrill && cmDrill.ticker){ clearInterval(cmDrill.ticker); cmDrill.ticker=null; }
  if(cmDrill && cmDrill.clock){ if(typeof removeClock==='function') removeClock(cmDrill.clock); cmDrill.clock=null; }
}
function cmCountdown(){
  if(!cmDrill || cmDrill.phase!=='run') return;
  cmDrill.remaining--;
  if(cmDrill.remaining<=0){ cmDrill.remaining=0; finishChanges(); return; }
  renderCmTime();
}
function cmFmtTime(s){ s=Math.max(0,s|0); const m=Math.floor(s/60), ss=s%60; return m+':'+(ss<10?'0':'')+ss; }

/* ---- DOM paint (no-ops cleanly when the panel isn't in the DOM, e.g. some tests) ---- */
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
}
function renderCmSetup(){
  if(!cmDrill) return;
  const pp=document.getElementById('cm-pairs');
  if(pp) pp.innerHTML=CM_PAIRS.map((p,i)=>`<button type="button" class="btn cm-pair${i===cmDrill.pairIdx?' active':''}" data-i="${i}" aria-pressed="${i===cmDrill.pairIdx}">${cmPairName(i)}</button>`).join('');
  const dd=document.getElementById('cm-durs');
  if(dd) dd.innerHTML=CM_DURS.map((d,i)=>`<button type="button" class="btn cm-dur${i===cmDurIdx?' active':''}" data-i="${i}" aria-pressed="${i===cmDurIdx}">${d}${t('cm_sec')}</button>`).join('');
  const ck=document.getElementById('cm-click');
  if(ck){ ck.classList.toggle('active', cmClick); ck.setAttribute('aria-pressed', cmClick?'true':'false'); ck.innerHTML='&#9833; '+t('cm_click'); }
  const bl=document.getElementById('cm-setup-best');
  if(bl){ const b=cmPairBest(cmDrill.pairIdx); bl.textContent = b>0 ? (t('cm_best')+' · '+b+' '+t('cm_cpm').toLowerCase()) : ''; }
  const sb=document.getElementById('cm-start-btn'); if(sb) sb.innerHTML='&#9654; '+t('cm_start');
}
function cmChordBox(c){
  const q=c.q, funcMap={};
  q.iv.forEach((iv,i)=>{ funcMap[mod(c.pc+iv,12)]=labClass(q.lab[i]); });
  const list=chordVoicings(c.pc, c.short, q.iv), v=list[0];
  return `<div class="cm-chordname">${c.lbl}</div>${v?chordBoxSVG(v, funcMap):''}`;
}
function renderCmActive(){
  if(!cmDrill) return;
  const p=CM_PAIRS[cmDrill.pairIdx];
  const a=document.getElementById('cm-chord-a'), b=document.getElementById('cm-chord-b');
  if(a) a.innerHTML=cmChordBox(cmChord(p[0]));
  if(b) b.innerHTML=cmChordBox(cmChord(p[1]));
  renderCmTime(); renderCmCount();
  const sub=document.getElementById('cm-sub'); if(sub) sub.textContent=t('cm_tap_hint');
  const ut=document.getElementById('cm-untap'); if(ut) ut.innerHTML='&minus; '+t('cm_undo');
  const st=document.getElementById('cm-stop'); if(st) st.textContent=t('cm_stop');
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
  const dn=document.getElementById('cm-done');  if(dn){ dn.textContent=t('drill_done'); dn.onclick=exitChanges; }
}
// re-localize an in-flight changes drill on a language switch (called from applyLang)
function refreshChangesLang(){ if(cmDrill) renderCm(); }

/* card starter + in-drill controls — wired once at load (guarded so a missing panel
   never throws, mirroring initDrill / initEar). */
registerDrill({ id:'changes', area:'cm-area', tempo:true,   // the optional beat-reference click rides pulseSec()
                tracks:[{ id:'changes', kind:'perf', sess:'changes', label:'drill_changes',
                          better:'high', unit:'cpm', start:startChanges }],
                isActive:()=>!!cmDrill, exit:exitChanges, refreshLang:refreshChangesLang });

(function initChanges(){
  const card=document.getElementById('start-changes'); if(!card) return;
  card.onclick=startChanges;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('cm-start-btn', cmBegin);
  wire('cm-stop',      finishChanges);   // finish early
  wire('cm-tally',     cmTap);
  wire('cm-untap',     cmUntap);
  wire('cm-click',     ()=>{ cmClick=!cmClick; renderCmSetup(); });
  const pp=document.getElementById('cm-pairs');
  if(pp) pp.addEventListener('click', e=>{ const btn=e.target.closest('.cm-pair'); if(btn){ cmPairIdx=+btn.dataset.i; if(cmDrill) cmDrill.pairIdx=cmPairIdx; renderCmSetup(); } });
  const dd=document.getElementById('cm-durs');
  if(dd) dd.addEventListener('click', e=>{ const btn=e.target.closest('.cm-dur'); if(btn){ cmDurIdx=+btn.dataset.i; if(cmDrill) cmDrill.dur=CM_DURS[cmDurIdx]; renderCmSetup(); } });
})();
