# Euterpe (guitar-studio)

Guitar theory & practice app: chords, scales, circle of fifths, fretboard, Karplus-Strong
audio, backing band, practice drills with mic scoring. UI in Ukrainian + English. Brand
**Euterpe**; package slug and internal ids stay `guitar-studio`. Plan: `PLAN.md`.
Architecture write-up: `README.md`.

## Rules

- **Edit `src/`, never generated files.** `build.js` (string assembly, no bundler) writes:
  `index.html` (template + CSS + `src/js/*.js`; JS/CSS/HTML comments stripped, changelog
  sliced to the newest releases), `sw.js`, `CHANGELOG.md`, `icons/icon.svg`, `dist/*`.
  `icons/*.png` come from `tools/make-icons.js`. `manifest.webmanifest` is hand-edited.
- **One file, fetches nothing at runtime, works offline** (Google Fonts is the one remote
  load). The PWA layer (`sw.js`, manifest) is additive and dormant off HTTPS.
- **Third-party code** only if permissively licensed (never copyleft), vendored into `src/`,
  and solving a genuinely hard problem. Today: `00-vendor-fft.js` (fft.js 4.0.4) +
  `00-vendor-pitchy.js` (pitchy 4.1.0). Don't edit them; an upgrade re-applies the IIFE
  wrapper (an unwrapped `'use strict'` would turn the whole app strict).
- **Every UI string in both `uk` and `en`** (`03-i18n.js`; lint + tests enforce it).
- **Saved data is never lost.** A change to saved data or session ids ships an additive
  migration, tested against old saves.
- **Versioning:** `APP_VERSION` in `01-version.js` is the only version (`package.json` has
  none). Each release gets a paired EN/UK entry in `02-changelog.js`. Fix/polish = patch,
  new feature = minor. Use the `release` skill.

## Commands

```bash
node build.js      # regenerate everything from src/
npm run lint       # src/js linted as ONE concatenated scope + hygiene checks
npm test           # rebuilds, then the jsdom smoke suite (tests/smoke.js)
```

One-time: `npm install` (root, ESLint), `cd tests && npm install` (jsdom),
`git config core.hooksPath tools/githooks` (pre-commit: lint → build+test → generated files
in sync with `src/`).

Browser tools (system Edge/Chrome, headless; build first):
`tools/shoot.js` (screenshots + overflow probe; tokens: `tabs`, `practice`, `settings`,
drill names, `WxH` sizes), `tools/scroll-check.js`, `tools/kbd-check.js`,
`tools/mic-check.js`, `tools/onset-check.js`. Orientation matrix for layout changes:
`node tools/shoot.js tabs 390x844 844x390 360x740 768x1024 1024x768 1280x800 1920x1080`.

Skills: `release`, `preflight` (every gate), `visual-review`, `add-i18n-string`,
`project-review`.

## File map (`src/js/`, loaded in name order into one script scope)

| File | What |
|---|---|
| `00-vendor-*` | pitch detection (vendored) |
| `01-version` · `02-changelog` · `03-i18n` | version, release notes, strings |
| `04-constants` | music tables, tuning, meter model, `noteTxt` (♭/♯ for display) |
| `05-audio` · `06-backing` | synth engine; band, metronome, sequencer, transport |
| `07-render-shared` | fretboard renderer, legends, root buttons |
| `08-chords` · `09-triads` · `10-scales` · `11-notes-circle-lang` | reference views, circle, `applyLang` |
| `12-toolbar-state` | settings, `snapshotState`/`saveState`/`loadState`, old share-link cleanup |
| `13-backup` | progress export/import, storage persistence, failed-save notice |
| `13-drill-registry` | `DRILLS`/`registerDrill`, the one drill shell, `startTrack` |
| `13-learner` | learner model (SRS items, sessions, bests), progress card |
| `13-mic` · `13-scored` | shared mic (refcounted) · shared scored-run layer |
| `14-calibration` · `14-onset` · `14-mic-tuner` | latency, onset detection, tuner |
| `14-drill-*` | the drills (each self-registers) |
| `14-session` | timed practice session |
| `15-wiring-init` | nav, seams, shortcuts, welcome, init, `__GS_TEST__` hook |
| `16-pwa` | service worker + install prompt |

Also: `src/styles.css`, `src/index.template.html` (markers `@@STYLES@@` `@@SCRIPT@@`
`@@FAVICON@@` `@@VERSION@@`), `src/sw.template.js`, `src/icons/icon.svg`.

## Traps

- **One shared scope, load order matters for `let`/`const` only.** Top-level functions are
  hoisted across all files, so `typeof fn==='function'` guards are dead (lint rejects
  them). A `let`/`const` read by code that runs at load time before its file executes is a
  TDZ error — that is why the registry sits at slot 13 and the mic tuner at 14.
- **`[hidden]` always wins** via one global `!important` rule. Rules keyed on body classes
  (`.drill-setup`, `.drill-hint`) are invisible to jsdom — the suite pins them by regex.
- **Adding a drill** = one `14-drill-*.js` calling `registerDrill({...tracks})` + its
  `*-area` markup + a practice card with `data-track`. The suite fails if an area or card
  has no registered drill. Drills open through `startTrack()`.
- **Note labels:** data stays ASCII (`'Eb'`, `'C#'` — saves, session ids);
  render through `noteTxt()`. Root buttons carry `data-pc`; never parse labels back.
- **Mic features** need a secure context; they remove their controls on `file://`/jsdom.
  `getUserMedia` is checked by `tools/mic-check.js`/`onset-check.js`, not the jsdom suite.
- **Scoring honesty:** never score tap timing; mic tiers subtract `calOffsetSec()`, refuse
  uncalibrated or self-heard runs (`scoredErr`), and mute the guide part being scored.
