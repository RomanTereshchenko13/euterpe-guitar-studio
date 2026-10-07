# Euterpe — Plan

_Shipping: v2.15.0 · Updated: 2026-10-08_

The app is feature-rich and healthy (lint clean, 1102 smoke checks green). What holds it back now
is not missing features but **architecture and layout debt**: state with no single home, a musical
model that conflates key and chord, drills that each rebuild the same shell, and screens that put
controls before content. This plan fixes those first, then returns to features.

---

## Constraints (unchanged)

- **One file, fetches nothing at runtime, works offline.** Only Google Fonts is loaded remotely.
- **No bundler, no transpile.** `build.js` concatenates `src/js/NN-*.js` into one script scope.
- **Third-party code only if** permissively licensed (MIT/BSD/0BSD/Apache-2.0, never copyleft),
  vendored into `src/`, and solving a genuinely hard problem. Today: `pitchy` + `fft.js` (mic tuner).
- **Edit `src/`, never generated files.** Every UI string in both `uk` and `en`.

---

## The problems

### Architecture

1. **No single source of state.** ~94 module-level `let`s hold app state. Setters hand-call every
   dependent renderer (`setKey` calls 9 build/render functions and repaints hidden views), and
   save / load / share / language each keep their own hand-written field list. Every new feature
   touches 5–6 places; forgetting one is a silent bug. Symptoms: 85 `typeof fn==='function'`
   guards on functions that always exist, 370 `getElementById` + null-guard pairs, load-slot rules.
2. **Key and chord are one variable.** `gRoot` is both "the key" and "the chord on screen", and
   each tab reads it differently (Harmony: Am · Scales: A Aeolian · Circle: "I-IV-V" over A minor).
   Consequences: no "V of the key", and drills can't use a progression the user built.
3. **Problems are patched per instance, not at the system level.** ~10 per-element
   `[hidden]{display:none}` patches (each with an essay) instead of one global rule; comments that
   narrate history (167 "Phase N" references) instead of the cause being removed.
4. **Drills re-implement their own lifecycle.** The registry knows each drill's header, key, tempo
   and setup, but every drill still shows/hides its own areas, repeats exit logic, and owns a
   private fixed content list (`SEQ_PRESETS`, `CM_PAIRS`, `STRUM_PATTERNS`).

### Design

1. **No layout priority: controls before content.** Every screen stacks header → transport →
   pickers → hint → content. Results: on a phone the drill's neck is below the fold; landscape
   phone leaves ~50 px for content; on a 1366×768 laptop the chord name is below the fold.
2. **Too many controls for one job.** 5–6 ways to start sound on Harmony (Listen, Loop, Backing,
   progression Play/Cycle, Jam); latency calibration in general Settings; version badge in the
   header; three badge types on Practice cards.
3. **Reference and Practice don't share a layout grammar.** Reference is neck-first; a drill is
   header + pickers + stage. The nav mixes three subjects and one mode.
4. **Desktop width is unused.** Practice cards are fixed ~420 px; drills use the left half.

### Practice drills — what is useful

Only four of the ten tracks involve the guitar at all (timing, strumming, comping with the mic,
one-minute changes). The rest are screen or ear drills, and two of those show the answer.

| Drill | Guitar in hand? | Verdict | Why |
|---|---|---|---|
| Timing & subdivision | yes (mic) | **Keep — the best drill** | Real onset scoring, calibration, self-hearing guard. Unique in free apps. But the recorded score is *bars played*, not timing error. |
| One-minute changes | yes (self-counted) | **Keep** | A proven method; counting yourself is the authentic form. Limited to 10 fixed open-chord pairs. |
| Strumming & feel | yes (mic) | **Keep, merge** | Useful for beginners (swing, accents, mute). Only 5 patterns, one fixed chord, score = bars. |
| Comp the progression | yes (mic) | **Keep, merge** | "Land the change" is the right thing to score. Strumming a pattern *over a progression* is the real skill — these two are one drill. |
| Note naming | no (tap) | **Rework** | Right idea, shallow: 6 prompts, naturals only, progress per pitch class not per string. |
| Interval ear | no | **Keep, scale it** | Standard and useful, but opens with all 12 intervals, ascending melodic only. |
| Chord-quality ear | no | **Keep, scale it** | Useful; 8 qualities from the start is too wide for beginners. |
| Rhythm ear | no | **Cut or fold** | 8 fixed patterns, multiple choice; memorised quickly, low transfer. |
| Chord-tone targeting | no (tap) | **Rework or move** | The chord tones are **lit** and you tap the lit dots — no recall needed. As built it's a visualisation, which Harmony ▸ Arpeggio already is. |
| Call & response | no (tap) | **Rework** | The call **lights each dot** as it plays, so it's a visual-sequence memory game (Simon), not ear training. 4 rounds, no timing. Unlit, it becomes genuine ear → fretboard. |

---

## The plan

Each step ships on its own, keeps all gates green (`npm run lint`, `npm test`, `tools/shoot.js`
review), and changes no saved data unless it says so.

### 1 — Cleanup (no behaviour change) · S · low risk
- [ ] Strip HTML comments from the bundle in `build.js` (−24.5 KB, ~6% of the file).
- [ ] One global `[hidden]{display:none!important}`; delete the per-element patches.
- [ ] Copy: "Тайминг" → "Таймінг" (5 keys); remove dev-speak from user text
      ("…наступна фаза"); reconsider the "Коуч" badge.
- [ ] Trim `CLAUDE.md` to rules + file map (~5 KB); drop history narration from comments.
- [ ] Remove the dead `typeof fn==='function'` guards.
- [ ] Split `15-wiring-init.js` (852 lines: nav, seams, jam, changelog modal, shortcuts,
      welcome, share, a11y) into focused modules.
- [ ] Practice home: drop the three badge kinds ("З оцінкою" / "З мікрофоном" / "Коуч") — show
      a mic icon only where the mic is used; put the intro sentence first.

### 2 — One state store · L · medium risk (the foundation)
- [ ] `state` object + `set(patch)` + `on(keys, fn)` subscriptions, in an early slot.
- [ ] Persisted / shared fields declared once; `saveState`, `loadState`, `encodeShareState`,
      `applyShareHash` derived from that declaration (schema stays compatible with existing saves).
- [ ] Renderers subscribe to what they read; only the visible view repaints.
- [ ] Element lookups cached once per module (small `$()` helper) instead of per call.
- **Done when:** adding a persisted setting is one declaration + one subscriber.

### 3 — Registry owns the drill lifecycle · M · low–medium risk
- [ ] Enter / exit / show-hide / summary handled by the registry; a drill provides its stage,
      its tick and its scoring.
- [ ] Shared content source for progressions, chord pairs and patterns.
- **Done when:** a new drill is its stage + scoring, with no show/hide or exit code.

### 4 — Separate key from chord · M · medium risk
- [ ] `key = {root, scale}` and `chord = {root, quality}` as distinct state; chord defaults to
      the key's tonic chord; diatonic chords selectable as degrees of the key.
- [ ] User-built progressions saved and usable in Over-the-changes and Strumming.
- [ ] Saves migrate additively (old `gRoot` → key root + chord root).

### 5 — Content-first layout · M · medium risk
- [ ] Rule: the content area (neck / stage) owns the first viewport; controls collapse around it.
- [ ] Landscape phone: compact header (no brand line, one-row transport), slim / auto-hide nav.
- [ ] Drills on phone: stage first; key / tempo move into the setup disclosure; hint shortened.
- [ ] Chord name + quality beside the root picker, above the neck.
- [ ] Desktop: Practice grid and drills use the full width.
- **Check:** `node tools/shoot.js tabs practice target-run 390x844 844x390 1366x768 1920x1080`.

### 6 — One transport · M · low risk
- [ ] One play / loop control; the other surfaces set *what* it plays (chord, progression, jam).
- [ ] Latency calibration moves into the mic flow; version badge to the footer.

### 7 — Practice drills rework (after steps 3–4) · L
Applies the verdicts in **Practice drills — what is useful** below.
- [ ] **Merge Strumming + Comping into one "Rhythm guitar" drill:** a pattern (or free) over
      one chord *or* a progression. Score = timing error when the mic is on, not bars played.
- [ ] **Timing coach:** score = mean timing error (ms) with the mic; without the mic, don't
      record a score at all (it's a metronome then, and "bars played" measures endurance).
- [ ] **Note drill:** per-string items, accidentals toggle, longer runs (6 → 12+), whole-neck
      option independent of the global fret range.
- [ ] **Chord-tone targeting:** stop lighting the answer — the tones are hidden and you find them
      (recall). The lit version is a view, not a drill: fold it into Harmony ▸ Arpeggio + Jam.
- [ ] **Call & response:** stop lighting the call's dots — hear it, find it on the neck
      (ear → fretboard). Longer sessions (4 → 8+ rounds).
- [ ] **One-minute changes:** user-chosen pairs (any two chords, incl. barre), not 10 fixed ones.
- [ ] **Ear — intervals / chord quality:** start narrow and widen with mastery; add descending
      and harmonic intervals.
- [ ] **Ear — rhythm:** cut, or fold into the timing drill (8 fixed patterns are memorised in a
      few sessions).
- [ ] Every drill scales with the player (start narrow, widen as items mature).

### 8 — Features (after the foundation)
- [ ] Lead drills played on the guitar, using the existing onset scoring.
- [ ] Consistent note glyphs (`E♭` vs `Eb`) across pickers and the circle.
- [ ] Print / export of the current chord & scale sheet.
