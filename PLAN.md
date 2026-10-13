# Euterpe — Plan

_Shipping: v2.18.0 · Updated: 2026-10-13_

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
| Circle of fifths as a tab | see | **Done (step 8)** — the key picker, in the strip's key sheet; nav is three tabs |
| Listen / Loop / Backing / progression Play / Cycle / Jam | play along | **Done (step 8)** — one ▶ + the progression drawer |
| Mic tuner | heard | **Keep** |
| Reference-tone tuner | — | **Merged (v2.17.0)** — "Tune by ear" inside the one tuner panel |
| Timing & subdivision | heard | **Done (step 9)** — read on its timing error |
| One-minute changes | heard | **Done (step 9)** — your own pair, any chords |
| Strumming & feel + Comp the progression | heard | **Done (step 9)** — one Rhythm guitar drill |
| Note naming (tap) | — | **Freeze** — keep as is, no new work |
| Interval ear · Chord-quality ear | heard (by ear) | **Done (step 9)** — narrow first, widening with mastery |
| Rhythm ear | — | **Cut (v2.17.0)** |
| Chord-tone targeting (tap, answer lit) | — | **Cut (v2.17.0)** — the lit version is Harmony ▸ Arpeggio + Jam |
| Call & response (tap, call lit) | — | **Cut (v2.17.0)** |
| Sessions · SRS learner · progress card | — | **Freeze** — no new work until fewer, better drills feed them |
| Latency calibration | heard | **Keep** — in the mic flow since step 8 |
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
- [x] **Key and chord separated** — the key (`keyRoot`/`keyLbl` + `scIdx`) is what Scales, the
      circle and Notes show; the chord (`chRoot`/`chLbl` + `chQual`) is what Harmony shows, the
      band loops and "play over this" reads. A new key brings the chord to its tonic root
      (quality kept); a degree of the key (Harmony's new "Chords in key" row), a
      progression step, a scale's chord or the circle's "Open in chords" moves the chord and
      leaves the key alone. The circle rings the chord when it isn't the tonic. The cadence
      button plays and names the key's own I–IV–V–I (i–iv–v in natural minor, i–iv–V in
      harmonic minor). The progression (`seq`, saved) no longer moves the key while it plays,
      and presets are spelled in the key; the Rhythm guitar drill (step 9) reads `seq`.
      _Data:_ the key keeps its save names (`gRoot`, `gRootLbl`); `chRoot`/`chLbl` are new, and
      an older save's root becomes the chord root too (compat checks it against every fixture).
- [x] **Registry owns the drill lifecycle** — a drill registers `begin(arg)` (its state and
      stage) and `end()` (clocks, mic, state); the registry shows its area and hides the rest,
      names and focuses the header on start, and on Quit or Done closes back to the home with
      focus on the card that opened it (Done leaves a timed session running). One drill at a
      time: opening another ends the first. `drillRecord()` records, saves, repaints the home
      and says the result in a live region (`#drill-live`; there was none, so it is new). The
      note and ear drills share one summary (`renderDrillSummary`: stats, review, Again, Done).
- [x] **The context strip** — one row directly above the neck (Reference) or under the drill
      header (Practice): key · chord · tempo · ▶ (+ ▾ drawer) · tuner · ⚙. One element, moved
      between the two slots (`placeStrip`, `15-0-strip.js`); each chip opens a sheet, one at a
      time (a bottom sheet on a phone, so the neck stays in view). The key sheet holds the root,
      the scale (common keys, the modes behind "more") and the circle of fifths as the picker,
      with its key panel and cadence; nav is Harmony · Scales · Practice. The chord sheet holds
      the key's degrees and the quality picker (gone from under the neck). The tempo sheet holds
      BPM (slider ± 5), the meter and the metronome. One ▶ plays the chord on a loop or the
      progression (the drawer: source, presets/strip, Jam + bass/drums), replacing Listen,
      Loop, the transport chip, the Backing panel, the progression panel and the Jam buttons.
      Settings: Instrument · Sound · Display (+ language) · Progress. Latency calibration
      moved into the mic flow: offered when a scored run is switched on or started unmeasured,
      ⏱ in the drill header re-opens it. The header is the brand only on phones; the version
      badge is in the footer. Drills declare `key` / `chord` / `tempo` / `play` (+ `playing`,
      `playKey`) and lost their own Play/Start/Replay buttons; the drill header is one row
      (name · ? · setup · 🎤 · ✕); a run folds the setup and the hint. Shortcuts: 1–3 nav,
      K key sheet, Space = the strip's ▶ (a drill's too); L is gone.
      _Data:_ a save on the circle tab opens Scales with the key sheet up (compat lists it in
      MIGRATED); `playSrc` is new; `backingOpen` now means the drawer. On a 390×844 phone the
      neck starts at ~216px (Reference) and ~236px (timing run).
- [x] **Practice: fewer, better drills** — **Rhythm guitar** replaces Strumming & feel and
      Comp: a pattern or your own rhythm, over the chord or a progression (a preset in the key,
      or the one built in the ▶ drawer), the feel layer over all of it; with the mic it scores
      a pattern's strums or, free, the changes. Its track (`rhythm-guitar`, sessions
      `rhythm:<over>:<pattern>`) reads the `strum:*` and `comp:*` history (`reads`). **Timing**
      is read on its timing error (`metric:'err'`): headline, best and trend; a coach run is
      recorded unscored and still keeps the track from falling due. **One-minute changes**
      adds "your pair": any root and quality, barre chords included (`cmCustom`, saved).
      **Ear** starts narrow (M3 · P5 · P8; major vs minor) and widens a level once each item
      is answered right twice running; intervals add descending at level 2 and harmonic at 3.
      **The home**: each card shows its last result and trend, a dot when due (overdue,
      cold or slipping — not merely new), and one 🎤 where the drill listens instead of three
      badge kinds; the session card says what it will run. Practice has six cards.
      _Data:_ additive — `cmCustom` is new; old strum/comp sessions and bests are untouched
      and read by the new track. Still to do by hand: a check on a real phone.



---

## Parked — only if real use asks for it

- Pitch-scored drills (note finding by string, chord-tone targeting, call & response played on
  the guitar). `pitchy` makes them possible; nothing yet shows they are needed more than the
  drills above done well.
- Lead lines scored by onset and pitch.
- Print / export of a chord & scale sheet.
- A general reactive state store (see step 5).
