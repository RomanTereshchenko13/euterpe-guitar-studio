# Euterpe (guitar-studio)

Guitar theory & practice app — scales, modes, chords, triads, circle of fifths,
fretboard viz, Karplus-Strong audio engine, jam-along backing band. Bilingual
UI (Ukrainian / English). Brand is **Euterpe**; the package slug / internal ids
stay `guitar-studio`.

## The one rule that matters: edit `src/`, never the generated files

The core app is a single `index.html` **generated** by `build.js` (pure string
assembly — no bundler, no transpile). "Zero-dependency" here means *behavioural*:
it fetches nothing at runtime and has no supply-chain dependency — not that
third-party code is banned (it can be vendored; see Dependency policy below). On top of that, a thin
**additive PWA layer** makes it installable/offline when served over HTTPS (e.g.
GitHub Pages): `manifest.webmanifest` + a service worker (`sw.js`) + raster
`icons/` add a home-screen icon, its own window, and offline caching. The PWA is
sidecar-only — it's dormant on a `file://` / `dist/` copy and in the jsdom tests
(`src/js/14-pwa.js` self-disables off HTTPS), so the app is still the one file.

These files are **build output / generated — never hand-edit them**, your changes
will be overwritten:

- `index.html`   → generated from `src/index.template.html` + `src/styles.css` + `src/js/*.js`
  (the changelog is **sliced**: `build.js` inlines only the newest `CHANGELOG_KEEP` releases
  into the bundle — the full history was 15% of the file — and the modal links to `CHANGELOG.md`.
  **Comments are stripped** from the bundled JS + CSS: they were ~22% / ~28% of those files,
  i.e. a fifth of every visitor's download was commentary addressed to whoever edits `src/`.
  `stripJs`/`stripCss` in `build.js` are character scanners, not regexes — a regex hunting
  `/*` corrupts `https://` inside a string, a `/regex/` literal, or `content: "/*"` — and the
  stripped JS is syntax-checked before use, falling back to the unstripped source if it fails,
  so a scanner bug can cost bytes but never ship a broken app. **`src/` keeps every comment.**)
- `sw.js`        → generated from `src/sw.template.js` (`APP_VERSION` stamped into the cache name)
- `CHANGELOG.md` → generated from `src/js/02-changelog.js`
- `icons/icon.svg` → copied from `src/icons/icon.svg`
- `icons/*.png`  → rasterized from `src/icons/icon.svg` by `tools/make-icons.js`
- `dist/*`       → versioned standalone copies (gitignored)

Editable PWA sidecar (NOT generated, edit directly): `manifest.webmanifest`.

Edit the sources, then run the build.

## Where things live (all editable sources under `src/`)

- `src/js/NN-*.js` — ordered modules, concatenated alphabetically (zero-padded
  `00`..`16`). Order matters; the number is the load order.
  - `00-vendor-fft.js` + `00-vendor-pitchy.js` — **the only third-party code in the
    repo** (Phase 8/F0). `fft.js` 4.0.4 (MIT) and `pitchy` 4.1.0 (MIT/ISC — the
    roadmap's "0BSD" label was wrong, and pitchy is not alone: it *needs* fft.js).
    Vendored per the dependency policy: copied in, audited, concatenated — nothing
    fetched at runtime. **Do not edit them**; the only sanctioned change is swapping
    in a newer upstream release and re-applying the documented deltas (drop
    `module.exports` / `import` / `export`, wrap in an IIFE). The wrapper is
    load-bearing: `00-vendor-fft.js` sorts first, so an unwrapped upstream
    `'use strict'` would become the *script-level* directive and silently switch the
    whole hand-written app to strict mode. Each returns one symbol (`FFT`,
    `PitchDetector`) into the shared scope and keeps its helpers private.
  - `01-version.js` — `APP_VERSION`, the **single source of truth** for the version
  - `02-changelog.js` — release notes (EN/UK); drives the in-app modal AND `CHANGELOG.md`
  - `03-i18n.js` — translation strings · `04-constants.js` (incl. custom-tuning state:
    `customTuning` + `tuningMidi()`; and the meter model `METERS`/`meterIdx` +
    `barBeats`/`pulseSec`/`barSec`/`midPulseSec`/`meterGroupStarts`/`setMeter`, Phase 7b — 4/4 is
    byte-identical to the old `beat()*4`) · `05-audio.js` (the timing-calibration tap-test lived
    here; it was built ahead of the mic/scored tier meant to consume it, nothing ever called
    `calOffsetSec()`, so it was removed — bring it back with Phase 8/F1)
  - `06-backing.js` — the backing band + metronome + sequencer, all **meter-aware** (they read
    `barSec()`/`pulseSec()`/`barBeats()` instead of hard-wired 4/4); the merged over-the-changes
    drill (5c/6a) follows the same meter · `07-render-shared.js` · `08-chords.js` · `09-triads.js`
  - `10-scales.js` · `11-notes-circle-lang.js` · `12-toolbar-state.js` (state save/load +
    the custom-tuning editor + the share-link codec `encodeShareState`/`applyShareHash`)
  - `13-drill-registry.js` — the **drill registry**: `DRILLS` + `registerDrill()`, plus the
    generic shell helpers `activeDrill`/`exitAllDrills`/`showDrillHome`/`refreshDrillsLang`/
    `drillKeyChanged`/`applyDrillCtx`. Every drill file self-registers at load
    (`{id, area, isActive, exit, refreshLang?, onKey?}`), and `setMode` (15) / `applyLang`
    (11) iterate `DRILLS` instead of naming drills — so **adding a drill is one new `14-*.js`
    file + its markup, with nothing to register by hand**.
    There used to be a `mode:'practice'|'ear'` field; **Ear was folded into Practice** (it was
    a pillar, not a mode — same home shell, same progress card, same learner model), so the
    field went away and the mode axis is Reference vs Practice again.
    Loads at slot 13 (before the slot-14 drills) because `const DRILLS` isn't hoisted. The
    smoke suite guards the seam: every `*-area` in the markup must be claimed by a registered
    drill, so an unregistered drill fails the build rather than silently half-working.
    **Shared drill chrome** (`#drill-ctx` in the template, built in 15): one Key picker + one
    Exit button for *all* drills, instead of the identical copy each drill used to
    carry. Exit calls `activeDrill().exit()`; the key picker calls `setKey` then
    `drillKeyChanged()`, which invokes the running drill's optional `onKey()` — "re-derive
    yourself from the new key" (rebuild bars, deal a new round, repaint the board). A drill
    with nothing key-dependent just omits `onKey`. CSS derives the strip's visibility from
    `#practice-home:not([hidden]) ~ #drill-ctx`, so no drill manages it. The *key half* of the
    strip is derived too: `applyDrillCtx()` shows it only for a drill that declares `onKey`,
    so the ear / note-naming / one-minute-changes drills don't get a picker that adjusts
    nothing. It's called from one delegated listener on `#practice-home` (every drill starts
    from a card or the Review button in there), so drills still register nothing by hand.
    **Watch the `[hidden]` trap**: `#drill-ctx-key` is a `.group` (`display:flex`), which
    outranks the UA `[hidden]{display:none}` — hiding it needs the explicit CSS rule, and
    jsdom's `.hidden` property will happily report success without it.
  - `13-learner.js` — learner model (spine #3): per-item SRS history + sessions ring
    buffer; persists via `12-toolbar-state.js`'s `saveState`/`loadState`. Exposes the
    progress-card readouts `learnerReview` (due-for-review queue) + `learnerActivity` (active days)
  - `14-drill-ear.js` + `14-drill-notes.js` + `14-drill-overchanges.js` +
    `14-drill-lead-callresponse.js` + `14-drill-rhythm-{1-changes,2-strum}.js` +
    `14-drill-timing.js`
    — the drills (all at load slot 14, before wiring). `14-drill-notes.js` is the Practice
    note-naming drill (3c); `14-drill-ear.js` is Ear training (Phase 4) — interval /
    chord-quality / rhythm recognition, multiple-choice on the audio buses. It's **three
    drills behind one registry entry** (they share the `ear` state and `#ear-area`), and it
    lives in the Practice home's Ear group: Phase 4 gave it its own top-level mode, but that
    mode was a duplicate of Practice's shell (same drill-card list, same progress card
    rendering the same `renderProgressInto` from the same learner model, its own Quit), so it
    folded in. `#ear-home`, `#ear-progress`, `#ear-quit`, `.ear-panel`, `body.mode-ear` and
    `body.mode-activity` are all gone; a save or share link pinned to `m=ear` lands on Practice.
    `14-drill-rhythm-1-changes.js` (`cm*`) is the "one-minute changes" chord-change coach (5a),
    a setup→timed run→summary flow. `14-drill-rhythm-2-strum.js` (`sp*`) is **Strumming & feel**
    — the 5b pattern trainer and the 5d groove lab **merged**: one 8th-note clock over the
    context chord with a pattern picker (`STRUM_PATTERNS`) *and* the feel controls
    (`SP_SWINGS` swing, backbeat accent, palm-mute, optional drums+bass band), so the
    cross-combinations neither drill could reach now work.
    `14-drill-overchanges.js` (`tg*`) is **Over the changes** — comp-the-progression (5c) and
    chord-tone targeting (6a/6b/6c) **merged**, because they were one machine: the same
    `SEQ_PRESETS` bar expansion on the same `barSec()` clock with the same
    `scheduleBand(force)`/`compStrum` bed, NOW/NEXT stage and beat dots (6a's markup already
    reused 5c's `co-*` CSS). A `tgMode` switch picks what you play: `chords` (loud guide comp
    + mid-bar push, chord **diagrams**, no neck, records `comp:<prog>` by bars) or `tones`
    (lighter comp, chord **names**, tappable neck of lit chord tones, records `target:<prog>`
    by accuracy; **Position** windows them to one arpeggio box via Phase 2's `boxWindow`,
    **Target** narrows to a single degree — other chord tones stay neutral, only off-chord
    notes miss). Both practice cards (`start-comp` in Rhythm, `start-target` in Lead) open
    this one drill in their own mode, so each pillar's picker stays honest; both session
    namespaces are kept so pre-merge progress still reads. The DOM ids stay `tg-*`.
    `14-drill-lead-callresponse.js` (`cr*`) is
    6c call-and-response — the app plays a scale-box motif (LISTEN) and you echo it back on its own
    board (YOUR TURN); self-paced, scored on echo accuracy, its listen/answer turns being the
    play-vs-rest phrasing lesson.
    `14-drill-timing.js` (`sd*`) is the Foundations subdivision & timing coach (Phase 7a):
    a smart visual metronome — a subdivision picker (`SUBDIVS`, `div` per beat) + tempo drive a
    3-level accented click + a `SD_BEATS·div` grid on its own scheduler clock, while the context
    scale is walked note-by-note across the grid inside one Phase-2 `boxWindow` on its own display
    board; in-drill position/tempo (the key comes from the shared `#drill-ctx` strip), records a
    `timing:<subdiv>` session (no SRS). Coach tier
    (serves both pillars) — mic scoring is Phase 8/F1.
    They reuse the cue bus and the
    learner model; the shared progress readout (`renderProgressInto`) lives in the ear module.
    The note/ear drills write per-item SRS; the rhythm + lead coaches write only a sessions entry
    (best-per-pair / bars-played / accuracy is derived from the ring buffer, so the pinned item shape stays untouched).
  - `14-mic-tuner.js` — the **chromatic mic tuner** (Phase 8/F0, `mic*`/`mt*`, `#mt-*`). Real
    `getUserMedia` → `AnalyserNode` → the vendored `PitchDetector` → a ±50-cent needle, note
    name + octave, and a nearest-open-string readout derived from the live `OPEN_MIDI`/`SNAMES`
    (so it re-labels for Drop D / DADGAD / Open G). **Complements** the reference-tone tuner in
    `05-audio.js` — that one plays a pitch at you, this one listens. It asks for the raw signal
    (`echoCancellation`/`noiseSuppression`/`autoGainControl` all **off** — voice-call DSP mangles
    sustained tones), never connects the mic to `destination` (that's a feedback loop), calls
    `tunerStop()` before listening, and stops the tracks on close / tab-hide / pagehide. Readings
    are median-filtered (MPM's failure mode on a plucked string is a one-frame octave jump) then
    eased; the easing lives in a module-level `mtCents` *outside* the session object, so the whole
    readout is drivable with no mic attached — which is what the jsdom checks use.
    **Why slot 14** and not 17 beside the PWA sidecar it otherwise resembles: `applyLang` (11)
    calls `micRefreshLang`, and `applyLang` first runs from wiring-init (15), so loading after 15
    makes `let mt` throw on the temporal dead zone — the same trap that pins the drill registry to
    slot 13. **Self-disables like the PWA sidecar**: with no secure context / no `getUserMedia`
    (a `file://` dist copy, jsdom) the entry button is *removed*, not disabled — a control that
    can only ever report an error shouldn't be on screen. It is **not** a drill: no registry
    entry, no `-area`, no learner-model writes.
  - `15-wiring-init.js` · `16-pwa.js`
- `src/styles.css` — all CSS
- `src/index.template.html` — markup shell with `@@STYLES@@` / `@@SCRIPT@@` / `@@FAVICON@@` markers
- `src/sw.template.js` — service worker (`@@VERSION@@` → cache name)
- `src/icons/icon.svg` — the app icon, authored once

## Commands

```bash
node build.js     # rebuild index.html, sw.js, dist/, CHANGELOG.md from src/
npm test          # from repo root: rebuilds first (pretest), then runs jsdom suite
npm run lint      # static-analysis gate: lints src/js as one concatenated scope (CI runs this too)
```

**Pre-commit gate (one-time per clone):** `git config core.hooksPath tools/githooks`
installs `tools/githooks/pre-commit`, which runs lint → build+smoke → and verifies
the generated `index.html`/`sw.js`/`CHANGELOG.md` still match a fresh build of `src/`
(blocks the commit if they're stale). It nudges a manual visual pass when
`src/styles.css` or `src/index.template.html` changed.

- `npm test` (root) rebuilds then runs `tests/smoke.js` (270+ jsdom checks). CI
  runs the same on every push/PR, so **the committed `index.html` must always
  match `src/`** — rebuild before committing.
- `tests/` needs a one-time `cd tests && npm install` (jsdom, dev-only).

## `tools/` — dev-only helpers

Most drive the **system Edge/Chrome in headless mode** — no bundled browser,
nothing added to the shipped app. The browser-driven ones read the built
`index.html`, so `node build.js` first; they locate the browser under
`Program Files\{Microsoft\Edge,Google\Chrome}` and bail if not found. The
linter (`lint.js`) is pure Node — ESLint + `globals` are dev-only
devDependencies in the **root** `package.json` (same status as jsdom in
`tests/`), so the root needs a one-time `npm install`.

- `node tools/shoot.js [widths]` — responsive **screenshots** for eyeballing
  layout. Default widths `390 768 1280`; pass custom (`360 414 820`) or
  `WxH` (`390x3200`). Renders inside a fixed-width `<iframe>` so the iframe width
  is the true layout viewport, and flags **HORIZONTAL OVERFLOW** if the page
  exceeds it. Throwaway PNGs → `tools/shots/wNNN.png`.
- `node tools/scroll-check.js [WxH ...]` — headless **scroll/sticky-header
  regression check** (CI-style, exits 1 on issue). Injects a diagnostic that
  scrolls the page in real time and reports condensing-header bugs: flip-flop,
  scroll drift, slow-scroll thrash, layout jump. Default `390x740 390x1100`;
  ~15s real time per viewport (uses real timers, not virtual-time, because the
  condense trigger is an IntersectionObserver).
- `node tools/kbd-check.js` — headless **keyboard-shortcut functional check**
  (exits 1 on failure). Dispatches real keydown events and asserts the DOM
  responds: tab switch (`1/2/3`), root set (`g/a/c`), transpose (`[`/`]`), help
  overlay (`?`/`Escape`), and the typing/focus guards.
- `node tools/mic-check.js` — **end-to-end check for the F0 mic tuner** (exits 1 on
  failure). The jsdom suite covers the pitch→readout maths and the DOM contract but
  has no `getUserMedia`, so the half that matters — real capture → `AnalyserNode` →
  the vendored detector → the needle — is only testable in a real browser. It
  synthesizes a guitar-ish WAV at a known pitch, hands it to Chromium as a fake mic
  (`--use-file-for-fake-audio-capture` + `--use-fake-ui-for-media-stream`), and asserts
  the tuner names the right note and cents. Serves the build over a throwaway
  `127.0.0.1` port because **`getUserMedia` needs a secure context and `file://` isn't
  one**. Real time, not `--virtual-time-budget` (which starves the audio pipeline —
  same reason `scroll-check.js` avoids it). ~1 browser launch per pitch, ~30 s total.
- `node tools/make-icons.js` — **rasterize** `src/icons/icon.svg` into the PWA
  PNGs (`icon-192`, `icon-512`, `icon-maskable`, `apple-touch-icon`) in `icons/`.
  Run after editing the SVG; the PNGs are committed (Pages serves them). The
  maskable variant nests the mark in the safe circle on a `#1b1712` full-bleed bg.
- `npm run lint` (`node tools/lint.js`) — **static-analysis gate.** Concatenates
  `src/js/*.js` in build order and lints it as **one shared script scope** (the
  shipped reality — all modules share one scope), then maps findings back to
  `src/js/NN-*.js:line`. Catches the bug class jsdom can miss: a typo'd/missing
  cross-file symbol (`no-undef`), a duplicate top-level name (`no-redeclare`),
  and dead code (`no-unused-vars`, warnings). Errors exit 1; **runs in CI** as a
  second job (`.github/workflows/test.yml`). Config: `eslint.config.js`.
  `no-use-before-define` is deliberately OFF — cross-file refs execute post-load,
  so the lexical check is all false positives here.
  It also runs **dead-resource + source-hygiene checks** ESLint structurally can't:
  an i18n key present in one language but not the other; an i18n key no longer
  referenced anywhere; a CSS class styled but never applied; and a silent
  `catch(e){}` (`catch(_){}` is the codebase's deliberate-swallow marker and is
  allowed). Dynamic lookups are handled without an allowlist that could go stale:
  the literal fragments flanking a `+` inside `t(...)` are harvested as
  prefixes/suffixes, so `t('qg_'+g)` keeps every `qg_*` key alive and
  `t(head+'_h')` keeps every `*_h` key alive; the same trick covers class names
  built as `'ear-'+type`. The silent-catch rule used to live in the smoke suite,
  but the bundle now ships comment-stripped, so the explanatory comment that
  satisfies it is no longer visible in the built file.

**Visual / orientation review** is not a script — run `node tools/shoot.js` with the
orientation matrix and have an AI (e.g. this Claude Code session) review the PNGs.
Each `WxH` token is a real viewport so the shape-based shells fire (landscape phone =
`max-width:940 & max-height:500`), and the `tabs` token captures **all three tabs**
(harmony/scales/circle) per size → `w{W}-{panel}.png`:
`node tools/shoot.js tabs 390x844 844x390 360x740 768x1024 1024x768 1280x800 1920x1080`.

## Skills (`.claude/skills/`)

Recurring project workflows packaged as **AI-invokable skills**. They are prompts
for the agent (this session), not shell scripts — Claude auto-picks one when your
request matches its description, or you can run it by name (e.g. `/release`). Each
leads with the "edit `src/`, never the generated files" rule.

- **`release`** — bump `APP_VERSION` + paired EN/UK changelog entry, build/lint/test,
  ROADMAP version line, tag & push.
- **`visual-review`** — run the `shoot.js` orientation matrix across all tabs and
  review the PNGs for overflow / landscape-parity / header issues (the manual step
  the pre-commit hook only nudges about).
- **`add-i18n-string`** — add a UI string with symmetric `uk`/`en` keys in
  `03-i18n.js`, then rebuild + test.
- **`preflight`** — run every gate on demand: lint → test → generated-file sync →
  scroll-check → kbd-check (the pre-commit hook's superset).
- **`project-review`** — review a diff against Euterpe's invariants (generated-file
  edits, i18n symmetry, single concatenated scope, dependency policy,
  version↔changelog) — complements `/code-review`.

## Conventions

- **Every new UI string needs symmetric Ukrainian + English entries** — the test
  harness enforces this; an unpaired key fails the suite.
- Versioning: bump `APP_VERSION` in `src/js/01-version.js`; add a matching
  `02-changelog.js` entry. Polish/fixes = patch bump (1.25.0 → 1.25.1), not minor.
- Release: `git tag vX.Y.Z && git push --tags`. Current shipping version is at the
  top of `ROADMAP.md`.
- **Dependency policy (the guarantee is behavioural, not purist):** one file,
  fetches nothing at runtime, no supply-chain dependency, works offline. The only
  thing the app fetches is Google Fonts. Third-party code is *not* banned but is
  tightly gated — it must be (a) **permissively licensed** (MIT/BSD/0BSD/Apache-2.0,
  **never copyleft** — GPL would relicense the whole single-file output),
  (b) **vendored**: source copied into `src/`, audited, and concatenated by
  `build.js` so nothing is fetched at runtime, and (c) solving a genuinely hard,
  already-solved problem. **Vendored so far (Phase 8/F0): `pitchy` 4.1.0 + its one
  dependency `fft.js` 4.0.4**, both MIT-class, both in `src/js/00-vendor-*.js`, for
  pitch detection. Note the roadmap originally promised "the one code dependency,
  0BSD" and both halves were off — pitchy is MIT/ISC, and it does not stand alone.
  Everything else stays hand-rolled. See the Dependency policy in `ROADMAP.md`
  before adding any lib.

See `README.md` for the full architecture write-up and `ROADMAP.md` for the
phased plan.
