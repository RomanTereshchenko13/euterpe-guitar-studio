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
  // build.js re-serializes the sliced changelog as JSON ("v":"2.11.0"), while the
  // src/ form is hand-written JS (v:'2.11.0'); accept either so the invariant is
  // about the entry existing, not about how build.js happens to emit it.
  ok('CHANGELOG has current-version entry',
     ver && new RegExp('"?v"?:\\s*[\'"]' + ver.replace(/\./g, '\\.') + '[\'"]').test(html),
     'no CHANGELOG entry for ' + ver);
  // the slice must never drop the release the app is currently reporting, and the
  // modal must offer a way to reach the rest.
  ok('changelog slice keeps the newest release first',
     ver && new RegExp('CHANGELOG\\s*=\\s*\\[\\s*\\{"v":"' + ver.replace(/\./g, '\\.') + '"').test(html),
     'sliced CHANGELOG does not lead with ' + ver);
  ok('changelog modal links to the full history', html.includes('cl-older'));

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

  // The "no silent catch(e){}" guardrail moved to tools/lint.js: it's a rule about
  // how src/ is written, and the bundle now ships with comments stripped, so the
  // `catch(e){ /* why */ }` that satisfies it isn't visible in the built file.
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
  // 1b's single shared reference board (#board) is still exactly one; the Practice
  // drills add their own boards — note-naming (#drill-board), targeting (#tg-board, 6a),
  // call-response (#cr-board, 6c) and subdivision/timing (#sd-board, 7a) — so five
  // fretboards total now.
  ok('1b: one shared reference board (#board)',
     win.document.querySelectorAll('#board.fretboard').length === 1);
  ok('3c: drill has its own board, five fretboards total',
     win.document.querySelectorAll('.fretboard').length === 5 && !!win.document.getElementById('drill-board'),
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
   'practice_grp_ear','ear_intervals','ear_intervals_meta','ear_chords','ear_chords_meta',
   'ear_rhythm','ear_rhythm_meta','ear_int_prompt','ear_chord_prompt','ear_rhythm_prompt',
   'ear_replay','ear_next','ear_right','ear_wrong','ear_got',
   'pwa_install','pwa_install_tip','pwa_update','pwa_update_btn','pwa_dismiss',
   'tb_volume','tb_tuner',
   'practice_grp_fretboard','practice_grp_rhythm','drill_changes','drill_changes_meta',
   'cm_pair','cm_dur','cm_sec','cm_click','cm_start','cm_stop','cm_setup_note',
   'cm_changes','cm_cpm','cm_best','cm_tap_hint','cm_undo','cm_newbest',
   'drill_strum','drill_strum_meta','sp_pattern','sp_chord','sp_play','sp_stop','sp_hint',
   'drill_comp','drill_comp_meta','co_now','co_next','co_hint',
   'oc_mode','oc_chords','oc_tones',
   'sp_swing','sp_accent','sp_mute','sp_band',
   'practice_grp_lead','drill_target','drill_target_meta','tg_prog','tg_pos','tg_deg','tg_hits','tg_acc','tg_hint',
   'drill_callresp','drill_callresp_meta','cr_listen','cr_your_turn','cr_replay','cr_echoed','cr_rounds','cr_hint',
   'a11y_palette','a11y_shapes',
   'wc_title','wc_lead','wc_ref','wc_practice','wc_got',
   'tun_custom','cl_older',
   'prog_active','prog_due','prog_review','share_btn','share_copied',
   'mic_open','mic_title','mic_start','mic_stop','mic_cents','mic_string','mic_play_hint',
   'mic_intune','mic_hint','mic_asking','mic_denied','mic_nodev','mic_busy','mic_err',
   'mic_unsupported',
   'cal_label','cal_run','cal_running','cal_done','cal_unheard','cal_cancelled','cal_busy',
   'sd_listen','sd_hint_scored','on_ms_off','on_tight','on_close','on_loose','on_none',
   'on_rushing','on_dragging','on_evenness','on_played','on_ms'].forEach(k => {
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

  /* ---- Phase 4: the three recognition drills, now an Ear group under Practice ---- */
  (function earMode() {
    const doc = win.document;
    const nav = doc.getElementById('modenav');
    const modes = nav ? [...nav.querySelectorAll('.modebtn')].map(b => b.dataset.mode) : [];
    ok('P4: ear folded into Practice — 2 modes, no ear mode',
       modes.length === 2 && modes.indexOf('ear') < 0, modes.join(','));
    ok('P4: the separate ear panel + home are gone',
       !doc.getElementById('panel-ear') && !doc.getElementById('ear-home')
       && !doc.getElementById('ear-progress') && !doc.querySelector('.ear-panel'));
    ok('P4: ear drill area now lives inside the practice panel',
       !!doc.querySelector('#panel-practice #ear-area'));
    ok('P4: reference shell still 3 tabs / 3 reference panels',
       doc.querySelectorAll('.tab').length === 3 && doc.querySelectorAll('.main > .panel').length === 3);
    // three ear drill starters, now cards in the practice home
    ['start-interval', 'start-chordq', 'start-rhythm'].forEach(id =>
      ok('P4: ear drill starter present in practice home: ' + id,
         !!doc.querySelector('#practice-home #' + id)));

    // the ear drills ride the Practice mode: body classes + button state + persistence
    T.setMode('practice');
    ok('P4: body marks practice mode only',
       doc.body.classList.contains('mode-practice')
       && !doc.body.classList.contains('mode-ear') && !doc.body.classList.contains('mode-activity')
       && !doc.body.classList.contains('mode-reference'));
    const eBtn = nav.querySelector('.modebtn[data-mode="practice"]');
    ok('P4: practice button active + aria-pressed',
       eBtn.classList.contains('active') && eBtn.getAttribute('aria-pressed') === 'true');
    ok('P4: state() / persistence carry mode practice',
       T.state().currentMode === 'practice' &&
       JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}').mode === 'practice');

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

  /* ---- Phase 5a: chord-change fluency (one-minute changes) coach drill ---- */
  (function changesDrill() {
    const doc = win.document;
    // home gains the Rhythm group + the new card; the drill area exists
    ok('5a: rhythm drill card present (start-changes)', !!doc.getElementById('start-changes'));
    ok('5a: chord-change area present (cm-area)', !!doc.getElementById('cm-area'));
    ok('5a: practice home grouped by pillar', doc.querySelectorAll('#practice-home .practice-section').length >= 2);
    // the drill uses chord-diagram SVGs, not a fretboard, so the board count is unchanged
    // (5 total: reference #board + note-naming/targeting/call-response/timing drill boards)
    ok('5a: no extra fretboard added', doc.querySelectorAll('.fretboard').length === 5);

    // presets + durations are sane
    ok('5a: at least 6 chord pairs', T.CM_PAIRS.length >= 6);
    ok('5a: 60s is a duration option', T.CM_DURS.indexOf(60) >= 0);

    // setup → run lifecycle
    T.resetLearner();
    T.setMode('practice');
    T.startChanges();
    ok('5a: startChanges opens setup phase', T.getCm() && T.getCm().phase === 'setup');
    T.setCmPair(3); T.setCmDur(0);          // pair index 3, 30 s
    T.cmBegin();
    let cm = T.getCm();
    ok('5a: cmBegin enters the running phase', cm.phase === 'run' && cm.pairIdx === 3 && cm.dur === 30);
    ok('5a: count starts at zero', cm.count === 0);

    // tally counts taps; undo floors at zero
    T.cmTap(); T.cmTap(); T.cmTap();
    ok('5a: each tap counts a change', T.getCm().count === 3);
    T.cmUntap();
    ok('5a: undo removes one change', T.getCm().count === 2);
    T.cmUntap(); T.cmUntap(); T.cmUntap();   // over-undo
    ok('5a: undo floors at zero', T.getCm().count === 0);

    // a 30s run with 5 changes = 10 changes/minute; finish records a session + sets a best
    for (let i = 0; i < 5; i++) T.cmTap();
    T.finishChanges();
    cm = T.getCm();
    ok('5a: finish computes changes-per-minute (5 in 30s = 10)', cm.cpm === 10);
    ok('5a: finish marks a new personal best', cm.newBest === true && cm.best === 10);
    const sessId = T.cmPairId(3);
    const sess = T.getLearner().sessions;
    ok('5a: a session is recorded under the pair id', sess.length === 1 && sess[0].drill === sessId);
    ok('5a: session score is the changes-per-minute', sess[0].score === 10);
    ok('5a: cmPairBest reads the best from sessions', T.cmPairBest(3) === 10);

    // a weaker run does not beat the best
    T.cmBegin();
    T.cmTap();                 // 1 change in 30s = 2 cpm
    T.finishChanges();
    cm = T.getCm();
    ok('5a: a weaker run is not a new best', cm.newBest === false && cm.cpm === 2);
    ok('5a: best stays at the prior record', T.cmPairBest(3) === 10);

    // changes drill writes sessions, not per-item SRS (accuracy stays about recognition)
    ok('5a: changes drill mints no learner items', T.learnerStats().items === 0);

    // exit clears the drill; leaving Practice mode also exits it
    T.exitChanges();
    ok('5a: exit clears the active drill', T.getCm() === null);
    T.startChanges();
    T.setMode('reference');
    ok('5a: leaving Practice exits a running changes drill', T.getCm() === null);
    T.resetLearner();
  })();

  /* ---- Phase 5b: strumming-pattern trainer (coach visualizer) ---- */
  (function strumDrill() {
    const doc = win.document;
    ok('5b: strum drill card present (start-strum)', !!doc.getElementById('start-strum'));
    ok('5b: strum area + grid present', !!doc.getElementById('sp-area') && !!doc.getElementById('sp-grid'));

    // patterns are well-formed: 8 eighth-note slots, only D/U/'' and inline en+uk names
    ok('5b: at least 4 strum patterns', T.STRUM_PATTERNS.length >= 4);
    ok('5b: every pattern is one 4/4 bar of 8 slots',
       T.STRUM_PATTERNS.every(p => p.seg.length === 8 && p.seg.every(s => s === 'D' || s === 'U' || s === '')));
    ok('5b: every pattern carries en + uk names',
       T.STRUM_PATTERNS.every(p => p.en && p.uk));

    T.resetLearner();
    T.initAudio();
    T.setCtxNow(0);
    T.setMode('practice');
    T.startStrum();
    ok('5b: startStrum opens the trainer, not yet playing', !!T.getSp() && T.getSp().playing === false);
    T.setSpPattern(2);
    T.spPlay();
    let sp = T.getSp();
    ok('5b: play starts the loop on the chosen pattern', sp.playing === true && sp.patIdx === 2);

    // drive the scheduler forward; over ~10s even a slow tempo clears one full bar (8 slots)
    for (let s = 0; s <= 10; s += 0.05) { T.setCtxNow(s); T.schedAdvance(); }
    sp = T.getSp();
    ok('5b: the playhead advances through the 8 slots', sp.slot >= 0 && sp.slot < 8);
    ok('5b: at least one full bar elapses', sp.bars >= 1);

    T.spStop();
    ok('5b: stop ends the loop', T.getSp().playing === false);
    const ss = T.getLearner().sessions;
    ok('5b: a practiced strum session is recorded (bars >= 1)',
       ss.length >= 1 && /^strum:/.test(ss[ss.length - 1].drill) && ss[ss.length - 1].score >= 1);
    ok('5b: strum coach mints no per-item SRS', T.learnerStats().items === 0);

    // leaving Practice stops + clears a running trainer
    T.spPlay();
    T.setMode('reference');
    ok('5b: leaving Practice exits a running strum trainer', T.getSp() === null);
    T.setCtxNow(0);
    T.resetLearner();
  })();

  /* ---- Phase 5c: comping, now the `chords` mode of the merged over-the-changes drill ----
     Comp-the-progression and chord-tone targeting were one machine behind two cards; they
     are now one drill with a mode. These checks pin the comping half: its card still opens
     the drill, it opens in the right mode, the lead-only controls stay out of the way, and
     it still records under the `comp:` session namespace so pre-merge history reads. */
  (function compMode() {
    const doc = win.document;
    ok('5c: comp drill card present (start-comp)', !!doc.getElementById('start-comp'));
    ok('5c: the separate comp area is gone', !doc.getElementById('co-area'));
    ok('5c: comp shares the over-the-changes area + stage',
       !!doc.getElementById('tg-area') && !!doc.getElementById('tg-now') && !!doc.getElementById('tg-next'));
    ok('5c: three rhythm-group drill cards',
       ['start-changes', 'start-strum', 'start-comp'].every(id => !!doc.getElementById(id)));

    // tgBuildBars expands a preset (offsets, qi, bars) into one chord per bar, in the key
    T.setKey(0, 'C');                       // context root C → I–V–vi–IV = C G Am F
    const bars = T.tgBuildBars(T.SEQ_PRESETS[1]);
    ok('5c: I–V–vi–IV expands to 4 bars', bars.length === 4);
    ok('5c: bars are resolved to the context key (C G Am F)',
       bars[0].pc === 0 && bars[1].pc === 7 && bars[2].pc === 9 && bars[3].pc === 5,
       bars.map(b => b.pc).join(','));

    T.resetLearner();
    T.initAudio();
    T.setCtxNow(0);
    T.setMode('practice');
    T.startComp();
    ok('5c: the Rhythm card opens the drill in chords mode', T.getOcMode() === 'chords');
    ok('5c: startComp opens the drill, not yet playing', !!T.getTg() && T.getTg().playing === false);
    ok('5c: comping hides the neck and the lead-only rows',
       doc.getElementById('tg-board-wrap').hidden === true &&
       doc.getElementById('tg-tone-rows').hidden === true);
    T.setTargetProg(2);                      // I–IV–V (3 bars)
    T.targetPlay();
    let co = T.getTg();
    ok('5c: play starts the progression loop', co.playing === true && co.presetIdx === 2 && co.bars.length === 3);

    // drive ~10s of the scheduler → the bar index advances and at least one cycle wraps
    for (let s = 0; s <= 10; s += 0.05) { T.setCtxNow(s); T.schedAdvance(); }
    co = T.getTg();
    ok('5c: the bar pointer stays in range', co.bar >= 0 && co.bar < co.bars.length);
    ok('5c: at least one full progression cycle elapses', co.cycles >= 1);
    // a tap can't score in comping mode — there is no board to tap
    const beforeHits = co.hits;
    T.targetAnswer(0, 0);
    ok('5c: taps do not score while comping', T.getTg().hits === beforeHits);

    T.targetStop();
    ok('5c: stop ends the loop', T.getTg().playing === false);
    const ss = T.getLearner().sessions;
    ok('5c: a practiced comp session is recorded (bars comped)',
       ss.length >= 1 && /^comp:/.test(ss[ss.length - 1].drill) && ss[ss.length - 1].score >= 1);
    ok('5c: comp coach mints no per-item SRS', T.learnerStats().items === 0);

    // leaving Practice stops + clears a running drill
    T.targetPlay();
    T.setMode('reference');
    ok('5c: leaving Practice exits a running comp drill', T.getTg() === null);
    T.setCtxNow(0);
    T.resetLearner();
  })();

  /* ---- Phase 5b+5d merged: the feel half of the Strumming & feel lab ----
     Groove & feel used to be its own card driving its own 8th-note clock; it is now
     the swing/accent/mute/band layer over the pattern grid. These checks guard that
     the merge kept the feel controls working AND that the old card is really gone
     (a stray start-groove would mean the practice home and the drill disagreed). */
  (function strumFeel() {
    const doc = win.document;
    ok('5d: the separate groove card is gone', !doc.getElementById('start-groove'));
    ok('5d: the separate groove area is gone', !doc.getElementById('gf-area'));
    ok('5d: feel controls live in the strum area',
       !!doc.getElementById('sp-swings') && !!doc.getElementById('sp-accent') &&
       !!doc.getElementById('sp-mute') && !!doc.getElementById('sp-band'));
    // swing settings: straight → shuffle, each named in both languages, amount ascending
    ok('5d: three swing feels (straight/swing/shuffle)', T.SP_SWINGS.length === 3);
    ok('5d: swing feels carry en + uk names + an amount',
       T.SP_SWINGS.every(s => s.en && s.uk && typeof s.amt === 'number'));
    ok('5d: straight feel has zero swing', T.SP_SWINGS[0].amt === 0 && T.SP_SWINGS[T.SP_SWINGS.length - 1].amt > 0);

    T.resetLearner();
    T.initAudio();
    T.setCtxNow(0);
    T.setMode('practice');
    T.startStrum();
    // the combination neither drill could reach before: a swung, palm-muted,
    // band-backed pattern — all four feel controls on at once over a chosen pattern.
    T.setSpPattern(2); T.setSpSwing(2); T.setSpAccent(true); T.setSpMute(true); T.setSpBand(true);
    T.spPlay();
    ok('5d: play starts the loop with the feel layer engaged', T.getSp().playing === true);

    // drive ~10s of the scheduler → the 8th-note playhead moves and a bar wraps
    for (let s = 0; s <= 10; s += 0.05) { T.setCtxNow(s); T.schedAdvance(); }
    const sp = T.getSp();
    ok('5d: the 8th-note playhead stays in range', sp.slot >= 0 && sp.slot < 8);
    ok('5d: at least one bar elapses with swing + band on', sp.bars >= 1);

    T.spStop();
    ok('5d: stop ends the loop', T.getSp().playing === false);
    const ss = T.getLearner().sessions;
    ok('5d: a practiced session is recorded under the strum namespace',
       ss.length >= 1 && /^strum:/.test(ss[ss.length - 1].drill) && ss[ss.length - 1].score >= 1);
    ok('5d: the merged coach still mints no per-item SRS', T.learnerStats().items === 0);

    T.spPlay();
    T.setMode('reference');
    ok('5d: leaving Practice exits the running lab', T.getSp() === null);
    T.setCtxNow(0);
    T.resetLearner();
    T.setSpSwing(0); T.setSpAccent(false); T.setSpMute(false); T.setSpBand(false);
  })();

  /* ---- Phase 6a: chord-tone targeting — the `tones` mode of the merged drill ---- */
  (function targetDrill() {
    const doc = win.document;
    ok('6a: target drill card present (start-target)', !!doc.getElementById('start-target'));
    ok('6a: target area + board + stage present',
       !!doc.getElementById('tg-area') && !!doc.getElementById('tg-board') &&
       !!doc.getElementById('tg-now') && !!doc.getElementById('tg-next') && !!doc.getElementById('tg-beats'));
    ok('6a: Lead group adds a card beyond the three Rhythm ones',
       ['start-changes', 'start-strum', 'start-comp', 'start-target'].every(id => !!doc.getElementById(id)));
    ok('6a: both cards point at one registered drill',
       T.DRILLS.filter(d => d.area === 'tg-area').length === 1);

    // bars resolve the preset to the CURRENT key (spine #1): in C, I–V–vi–IV starts on C(0)
    T.resetLearner();
    T.initAudio();
    T.setCtxNow(0);
    T.setMode('practice');
    T.setKey(0, 'C');
    T.setTargetProg(2);            // I–IV–V (3 bars, so a cycle wraps within the 10s drive)
    T.startTarget();
    let tg = T.getTg();
    ok('6a: the Lead card opens the drill in tones mode', T.getOcMode() === 'tones');
    ok('6a: targeting shows the neck and the lead-only rows',
       doc.getElementById('tg-board-wrap').hidden === false &&
       doc.getElementById('tg-tone-rows').hidden === false);
    ok('6a: startTarget opens the drill, not yet playing', !!tg && tg.playing === false);
    ok('6a: bars expand to one chord per bar in the key', tg.bars.length === 3 && tg.bars[0].pc === 0);

    T.targetPlay();
    tg = T.getTg();
    ok('6a: play starts the progression loop', tg.playing === true);

    // drive ~10s of the scheduler → bars advance and the target set fills synchronously
    for (let s = 0; s <= 10; s += 0.05) { T.setCtxNow(s); T.schedAdvance(); }
    tg = T.getTg();
    ok('6a: the bar playhead stays in range', tg.bar >= 0 && tg.bar < tg.bars.length);
    ok('6a: at least one cycle of the progression elapses', tg.cycles >= 1);
    ok('6a: the current chord lights its tones as targets', tg.targetPcs.size >= 3);

    // a tap on a target pc scores a hit; a tap off the chord scores a miss
    const targetPc = [...tg.targetPcs][0];
    const offPc = [0,1,2,3,4,5,6,7,8,9,10,11].find(pc => !tg.targetPcs.has(pc));
    const h0 = tg.hits, m0 = tg.misses;
    // tap every board dot matching the target pc → at least one hit registered
    doc.querySelectorAll('#tg-board .dot.quiz').forEach(d => {
      if (+d.dataset.pc === targetPc) T.targetAnswer(+d.dataset.si, +d.dataset.f);
    });
    tg = T.getTg();
    ok('6a: tapping a chord tone scores a hit', tg.hits > h0);
    // tap an off-chord dot → a miss
    let tapped = false;
    doc.querySelectorAll('#tg-board .dot.quiz').forEach(d => {
      if (!tapped && +d.dataset.pc === offPc) { T.targetAnswer(+d.dataset.si, +d.dataset.f); tapped = true; }
    });
    tg = T.getTg();
    ok('6a: tapping off the chord scores a miss', tapped && tg.misses > m0);
    ok('6a: accuracy is hits / all taps as a percent', T.tgAccuracy() === Math.round(100 * tg.hits / (tg.hits + tg.misses)));

    T.targetStop();
    tg = T.getTg();
    ok('6a: stop ends the loop', tg.playing === false);
    const ts = T.getLearner().sessions;
    ok('6a: a practiced targeting session is recorded (accuracy)',
       ts.length >= 1 && /^target:/.test(ts[ts.length - 1].drill));
    ok('6a: targeting coach mints no per-item SRS', T.learnerStats().items === 0);

    T.targetPlay();
    T.setMode('reference');
    ok('6a: leaving Practice exits a running targeting drill', T.getTg() === null);
    T.setCtxNow(0);
    T.resetLearner();
  })();

  /* ---- Phase 6b: arpeggios over changes (a box windows the targets to one shape) ---- */
  (function targetArp() {
    const doc = win.document;
    ok('6b: target drill has a position picker (tg-pos)', !!doc.getElementById('tg-pos'));

    T.resetLearner();
    T.initAudio();
    T.setCtxNow(0);
    T.setMode('practice');
    T.setKey(0, 'C');
    T.setFret(0);                  // all frets, so the box window (frets 8–12 in C) is on the board
    T.setTargetProg(2);
    T.startTarget();
    T.targetPlay();
    for (let s = 0; s <= 4; s += 0.05) { T.setCtxNow(s); T.schedAdvance(); }

    // whole-neck default: no window
    let tg = T.getTg();
    ok('6b: default position is the whole neck (no window)', tg.win === null);

    // pick a box → a 5-fret window; only tones inside it are drillable
    T.setTargetPos(1);
    tg = T.getTg();
    ok('6b: choosing a position sets a 5-fret window', Array.isArray(tg.win) && tg.win[1] - tg.win[0] === 4);
    const [lo, hi] = tg.win;

    // a target pc tapped OUTSIDE the box is ignored (not scored); INSIDE it scores a hit
    const tpc = [...tg.targetPcs][0];
    const dots = [...doc.querySelectorAll('#tg-board .dot.quiz')].map(d => ({
      si: +d.dataset.si, f: +d.dataset.f, pc: +d.dataset.pc }));
    const inBox = dots.find(d => d.pc === tpc && d.f >= lo && d.f <= hi);
    const outBox = dots.find(d => d.pc === tpc && (d.f < lo || d.f > hi));
    const h0 = tg.hits, m0 = tg.misses;
    if (outBox) T.targetAnswer(outBox.si, outBox.f);
    tg = T.getTg();
    ok('6b: a chord tone tapped outside the shape is ignored', tg.hits === h0 && tg.misses === m0);
    if (inBox) T.targetAnswer(inBox.si, inBox.f);
    tg = T.getTg();
    ok('6b: a chord tone tapped inside the shape scores a hit', inBox ? tg.hits === h0 + 1 : true);

    T.targetStop();
    T.setTargetPos(0);
    T.setMode('reference');
    T.setCtxNow(0);
    T.resetLearner();
  })();

  /* ---- Phase 6c: target-note soloing (light ONE degree; other chord tones neutral) ---- */
  (function targetNote() {
    const doc = win.document;
    ok('6c: target drill has a target-note picker (tg-deg)', !!doc.getElementById('tg-deg'));

    T.resetLearner();
    T.initAudio();
    T.setCtxNow(0);
    T.setMode('practice');
    T.setKey(0, 'C');
    T.setFret(0);
    T.setTargetProg(2);         // I–IV–V, all major triads → root/3rd/5th present, no 7th
    T.startTarget();
    T.targetPlay();
    for (let s = 0; s <= 4; s += 0.05) { T.setCtxNow(s); T.schedAdvance(); }

    let tg = T.getTg();
    const allTones = tg.targetPcs.size;
    ok('6c: default lights the whole chord', allTones >= 3 && tg.chordPcs.size === allTones);

    // pick "the 3rd" → exactly one lit target, but the full chord is still known
    T.setTargetDeg(2);
    tg = T.getTg();
    ok('6c: choosing a degree narrows the lit target to one tone', tg.targetPcs.size === 1);
    ok('6c: the full chord is still tracked (for neutral notes)', tg.chordPcs.size >= 3);
    const thirdPc = [...tg.targetPcs][0];
    ok('6c: the lit tone is the third of the chord', tg.degMap[thirdPc] === '3' || tg.degMap[thirdPc] === '♭3');

    // scoring: the target tone → hit; another chord tone → neutral (no hit, no miss);
    // an off-chord tone → miss.
    const dots = [...doc.querySelectorAll('#tg-board .dot.quiz')].map(d => ({
      si: +d.dataset.si, f: +d.dataset.f, pc: +d.dataset.pc }));
    const otherChordPc = [...tg.chordPcs].find(pc => !tg.targetPcs.has(pc));
    const offPc = [0,1,2,3,4,5,6,7,8,9,10,11].find(pc => !tg.chordPcs.has(pc));
    const hit = dots.find(d => d.pc === thirdPc);
    const neutral = dots.find(d => d.pc === otherChordPc);
    const off = dots.find(d => d.pc === offPc);
    let h0 = tg.hits, m0 = tg.misses;
    if (neutral) T.targetAnswer(neutral.si, neutral.f);
    tg = T.getTg();
    ok('6c: another chord tone is neutral (no hit, no miss)', tg.hits === h0 && tg.misses === m0);
    if (off) T.targetAnswer(off.si, off.f);
    tg = T.getTg();
    ok('6c: an off-chord note misses', off ? tg.misses === m0 + 1 : true);
    h0 = tg.hits;
    if (hit) T.targetAnswer(hit.si, hit.f);
    tg = T.getTg();
    ok('6c: landing on the target tone scores a hit', hit ? tg.hits === h0 + 1 : true);

    T.targetStop();
    T.setTargetDeg(0);
    T.setMode('reference');
    T.setCtxNow(0);
    T.resetLearner();
  })();

  /* ---- Phase 6c: call & response (motif echo — closes the Lead pillar) ---- */
  (function callResp() {
    const doc = win.document;
    ok('6c: call-response card + area + board present',
       !!doc.getElementById('start-callresp') && !!doc.getElementById('cr-area') && !!doc.getElementById('cr-board'));
    ok('6c: the Lead group has two cards',
       !!doc.getElementById('start-target') && !!doc.getElementById('start-callresp'));

    T.resetLearner();
    T.initAudio();
    T.setCtxNow(0);
    T.setMode('practice');
    T.setKey(0, 'C');
    T.setCrPos(1);
    T.startCallResp();
    let c = T.getCr();
    ok('6c: start builds a call motif from the scale box', c && c.phase === 'call' && c.motif.length === 3 && c.pool.length > 0);
    ok('6c: motif notes all come from the box palette', c.motif.every(i => i >= 0 && i < c.pool.length));

    // response: a wrong echo buzzes (no advance, not scored); the right pitch advances
    T.crToResponse();
    c = T.getCr();
    ok('6c: after the call it is your turn', c.phase === 'response' && c.respIdx === 0);
    const first = c.pool[c.motif[0]];
    const wrong = c.pool.find(p => p.midi !== first.midi);
    if (wrong) T.crAnswer(wrong.si, wrong.f);
    c = T.getCr();
    ok('6c: a wrong echo does not advance and is not scored', c.respIdx === 0 && c.total === 0 && c.wrongNote >= 1);

    // echo the whole motif correctly → the round scores and advances
    for (const pi of c.motif.slice()) { const p = c.pool[pi]; T.crAnswer(p.si, p.f); }
    c = T.getCr();
    ok('6c: echoing the motif advances the round and counts every note', c.round === 1 && c.total === 3);
    ok('6c: the note flubbed once is not counted clean', c.correct === 2);

    // drive the remaining rounds cleanly to finish + record a session
    T.crNextRoundNow();
    for (let r = 1; r < T.CR_ROUNDS; r++) {
      T.crToResponse();
      c = T.getCr();
      for (const pi of c.motif.slice()) { const p = c.pool[pi]; T.crAnswer(p.si, p.f); }
      if (r < T.CR_ROUNDS - 1) T.crNextRoundNow();
    }
    c = T.getCr();
    ok('6c: finishing all rounds ends the session', c.phase === 'done');
    const ss = T.getLearner().sessions;
    ok('6c: a call-response session is recorded (accuracy)',
       ss.length >= 1 && /^callresp:/.test(ss[ss.length - 1].drill));
    ok('6c: call-response mints no per-item SRS', T.learnerStats().items === 0);

    T.setMode('reference');
    ok('6c: leaving Practice exits the call-response drill', T.getCr() === null);
    T.setCtxNow(0);
    T.resetLearner();
  })();

  /* ---- Phase 7a: subdivision & timing (Foundations coach) ---- */
  (function timing() {
    const doc = win.document;
    ok('7a: timing card + area + board present',
       !!doc.getElementById('start-timing') && !!doc.getElementById('sd-area') && !!doc.getElementById('sd-board'));
    ok('7a: a Timing group card sits in the practice home',
       !!doc.querySelector('#practice-home .practice-section [data-i18n="drill_timing"]'));
    ok('7a: four subdivisions (quarter → sixteenth) with the right per-beat divisions',
       T.SUBDIVS.length === 4 && T.SUBDIVS.map(s => s.div).join(',') === '1,2,3,4');

    T.resetLearner();
    T.initAudio();
    T.setCtxNow(0);
    T.setMode('practice');
    T.setKey(0, 'C');       // C Aeolian by default context
    T.setSdPos(1);
    T.setSdSub(1);          // eighths
    T.startTiming();
    let s = T.getSd();
    ok('7a: start opens the drill (paused)', s && s.playing === false);

    // the walked path is the box scale ascended then descended (a smooth run, no leaps)
    const path = T.sdPath();
    ok('7a: the walk builds a note path from the scale box', path.length >= 4);
    let asc = true; for (let i = 1; i < path.length; i++) { if (path[i].midi < path[i-1].midi) { asc = false; break; } }
    ok('7a: the path is not strictly ascending (it turns around)', !asc);

    // play, then drive one full 4/4 bar of eighths (8 ticks) + the downbeat of the next
    T.sdToggle();
    s = T.getSd();
    ok('7a: play arms the clock and captures div = 2 for eighths', s.playing === true && s.div === 2);
    for (let c = 0; c <= 8; c++) T.sdTickNow(0.01 * c, c);
    s = T.getSd();
    ok('7a: a full bar of subdivisions counts one bar', s.bars === 1);

    // stopping after ≥1 bar records a coach session and mints no per-item SRS
    T.sdToggle();
    const ss = T.getLearner().sessions;
    ok('7a: a timing session is recorded (bars played)',
       ss.length >= 1 && /^timing:eighth$/.test(ss[ss.length - 1].drill));
    ok('7a: timing mints no per-item SRS', T.learnerStats().items === 0);

    T.setMode('reference');
    ok('7a: leaving Practice exits the timing drill', T.getSd() === null);
    T.setCtxNow(0);
    T.resetLearner();
  })();

  /* ---- Drill registry: the shell must never carry a hand-written drill list ----
     Every drill self-registers (13-drill-registry.js) and setMode/applyLang iterate
     DRILLS. These checks are the drift guard: before the registry, two inline lists
     in setMode had already gone stale (the 7a timing drill was missing from both),
     which painted the practice home ON TOP of the running drill. */
  (function drillRegistry() {
    const doc = win.document;
    const R = T.DRILLS;

    // no drill-count literal here on purpose: merging or adding a drill changes the
    // count legitimately, and the markup-vs-registry check below already pins it
    // exactly. This one guards the SHAPE of each registration.
    ok('registry: every drill is registered with an id + area + isActive + exit',
       Array.isArray(R) && R.length > 0 &&
       R.every(d => d.id && d.area &&
                    typeof d.isActive === 'function' && typeof d.exit === 'function'));

    // the `mode` field went away with the Ear mode — every drill lives under Practice
    ok('registry: no drill carries a mode field any more',
       R.every(d => d.mode === undefined));

    ok('registry: drill ids are unique',
       new Set(R.map(d => d.id)).size === R.length);

    ok('registry: every registered area element exists in the DOM',
       R.every(d => !!doc.getElementById(d.area)));

    // the real drift guard: an area in the markup that no drill claims means a
    // drill was added without registering it — exactly the 7a failure mode.
    const domAreas = [...doc.querySelectorAll('[id$="-area"]')].map(e => e.id).sort();
    const regAreas = R.map(d => d.area).sort();
    ok('registry: every *-area in the markup is claimed by a registered drill',
       domAreas.join(',') === regAreas.join(','),
       'markup: ' + domAreas.join(',') + '  |  registry: ' + regAreas.join(','));

    const vis = id => { const e = doc.getElementById(id); return !!e && !e.hidden; };

    // Re-entering the mode you are already in must not disturb a running drill.
    // Reproduces the fixed bug: modenav has no same-mode guard, so clicking the
    // active "Practice" button re-runs setMode('practice') with a drill open.
    T.setMode('practice');
    T.startTiming();
    ok('registry: starting a drill hides the practice home',
       vis('sd-area') && !vis('practice-home'));
    T.setMode('practice');
    ok('registry: re-entering Practice leaves the running drill alone (no home on top)',
       vis('sd-area') && !vis('practice-home'));
    ok('registry: re-entering Practice does not tear the drill down', T.getSd() !== null);

    // and the generic teardown still works for a drill the old list DID cover
    T.setMode('reference');
    ok('registry: leaving Practice exits the drill and restores the home',
       T.getSd() === null && !vis('sd-area') && vis('practice-home'));

    // the ear drills are ordinary practice drills now: same home, same teardown
    T.setMode('practice');
    T.startEar('interval');
    ok('registry: an ear drill hides the shared practice home',
       vis('ear-area') && !vis('practice-home'));
    T.setMode('reference');
    ok('registry: leaving Practice exits the ear drill and restores the home',
       T.getEar() === null && !vis('ear-area') && vis('practice-home'));

    // activeDrill() reports the running drill
    T.setMode('practice');
    T.startStrum();
    const a = T.activeDrill();
    ok('registry: activeDrill() finds the running drill', !!a && a.id === 'strum');

    // refreshDrillsLang is what applyLang now calls — it must repaint, not throw
    let threw = false;
    try { T.refreshDrillsLang(); } catch (e) { threw = true; }
    ok('registry: refreshDrillsLang repaints an in-flight drill without throwing', !threw);

    T.setMode('reference');
    ok('registry: no drill is left running after the mode returns to reference',
       T.activeDrill() === null);
    T.resetLearner();
  })();

  /* ---- one shared drill key strip (replaces six duplicated per-drill key rows) ---- */
  (function sharedDrillKey() {
    const doc = win.document;
    ok('drill ctx: the shared key strip exists', !!doc.getElementById('drill-ctx-key'));
    // the whole point: no drill carries its own copy of the key row any more
    ok('drill ctx: no per-drill key pickers remain',
       ['sp-key', 'co-key', 'gf-key', 'tg-key', 'cr-key', 'sd-key']
         .every(id => !doc.getElementById(id)));
    ok('drill ctx: the strip is populated with root buttons',
       doc.getElementById('drill-ctx-key').children.length >= 12);
    // Quit was a seventh identical per-drill button; the shell owns it now
    ok('drill ctx: one shared Quit button', !!doc.getElementById('drill-ctx-quit'));
    // with Ear folded in, the ear drill drops its own quit too — the strip serves all
    ok('drill ctx: no per-drill quit buttons remain at all',
       ['cm-quit', 'sp-quit', 'tg-quit', 'cr-quit', 'sd-quit', 'drill-quit', 'ear-quit']
         .every(id => !doc.getElementById(id)));
    // the shared Quit must end whichever drill is up
    T.setMode('practice');
    T.startTiming();
    doc.getElementById('drill-ctx-quit').click();
    ok('drill ctx: the shared Quit exits the running drill', T.activeDrill() === null);
    ok('drill ctx: quitting restores the practice home',
       doc.getElementById('practice-home').hidden === false);
    // ...including an ear drill, which used to carry its own
    T.setMode('practice');
    T.startEar('interval');
    doc.getElementById('drill-ctx-quit').click();
    ok('drill ctx: the shared Quit exits an ear drill too',
       T.getEar() === null && doc.getElementById('practice-home').hidden === false);

    /* The key half of the strip is only shown to a drill that declares onKey(). The
       ear / note-naming / one-minute-changes drills don't re-derive from the key, so
       parking a key picker in front of them would be a control that adjusts nothing —
       the same defect the timing-calibration slider was removed for. */
    const keyShown = () => !doc.getElementById('drill-ctx-key').hidden;
    T.startTiming();
    T.applyDrillCtx();
    ok('drill ctx: a key-dependent drill (timing) shows the key picker', keyShown());
    T.exitTiming();
    T.startEar('interval');
    T.applyDrillCtx();
    ok('drill ctx: a key-independent drill (ear) hides the key picker', !keyShown());
    ok('drill ctx: the divider + label hide with it',
       doc.getElementById('drill-ctx-div').hidden && doc.getElementById('drill-ctx-keylbl').hidden);
    /* the .hidden property above is necessary but NOT sufficient: #drill-ctx-key is a
       .group (display:flex), which outranks the UA [hidden]{display:none}, so without
       an explicit rule the picker stays on screen in a real browser while jsdom
       happily reports it hidden. Pin the rule itself. */
    ok('drill ctx: CSS actually hides the key parts (display:flex outranks [hidden])',
       /#drill-ctx-key\[hidden\][^{]*\{[^}]*display:\s*none/.test(html)
       && /#drill-ctx-div\[hidden\]/.test(html) && /#drill-ctx-keylbl\[hidden\]/.test(html));
    T.exitEar();
    ok('drill ctx: returning to the home hides the key picker', !keyShown());

    // drillKeyChanged() must reach the RUNNING drill's onKey — for the over-the-changes
    // drill that means its bars are re-resolved into the new key, which is the behaviour
    // the drill's own picker used to own.
    T.initAudio();
    T.setMode('practice');
    T.setKey(0, 'C');
    T.setTargetProg(1);                     // I–V–vi–IV
    T.startTarget();
    ok('drill ctx: bars start in the context key (C)', T.getTg().bars[0].pc === 0);
    T.setKey(7, 'G');
    T.drillKeyChanged();
    ok('drill ctx: a key change re-resolves the running drill into the new key (G)',
       T.getTg().bars[0].pc === 7, String(T.getTg().bars[0].pc));

    // a drill with nothing key-dependent simply omits onKey — that must not throw
    T.exitTarget();
    T.startChanges();
    let threw = false;
    try { T.drillKeyChanged(); } catch (e) { threw = true; }
    ok('drill ctx: a drill without onKey is skipped, not crashed', !threw);

    T.setMode('reference');
    T.setKey(0, 'C');
    T.resetLearner();
  })();

  /* ---- Phase 7b: time signatures / meter ---- */
  (function meter() {
    const doc = win.document;
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    ok('7b: meter select present with all presets',
       !!doc.getElementById('tb-meter') && T.METERS.length === 5);
    ok('7b: default meter is 4/4', T.curMeter().id === '4/4' && T.getMeterIdx() === 2);

    // 4/4 must reproduce the OLD hard-wired bar math EXACTLY (no backing-band regression)
    T.setMeter(2);
    ok('7b: 4/4 bar = beat()*4 (unchanged bar math)', near(T.barSec(), T.beat() * 4));
    ok('7b: 4/4 pulse = a quarter', near(T.pulseSec(), T.beat()));
    ok('7b: 4/4 mid-bar push = beat 3', near(T.midPulseSec(), 2 * T.beat()));
    ok('7b: 4/4 accents the downbeat only', T.meterGroupStarts().join(',') === '0');
    ok('7b: 4/4 keeps kick 1&3 / snare 2&4',
       T.METERS[2].kick.join(',') === '0,2' && T.METERS[2].snare.join(',') === '1,3');

    // 3/4 (simple): three quarter pulses, bar shrinks to 3 beats
    T.setMeter(1);
    ok('7b: 3/4 has three quarter pulses', T.barBeats() === 3 && near(T.pulseSec(), T.beat()) && near(T.barSec(), 3 * T.beat()));

    // 6/8 (compound): six eighth pulses, bar = 3 quarters, felt in 2 (accents 0 & 3)
    T.setMeter(3);
    ok('7b: 6/8 pulse = an eighth', near(T.pulseSec(), T.beat() / 2));
    ok('7b: 6/8 bar = three quarters', T.barBeats() === 6 && near(T.barSec(), 3 * T.beat()));
    ok('7b: 6/8 accents the two dotted beats', T.meterGroupStarts().join(',') === '0,3');

    ok('7b: setMeter is bounds-checked', (T.setMeter(99), T.getMeterIdx() === 3));   // out-of-range ignored
    T.setMeter(2);   // restore 4/4 for the rest of the suite
    ok('7b: restored to 4/4', T.curMeter().id === '4/4');
  })();

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

  /* ---- 2.5: shareable deep links (Phase 9) ---- */
  (function deepLinks() {
    // set a known context, encode it, scramble, then decode and assert it round-trips
    T.setMode('reference'); T.selectTab('harmony'); T.setHView('chords');
    T.setKey(9, 'A', 5);          // A, Aeolian
    T.setChQual(8);               // some seventh quality (valid QUALITIES index)
    const enc = T.encodeShareState();
    ok('share: encodes the key + tab', /(^|&)k=9(&|$)/.test(enc) && /(^|&)t=harmony(&|$)/.test(enc), enc);
    ok('share: shareURL includes the hash', T.shareURL().indexOf('#' + enc) >= 0);
    // scramble the live context
    T.setKey(0, 'C', 0); T.selectTab('scales'); T.setScView('scale');
    // apply the encoded link via the hash and confirm the context comes back
    win.location.hash = '#' + enc;
    const applied = T.applyShareHash();
    const s = T.state();
    ok('share: applyShareHash reports success', applied === true);
    ok('share: root restored from link', s.gRoot === 9);
    ok('share: scale restored from link', s.scIdx === 5);
    ok('share: tab restored from link', s.currentTab === 'harmony');
    ok('share: chord quality restored from link', s.chQual === 8);
    ok('share: hash stripped after applying', (win.location.hash || '') === '');
    ok('share: a non-share hash is ignored', T.applyShareHash() === false);
    T.setKey(0, 'C', 0); T.setMode('reference');   // clean slate for any later check
  })();

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

    /* -- self-disable: jsdom is a secure context (https://example.test) but has no
          mediaDevices, so the feature must report unsupported and REMOVE its entry
          point rather than leave a button that can only ever error. -- */
    ok('F0: micSupported() is false without navigator.mediaDevices', T.micSupported() === false);
    ok('F0: the mic entry button is removed when unsupported', !doc.getElementById('tb-mic'));
    ok('F0: the reference-tone tuner still works when the mic half is disabled',
       doc.querySelectorAll('#tb-tuner-strings .tuner-str').length === 6);

    /* -- the overlay markup ships regardless (only the entry point is conditional) -- */
    ['mic-overlay', 'mt-note', 'mt-oct', 'mt-cents', 'mt-gauge', 'mt-needle',
     'mt-string', 'mt-status', 'mt-toggle', 'mt-close'].forEach(id => {
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
    ok('F1: the calibration row is removed where there is no mic', !doc.getElementById('cal-row'));

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
    T.setSdScored(true);
    const grid = [1, 1.5, 2, 2.5, 3, 3.5, 4];
    T.sdSetGrid(grid);
    T.calSetMs(100);
    T.sdSetHeard(grid.map(g => g + 0.100));    // perfect playing, heard 100ms late
    const corrected = T.sdComputeScore();
    ok('F1: a perfect run through 100ms of latency scores as perfect',
       corrected && corrected.n === grid.length && corrected.meanAbsMs < 0.01,
       corrected ? JSON.stringify(corrected) : 'null');
    ok('F1: ...and is not labelled as dragging', T.onsetFeel(corrected) === null);

    // The same data with calibration NOT applied is the bug this prevents.
    T.calSetMs(0);
    const uncorrected = T.sdComputeScore();
    ok('F1: without calibration the same run reads ~100ms late',
       uncorrected && near(uncorrected.biasMs, 100, 1),
       uncorrected ? String(uncorrected.biasMs) : 'null');
    ok('F1: ...which would have been reported as dragging',
       T.onsetFeel(uncorrected) === 'on_dragging');

    // A genuinely rushing player, correctly calibrated, is still caught.
    T.calSetMs(100);
    T.sdSetHeard(grid.map(g => g + 0.100 - 0.035));   // 35ms early, through the same latency
    const rushed = T.sdComputeScore();
    ok('F1: a rushing player is still detected through the correction',
       rushed && near(rushed.biasMs, -35, 1), rushed ? String(rushed.biasMs) : 'null');
    ok('F1: ...and is labelled rushing', T.onsetFeel(rushed) === 'on_rushing');

    /* -- the coach tier must stay honest: mic off means no score at all -- */
    T.setSdScored(false);
    ok('F1: with the mic off there is no score object', T.sdComputeScore() === null);
    const box = doc.getElementById('sd-score');
    ok('F1: the score panel exists in the markup', !!box);
    T.renderSdScore();
    ok('F1: the score panel is hidden on a coach run', box.hidden === true);
    ok('F1: the scored-tier toggle is hidden where onset cannot run',
       doc.getElementById('sd-mic').hidden === true);
    ok('F1: the coach hint does not claim to be listening',
       doc.getElementById('sd-hint').textContent === T.I18N[T.state().lang].sd_hint);

    T.calSetMs(0);
    T.exitTiming();
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
