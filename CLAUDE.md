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
- `sw.js`        → generated from `src/sw.template.js` (`APP_VERSION` stamped into the cache name)
- `CHANGELOG.md` → generated from `src/js/02-changelog.js`
- `icons/icon.svg` → copied from `src/icons/icon.svg`
- `icons/*.png`  → rasterized from `src/icons/icon.svg` by `tools/make-icons.js`
- `dist/*`       → versioned standalone copies (gitignored)

Editable PWA sidecar (NOT generated, edit directly): `manifest.webmanifest`.

Edit the sources, then run the build.

## Where things live (all editable sources under `src/`)

- `src/js/NN-*.js` — ordered modules, concatenated alphabetically (zero-padded
  `01`..`16`). Order matters; the number is the load order.
  - `01-version.js` — `APP_VERSION`, the **single source of truth** for the version
  - `02-changelog.js` — release notes (EN/UK); drives the in-app modal AND `CHANGELOG.md`
  - `03-i18n.js` — translation strings · `04-constants.js` (incl. custom-tuning state:
    `customTuning` + `tuningMidi()`) · `05-audio.js` (incl. timing calibration:
    `calMs`/`calOffsetSec`/`calcLatencyOffset` + the tap-test `calStart`/`calTap`/`calFinish`)
  - `06-backing.js` · `07-render-shared.js` · `08-chords.js` · `09-triads.js`
  - `10-scales.js` · `11-notes-circle-lang.js` · `12-toolbar-state.js` (state save/load +
    the custom-tuning editor + the share-link codec `encodeShareState`/`applyShareHash`)
  - `13-learner.js` — learner model (spine #3): per-item SRS history + sessions ring
    buffer; persists via `12-toolbar-state.js`'s `saveState`/`loadState`. Exposes the
    progress-card readouts `learnerReview` (due-for-review queue) + `learnerActivity` (active days)
  - `14-drill-ear.js` + `14-drill-notes.js` + `14-drill-lead-{1-target,2-callresponse}.js` +
    `14-drill-rhythm-{1-changes,2-strum,3-comp,4-groove}.js`
    — the drills (all at load slot 14, before wiring). `14-drill-notes.js` is the Practice
    note-naming drill (3c); `14-drill-ear.js` is Ear training (Phase 4) — interval /
    chord-quality / rhythm recognition, multiple-choice on the audio buses; the four
    `14-drill-rhythm-*.js` files are the Rhythm pillar (Phase 5), one coach per file in
    load order — the "one-minute changes" chord-change coach (5a, `cm*`) + the
    strumming-pattern trainer (5b, `sp*`) + comp-the-progression (5c, `co*`) + the
    groove/feel lab (5d, `gf*`), each a setup→timed run→summary flow living as a card in
    the Practice home (the `-1/-2/-3/-4` suffix preserves the cm→sp→co→gf concat order);
    the two `14-drill-lead-*.js` files are the Lead pillar (Phase 6). `14-drill-lead-1-target.js`
    (`tg*`) covers 6a/6b/6c-targeting: a progression loops with a forced backing band (reusing
    `SEQ_PRESETS`/`scheduleBand`/`compStrum` like 5c) while the current chord's tones light on a
    tappable neck (its own board) that you aim for — accuracy-scored, honest coach tier; a
    **Position** picker windows the targets to one arpeggio box (6b, reusing Phase 2's `boxWindow`)
    and a **Target** picker narrows them to a single degree (6c target-note soloing: other chord
    tones stay neutral, only off-chord notes miss). `14-drill-lead-2-callresponse.js` (`cr*`) is
    6c call-and-response — the app plays a scale-box motif (LISTEN) and you echo it back on its own
    board (YOUR TURN); self-paced, scored on echo accuracy, its listen/answer turns being the
    play-vs-rest phrasing lesson.
    They reuse the cue bus and the
    learner model; the shared progress readout (`renderProgressInto`) lives in the ear module.
    The note/ear drills write per-item SRS; the rhythm + lead coaches write only a sessions entry
    (best-per-pair / bars-played / accuracy is derived from the ring buffer, so the pinned item shape stays untouched).
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
  already-solved problem. The one sanctioned addition so far: **`pitchy` (0BSD),
  vendored**, for pitch detection (Phase 8 / F2). Everything else stays
  hand-rolled. See the Dependency policy in `ROADMAP.md` before adding any lib.

See `README.md` for the full architecture write-up and `ROADMAP.md` for the
phased plan.
