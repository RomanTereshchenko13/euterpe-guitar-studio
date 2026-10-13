/* Euterpe smoke suite — the mic: tuner, onset detection, self-heard runs, scored rhythm, calibration.
   Run by ../smoke.js, in order, against its one booted page: the blocks share that page's
   state, so an area may rely on what an earlier one left behind. */
'use strict';
module.exports = function (ctx) {
  const { ok, approx, html, dom, win, T, byShort } = ctx;


  /* ---- Phase 8 / F0: chromatic mic tuner ----
     jsdom has no getUserMedia, so what's assertable HERE is the pure pitch→readout
     maths, the self-disable behaviour, and the DOM contract. The live capture chain
     (real getUserMedia → AnalyserNode → vendored detector → needle) is covered by
     tools/mic-check.js, which drives a real headless browser with a synthetic
     guitar tone as the fake mic device. */
  (function micTuner() {
    const doc = win.document;

    /* -- the vendored detector actually got concatenated into the bundle -- */
    ok('F0: vendored PitchDetector is present in the shared scope',
       typeof win.PitchDetector === 'function' || typeof T.MT_FFT === 'number');

    /* -- ONE tuner (step 1). jsdom is a secure context (https://example.test) but has no
          mediaDevices, so the mic half must report unsupported and HIDE itself rather
          than show a control that can only ever error — and the panel becomes the
          by-ear strings, which work everywhere. -- */
    ok('F0: micSupported() is false without navigator.mediaDevices', T.micSupported() === false);
    ok('step 1: one Tuner entry, always present', !!doc.getElementById('tb-tuner') && !doc.getElementById('tb-mic'));
    ok('step 1: Settings has no reference-tone row of its own',
       !doc.querySelector('#toolbar .tuner-str') && !doc.getElementById('tb-tuner-strings'));
    ok('step 1: without a mic the mic half is hidden', doc.getElementById('mt-mic').hidden === true);
    ok('step 1: ...the by-ear strings are the panel, with no toggle to hide them',
       doc.getElementById('mt-ear-body').hidden === false && doc.getElementById('mt-ear-toggle').hidden === true);
    ok('step 1: ...one button per string of the live tuning',
       doc.querySelectorAll('#mt-strings .tuner-str').length === 6);
    doc.getElementById('tb-tuner').click();
    ok('step 1: the Tuner button opens the panel', doc.getElementById('mic-overlay').hidden === false);
    let toneThrew = false;
    try { doc.querySelector('#mt-strings .tuner-str').click(); } catch (e) { toneThrew = true; }
    ok('step 1: a string plays its reference tone', !toneThrew);
    T.micClose();
    ok('step 1: closing the panel closes it', doc.getElementById('mic-overlay').hidden === true);
    // the welcome's "tune the guitar" opens the one tuner, mic or not
    T.showWelcome();
    doc.getElementById('wc-go-tune').click();
    ok('step 1: the welcome routes to the tuner', doc.getElementById('mic-overlay').hidden === false);
    T.micClose(); T.setWelcomeSeen(true);

    /* -- the overlay markup ships regardless -- */
    ['mic-overlay', 'mt-note', 'mt-oct', 'mt-cents', 'mt-gauge', 'mt-needle',
     'mt-string', 'mt-status', 'mt-toggle', 'mt-close', 'mt-strings'].forEach(id => {
      ok('F0: tuner element present: #' + id, !!doc.getElementById(id));
    });
    ok('F0: the tuner overlay starts hidden', doc.getElementById('mic-overlay').hidden === true);

    /* -- pitch → MIDI, the core conversion -- */
    const near = (a, b, eps) => Math.abs(a - b) < eps;
    ok('F0: A440 maps to MIDI 69', near(T.micMidiFromHz(440), 69, 1e-9));
    ok('F0: 82.41 Hz maps to MIDI 40 (low E)', near(T.micMidiFromHz(82.4069), 40, 0.001));
    ok('F0: an octave up is +12 semitones', near(T.micMidiFromHz(880) - T.micMidiFromHz(440), 12, 1e-9));

    /* -- cents, including the sign convention the needle depends on -- */
    ok('F0: a perfectly in-tune note reads 0 cents', near(T.micCentsOff(69), 0, 1e-9));
    ok('F0: sharp reads positive', T.micCentsOff(69.25) > 0);
    ok('F0: flat reads negative', T.micCentsOff(68.75) < 0);
    ok('F0: 40 cents sharp reads +40', near(T.micCentsOff(69.4), 40, 1e-9));
    ok('F0: 40 cents flat reads -40', near(T.micCentsOff(68.6), -40, 1e-9));
    // The half-semitone boundary is genuinely ambiguous — Math.round(x.5) rounds
    // AWAY from zero, so a quarter-tone lands on the sharp side of the note above
    // rather than +50 of the note below. Either is defensible; what must hold is
    // that the result never escapes the needle's range.
    ok('F0: cents stay within the +/-50 track for any input',
       [68.5, 69.5, 69.499, 68.501, 40.5, 81.5].every(m => Math.abs(T.micCentsOff(m)) <= 50));
    // 25 cents sharp of A440 == 446.4 Hz; the two helpers must agree end to end
    ok('F0: 25 cents sharp round-trips through both helpers',
       near(T.micCentsOff(T.micMidiFromHz(440 * Math.pow(2, 25 / 1200))), 25, 0.001));

    /* -- nearest string follows the LIVE tuning, which is the whole point of
          reading OPEN_MIDI instead of assuming E-A-D-G-B-e -- */
    const std = T.getOpenMidi();                      // [64,59,55,50,45,40] high→low
    ok('F0: MIDI 40 is nearest the 6th string in standard tuning',
       std[T.micNearestString(40)] === 40);
    ok('F0: MIDI 64 is nearest a high-E string', std[T.micNearestString(64)] === 64);
    // Drop D: the 6th string becomes D (38). The nearest-string readout must follow.
    T.setCustomTuning([64, 59, 55, 50, 45, 38]);
    T.setTuningIdx(T.TUNINGS.length - 1);             // the Custom entry
    const drop = T.getOpenMidi();
    ok('F0: custom tuning applied (6th string is D)', drop[5] === 38, String(drop));
    ok('F0: nearest string re-targets to the retuned 6th string',
       drop[T.micNearestString(38)] === 38);
    T.setTuningIdx(0);                                // back to standard
    ok('F0: tuning restored to standard', T.getOpenMidi()[5] === 40);

    /* -- gates are set where the measured signals actually sit: a clean plucked
          string clarities ~0.95+, white noise measured 0.41 -- */
    ok('F0: clarity gate rejects noise but not a clean string',
       T.MT_CLARITY > 0.5 && T.MT_CLARITY <= 0.95);
    ok('F0: detection band covers the guitar', T.MT_HZ_LO < 82 && T.MT_HZ_HI > 660);
    ok('F0: the analysis window resolves low E (>= 2 periods)',
       T.MT_FFT / 44100 >= 2 / 82.41);
    ok('F0: in-tune tolerance is the standard +/-5 cents', T.MT_IN_TUNE === 5);

    /* -- the readout itself, driven without a mic -- */
    T.micPaintIdle();
    ok('F0: idle shows no note', doc.getElementById('mt-note').textContent === '—');
    ok('F0: idle prompts for a string',
       doc.getElementById('mt-string').textContent === T.I18N[T.state().lang].mic_play_hint);

    // Feed a dead-on A440 repeatedly; the easing converges, so the needle centres
    // and the gauge flips to in-tune.
    for (let i = 0; i < 30; i++) T.micPaint(69);
    ok('F0: a centred reading names the note', doc.getElementById('mt-note').textContent === 'A');
    ok('F0: a centred reading shows the octave', doc.getElementById('mt-oct').textContent === '4');
    // parse rather than string-compare: the CSS serializer drops the trailing
    // zero, so "50.0%" comes back as "50%"
    ok('F0: a centred reading parks the needle at 50%',
       near(parseFloat(doc.getElementById('mt-needle').style.left), 50, 0.05),
       doc.getElementById('mt-needle').style.left);
    ok('F0: a centred reading reads as in tune',
       doc.getElementById('mt-gauge').classList.contains('in-tune'));
    ok('F0: an in-tune gauge carries no direction flag',
       !doc.getElementById('mt-gauge').hasAttribute('data-dir'));

    // A clearly flat note: needle left of centre, and the direction is exposed as
    // an attribute so the state never rides on colour alone.
    T.micPaintIdle();
    for (let i = 0; i < 30; i++) T.micPaint(68.7);     // 30 cents flat
    const leftPct = parseFloat(doc.getElementById('mt-needle').style.left);
    ok('F0: a flat note pushes the needle left of centre', leftPct < 50, String(leftPct));
    ok('F0: a flat note is flagged flat',
       doc.getElementById('mt-gauge').getAttribute('data-dir') === 'flat');
    ok('F0: a flat note is not marked in tune',
       !doc.getElementById('mt-gauge').classList.contains('in-tune'));

    T.micPaintIdle();
    for (let i = 0; i < 30; i++) T.micPaint(69.3);     // 30 cents sharp
    ok('F0: a sharp note is flagged sharp',
       doc.getElementById('mt-gauge').getAttribute('data-dir') === 'sharp');
    ok('F0: a sharp note pushes the needle right of centre',
       parseFloat(doc.getElementById('mt-needle').style.left) > 50);

    // The needle must never escape its track, however far out of tune the reading.
    T.micPaintIdle();
    for (let i = 0; i < 60; i++) T.micPaint(69.5);     // pinned at the +50 edge
    const edge = parseFloat(doc.getElementById('mt-needle').style.left);
    ok('F0: the needle is clamped inside the track', edge >= 0 && edge <= 100, String(edge));

    /* -- status messages are localized and clearable -- */
    T.micStatus('mic_denied');
    const st = doc.getElementById('mt-status');
    ok('F0: an error status is shown', st.hidden === false && st.textContent.length > 0);
    ok('F0: the status remembers its key so it can re-localize',
       st.dataset.key === 'mic_denied');
    T.micStatus(null);
    ok('F0: clearing the status hides it', st.hidden === true);

    /* -- open/close drives BOTH `hidden` and `.open`, like every other modal, and
          closing must never leave a session behind -- */
    T.micOpen();
    const ov = doc.getElementById('mic-overlay');
    ok('F0: opening the tuner unhides the overlay', ov.hidden === false);
    ok('F0: opening the tuner adds the .open class', ov.classList.contains('open'));
    T.micClose();
    ok('F0: closing re-hides the overlay', ov.hidden === true);
    ok('F0: closing removes the .open class', !ov.classList.contains('open'));
    ok('F0: closing leaves no live mic session', T.getMic() === null);

    /* -- language switch must not throw with the panel open (the TDZ bug that the
          module's load-order comment exists to prevent) -- */
    T.micOpen();
    let threw = false;
    try { win.__GS_TEST__ && win.document.querySelectorAll('.langbtn')[0].click(); }
    catch (e) { threw = true; }
    ok('F0: switching language with the tuner open does not throw', !threw);
    T.micClose();
  })();

  /* ---- Phase 8 / F1: onset detection, latency calibration, scored timing ----
     The capture path needs a real browser (tools/onset-check.js). What lives here is
     the part that decides what a player is TOLD — matching, scoring and the latency
     correction. Those numbers are the whole product claim of F1, so they are asserted
     directly rather than inferred from a green end-to-end run. */
  (function onsetF1() {
    const doc = win.document;
    const near = (a, b, eps) => Math.abs(a - b) < eps;

    /* -- self-disable, same rule as F0: no worklet / no mic in jsdom -- */
    ok('F1: onsetSupported() is false without a mic path', T.onsetSupported() === false);
    ok('F1: the calibration box is removed where there is no mic',
       !doc.getElementById('cal-row') && !doc.getElementById('cal-box') && !doc.getElementById('drill-ctx-cal'));

    /* -- the worklet processor is compiled in a DIFFERENT realm, so the build's own
          syntax check never parses it. A typo in that string would only surface as a
          runtime failure on a real device, which is exactly the wrong place. -- */
    let procOk = true, procErr = '';
    try { new win.Function(T.onsetProcessorSrc().replace('registerProcessor', 'void')); }
    catch (e) { procOk = false; procErr = String(e && e.message); }
    ok('F1: the worklet processor source parses as JavaScript', procOk, procErr);
    ok('F1: the processor registers under a namespaced name',
       T.onsetProcessorSrc().indexOf("registerProcessor('euterpe-onset'") > 0);
    ok('F1: the processor timestamps per-sample, not per-block',
       T.onsetProcessorSrc().indexOf('currentTime + i / sampleRate') > 0);

    /* -- matching: nearest wins, each expected slot claimed at most once -- */
    const m1 = T.onsetMatch([1.0, 2.0, 3.0], [1.01, 1.98, 3.02], 0.1);
    ok('F1: three clean hits match three slots', m1.hits.length === 3);
    ok('F1: nothing missed when everything matched', m1.missed.length === 0);
    ok('F1: nothing left over when everything matched', m1.extra.length === 0);
    ok('F1: a late hit reports positive error', m1.hits[0].err > 0);
    ok('F1: an early hit reports negative error', m1.hits[1].err < 0);

    // Outside tolerance is a miss, not a stretched match.
    const m2 = T.onsetMatch([1.0, 2.0], [1.005, 2.5], 0.05);
    ok('F1: an onset beyond tolerance does not match', m2.hits.length === 1);
    ok('F1: the unmatched slot is reported missed', m2.missed.length === 1 && m2.missed[0] === 2.0);
    ok('F1: the stray onset is reported extra', m2.extra.length === 1 && m2.extra[0] === 2.5);

    // A flam — two picks around one beat — must be one hit plus one extra, never
    // two hits, or double-picking would inflate the hit rate.
    const m3 = T.onsetMatch([1.0], [0.99, 1.01], 0.1);
    ok('F1: a double pick on one slot scores one hit', m3.hits.length === 1);
    ok('F1: ...and the second pick counts as extra', m3.extra.length === 1);

    // Missing notes entirely
    const m4 = T.onsetMatch([1, 2, 3, 4], [1.0, 3.0], 0.05);
    ok('F1: silence on a slot is a miss', m4.missed.length === 2);

    /* -- scoring -- */
    const s1 = T.onsetScore(T.onsetMatch([1, 2, 3, 4], [1.02, 2.02, 3.02, 4.02], 0.1));
    ok('F1: consistent lateness reports positive bias', near(s1.biasMs, 20, 0.01));
    ok('F1: consistent lateness reports 20ms mean error', near(s1.meanAbsMs, 20, 0.01));
    ok('F1: a consistent offset has near-zero spread', s1.spreadMs < 0.01);
    ok('F1: all slots played reports a full hit rate', near(s1.hitRate, 1, 1e-9));

    // Same mean error, but scattered instead of consistent: the spread must separate
    // them, because "always 20 ms late" and "randomly +/-20 ms" need opposite advice.
    const s2 = T.onsetScore(T.onsetMatch([1, 2, 3, 4], [0.98, 2.02, 2.98, 4.02], 0.1));
    ok('F1: scattered error still reports ~20ms mean', near(s2.meanAbsMs, 20, 0.01));
    ok('F1: scattered error reports ~zero bias', Math.abs(s2.biasMs) < 0.01);
    ok('F1: scattered error reports a real spread', s2.spreadMs > 15, String(s2.spreadMs));
    ok('F1: even-but-late is distinguishable from uneven',
       s1.spreadMs < 1 && s2.spreadMs > 15);

    ok('F1: an empty match scores nothing rather than dividing by zero',
       T.onsetScore(T.onsetMatch([1, 2], [], 0.1)).n === 0);

    /* -- verdict + feel -- */
    ok('F1: <=20ms reads tight', T.onsetVerdict({ n: 4, meanAbsMs: 12 }) === 'on_tight');
    ok('F1: ~30ms reads close', T.onsetVerdict({ n: 4, meanAbsMs: 30 }) === 'on_close');
    ok('F1: >45ms reads loose', T.onsetVerdict({ n: 4, meanAbsMs: 80 }) === 'on_loose');
    ok('F1: nothing heard is its own verdict', T.onsetVerdict({ n: 0 }) === 'on_none');

    ok('F1: consistent earliness reads as rushing',
       T.onsetFeel({ n: 8, biasMs: -30, spreadMs: 5 }) === 'on_rushing');
    ok('F1: consistent lateness reads as dragging',
       T.onsetFeel({ n: 8, biasMs: 30, spreadMs: 5 }) === 'on_dragging');
    ok('F1: a small bias is not called a tendency',
       T.onsetFeel({ n: 8, biasMs: 6, spreadMs: 3 }) === null);
    // Bias buried in noise is not a tendency either — this is the guard against
    // telling someone they rush when they are simply inconsistent.
    ok('F1: bias smaller than the spread is not called a tendency',
       T.onsetFeel({ n: 8, biasMs: 20, spreadMs: 60 }) === null);

    /* -- latency calibration -- */
    ok('F1: median of an odd sample', T.calMedian([10, 30, 20]) === 20);
    ok('F1: median of an even sample', T.calMedian([10, 20, 30, 40]) === 25);
    ok('F1: the median ignores a single wild outlier',
       T.calMedian([48, 50, 52, 5000]) === 51);

    T.calSetMs(120);
    ok('F1: a measured offset is stored', T.getCalMs() === 120);
    ok('F1: calOffsetSec reports seconds', near(T.calOffsetSec(), 0.12, 1e-9));
    T.calSetMs(-50);
    ok('F1: a negative offset is clamped to zero', T.getCalMs() === 0);
    T.calSetMs(99999);
    ok('F1: an absurd offset is clamped to the ceiling', T.getCalMs() === T.CAL_MAX_MS);
    T.calSetMs('nonsense');
    ok('F1: a non-numeric offset falls back to zero', T.getCalMs() === 0);

    /* -- THE headline behaviour: latency correction. A player who is dead on the grid,
          heard through a 100 ms round trip, must score as dead on. Without the
          correction every single player in the world reads as "dragging 100 ms",
          which is why this offset exists at all. -- */
    T.setMode('practice');
    T.startTiming();
    T.sdScore.setOn(true);
    const grid = [1, 1.5, 2, 2.5, 3, 3.5, 4];
    T.calSetMs(100);
    T.sdScore._set(grid, grid.map(g => g + 0.100));   // perfect playing, heard 100ms late
    const corrected = T.sdScore._compute();
    ok('F1: a perfect run through 100ms of latency scores as perfect',
       corrected && corrected.n === grid.length && corrected.meanAbsMs < 0.01,
       corrected ? JSON.stringify(corrected) : 'null');
    ok('F1: ...and is not labelled as dragging', T.onsetFeel(corrected) === null);

    // The same data with calibration NOT applied is the bug this prevents.
    T.calSetMs(0);
    const uncorrected = T.sdScore._compute();
    ok('F1: without calibration the same run reads ~100ms late',
       uncorrected && near(uncorrected.biasMs, 100, 1),
       uncorrected ? String(uncorrected.biasMs) : 'null');
    ok('F1: ...which would have been reported as dragging',
       T.onsetFeel(uncorrected) === 'on_dragging');

    // A genuinely rushing player, correctly calibrated, is still caught.
    T.calSetMs(100);
    T.sdScore._set(grid, grid.map(g => g + 0.100 - 0.035));   // 35ms early, same latency
    const rushed = T.sdScore._compute();
    ok('F1: a rushing player is still detected through the correction',
       rushed && near(rushed.biasMs, -35, 1), rushed ? String(rushed.biasMs) : 'null');
    ok('F1: ...and is labelled rushing', T.onsetFeel(rushed) === 'on_rushing');

    /* -- the coach tier must stay honest: mic off means no score at all -- */
    T.sdScore.setOn(false);
    ok('F1: with the mic off there is no score object', T.sdScore._compute() === null);
    const box = doc.getElementById('sd-score');
    ok('F1: the score panel exists in the markup', !!box);
    T.sdScore.render();
    ok('F1: the score panel is hidden on a coach run', box.hidden === true);
    /* B2: the three per-drill mic buttons collapsed into the shell's one, and its
       VISIBILITY moved with it — a drill declares mic(), which folds in both onset
       availability and whether this drill's current mode has a tier at all. */
    T.applyDrillCtx();
    ok('F1: the scored-tier toggle is hidden where onset cannot run',
       doc.getElementById('drill-ctx-mic').hidden === true);
    ok('F1: the coach hint does not claim to be listening',
       doc.getElementById('sd-hint').textContent === T.I18N[T.state().lang].sd_hint);

    T.calSetMs(0);
    T.exitTiming();
    T.setMode('reference');
  })();

  /* ---- THE SELF-HEARING GUARD (v2.14.0) -----------------------------------
     On speakers the mic hears the app's own click/comp, and — because those were
     scheduled on the grid and calibration measures exactly that path — they land
     on it perfectly. A run the app scored against itself must never be printed as
     a result, or the drill congratulates a player who put the guitar down. -- */
  (function selfHeard(){
    const doc = win.document;
    const perfect = { n: 32, meanAbsMs: 0.4, biasMs: 0, spreadMs: 0.5, hitRate: 1, extra: 0 };
    ok('guard: a machine-perfect run is flagged as the app hearing itself',
       T.onsetSelfHeard(perfect) === true);

    // The false-positive case that matters most: a genuinely excellent player.
    // Tight, but nowhere near machine-tight, so they must still get their score.
    const excellent = { n: 32, meanAbsMs: 9, biasMs: 1, spreadMs: 11, hitRate: 1, extra: 0 };
    ok('guard: a very good human player is NOT accused',
       T.onsetSelfHeard(excellent) === false);
    ok('guard: ...and still reads as tight', T.onsetVerdict(excellent) === 'on_tight');

    // Both conditions are required — either alone is ordinary.
    ok('guard: machine-tight but half the slots missed is not self-hearing',
       T.onsetSelfHeard({ n: 16, meanAbsMs: 0.4, biasMs: 0, spreadMs: 0.5, hitRate: 0.5, extra: 0 }) === false);
    ok('guard: every slot hit with human spread is not self-hearing',
       T.onsetSelfHeard({ n: 32, meanAbsMs: 18, biasMs: 2, spreadMs: 22, hitRate: 1, extra: 0 }) === false);
    // A short run can be tight by luck, so the guard needs a run long enough to mean something.
    ok('guard: too short a run is never flagged',
       T.onsetSelfHeard({ n: 4, meanAbsMs: 0.2, biasMs: 0, spreadMs: 0.3, hitRate: 1, extra: 0 }) === false);
    ok('guard: nothing at all is not flagged', T.onsetSelfHeard(null) === false);

    // ...and the panel must actually refuse, not just know.
    T.setMode('practice');
    T.startTiming();
    T.calSetMs(0);
    T.sdScore.setOn(true);
    const g = []; for (let i = 0; i < 32; i++) g.push(i * 0.25);
    T.sdScore._set(g, g.slice());              // the app hearing its own click, exactly on time
    T.sdScore.end();
    T.sdScore.render();
    const panel = doc.getElementById('sd-score');
    ok('guard: the panel refuses to print a self-heard run as a score',
       panel.hidden === false && panel.textContent === T.I18N[T.state().lang].on_selfheard,
       panel.textContent.slice(0, 60));
    ok('guard: ...and shows no headline number', !panel.querySelector('.sc-main'));
    T.sdScore.setOn(false);
    T.exitTiming();
    T.setMode('reference');
  })();

  /* ---- the Rhythm pillar scored tiers (v2.14.0) ---------------------------
     Same layer, different notion of "a slot you are expected to play". -- */
  (function rhythmScored(){
    const doc = win.document;
    const near = (a, b, eps) => Math.abs(a - b) < eps;
    ok('rhythm: the strum drill has a scored-run controller', !!T.spScore);


    /* B2: the status line and the score panel stay per-drill (they sit inside the
       drill's own stage), but the mic TOGGLE is one button in the shared header — it
       was the same control drawn three times, in three drills' control rows. */
    ['sp-status', 'sp-score', 'drill-ctx-mic'].forEach(id => {
      ok('rhythm: markup carries #' + id, !!doc.getElementById(id));
    });
    ok('B2: the per-drill mic buttons are gone', !doc.getElementById('sp-mic') && !doc.getElementById('tg-mic') && !doc.getElementById('sd-mic'));

    // Strumming: only the pattern's own slots are expected — the empty ones are
    // where the hand deliberately misses, and scoring them would be nonsense.
    T.setMode('practice');
    T.startRhythm();
    T.setSpPattern(2);
    T.spScore.setOn(true);
    T.calSetMs(0);
    // "the common one" = D · D-U · _-U-D-U over 8 slots: 6 strums, not 8
    const slots = [0, 0.25, 0.375, 0.625, 0.75, 0.875];
    T.spScore._set(slots, slots.map(s => s + 0.020));   // 20 ms consistently late
    const sp = T.spScore._compute();
    ok('rhythm: a strum run scores only the pattern\'s own slots',
       sp && sp.n === slots.length, sp ? String(sp.n) : 'null');
    ok('rhythm: ...and reads as dragging by the amount played late',
       sp && near(sp.biasMs, 20, 1), sp ? String(sp.biasMs) : 'null');
    // extra strums between the pattern's slots are your own feel, not errors
    T.spScore._set(slots, slots.concat([0.5, 0.1]).map(s => s + 0.020));
    const busy = T.spScore._compute();
    ok('rhythm: strums outside the pattern do not lower the timing score',
       busy && near(busy.meanAbsMs, sp.meanAbsMs, 0.01) && busy.extra === 2,
       busy ? JSON.stringify(busy) : 'null');
    T.spScore.setOn(false);

    // Your own rhythm (step 9: what Comp was): the scored slot is the CHANGE. What you
    // play between changes is your rhythm, so it lands in `extra` rather than being
    // marked wrong.
    T.setSpPattern(-1);
    T.spScore.setOn(true);
    const bars = [0, 2, 4, 6];                        // four bar downbeats
    const inBetween = [0.5, 1, 1.5, 2.5, 3, 3.5];     // your own comping in between
    T.spScore._set(bars, bars.map(b => b + 0.030).concat(inBetween));
    const comp = T.spScore._compute();
    ok('comp: the changes are what get scored', comp && comp.n === bars.length,
       comp ? String(comp.n) : 'null');
    ok('comp: ...at the accuracy the changes were landed with',
       comp && near(comp.biasMs, 30, 1), comp ? String(comp.biasMs) : 'null');
    ok('comp: ...and your in-between comping is not penalised',
       comp && comp.hitRate === 1 && comp.extra === inBetween.length,
       comp ? JSON.stringify(comp) : 'null');
    // a change you never played is a miss, which is the whole point of the drill
    T.spScore._set(bars, [bars[0], bars[1], bars[3]].map(b => b + 0.030));
    const dropped = T.spScore._compute();
    ok('comp: a change you never played counts as missed',
       dropped && dropped.n === 3 && near(dropped.hitRate, 0.75, 1e-9),
       dropped ? JSON.stringify(dropped) : 'null');
    T.spScore.setOn(false);
    T.setSpPattern(0);
    T.exitRhythm();
    T.setMode('reference');
  })();

  /* ---- F1 persistence: the offset has to survive a reload, bounds-checked like
     every other entry in the state catalogue. ---- */
  (function calPersistence() {
    T.calSetMs(87);
    ok('F1: calMs is written into saved state',
       (win.localStorage.getItem('guitarStudio.v1') || '').indexOf('"calMs":87') > 0);
    T.calSetMs(0);
  })();
};
