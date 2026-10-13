# Euterpe — test harness

The app ships as a single, zero-dependency HTML file. This directory holds the
**release gate**: a headless smoke + correctness suite. `jsdom` is a dev-only
dependency used here — nothing in the shipped file depends on it.

## Run

```bash
cd tests
npm install      # installs jsdom (dev only)
npm test         # runs smoke.js, then compat.js, against ../index.html
```

`npm test` exits non-zero if any check fails, so it works as a CI gate.

To test a specific file:

```bash
node smoke.js /path/to/guitar-studio.html
```

## What it covers

`smoke.js` is the harness: the static source checks, the boot, DOM resolution and i18n
symmetry. It then runs the runtime checks by area, **in this order**, against the one
booted page — they share its state, so an area may rely on what an earlier one left:

| `smoke/` | What |
|---|---|
| `practice.js` | mode axis, learner model, the one practice model, the drill shell, Next up and the seams, progress |
| `drills.js` | note naming, ear, chord changes, rhythm guitar, timing; the registry and the shared drill key |
| `layout.js` | one function one home, the nav, the neck first, tools and cold start, the meter |
| `music.js` | voicings and spelling, the diatonic source, the scheduler grid, the responsive board, triads, key ≠ chord |
| `plan.js` | PLAN steps 8–12: the context strip, the key in one place, the layout pass, smaller seams |
| `reference.js` | arpeggios/CAGED/capo, transport, custom tuning, learner review, old share links |
| `mic.js` | the tuner, onset detection, self-heard runs, scored rhythm, calibration |
| `data.js` | note glyphs, export / import, storage persistence |

Each area file exports `function (ctx)` and takes `{ ok, approx, html, dom, win, T, byShort }`
from the harness. A new block goes in the area it is about, after what it depends on.

The page boots under jsdom with a stubbed Web Audio context and a test-only introspection
hook (`window.__GS_TEST__`, built only when `window.__GS_ALLOW_TEST__` is set before load —
zero footprint in production). A true spectral/FFT tuning check needs a real AudioContext:
`tools/mic-check.js` and `tools/onset-check.js` cover the mic in a real browser.

## Compatibility: saves from past releases (`compat.js`)

`fixtures/*.json` are real saves, written by old releases themselves:
`tools/capture-fixtures.js` boots each release's `index.html` out of git under jsdom,
puts it into a state a player could have reached, lets that build's `saveState()` write
localStorage, and records what that build showed (`seen`, read by `boot.js`'s
`readVisible`). `compat.js` boots the current build on each save and asserts:

- it shows the same thing, apart from the migrations listed in `MIGRATED`;
- every key the old build saved is still saved, or listed in `RETIRED` with the reason;
- an old share link is cleared and the save decides what opens;
- save → load restores the same state, and saving again writes the same bytes;
- a damaged save (unknown tab, not JSON) still opens on a real view;
- progress lives under its own key: settings that break or vanish don't take it along,
  a newer version is never overwritten, and a failed progress write falls back safely.

A change that is meant to show an old save differently adds its entry to `MIGRATED`;
it never edits a fixture. To cover a new schema, add a scenario to
`tools/capture-fixtures.js` and run it (`node tools/capture-fixtures.js <name-prefix>`).
