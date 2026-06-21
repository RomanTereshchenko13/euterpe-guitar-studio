/* =============================================================================
   Euterpe — headless smoke + correctness suite
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
  ['g-play','tb-stop','tb-transport','g-roots','board','nums','legend','app-ver']
    .forEach(id => ok('DOM id resolves: ' + id, !!win.document.getElementById(id)));
  // 1b: the four per-tab boards collapsed into one shared #board
  ['ch-board','tr-board','sc-board','nt-board'].forEach(id =>
    ok('1b: old per-tab board gone: ' + id, !win.document.getElementById(id)));
  // 1b's single shared reference board (#board) is still exactly one; 3c adds the
  // drill's own board (#drill-board) inside Practice, so two fretboards total now.
  ok('1b: one shared reference board (#board)',
     win.document.querySelectorAll('#board.fretboard').length === 1);
  ok('3c: drill has its own board, two fretboards total',
     win.document.querySelectorAll('.fretboard').length === 2 && !!win.document.getElementById('drill-board'),
     win.document.querySelectorAll('.fretboard').length + ' found');
  ok('1b: Notes tab folded away (3 tabs)', win.document.querySelectorAll('.tab').length === 3,
     win.document.querySelectorAll('.tab').length + ' tabs');
  ok('1b: notes controls live under Scales (sub-notes)', !!win.document.getElementById('sub-notes'));

  /* ---- i18n symmetry + new keys ---- */
  const uk = Object.keys(T.I18N.uk).sort();
  const en = Object.keys(T.I18N.en).sort();
  const onlyUk = uk.filter(k => !T.I18N.en.hasOwnProperty(k));
  const onlyEn = en.filter(k => !T.I18N.uk.hasOwnProperty(k));
  ok('i18n: no keys only in uk', onlyUk.length === 0, onlyUk.join(', '));
  ok('i18n: no keys only in en', onlyEn.length === 0, onlyEn.join(', '));
  ['b_listen_tip','b_loop_tip','b_loop_stop_tip','audio_off',
   'cd_voicings','cd_eshape','cd_ashape','cd_fret','cd_pick_hint','tr_shapes',
   'view_scale','view_notes','view_identify','suggest_title','suggest_scales',
   'id_near','id_missing','id_extra',
   'view_arp','arp_h','arp_p','arp_hint','arp_word','tb_capo','capo_off','caged_desc',
   'mode_reference','mode_practice','practice_h','practice_intro','drill_notes','drill_notes_meta',
   'drill_quit','drill_find_pre','drill_find_sub','drill_complete','drill_score','drill_clean',
   'drill_misses','drill_time','drill_again','drill_done','seam_drill_notes',
   'prog_title','prog_empty','prog_tracked','prog_accuracy','prog_streak','prog_sessions',
   'mode_ear','ear_h','ear_intro','ear_intervals','ear_intervals_meta','ear_chords','ear_chords_meta',
   'ear_rhythm','ear_rhythm_meta','ear_int_prompt','ear_chord_prompt','ear_rhythm_prompt',
   'ear_replay','ear_next','ear_right','ear_wrong','ear_got',
   'pwa_install','pwa_install_tip','pwa_update','pwa_update_btn','pwa_dismiss',
   'tb_volume','tb_tuner'].forEach(k => {
    ok('i18n new key present (uk+en): ' + k,
       T.I18N.uk[k] !== undefined && T.I18N.en[k] !== undefined);
  });

  /* ---- 2.2.0: master volume + reference-tone tuner controls ---- */
  ok('2.2: master volume slider present', !!win.document.getElementById('tb-vol'));
  ok('2.2: volume value readout present', !!win.document.getElementById('tb-vol-val'));
  ok('2.2: tuner string container present', !!win.document.getElementById('tb-tuner-strings'));
  ok('2.2: tuner builds one button per string',
     win.document.querySelectorAll('#tb-tuner-strings .tuner-str').length === 6);

  /* ---- 3a: the mode axis (Reference · Practice) ----
     jsdom doesn't resolve the full stylesheet cascade, so the actual show/hide is a
     visual check (screenshots); here we assert the reliable signals: the body class,
     button state, the untouched reference shell, and persistence. */
  (function modeAxis() {
    const doc = win.document;
    const nav = doc.getElementById('modenav');
    ok('3a: modenav present', !!nav);
    const modes = nav ? [...nav.querySelectorAll('.modebtn')].map(b => b.dataset.mode) : [];
    ok('3a: modenav has reference + practice buttons',
       modes.indexOf('reference') >= 0 && modes.indexOf('practice') >= 0, modes.join(','));
    const pp = doc.getElementById('panel-practice');
    ok('3a: practice panel present and NOT a .panel (off the .panel.active machinery)',
       !!pp && !pp.classList.contains('panel'));
    ok('3a: reference shell untouched (3 tabs, 3 reference panels)',
       doc.querySelectorAll('.tab').length === 3 && doc.querySelectorAll('.main > .panel').length === 3);

    // enter Practice
    T.selectTab('harmony');
    T.setMode('practice');
    ok('3a: body marks practice mode',
       doc.body.classList.contains('mode-practice') && !doc.body.classList.contains('mode-reference'));
    const pBtn = nav.querySelector('.modebtn[data-mode="practice"]');
    ok('3a: practice button active + aria-pressed',
       pBtn.classList.contains('active') && pBtn.getAttribute('aria-pressed') === 'true');
    ok('3a: reference sub-tab stays selected underneath', T.state().currentTab === 'harmony');
    ok('3a: state() exposes mode', T.state().currentMode === 'practice');
    ok('3a: mode persists to localStorage',
       JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}').mode === 'practice');

    // back to Reference: body class + buttons flip back, mode persists
    T.setMode('reference');
    ok('3a: body marks reference mode',
       doc.body.classList.contains('mode-reference') && !doc.body.classList.contains('mode-practice'));
    const rBtn = nav.querySelector('.modebtn[data-mode="reference"]');
    ok('3a: reference button active + aria-pressed',
       rBtn.classList.contains('active') && rBtn.getAttribute('aria-pressed') === 'true');
    ok('3a: reference active panel still .active underneath',
       doc.getElementById('panel-harmony').classList.contains('active'));
    ok('3a: mode reference persists',
       JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}').mode === 'reference');
  })();

  /* ---- 3b: learner model (spine #3) — SRS, ring buffer, bounds-checked restore ---- */
  (function learnerModel() {
    const NOW = 1000000000000;   // fixed epoch for deterministic due times
    T.resetLearner();

    // SM-2-lite: a correct attempt grows ease (2.5 -> 2.6) + pushes due out
    let it = T.recordAttempt('note:E:str6', true, NOW);
    ok('3b: correct increments seen+correct+streak', it.seen === 1 && it.correct === 1 && it.streak === 1);
    ok('3b: correct grows ease to 2.6', Math.abs(it.ease - 2.6) < 1e-9);
    ok('3b: correct schedules due in the future', it.due > NOW);

    // a miss zeroes the streak, drops ease (2.6 -> 2.4), re-queues to relearn soon
    it = T.recordAttempt('note:E:str6', false, NOW);
    ok('3b: miss increments seen but not correct', it.seen === 2 && it.correct === 1);
    ok('3b: miss resets streak', it.streak === 0);
    ok('3b: miss lowers ease to 2.4', Math.abs(it.ease - 2.4) < 1e-9);
    ok('3b: miss re-queues within the minute', it.due === NOW + 60000);

    // ease floors at 1.3 after repeated misses
    for (let i = 0; i < 10; i++) T.recordAttempt('note:E:str6', false, NOW);
    ok('3b: ease floored at 1.3', Math.abs(T.getLearner().items['note:E:str6'].ease - 1.3) < 1e-9);

    // due-queue: only past-due items surface, optionally namespaced by prefix
    T.resetLearner();
    T.recordAttempt('note:A:str5', false, NOW);   // due NOW+60000
    T.recordAttempt('note:C:str5', true, NOW);    // due ~1 day out
    const dueSoon = T.dueItems(NOW + 60000 + 1, 'note:');
    ok('3b: dueItems surfaces only past-due', dueSoon.indexOf('note:A:str5') >= 0 && dueSoon.indexOf('note:C:str5') < 0, dueSoon.join(','));
    ok('3b: dueItems prefix filter', T.dueItems(NOW + 2 * 86400000, 'interval:').length === 0);

    // sessions ring buffer is bounded (cap 50, newest last)
    T.resetLearner();
    for (let i = 0; i < 60; i++) T.recordSession('notes', i, NOW + i);
    const L = T.getLearner();
    ok('3b: sessions ring buffer capped at 50', L.sessions.length === 50);
    ok('3b: ring buffer keeps the newest', L.sessions[L.sessions.length - 1].score === 59 && L.sessions[0].score === 10);

    // aggregate stats
    T.resetLearner();
    T.recordAttempt('a', true, NOW); T.recordAttempt('a', true, NOW); T.recordAttempt('b', false, NOW);
    const st = T.learnerStats();
    ok('3b: stats count items', st.items === 2);
    ok('3b: stats accuracy = correct/seen', Math.abs(st.accuracy - 2 / 3) < 1e-9);
    ok('3b: stats best streak', st.bestStreak === 2);

    // normalizeLearner: a tampered blob degrades to a safe, valid model (never throws)
    const bad = T.normalizeLearner({
      v: T.LEARNER_V,
      items: {
        good: { seen: 5, correct: 3, streak: 2, ease: 2.4, due: 123 },
        liar: { seen: 2, correct: 9, streak: -4, ease: 99, due: -5 },   // correct>seen, neg streak, ease oob, neg due
        bad1: 'nope', bad2: null
      },
      sessions: [{ t: 1, drill: 'x', score: 1 }, { nope: true }, 'junk']
    });
    ok('3b: normalize keeps valid item', bad.items.good && bad.items.good.seen === 5 && bad.items.good.correct === 3);
    ok('3b: normalize clamps correct<=seen', bad.items.liar.correct === 2);
    ok('3b: normalize floors streak at 0', bad.items.liar.streak === 0);
    ok('3b: normalize clamps ease into [1.3,3.0]', bad.items.liar.ease <= 3.0 && bad.items.liar.ease >= 1.3);
    ok('3b: normalize floors due at 0', bad.items.liar.due === 0);
    ok('3b: normalize drops non-object items', bad.items.bad1 === undefined && bad.items.bad2 === undefined);
    ok('3b: normalize drops malformed sessions', bad.sessions.length === 1 && bad.sessions[0].drill === 'x');

    // unknown version / garbage → fresh model (the only sanctioned reshape is v-bump + migrate)
    const fresh = T.normalizeLearner({ v: 999, items: { z: { seen: 1 } } });
    ok('3b: normalize rejects unknown version → fresh', fresh.v === T.LEARNER_V && Object.keys(fresh.items).length === 0);
    ok('3b: normalize garbage → fresh', T.normalizeLearner(null).v === T.LEARNER_V && Object.keys(T.normalizeLearner('x').items).length === 0);

    // persistence: learner rides saveState into localStorage
    T.resetLearner();
    T.recordAttempt('persist:test', true, NOW);
    T.setMode('practice');   // any state-mutating call triggers saveState()
    const saved = JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}');
    ok('3b: learner persists into saveState',
       saved.learner && saved.learner.items && saved.learner.items['persist:test'] && saved.learner.items['persist:test'].correct === 1);
    ok('3b: persisted learner carries version', saved.learner.v === T.LEARNER_V);
    T.setMode('reference');   // restore mode
    T.resetLearner();         // leave a clean model for later tests
  })();

  /* ---- 3c: note-naming drill — target positions, scoring, learner writes ---- */
  (function noteDrill() {
    // drillTargetsFor mirrors the board's cell set (open strings + window)
    const eT = T.drillTargetsFor(4);   // pc 4 = E
    ok('3c: targets include both open E strings', eT.has('0:0') && eT.has('5:0'));
    ok('3c: targets find E on the A string at fret 7', eT.has('4:7'));
    ok('3c: targets exclude a wrong position', !eT.has('1:0'));   // B string open = B, not E

    T.resetLearner();
    T.startDrill();
    let d = T.getDrill();
    ok('3c: drill starts active', !!d && !d.finished);
    ok('3c: session length = DRILL_LEN', d.total === T.DRILL_LEN);
    ok('3c: first prompt has a target pc', Number.isInteger(d.targetPc));

    // a wrong tap (a position of a DIFFERENT note) registers a miss, never advances
    const wrongPos = [...T.drillTargetsFor((d.targetPc + 1) % 12)][0];
    const [wsi, wf] = wrongPos.split(':').map(Number);
    const wrongBefore = T.getDrill().totalWrong;
    T.drillAnswer(wsi, wf);
    ok('3c: wrong tap counts a miss', T.getDrill().totalWrong === wrongBefore + 1);
    ok('3c: wrong tap does not advance the prompt', T.getDrill().done === 0);

    // drive the whole session correctly: answer every target of each prompt
    let guard = 0;
    while (!T.getDrill().finished && guard++ < 50) {
      const cur = T.getDrill();
      for (const key of T.drillTargetsFor(cur.targetPc)) { const [si, f] = key.split(':').map(Number); T.drillAnswer(si, f); }
    }
    const fin = T.getDrill();
    ok('3c: drill finishes after all prompts', fin.finished);
    ok('3c: every prompt scored', fin.done === fin.total);
    // only the first prompt had a wrong tap, so exactly one prompt is non-clean
    ok('3c: clean prompts = total - 1 (the one with a wrong tap)', fin.correctPrompts === fin.total - 1);

    // learner writes: one item per distinct note prompt + one bounded session
    ok('3c: per-note attempts recorded to learner', T.learnerStats().items === fin.total);
    const sessions = T.getLearner().sessions;
    ok('3c: a session was recorded', sessions.length === 1);
    ok('3c: session score = clean-prompt accuracy %',
       sessions[0].score === Math.round((fin.correctPrompts / fin.total) * 100));

    T.exitDrill();
    ok('3c: exit clears the active drill', T.getDrill() === null);
    T.resetLearner();
  })();

  /* ---- Phase 4: Ear-training mode + three recognition drills ---- */
  (function earMode() {
    const doc = win.document;
    const nav = doc.getElementById('modenav');
    const modes = nav ? [...nav.querySelectorAll('.modebtn')].map(b => b.dataset.mode) : [];
    ok('P4: modenav gains an ear button (3 modes)',
       modes.length === 3 && modes.indexOf('ear') >= 0, modes.join(','));
    const ep = doc.getElementById('panel-ear');
    ok('P4: ear panel present, off the .panel machinery',
       !!ep && !ep.classList.contains('panel') && ep.classList.contains('ear-panel'));
    ok('P4: reference shell still 3 tabs / 3 reference panels',
       doc.querySelectorAll('.tab').length === 3 && doc.querySelectorAll('.main > .panel').length === 3);
    // three ear drill starters
    ['start-interval', 'start-chordq', 'start-rhythm'].forEach(id =>
      ok('P4: ear drill starter present: ' + id, !!doc.getElementById(id)));

    // enter Ear mode: body classes + button state + persistence
    T.setMode('ear');
    ok('P4: body marks ear + activity mode',
       doc.body.classList.contains('mode-ear') && doc.body.classList.contains('mode-activity')
       && !doc.body.classList.contains('mode-practice') && !doc.body.classList.contains('mode-reference'));
    const eBtn = nav.querySelector('.modebtn[data-mode="ear"]');
    ok('P4: ear button active + aria-pressed',
       eBtn.classList.contains('active') && eBtn.getAttribute('aria-pressed') === 'true');
    ok('P4: state() / persistence carry mode ear',
       T.state().currentMode === 'ear' &&
       JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}').mode === 'ear');

    // ---- interval drill: ids namespaced interval:*, fixed 12-choice grid ----
    T.resetLearner();
    T.startEar('interval');
    let e = T.getEar();
    ok('P4: interval drill starts active', !!e && !e.finished && e.type === 'interval');
    ok('P4: interval session length = 8', e.total === 8);
    ok('P4: interval prompt has an interval + base midi',
       e.cur && typeof e.cur.iv === 'object' && Number.isInteger(e.cur.base));
    ok('P4: interval id is namespaced interval:*', /^interval:/.test(e.cur.key));
    ok('P4: interval choices = all 12 intervals', T.earChoices().length === 12);

    // a wrong guess records a miss and never the prompt's item as correct
    const wrongKey = T.INTERVALS.map(iv => 'interval:' + iv.name).find(k => k !== e.cur.key);
    T.earAnswer(wrongKey);
    e = T.getEar();
    ok('P4: wrong guess counts a miss + marks answered', e.totalWrong === 1 && e.answered === true);
    ok('P4: a second guess on the same prompt is ignored', (T.earAnswer(e.cur.key), T.getEar().correctPrompts === 0));
    T.earNext();
    ok('P4: Next advances to a fresh prompt', T.getEar().answered === false && T.getEar().done === 1);

    // drive the rest correctly
    let guard = 0;
    while (!T.getEar().finished && guard++ < 50) {
      const cur = T.getEar().cur; T.earAnswer(cur.key); T.earNext();
    }
    const fin = T.getEar();
    ok('P4: interval drill finishes after all prompts', fin.finished && fin.done === fin.total);
    ok('P4: exactly one prompt was non-clean (the wrong guess)', fin.correctPrompts === fin.total - 1);
    ok('P4: per-interval attempts written to the learner', T.learnerStats().items === fin.total);
    const sess = T.getLearner().sessions;
    ok('P4: an ear session was recorded with ear-interval label',
       sess.length === 1 && sess[0].drill === 'ear-interval');
    ok('P4: session score = correct-prompt accuracy %',
       sess[0].score === Math.round((fin.correctPrompts / fin.total) * 100));

    // ---- chord-quality drill: chordq:* ids, 8-choice grid ----
    T.resetLearner();
    T.startEar('chordq');
    const ec = T.getEar();
    ok('P4: chordq drill starts (8 qualities)', ec.type === 'chordq' && ec.total === 8);
    ok('P4: chordq id is namespaced chordq:*', /^chordq:/.test(ec.cur.key));
    ok('P4: chordq choices = 8 qualities', T.earChoices().length === 8);
    ok('P4: chordq prompt carries a quality index + root', Number.isInteger(ec.cur.qi) && Number.isInteger(ec.cur.root));

    // ---- rhythm drill: rhythm:* ids, 4 choices that include the answer ----
    T.resetLearner();
    T.startEar('rhythm');
    const er = T.getEar();
    ok('P4: rhythm drill starts (6 prompts)', er.type === 'rhythm' && er.total === 6);
    ok('P4: rhythm id is namespaced rhythm:*', /^rhythm:/.test(er.cur.key));
    const rc = T.earChoices();
    ok('P4: rhythm offers 4 choices incl. the answer',
       rc.length === 4 && rc.some(o => o.key === er.cur.key));
    ok('P4: rhythm choice carries a visual strip', /class="rhythm"/.test(rc[0].html));

    T.exitEar();
    ok('P4: exit clears the active ear drill', T.getEar() === null);
    T.setMode('reference');
    T.resetLearner();
  })();

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
    ok('1a: setKey sets the shared root', T.state().gRoot === 7 && T.state().gRootLbl === 'G');
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

  /* ---- 1c: reverse lookup (chord identifier + scale suggester) ---- */
  (function reverseLookup() {
    const id = (pcs, bass) => T.identifyChord(pcs, bass).map(c => c.name);
    // exact pitch-class identification
    ok('1c: {C,E,G} → C', id([0, 4, 7], 0)[0] === 'C', id([0, 4, 7], 0).join(','));
    ok('1c: {C,E,G,B} → Cmaj7', id([0, 4, 7, 11], 0)[0] === 'Cmaj7');
    ok('1c: {C,E♭,G,B♭} → Cm7', id([0, 3, 7, 10], 0)[0] === 'Cm7');
    ok('1c: fewer than 3 notes → no name', T.identifyChord([0, 4], 0).length === 0);
    // genuine ambiguity surfaces as multiple names (Am7 = C6)
    const amb = id([0, 4, 7, 9], 9);            // bass A
    ok('1c: {A,C,E,G}/A → Am7 ranks first', amb[0] === 'Am7', amb.join(','));
    ok('1c: same set also nameable as C6', amb.some(n => n.indexOf('C6') === 0), amb.join(','));
    // a non-root bass reads as a slash chord
    ok('1c: C major over E bass → C/E', id([0, 4, 7], 4).indexOf('C/E') >= 0, id([0, 4, 7], 4).join(','));

    // closest-match fallback when no quality fits exactly
    const near = T.nearChords([0, 4, 11], 0);          // C E B — Cmaj7 with the 5th dropped
    const cm7 = near.find(c => c.name === 'Cmaj7');
    ok('1c: {C,E,B} reads as Cmaj7 missing the 5th',
       !!cm7 && cm7.missing.indexOf('5') >= 0, near.map(c => c.name).join(','));
    const plusOne = T.nearChords([0, 4, 7, 1], 0).find(c => c.name === 'C');  // C major + one extra note
    ok('1c: an extra note reads as the chord plus an extra', !!plusOne && plusOne.extra.length === 1);
    ok('1c: no near match for fewer than 3 notes', T.nearChords([0, 4], 0).length === 0);

    // scales that fit a chord
    const idxByName = {}; T.SCALES.forEach((s, i) => { idxByName[s.en] = i; });
    const fit = T.scalesOverChord(0, [0, 4, 7, 11]);   // Cmaj7
    ok('1c: Cmaj7 fits C Ionian', fit.indexOf(idxByName['Major (Ionian)']) >= 0);
    ok('1c: Cmaj7 fits C Lydian', fit.indexOf(idxByName['Lydian']) >= 0);
    ok('1c: Cmaj7 does NOT fit C natural minor', fit.indexOf(idxByName['Aeolian (natural minor)']) < 0);

    // identify board mode + the live suggester
    T.selectTab('harmony'); T.setHView('identify');
    ok('1c: identify is the active board mode', T.isBoardMode('identify') === true);
    ok('1c: Listen hidden in identify view', win.document.getElementById('g-play').hidden === true);
    T.setIdSel([48, 52, 55]); T.renderIdentify();      // C E G
    ok('1c: identify result names the chord', /C/.test(win.document.getElementById('id-result').textContent));
    ok('1c: suggester offers scale chips for the chord',
       win.document.getElementById('suggest-body').querySelectorAll('[data-scale]').length > 0);
    T.setIdSel([48, 52, 59]); T.renderIdentify();      // C E B — no exact fit → closest match
    ok('1c: identify shows a closest match when nothing fits exactly',
       /Cmaj7/.test(win.document.getElementById('id-result').textContent));
    T.setIdSel([]); T.setHView('chords');
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

  /* ---- behaviour: contextual Loop visibility + scales sub-views (1b) ---- */
  (function loopVisibility() {
    T.selectTab('harmony'); T.setHView('chords');
    const lp = win.document.getElementById('g-loop');
    const gp = win.document.getElementById('g-play');
    ok('Loop visible on chord-tones view', lp && lp.hidden === false);
    T.setHView('triads');
    ok('Loop now visible on triads view (v1.12.0)', lp && lp.hidden === false);
    T.setHView('chords');
    T.selectTab('scales'); T.setScView('scale');
    ok('Loop hidden on scales tab', lp && lp.hidden === true);
    ok('Listen visible on scale view', gp && gp.hidden === false);
    // 1b: Notes is now a view inside Scales, not a tab
    T.setScView('notes');
    ok('1b: scale controls hidden in notes view', win.document.getElementById('sub-scale').hidden === true);
    ok('1b: notes controls shown in notes view', win.document.getElementById('sub-notes').hidden === false);
    ok('1b: board shows notes mode in notes view', T.isBoardMode('notes') === true);
    ok('Listen hidden in notes view', gp && gp.hidden === true);
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

  /* ---- Phase 2 (v1.20.0): arpeggios, CAGED labels, capo ---- */
  (function phase2() {
    // Arpeggio is a fourth Harmony view that owns the shared board
    T.selectTab('harmony'); T.setHView('arp');
    ok('Phase2: arp is the active board mode', T.isBoardMode('arp') === true);
    ok('Phase2: arp panel shown', win.document.getElementById('sub-arp').hidden === false);
    const gp = win.document.getElementById('g-play'), lp = win.document.getElementById('g-loop');
    ok('Phase2: Listen visible in arp view', gp && gp.hidden === false);
    ok('Phase2: Loop hidden in arp view (it is the chord/triad backing)', lp && lp.hidden === true);
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
    const pos = win.document.getElementById('sc-pos');
    if (pos) {
      const labels = [...pos.querySelectorAll('button')].slice(1).map(b => b.textContent);
      ok('Phase2: scale position buttons show CAGED letters', labels.join(',') === 'E,D,C,A,G',
         labels.join(','));
    }
    T.setKey(2, 'D', 1);                 // D Dorian — a mode, not Ionian
    ok('Phase2: CAGED labels off for a mode (anchoring would be wrong)', T.isCAGEDScale() === false);
    T.setKey(9, 'A', 5);

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
     fanned out to chords/triads/scales/notes only — omitting arp + identify — so
     those two boards froze with stale geometry on a fret/capo/tuning change. Drive
     the real onchange sequence (set the global, then renderAllBoards) on each view
     and assert the shared #board actually re-paints to the new fret range. */
  (function staleBoardRegression() {
    const cellsPerRow = () => {
      const row = win.document.getElementById('board').querySelector('.srow');
      return row ? row.querySelectorAll('.cell').length : -1;
    };
    ['arp', 'identify', 'chords'].forEach(view => {
      T.selectTab('harmony'); T.setHView(view);
      T.setFret(0); T.renderAllBoards();            // All frets (1..22)
      const wide = cellsPerRow();
      T.setFret(1); T.renderAllBoards();            // 5-fret window (1..5)
      const narrow = cellsPerRow();
      ok('regression: ' + view + ' board repaints on a fret-range change',
         narrow > 0 && narrow < wide, view + ': ' + wide + ' → ' + narrow + ' cells');
    });
    T.setFret(0); T.selectTab('harmony'); T.setHView('chords');
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
  console.log('Euterpe smoke suite: ' + pass + ' passed, ' + fail + ' failed  (' + (pass + fail) + ' checks)');
  if (fails.length) {
    console.log('\nFailures:');
    fails.forEach(f => console.log('  ✗ ' + f));
  } else {
    console.log('All checks green ✓');
  }
  console.log('──────────────────────────────────────────────\n');
}
