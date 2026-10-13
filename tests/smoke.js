/* =============================================================================
   Euterpe — headless smoke + correctness suite
   -----------------------------------------------------------------------------
   Run with:  npm test        (from this tests/ directory)
   or:        node smoke.js ../guitar-studio.html

   The shipped app is a single zero-dependency HTML file. This gate is the only
   thing that depends on jsdom, and only as a devDependency — nothing in the
   delivered file imports it. This file is the harness; the runtime checks live in
   smoke/*.js by area (see tests/README.md) and run in order on its one page.
   The suite has two layers:

     1. Static source checks  — version/changelog/ID-reference invariants that
        don't need a DOM (fast, catch refactor mistakes).
     2. Runtime jsdom checks  — boot the page with a stubbed Web Audio context
        and a test-only introspection hook (window.__GS_TEST__), then assert:
          • JS loads without throwing            (syntax + runtime validity)
          • DOM IDs resolve; moved/removed IDs    (the strip present, g-loop gone)
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
          • behaviour                             (the strip on every view,
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
  // build.js strips the template's HTML comments (notes for whoever edits src/);
  // only the generated-file header survives
  { const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
    const n = (markup.match(/<!--/g) || []).length;
    ok('bundle ships one HTML comment (the version header)', n === 1, n + ' found'); }
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
  // the shipped entries stay short: at most 3 bullets, the same count in both languages
  { const m = html.match(/const CHANGELOG = (\[.*\]);/);
    const shipped = m ? JSON.parse(m[1]) : [];
    ok('changelog: shipped entries have at most 3 bullets, EN and UK paired',
       shipped.length > 0 && shipped.every(r => r.en.length <= 3 && r.en.length === r.uk.length),
       shipped.filter(r => r.en.length > 3 || r.en.length !== r.uk.length).map(r => r.v).join(',')); }

  // step 8: one ▶ in the strip replaced Listen, Loop and the transport chip
  ok('removed ch-loop is no longer referenced', !/getElementById\(['"]ch-loop['"]\)/.test(html),
     'stale ch-loop reference remains');
  ok('step 8: no Loop button and no transport chip in the markup',
     !/id=["'](g-loop|tb-transport|tb-stop|seq-play)["']/.test(html));
  ok('step 8: the strip\'s ▶ is wired to stripPlay', /wire\('g-play', stripPlay\)/.test(html));

  /* CSS rules jsdom can't verify (it applies no cascade), pinned in the bundle's CSS.
     [what it guarantees, pattern, whether the pattern must match] */
  [
    ['[hidden] always wins: one global !important rule', /(^|[\s}])\[hidden\]\s*\{\s*display:\s*none\s*!important/m, true],
    ['the board has no hard min-width (it fits a phone)', /\.board\s*\{[^}]*min-width:\s*1150px/, false],
    ['drill setup is hidden when its body class is off', /body:not\(\.drill-setup-open\)\s*\.drill-setup\s*\{[^}]*display:\s*none/, true],
    ['drill hint is hidden when its body class is off', /body:not\(\.drill-help-open\)\s*\.drill-hint\s*\{[^}]*display:\s*none/, true],
    ['Practice hides the strip\'s reference slot (the strip has moved)', /body\.mode-practice\s+#strip-ref/, true],
    ['Practice keeps the nav (it is how you leave)', /body\.mode-practice\s+#mainnav/, false],
    ['Practice keeps Settings', /body\.mode-practice[^{]*#toolbar\b/, false],
    ['Practice keeps the Settings toggle', /body\.mode-practice[^{]*#tb-toggle\b/, false],
    ['Practice keeps the strip', /body\.mode-practice[^{]*#strip(?![\w-])/, false],
    ['the drill header shows only while a drill runs', /body:not\(\.drill-running\)\s+#drill-ctx\s*\{[^}]*display:\s*none/, true],
    ['the strip has its own grid area', /#strip-ref\s*\{[^}]*grid-area:\s*strip/, true],
    ['the strip stays one row: it swipes, never wraps', /\.strip-row \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto/, true],
    ['on a phone a sheet rises over the page, the neck still in view', /\.sheets \{ position: fixed;[^}]*bottom: calc\(46px/, true],
    ['the drill header is one row, its name giving way', /\.drill-name \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap/, true],
    ['no header transport rules are left behind', /\.tb-bar\b|\.tb-transport\b|\.context-bar\b/, false],
    ['.main clears the neck above it', /\.main\s*\{[^}]*margin-top:\s*22px/, true],
    ['...and Practice takes that clearance back', /body\.mode-practice\s+\.main\s*\{[^}]*margin-top:\s*0/, true],
    ['Next up and progress share a row on desktop', /@media \(min-width: 941px\) \{\s*#ph-top-block \{[^}]*grid-template-columns: 340px minmax\(0,1fr\)/, true],
    ['landscape Practice keeps one column (no empty neck gutter)', /body\.mode-practice \.layout:has\(#board-region:not\(\[hidden\]\)\) \{[^}]*grid-template-areas: "main"/, true],
    ['drill cards wrap into a grid', /\.practice-list \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(auto-fill, minmax\(250px, 1fr\)\)/, true],
    ['the card list li is a bare flex cell', /\.practice-list li \{ display: flex; \}/, true],
    ['...with no box of its own', /\.practice-list li \{[^}]*background/, false],
    ['the circle grows with its column', /#cof-svg \{ width: 100%/, true],
    ['...up to a cap that leaves the neck in view', /#cof-svg \{[^}]*max-width: 320px/, true],
    ['the key panel beside it is capped too', /\.key-pick \{[^}]*max-width: 620px/, true],
    ['a Settings cluster heading takes its own row on a phone', /@media \(max-width: 700px\) \{\s*\.tb-cluster \{[^}]*flex-wrap: wrap;[^}]*\}\s*\.tb-cluster > \.tbc-label \{ flex-basis: 100%; \}/, true],
  ].forEach(([what, re, want]) => ok('css: ' + what, re.test(html) === want));

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

// the Web Audio stub is shared with the compat suite (boot.js)
const { buildAudioStub } = require('./boot.js');

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
  ok('ch-loop absent from DOM', !win.document.getElementById('ch-loop'));
  ['strip','g-play','chip-key','chip-chord','chip-tempo','backing-toggle','tb-tuner','tb-toggle','g-roots','board','nums','legend','app-ver']
    .forEach(id => ok('DOM id resolves: ' + id, !!win.document.getElementById(id)));
  ['g-loop','tb-transport','tb-stop','context-bar','panel-circle','harmony-extras','seq-play','arp-quals','sc-select','seam-jam']
    .forEach(id => ok('step 8: gone from the DOM: #' + id, !win.document.getElementById(id)));
  // 1b: the four per-tab boards collapsed into one shared #board
  ['ch-board','tr-board','sc-board','nt-board'].forEach(id =>
    ok('1b: old per-tab board gone: ' + id, !win.document.getElementById(id)));
  // 1b's single shared reference board (#board) is still exactly one; the Practice
  // drills add their own boards — note-naming (#drill-board) and subdivision/timing
  // (#sd-board) — so three fretboards total.
  ok('1b: one shared reference board (#board)',
     win.document.querySelectorAll('#board.fretboard').length === 1);
  ok('3c: drill has its own board, three fretboards total',
     win.document.querySelectorAll('.fretboard').length === 3 && !!win.document.getElementById('drill-board'),
     win.document.querySelectorAll('.fretboard').length + ' found');
  // A2: the tab strip became the one nav; step 8 folded the circle into the key sheet
  ok('step 8: two reference subjects (Notes and the circle folded away)',
     win.document.querySelectorAll('.navbtn:not([data-panel="practice"])').length === 2,
     win.document.querySelectorAll('.navbtn').length + ' nav buttons');
  ok('1b: notes controls live under Scales (sub-notes)', !!win.document.getElementById('sub-notes'));

  /* ---- i18n symmetry + new keys ---- */
  const uk = Object.keys(T.I18N.uk).sort();
  const en = Object.keys(T.I18N.en).sort();
  const onlyUk = uk.filter(k => !T.I18N.en.hasOwnProperty(k));
  const onlyEn = en.filter(k => !T.I18N.uk.hasOwnProperty(k));
  ok('i18n: no keys only in uk', onlyUk.length === 0, onlyUk.join(', '));
  ok('i18n: no keys only in en', onlyEn.length === 0, onlyEn.join(', '));
  ['strip_key','pl_h','pl_src','pl_chord','pl_prog','pl_band','tb_click','tb_click_tip','pl_play_chord','pl_play_prog',
   'tbc_sound','tb_lang','kbd_key','lbl_quality','cal_offer','cal_later','audio_off',
   'cd_voicings','cd_eshape','cd_ashape','cd_fret','cd_pick_hint','tr_shapes',
   'view_scale','view_notes','suggest_title','suggest_scales',
   'shape_triads','shape_no_triad',
   'view_arp','arp_p','arp_hint','arp_word','tb_capo','capo_off','caged_desc',
   'mode_practice','practice_h','drill_notes','drill_notes_meta',
   'drill_quit','drill_find_pre','drill_find_sub','drill_complete','drill_score','drill_clean',
   'drill_misses','drill_time','drill_again','drill_done','seam_drill',
   'next_due','next_new','next_stale','next_slipping','next_any',
   'badge_mic','unit_bars','unit_cpm','drill_rhythm','drill_rhythm_meta','sp_over','sp_free','sp_yours',
   'cm_yours','ear_level','ear_dir_down','ear_dir_harm','prog_unscored',
   'prog_title','prog_accuracy','prog_streak','prog_sessions',
   'prog_yours','prog_best','prog_runs','prog_timing',
   'ear_intervals','ear_intervals_meta','ear_chords','ear_chords_meta',
   'ear_int_prompt','ear_chord_prompt',
   'ear_replay','ear_next','ear_right','ear_wrong','ear_got',
   'pwa_install','pwa_install_tip','pwa_update','pwa_update_btn','pwa_dismiss',
   'tb_volume','tuner_open','tuner_ear','tuner_ear_hint',
   'drill_changes','drill_changes_meta',
   'cm_pair','cm_dur','cm_sec','cm_start','cm_stop','cm_setup_note',
   'cm_changes','cm_cpm','cm_best','cm_tap_hint','cm_undo','cm_newbest',
   'sp_pattern','sp_chord','sp_play','sp_stop','sp_hint',
   'co_now','co_next','co_hint',
   'sp_swing','sp_accent','sp_mute','cof_h',
   'tg_prog','tg_pos',
   'a11y_palette','a11y_shapes',
   'wc_title','wc_lead','wc_drill','wc_drill_d','wc_tune','wc_tune_d','wc_got',
   'tun_custom','cl_older',
   'prog_active','prog_due','prog_next',
   'mic_title','mic_start','mic_stop','mic_cents','mic_string','mic_play_hint',
   'mic_intune','mic_hint','mic_asking','mic_denied','mic_nodev','mic_busy','mic_err',
   'mic_unsupported',
   'cal_label','cal_run','cal_running','cal_done','cal_unheard','cal_cancelled','cal_busy',
   'on_listen','sd_hint_scored','sp_hint_scored','co_hint_scored',
   'on_ms_off','on_tight','on_close','on_loose','on_none',
   'on_rushing','on_dragging','on_evenness','on_played','on_changes','on_ms',
   'on_selfheard'].forEach(k => {
    ok('i18n new key present (uk+en): ' + k,
       T.I18N.uk[k] !== undefined && T.I18N.en[k] !== undefined);
  });

  /* ---- 2.2.0: master volume + the reference-tone strings (now inside the one tuner) ---- */
  ok('2.2: master volume slider present', !!win.document.getElementById('tb-vol'));
  ok('2.2: volume value readout present', !!win.document.getElementById('tb-vol-val'));
  ok('2.2: tuner string container present', !!win.document.getElementById('mt-strings'));
  ok('2.2: tuner builds one button per string',
     win.document.querySelectorAll('#mt-strings .tuner-str').length === 6);

  /* ---- the runtime checks, by area (tests/smoke/*.js) ----
     In this order: they share the one booted page and its state. */
  const byShort = {}; T.QUALITIES.forEach((q, i) => { byShort[q.short] = i; });
  const ctx = { ok, approx, html, dom, win, T, byShort };
  ['practice','drills','layout','music','plan','reference','mic','data']
    .forEach(area => require('./smoke/' + area + '.js')(ctx));
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
