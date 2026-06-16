# Euterpe — test harness

The app ships as a single, zero-dependency HTML file. This directory holds the
**release gate**: a headless smoke + correctness suite. `jsdom` is a dev-only
dependency used here — nothing in the shipped file depends on it.

## Run

```bash
cd tests
npm install      # installs jsdom (dev only)
npm test         # runs smoke.js against ../index.html
```

`npm test` exits non-zero if any check fails, so it works as a CI gate.

To test a specific file:

```bash
node smoke.js /path/to/guitar-studio.html
```

## What it covers

- **Static** — version/meta/changelog consistency; the Loop control moved to the
  timing bar (`g-loop` present and wired, old `ch-loop` gone); `.board` has no
  hard `min-width`; no silent `catch(e){}` swallows.
- **Boot** — the page loads under jsdom with a stubbed Web Audio context and a
  test-only introspection hook (`window.__GS_TEST__`, built only when
  `window.__GS_ALLOW_TEST__` is set before load — zero footprint in production).
- **i18n** — the `uk` / `en` dictionaries are key-symmetric; new keys present.
- **Music** — voicing fifths incl. ♭5 (dim/dim7/m7♭5) and ♯5 (aug); degree-based
  note spelling (enharmonic correctness); scale interval ordering.
- **Phase A** — equal-temperament tuning target (the deterministic part of the
  tuning path; a true spectral/FFT check needs a real AudioContext).
- **Phase B** — the lookahead scheduler lands events exactly one interval apart
  (no drift).
- **Phase C** — backing bass fifth selection per chord quality.
- **Phase C+** — responsive fretboard: no horizontal overflow in a windowed
  range at 360/390/414 px, open-string column intact, fret-number/cell
  alignment; All-frets correctly exceeds the viewport (scroller fallback).
- **Behaviour** — Loop is shown only on the chord-tones view; loop and
  progression transports toggle and are mutually exclusive.
