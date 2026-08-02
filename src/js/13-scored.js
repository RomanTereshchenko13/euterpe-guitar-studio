/* ===================== SCORED RUNS (Phase 8 / F1, shared) =====================
   One scoring tier, three drills. F1 shipped this machinery inside the subdivision
   coach (7a); the Rhythm pillar tiers (5b strum, 5c comp) need exactly the same
   five things, so it moved here rather than being pasted twice more — the same
   reason 13-mic.js exists once for three mic consumers.

   What a scored drill has to do, and what this owns:
     1. a mic toggle that flips coach → scored (and hides itself where onset
        detection can't run, instead of offering a control that can only fail),
     2. collect the EXPECTED times — the drill knows those; it calls mark(when)
        from its own tick with the time it scheduled the sound for,
     3. collect the HEARD times off 14-onset.js,
     4. turn the two into a score, latency-corrected,
     5. render the panel, the status line and the toggle.

   The drill keeps everything that is drill-specific: what counts as a slot you
   are expected to play, how wide the tolerance is, and what the count row is
   called ("played" for a grid, "changes" for a progression).

   WHY THE EXPECTED TIMES COME FROM THE DRILL'S TICK and not from a formula: the
   scheduler is the only place that knows when a sound was *actually* scheduled,
   after swing, meter and any mid-run tempo change. Recomputing it later would
   score the player against a grid the drill never played.

   Load slot 13, before the slot-14 drills that use it — same rule as the drill
   registry and the mic layer: function declarations hoist across the concatenated
   scope, but `const SC_*` would be in the temporal dead zone if a drill file
   loading earlier touched it at load time. */

const SC_TOL_MAX = 0.12;    // s — past this a "hit" stops meaning the slot you aimed at
const SC_MAX_MARKS = 512;   // ring cap per run, so a long session can't grow without bound

/* The `extra` a scored drill hands recordSession (Phase 10/B1): the run's mean
   absolute error in ms, or undefined when there is nothing honest to record — no
   mic tier, no hits, a run the self-hearing guard refused, or (Phase 10/A4) a run
   measured against a latency nobody has established. Recording a refused run's error
   would poison the trend with the app's own click, which is exactly the number
   onsetSelfHeard exists to keep off the screen — and an uncalibrated run poisons it
   just as effectively with the buffer size. Both are numbers the panel already
   declines to show; the stored history must decline them too, or B4's "45 ms → 28 ms"
   would be charting a device change as if it were progress. */
function scoredErr(score){
  if(!score || !score.n || !isFinite(score.meanAbsMs)) return undefined;
  if(typeof onsetSelfHeard==='function' && onsetSelfHeard(score)) return undefined;
  if(typeof calMeasured==='function' && !calMeasured()) return undefined;
  return { err: score.meanAbsMs };
}

/* Build a scored-run controller for one drill.
     micId/statusId/scoreId — the drill's three DOM ids
     tol()                  — half a slot, in seconds, from the drill's own clock
     countKey               — i18n key for the hit-count row
     onChange()             — repaint the drill (used when we turn ourselves off) */
function scoredRun(cfg){
  const st = { on:false, live:false, grid:[], heard:[], off:null, score:null };

  function available(){ return typeof onsetSupported === 'function' && onsetSupported(); }

  function status(key){
    const el = document.getElementById(cfg.statusId); if(!el) return;
    if(key) el.dataset.key = key; else delete el.dataset.key;
    el.textContent = key ? t(key) : '';
    el.hidden = !key;
  }

  /* Failure is never fatal: the drill drops back to the coach tier and says why,
     because a metronome that still works beats an error page. */
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
    if(typeof onsetStop === 'function') onsetStop();
  }

  /* Latency-corrected: a detected onset is late by the whole round trip, so
     subtract it before comparing to the scheduled times — otherwise every player
     on earth reads as dragging by the buffer size. */
  function compute(){
    if(!st.on || !st.grid.length || !st.heard.length) return null;
    const offSec = (typeof calOffsetSec === 'function') ? calOffsetSec() : 0;
    const actual = st.heard.map(x => x - offSec);
    const tol = Math.min(cfg.tol ? cfg.tol() : SC_TOL_MAX, SC_TOL_MAX);
    return onsetScore(onsetMatch(st.grid, actual, tol));
  }

  function renderPanel(){
    const box = document.getElementById(cfg.scoreId); if(!box) return;
    const s = st.score;
    if(!s || !s.n){ box.hidden = true; return; }
    box.hidden = false;
    // A run the app scored against its own speakers is not a result. Say that
    // instead of printing a flattering number — see onsetSelfHeard (14-onset.js).
    if(onsetSelfHeard(s)){
      box.innerHTML = `<div class="sc-verdict sc-warn">${t('on_selfheard')}</div>`;
      return;
    }
    /* Uncalibrated (Phase 10/A4). Until the round trip is measured, calOffsetSec() is
       0 — and 0 is not a latency, it is the absence of a measurement. Every absolute
       reading is therefore shifted by the whole audio stack, so "18 ms off · dragging"
       would be a statement about the buffer size wearing the player's name. That is
       the same lie onsetSelfHeard exists to refuse, arriving by a different road.
       What survives an unknown CONSTANT offset is the spread: evenness is a difference
       between hits, and shifting every hit by the same amount cannot change it. So
       report the half we can stand behind, name the half we can't, and point at the
       one action that unlocks it. */
    if(typeof calMeasured === 'function' && !calMeasured()){
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
    /* Toggling mid-run would change the tier under a score in progress, so the
       drill stops first and the next run is measured cleanly from its first tick. */
    /* Switching the mic ON is also where the funnel says what's still missing, before
       a note is played rather than after a run has been spent — telling someone their
       result can't be judged is worth much less than telling them beforehand. */
    toggle(){
      st.on = !st.on; st.score = null;
      status(st.on && typeof calMeasured === 'function' && !calMeasured() ? 'on_needcal' : null);
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
    render(){
      const mb = document.getElementById(cfg.micId);
      if(mb){
        mb.textContent = t('on_listen');
        mb.classList.toggle('active', st.on);
        mb.setAttribute('aria-pressed', st.on ? 'true' : 'false');
        mb.hidden = !available();
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
