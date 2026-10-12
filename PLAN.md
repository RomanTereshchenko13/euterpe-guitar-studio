# Euterpe — Plan

_Shipping: v2.17.0 · Updated: 2026-10-12_

## What Euterpe is

Euterpe does three things. Every feature serves at least one of them, or it needs a reason to stay.

1. **See it on the neck** — any chord, arpeggio or scale, in any key, on your tuning.
2. **Play along** — a backing band under the chord or progression you are looking at.
3. **Play it and be heard** — the microphone tunes you and scores what you actually play.

Anything that is none of these — a screen quiz that shows the answer, a second way to do
something the app already does, infrastructure built ahead of the content that would use it —
is creep.

---

## Constraints (unchanged)

- **One file, fetches nothing at runtime, works offline.** Only Google Fonts is loaded remotely.
- **No bundler, no transpile.** `build.js` concatenates `src/js/NN-*.js` into one script scope.
- **Third-party code only if** permissively licensed (MIT/BSD/0BSD/Apache-2.0, never copyleft),
  vendored into `src/`, and solving a genuinely hard problem. Today: `pitchy` + `fft.js`.
- **Edit `src/`, never generated files.** Every UI string in both `uk` and `en`.
- **Saved data is never lost.** Any step that changes saved data or session ids says so and ships
  an additive migration, asserted against captured old saves. Cutting a feature never deletes
  its stored data — the data stays in the store and is ignored.

---

## Where the app stands (2026-10-09)

**The core is good.** Fretboard reference (full-width neck, one colour per degree everywhere,
"what to play over this"), the backing band, the mic tuner, and the mic-scored timing drill with
latency calibration and the self-hearing guard. The phone bottom nav, the session card and the
one drill shell also work.

**The bloat** is in the Practice layer and in the project's own overhead, not in the reference
views:

| | Size | Note |
|---|---|---|
| App JS (excluding vendored libraries) | 7,656 lines | Reasonable for what it does |
| Comments across `src/` | 213 KB — **32 % of source** | 118 lines still narrate history ("A2:", "B3:", "Was …", "used to") |
| `02-changelog.js` | 79 KB — **12 % of source** | Each bullet is a paragraph, written twice (EN + UK) |
| `tests/smoke.js` | 186 KB | Larger than any app module; much of it pins CSS by regex |
| Bundle | 417 KB · 110 KB gzipped | |

**Too many ways to do the same thing.** One root note is shown through Harmony's four sub-views
(chord tones, triads, arpeggio, identify), a quality row plus "more", "what to play over this",
chord shapes, Scales, and the Circle — which carries its own copy of the 12-key row. Sound
starts from six places (Listen, Loop, Backing, progression Play, Cycle, Jam). There are two
tuners.

**Practice grew infrastructure ahead of content.** Ten tracks feed a registry, a shared scoring
layer, an SRS learner and a session planner — but six of the ten tracks don't involve the guitar,
and two of those light up the answer. The history repeats a pattern: a phase adds a drill, a
debloat pass merges drills, and the next phase builds more drill infrastructure. The previous
plan continued it: a large foundation rewrite (state store, lifecycle, model split) under drills
it then planned to rework with new pitch scoring, or cut.

**The rule this plan follows: cut first, then rebuild.** Every feature removed before the
foundation work makes that work smaller.

---

## Feature verdicts

| Feature | Serves | Verdict |
|---|---|---|
| Harmony ▸ Chord tones, Arpeggio | see | **Keep** |
| Harmony ▸ Triads | see | **Done (v2.17.0)** — a Full chord / Triads toggle on Chord tones |
| Harmony ▸ Identify (tap notes → name the chord) | — | **Cut (v2.17.0)** |
| Chord shapes card | see | **Keep** (make the cards look selectable — step 3) |
| "What to play over this" + Jam | see, play along | **Keep** — the best seam between the two |
| Scales (scale, positions, notes) | see | **Keep** |
| Circle of fifths as a tab | see | **Becomes the key picker** (step 8); nav goes to three tabs |
| Listen / Loop / Backing / progression Play / Cycle / Jam | play along | **Merge into one ▶ + progression drawer** (step 8) |
| Mic tuner | heard | **Keep** |
| Reference-tone tuner | — | **Merged (v2.17.0)** — "Tune by ear" inside the one tuner panel |
| Timing & subdivision | heard | **Keep — the best drill**; scored on timing error (step 9) |
| One-minute changes | heard | **Keep**; user-chosen chord pairs (step 9) |
| Strumming & feel + Comp the progression | heard | **Merge** into one "Rhythm guitar" drill (step 9) |
| Note naming (tap) | — | **Freeze** — keep as is, no new work |
| Interval ear · Chord-quality ear | heard (by ear) | **Keep**; start narrow, widen with mastery (step 9) |
| Rhythm ear | — | **Cut (v2.17.0)** |
| Chord-tone targeting (tap, answer lit) | — | **Cut (v2.17.0)** — the lit version is Harmony ▸ Arpeggio + Jam |
| Call & response (tap, call lit) | — | **Cut (v2.17.0)** |
| Sessions · SRS learner · progress card | — | **Freeze** — no new work until fewer, better drills feed them |
| Latency calibration | heard | **Keep**; moves into the mic flow (step 8) |
| Export / import · persistent storage | — | **Keep** — data safety |
| Share links | — | **Cut (v2.17.0)** — an old link opens the app, hash ignored and cleared |
| Custom tunings · time signatures · colour-blind palette + shapes | see | **Keep** — cheap, and accessibility matters |
| PWA · shortcuts · welcome · changelog modal | — | **Keep**; changelog entries get short (step 2) |

The open questions (Triads, Identify, share links) were settled for step 1 on 2026-10-09.

---

## The plan

Each step ships on its own, keeps all gates green (`npm run lint`, `npm test`, `tools/shoot.js`
review), and changes no saved data unless it says so.

**Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Steps 1–3 are small; 1 goes first because every
later step gets smaller after it.

### Done
- [x] **Protect progress** (v2.16.0) — `navigator.storage.persist()`, Settings ▸ Export / Import
      progress, a failed save shown to the user once.
- [x] **Cleanup** — one global `[hidden]` rule, dead `typeof` guards removed, copy and note-glyph
      fixes, slimmer `CLAUDE.md`, HTML comments stripped from the bundle.
- [x] **Cut** (v2.17.0) — Rhythm ear, Chord-tone targeting and Call & response removed (their
      history stays in the store, tested against a captured save); Over-the-changes is Comp only;
      Arpeggio's button is Jam; one tuner (mic + "Tune by ear"; Settings ▸ Tools keeps a single
      Tuner button); Triads became a toggle on Chord tones (old Triads-view saves migrate);
      Identify and share links cut (old links open the app, hash cleared). Practice has 7 cards;
      bundle 410 → 380 KB (109 → 102 KB gzipped). The Scales seam now opens the Timing drill.
- [x] **Cut the project's overhead** — the shipped changelog entries are 3 one-sentence bullets
      each (the release skill and the smoke suite enforce it); comments rewritten to say why,
      with the history narration gone — 189 → 97 KB, 32 % → 20 % of source (stopped short of
      15 % rather than delete the why-comments that remain); the smoke suite's CSS pins are one
      table. The bundle is identical apart from the changelog and whitespace;
      it shrank 380 → 368 KB (102 → 97 KB gzipped).
- [x] **Quick UI fixes** — the neck auto-scrolls to a changed window (scale position, arpeggio
      box, selected chord shape, timing drill box): smoothly, only when off-screen, never while
      held or flung (`revealFrets` in `07-render-shared.js`). Phones now start on All frets;
      a saved zoom that can't hold the picked box gives way to the whole neck for that paint
      (`withFretsFor`), so a box is never an empty board. The Harmony / Scales heading sits above
      the view switch and neck. Shape cards carry a radio mark, the selected one says it plays
      in Listen, a click strums it and rings its notes on the neck (standard tuning only). The
      progress card hides until there is a run. Note-naming and ear summaries end with "Review
      on the neck" buttons per miss (note → Scales ▸ Notes lit on it; interval → Chord tones
      with Intervals shown; chord quality → Chord tones on it, in the player's key).
- [x] **Compatibility fixtures** — `tools/capture-fixtures.js` boots ten past releases
      (v1.11 → v2.17) out of git and lets each save a realistic state into `tests/fixtures/`,
      with what that build showed. `tests/compat.js` (part of `npm test`) asserts the current
      build shows the same (apart from listed migrations), saves every key the old one did (or
      lists it as retired), clears an old share link, and that save → load → save is
      byte-identical. It found one bug: a save with an unknown tab opened on no panel;
      `loadState` now accepts only real tabs.
- [x] **State declared once** — every saved field is one row in `savedFields()` (key,
      bounds-checked read, get, set); `snapshotState` / `loadState` derive from it, and old saves
      pass through one pure `migrateSave` first. Progress (the learner model) has its own key,
      `guitarStudio.progress.v1`: settings that won't parse or vanish can't take it along, an
      older build's copy inside the settings is read until the first save, a newer app's progress
      is never overwritten, and if its key can't be written it rides with the settings. Only the
      view on screen paints (controls and board); the others repaint when shown. The wiring file
      is eight focused `15-*` files. No subscription system was needed.

### 6 — Separate key from chord (the model) · M · medium risk
- [ ] `key = {root, scale}` and `chord = {root, quality}` as distinct state; chord defaults to
      the key's tonic chord; diatonic chords selectable as degrees of the key.
- [ ] Each view's reading defined explicitly: Harmony shows the chord, Scales the key, the
      circle the key with the chord highlighted. "Listen" on the key plays its real cadence
      (i–iv–v in minor, not "I–IV–V").
- [ ] A **progression** (presets or user-built) is state of its own, saved, and readable by the
      Rhythm guitar drill (step 9).
- [ ] _Data:_ saves migrate additively (old `gRoot` → key root + chord root).

### 7 — Registry owns the drill lifecycle · S–M · low risk
Smaller now that fewer drills remain.
- [ ] Enter / exit / show-hide / summary handled by the registry; a drill provides its stage,
      tick and scoring.
- [ ] Focus moves to the drill header on start and back to its card on quit; results announced
      in the existing live region.

### 8 — The context strip: one layout grammar · L · medium risk
One compact row directly above the neck (or the drill stage), the same in Reference and Practice:

```
[ A minor ▾ ]  [ Am ▾ ]  [ ♩ 90 · 4/4 ▾ ]  [ ▶ ]  [ 🎵 tuner ]          ⚙
```

- [ ] **Key chip** → root, scale family (chips + "more") and the circle of fifths. **The circle
      becomes the key picker**; its key panel moves with it. Nav becomes Harmony · Scales ·
      Practice. _Compat:_ saves pinned to the circle tab open Scales with the key sheet open;
      shortcuts `1`–`4` become `1`–`3` + a key-sheet key (`tools/kbd-check.js` updated).
- [ ] **Chord chip** → the key's diatonic degrees first, then quality and "more". The quality
      row under the neck goes away.
- [ ] **Tempo chip** → BPM + time signature; the same control in Reference and drills.
- [ ] **One ▶** plays the chord, the progression or the jam, chosen in a **progression drawer**
      (presets, user-built, Jam on/off, band parts). Replaces Listen / Loop / Cycle / Jam, the
      Backing disclosure and the progression panel at the bottom of Harmony.
- [ ] **⚙ Settings:** Instrument (tuning, capo, frets, left-handed) · Sound (volume) · Display
      (palette, shapes, **language**) · Progress (export / import). Latency calibration moves
      into the mic flow (offered the first time a scored run starts).
- [ ] **Tuner** button in the strip, both layers.
- [ ] **Header:** brand only on phones; version badge to the footer.
- [ ] **Drill header in one row:** name · ? · 🎤 · ✕; tempo and ▶ come from the strip, so
      Start/Stop is at the top, not under the neck.
- **Done when:** on a 390×844 phone the neck starts in the top third of every Reference view and
  every drill, and every screen has exactly one tempo control and one play control.
- **Check:** `node tools/shoot.js tabs practice timing-run 390x844 844x390 1366x768 1920x1080`.

### 9 — Practice: fewer, better drills · M
- [ ] **Rhythm guitar** = Strumming & feel + Comp: a pattern (or free) over one chord *or* the
      progression from step 6. With the mic, scored on timing error.
      _Data:_ `strum:*` and `comp:*` histories are read by the new track.
- [ ] **Timing:** with the mic, the main score and trend are the mean timing error (already
      recorded as `err`). Without the mic, record a scoreless session so the track is not due
      forever.
- [ ] **One-minute changes:** any two chords the player picks, barre chords included.
- [ ] **Ear drills:** start narrow (a few intervals / major vs minor) and widen with mastery;
      add descending and harmonic intervals.
- [ ] **Practice home:** each card shows last result, trend and a "due" dot; one mic icon where
      the mic is used replaces the three badge kinds; the session card says what it will do.
- **Done when:** checked on a real phone as well as by the headless tools.

---

## Parked — only if real use asks for it

- Pitch-scored drills (note finding by string, chord-tone targeting, call & response played on
  the guitar). `pitchy` makes them possible; nothing yet shows they are needed more than the
  drills above done well.
- Lead lines scored by onset and pitch.
- Print / export of a chord & scale sheet.
- A general reactive state store (see step 5).
