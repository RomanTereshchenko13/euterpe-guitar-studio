# Euterpe — Roadmap

The next chapter is not "more features." It's turning what we have — a strong **reference**
app plus a planned set of **drills** — into **one learning system** where a single musical
context flows from reference into practice and back, the app tracks what you know, and
practice covers *both* halves of real playing.

**Hard constraint throughout:** zero runtime dependencies, shipped as a single `index.html`.
Code is authored as small `src/js/NN-*.js` modules and concatenated by a pure-string
`build.js` (no bundler, no transpile). Every item below is reachable with the Web Audio API
and vanilla JS. New phases add new `src/` modules; they never add a dependency.

_Last updated: 2026-06-21 · shipping: v2.3.0_

---

## Where we are

The reference app and audio engine are mature. Shipped so far (full detail in `CHANGELOG.md`):

- **Tone** — a guitar-like Karplus-Strong voice (body resonance, pick position, velocity,
  fractional tuning, per-string timbre). _(v1.8)_
- **Stereo + output stage** — the voice spreads across the stereo field by register
  (trebles wider, bass centred; hats off-centre), a user master-volume trim, and a final
  brickwall limiter so loud levels / dense chords can't clip. _(v2.2)_
- **Reference-tone tuner** — a no-mic tuner: hold a sustained pitch per open string of the
  current tuning (re-labels with Drop D / DADGAD / Open G). _(v2.2)_
- **Audio engine** — lookahead "two-clocks" scheduler (no more timer drift), named buses,
  synth cue sounds. The gate for anything timed. _(v1.9)_
- **Backing band** — synth bass, humanized comping, groove click + snare backbeat. _(v1.10, v1.14)_
- **Release hardening** — responsive/mobile fretboard, committed jsdom test harness + CI,
  graceful audio-unavailable degradation, one documented state catalogue. _(v1.11)_
- **Voicing parity** — canonical voicing set per chord (open + E/A barre), selectable cards,
  triad inversions, context-aware Listen/Loop. _(v1.12)_

So the foundation is done. What's missing is everything that makes it a *system*.

> **Naming note.** The old `A–H` / `C+` / `R` phase labels grew inconsistent and are retired.
> Shipped work now lives in "Where we are" above; forward work uses the numbered phases below.

---

## The thesis: one system, not two halves

Today the app is a **reference encyclopedia** (chords, scales, triads, circle of fifths, a
backing band) bolted next to a **planned drill set**. Two good halves that don't know about
each other. Worse, even *within* the reference the tabs are islands — each is its own mini-app
with its own board, and the diatonic-chord logic is implemented twice.

The whole roadmap below exists to fix that. A real learning system has a spine and a shape:

```
   EAR        pitch recognition        ‖   rhythm dictation
 ──────────────────────────────────────────────────────────────
 FOUND-    timing / subdivision  ·  fretboard knowledge  ·  mic input
 ATIONS
 ──────────────────────────────────────────────────────────────
   PLAY     LEAD  — play OVER the changes  ‖  RHYTHM — play THE changes
            chord tones → arpeggios        ‖  changes → strum patterns
            → guided improvisation         ‖  → comping → groove
 ──────────────────────────────────────────────────────────────
  SPINE     one musical context   ·   reference ↔ practice seam   ·   learner model
```

Most guitarists are rhythm players most of the time, so the **Rhythm** pillar is not a
complement to soloing — it's the broader-audience half, and we already own the engine for it
(the backing band). The two pillars sit on shared foundations, and everything rests on the
spine.

---

## The spine (what makes it a system)

Three cross-cutting pieces that every phase hangs off. Build them once; reuse them everywhere.

1. **One musical context.** A first-class key/context (root + mode) that *every* view reflects.
   Pick "A minor" once and notes, scales, harmony, circle, the sequencer, and the drills all
   follow. Replaces the current shared-root-only state; lives in the documented state
   catalogue and rides `saveState()` / `loadState()`.
2. **The reference ↔ practice seam.** Relationships are *navigable*, bidirectionally, on the
   same content: from any reference view → "drill / ear-train / jam this"; from any drill →
   "show it on the neck / explain why." This is the literal difference between two halves and
   one system.
3. **The learner model.** The app knows what you know. Per-item history, accuracy, and a
   spaced-repetition queue that resurfaces what you miss — the engine that decides *what to
   practice next* and powers streaks, progress, and (later) the guided path. Starts simple,
   grows as phases land.

---

## Guiding principles

- **Stay zero-dependency; ship single-file.** Small additions, not a new engine.
- **One context, one source of truth.** No more parallel mini-apps or duplicated music theory.

### Dependency policy

The guarantee worth defending is *behavioural*, not purist: **one file, fetches nothing, no
runtime/supply-chain dependency, works offline.** Third-party code is allowed only when it is
(a) **permissively licensed** (MIT / BSD / 0BSD / Apache-2.0 — **never copyleft**, since GPL
would relicense the whole single-file output), (b) **vendored** — its source copied into `src/`,
audited, and concatenated by `build.js` so nothing is fetched at runtime — and (c) solving a
genuinely hard, already-solved problem we shouldn't re-derive. Under that bar, the sanctioned
additions are:

- **Pitch detection — `pitchy` (0BSD), vendored.** The one code dependency, for Phase 8 / F2;
  re-deriving YIN/McLeod badly is the moonshot's main failure mode. _(Rejected: `pitchfinder` —
  GPL-3.0, would relicense the app.)_
- **Free platform API (no dependency):** `AudioWorklet` (off-main-thread synth + mic analysis).
- **Small inlined sound assets (CC0 / public-domain only):** a few drum one-shots and a guitar-
  body / room **convolution impulse response**. Assets, not libraries; base64-inlined, license
  verified at selection time — they keep the single-file guarantee.

Everything else stays hand-rolled (theory, scheduler, synth, UI, onset detection, PWA, share links).
- **Validate musically, not just syntactically.** Each phase ships harness checks (spectral/
  tuning for tone, grid-timing for the scheduler, drill-logic + scoring-window for practice).
- **Each phase stands on its own** where possible, so partial progress is shippable.
- **Honest framing of feedback-free features.** A drill that can't *hear* the player is a
  coach, not scored training — label it as such, and never ship a scored tier on tap input
  (touch latency corrupts timing, especially on mobile).
- **A coach tier still has to feel rewarding.** "Timed but not scored" is the honest label, but
  it's also a retention risk: the screen-only tiers (note-naming, one-minute changes, the visual
  metronome) have to earn their keep on streaks, pace, and visible progress *without* a score, or
  they won't get used. Make "does this feel good unscored?" an explicit acceptance check per
  drill — it's the real product risk for Phases 3, 5, and 7 before the mic lands, not an
  afterthought.

---

> **Reading the phase tags.** Each phase carries a rough **Size** (S/M/L/XL — effort, not
> calendar) and **Risk** (low/med/high — chance it needs rework or fights the platform).
> Deliberately coarse: enough to show that Phase 4 and Phase 8 are not the same bet, not a
> commitment to estimates.

## Phase 1 — Unify  (spine + reference · foundational)

**Size:** L — split into 1a–1d below, each shippable · **Risk:** med (the one-board refactor)

The keystone. Build the spine at the reference level and tidy the shell, *before* stacking
practice on top — the backbone here is exactly what the later phases reuse. Phase 1 is the one
phase that resists "stands on its own," so it ships as four ordered, independently-releasable
steps: foundational logic first (low risk, fully assertable), the risky refactor isolated in the
middle, net-new features, then a scoped feel pass last.

**1a — Spine + dedup (foundational · low risk). ✅ Shipped v1.15.0.** Pure logic, minimal UI churn.
- **One musical context** (spine #1) wired through every existing view. ✅ The key center + mode
  (`gRoot`/`gRootLbl` + `scIdx`) is now a first-class shared context set in one place (`setKey()`);
  Harmony, Scales, the Circle and Notes all follow it. The circle became a live *projection* of the
  context (its selection is derived, no longer separately persisted). Replaced the old
  shared-root-only state; documented in the state catalogue and bounds-checked through
  `saveState()` / `loadState()`. _Carried into 1b: the Notes tab currently only **reflects** the
  shared root (push); full bidirectional key-setting lands when Notes is folded into the unified
  board._
- **One diatonic source.** ✅ Collapsed the duplicated diatonic logic — `diatonic()` (scales) and
  `buildDia()` (circle), which disagreed on the `'?'`/`aug` fallback — into a single
  `diatonicTriads()` helper both call. Parity asserted against *both* old outputs in the harness
  before deleting the duplicate.

**1b — One board, modes (the risky refactor · isolated). ✅ Shipped v1.16.0.** The highest-risk
near-term change, landed on its own behind the green harness.
- **One board, not four.** ✅ The four DOM boards (`ch`/`tr`/`sc`/`nt`) collapsed into a single
  shared `#board` that switches what it highlights; each render path now splits panel content from
  the board paint and only the active mode paints (one shared legend + hint switch with the mode).
  Responsive + a11y assertions stay green; the live harness drives real tab/sub-view clicks.
- **Consolidate control strips.** ✅ Grouped where clean (e.g. scale select + position share a row);
  deeper compaction of the triad rows can ride 1d's pass while the board is open.
- **Fewer tabs.** ✅ Folded **Notes on fretboard** from its own tab into a **Notes view inside
  Scales** (4 tabs → 3), mirroring the Chords/Triads toggle (chosen over a board-lens to reuse the
  existing sub-view pattern). Its note-highlighting is preserved; the richer note-finder is Phase 3.
  Old saved `notes`-tab state migrates to Scales + the Notes view.

**1c — Reverse lookup (net-new value). ✅ Shipped v1.17.0.** The questions players actually arrive
with, previously impossible — the biggest usefulness gain per unit of new code:
- **Chord identifier** ✅ — an *Identify* view under Harmony: tap the notes on the shared board →
  `identifyChord()` names the chord by exact pitch-class match across every quality at every root,
  so genuine ambiguities surface as multiple names (C6 / Am7) and a non-root bass reads as a slash.
  When nothing fits exactly, `nearChords()` falls back to the closest matches — naming the chord the
  selection is one or two notes from and reporting the missing tone / extra note — so a real-world
  voicing teaches the player instead of dead-ending on "unknown".
- **Scale/arpeggio suggester** ✅ — the vestigial Chord-reference sidebar became a live "Play over
  this" panel: for the current harmony chord it shows the arpeggio + every scale that contains the
  chord tones (`scalesOverChord()`), each a chip that jumps to that scale in Scales — the first
  taste of the reference→practice **seam** (spine #2). _(Progression-level suggestions deferred.)_

> **IA note (decided during 1c):** Circle of Fifths stays its own tab. The Chord-reference sidebar
> was replaced by the contextual suggester rather than removed.

**1c follow-up — the seam goes both ways (✅ Shipped v1.27.0).** The suggester wired Harmony → Scales,
but the reverse direction was missing — Scales and the Circle were sinks. Now: an overlaid diatonic
chord in Scales exposes an **"Open in chords"** action that jumps to that chord in Harmony's chord-tones
view (`triadQi` maps the diatonic triad to its `QUALITIES` index), and the Circle gains the same
**"Open in chords"** button beside "Open in scales" (opens the key's tonic triad). Every reference view
that *shows* a chord can now *open* it — bidirectional navigation on the same content (spine #2), the
literal seam the practice phases extend with "drill this / show this."

**1d — Feel pass (the polish bar, scoped). ✅ Shipped v1.18.0.** Held the "every phase ships
feel" bar here rather than deferring all of it to Phase 9 — riding 1b's board rebuild while the
board was already open. Pure CSS, transform/opacity only, gated on `prefers-reduced-motion` (the
global reset neutralizes CSS animation; the one JS-driven path — the pluck ripple — checks
`motionOK()` explicitly), and the dot/cell-count harness assertions stayed green throughout. Built
on the scheduler's rAF visual queue + the panel fade already in place, since an audio/timing app's
animation should make *sound and rhythm visible*:
- **Beat pulse** ✅ — the transport indicator pumps on every scheduled beat (stronger on the
  downbeat) while the loop/backing band plays, enqueued from the same per-bar visual path as the
  dot-lighting, so rhythm is *seen*, locked to the clock — not a free-running CSS loop.
- **Pluck ripple** ✅ — a one-shot expanding halo (`rippleDot`) from a fretboard dot on a real
  pluck (tap / Enter / Space), reading as sound emanating; skipped under reduced motion.
- **Board-change stagger** ✅ — dots fade in with a small left-to-right delay (~150 ms total,
  opacity only so the lefty mirror + `.playing` scale are untouched) on a genuine context/chord/
  scale re-render; suppressed on Identify taps so picking a note doesn't fade the whole neck.
- **Circle relationship motion** ✅ — a connecting subdominant→tonic→dominant arc is drawn behind
  the wheel nodes on key selection, turning the static recolor into a visible harmonic relation.
- _(Bonus, on the way past:)_ the timing-bar controls were aligned to a common 34 px height so
  they stay tidy across browser-zoom levels.

Broader feel — onboarding, empty/error states, drill responsiveness — stays Phase 9's; 1d is
just the reference-level polish that belongs with the views being built here.

**1e — Clarity pass (declutter, no new surface). ✅ Shipped v1.19.0.** A UX-audit follow-up that
reduced first-load density without removing any tool — the Phase-1 surface was complete but reading
as overloaded, especially on a phone:
- **Board front-and-centre** ✅ — the chord-shape cards + the progression sequencer moved out of
  `#sub-chords` into `#harmony-extras` **below** the shared board (toggled by `applyHarmonyExtras()`
  for Harmony→chord-tones only), so the neck sits directly under the controls instead of being
  pushed ~2 screens down on mobile.
- **Chord picker chunked** ✅ — the 21 qualities render in three labelled tiers (basic / sevenths /
  extended) via a per-quality `grp` tag; the array order is untouched so persisted `chQual` indices,
  presets and the test harness are unaffected.
- **Timing bar declustered** ✅ — metronome / bass / drums collected into one labelled "Backing"
  `.tb-group`, so the always-visible bar reads as a few chunks rather than 8 loose controls.
- **Fewer control layers** ✅ — the per-tab view switch (chord-tones / triads / identify, or
  scale / notes) folded up out of each panel into the shared context bar, which now reads as one
  **View · Root · Display** header (`#ctx-view-harmony` / `#ctx-view-scales`, toggled in
  `applyContextBar`); separators hug each group via `.ctx-group:not(.ctx-view)` so they never orphan.
- **Suggester beside the board** ✅ — `.layout` became a CSS grid with named areas; `#board-region`
  and `#harmony-extras` are now direct grid children, so on a phone the "Play over this" aside slots
  between the board and the chord reference instead of landing at the very bottom. A `no-aside`
  class (set in `applyAsideState`) drops the reserved 234 px column on Scales / Circle.
- **Alignment nits** ✅ — the mobile tab strip gains a position-aware right-edge fade (`syncTabsScroll`)
  so a clipped tab reads as scrollable; the root↔display separator now hugs its group
  (`.ctx-group` border-left) instead of orphaning a floating divider when the controls wrap.

**Validation:** the single diatonic helper reproduces the old scales + circle output (assert
parity before deleting the duplicate); context round-trips through localStorage; the chord
identifier names known shapes; the one-board refactor keeps the responsive + a11y assertions
green; the feel pass leaves those assertions green and is fully neutralized under reduced-motion.

---

## Phase 2 — Complete the reference  (content · trickles alongside)

**Size:** M · **Risk:** low — reuses the existing triad/board rendering.

Fill the genuine content gaps, roughly by payoff:

- **Arpeggios** ✅ **Shipped v1.20.0.** A new *Arpeggio* view under Harmony: the live chord (shares
  `chQual` with chord-tones, so switching views keeps the chord — the bridge) shown as a melodic
  shape. Reuses the chord-tone board paint + the scale-view box window to isolate one practice
  position; Listen runs it ascending up the neck (`animRun`) instead of strummed. One new view
  button, no extra control layers.
- **Intervals on the neck** — the visual counterpart to Phase 4's interval ear training.
  _(Deferred from the v1.20.0 increment: overlaps the existing Names/Intervals degree display and
  Phase 4; revisit alongside the ear-training work.)_
- **CAGED** ✅ **Shipped v1.20.0.** Surfaced as a labelling layer (no new tab): the major scale's
  five positions are relabelled with their `E·D·C·A·G` shapes (the app anchors positions at
  `(root−4)+BOX_OFFSETS`, so position 1..5 land on those shapes up the neck), and the panel names
  the chord form each box is built around. Restricted to Ionian, where the scale root *is* the
  parent-major root and the mapping is exact — modes anchor to their own root, so labelling them
  would be wrong.
- **Capo** ✅ **Shipped v1.20.0.** A `capo` setting (0–7) in the collapsed toolbar next to Tuning /
  Frets — zero new visible surface. A capo doesn't move pitches, so highlighting math is untouched;
  the board dims the frets behind it and draws a brass bar at the capo fret (a movable nut). Rides
  `saveState()` / `loadState()` bounds-checked.

_Lower priority:_ deeper voicings (full-chord inversions / drop-2 / slash chords) for
intermediate+ players; modes shown as a *family* (relationship to the parent major) instead of
a flat list of twelve scales.

- **Custom tunings.** Today's tuning selector is a fixed list of four presets (standard, Drop D,
  DADGAD, Open G). Add arbitrary per-string entry so any tuning works — the board/highlight math
  is already tuning-driven (`applyTuning` → `OPEN_MIDI`), and the v2.2 tuner already re-labels off
  it, so this is mostly a small input UI + a bounds-checked custom entry in `saveState`/`loadState`.

---

## Before Phase 3 — Mobile shell pass  (scroll & reachability · ships first)

**Size:** S–M · **Risk:** low–med · **✅ Shipped v1.24.0.**

A scroll-reduction and live-session pass on the *existing* reference shell, landed **before** the
practice phases stack drill UI on top — Phase 3+ inherits this layout, so fixing it once here beats
retrofitting every drill. Pure shell work on what already ships: no new musical surface, no
learner-model dependency, so it was independent of everything below. Shipped, low-risk → high:

- **Cut the control stack above the board.** ✅ The per-panel help paragraph (`#harmony-p` · `#scales-p`
  · `#cof-p`) now collapses behind an accessible `?` toggle in the heading on mobile (`.ph-help`), and
  the wrapping control rows (`.row > .group`) + the three-tier `#ch-quals` / `#arp-quals` quality
  pickers swipe sideways instead of stacking into tall blocks. The shared root picker deliberately
  keeps wrapping so all 12 roots stay visible.
- **Sticky fretboard.** ✅ `#board-region` is `position: sticky` in the single-column layout so the neck
  stays in view while you work the pickers above and the voicing cards / sequencer below. Refined to
  **neck-only**: the legend + hint moved into a sibling `#board-meta` row so only the neck pins. A small
  **magnetic settle** (`magnetNeck`) snaps it back when a scroll leaves it barely unpinned. (Sticky
  string-name labels were tried and dropped — not needed.)
- **Harden the live jam session.** ✅ `overscroll-behavior-y: contain` on `body` kills accidental
  pull-to-refresh, and a **Screen Wake Lock** (`syncWakeLock`, synced from the transport) holds the
  screen awake while the loop / metronome / progression sounds.
- **Condensing header on scroll.** ✅ The header pins and slims past a scroll threshold (`.scrolled`,
  with hysteresis), folding the tempo/backing groups away while keeping tabs + play/transport reachable.
  The sticky board offsets directly below it via a live `--hdr-h`.

_Next mobile work (the shared selection surface — folds into the Phase 3 drill shell): unify the
chord/triad + root selection across the Chords and Scales panels — consistent control surface, a
chord-over-scale overlay in Scales, a compact piano-style root picker, less vertical height._

**Follow-up — UX polish (desktop + reachability). ✅ Shipped v1.25.0.** A second pass extending the
shell work to the desktop and the still-rough corners, again no new musical surface:
- **Desktop fretboard scale-up.** ✅ The neck's *width* already adapted (JS `cellW()`); its *vertical*
  size was fixed, so a wide screen stretched it into a thin strip. Two `min-width` tiers grow `.srow`
  height + dot size with the viewport (vertical + dot only — the 30 px slabel/ocell widths stay put so
  `leftFixed()`'s board↔fretnum alignment is untouched; dots capped ≤33 px to still breathe in the
  `CELL_MIN=34` all-frets cell).
- **Keyboard shortcuts.** ✅ Space = listen/stop, L = loop, M = metronome, 1–3 = tabs, A–G = key,
  `[`/`]` = transpose, `?` = a bilingual cheat-sheet (also a desktop-only footer affordance). Guarded
  against field-typing, modals and modifier chords; Space only hijacked when focus isn't on a control,
  so a focused dot/button keeps native Space. Seeds the Phase-3 drill transport.
- **Landscape two-pane.** ✅ Replaced the earlier "scroll away as one column" landscape fix with a real
  split (`:has(#board-region:not([hidden]))`-gated): controls/cards/progression scroll left, the neck
  pins right and stays in view. The board-less Circle tab falls through to the full-width single column.
- **Help collapses everywhere.** ✅ The per-view description **and** the board's playing-hint now tuck
  behind the heading `?` on *every* viewport (was phone-only, description-only), driven by a body-level
  `help-open` since the two texts live in different subtrees — a cleaner default screen.
- **Swipe affordance.** ✅ The swiping control rows + tiered quality pickers fade at the right edge when
  they actually overflow (`markScrollables`, the same cue the tab strip + neck use; re-measured on
  resize and after the webfont loads).

**Validation:** `npm test` stayed green throughout (271 checks) — CSS/structure changes don't touch the
fret-cell width math the overflow assertion measures (`boardWidth()`), and sticky/header are inert in
jsdom; the sticky board + condensing header got a real-device pass on iOS Safari. The v1.25.0 pass added
two headless functional checks (`tools/kbd-check.js`, a help-toggle probe) and screenshot passes across
desktop / landscape / narrow-phone widths.

**Follow-up — pre-Phase-3 polish (declutter + mobile). ✅ Shipped v1.25.1.** A redundancy/clunk pass over
the existing surface (no new musical features), patch-level:
- **Chord-quality progressive disclosure.** ✅ Only the *basic* tier shows by default; a `more`/`less`
  toggle on the CHORD header line reveals the seventh + extended tiers (auto-revealed when the active
  quality lives in one). Shared `chQualsAdv` across the chord + arp pickers; the two builders collapsed
  into one `renderQualPicker`.
- **Full-width desktop board.** ✅ The suggester moved up beside the controls and the neck now spans the
  full page width below (`availW()` measures the board's own `.scroll` column, not `.main` — also fixes a
  latent landscape mis-fit).
- **Notes view simplified.** ✅ Dropped the 17-button note grid (it duplicated the context Root picker);
  the highlight follows the shared root, a single "Naturals only" toggle replaces the segmented control,
  and the dead Names/Intervals toggle is hidden there.
- **Backing collapsible + leaner header.** ✅ Metronome/bass/drums moved out of the always-visible bar into
  a `Backing ▾` panel (tints green while active); the transport bar is now Listen · Loop · Settings ·
  Backing on one row with Tempo on its own row below.
- **Mobile context bar un-boxed.** ✅ The View/Root/Display panel drops its border/background on phones and
  reads as clean labelled rows.
- **Scroll fix.** ✅ Tempo sits last on its own full-width row so the condensing header's fold can't strand
  a control mid-row (caught visually, not by `scroll-check`, which stayed green).

**Validation:** `npm test` 271 green, `kbd-check` 12 green, `scroll-check` clean (no flip-flop/drift/thrash,
smooth condense); screenshot passes at 390 / 1280 incl. condensed-header and Backing-open states.

---

## Phase 3 — Practice core  (where the spine pays off)

**Size:** L · **Risk:** med — the learner model is net-new; pin its schema first (below).
**✅ Shipped v2.0.0** as three steps: 3a two-axis navigation (Reference · Practice, bottom-nav
on mobile), 3b learner model v1 (per-item SM-2-lite SRS + sessions ring buffer, bounds-checked
persistence, progress readout), 3c the first drill — fretboard note-naming on its own board,
scored on accuracy, writing the learner model, reachable via the seam from the Notes view.
_Latency calibration was deferred to the first beat-locked drill (Phase 5/7) that consumes it —
the note-naming drill is self-paced and has no scoring window._

The **Practice** surface and the machinery every drill shares. **Settle the navigation model first**
(recommendation below) — Practice is the tab count's tipping point, so the IA decision gates the shell:

- **Practice shell + session scoring**, reusing the unified board + the scheduler + cue sounds.
- **Learner model v1** (spine #3): per-item history, streaks, spaced-repetition queue. **Pin the
  persisted shape before building on it** — every later phase hangs off this, so it gets the same
  bounds-checked `loadState` discipline as the rest of the state. The v1 shape, deliberately
  minimal and namespaced so any phase can mint items without a schema change:

  ```
  learner: {
    v: 1,
    items: {                          // key = stable id, e.g. "note:E:str6" / "interval:P5"
      "<id>": { seen, correct, streak, ease, due }   // counts + SRS (ease factor, next-due epoch)
    },
    sessions: [ { t, drill, score } ] // bounded ring buffer, newest last
  }
  ```
  The SRS fields (`ease`/`due`) are an SM-2-lite the queue reads to decide what to resurface. The
  shape grows by adding item namespaces, never by reshaping; a `v` bump + migration is the only
  sanctioned way it changes.
- **Latency calibration.** A one-time offset the scoring window reads — needed now for tap
  windows, reused later by mic windows. Not a mic-only concern.
- **First drill: fretboard note-naming.** App asks for a note; you tap every instance; timed
  and scored. Pure-screen, low-risk — the table-stakes floor of the tab.
- **The seam** (spine #2) wired in: jump from any reference view into a drill on that content. The
  bidirectional reference seam already ships (v1.27.0, above) — Practice extends it, it doesn't invent it.

> **Recommendation — split navigation onto two axes before adding Practice (decide now, build once).**
> Today's three tabs (Harmony / Scales / Circle) are all **reference content**; Practice and Ear are
> **activity modes**, a different axis. Flattening both onto one top strip is the IA smell — and that
> strip *already* horizontal-scrolls on a phone at three tabs, so appending Practice (4) + Ear (5) makes
> it worse exactly where most practice happens. Don't add Practice as top tab #4. Instead:
> 1. **Keep the three reference tabs as-is** — they're well-unified (one shared context, one board) and
>    need no churn. They become the sub-level *inside* Reference.
> 2. **Introduce a primary mode layer** — Reference · Practice · Ear (· Progress later) — as a
>    **bottom-anchored nav** on mobile (which doubles as the thumb-zone home the cross-cutting notes
>    already call for); Harmony/Scales/Circle ride as a secondary level within Reference.
> 3. **Make Practice contextual, not just a destination.** Per the thesis, Practice is reachable as
>    "drill this" *from* each reference view via the seam — not only by navigating to a tab from cold.
>    A 4th island would re-create the two-halves problem Phase 1 exists to kill.
>
> This is the cheapest moment to make the call: the shell built here is what Phases 4–7 inherit, and the
> bidirectional seam (v1.27.0) is the first working piece of axis #3.

**Validation:** drill logic, scoring-window correctness with the calibration offset applied,
persistence of stats + streak/SRS state.

---

## Phase 4 — Ear  (foundation · parallel, independent)

**Size:** S · **Risk:** low — multiple-choice on the existing audio buses; nothing new underneath.
**✅ Shipped v2.1.0.** Ear lands as the **third primary mode** (Reference · Practice · Ear) the
two-axis nav was built to hold — the bottom bar flexes to three on a phone. One shared
recognition engine (prompt on the audio buses → multiple-choice → cue feedback → scored on
accuracy) drives three drills, each writing the learner model (spine #3) under its own id
namespace so due items resurface and the global progress card counts them.

- **Pitch:** ✅ **interval** recognition (`interval:P5`) — two notes played melodically, a fixed
  12-button grid (m2…P8); and **chord-quality** recognition (`chordq:m7`) — the chord
  arpeggiated then strummed, choose among the four triads + four common sevenths.
- **Rhythm:** ✅ **rhythm** recognition (`rhythm:r3`) — a one-bar 4/4 figure clicked out over a
  soft beat reference; pick the matching pattern from proportional rhythm strips. _Framed
  honestly as recognition (the time-axis mirror of interval training), not tap-back: it's a
  multiple-choice answer, never a timing window, so it's legitimately scorable on screen — a
  real "tap/clap it back" tier waits on Phase 8's onset detection (F1)._

Bilingual EN/UK like everything else; full-state persistence + bounds-checked restore extend to
the new `ear` mode. Low-risk, high value-per-effort; ran independent of Phases 1–3.

---

## Phase 5 — Rhythm pillar  (play THE changes · broad audience)

**Size:** L · **Risk:** med — many coach tiers; scoring waits on F1 (Phase 8).

The half of playing nearly everyone does, built mostly by turning the existing backing band
into something the user plays *along with*. Coach tiers ship with no mic. Ships incrementally
(5a first), each step a new card in the **Practice** home (decided over a 4th "Play/Rhythm"
mode, to keep the bottom nav at three and leave slot 4 for Progress) under a **Rhythm** group.

- **Chord-change fluency** ✅ **Shipped v2.3.0** (5a). The "one-minute changes" coach drill:
  pick a classic open-chord pair (A–D, C–G, G–Em …) + a length (30/60/90 s), the two shapes stay
  on screen, and you tap a big thumb-zone tally on each clean change. Result is changes-per-minute
  + a **personal best per pair** — derived by scanning the learner's sessions ring buffer, so the
  pinned item shape (spine #3) is untouched and no per-item SRS is minted. Optional metronome on its
  own scheduler clock; count-in + a new-best fanfare on the cue bus. _Honest coach framing: it counts
  your taps, not your guitar — which is the authentic form of this exercise; mic scoring is Phase 8/F1._
- **Strumming-pattern trainer** ✅ **Built** (5b · ships with the Phase 5 release, held off a
  per-increment version bump). A coach *visualizer*: five common down/up patterns on a one-bar 8th-note
  grid (1 & 2 & 3 & 4 &), looped over the current context chord (spine #1) on its own scheduler clock and
  highlighted slot-by-slot in time — so you **see and hear** the pattern and strum along. `strumMidi`
  sweeps down (low→high) / up (high→low); optional beat-reference click. A practiced run (≥1 full bar)
  records a session (`strum:<id>`, bars played) so Practice progress reflects it, but mints no per-item SRS.
  _Honest coach framing: no timing score — mic onset scoring is Phase 8/F1._
- **Comping the progression** ✅ **Built** (5c · ships with the Phase 5 release). The rhythm-side
  mirror of chord-tone targeting: a chosen preset (`SEQ_PRESETS`, resolved to the context key, spine #1)
  cycles with a forced backing band (bass + groove + a guide comp via `compStrum`/`scheduleBand(force)`)
  on its own scheduler clock; a big **NOW** chord + a **NEXT** preview (reusing `cmChord`/`cmChordBox`)
  + a 4-beat indicator make the change land in time. Switch the progression live. A practiced run
  records a session (bars comped), minting no per-item SRS. _Coach tier — no timing score (Phase 8/F1)._
- **Groove / feel** ✅ **Built** (5d · ships with the Phase 5 release). A feel *lab*: loop a one-bar
  groove (swung hats + kick/snare backbeat + bass + a down-up comp) over the context chord on one
  8th-note scheduler clock, with swing baked into the off-beats, and toggle the things that make a
  groove feel right — **swing** (straight → swing → shuffle), a **backbeat accent**, and **palm-mute**
  dynamics — hearing each change live and playing along. Reuses the drum/bass primitives + a mute-able
  `gfStrum`. A practiced run records a session (bars grooved). _Coach tier — no timing score (Phase 8/F1)._
  - _Deferred (separate asset task, not a coach tier):_ the **CC0 drum one-shots + room convolution IR**
    "sound win" still needs license-verified public-domain audio to base64-inline; the groove above is
    fully synthesized. Revisit when the assets are sourced.

Scored versions need Phase 8's onset detection — and a strum is a *big* transient, so onset
scoring works **better** here than on single notes. The scored rhythm tier may arrive before
clean lead scoring.

_Sound win (per the dependency policy):_ the groove is currently fully synthesized. A few
small **CC0 drum one-shots** (kick / snare / hat) and one **guitar-body or room convolution IR**
(via `ConvolverNode`), base64-inlined, are the cheapest jump in realism here — assets, not
libraries, so the single-file guarantee holds.

---

## Phase 6 — Lead pillar  (play OVER the changes)

**Size:** L · **Risk:** med-high — real scoring needs F2 (the moonshot).

The improviser's half — turning fretboard knowledge into melody:

- **Chord-tone targeting** — the progression loops with backing; target tones light per chord;
  you hit them inside a scoring window. *Honest framing:* without a mic this trains *where the
  chord tones are* (recognition/location), not soloing — a theory/rhythm game, not guitar
  practice. Don't market it as the latter.
- **Arpeggios over changes** — play the right arpeggio shape through a progression (reuses
  Phase 2 content).
- **Guided improvisation** — phrasing, motif/call-and-response, target-note soloing prompts.

Coach/recognition tiers ship on screen; the real "play your guitar and get scored" version
needs Phase 8 (F2 pitch).

---

## Phase 7 — Timing & subdivision  (foundation for both pillars)

**Size:** S · **Risk:** low as a coach metronome; med once F1 scores it.

Subdivision command — 8th notes → triplets → 16th notes, cleanly and evenly — over the app's
own scale/triad content. A core improviser *and* rhythm-guitar skill; serves both pillars.

- **Coach tier (no mic):** pick a subdivision + tempo; accented click grid, visual pulse, and
  a chosen scale/triad walked note-by-note across the grid so there's something to play. A
  smart visual metronome — useful, *not scored*.
- **Time signatures.** The metronome, backing band and bar math are hard-wired to 4/4 today
  (`barSec = beat()*4`; kick on 1 & 3, snare on 2 & 4). Add a meter setting (3/4, 6/8, …) so the
  click accent pattern, the backing groove and the sequencer's bar length all follow — the natural
  home is here with subdivision, since both are "what the bar is made of."
- **Scored tier (needs Phase 8 / F1):** score timing accuracy and evenness, flag rushing/
  dragging, and ladder the tempo (auto-bump BPM when consistently in the pocket).

---

## Phase 8 — Real-instrument input  (mic · the unlock · highest risk)

**Size:** XL · **Risk:** high — DSP + AudioWorklet + latency + permissions; gate carefully.

Mic via `AnalyserNode`, split by difficulty. This is what turns every "coach" tier above into
*scored training* on a real guitar — the app's true differentiator. Gate carefully.

- **F1 — Onset (when).** Energy / spectral-flux attack detection — **hand-rolled** (the light
  lift). The enabler for the **Rhythm pillar** and **Timing** scored tiers; can — and should —
  land first, and onset is *easier* on a strum's big transient than on a single note.
- **F2 — Pitch (which).** Monophonic YIN/McLeod via **vendored `pitchy` (0BSD)** — the one
  sanctioned dependency, rather than re-deriving it badly. Unlocks the **Lead pillar** scored
  tier and real-guitar note-naming. Single notes first; polyphonic chord recognition remains
  the moonshot.

**Substrate (free platform API, no dependency):** **AudioWorklet** — run the mic analysis (and
ideally the synth) off the main thread, or scoring latency will be unacceptable. Treat as a
requirement of this phase, not an option.

Both audio paths need latency compensation (the Phase 3 calibration) and a permission step.

_Deferred / niche:_ Web MIDI could give perfect input for the few players with a MIDI guitar or
pickup, but that audience is tiny and the mic path already covers everyone — not planned.

---

## Phase 9 — Product layer  (good tool → competitive product · runs throughout)

**Size:** M · **Risk:** low — no DSP; all high-leverage product work.

Finishing the phases above makes an excellent free *toolbox*. These three turn it into a
product people find, adopt, and recommend — none of them DSP, all high-leverage:

- **Guided path (curriculum).** An opinionated "start here → next" thread that chains existing
  content, riding the learner model (spine #3). Turns scattered tools into a sense of progress.
- **Distribution & shareability.** Installable PWA (offline, "add to home screen"); shareable
  deep links that encode an app state (every share is a discovery channel); a few crawlable
  landing pages for SEO. Currently absent and cheap. _Also here:_ **printable / exportable
  chord & scale sheets** — a print stylesheet (and/or a one-page export) of the current
  board + diagrams, useful for teachers and students and a low-effort offline artifact.
- **Polish & feel.** Onboarding/first-run, drill responsiveness and animation, cue sound,
  empty/error states — the bar "good" actually lives at, owned by no other phase. _Includes_ a
  **colour-blind / alternate palette** option: the function colours (root / third / fifth /
  seventh) currently carry meaning by hue alone, so a high-contrast or shape-augmented palette
  is the accessibility gap that belongs with the feel pass.

**Honest scope.** Even complete, this wins its *niche* — the best free, private, no-login,
install-free, bilingual tool unifying reference + jamming + practice — not a head-to-head win
over Rocksmith / Yousician / Fender Play (polyphonic feedback, licensed song libraries, full
curricula). That's a real, defensible audience; just a different game.

---

## Suggested sequence

```
Phase 1  Unify (spine + reference)           ← foundational; everything reuses it
   │     1a spine + dedup → 1b one board → 1c reverse lookup → 1d feel pass
   │
   ├─ Phase 2  Complete the reference          (content; trickles alongside)
   │
   └─ Phase 3  Practice core                   (shell, scoring, learner model v1, note-finder)
         │
         ├─ Phase 4  Ear                        (parallel; independent of 1–3)
         ├─ Phase 5  Rhythm pillar              (broad audience; reuses backing) ── needs F1 to score
         ├─ Phase 6  Lead pillar                ────────────────────────────────── needs F2 to score
         └─ Phase 7  Timing & subdivision       (small; feeds 5 & 6) ───────────── needs F1 to score
               │
               └─ Phase 8  Mic input            F1 (onset) → scores 5 & 7
                                                F2 (pitch) → scores 6 + real note-naming

Phase 9  Product layer                          (curriculum / distribution / polish — throughout)
```

**Reading the order:**

- **Phase 1 first, non-negotiable.** The spine is the backbone the practice phases reuse;
  building practice before it means refactoring the practice UI later.
- **Phases 2 and 4 are cheap and parallel** — trickle reference content and ship ear training
  alongside the bigger work.
- **Rhythm (5) before Lead (6)** — broader audience, and the backing engine already exists.
- **Timing (7) is small** and feeds both pillars; do it early as a coach metronome.
- **Phase 8 is the unlock, not the start.** Build the coach tiers (5/6/7) on screen first, then
  F1 retro-scores rhythm + timing (it lands before F2 — strum onsets are easy). F2 is the moonshot.
- **Know what's backloaded.** By design, Phases 1–7 produce an excellent *coach + reference
  toolbox*; the stated true differentiator — "play your real guitar and get scored" — lives
  entirely in Phase 8. That's the correct risk order (prove the coach tiers cheaply on screen
  first), but it means the product-defining bet is also the last and riskiest. So every coach
  tier must be worth shipping *without* its eventual mic score, never a placeholder for it.
- **Phase 9 runs throughout** — ship the PWA + share links the moment there's anything worth
  sharing; hold a polish bar on every phase rather than deferring feel to the end.

---

## Cross-cutting concerns

- **Mobile (first-class, not a reflow afterthought).** Most practice happens on a phone, one-handed.
  The shell-level fixes ship first (see "Before Phase 3 — Mobile shell pass"); the notes here bind the
  *drill* phases built on top of it — 3–7 and the mic flow in 8 inherit them:
  - **Audio & timing.** Unlock on a user gesture (already required); account for `outputLatency` in
    any scoring window; never ship a *scored* tier on tap input — touch latency corrupts timing, so
    tap drills stay "timed, not scored" (the coach-tier rule from Guiding principles).
  - **Thumb-zone answers.** Drill answers / "next" live in the bottom third where the thumb reaches —
    one bottom action shell, reused by every drill, not re-placed per drill.
  - **Navigation that scales.** The top tab strip already horizontal-scrolls; as Practice / Ear tabs
    land (Phases 3–4) it overflows, so move to a bottom-anchored nav (which doubles as the thumb-zone
    home) — decide the pattern *before* the tab count grows, not after. See the **two-axis navigation
    recommendation in Phase 3**: reference content (Harmony/Scales/Circle) and activity modes
    (Reference/Practice/Ear) are different axes and shouldn't share one flat strip.
  - **Full-height drill panels.** Dynamic viewport units (`dvh`/`svh`) so the URL-bar resize doesn't
    reflow a live drill or the mic-permission sheet; scoring badges in reserved space (no layout shift
    when a streak counter appears).
  - **Glanceable.** Big central prompt, minimal chrome; keep all new UI within the reflowed responsive
    layout and reuse the shell vocabulary (sticky board, scroll strips, collapsible help) from the
    pre-Phase-3 pass.
- **i18n:** every label, drill name, and cue caption needs symmetric EN + UK entries (enforced
  by the harness).
- **Persistence:** the musical context, drill settings, and learner-model state all ride the
  full-state localStorage with bounds-checked restores — added through `saveState()` /
  `loadState()`, never as free-floating globals.
- **Accessibility:** keep new interactive elements focusable and Enter/Space-activatable; don't
  rely on hue alone to carry meaning (see the colour-blind palette in Phase 9 — Polish & feel).
- **Tests are the release gate:** `npm test` green on every phase; the CI action runs on push.
