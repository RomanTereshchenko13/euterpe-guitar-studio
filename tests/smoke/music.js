/* Euterpe smoke suite — musical correctness (voicings, spelling, the diatonic source), the scheduler, the responsive board, triads, the drill lifecycle, key ≠ chord.
   Run by ../smoke.js, in order, against its one booted page: the blocks share that page's
   state, so an area may rely on what an earlier one left behind. */
'use strict';
module.exports = function (ctx) {
  const { ok, approx, html, dom, win, T, byShort } = ctx;


  /* ---- Accessibility + onboarding (Phase 9 feel pass) ---- */
  (function(){
    const body = win.document.body;
    // the two toggles flip the body classes the CSS keys off (palette + dot shapes)
    T.setCbPalette(true); T.setFnShapes(true); T.applyA11y();
    ok('a11y: cb-palette body class applied', body.classList.contains('cb-palette'));
    ok('a11y: fn-shapes body class applied', body.classList.contains('fn-shapes'));
    const pBtn = win.document.getElementById('tb-cbpalette');
    ok('a11y: palette toggle present + reflects pressed state',
       !!pBtn && pBtn.getAttribute('aria-pressed') === 'true');
    T.setCbPalette(false); T.setFnShapes(false); T.applyA11y();
    ok('a11y: toggles off clear both body classes',
       !body.classList.contains('cb-palette') && !body.classList.contains('fn-shapes'));
    // onboarding: showWelcome reveals the card; dismiss hides it AND records welcomeSeen
    const ov = win.document.getElementById('welcome-overlay');
    ok('onboarding: welcome overlay present in DOM', !!ov);
    T.setWelcomeSeen(false); T.showWelcome();
    ok('onboarding: showWelcome reveals the card', !!ov && ov.hidden === false);
    T.dismissWelcome();
    ok('onboarding: dismiss hides the card + records seen',
       !!ov && ov.hidden === true && T.getA11y().welcomeSeen === true);
  })();

  /* ---- musical correctness: voicing fifths incl. ♭5 / ♯5 (Phase C bass) ---- */
  const fifthCases = [
    ['',     7], ['m',    7], ['7',    7], ['maj7', 7], ['11', 7],
    ['dim',  6], ['dim7', 6], ['m7♭5', 6],
    ['aug',  8]
  ];
  fifthCases.forEach(([sh, expect]) => {
    ok('fifthInterval(' + (sh || 'maj') + ') = ' + expect,
       byShort[sh] !== undefined && T.fifthInterval(byShort[sh]) === expect,
       'got ' + (byShort[sh] !== undefined ? T.fifthInterval(byShort[sh]) : 'no such quality'));
  });
  // and fifthInterval must always equal the interval the degree map points at
  T.QUALITIES.forEach((q, i) => {
    const k = q.deg.indexOf(5);
    const expected = k >= 0 ? q.iv[k] : 7;
    ok('fifthInterval consistent with deg map: ' + (q.short || 'maj'),
       T.fifthInterval(i) === expected);
  });

  /* ---- musical correctness: degree-based note spelling ---- */
  const spellCases = [
    // [root, pitch-class, degree, expected]
    ['A', 0, 3, 'C'],     // A minor third → C (natural), not B♯
    ['C', 4, 3, 'E'],     // C major third → E
    ['C', 10, 7, 'B♭'],   // C dominant 7th → B♭
    ['C', 11, 7, 'B'],    // C major 7th → B
    ['E', 11, 5, 'B'],    // E fifth → B
    ['B', 6, 5, 'F♯'],    // B fifth → F♯ (not G♭)
    ['G', 5, 7, 'F'],     // G ♭7 → F
    ['D', 5, 3, 'F'],     // D minor third → F
  ];
  spellCases.forEach(([root, pc, deg, exp]) => {
    const got = T.spellNote(root, pc, deg);
    ok('spellNote(' + root + ', pc' + pc + ', deg' + deg + ') = ' + exp, got === exp, 'got ' + got);
  });

  /* ---- musical correctness: scale interval ordering ---- */
  T.SCALES.forEach((s, i) => {
    const iv = s.iv;
    let ascending = true, inRange = true, unique = true;
    const seen = {};
    for (let j = 0; j < iv.length; j++) {
      if (iv[j] < 0 || iv[j] > 11) inRange = false;
      if (j > 0 && iv[j] <= iv[j - 1]) ascending = false;
      if (seen[iv[j]]) unique = false; seen[iv[j]] = true;
    }
    ok('scale ' + (s.en || i) + ' starts on root (0)', iv[0] === 0);
    ok('scale ' + (s.en || i) + ' strictly ascending', ascending);
    ok('scale ' + (s.en || i) + ' within one octave [0,11]', inRange);
    ok('scale ' + (s.en || i) + ' has unique degrees', unique);
  });

  /* ---- 1a: one diatonic source (dedup parity) ----
     The single diatonicTriads() helper must reproduce BOTH pre-1a
     implementations (diatonic() and buildDia()) before the duplicate is gone.
     We inline the old quality logic here as the parity reference. */
  (function diatonicDedup() {
    function oldDiatonic(t3, t5) {                  // from scales' diatonic()
      if (t3 === 4 && t5 === 7) return { suf: '', iv: [0, 4, 7] };
      if (t3 === 3 && t5 === 7) return { suf: 'm', iv: [0, 3, 7] };
      if (t3 === 3 && t5 === 6) return { suf: 'dim', iv: [0, 3, 6] };
      if (t3 === 4 && t5 === 8) return { suf: 'aug', iv: [0, 4, 8] };
      return { suf: '?', iv: [0, t3, t5] };
    }
    function oldBuildDiaSuf(t3, t5) {               // from circle's buildDia()
      if (t3 === 3 && t5 === 7) return 'm';
      if (t3 === 3 && t5 === 6) return 'dim';
      if (t3 === 4 && t5 === 8) return 'aug';
      return '';
    }
    let diaParity = true, buildParity = true;
    const roots = [0, 5, 9];                        // quality is root-invariant; spot-check a few
    T.SCALES.forEach(s => {
      if (s.iv.length !== 7) return;
      roots.forEach(root => {
        const got = T.diatonicTriads(root, s.iv);
        for (let d = 0; d < 7; d++) {
          const r = s.iv[d], th = s.iv[(d + 2) % 7], fi = s.iv[(d + 4) % 7];
          const t3 = ((th - r) % 12 + 12) % 12, t5 = ((fi - r) % 12 + 12) % 12;
          const od = oldDiatonic(t3, t5);
          if (got[d].suf !== od.suf || got[d].iv.join(',') !== od.iv.join(',')) diaParity = false;
          if (got[d].rootPc !== (root + r) % 12) diaParity = false;
          // buildDia agrees on every triad it actually produced (m/dim/aug/maj);
          // its only divergence was the dead non-tertian fallback ('' vs '?').
          if (od.suf !== '?' && got[d].suf !== oldBuildDiaSuf(t3, t5)) buildParity = false;
        }
      });
    });
    ok('1a: diatonicTriads reproduces old diatonic() quality + iv', diaParity);
    ok('1a: diatonicTriads reproduces old buildDia() suffixes', buildParity);
  })();

  /* ---- 1a: one musical context (root + mode); circle is a projection ---- */
  (function oneContext() {
    T.setKey(7, 'G', 0);                            // G major (Ionian)
    ok('1a: setKey sets the key, and brings the chord to its tonic', T.state().keyRoot === 7 && T.state().keyLbl === 'G' && T.state().chRoot === 7 && T.state().chLbl === 'G');
    ok('1a: setKey sets the mode (scIdx)', T.state().scIdx === 0);
    ok('1a: Ionian → circle major ring', T.ctxCofMinor() === false && T.isMajorFamily(0) === true);
    ok('1a: circle node tracks the major root', T.COF[T.ctxCofSel()].majPc === 7);

    T.setKey(9, 'A', 5);                            // A minor (Aeolian)
    ok('1a: Aeolian → circle minor ring', T.ctxCofMinor() === true && T.isMajorFamily(5) === false);
    ok('1a: circle node tracks the relative-minor root', T.COF[T.ctxCofSel()].minPc === 9);

    // context round-trips through localStorage; the derived circle state is not stored
    const saved = JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}');
    ok('1a: saved state carries the context root', saved.gRoot === 9 && saved.gRootLbl === 'A');
    ok('1a: saved state carries the mode (scIdx)', saved.scIdx === 5);
    ok('1a: derived circle selection is not persisted',
       saved.cofSel === undefined && saved.cofMinor === undefined);
  })();

  /* ---- 1c: the scale suggester (the chord identifier was cut in step 1) ---- */
  (function reverseLookup() {
    ok('step 1: Identify is gone — no view, no button, no helper',
       !win.document.getElementById('sub-identify') && !win.document.getElementById('hv-identify')
       && T.identifyChord === undefined);
    // scales that fit a chord
    const idxByName = {}; T.SCALES.forEach((s, i) => { idxByName[s.en] = i; });
    const fit = T.scalesOverChord(0, [0, 4, 7, 11]);   // Cmaj7
    ok('1c: Cmaj7 fits C Ionian', fit.indexOf(idxByName['Major (Ionian)']) >= 0);
    ok('1c: Cmaj7 fits C Lydian', fit.indexOf(idxByName['Lydian']) >= 0);
    ok('1c: Cmaj7 does NOT fit C natural minor', fit.indexOf(idxByName['Aeolian (natural minor)']) < 0);

    // the live suggester follows the chord
    T.selectTab('harmony'); T.setHView('chords'); T.setKey(0, 'C'); T.setChQual(0); T.setHView('chords');
    ok('1c: suggester names the chord on screen',
       /C/.test(win.document.querySelector('#suggest-body .sug-chord').textContent));
    ok('1c: suggester offers scale chips for the chord',
       win.document.getElementById('suggest-body').querySelectorAll('[data-scale]').length > 0);
  })();

  /* ---- Phase A: equal-temperament tuning target ---- */
  const f = m => 440 * Math.pow(2, (m - 69) / 12);
  ok('tuning: A4 (midi 69) = 440 Hz', approx(f(69), 440, 1e-6));
  ok('tuning: A2 (midi 45) = 110 Hz', approx(f(45), 110, 1e-6));
  ok('tuning: E2 (midi 40) ≈ 82.41 Hz', approx(f(40), 82.4069, 1e-3));
  ok('tuning: octave doubles frequency', approx(f(69), 2 * f(57), 1e-6));

  /* ---- Phase B: lookahead scheduler lands on the grid ---- */
  (function schedulerGrid() {
    T.initAudio();                        // construct the stubbed context so actx is live
    const ctx = win.__AC.__ctx;
    ctx.currentTime = 0;
    const interval = 0.5;                 // pretend bar/beat interval (s)
    const fired = [];
    const clock = { count: 0, next: ctx.currentTime + 0.06, interval: () => interval,
                    tick: (when) => fired.push(when) };
    T.clocks.add(clock);
    // advance the audio clock in 25 ms steps across ~2 s and drain the lookahead
    for (let tms = 0; tms <= 2000; tms += 25) { ctx.currentTime = tms / 1000; T.schedAdvance(); }
    T.clocks.delete(clock);
    ok('scheduler queued events', fired.length >= 3, 'only ' + fired.length + ' events');
    // successive scheduled times differ by exactly the interval (no drift)
    let onGrid = true;
    for (let j = 1; j < fired.length; j++) {
      if (!approx(fired[j] - fired[j - 1], interval, 1e-9)) onGrid = false;
    }
    ok('scheduler events are exactly one interval apart (no drift)', onGrid);
    // every event is scheduled ahead of the clock time it was queued at
    ok('scheduler events scheduled in the future (lookahead)', fired.every(x => x >= 0));
  })();

  /* ---- Phase C+: responsive fretboard math ---- */
  (function responsive() {
    const widths = [360, 390, 414];
    // windowed 5-fret range that includes the open-string column (FRET_RANGES[1] = 1..5)
    T.setFret(1);
    ok('windowed range shows open-string column (leftFixed = 67)', T.leftFixed() === 67);
    widths.forEach(w => {
      try { Object.defineProperty(win, 'innerWidth', { value: w, configurable: true }); }
      catch (e) { win.innerWidth = w; }
      const bw = T.boardWidth();
      ok('no horizontal overflow @' + w + 'px (windowed)', bw <= w, 'boardWidth ' + bw + ' > ' + w);
      // cells stay above the readable floor
      ok('fret cell ≥ floor @' + w + 'px', T.cellW() >= 34, 'cellW ' + T.cellW());
    });
    // "All frets" (FRET_RANGES[0] = 1..22) is allowed to exceed the viewport → scroller fallback
    T.setFret(0);
    try { Object.defineProperty(win, 'innerWidth', { value: 360, configurable: true }); }
    catch (e) { win.innerWidth = 360; }
    ok('All-frets view exceeds 360px (uses scroll fallback)', T.boardWidth() > 360);
    // alignment: number of fret cells equals number of fret-number entries on the active board
    T.setFret(1);
    T.selectTab && T.selectTab('harmony'); T.setHView && T.setHView('chords');
    const board = win.document.getElementById('board');
    const nums = win.document.getElementById('nums');
    if (board && nums) {
      const firstRow = board.querySelector('.srow');
      const cells = firstRow ? firstRow.querySelectorAll('.cell').length : -1;
      const fnums = nums.querySelectorAll('.fretnum').length;
      ok('fret cells per row == fret numbers (dot alignment)', cells === fnums,
         cells + ' cells vs ' + fnums + ' numbers');
      ok('open-string column rendered (.ocell present)',
         !!(firstRow && firstRow.querySelector('.ocell')));
    } else {
      ok('board + numbers elements exist for alignment check', false);
    }
  })();

  /* ---- behaviour: the one ▶ on every reference view + scales sub-views (1b) ---- */
  (function loopVisibility() {
    const play = () => win.document.getElementById('chip-play');
    T.selectTab('harmony'); T.setHView('chords');
    ok('step 8: ▶ on chord tones', play().hidden === false);
    T.setChTriads(true); T.setHView('chords');
    ok('step 8: ...with triads on', play().hidden === false);
    T.setChTriads(false); T.setHView('chords');
    T.selectTab('scales'); T.setScView('scale');
    ok('step 8: ...on the scales tab', play().hidden === false);
    // 1b: Notes is now a view inside Scales, not a tab
    T.setScView('notes');
    ok('1b: scale controls hidden in notes view', win.document.getElementById('sub-scale').hidden === true);
    ok('1b: notes controls shown in notes view', win.document.getElementById('sub-notes').hidden === false);
    ok('1b: board shows notes mode in notes view', T.isBoardMode('notes') === true);
    ok('step 8: ...and in the notes view', play().hidden === false);
    T.setScView('scale');
    ok('1b: back to scale view restores scale board', T.isBoardMode('scale') === true);
    T.selectTab('harmony'); T.setHView('chords');
  })();

  /* ---- v1.12.0: alternate chord voicings (data + playback model) ---- */
  (function voicings() {
    const pcOf = m => ((m % 12) + 12) % 12;
    const pcsOf = v => T.voicingMidi(v).map(pcOf);
    const chordPcs = (root, iv) => new Set(iv.map(i => ((root + i) % 12 + 12) % 12));
    // [label, root, short]
    const cases = [
      ['C',  0, ''], ['F', 5, ''], ['A', 9, ''], ['E', 4, ''],
      ['G7', 7, '7'], ['Dm', 2, 'm'], ['Bdim', 11, 'dim'],
    ];
    cases.forEach(([lbl, root, short]) => {
      const qi = byShort[short]; const iv = T.QUALITIES[qi].iv;
      const list = T.chordVoicings(root, short, iv);
      ok('voicings(' + lbl + ') non-empty', list.length >= 1, 'got ' + list.length);
      const want = chordPcs(root, iv);
      // every sounded note is a real chord tone
      let allTones = true;
      list.forEach(v => pcsOf(v).forEach(pc => { if (!want.has(pc)) allTones = false; }));
      ok('voicings(' + lbl + ') sound only chord tones', allTones);
      // dedupe: no two voicings share an identical fret array
      const keys = list.map(v => v.frets.map(f => f == null ? 'x' : f).join(','));
      ok('voicings(' + lbl + ') deduped', new Set(keys).size === keys.length);
      // barre-shape roots land on the right string
      list.forEach(v => {
        if (v.shape === 'E') {
          ok('voicings(' + lbl + ') E-shape root on string 6',
             v.frets[0] != null && pcOf(T.STD_LOW6_MIDI[0] + v.frets[0]) === root);
        }
        if (v.shape === 'A') {
          ok('voicings(' + lbl + ') A-shape root on string 5',
             v.frets[0] == null && v.frets[1] != null && pcOf(T.STD_LOW6_MIDI[1] + v.frets[1]) === root);
        }
      });
    });
    // C major should offer the canonical CAGED-lite set: an open + both barres
    const cMaj = T.chordVoicings(0, '', T.QUALITIES[byShort['']].iv);
    ok('C major offers an open voicing', cMaj.some(v => v.shape === 'open'));
    ok('C major offers an E-shape barre', cMaj.some(v => v.shape === 'E'));
    ok('C major offers an A-shape barre', cMaj.some(v => v.shape === 'A'));
    ok('C major voicings ≥ 3', cMaj.length >= 3, 'got ' + cMaj.length);
    // extended chords keep a single computed voicing (no canonical CAGED set)
    if (byShort['13'] !== undefined) {
      const c13 = T.chordVoicings(0, '13', T.QUALITIES[byShort['13']].iv);
      ok('extended chord (13) keeps one computed voicing',
         c13.length === 1 && (c13[0].shape === 'computed' || c13[0].generated));
    }
    // selecting a card changes what Listen/Loop will sound
    T.selectTab('harmony'); T.setHView('chords');
    T.setChQual(byShort['']);            // C major-ish, 3 voicings
    T.setChVoicing(0);
    const v0 = T.currentChordVoicing();
    ok('currentChordVoicing tracks selection idx 0', v0.idx === 0);
    if (v0.list.length > 1) {
      T.setChVoicing(1);
      const v1 = T.currentChordVoicing();
      ok('currentChordVoicing tracks selection idx 1', v1.idx === 1);
      ok('selected voicings differ in register/notes',
         v1.midis.join(',') !== v0.midis.join(','));
    }
    T.setChVoicing(0);
  })();

  /* ---- triads: Chord tones with chTriads on (step 1), one of the lens's three views
     since step 11; shape playback + loop parity ---- */
  (function triadParity() {
    const doc = win.document;
    ok('step 1: no Triads panel of its own', !doc.getElementById('sub-triads'));
    T.selectTab('harmony'); T.setHView('chords'); T.setChQual(0);
    T.setChTriads(false); T.setHView('chords');
    ok('step 11: Harmony\'s views are one switch: Chord tones · Triads · Arpeggio',
       [...doc.querySelectorAll('#ctx-view-harmony .btn')].map(b => b.id).join() === 'hv-chords,hv-triads,hv-arp'
       && doc.getElementById('hv-chords').getAttribute('aria-pressed') === 'true');
    ok('step 11: the Full chord / Triads row under the neck is gone', !doc.getElementById('ch-shape'));
    ok('step 1: the triad rows stay folded with the full chord', doc.getElementById('ch-triad-rows').hidden === true);
    doc.getElementById('hv-triads').click();
    ok('step 1: pressing Triads turns them on', T.state().chTriads === true && T.isBoardMode('triads') === true);
    ok('step 1: ...shows the string-set and inversion rows', doc.getElementById('ch-triad-rows').hidden === false);
    ok('step 1: ...draws triad cards in place of the chord shapes',
       doc.querySelectorAll('#tr-diagram .chordbox').length > 0 && doc.getElementById('shapes-card').hidden === true);
    // the triad is the chord's own: Am7 → Am, m7♭5 → dim; a sus chord has none
    const qIdx = sh => T.QUALITIES.findIndex(q => q.short === sh);
    T.setChQual(qIdx('m7'));   ok('step 1: m7 → the minor triad', T.chTriadIdx() === 1);
    T.setChQual(qIdx('m7♭5')); ok('step 1: m7♭5 → the diminished triad', T.chTriadIdx() === 2);
    T.setChQual(qIdx('7♯9'));  ok('step 1: 7♯9 → the major triad', T.chTriadIdx() === 0);
    T.setChQual(qIdx('sus4')); T.setHView('chords');
    ok('step 1: a sus chord has no triad, so the neck shows the full chord',
       T.chTriadIdx() === -1 && T.triadsOn() === false && T.isBoardMode('chords') === true);
    ok('step 1: ...and the Triads button is disabled, not hidden',
       doc.getElementById('hv-triads').disabled === true);
    doc.getElementById('hv-triads').click();
    ok('step 11: ...so pressing it does nothing', T.isBoardMode('chords') && doc.getElementById('hv-chords').getAttribute('aria-pressed') === 'true');
    T.setChQual(0); T.setHView('chords');
    T.setTriad(0, 1);                    // string set 1·2·3, root position (major chord)
    const tv = T.currentTriadVoicing();
    ok('triad voicing has three notes', tv.midis.length === 3, 'got ' + tv.midis.length);
    const triPcs = new Set([0, 4, 7].map(i => (T.state().chRoot + i) % 12));
    ok('triad voicing sounds only triad tones',
       tv.pcs.every(pc => triPcs.has(((pc % 12) + 12) % 12)));
    // Loop in triads view starts in triad mode and is mutually exclusive with seq
    ok('loop off before triad loop', T.state().loop === false);
    T.loopToggle();
    ok('triad-view loop starts', T.state().loop === true);
    ok('triad-view loop runs in triad mode', T.state().loopMode === 'triad');
    T.loopToggle();
    ok('triad-view loop stops', T.state().loop === false);
    // TRI_TO_QUAL maps each triad to the QUALITIES index with the matching fifth
    const fifths = T.TRI_TO_QUAL.map(qi => T.fifthInterval(qi));
    ok('triad→quality fifths are [perfect, perfect, ♭5, ♯5]',
       fifths[0] === 7 && fifths[1] === 7 && fifths[2] === 6 && fifths[3] === 8,
       fifths.join(','));
    doc.getElementById('hv-arp').click();
    ok('step 11: Arpeggio from Triads', T.state().hView === 'arp' && doc.getElementById('hv-arp').getAttribute('aria-pressed') === 'true'
       && doc.getElementById('hv-triads').getAttribute('aria-pressed') === 'false');
    doc.getElementById('hv-chords').click();
    ok('step 1: Chord tones turns triads off', T.state().chTriads === false && T.isBoardMode('chords') === true);
    ok('step 1: ...and the chord shapes come back', doc.getElementById('shapes-card').hidden === false);
    T.selectTab('harmony'); T.setHView('chords');
  })();

  /* ---- step 1: a save that was on the Triads view opens on Chord tones, triads on ---- */
  (function triadsMigration() {
    const before = JSON.parse(JSON.stringify(T.snapshotState()));
    const load = o => { win.localStorage.setItem('guitarStudio.v1', JSON.stringify(Object.assign(JSON.parse(JSON.stringify(before)), o))); return T.loadState(); };
    const old = Object.assign(JSON.parse(JSON.stringify(before)), { hView: 'triads', trQual: 1, chQual: 6 });
    delete old.chTriads;
    win.localStorage.setItem('guitarStudio.v1', JSON.stringify(old));
    T.loadState();
    let st = T.state();
    ok('step 1: an old Triads-view save opens on Chord tones', st.hView === 'chords');
    ok('step 1: ...with triads on', st.chTriads === true);
    ok('step 1: ...on the triad quality it had picked (minor)', T.QUALITIES[st.chQual].short === 'm');
    load({ hView: 'identify' });
    ok('step 1: an unknown view in a save falls back safely',
       T.state().hView === 'chords' || T.state().hView === 'arp');
    load({ hView: 'arp', chTriads: true, chQual: 6 });
    st = T.state();
    ok('step 1: a new save round-trips the toggle and keeps its chord', st.chTriads === true && st.chQual === 6 && st.hView === 'arp');
    T.saveState();
    const saved = JSON.parse(win.localStorage.getItem('guitarStudio.v1'));
    ok('step 1: the toggle is saved', saved.chTriads === true);
    ok('step 1: the folded-in triad quality is no longer written', saved.trQual === undefined);
    win.localStorage.setItem('guitarStudio.v1', JSON.stringify(before));
    T.loadState();
    T.selectTab('harmony'); T.setHView('chords');
  })();

  /* ---- PLAN step 5: only the view on screen paints ----
     A key, labels or tuning change on Harmony leaves the hidden Scales and Circle panels
     alone; each is current the moment it is shown. */
  (function visibleOnly() {
    const doc = win.document, st0 = T.state();
    T.setMode('reference'); T.selectTab('harmony'); T.setHView('chords');
    const mo = new win.MutationObserver(() => {});
    // the key sheet's root buttons are the one part that tracks the key while shut
    ['panel-scales', 'cof-svg', 'cof-info', 'sc-fams'].forEach(id =>
      mo.observe(doc.getElementById(id), { subtree: true, childList: true, characterData: true, attributes: true }));
    T.setKey(2, 'D', 0);
    T.setGMode('deg'); T.setGMode('names');
    T.renderAllBoards();
    const n = mo.takeRecords().length; mo.disconnect();
    ok('step 5: key, labels and tuning changes on Harmony leave hidden panels (and the shut key sheet) untouched', n === 0, n + ' mutations');
    T.selectTab('scales'); T.setScView('scale');
    ok('step 5: ...Scales is current once shown', /^D\s/.test(doc.getElementById('sc-info').textContent),
       doc.getElementById('sc-info').textContent.slice(0, 40));
    T.toggleSheet('key');
    const major = T.I18N[T.state().lang].major_word;
    ok('step 5: ...and so is the circle, once its sheet opens', doc.getElementById('cof-info').textContent.includes('D ' + major),
       doc.getElementById('cof-info').textContent.slice(0, 60));
    T.toggleSheet('key');
    T.setMode('practice');
    const m2 = new win.MutationObserver(() => {});
    ['panel-harmony', 'panel-scales', 'board-region'].forEach(id =>
      m2.observe(doc.getElementById(id), { subtree: true, childList: true, characterData: true }));
    T.setKey(7, 'G');
    const n2 = m2.takeRecords().length; m2.disconnect();
    ok('step 5: in Practice, a key change paints no reference view', n2 === 0, n2 + ' mutations');
    T.setMode('reference');
    T.setKey(st0.keyRoot, st0.keyLbl, st0.scIdx);
    T.selectTab('harmony'); T.setHView('chords');
  })();

  /* ---- PLAN step 7: the registry owns the drill lifecycle ----
     A drill gives begin() and end(); the registry shows its area, names and focuses the
     header, closes it back to the card it came from, and says a recorded result aloud. */
  (function drillLifecycle() {
    const doc = win.document, L0 = JSON.parse(JSON.stringify(T.getLearner())), lang0 = T.state().lang;
    const areas = () => T.DRILLS.map(d => d.area).filter(id => !doc.getElementById(id).hidden);
    T.setMode('practice');
    doc.querySelector('.langbtn[data-lang="en"]').click();
    doc.querySelector('#practice-home .drill-card[data-track="changes"]').click();
    ok('step 7: a card opens its drill\'s area, and only that one', areas().join() === 'cm-area' &&
       doc.getElementById('practice-home').hidden === true, areas().join());
    ok('step 7: focus moves to the drill header, which names the track',
       doc.activeElement === doc.getElementById('drill-ctx-name') && doc.activeElement.textContent === 'One-minute changes',
       doc.activeElement && doc.activeElement.id);
    T.cmBegin(); for (let i = 0; i < 6; i++) T.cmTap(); T.finishChanges();
    const live = doc.getElementById('drill-live');
    ok('step 7: a recorded result is said in the live region',
       live.getAttribute('role') === 'status' && /^One-minute changes: \d+\/min$/.test(live.textContent), live.textContent);
    doc.getElementById('drill-ctx-quit').click();
    ok('step 7: Quit closes the area and shows the home', areas().length === 0 && !doc.getElementById('practice-home').hidden);
    ok('step 7: ...and focus goes back to the card that opened it',
       doc.activeElement === doc.querySelector('#practice-home .drill-card[data-track="changes"]'),
       doc.activeElement && (doc.activeElement.id || doc.activeElement.className));

    // the finite drills share one summary: Again reopens the same track, Done closes it
    T.startTrack('chordq');
    const e = T.getEar();
    while (T.getEar() && !T.getEar().finished) { T.earAnswer(T.getEar().cur.key); T.earNext(); }
    const sum = doc.getElementById('ear-summary');
    ok('step 7: the ear drill ends on the shared summary',
       !sum.hidden && !!sum.querySelector('[data-sum="again"]') && !!sum.querySelector('[data-sum="done"]') &&
       doc.getElementById('ear-active').hidden);
    sum.querySelector('[data-sum="again"]').click();
    ok('step 7: Again reopens the same track, fresh', !!T.getEar() && T.getEar() !== e && T.getEar().type === 'chordq' &&
       !T.getEar().finished && sum.hidden && T.getCurTrack() === 'chordq');
    while (T.getEar() && !T.getEar().finished) { T.earAnswer(T.getEar().cur.key); T.earNext(); }
    sum.querySelector('[data-sum="done"]').click();
    ok('step 7: Done closes it back to its card', !T.activeDrill() && areas().length === 0 &&
       doc.activeElement === doc.querySelector('#practice-home .drill-card[data-track="chordq"]'));

    // opening a drill while another runs ends the first (one drill at a time)
    T.startTrack('timing'); T.startTrack('note');
    ok('step 7: a second drill ends the first', !T.getSd() && !!T.getDrill() && areas().join() === 'drill-area');
    doc.getElementById('drill-ctx-quit').click();

    T.setLearner(L0); T.saveState();
    doc.querySelector('.langbtn[data-lang="' + lang0 + '"]').click();
    T.setMode('reference');
  })();

  /* ---- PLAN step 6: the key and the chord are separate state ----
     Scales and the circle show the key; Harmony shows the chord, which moves through the
     key's degrees, a progression or a scale's chord without moving the key. */
  (function keyAndChord() {
    const doc = win.document, st0 = T.state(), seq0 = JSON.parse(JSON.stringify(T.getSeq()));
    const s = () => T.state();
    T.setMode('reference'); T.selectTab('harmony'); T.setHView('chords');
    T.setKey(0, 'C', 0); T.setChQual(0);
    T.toggleSheet('chord');   // the degrees are the chord sheet's
    const degs = [...doc.querySelectorAll('#h-degrees [data-deg]')];
    ok('step 6: Harmony lists the key\'s seven chords as degrees',
       degs.map(b => b.querySelector('.deg-rn').textContent).join(' ') === 'I ii iii IV V vi vii°',
       degs.map(b => b.textContent).join(' | '));
    ok('step 6: ...the tonic marked while the chord is the key\'s',
       degs[0].classList.contains('active') && doc.querySelectorAll('#h-degrees .active').length === 1);
    degs[1].click();
    ok('step 6: a degree moves the chord (ii in C = Dm)...',
       s().chRoot === 2 && s().chLbl === 'D' && s().chQual === 1, JSON.stringify([s().chRoot, s().chLbl, s().chQual]));
    ok('step 6: ...and leaves the key alone', s().keyRoot === 0 && s().keyLbl === 'C' && s().scIdx === 0);
    ok('step 6: Harmony shows the chord', /^Dm\s/.test(doc.getElementById('ch-info').textContent),
       doc.getElementById('ch-info').textContent.slice(0, 30));
    ok('step 6: the root picker still marks the key',
       +doc.querySelector('#g-roots .btn.active').dataset.pc === 0);
    ok('step 6: the degree row marks ii', doc.querySelector('#h-degrees .active').dataset.deg === '1');
    ok('step 8: the chord chip names it', /^Dm/.test(doc.getElementById('chip-chord').textContent));
    T.selectTab('scales'); T.setScView('scale');
    ok('step 6: Scales shows the key, not the chord', /^C\s/.test(doc.getElementById('sc-info').textContent),
       doc.getElementById('sc-info').textContent.slice(0, 30));
    T.toggleSheet('key');
    const ringed = [...doc.querySelectorAll('#cof-svg .cof-chord')];
    ok('step 6: the circle shows the key with the chord ringed (Dm, inner ring)',
       ringed.length === 1 && ringed[0].dataset.type === 'min' && T.COF[+ringed[0].dataset.i].minPc === 2
       && /^C\s/.test(doc.getElementById('cof-info').textContent));

    // persisted on their own, and an older save (one root) opens on the chord it showed
    T.saveState();
    const saved = JSON.parse(win.localStorage.getItem('guitarStudio.v1'));
    ok('step 6: the save keeps the key under its old names and the chord beside it',
       saved.gRoot === 0 && saved.gRootLbl === 'C' && saved.chRoot === 2 && saved.chLbl === 'D');
    T.setKey(9, 'A', 5);                                // this saves, so put the save back
    win.localStorage.setItem('guitarStudio.v1', JSON.stringify(saved)); T.loadState();
    ok('step 6: ...and a load restores both', s().keyRoot === 0 && s().chRoot === 2 && s().chLbl === 'D');
    const mig = T.migrateSave({ gRoot: 3, gRootLbl: 'Eb' });
    ok('step 6: an older save\'s root becomes the chord root too', mig.chRoot === 3 && mig.chLbl === 'Eb');
    const keep = T.migrateSave({ gRoot: 3, gRootLbl: 'Eb', chRoot: 10, chLbl: 'Bb' });
    ok('step 6: ...but a saved chord root is kept', keep.chRoot === 10 && keep.chLbl === 'Bb');
    ok('step 6: a broken chord root is replaced by the key\'s', T.migrateSave({ gRoot: 3, gRootLbl: 'Eb', chRoot: 99 }).chRoot === 3);

    // a new key brings the chord to its tonic root, quality kept
    T.selectTab('harmony');
    T.setKey(7, 'G');
    ok('step 6: a new key brings the chord home, keeping its quality (Dm → Gm)',
       s().keyRoot === 7 && s().chRoot === 7 && s().chLbl === 'G' && s().chQual === 1);

    // the progression moves the chord, never the key
    T.setKey(1, 'C#', 0);
    T.applyPreset(T.SEQ_PRESETS.find(p => p.name === 'I–V–vi–IV'));
    ok('step 6: a preset is spelled in the key (C♯: C# G# A# F#)',
       T.getSeq().map(x => x.lbl).join(' ') === 'C# G# A# F#', T.getSeq().map(x => x.lbl).join(' '));
    doc.querySelectorAll('#seq-strip .seq-chip .nm')[1].click();
    ok('step 6: a progression chip sets the chord, not the key', s().chRoot === 8 && s().keyRoot === 1);
    T.setChord(1, 'C#', 0);
    T.seqPlay(); T.setChord(6, 'F#', 0); T.seqPlay();   // play, a step moves the chord, stop
    ok('step 6: stopping the progression puts the chord back', s().chRoot === 1 && s().keyRoot === 1);

    // the key's own cadence
    T.setKey(9, 'A', 5);
    const cad = T.keyCadence();
    ok('step 6: natural minor cadences i–iv–v',
       cad.map(c => c.off).join(',') === '0,5,7,12' && cad.slice(0, 3).every(c => c.iv[1] === 3), JSON.stringify(cad));
    ok('step 6: the cadence button names the key\'s degrees (A minor: i–iv–v)',
       /i–iv–v$/.test(doc.getElementById('cof-cadence').textContent), doc.getElementById('cof-cadence').textContent);
    T.setChQual(1); T.setKey(9, 'A', 5);
    ok('step 6: the key\'s own tonic chord is not marked twice',
       doc.querySelectorAll('#cof-svg .cof-chord').length === 0);
    T.setKey(9, 'A', 10);
    ok('step 6: harmonic minor cadences i–iv–V', T.keyCadence()[2].iv[1] === 4);
    T.setKey(0, 'C', 4);
    ok('step 6: Mixolydian cadences I–IV–v', T.keyCadence()[2].iv[1] === 3 && T.keyCadence()[0].iv[1] === 4);

    T.setKey(9, 'A', 5);
    ok('step 8: a circle node picks the key and brings the chord home',
       (doc.querySelector('#cof-svg .cof-node[data-type="maj"][data-i="2"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true })),
        s().keyRoot === 2 && s().scIdx === 0 && s().chRoot === 2));
    T.toggleSheet('key');

    // put everything back
    T.seqClear(); T.setSeq(seq0);
    T.setKey(st0.keyRoot, st0.keyLbl, st0.scIdx);
    T.setChord(st0.chRoot, st0.chLbl, st0.chQual);
    T.selectTab('harmony'); T.setHView('chords');
  })();
};
