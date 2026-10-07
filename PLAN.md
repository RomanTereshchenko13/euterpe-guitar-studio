# Euterpe — Plan

_Shipping: v2.15.0 · Updated: 2026-10-08_

The app is feature-rich and healthy (lint clean, 1102 smoke checks green, 425 KB / 120 KB gzipped).
What holds it back now is not missing features but **architecture and layout debt**: state with no
single home, a musical model that conflates key and chord, drills that each rebuild the same shell,
screens that stack controls before content — and drills that, for the most part, don't involve the
guitar. This plan protects the user's data first, fixes the foundation, gives Reference and Practice
**one layout grammar** (the context strip), then reworks the drills around the microphone tools the
app already has.

---

## Constraints (unchanged)

- **One file, fetches nothing at runtime, works offline.** Only Google Fonts is loaded remotely.
- **No bundler, no transpile.** `build.js` concatenates `src/js/NN-*.js` into one script scope.
- **Third-party code only if** permissively licensed (MIT/BSD/0BSD/Apache-2.0, never copyleft),
  vendored into `src/`, and solving a genuinely hard problem. Today: `pitchy` + `fft.js`.
- **Edit `src/`, never generated files.** Every UI string in both `uk` and `en`.
- **Saved data is never lost.** Any step that changes saved data or session ids says so and ships
  an additive migration, asserted against captured old saves.

---

## The problems

### Data safety

1. **Practice history can disappear.** The learner model lives in the same single `localStorage`
   key as UI preferences. There is no export / import and no `navigator.storage.persist()`.
   Safari (iOS, not installed) evicts script-written storage after 7 days without a visit, so a
   weekly player can lose everything; a failed save only logs a dev warning.
2. **No fixtures for old saves or share links.** The state store and the key/chord split rewrite
   how state is saved and read; "stays compatible" currently has no test behind it.

### Architecture

1. **No single source of state.** 94 module-level `let`s hold app state. Setters hand-call every
   dependent renderer (`setKey` calls 9 build/render functions and repaints hidden views), and
   save / load / share / language each keep their own hand-written field list. Every new feature
   touches 5–6 places; forgetting one is a silent bug. Symptoms: 370 `getElementById` + null-guard
   pairs, load-slot rules, and a ~110-line hand-maintained test hook (`__GS_TEST__`) with ~40
   setters that reach into the `let`s.
2. **Key and chord are one variable.** `gRoot` is both "the key" and "the chord on screen", and
   each tab reads it differently (Harmony: Am · Scales: A Aeolian · Circle: "Listen I-IV-V" over
   A minor). Consequences: no "V of the key", and drills can't use a progression the user built.
3. **Problems are patched per instance, not at the system level.** Per-element
   `[hidden]{display:none}` patches (each with an essay) instead of one global rule; 90
   `typeof fn==='function'` guards that can never fail (every guarded name is a hoisted function
   declaration in the one shared scope); 168 "Phase N" comments that narrate history.
4. **Drills re-implement their own lifecycle.** The registry knows each drill's header, key, tempo
   and setup, but every drill still shows/hides its own areas, repeats exit logic, and owns a
   private fixed content list (`SEQ_PRESETS`, `CM_PAIRS`, `STRUM_PATTERNS`). Nothing moves focus
   when a drill starts or quits.

### Design (from screenshots at 390×844, 844×390, 1366 wide)

**What works — keep it:** desktop Reference (full-width neck on top, legend under it, "what to play
over this" beside the controls); one colour per degree on every view and legend; the phone bottom
nav; the session card ("how much time do you have?") as the way into Practice; the one drill shell;
the Circle's key panel (signature, relative, neighbours, degree row).

1. **Chrome eats the phone screen.** Harmony stacks brand + version + language → Listen / Loop →
   Settings / Backing → tempo → 12 root buttons → Names/Intervals → sub-view tabs before the neck,
   which starts at mid-screen. A running drill's neck starts at the bottom of the first screen;
   landscape Practice shows one card above the nav. Language and version are set-once items that
   take a row on every screen.
2. **The neck never scrolls itself (a defect).** No code sets `scrollLeft`. On a phone the neck
   shows frets 0–4, so the timing drill's A-minor box (frets 5–8), scale positions 2–5, higher
   chord shapes and arpeggio boxes are off-screen — you scroll sideways while playing to a click.
3. **The current choice is split around the neck.** Root is picked above it, chord quality below
   it, and "Am · Minor" is only written below it. On Scales the scale type — the most important
   choice — is a dropdown under the neck. Headings ("Chord tones on the neck") sit *under* the
   neck they describe while its sub-view tabs sit above.
4. **Same controls, different shapes.** The key picker is an inline row in Reference and two
   wrapped rows in drills; tempo is a slider in Reference and a −/+ stepper in drills. Same state.
5. **Too many controls for one job.** 5–6 ways to start sound on Harmony (Listen, Loop, Backing,
   progression Play/Cycle, Jam), plus "Practise this". The progression builder at the bottom is a
   separate tool that actually drives the jam (and, after step 6, the drills). Circle keeps a
   12-button root row although the circle itself is a key picker, and leaves half the desktop empty.
6. **Settings mixes four kinds of thing:** instrument (tuning, capo, frets, left-handed), tools
   (reference tuner, mic tuner), sound (volume, latency) and display (palette, shapes) — plus Share
   (an action) and the time signature (belongs with tempo). The tuner, the first thing you do
   before playing, is buried there.
7. **Practice home doesn't say what to do next.** Last score and "due" live only in the progress
   card; the 10 cards carry three badge kinds instead. First run shows a wide, empty progress card.
   Cards are fixed ~420 px with uneven groups, leaving the right half of a desktop empty.
8. **Drills: controls before the stage.** Name, ?, Parameters, mic, Quit, 12 key buttons, tempo
   and a four-line hint (still containing "…наступна фаза") precede the stage; Start/Stop sits at
   the bottom, below the neck. A drill summary never links back to the Reference view that
   teaches what you missed.

### Practice drills — what is useful

Only four of the ten tracks involve the guitar (timing, strumming, comping with the mic, one-minute
changes). The rest are screen or ear drills, and two of those show the answer. The app already
ships pitch detection (`pitchy`, F0 tuner) and onset detection + calibration (F1) — the tools to
put the guitar back into the others are in hand.

| Drill | Guitar in hand? | Verdict | Why |
|---|---|---|---|
| Timing & subdivision | yes (mic) | **Keep — the best drill** | Real onset scoring, calibration, self-hearing guard. The mic error is already recorded (`err`), but the *primary* score and trend are bars played. |
| One-minute changes | yes (self-counted) | **Keep** | A proven method; counting yourself is the authentic form. Limited to 10 fixed open-chord pairs. |
| Strumming & feel | yes (mic) | **Keep, merge** | Useful for beginners (swing, accents, mute). Only 5 patterns, one fixed chord, score = bars. |
| Comp the progression | yes (mic) | **Keep, merge** | "Land the change" is the right thing to score. Today it is `chords` mode of the over-the-changes drill; strumming a pattern over a progression is the real skill, so it belongs with Strumming. |
| Note naming | no (tap) | **Rework, mic-first** | Right idea, shallow: 6 prompts, naturals only, progress per pitch class not per string. "Play the C on the G string", checked by pitch, is the guitar version. |
| Interval ear | no | **Keep, scale it** | Standard and useful, but opens with all 12 intervals, ascending melodic only. |
| Chord-quality ear | no | **Keep, scale it** | Useful; 8 qualities from the start is too wide for beginners. |
| Rhythm ear | no | **Cut** | 8 fixed patterns, multiple choice; memorised quickly, low transfer. |
| Chord-tone targeting | no (tap) | **Rework, mic-first** | `tones` mode of over-the-changes. The tones are **lit** and you tap the lit dots — no recall. Hidden + played on the guitar, it becomes the real skill. |
| Call & response | no (tap) | **Rework, mic-first** | The call **lights each dot**, so it's Simon, not ear training. 4 rounds, no timing. Unlit and played back on the guitar, it is genuine ear → fretboard. |

---

## The plan

Each step ships on its own, keeps all gates green (`npm run lint`, `npm test`, `tools/shoot.js`
review), and changes no saved data unless it says so.

**Order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Steps 0–2 are small and independent
and can ship in any order; 7 needs 4 and 6; 9 needs 5 and 6.

### 0 — Protect progress · S · low risk (first)
- [ ] `navigator.storage.persist()` after the first recorded session (granted silently for
      installed PWAs on most browsers).
- [ ] Settings ▸ **Export / Import progress** (JSON file of the learner model + preferences;
      import validates through `normalizeLearner`). Local file only — nothing leaves the device.
- [ ] A failed save is shown to the user once, not only logged.

### 1 — Cleanup (no behaviour change) · S · low risk
- [ ] One global `[hidden]{display:none!important}`; delete the per-element patches (the smoke
      suite's regex pins move to the one rule).
- [ ] Remove the dead `typeof fn==='function'` guards (keep the `clearInterval` one and the
      `typeof d.exit` / `typeof s.err` value checks — those are real).
- [ ] Copy: "Тайминг" → "Таймінг"; remove dev-speak from user text ("…наступна фаза").
- [ ] Consistent note glyphs (`E♭` vs `Eb`) across pickers and the circle.
- [ ] `package.json` version (1.25.1) follows `APP_VERSION`, or is dropped from the release story.
- [ ] Trim `CLAUDE.md` to rules + file map (~5 KB); drop history narration from comments.
- [ ] Strip HTML comments from the bundle in `build.js` (−24.5 KB raw, a few KB gzipped — cheap,
      low value; not inside `<script>`/`<style>`/`<pre>` or attributes).

### 2 — Quick UI fixes · S · low risk (no new structure)
- [ ] **Neck auto-scroll:** when a board has an active window (scale position, arpeggio box,
      chord shape, drill box, call motif), scroll it into view — smoothly, only when the window is
      off-screen, and never while the user is dragging the neck. One helper in
      `07-render-shared.js`, used by every renderer.
- [ ] Section headings above the content they name (heading → sub-view tabs → neck).
- [ ] Chord-shape cards look selectable (selected state + "plays this voicing" in the card),
      instead of relying on the italic hint.
- [ ] Practice: hide the progress card until there is something to show; intro sentence first.
- [ ] Drill summaries link back to the Reference view that teaches what was missed (chord tones →
      Harmony ▸ Arpeggio, notes → Scales ▸ Notes, intervals → Harmony ▸ Chord tones).

### 3 — Compatibility fixtures · S · low risk (before 4 and 6)
- [ ] Capture real saves from past schemas and a set of share links into `tests/fixtures/`.
- [ ] Assert each one loads to the same visible state, and that a save → load → share round-trip
      is lossless. Every later step that touches state runs against these.

### 4 — One state store · L · medium risk (the foundation)
- [ ] `state` object + `set(patch)` + `on(keys, fn)` subscriptions, in an early slot.
- [ ] Persisted / shared fields declared once; `saveState`, `loadState`, `encodeShareState`,
      `applyShareHash` derived from that declaration (schema and old share links stay valid —
      step 3's fixtures prove it).
- [ ] Learner model saved under its own key, so a UI-state bug can't take progress with it
      (read the old combined key as a fallback).
- [ ] Renderers subscribe to what they read; only the visible view repaints.
- [ ] Element lookups cached once per module (small `$()` helper) instead of per call.
- [ ] `__GS_TEST__` setters collapse into `set()`; old hooks kept as shims until each group moves.
- [ ] Split `15-wiring-init.js` (852 lines: nav, seams, jam, changelog modal, shortcuts, welcome,
      share, a11y) into focused modules **as part of this step** — it is rewritten here anyway.
- **How:** incrementally, one field group per commit (context → board → transport → drills →
  a11y), never one big switch.
- **Done when:** adding a persisted setting is one declaration + one subscriber.

### 5 — Registry owns the drill lifecycle · M · low–medium risk
- [ ] Enter / exit / show-hide / summary handled by the registry; a drill provides its stage,
      its tick and its scoring.
- [ ] Focus moves to the drill header on start and back to its card on quit; results announced
      via the existing live region.
- [ ] Shared content source for progressions, chord pairs and patterns.
- **Done when:** a new drill is its stage + scoring, with no show/hide or exit code.

### 6 — Separate key from chord (the model) · M · medium risk
- [ ] `key = {root, scale}` and `chord = {root, quality}` as distinct state; chord defaults to
      the key's tonic chord; diatonic chords selectable as degrees of the key.
- [ ] Each view's reading defined explicitly: Harmony shows the chord, Scales the key, the circle
      the key with the chord highlighted, Notes the key root. Circle's "Listen" plays the key's
      real cadence (i-iv-v in minor, not "I-IV-V").
- [ ] A **progression** (presets or user-built) is state of its own, saved, and readable by the
      drills (step 9).
- [ ] Saves and share links migrate additively (old `gRoot` → key root + chord root).
- The UI for this lands in step 7 — this step is the model and the migration.

### 7 — The context strip: one layout grammar for Reference and Practice · L · medium risk
Replaces the stacked header / transport / root row / drill pickers with one compact row directly
above the neck (or the drill stage), identical in both layers:

```
[ A minor ▾ ]  [ Am ▾ ]  [ ♩ 90 · 4/4 ▾ ]  [ ▶ ]                ⚙
```

- [ ] **Key chip** → sheet with root, scale family (major / minor / pentatonic / blues as chips +
      "more", replacing the dropdown under the neck) and the circle of fifths. **The circle
      becomes the key picker** (expanded beside the neck on desktop) instead of a nav destination;
      its key panel (signature, relative, neighbours) moves with it. Nav becomes
      Harmony · Scales · Practice. _Compat:_ saves and share links pinned to the circle tab open
      Scales with the key sheet expanded; shortcuts `1`–`4` become `1`–`3` + a key-sheet key
      (`tools/kbd-check.js` updated).
- [ ] **Chord chip** → the key's diatonic degrees (i Am · ii° Bdim · …) first, then quality and
      "more". The chord name is always visible above the neck; the quality row under the neck
      goes away.
- [ ] **Tempo chip** → BPM + time signature together; the same control in Reference and drills
      (replaces both the slider and the stepper).
- [ ] **One ▶ transport** plays the current chord, the progression, or the jam — chosen in a
      **progression drawer** (presets, user-built, Jam on/off, Backing options) that replaces the
      progression panel at the bottom of Harmony, the Loop / Cycle / Listen / Jam buttons and the
      Backing disclosure. "Practise this" stays as the one seam.
- [ ] **⚙ Settings** split into Instrument (tuning, capo, frets, left-handed) · Sound (volume) ·
      Display (palette, shapes on notes, **language**). Share moves to an action in the ⚙ menu.
      Latency calibration moves into the mic flow (offered the first time a scored tier starts).
- [ ] **Tuner** gets its own button in the strip area (both layers) instead of Settings ▸ Tools.
- [ ] **Header:** brand only (no subtitle) on phones; version badge moves to the footer.
- [ ] **Landscape phone:** strip + neck own the screen; nav slims to icons or auto-hides.
- [ ] **Desktop:** the strip sits under the nav; the neck keeps the full page width; the view's
      own controls stay in a rail under it.
- **Done when:** on a 390×844 phone the neck starts in the top third of every Reference view and
  every drill, and there is exactly one tempo control and one play control on any screen.
- **Check:** `node tools/shoot.js tabs practice target-run timing-run 390x844 844x390 1366x768 1920x1080`.

### 8 — Practice home and the drill screen · M · low–medium risk (after 5 and 7)
- [ ] **Cards carry your state:** last result, trend arrow and a "due" dot on each card; the
      progress card becomes the detail view (collapsible), not the only place this lives.
- [ ] Drop the three badge kinds ("З оцінкою" / "З мікрофоном" / "Коуч") — a mic icon only where
      the mic is used.
- [ ] Session card leads and says what it will do ("Next: intervals, timing, changes — 10 min").
- [ ] Full-width responsive grid on desktop; groups don't leave empty columns.
- [ ] **Drill header in one row:** name · ? · 🎤 · ✕. Key and drill options live in the setup
      disclosure; tempo and ▶ come from the context strip, so Start/Stop is at the top (thumb
      reach on a phone), not under the neck. Hint is one line after the first visit.

### 9 — Practice drills rework (after 5–6) · L
Applies the verdicts in **Practice drills — what is useful**. **Mic first, tap as the fallback**
when no mic is available or the player declines it.
- [ ] **Split over-the-changes:** its `chords` mode merges with Strumming into one
      **"Rhythm guitar"** drill — a pattern (or free) over one chord *or* a progression (presets
      or the user's own, step 6). Score = timing error when the mic is on.
      _Data:_ `comp:*` and `strum:*` session histories are kept and read by the new track.
- [ ] **Timing coach:** with the mic, the primary score and trend become the mean timing error
      (already recorded as `err`). Without the mic it records a **scoreless** session — it's a
      metronome then, but staleness and active days must still see that you practised (otherwise
      the track is due forever).
- [ ] **Note drill:** per-string items, accidentals toggle, longer runs (6 → 12+), whole-neck
      option independent of the global fret range. With the mic: "play the C on the G string",
      checked by pitch (`pitchy`). _Data:_ existing `note:*` items seed the per-string ones.
- [ ] **Chord-tone targeting:** stop lighting the answer — find the tones (recall). With the mic,
      play them over the band, checked by pitch on the onset. The lit version is a view, not a
      drill: it already exists as Harmony ▸ Arpeggio + Jam. _Data:_ `target:*` history kept.
- [ ] **Call & response:** stop lighting the call — hear it, play it back on the guitar (onset +
      pitch), or tap it as the fallback. Longer sessions (4 → 8+ rounds).
- [ ] **One-minute changes:** user-chosen pairs (any two chords, incl. barre), not 10 fixed ones.
- [ ] **Ear — intervals / chord quality:** start narrow and widen with mastery; add descending
      and harmonic intervals.
- [ ] **Ear — rhythm:** cut. _Data:_ `rhythm:*` items are left in the store, ignored by review.
- [ ] Every drill scales with the player (start narrow, widen as items mature).
- **Pitch scoring** is monophonic (`pitchy` is), which fits single-note drills; chords stay
  scored on timing only.
- **Done when:** checked on a real phone (ideally an iPhone) as well as by the headless tools —
  `mic-check` / `onset-check` run in Chromium only, and calibration can't be checked headlessly.

### 10 — Features (after the foundation)
- [ ] Lead lines played on the guitar, scored by onset **and** pitch (onset alone says *when*,
      not *what*) — built on step 9's pitch scoring.

### Dropped
- Print / export of the chord & scale sheet — no evidence it's needed.
- Separate "content-first layout" and "one transport" steps — both are now the context strip
  (step 7), so the layout isn't built twice.
