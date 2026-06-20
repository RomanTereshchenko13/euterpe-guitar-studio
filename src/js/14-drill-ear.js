/* ===================== Drill: Ear training (Phase 4) =====================
   The EAR pillar: recognition by sound. Three multiple-choice drills sharing one
   engine — hear a prompt on the audio buses, pick the answer, get cue feedback,
   scored on accuracy and recorded to the learner model (13-learner.js):
     • interval — two notes played melodically; name the interval.
     • chordq   — a chord arpeggiated then strummed; name its quality.
     • rhythm   — a one-bar figure clicked out over a soft beat; pick the matching
                  rhythm (the time-axis mirror of interval training).

   Honest framing (roadmap): these are RECOGNITION drills — a multiple-choice
   answer, never a timing window — so they are legitimately scored on accuracy
   without breaking the "never score tap timing" rule (the rhythm is *identified*,
   not tapped back; a real play-it-back tier waits on Phase 8 onset detection).
   Each prompt writes one learner item (interval:P5 / chordq:m7 / rhythm:r3), so
   Ear feeds the SAME spaced-repetition model as the fretboard drills (spine #3):
   due items resurface first, the session score lands in the ring buffer, and the
   global progress card counts ear items alongside notes. Depends on nothing but
   the audio buses (pluck on `backing`, blips on `cue`) — no new engine. */

/* The twelve ascending intervals within an octave. `name` (m2…P8) is the compact,
   language-neutral button label + the stable id tail (interval:P5); en/uk carry the
   full name for the title/aria + the feedback line, inline like SCALES/QUALITIES so
   the i18n symmetry check only ever guards the I18N dict. */
const INTERVALS = [
  {st:1,  name:'m2', en:'Minor 2nd',   uk:'Мала секунда'},
  {st:2,  name:'M2', en:'Major 2nd',   uk:'Велика секунда'},
  {st:3,  name:'m3', en:'Minor 3rd',   uk:'Мала терція'},
  {st:4,  name:'M3', en:'Major 3rd',   uk:'Велика терція'},
  {st:5,  name:'P4', en:'Perfect 4th', uk:'Чиста кварта'},
  {st:6,  name:'TT', en:'Tritone',     uk:'Тритон'},
  {st:7,  name:'P5', en:'Perfect 5th', uk:'Чиста квінта'},
  {st:8,  name:'m6', en:'Minor 6th',   uk:'Мала секста'},
  {st:9,  name:'M6', en:'Major 6th',   uk:'Велика секста'},
  {st:10, name:'m7', en:'Minor 7th',   uk:'Мала септима'},
  {st:11, name:'M7', en:'Major 7th',   uk:'Велика септима'},
  {st:12, name:'P8', en:'Octave',      uk:'Октава'},
];
function earIvName(iv){ return lang==='en' ? iv.en : iv.uk; }

/* The chord qualities the ear drill recognizes: the four triads + four common
   sevenths, by index into QUALITIES (08-chords.js). The id uses the short symbol
   ('maj' for the empty major suffix) so it stays stable + readable. */
const EAR_QUAL_IDX = [0, 1, 10, 12, 6, 7, 8, 9];   // maj · m · dim · aug · 7 · maj7 · m7 · m7♭5
function earQualKey(qi){ const q=QUALITIES[qi]; return 'chordq:'+(q.short||'maj'); }

/* One-bar (4/4) rhythm figures, each a list of segments {d:beats, r:isRest}
   summing to 4. The visual strip (rhythmStrip) and the audio (playRhythm) both
   read this, so what you see matches what you hear. Distractors for a prompt are
   other patterns from this pool. */
function earRSeg(){ return [].slice.call(arguments).map(d => d<0 ? {d:-d, r:true} : {d, r:false}); }
const RHYTHMS = [
  {id:'r1', seg:earRSeg(1,1,1,1)},                 // ta ta ta ta
  {id:'r2', seg:earRSeg(0.5,0.5,1,1,1)},           // ti-ti ta ta ta
  {id:'r3', seg:earRSeg(1,0.5,0.5,1,1)},           // ta ti-ti ta ta
  {id:'r4', seg:earRSeg(0.5,0.5,0.5,0.5,1,1)},     // ti-ti ti-ti ta ta
  {id:'r5', seg:earRSeg(1.5,0.5,1,1)},             // dotted-quarter eighth, ta ta
  {id:'r6', seg:earRSeg(1,1,0.5,0.5,1)},           // ta ta ti-ti ta
  {id:'r7', seg:earRSeg(2,1,1)},                   // half ta ta
  {id:'r8', seg:earRSeg(1,-1,1,1)},                // ta (rest) ta ta
];
const EAR_RHYTHM_BPM = 84;
/* Play a rhythm: a soft beat-reference click on each of the four beats (so the
   metre is audible) with the figure's onsets struck louder on top. All on the cue
   bus, scheduled at absolute audio-clock times — short and one-shot, so it needs
   no scheduler clock. */
function playRhythm(r){
  const ctx=audio(); if(!ctx) return;
  const b=60/EAR_RHYTHM_BPM, start=ctx.currentTime+0.15;
  for(let k=0;k<4;k++) cueBlip(start+k*b, 620, 0.06, 0.035, 'sine');           // soft metre reference
  let pos=0;
  r.seg.forEach(s=>{ if(!s.r) cueBlip(start+pos*b, 1320, 0.26, Math.min(0.13, s.d*b*0.8), 'square'); pos+=s.d; });
}
function rhythmStrip(r){
  const segs=r.seg.map(s=>`<span class="rseg ${s.r?'rest':'note'}" style="flex:${s.d}"></span>`).join('');
  return `<span class="rhythm">${segs}</span>`;
}

/* per-type config: how a prompt is built, played, and answered. The engine below
   is type-agnostic — it just reads cfg.pool/make/play/choices/prompt. */
const EAR = {
  interval: {
    len:8, sess:'ear-interval', prompt:()=>t('ear_int_prompt'),
    pool:()=>INTERVALS.map(iv=>'interval:'+iv.name),
    make(key){ const iv=INTERVALS.find(x=>'interval:'+x.name===key); const base=48+Math.floor(Math.random()*13); return {key, iv, base}; },
    play(cur){ pluck(cur.base, 0, 1.5); pluck(cur.base+cur.iv.st, 0.6, 1.5); },                 // melodic, ascending
    choices(){ return INTERVALS.map(iv=>({ key:'interval:'+iv.name, html:iv.name, label:earIvName(iv) })); }
  },
  chordq: {
    len:8, sess:'ear-chordq', prompt:()=>t('ear_chord_prompt'),
    pool:()=>EAR_QUAL_IDX.map(earQualKey),
    make(key){ const qi=EAR_QUAL_IDX.find(i=>earQualKey(i)===key); const root=Math.floor(Math.random()*12); return {key, qi, root, base:48+root}; },
    play(cur){ const q=QUALITIES[cur.qi], n=q.iv.length;
      q.iv.forEach((iv,i)=>pluck(cur.base+iv, i*0.16, 1.6));                                    // arpeggio up
      q.iv.forEach(iv=>pluck(cur.base+iv, n*0.16+0.28, 1.9)); },                                // then the block
    choices(){ return EAR_QUAL_IDX.map(qi=>{ const q=QUALITIES[qi]; return { key:earQualKey(qi), html:(q.short||'maj'), label:qName(q) }; }); }
  },
  rhythm: {
    len:6, sess:'ear-rhythm', prompt:()=>t('ear_rhythm_prompt'),
    pool:()=>RHYTHMS.map(r=>'rhythm:'+r.id),
    make(key){ const ans=RHYTHMS.find(r=>'rhythm:'+r.id===key);
      const opts=earShuffle(earShuffle(RHYTHMS.filter(r=>r!==ans)).slice(0,3).concat([ans]));
      return {key, ans, choiceList:opts.map(r=>({ key:'rhythm:'+r.id, html:rhythmStrip(r), label:t('ear_rhythm') })) }; },
    play(cur){ playRhythm(cur.ans); },
    choices(cur){ return cur.choiceList; }
  }
};

let ear = null;
// ear = { type, cfg, queue:[itemKey…], total, done, correctPrompts, totalWrong,
//         startT, finished, cur, answered }

function earShuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const tmp=a[i]; a[i]=a[j]; a[j]=tmp; } return a; }
// SRS-weighted session queue: due items first (what you've missed resurfaces),
// then the rest, each block shuffled, capped at the drill's length. Mirrors the
// note drill's buildQueue (14-drill-notes.js).
function buildEarQueue(keys, len){
  const now=Date.now();
  const due=keys.filter(k=>((learner.items[k]||{due:0}).due)<=now);
  const rest=keys.filter(k=>due.indexOf(k)<0);
  return earShuffle(due).concat(earShuffle(rest)).slice(0, len);
}

function startEar(type){
  const cfg=EAR[type]; if(!cfg) return;
  ear={ type, cfg, queue:buildEarQueue(cfg.pool(), cfg.len), total:0, done:0, correctPrompts:0, totalWrong:0, startT:Date.now(), finished:false, cur:null, answered:false };
  ear.total=ear.queue.length;
  const home=document.getElementById('ear-home'), area=document.getElementById('ear-area'),
        act=document.getElementById('ear-active'), sum=document.getElementById('ear-summary');
  if(home) home.hidden=true; if(area) area.hidden=false; if(act) act.hidden=false; if(sum) sum.hidden=true;
  nextEarPrompt();
}
function exitEar(){
  ear=null;
  const home=document.getElementById('ear-home'), area=document.getElementById('ear-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderEar==='function') renderEar();
}
function nextEarPrompt(){
  if(!ear.queue.length){ finishEar(); return; }
  ear.answered=false;
  ear.cur=ear.cfg.make(ear.queue.shift());
  renderEarPrompt();
  earReplay();                 // auto-play the prompt (rides the start/Next click gesture)
}
function earReplay(){ if(ear && ear.cur){ audio(); ear.cfg.play(ear.cur); } }

// one answer (single guess): score, record to the learner, reveal the correct
// choice + a Next button. earNext advances; the last Next finishes the session.
function earAnswer(key){
  if(!ear || ear.finished || ear.answered) return;
  ear.answered=true;
  const correct = key===ear.cur.key;
  recordAttempt(ear.cur.key, correct);
  ear.done++; if(correct) ear.correctPrompts++; else ear.totalWrong++;
  playCue(correct?'correct':'wrong');
  renderEarAnswered(key, correct);
}
function earNext(){ if(!ear || !ear.answered) return; nextEarPrompt(); }
function finishEar(){
  ear.finished=true;
  const elapsed=Math.max(0, Math.round((Date.now()-ear.startT)/1000));
  const acc=ear.total ? ear.correctPrompts/ear.total : 0;
  recordSession(ear.cfg.sess, Math.round(acc*100));
  saveState();
  if(typeof renderEar==='function') renderEar();
  renderEarSummary(elapsed, acc);
}

// human label of the current correct answer, for the feedback line
function earAnswerLabel(){
  if(!ear || !ear.cur) return '';
  if(ear.type==='interval') return earIvName(ear.cur.iv);
  if(ear.type==='chordq')   return ROOTS[ear.cur.root]+' '+qName(QUALITIES[ear.cur.qi]);
  return '';
}

/* ---- DOM paint (no-ops cleanly when the panel isn't in the DOM, e.g. some tests) ---- */
// shared progress readout: the learner model's aggregate stats as chips, or an
// empty state until a drill writes the first attempt. Used by both the Practice
// home (#practice-progress) and the Ear home (#ear-progress) — one model (spine #3).
function renderProgressInto(hostId){
  const host=document.getElementById(hostId); if(!host) return;
  const s=learnerStats();
  if(!s.seen && !s.sessions){ host.innerHTML='<div class="pp-empty">'+t('prog_empty')+'</div>'; return; }
  const stat=(val,lab)=>'<div class="pp-stat"><div class="pp-val">'+val+'</div><div class="pp-lab">'+lab+'</div></div>';
  host.innerHTML='<div class="pp-stats">'+
    stat(s.items, t('prog_tracked'))+
    stat(Math.round(s.accuracy*100)+'%', t('prog_accuracy'))+
    stat(s.bestStreak, t('prog_streak'))+
    stat(s.sessions, t('prog_sessions'))+
  '</div>';
}
function renderEar(){ renderProgressInto('ear-progress'); }
function renderEarPrompt(){
  const p=document.getElementById('ear-prompt'); if(p) p.textContent=ear.cfg.prompt();
  const c=document.getElementById('ear-count'); if(c) c.textContent=Math.min(ear.done+1, ear.total)+' / '+ear.total;
  const rp=document.getElementById('ear-replay'); if(rp){ rp.innerHTML='&#9654; '+t('ear_replay'); rp.setAttribute('aria-label', t('ear_replay')); }
  const fb=document.getElementById('ear-feedback'); if(fb){ fb.textContent=''; fb.className='ear-feedback'; }
  const nx=document.getElementById('ear-next'); if(nx) nx.hidden=true;
  renderEarChoices();
}
function renderEarChoices(){
  const host=document.getElementById('ear-choices'); if(!host) return;
  const list=ear.cfg.choices(ear.cur);
  host.className='ear-choices ear-'+ear.type;
  host.innerHTML=list.map(o=>{
    const aria=o.label || o.html;
    return `<button type="button" class="btn ear-choice" data-key="${o.key}" aria-label="${aria}"${o.label?` title="${o.label}"`:''}>${o.html}</button>`;
  }).join('');
}
function renderEarAnswered(chosenKey, correct){
  const host=document.getElementById('ear-choices');
  if(host) host.querySelectorAll('.ear-choice').forEach(b=>{
    b.disabled=true;
    if(b.dataset.key===ear.cur.key) b.classList.add('correct');
    if(b.dataset.key===chosenKey && !correct) b.classList.add('wrong');
  });
  const fb=document.getElementById('ear-feedback');
  if(fb){ fb.textContent = correct ? t('ear_right') : (t('ear_wrong')+' · '+earAnswerLabel()); fb.className='ear-feedback '+(correct?'good':'bad'); }
  const nx=document.getElementById('ear-next');
  if(nx){ nx.hidden=false; nx.innerHTML = ear.queue.length ? (t('ear_next')+' &rarr;') : t('drill_done'); }
}
function renderEarSummary(elapsed, acc){
  const el=document.getElementById('ear-summary'); if(!el) return;
  const act=document.getElementById('ear-active'); if(act) act.hidden=true;
  const stat=(v,l)=>'<div class="pp-stat"><div class="pp-val">'+v+'</div><div class="pp-lab">'+l+'</div></div>';
  el.innerHTML='<div class="drill-done-title">'+t('drill_complete')+'</div>'+
    '<div class="pp-stats">'+
      stat(Math.round(acc*100)+'%', t('drill_score'))+
      stat(ear.correctPrompts+' / '+ear.total, t('ear_got'))+
      stat(elapsed+'s', t('drill_time'))+
    '</div>'+
    '<div class="drill-actions"><button class="btn play" id="ear-again"></button><button class="btn" id="ear-done"></button></div>';
  el.hidden=false;
  const type=ear.type;
  const ag=document.getElementById('ear-again'); if(ag){ ag.textContent=t('drill_again'); ag.onclick=()=>startEar(type); }
  const dn=document.getElementById('ear-done');  if(dn){ dn.textContent=t('drill_done');  dn.onclick=exitEar; }
}
// re-localize an in-flight prompt on a language switch (called from applyLang)
function refreshEarLang(){ if(ear && !ear.finished && !ear.answered) renderEarPrompt(); }

/* drill-card starters + the in-drill controls — wired once at load (guarded so a
   missing panel never throws, mirroring initDrill in 14-drill-notes.js). */
(function initEar(){
  const home=document.getElementById('ear-home'); if(!home) return;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('start-interval', ()=>startEar('interval'));
  wire('start-chordq',   ()=>startEar('chordq'));
  wire('start-rhythm',   ()=>startEar('rhythm'));
  wire('ear-quit',   exitEar);
  wire('ear-replay', earReplay);
  wire('ear-next',   earNext);
  const ch=document.getElementById('ear-choices');
  if(ch) ch.addEventListener('click', e=>{ const b=e.target.closest('.ear-choice'); if(b && !b.disabled) earAnswer(b.dataset.key); });
})();
