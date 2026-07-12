/* ===================== Drill: Groove & feel (Phase 5d) =====================
   A feel LAB: loop a one-bar groove (swung hats + kick/snare backbeat + bass + a
   down-up guitar comp) over the context chord (spine #1) and toggle the things that
   make a groove FEEL right — swing (straight → shuffle), a backbeat accent, and
   palm-mute dynamics — hearing each change live and playing along. Reuses the drum/
   bass primitives (hatHit/kickHit/snareHit/bassNote, 06) and pluckAt (05) for a
   mute-able strum, all on one 8th-note scheduler clock with swing baked into the
   off-beats. Coach tier — no timing score (Phase 8/F1); a practiced run records a
   session (bars grooved), minting no per-item SRS.

   NOTE (5d, deferred): the roadmap's "sound win" — CC0 drum one-shots + a room
   convolution IR, base64-inlined — is a separate asset task (needs license-verified
   public-domain audio) and is not part of this synthesized coach. */
const GF_SWINGS = [
  { id:'straight', amt:0,    en:'Straight', uk:'Рівно' },
  { id:'swing',    amt:0.20, en:'Swing',    uk:'Свінг' },
  { id:'shuffle',  amt:0.33, en:'Shuffle',  uk:'Шафл' },
];
function gfSwingName(s){ return lang==='en'?s.en:s.uk; }

let gfSwing=1;          // index into GF_SWINGS (default light swing)
let gfAccent=true;      // backbeat (2 & 4) accent
let gfMute=false;       // palm-mute the guitar comp
let gfDrill=null;
// gfDrill = { playing, clock, cycles, slot }

/* a strum that can be palm-muted (short, chunky) or open (ringing) — pluckAt lets us
   set per-note duration, which strumMidi (05) doesn't expose. */
function gfStrum(midis, when, vel, dir, muted){
  if(!midis.length) return;
  const order = dir<0 ? midis.slice().reverse() : midis.slice();
  const spread = muted?0.012:0.02, dur = muted?0.14:1.6;
  order.forEach((m,i)=>{ const tt=when + i*spread + (Math.random()*0.004-0.002); pluckAt(m, tt, dur, Math.max(0.25, vel - i*0.012)); });
}
function startGroove(){
  gfDrill={ playing:false, clock:null, cycles:0, slot:-1 };
  const home=document.getElementById('practice-home'), area=document.getElementById('gf-area');
  if(home) home.hidden=true; if(area) area.hidden=false;
  renderGroove();
}
function exitGroove(){
  grooveStop();
  gfDrill=null;
  const home=document.getElementById('practice-home'), area=document.getElementById('gf-area');
  if(area) area.hidden=true; if(home) home.hidden=false;
  if(typeof renderPractice==='function') renderPractice();
}
function grooveToggle(){ if(gfDrill && gfDrill.playing) grooveStop(); else groovePlay(); }
function groovePlay(){
  if(!gfDrill || gfDrill.playing) return;
  audio();
  if(typeof stopLoop==='function') stopLoop();
  if(typeof seqStop==='function') seqStop();
  gfDrill.playing=true; gfDrill.cycles=0; gfDrill.slot=-1;
  gfDrill.clock={ interval:()=>beat()/2, tick:(time,count)=>grooveTick(time,count) };
  if(typeof addClock==='function') addClock(gfDrill.clock);
  renderGroove();
}
function grooveStop(){
  if(!gfDrill || !gfDrill.playing) return;
  if(gfDrill.clock){ if(typeof removeClock==='function') removeClock(gfDrill.clock); gfDrill.clock=null; }
  if(typeof clearVisualQ==='function') clearVisualQ();
  gfDrill.playing=false; gfDrill.slot=-1;
  if(gfDrill.cycles>=1){ recordSession('groove:'+GF_SWINGS[gfSwing].id, gfDrill.cycles); saveState(); if(typeof renderPractice==='function') renderPractice(); }
  renderGroove();
}
function grooveTick(when, count){
  if(!gfDrill) return;
  const b=beat(), half=b/2, slot=count%8;
  if(slot===0 && count>0) gfDrill.cycles++;
  gfDrill.slot=slot;
  const swDelay = (slot%2===1) ? GF_SWINGS[gfSwing].amt*half : 0;   // delay off-beats for swing
  const midis = currentChordVoicing().midis, beatPos = slot%2===0;
  // drums: hats every 8th (swung off-beats, downbeat accent), kick 1&3, snare 2&4
  hatHit(when+swDelay, slot===0 ? 1 : (beatPos ? 0.7 : 0.45));
  if(slot===0) kickHit(when, 1);
  if(slot===4) kickHit(when, 0.9);
  if(slot===2 || slot===6) snareHit(when, gfAccent ? 1.0 : 0.8);    // backbeat
  // bass: root on beat 1, fifth on beat 3
  if(slot===0) bassNote(when, 36+gRoot, b*1.9, 0.95);
  if(slot===4) bassNote(when, 36+gRoot+fifthInterval(chQual), b*1.7, 0.8);
  // guitar comp: down on beats, up on off-beats; backbeat accent louder on 2 & 4
  let vel = beatPos ? 0.85 : 0.6;
  if(gfAccent && (slot===2 || slot===6)) vel += 0.12;
  gfStrum(midis, when+swDelay, vel, beatPos ? +1 : -1, gfMute);
  if(beatPos) enqueueVisual(when, ()=>gfPulseBeat(slot/2));
}

/* ---- DOM paint ---- */
function renderGroove(){
  if(!gfDrill) return;
  const keyc=document.getElementById('gf-key');
  if(keyc) buildRootBtns(keyc, gRoot, (pc,r)=>{ setKey(pc,r); renderGroove(); });
  const sw=document.getElementById('gf-swings');
  if(sw) sw.innerHTML=GF_SWINGS.map((s,i)=>`<button type="button" class="btn gf-swing${i===gfSwing?' active':''}" data-i="${i}" aria-pressed="${i===gfSwing}">${gfSwingName(s)}</button>`).join('');
  const ac=document.getElementById('gf-accent'); if(ac){ ac.textContent=t('gf_accent'); ac.classList.toggle('active', gfAccent); ac.setAttribute('aria-pressed', gfAccent?'true':'false'); }
  const mu=document.getElementById('gf-mute'); if(mu){ mu.textContent=t('gf_mute'); mu.classList.toggle('active', gfMute); mu.setAttribute('aria-pressed', gfMute?'true':'false'); }
  const beats=document.getElementById('gf-beats');
  if(beats) beats.innerHTML=[0,1,2,3].map(k=>`<span class="co-beat${(gfAccent&&(k===1||k===3))?' accent':''}" data-k="${k}"></span>`).join('');
  const ch=document.getElementById('gf-chord'); if(ch) ch.textContent=t('sp_chord')+' · '+gRootLbl+QUALITIES[chQual].short;
  const pb=document.getElementById('gf-play'); if(pb){ pb.innerHTML=(gfDrill.playing?'&#9632; ':'&#9654; ')+t(gfDrill.playing?'sp_stop':'sp_play'); pb.classList.toggle('active', gfDrill.playing); pb.setAttribute('aria-pressed', gfDrill.playing?'true':'false'); }
  const hint=document.getElementById('gf-hint'); if(hint) hint.textContent=t('gf_hint');
}
function gfPulseBeat(k){
  document.querySelectorAll('#gf-beats .co-beat').forEach(d=>d.classList.toggle('on', +d.dataset.k===k));
}
// re-localize an in-flight groove drill on a language switch (called from applyLang)
function refreshGrooveLang(){ if(gfDrill) renderGroove(); }

(function initGroove(){
  const card=document.getElementById('start-groove'); if(!card) return;
  card.onclick=startGroove;
  const wire=(id,fn)=>{ const el=document.getElementById(id); if(el) el.onclick=fn; };
  wire('gf-quit',   exitGroove);
  wire('gf-play',   grooveToggle);
  wire('gf-accent', ()=>{ gfAccent=!gfAccent; renderGroove(); });
  wire('gf-mute',   ()=>{ gfMute=!gfMute; renderGroove(); });
  const sw=document.getElementById('gf-swings');
  if(sw) sw.addEventListener('click', e=>{ const btn=e.target.closest('.gf-swing'); if(btn){ gfSwing=+btn.dataset.i; renderGroove(); } });
})();
