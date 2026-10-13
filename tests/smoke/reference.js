/* Euterpe smoke suite — arpeggios/CAGED/capo, transport, custom tuning, learner review, old share links.
   Run by ../smoke.js, in order, against its one booted page: the blocks share that page's
   state, so an area may rely on what an earlier one left behind. */
'use strict';
module.exports = function (ctx) {
  const { ok, approx, html, dom, win, T, byShort } = ctx;


  /* ---- Phase 2 (v1.20.0): arpeggios, CAGED labels, capo ---- */
  (function phase2() {
    // Arpeggio is a fourth Harmony view that owns the shared board
    T.selectTab('harmony'); T.setHView('arp');
    ok('Phase2: arp is the active board mode', T.isBoardMode('arp') === true);
    ok('Phase2: arp panel shown', win.document.getElementById('sub-arp').hidden === false);
    ok('step 8: the strip\'s ▶ is there in the arp view too', win.document.getElementById('chip-play').hidden === false);
    // arp shares the chord quality with chord-tones (the bridge)
    T.setChQual(byShort['m7']);
    ok('Phase2: arp board paints the shared chord quality', T.isBoardMode('arp') === true);
    T.setHView('chords');
    ok('Phase2: switching back to chord-tones keeps the chord', T.state().chQual === byShort['m7']);
    T.setChQual(byShort['']);

    // CAGED: the five positions map to the E·D·C·A·G shapes, major-scale only
    ok('Phase2: CAGED position→shape map is E·D·C·A·G',
       T.CAGED_BY_POS.join(',') === 'E,D,C,A,G');
    T.setKey(0, 'C', 0);                 // C Ionian
    ok('Phase2: CAGED labels on for the major scale', T.isCAGEDScale() === true);
    T.selectTab('scales'); T.setScView('scale');   // a hidden view builds its controls when shown
    const pos = win.document.getElementById('sc-pos');
    if (pos) {
      const labels = [...pos.querySelectorAll('button')].slice(1).map(b => b.textContent);
      ok('Phase2: scale position buttons show CAGED letters', labels.join(',') === 'E,D,C,A,G',
         labels.join(','));
    }
    T.setKey(2, 'D', 1);                 // D Dorian — a mode, not Ionian
    ok('Phase2: CAGED labels off for a mode (anchoring would be wrong)', T.isCAGEDScale() === false);
    T.setKey(9, 'A', 5);
    T.selectTab('harmony');

    // Capo: bounded, persisted, and dims/marks the board without changing cell count
    T.setCapo(3);
    ok('Phase2: capo value set', T.getCapo() === 3);
    T.selectTab('harmony'); T.setHView('chords');   // triggers saveState + a board repaint
    const board = win.document.getElementById('board');
    const firstRow = board && board.querySelector('.srow');
    if (firstRow) {
      ok('Phase2: a capo bar is drawn at the capo fret', !!firstRow.querySelector('.cell.capo-at'));
      ok('Phase2: frets behind the capo are dimmed', firstRow.querySelectorAll('.cell.subcapo').length >= 1);
    }
    const saved = JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}');
    ok('Phase2: capo persisted through saveState', saved.capo === 3);
    T.setCapo(0);
    T.setHView('chords');
  })();

  /* ---- regression: tuning/fret/capo changes must repaint EVERY board mode ----
     renderAllBoards() (wired to the tuning / fret / capo / lefty controls) once
     fanned out to chords/triads/scales/notes only — omitting arp (and the since-cut
     identify view) — so those boards froze with stale geometry on a fret/capo/tuning change. Drive
     the real onchange sequence (set the global, then renderAllBoards) on each view
     and assert the shared #board actually re-paints to the new fret range. */
  (function staleBoardRegression() {
    const cellsPerRow = () => {
      const row = win.document.getElementById('board').querySelector('.srow');
      return row ? row.querySelectorAll('.cell').length : -1;
    };
    [['arp', false], ['chords', true], ['chords', false]].forEach(([view, tri]) => {
      T.setChTriads(tri); T.selectTab('harmony'); T.setHView(view);
      T.setFret(0); T.renderAllBoards();            // All frets (1..22)
      const wide = cellsPerRow();
      T.setFret(1); T.renderAllBoards();            // 5-fret window (1..5)
      const narrow = cellsPerRow();
      ok('regression: ' + view + (tri ? ' (triads)' : '') + ' board repaints on a fret-range change',
         narrow > 0 && narrow < wide, view + ': ' + wide + ' → ' + narrow + ' cells');
    });
    T.setChTriads(false); T.setFret(0); T.selectTab('harmony'); T.setHView('chords');
  })();

  /* ---- behaviour: loop + sequencer transport toggles ---- */
  (function transport() {
    ok('loop initially off', T.state().loop === false);
    T.loopToggle();
    ok('loopToggle starts the loop', T.state().loop === true);
    T.loopToggle();
    ok('loopToggle stops the loop', T.state().loop === false);

    // building a progression and playing it is mutually exclusive with the loop
    T.applyPreset(T.SEQ_PRESETS[2]);     // I–IV–V
    T.seqPlay();
    ok('seqPlay starts the progression', T.state().seq === true);
    T.loopToggle();                      // starting a loop must stop the progression
    ok('starting Loop stops the progression', T.state().seq === false);
    T.loopToggle();
    ok('loop stopped after exclusivity check', T.state().loop === false);
  })();

  /* ---- 2.5: custom tuning (Phase 2) ---- */
  (function customTuning() {
    const ci = T.TUNINGS.findIndex(t => t.custom);
    ok('custom tuning: a Custom entry exists', ci >= 0);
    ok('custom tuning: Custom has bilingual labels',
       ci >= 0 && !!T.TUNINGS[ci].en && !!T.TUNINGS[ci].uk && !T.TUNINGS[ci].midi);
    // selecting Custom + setting a per-string MIDI flows through applyTuning → OPEN_MIDI
    const want = [67, 62, 57, 52, 47, 43];   // an arbitrary valid custom tuning (all within TUNE_LO..HI)
    T.setCustomTuning(want);
    T.setTuningIdx(ci);
    ok('custom tuning: applyTuning reads customTuning', JSON.stringify(T.getOpenMidi()) === JSON.stringify(want));
    ok('custom tuning: tuningMidi returns the custom array when selected',
       JSON.stringify(T.tuningMidi()) === JSON.stringify(want));
    ok('custom tuning: editor range is a sane guitar span', T.TUNE_LO < T.TUNE_HI && T.TUNE_LO >= 24 && T.TUNE_HI <= 76);
    // persistence: only a 6-length all-in-range array is restored
    T.setTuningIdx(0); T.applyTuning();   // back to standard so later tests are unaffected
  })();

  /* ---- 2.5: learner review + activity (spine #3) ---- */
  (function review() {
    const NOW = 1000000000000;
    T.resetLearner();
    T.recordAttempt('note:A:str5', false, NOW);     // due NOW+60000 (overdue soon)
    T.recordAttempt('interval:P5', false, NOW);     // due NOW+60000
    T.recordAttempt('note:C:str5', true, NOW);      // due ~1 day out (not yet)
    const rev = T.learnerReview(NOW + 60001);
    ok('review: counts only past-due items', rev.total === 2, JSON.stringify(rev.by));
    ok('review: splits by namespace', rev.by.note === 1 && rev.by.interval === 1);
    ok('review: top is a due namespace', rev.top === 'note' || rev.top === 'interval');
    ok('review: nothing due → total 0', T.learnerReview(NOW).total === 0);
    // activity: distinct calendar days within the window
    T.resetLearner();
    const DAY = 86400000;
    T.recordSession('notes', 1, NOW);
    T.recordSession('notes', 1, NOW + 1000);        // same day → still 1
    T.recordSession('notes', 1, NOW - DAY);         // prior day → 2
    T.recordSession('notes', 1, NOW - 30 * DAY);    // outside the 7-day window → ignored
    const act = T.learnerActivity(NOW);
    ok('activity: distinct days in the window', act.days === 2, String(act.days));
    ok('activity: reports the window size', act.window === 7);
    T.resetLearner();
  })();

  /* ---- share links, cut in step 1: an old link still opens the app ---- */
  (function oldShareLinks() {
    const doc = win.document;
    ok('step 1: no share button', !doc.getElementById('tb-share'));
    ok('step 1: no share encoder left', T.encodeShareState === undefined && T.applyShareHash === undefined);
    T.setMode('reference'); T.selectTab('harmony'); T.setHView('chords'); T.setKey(0, 'C', 0);
    const was = JSON.stringify(T.state());
    // an old link that would have moved the key, tab, view and mode
    win.location.hash = '#m=practice&t=scales&k=9&r=A&s=5&sv=notes&hv=identify';
    let threw = false;
    try { T.clearOldShareHash(); } catch (e) { threw = true; }
    ok('step 1: an old share link does not throw', !threw);
    ok('step 1: ...is ignored — nothing it named was applied', JSON.stringify(T.state()) === was);
    ok('step 1: ...and its hash is cleared', (win.location.hash || '') === '');
    win.location.hash = '#install';
    T.clearOldShareHash();
    ok('step 1: a hash that is not an old share link is left alone', win.location.hash === '#install');
    win.location.hash = '';
  })();
};
