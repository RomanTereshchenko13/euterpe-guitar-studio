/* ===================== SCORED RUNS =====================
   The one scoring tier shared by the scored drills. It owns: the mic toggle (hidden
   where onset detection can't run), the HEARD times from 14-onset.js, turning heard vs
   expected into a latency-corrected score, and the panel, status line and toggle.

   The drill keeps what is drill-specific: which slots you are expected to play, the
   tolerance, and what the count row is called. Expected times come from the drill's
   own tick (mark(when)), because only the scheduler knows when a sound was actually
   scheduled — after swing, meter and any tempo change mid-run.

   Slot 13, before the slot-14 drills that use it: `const SC_*` would be in the TDZ
   for a drill touching it at load time. */

const SC_TOL_MAX = 0.12;    // s — past this a "hit" stops meaning the slot you aimed at
const SC_MAX_MARKS = 512;   // ring cap per run, so a long session can't grow without bound

/* The `extra` a scored drill hands recordSession: the run's mean absolute error in ms,
   or undefined when there is nothing honest to record — no mic tier, no hits, a run the
   self-hearing guard refused, or an uncalibrated run. Storing those would chart the
   app's own click, or a device change, as progress. */
function scoredErr(score){
  if(!score || !score.n || !isFinite(score.meanAbsMs)) return undefined;
  if(onsetSelfHeard(score)) return undefined;
  if(!calMeasured()) return undefined;
  return { err: score.meanAbsMs };
}

/* A scored-run controller for one drill.
     micId/statusId/scoreId — the drill's DOM ids
     tol()                  — half a slot, in seconds, from the drill's own clock
     countKey               — i18n key for the hit-count row
     onChange()             — repaint the drill (when we turn ourselves off) */
function scoredRun(cfg){
  const st = { on:false, live:false, grid:[], heard:[], off:null, score:null };

  function available(){ return onsetSupported(); }

  function status(key){
    const el = document.getElementById(cfg.statusId); if(!el) return;
    if(key) el.dataset.key = key; else delete el.dataset.key;
    el.textContent = key ? t(key) : '';
    el.hidden = !key;
  }

  /* Failure is never fatal: the drill drops back to the coach tier and says why. */
  function listen(){
    if(st.off) return;
    st.off = onOnset(when => { if(st.live && st.heard.length < SC_MAX_MARKS) st.heard.push(when); });
    onsetStart().then(r => {
      if(r.ok) return;
      st.on = false;
      unlisten();
      status(r.key);
      if(cfg.onChange) cfg.onChange();
    });
  }
  function unlisten(){
    if(st.off){ st.off(); st.off = null; }
    onsetStop();
  }

  /* a detected onset is late by the whole round trip: subtract it, or every player
     reads as dragging by the buffer size */
  function compute(){
    if(!st.on || !st.grid.length || !st.heard.length) return null;
    const offSec = calOffsetSec();
    const actual = st.heard.map(x => x - offSec);
    const tol = Math.min(cfg.tol ? cfg.tol() : SC_TOL_MAX, SC_TOL_MAX);
    return onsetScore(onsetMatch(st.grid, actual, tol));
  }

  function renderPanel(){
    const box = document.getElementById(cfg.scoreId); if(!box) return;
    const s = st.score;
    if(!s || !s.n){ box.hidden = true; return; }
    box.hidden = false;
    // a run scored against the app's own speakers is not a result (onsetSelfHeard)
    if(onsetSelfHeard(s)){
      box.innerHTML = `<div class="sc-verdict sc-warn">${t('on_selfheard')}</div>`;
      return;
    }
    /* Uncalibrated: calOffsetSec() is 0, which is not a latency but the absence of one,
       so every absolute reading is shifted by the audio stack. The spread survives an
       unknown CONSTANT offset (it is a difference between hits), so report that, name
       what can't be judged, and point at the measurement. */
    if(!calMeasured()){
      box.innerHTML = [
        `<div class="sc-main"><b>±${Math.round(s.spreadMs)}</b> <span>${t('on_ms')}</span></div>`,
        `<div class="sc-verdict">${t('on_evenness')}</div>`,
        `<div class="sc-row"><span>${t(cfg.countKey || 'on_played')}</span>` +
          `<b>${s.n}/${Math.round(s.n / Math.max(s.hitRate, 0.0001))}</b></div>`,
        `<div class="sc-verdict sc-warn">${t('on_needcal')}</div>`,
      ].join('');
      return;
    }
    const feel = onsetFeel(s);
    box.innerHTML = [
      `<div class="sc-main"><b>${Math.round(s.meanAbsMs)}</b> <span>${t('on_ms_off')}</span></div>`,
      `<div class="sc-verdict">${t(onsetVerdict(s))}${feel ? ' · ' + t(feel) : ''}</div>`,
      `<div class="sc-row"><span>${t('on_evenness')}</span><b>±${Math.round(s.spreadMs)} ${t('on_ms')}</b></div>`,
      `<div class="sc-row"><span>${t(cfg.countKey || 'on_played')}</span>` +
        `<b>${s.n}/${Math.round(s.n / Math.max(s.hitRate, 0.0001))}</b></div>`,
    ].join('');
  }

  return {
    on: () => st.on,
    available,
    /* switching tiers mid-run would change what a score in progress measures, so the
       drill stops first */
    /* switching the mic ON says what is still missing (calibration) before a note is
       played, not after a run has been spent */
    toggle(){
      st.on = !st.on; st.score = null;
      status(st.on && !calMeasured() ? 'on_needcal' : null);
      if(!st.on) unlisten();
    },
    setOn(v){ st.on = !!v; },
    /* called from the drill's play() */
    begin(){ st.grid = []; st.heard = []; st.score = null; st.live = true; if(st.on) listen(); },
    /* called from the drill's tick with the time it scheduled the sound for */
    mark(when){ if(st.on && st.live && st.grid.length < SC_MAX_MARKS) st.grid.push(when); },
    /* called from the drill's stop() — returns the score and keeps it for the panel */
    end(){ st.live = false; unlisten(); st.score = compute(); return st.score; },
    /* belt and braces on exit: never leave the mic open behind a closed drill */
    release(){ st.live = false; unlisten(); },
    score: () => st.score,
    clearScore(){ st.score = null; status(null); },
    /* The mic button is the drill header's; this paints its label and pressed state (only
       the running scoredRun knows if it is listening). Visibility is applyDrillCtx()'s,
       via the drill's mic(). */
    render(){
      const mb = document.getElementById(cfg.micId);
      if(mb){
        mb.textContent = t('on_listen');
        mb.classList.toggle('active', st.on);
        mb.setAttribute('aria-pressed', st.on ? 'true' : 'false');
      }
      renderPanel();
    },
    /* re-translate a message already on screen when the language flips */
    refreshLang(){
      const el = document.getElementById(cfg.statusId);
      if(el && !el.hidden && el.dataset.key) el.textContent = t(el.dataset.key);
    },
    // test seams — the harness drives a scored run with no microphone attached
    _set(grid, heard){ st.grid = grid.slice(); st.heard = heard.slice(); },
    _compute: compute,
  };
}
