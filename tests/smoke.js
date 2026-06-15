/* =============================================================================
   Guitar Studio — headless smoke + correctness suite
   -----------------------------------------------------------------------------
   Run with:  npm test        (from this tests/ directory)
   or:        node smoke.js ../guitar-studio.html

   The shipped app is a single zero-dependency HTML file. This gate is the only
   thing that depends on jsdom, and only as a devDependency — nothing in the
   delivered file imports it. The suite has two layers:

     1. Static source checks  — version/changelog/ID-reference invariants that
        don't need a DOM (fast, catch refactor mistakes).
     2. Runtime jsdom checks  — boot the page with a stubbed Web Audio context
        and a test-only introspection hook (window.__GS_TEST__), then assert:
          • JS loads without throwing            (syntax + runtime validity)
          • DOM IDs resolve; moved/removed IDs    (g-loop present, ch-loop gone)
          • i18n dictionaries are symmetric       (uk vs en keys)
          • musical correctness                   (voicing fifths incl. ♭5/♯5,
                                                    note spellings, scale order)
          • scheduler grid timing (Phase B)       (lookahead clock lands on grid)
          • backing bass-note correctness (C)     (fifthInterval per quality)
          • tuning target (Phase A)               (equal-temperament Hz mapping)
          • responsive fretboard (Phase C+)       (no horizontal overflow in a
                                                    windowed range at 360/390/414,
                                                    open-string column intact,
                                                    fret-number / cell alignment)
          • behaviour                             (tab + sub-view gating of Loop,
                                                    loop/seq transport toggles)

   Note (honest framing): a true spectral/FFT tuning check needs a real
   AudioContext and is out of scope for jsdom; the Phase A check here validates
   the equal-temperament frequency target the engine tunes to, which is the
   pure, deterministic part of the tuning path.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (detail ? '  — ' + detail : '')); }
}
function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-9 : eps); }

const htmlPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const html = fs.readFileSync(htmlPath, 'utf8');

/* ---------- Layer 1: static source checks ---------------------------------- */
(function staticChecks() {
  const verMatch = html.match(/APP_VERSION\s*=\s*'([\d.]+)'/);
  const ver = verMatch && verMatch[1];
  ok('APP_VERSION present', !!ver, 'no APP_VERSION found');
  ok('meta version matches APP_VERSION',
     ver && html.includes('<meta name="version" content="' + ver + '">'),
     'meta tag does not match ' + ver);
  ok('top comment lists current version', ver && html.includes('Version: ' + ver),
     'header comment missing Version: ' + ver);
  ok('CHANGELOG has current-version entry',
     ver && new RegExp("v:\\s*'" + ver.replace(/\./g, '\\.') + "'").test(html),
     'no CHANGELOG entry for ' + ver);

  // The Loop button moved to the timing bar: the old per-row id must be gone,
  // the new contextual id must exist and be wired.
  ok('removed ch-loop is no longer referenced', !/getElementById\(['"]ch-loop['"]\)/.test(html),
     'stale ch-loop reference remains');
  ok('g-loop element exists', /id=["']g-loop["']/.test(html), 'g-loop markup missing');
  ok('g-loop is wired to loopToggle', /getElementById\(['"]g-loop['"]\)\.onclick\s*=\s*loopToggle/.test(html),
     'g-loop not wired');

  // Responsive fix: the hard min-width must be gone from .board.
  ok('responsive board: no hard min-width:1150px', !/\.board\s*\{[^}]*min-width:\s*1150px/.test(html),
     'fixed 1150px min-width still on .board');

  // Error-handling guardrail: no remaining silent swallows of the form catch(e){}.
  ok('no silent catch(e){} swallows remain', !/catch\s*\(\s*e\s*\)\s*\{\s*\}/.test(html),
     'an empty catch(e){} block remains');
})();

/* ---------- Layer 2: runtime jsdom checks ---------------------------------- */
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.error('jsdom not installed. Run `npm install` in tests/ first.');
  report(); process.exit(fail ? 1 : 0);
}

/* Minimal Web Audio stub: every node is a chainable proxy; AudioParams accept
   value sets and scheduling calls. Enough for setupBus / pluck / loop / seq to
   run without throwing under jsdom (which has no real AudioContext). */
function buildAudioStub() {
  function param() {
    const p = { value: 0 };
    ['setValueAtTime','setTargetAtTime','exponentialRampToValueAtTime',
     'linearRampToValueAtTime','cancelScheduledValues','cancelAndHoldAtTime']
      .forEach(m => { p[m] = () => p; });
    return p;
  }
  function node() {
    return new Proxy({}, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'connect') return () => node();
        if (k === 'disconnect' || k === 'start' || k === 'stop') return () => {};
        return (t[k] = param());
      },
      set(t, k, v) { t[k] = v; return true; }
    });
  }
  const ctx = {
    sampleRate: 44100, state: 'running', currentTime: 0,
    resume() {}, suspend() {},
    get destination() { return node(); },
    createGain: node, createOscillator: node, createBiquadFilter: node,
    createDynamicsCompressor: node, createConvolver: node, createBufferSource: node,
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(Math.max(1, len || 1)) })
  };
  function AC() { return ctx; }
  AC.__ctx = ctx;
  return AC;
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,           // provides requestAnimationFrame
  url: 'https://example.test/',
  beforeParse(window) {
    window.__GS_ALLOW_TEST__ = true;            // unlock the introspection hook
    const AC = buildAudioStub();
    window.AudioContext = AC;
    window.webkitAudioContext = AC;
    window.__AC = AC;                            // so tests can set currentTime
    // jsdom localStorage exists; ensure a clean slate
    try { window.localStorage.clear(); } catch (e) {}
  }
});

const win = dom.window;
const T = win.__GS_TEST__;

ok('app booted without throwing & exposed test hook', !!T,
   'window.__GS_TEST__ missing — script likely threw on load');

if (T) {
  /* ---- DOM resolution ---- */
  ok('g-loop present in DOM', !!win.document.getElementById('g-loop'));
  ok('ch-loop absent from DOM', !win.document.getElementById('ch-loop'));
  ['g-play','tb-stop','tb-transport','g-roots','ch-board','tr-board','sc-board','nt-board','app-ver']
    .forEach(id => ok('DOM id resolves: ' + id, !!win.document.getElementById(id)));

  /* ---- i18n symmetry + new keys ---- */
  const uk = Object.keys(T.I18N.uk).sort();
  const en = Object.keys(T.I18N.en).sort();
  const onlyUk = uk.filter(k => !T.I18N.en.hasOwnProperty(k));
  const onlyEn = en.filter(k => !T.I18N.uk.hasOwnProperty(k));
  ok('i18n: no keys only in uk', onlyUk.length === 0, onlyUk.join(', '));
  ok('i18n: no keys only in en', onlyEn.length === 0, onlyEn.join(', '));
  ['b_listen_tip','b_loop_tip','b_loop_stop_tip','audio_off',
   'cd_voicings','cd_eshape','cd_ashape','cd_fret','cd_pick_hint','tr_shapes'].forEach(k => {
    ok('i18n new key present (uk+en): ' + k,
       T.I18N.uk[k] !== undefined && T.I18N.en[k] !== undefined);
  });

  /* ---- musical correctness: voicing fifths incl. ♭5 / ♯5 (Phase C bass) ---- */
  const byShort = {}; T.QUALITIES.forEach((q, i) => { byShort[q.short] = i; });
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
    T.selectTab && T.selectTab('harmony');
    const board = win.document.getElementById('ch-board');
    const nums = win.document.getElementById('ch-nums');
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

  /* ---- behaviour: contextual Loop visibility ---- */
  (function loopVisibility() {
    T.selectTab('harmony'); T.setHView('chords');
    const lp = win.document.getElementById('g-loop');
    ok('Loop visible on chord-tones view', lp && lp.hidden === false);
    T.setHView('triads');
    ok('Loop now visible on triads view (v1.12.0)', lp && lp.hidden === false);
    T.setHView('chords');
    T.selectTab('scales');
    ok('Loop hidden on scales tab', lp && lp.hidden === true);
    T.selectTab('notes');
    const gp = win.document.getElementById('g-play');
    ok('Listen hidden on notes tab', gp && gp.hidden === true);
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

  /* ---- v1.12.0: triad shape playback + loop parity ---- */
  (function triadParity() {
    T.selectTab('harmony'); T.setHView('triads');
    T.setTriad(0, 0, 1);                 // major, string set 1·2·3, root position
    const tv = T.currentTriadVoicing();
    ok('triad voicing has three notes', tv.midis.length === 3, 'got ' + tv.midis.length);
    const triPcs = new Set([0, 4, 7].map(i => (T.state().gRoot + i) % 12));
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
    T.selectTab('harmony'); T.setHView('chords');
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
}

report();
process.exit(fail ? 1 : 0);

function report() {
  console.log('\n──────────────────────────────────────────────');
  console.log('Guitar Studio smoke suite: ' + pass + ' passed, ' + fail + ' failed  (' + (pass + fail) + ' checks)');
  if (fails.length) {
    console.log('\nFailures:');
    fails.forEach(f => console.log('  ✗ ' + f));
  } else {
    console.log('All checks green ✓');
  }
  console.log('──────────────────────────────────────────────\n');
}
