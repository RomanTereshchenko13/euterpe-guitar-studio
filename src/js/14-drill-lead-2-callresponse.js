/* ===================== Drill: Call & response (Phase 6c) =====================
   The Lead pillar's phrasing tier — motif call-and-response. The app plays a short
   lick (the CALL) from the current key's scale inside one neck box; you echo it back
   (the RESPONSE) by tapping the pitches in order. The turn structure itself teaches
   the core of soloing phrasing — LISTEN while it plays, then answer in the space it
   leaves — so "play vs. leave space" is baked into the loop, not a separate coach.

   Honest framing (roadmap): tap input, so it is scored on ACCURACY (did you echo the
   right pitches), never on timing — a re-tap of a wrong note just buzzes and you try
   again; the elapsed pace is not the score. Real "play it back on your guitar and get
   scored" waits on Phase 8/F2. Self-paced (no scheduler clock, no scoring window), so
   it needs no latency offset. A finished session records one accuracy score to the
   sessions ring buffer (13), minting no per-item SRS — like the other Lead/Rhythm
   coaches, the pinned item shape stays untouched.

   Reuses the shared board paint (renderBoard, 07) on its OWN board, the current scale
   context (SCALES[scIdx] rooted at gRoot, spine #1) inside a Phase-2 boxWindow, an
   in-drill key + position picker, pluck() for the call playback + correct echoes, and
   the cue bus (05) for right/wrong feedback. */

const CR_ROUNDS = 4;         // motifs per session
let crPos = 1;               // neck box (1–5, Phase 2 boxWindow); no "all" — a lick needs one shape
let cr = null;
// cr = { phase:'call'|'response'|'done', pool:[{si,f,midi}], motif:[poolIdx…], respIdx,
//        round, correct, total, wrongNote, timers:[], scaleName }

/* the scale-note positions of the current key inside the chosen box → the lick's palette */
function crPool(){
  const s=SCALES[scIdx], win=boxWindow(crPos)||[0,4], lo=win[0], hi=win[1];
  const scPcs=new Set(s.iv.map(iv=>mod(gRoot+iv,12))), pool=[];
  for(let si=0; si<6; si++) for(let f=lo; f<=hi; f++){ const midi=OPEN_MIDI[si]+f; if(scPcs.has(midi%12)) pool.push({si, f, midi}); }
  return pool;
}
/* a melodic motif of n notes: a stepwise walk through the box palette sorted by pitch,
   so consecutive notes are near neighbours (a phrase, not leaps). Returns pool indices. */
function crMakeMotif(pool, n){
  if(pool.length<2) return [0];
  const order=pool.map((p,i)=>i).sort((a,b)=>pool[a].midi-pool[b].midi);
  let cur=Math.floor(Math.random()*order.length); const motif=[order[cur]];
  for(let k=1;k<n;k++){ const step=[-2,-1,1,2][Math.floor(Math.random()*4)]; cur=Math.max(0, Math.min(order.length-1, cur+step)); motif.push(order[cur]); }
  return motif;
}
function crMotifLen(round){ return Math.min(3 + Math.floor(round/2), 5); }   // 3 → 5 as rounds pass

/* ---- lifecycle ---- */
function startCallResp(){
  cr={ phase:'call', pool:[], motif:[], respIdx:0, round:0, correct:0, total:0, wrongNote:0, timers:[], scaleName:'' };
  const home=document.getElementById('practice-home'), area=document.getElementById('cr-area');
  if(home) home.hidden=true; if(area) area.hidden=false;
  crRenderBoard();
  crNewRound();
}
function exitCallResp(){
  crClearTimers();
  cr=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('cr-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderPractice==='function') renderPractice();
}
function crClearTimers(){ if(cr){ cr.timers.forEach(clearTimeout); cr.timers=[]; } }

// build the round's motif and play the call. Growing length as rounds advance.
function crNewRound(){
  if(!cr) return;
  crClearTimers();
  cr.pool=crPool(); cr.scaleName=sName(SCALES[scIdx]);
  cr.motif=crMakeMotif(cr.pool, crMotifLen(cr.round));
  cr.phase='call'; cr.respIdx=0; cr.wrongNote=0;
  crPlayCall();
  renderCr();
}
// play the lick: pluck each note in turn + light its dot, then open the response window
function crPlayCall(){
  if(!cr) return;
  audio();
  crClearTimers();
  crClearMarks();
  const dur=0.44;
  cr.motif.forEach((pi,i)=>{
    const p=cr.pool[pi];
    pluck(p.midi, i*dur, dur*0.95);
    cr.timers.push(setTimeout(()=>crLightDot(p.si, p.f, 'call'), Math.round(i*dur*1000)));
    cr.timers.push(setTimeout(()=>crUnlight(p.si, p.f), Math.round((i*dur+dur*0.85)*1000)));
  });
  // after the last note + a breath, it's your turn
  cr.timers.push(setTimeout(()=>{ if(cr){ cr.phase='response'; cr.respIdx=0; cr.wrongNote=0; renderCr(); } }, Math.round((cr.motif.length*dur+0.35)*1000)));
}
function crReplay(){ if(cr && cr.phase!=='done') crPlayCall(); }

// one tap during the response. Correct next-in-order pitch → light + sound + advance;
// finishing the motif scores the round (clean = no wrong tap on any note) and moves on.
// A wrong pitch buzzes and you retry the same note (marks the note un-clean).
function crAnswer(si, f){
  if(!cr || cr.phase!=='response') return;
  const midi=OPEN_MIDI[si]+f, want=cr.pool[cr.motif[cr.respIdx]].midi;
  if(midi===want){
    crLightDot(si, f, 'hit'); pluck(midi);
    cr.total++; if(cr.wrongNote===0) cr.correct++;
    cr.respIdx++; cr.wrongNote=0;
    if(cr.respIdx>=cr.motif.length){ crFinishRound(); return; }
    renderCr();
  } else {
    cr.wrongNote++;
    crLightDot(si, f, 'miss');
    playCue('wrong');
  }
}
function crFinishRound(){
  if(!cr) return;
  playCue('correct');
  cr.round++;
  if(cr.round>=CR_ROUNDS){ crFinish(); return; }
  cr.timers.push(setTimeout(()=>{ if(cr) crNewRound(); }, 650));   // brief beat, then the next call
  cr.phase='call'; renderCr();
}
function crFinish(){
  if(!cr) return;
  cr.phase='done';
  const acc=cr.total ? cr.correct/cr.total : 0;
  recordSession('callresp:'+gRootLbl, Math.round(acc*100));
  saveState();
  if(typeof renderPractice==='function') renderPractice();
  crRenderSummary(acc);
}

/* ---- DOM paint (no-ops cleanly when the panel isn't in the DOM, e.g. some tests) ---- */
function crRenderBoard(){
  const el=document.getElementById('cr-board'); if(!el) return;
  renderBoard(el, (pc,si,f)=>{
    const d=document.createElement('div'); d.className='dot quiz';
    d.dataset.si=si; d.dataset.f=f; d.dataset.midi=OPEN_MIDI[si]+f; d.tabIndex=0; d.setAttribute('role','button');
    d.setAttribute('aria-label', SNAMES[si]+' '+f);
    return d;
  });
  renderNums(document.getElementById('cr-nums'));
}
function crClearMarks(){ document.querySelectorAll('#cr-board .dot.quiz').forEach(d=>{ d.classList.remove('hit','miss','call','target'); }); }
// during the response, dim-light the box palette so you see where the notes live
function crMarkPalette(){
  const on=cr && cr.phase==='response', box=new Set(cr?cr.pool.map(p=>p.si+':'+p.f):[]);
  document.querySelectorAll('#cr-board .dot.quiz').forEach(d=>d.classList.toggle('target', on && box.has(d.dataset.si+':'+d.dataset.f)));
}
function crLightDot(si, f, kind){
  const d=document.querySelector('#cr-board .dot.quiz[data-si="'+si+'"][data-f="'+f+'"]'); if(!d) return;
  if(kind==='miss'){ d.classList.add('miss'); setTimeout(()=>{ if(d) d.classList.remove('miss'); }, 420); return; }
  d.classList.add(kind); if(kind==='hit') rippleDot(d);
}
function crUnlight(si, f){ const d=document.querySelector('#cr-board .dot.quiz[data-si="'+si+'"][data-f="'+f+'"]'); if(d) d.classList.remove('call'); }
function crRenderSummary(acc){
  const el=document.getElementById('cr-summary'); if(!el) return;
  const act=document.getElementById('cr-active'); if(act) act.hidden=true;
  const stat=(v,l)=>'<div class="pp-stat"><div class="pp-val">'+v+'</div><div class="pp-lab">'+l+'</div></div>';
  el.innerHTML='<div class="drill-done-title">'+t('drill_complete')+'</div>'+
    '<div class="pp-stats">'+stat(Math.round(acc*100)+'%', t('drill_score'))+stat(cr.correct+' / '+cr.total, t('cr_echoed'))+stat(CR_ROUNDS, t('cr_rounds'))+'</div>'+
    '<div class="drill-actions"><button class="btn play" id="cr-again"></button><button class="btn" id="cr-done2"></button></div>';
  el.hidden=false;
  const ag=document.getElementById('cr-again'); if(ag){ ag.textContent=t('drill_again'); ag.onclick=startCallResp; }
  const dn=document.getElementById('cr-done2'); if(dn){ dn.textContent=t('drill_done'); dn.onclick=exitCallResp; }
}
function crRenderControls(){
  const keyc=document.getElementById('cr-key');
  if(keyc) buildRootBtns(keyc, gRoot, (pc,r)=>{ setKey(pc,r); if(cr) crNewRound(); });
  segButtons('cr-pos', ['1','2','3','4','5'].map(label=>({label})), crPos-1, i=>{ crPos=i+1; if(cr) crNewRound(); });
}
function crRenderStatus(){
  const st=document.getElementById('cr-status');
  if(st) st.textContent = cr.phase==='call' ? t('cr_listen') : cr.phase==='response' ? t('cr_your_turn') : '';
  const rl=document.getElementById('cr-round'); if(rl) rl.textContent=(Math.min(cr.round+1,CR_ROUNDS))+' / '+CR_ROUNDS;
  const sc=document.getElementById('cr-scale'); if(sc) sc.textContent=cr.scaleName;
}
function renderCr(){
  if(!cr) return;
  const act=document.getElementById('cr-active'), sum=document.getElementById('cr-summary');
  if(act) act.hidden = cr.phase==='done';
  if(sum) sum.hidden = cr.phase!=='done';
  if(cr.phase==='done') return;
  crRenderControls();
  crRenderStatus();
  crMarkPalette();
  const rb=document.getElementById('cr-replay'); if(rb){ rb.innerHTML='&#9654; '+t('cr_replay'); rb.disabled = cr.phase!=='response' && cr.phase!=='call'; }
  const hint=document.getElementById('cr-hint'); if(hint) hint.textContent=t('cr_hint');
}
// re-localize an in-flight call-response drill on a language switch (called from applyLang)
function refreshCallRespLang(){ if(cr) renderCr(); }

/* card starter + in-drill controls — wired once at load (guarded, mirroring initTarget). */
(function initCallResp(){
  const card=document.getElementById('start-callresp'); if(!card) return;
  card.onclick=startCallResp;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('cr-quit', exitCallResp);
  wire('cr-replay', crReplay);
  const b=document.getElementById('cr-board');
  if(b){
    const fire=d=>{ if(d) crAnswer(parseInt(d.dataset.si,10), parseInt(d.dataset.f,10)); };
    b.addEventListener('click', e=>fire(e.target.closest('.dot.quiz')));
    b.addEventListener('keydown', e=>{ if(e.key!=='Enter'&&e.key!==' ') return; const d=e.target.closest('.dot.quiz'); if(!d) return; e.preventDefault(); fire(d); });
  }
})();
