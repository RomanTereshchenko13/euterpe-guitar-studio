# Euterpe — Roadmap

The next chapter is not "more features." It's turning what we have — a strong **reference**
app plus a planned set of **drills** — into **one learning system** where a single musical
context flows from reference into practice and back, the app tracks what you know, and
practice covers *both* halves of real playing.

**Hard constraint throughout:** zero runtime dependencies, shipped as a single `index.html`.
Code is authored as small `src/js/NN-*.js` modules and concatenated by a pure-string
`build.js` (no bundler, no transpile). Every item below is reachable with the Web Audio API
and vanilla JS. New phases add new `src/` modules; they never add a dependency.

_Last updated: 2026-08-02 · shipping: v2.14.0_

> **Consolidation note (v2.11.0).** Two debloat passes reshaped the *packaging* of what shipped
> below, not its substance — worth knowing when reading the ✅ entries: **Ear folded from a
> top-level mode into a Practice group** (it was a duplicate shell over the same learner model),
> **9 drills became 7** (strum 5b + groove 5d → one *Strumming & feel*; comp 5c + targeting 6a/b/c →
> one *Over the changes* with a You-play switch), every drill now shares **one Key picker + one
> Exit** via a drill registry, and the bundle shrank ~36%. Recorded progress and session
> namespaces were preserved across all of it. Where a phase entry below names a drill or a mode,
> read it as *the capability shipped* — the surface it lives on may have since merged.

---

## Where we are

The reference app and audio engine are mature. Shipped so far (full detail in `CHANGELOG.md`):

- **Tone** — a guitar-like Karplus-Strong voice (body resonance, pick position, velocity,
  fractional tuning, per-string timbre). _(v1.8)_
- **Stereo + output stage** — the voice spreads across the stereo field by register
  (trebles wider, bass centred; hats off-centre), a user master-volume trim, and a final
  brickwall limiter so loud levels / dense chords can't clip. _(v2.2)_
- **Reference-tone tuner** — a no-mic tuner: hold a sustained pitch per open string of the
  current tuning (re-labels with Drop D / DADGAD / Open G). _(v2.2)_ _(A mic-driven **chromatic**
  tuner is Phase 8 / F0 — it complements this one rather than replacing it.)_
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

> **Honest status (audited at v2.14.0 — the reason Phase 10 exists).** #1's *model* is done and holds
> everywhere, but its *control* does not: the key picker has four forms — the context bar on
> Harmony/Scales, **nothing at all on Circle** (`applyContextBar` hides the bar), `#drill-ctx` for
> drills declaring `onKey`, and nothing for those that don't. #2 is **one button** (`nt-drill`, in 1
> of 7 reference views), not the bidirectional navigability claimed above. #3 covered **4 of the 10
> practice tracks** — the other six recorded a session that nothing read, so "what to practise next"
> could not name them and no trend was ever shown. Phases 4–8 stacked ten tracks onto that.
> **B1 has since fixed #3** (see Phase 10); #1 and #2 are still open.
> **Phase 10 finishes the spine before F2 stacks more on it.**

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

- **Pitch detection — `pitchy` + `fft.js`, vendored. ✅ Landed v2.12.0 (F0).** Re-deriving
  YIN/McLeod badly is the moonshot's main failure mode, so this is the borrowed part; it
  carries through to **F2**. _(Rejected: `pitchfinder` — GPL-3.0, would relicense the app.)_
  Two corrections to what this line used to promise, both found at vendoring time:
  - **Not 0BSD.** `pitchy` 4.1.0 ships MIT in its npm metadata and an ISC/0BSD-style grant in
    its repo `LICENSE`. All permissive, nothing copyleft, so the policy holds unchanged —
    only the label was wrong.
  - **Not one library.** `pitchy` computes the NSDF via an FFT-based autocorrelation and
    imports **`fft.js` 4.0.4 (MIT)**. So the vendored set is two files
    (`src/js/00-vendor-fft.js`, `00-vendor-pitchy.js`), ~+14 KB raw / ~+4 KB gzip. Both are
    copied in verbatim apart from stripping the module syntax and wrapping each in an IIFE;
    the wrapper also keeps upstream's `'use strict'` from becoming the whole app's directive.
    The alternative — keeping pitchy's MPM and swapping its FFT autocorrelator for a bounded
    time-domain one — was rejected: it saves ~12 KB but forks a vendored library, which is a
    worse maintenance story than carrying the extra file.
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

- **Custom tunings.** ✅ **Shipped v2.5.0.** A `Custom` entry joins the four presets; selecting it
  reveals six per-string note selects (high → low, `TUNE_LO`..`TUNE_HI`) that drive a mutable
  `customTuning` read by `applyTuning()` → `OPEN_MIDI`. Seeded from the tuning you were on, so it
  starts where you are; the board/tuner/labels follow, and it's bounds-checked through
  `saveState`/`loadState`. (The footer's "standard tuning" caption is static and unchanged.)

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
- **Latency calibration.** ✅ **Shipped v2.5.0 · removed v2.11.0 · rebuilt v2.13.0 as an acoustic
  round trip** (see Phase 8/F1 — the tap-test design below was replaced, not restored).
  A one-time round-trip offset (`calMs`) read via `calOffsetSec()`: a Settings tap-test (steady
  click → tap along → `calcLatencyOffset` trims + means the nearest-beat deltas) plus a manual
  slider, bounds-checked. It was built ahead of its first consumer and nothing ever called it —
  every coach tier that landed since is unscored — so the debloat pass cut it as dead weight
  rather than ship a calibration UI that adjusted nothing. **This is a real prerequisite, not a
  dropped feature:** the first scored tier (F1's onset windows) has to bring it back, and the
  design above is the spec to rebuild from.
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
**✅ Shipped v2.1.0** as the **third primary mode** (Reference · Practice · Ear) the two-axis nav
was built to hold. _Superseded in v2.11.0:_ that mode was a duplicate of Practice's shell — same
drill-card list, same progress card off the same learner model — so **Ear folded into Practice as
an Ear group**, and the mode axis is Reference vs Practice again. The drills and their recorded
progress are unchanged; a save or share link pinned to `m=ear` lands on Practice. One shared
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

**Size:** L · **Risk:** med — many coach tiers; scoring landed with F1 (v2.13.0 → v2.14.0).

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
- **Strumming-pattern trainer** ✅ **Shipped v2.4.0** (5b) _· merged with 5d into **Strumming &
  feel** in v2.11.0_. A coach *visualizer*: five common down/up patterns on a one-bar 8th-note
  grid (1 & 2 & 3 & 4 &), looped over the current context chord (spine #1) on its own scheduler clock and
  highlighted slot-by-slot in time — so you **see and hear** the pattern and strum along. `strumMidi`
  sweeps down (low→high) / up (high→low); optional beat-reference click. A practiced run (≥1 full bar)
  records a session (`strum:<id>`, bars played) so Practice progress reflects it, but mints no per-item SRS.
  - **Scored tier** ✅ **Shipped v2.14.0** (Phase 8/F1): a 🎤 toggle grades the pattern you strum.
    The expected slots are the pattern's *sounding* ones at `time+swDelay` — swing included, or a
    correctly swung player would be marked late by the swing amount. Scoring **mutes the guide
    strum** (it lands on exactly the slot being measured) and force-enables the click if nothing
    else is sounding, because a timing score against silence means nothing.
- **Comping the progression** ✅ **Shipped v2.4.0** (5c) _· merged with 6a/6b/6c into **Over the
  changes** in v2.11.0 (a `tgMode` switch picks Chords vs Chord tones); both practice cards still
  open it in their own pillar's mode, and both session namespaces are kept_. The rhythm-side
  mirror of chord-tone targeting: a chosen preset (`SEQ_PRESETS`, resolved to the context key, spine #1)
  cycles with a forced backing band (bass + groove + a guide comp via `compStrum`/`scheduleBand(force)`)
  on its own scheduler clock; a big **NOW** chord + a **NEXT** preview (reusing `cmChord`/`cmChordBox`)
  + a 4-beat indicator make the change land in time. Switch the progression live. A practiced run
  records a session (bars comped), minting no per-item SRS.
  - **Scored tier** ✅ **Shipped v2.14.0** (Phase 8/F1): the 🎤 toggle scores **landing the change**,
    not every strum. Comping is your own rhythm — the drill has no business dictating how many times
    you hit the chord inside a bar — so the expected times are the bar downbeats, your in-between
    strums land in `extra` and are not penalised, and the count row reads "changes landed". The
    guide comp is muted while scoring, for the same reason as the strum drill's.
- **Groove / feel** ✅ **Shipped v2.4.0** (5d) _· merged into **Strumming & feel** in v2.11.0, so
  the pattern picker and the feel controls now cross-combine_. A feel *lab*: loop a one-bar
  groove (swung hats + kick/snare backbeat + bass + a down-up comp) over the context chord on one
  8th-note scheduler clock, with swing baked into the off-beats, and toggle the things that make a
  groove feel right — **swing** (straight → swing → shuffle), a **backbeat accent**, and **palm-mute**
  dynamics — hearing each change live and playing along. Reuses the drum/bass primitives + a mute-able
  `gfStrum`. A practiced run records a session (bars grooved). _Coach tier — no timing score (Phase 8/F1)._
  - _Synthesized realism pass shipped (v2.5.0):_ punchier hand-rolled drums — a high-passed beater
    **click** on the kick, a brighter second noise band ("snap") on the snare, and a band-passed
    **metallic edge** on the hi-hat. Still _deferred (separate asset task):_ the **CC0 drum one-shots
    + room convolution IR** "sound win" needs license-verified public-domain audio to base64-inline
    (verification must happen at selection time — see the dependency policy); revisit when the assets
    are sourced. The groove remains fully synthesized for now.

Scored versions need Phase 8's onset detection — and a strum is a *big* transient, so onset
scoring works **better** here than on single notes. The scored rhythm tier may arrive before
clean lead scoring.

_Sound win (per the dependency policy):_ the groove is currently fully synthesized. A few
small **CC0 drum one-shots** (kick / snare / hat) and one **guitar-body or room convolution IR**
(via `ConvolverNode`), base64-inlined, are the cheapest jump in realism here — assets, not
libraries, so the single-file guarantee holds.

---

## Before Phase 6 — Practice flexibility pass  (in-drill context control · ships first)

**Size:** S · **Risk:** low · **✅ Shipped v2.6.0** (first increment).

A flexibility pass on the *existing* Practice drills, landed **before** the Lead pillar stacks more
progression-looping UI on top — Phase 6 loops these same `SEQ_PRESETS` progressions with backing, so
the in-drill context controls built here are exactly what it inherits (the same "build the shared
surface before the phase that reuses it" move as the pre-Phase-3 mobile pass and the two-axis nav).

The gap it closes: the Rhythm coaches were *sinks* of the shared musical context (spine #1) — they
reflected `gRoot`/`chQual` but gave no way to change it without leaving Practice for a Reference tab.

- **In-drill key picker.** ✅ **Shipped v2.6.0.** The strumming (5b), comping (5c) and groove (5d)
  drills each gain a compact root strip (`sp-key`/`co-key`/`gf-key`, built by the shared
  `buildRootBtns` and wired to the one `setKey`), so you can move a progression or a chord to any key
  without leaving Practice. Still one shared context — you're just *setting* it from inside the drill,
  not only from Reference — so spine #1 is intact; comp re-resolves its bars (`compBuildBars`) live on
  a key change. Symmetric EN/UK (`dr_key`), no new persisted state (rides the existing context).
  _Generalized in v2.11.0:_ the three per-drill copies collapsed into **one shared `#drill-ctx` strip**
  (one Key picker + one Exit for every drill), and the key half is derived — it appears only for a
  drill that declares an `onKey` handler, so the ear / note-naming / one-minute-changes drills no
  longer show a picker that adjusts nothing.

_Still open (the rest of "make practice flexible as a whole"):_
- **In-drill chord *quality*** for the single-chord coaches (5b/5d) — pick maj/min/7 inline, not just
  the root, so the feel lab can explore a chord's colour without a Reference round-trip.
- **Custom progressions in comp (5c)** — today the progression is one of five fixed `SEQ_PRESETS`;
  let the user build/edit a progression (reusing the Harmony sequencer's chord list) so comping isn't
  limited to the canned set.
- **Free chord pairs in one-minute changes (5a)** — the change coach is locked to classic open-chord
  pairs; allow any two chords for players drilling their own trouble spots.
- **Tempo reachability** — the coaches lean on the shared transport tempo; confirm every timed coach
  exposes tempo inline so speed is adjustable mid-practice.

These extend the same principle (practice is flexible, context is settable where you're practicing);
they can trickle alongside Phase 6 or land as small follow-ups, each independently shippable.

---

## Phase 6 — Lead pillar  (play OVER the changes)

**Size:** L · **Risk:** med-high — real scoring needs F2 (the moonshot).

The improviser's half — turning fretboard knowledge into melody:

- **Chord-tone targeting** ✅ **Shipped v2.7.0** (6a) _· merged with the 5c comp coach into **Over
  the changes** in v2.11.0 — they were one machine (same bar expansion, same clock, same comp bed),
  so a `tgMode` switch now picks what you play; the `tg-*` DOM ids stayed_. The progression loops with a forced backing
  band (reusing `SEQ_PRESETS`/`scheduleBand`/`compStrum` like the comp coach, resolved to the context
  key, spine #1) on its own scheduler clock; each bar the current chord's tones (`tgNewBar` recomputes
  the pitch-class + degree map synchronously in the tick) light as targets on a tappable neck (its own
  `#tg-board`, like the note-naming drill), and you aim for them — a chord tone lands (lights its degree
  + sounds), an off-chord tap buzzes. Accuracy-scored (`tgAccuracy`), in-drill key + progression pickers,
  a NOW/NEXT stage + 4-beat indicator. A practiced run records a session (`target:<prog>`, accuracy %),
  minting no per-item SRS (derived from the ring buffer like the Rhythm coaches). *Honest framing:*
  without a mic this trains *where the chord tones are* (recognition/location), not soloing — a
  theory/rhythm game, not guitar practice. Don't market it as the latter; real scoring needs Phase 8/F2.
- **Arpeggios over changes** ✅ **Shipped v2.8.0** (6b). Delivered as a **Position** picker on the
  targeting drill rather than a separate card (DRY — same loop/scoring): "All" is the whole-neck 6a
  targeting; positions 1–5 window the lit targets to one arpeggio box (reusing Phase 2's `boxWindow`,
  key-anchored so the shape stays put), so you play a single moveable shape through the whole
  progression. Taps outside the box are ignored; only the shape is scored. The idle board now also
  lights the first chord so the neck isn't blank before Play.
- **Guided improvisation** — phrasing, motif/call-and-response, target-note soloing prompts.
  - **Target-note soloing** ✅ **Shipped v2.9.0** (6c, first slice). A **Target** picker on the same
    drill: "All" lights the whole chord; 1/3/5/7 light only that degree per chord, so you drill
    *landing on one tone* through the changes (the core of melodic phrasing). The other chord tones
    stay neutral (they just sound — fair game in a solo), only off-chord notes miss; if a chord lacks
    the degree (a 7th on a triad) nothing lights that bar — an honest "lay out". Composes with Position
    (target the 3rd, in one box).
    (target the 3rd, in one box).
  - **Motif / call-and-response** ✅ **Shipped v2.10.0** (6c, `14-drill-lead-2-callresponse.js`, `cr*`).
    A separate card (a genuinely different turn-based interaction, not the continuous targeting loop):
    the app plays a short stepwise motif from the key's scale (`SCALES[scIdx]`, spine #1) inside one
    Phase-2 box (LISTEN — plays each note via `pluck` + lights it), then you echo it back on its own
    `#cr-board` in order (YOUR TURN). Self-paced (no scheduler clock, so no latency offset needed),
    scored on echo accuracy (a clean note = no wrong tap before it); motifs grow 3→5 notes over
    `CR_ROUNDS`. A finished session records `callresp:<key>` (no per-item SRS). The listen/answer turn
    structure **is** the phrasing / play-vs-rest lesson, so it also closes that slice — a metronomic
    rest-coach, if ever wanted, belongs with Phase 7 (timing), not here.

**Phase 6 complete** (coach tiers). Coach/recognition tiers ship on screen; the real "play your guitar
and get scored" version needs Phase 8 (F2 pitch).

---

## Phase 7 — Timing & subdivision  (foundation for both pillars)

**Size:** S · **Risk:** low as a coach metronome; med once F1 scores it.

Subdivision command — 8th notes → triplets → 16th notes, cleanly and evenly — over the app's
own scale/triad content. A core improviser *and* rhythm-guitar skill; serves both pillars.

- **Coach tier (no mic)** ✅ **Shipped v2.11.0** (7a). A **Subdivision & timing** card in the
  Practice home under a new **Timing** (Foundations) group: pick a subdivision (`SUBDIVS` —
  quarter/eighth/triplet/sixteenth, `div` per beat) + tempo; a 3-level accented click (bar
  downbeat > beat > subdivision) on the cue bus and a proportional grid (`SD_BEATS·div` cells)
  tick out the bar on its own scheduler clock, while the context scale (`SCALES[scIdx]` rooted
  at `gRoot`, spine #1) is **walked** note-by-note across the grid inside one Phase-2 `boxWindow`
  (ascend-then-descend path) on its own display board, so there's something to play. In-drill
  key + position + tempo pickers (the roadmap's "tempo reachability" for a timed coach). A
  practiced run (≥1 bar) records a `timing:<subdiv>` session, minting no per-item SRS. Coach
  tier — *not scored*; mic-scored timing + evenness wait on Phase 8/F1.
- **Time signatures** ✅ **Shipped v2.11.0** (7b). A **Meter**
  picker in the toolbar (2/4 · 3/4 · 4/4 · 6/8 · 12/8; 4/4 default). A `METERS` table drives a
  `meter` model (`barBeats`/`pulseSec`/`barSec`/`midPulseSec`/`meterGroupStarts`) that replaced the
  hard-wired `beat()*4` / `count%4`: the metronome accent pattern (group starts), the backing groove
  (per-meter `kick`/`snare` pulse patterns + eighth-note hats), the bass root/fifth placement, the
  single-chord loop, the sequencer bar length, and the comp (5c) + targeting (6a) drill loops +
  beat indicators all follow it. **4/4 is byte-identical** to the old bar math (asserted in the
  harness), so the shipped backing band is untouched; other meters shrink/regroup the bar. Bounds-
  checked persistence via `saveState`/`loadState`. _(The single-bar pattern coaches — Strumming &
  feel (5b/5d), subdivision 7a — keep their own 4/4 grids; they don't ride the shared band.)_
- **Scored tier** ✅ **Shipped v2.13.0** (with Phase 8/F1): a 🎤 toggle on the subdivision coach
  turns it into real scored training — mean timing error, evenness and rushing/dragging, measured
  from the mic against the scheduled grid and latency-corrected. With the mic off it stays a coach
  and says so. _Still open:_ tempo laddering (auto-bump BPM when consistently in the pocket).

---

## Phase 8 — Real-instrument input  (mic · the unlock · highest risk)

**Size:** XL · **Risk:** high — DSP + AudioWorklet + latency + permissions; gate carefully.

Mic via `AnalyserNode`, split by difficulty. This is what turns every "coach" tier above into
*scored training* on a real guitar — the app's true differentiator. Gate carefully.

- **F0 — Chromatic tuner (the de-risking slice). ✅ Shipped v2.12.0.** A mic tuner: play any note,
  see the note name, octave and how many cents sharp/flat on a ±50-cent needle, plus the nearest
  open string of your current tuning. Lives behind a **🎤 Mic** button beside the reference-tone
  tuner in Settings ▸ Instrument and opens as a focused overlay. Shipped *first*, before any
  scoring, because it needs none of what
  makes the rest of this phase risky — **no AudioWorklet** (a needle reading ~20×/s on the main
  thread is fine), **no latency compensation** (nobody notices an 80 ms lag on a tuner), **no
  onset detection** (it reads a sustained note), **no polyphony**. What it *does* buy is the
  entire plumbing layer F1/F2 need anyway — gesture-gated permission, device errors, mic-in-use
  handling, the enable/disable lifecycle — plus a first honest test of **`pitchy`** against the
  easiest possible input. Useful on its own, and the safest place to prove the dependency before
  any score depends on it. **Size:** S–M · **Risk:** low.
  - Complements, does not replace, the shipped **reference-tone tuner** (v2.2) — that one stays
    for tuning by ear and for anyone without a working mic.
  - Reads the current tuning (`OPEN_MIDI`/`SNAMES`), so the nearest-string readout re-labels for
    Drop D / DADGAD / Open G like the reference tuner already does.
  - _Design note — why chromatic over string-locked:_ a string tuner could constrain the search to
    a narrow Hz window around the expected open string, which kills nearly all octave errors and
    would make a hand-rolled autocorrelation good enough with **zero** dependency. Chromatic has no
    such constraint, so it wants `pitchy` — but `pitchy` is getting vendored for F2 regardless, and
    chromatic is the more useful tool (tune anywhere on the neck, check intonation at the 12th).
  - _Known constraints:_ **`getUserMedia` needs a secure context**, so — like the PWA sidecar — F0
    is live on the Pages/HTTPS build and dormant on a `file://` `dist/` copy and in jsdom; it must
    self-disable there rather than throw (same pattern as `16-pwa.js`). The mic prompt must be
    behind an explicit user gesture, never fired on load. Speaker→mic feedback is real: suspend
    the reference tone while listening. Low E (82.4 Hz, weak fundamental) is the accuracy case to
    test against, not A440.
  - _How it actually landed (all of the above held):_ the entry button is **removed** rather than
    disabled where there's no secure context, so it can never be a control that only errors; the
    mic is requested from a click, released on close / tab-hide / pagehide, and `tunerStop()` runs
    before listening. `getUserMedia` asks for the **raw** signal — `echoCancellation`,
    `noiseSuppression` and `autoGainControl` all off, since voice-call DSP pumps the level and
    carves out exactly the sustained tones a tuner needs. The mic is never connected to
    `destination`. Readings are median-filtered then eased, because MPM's failure mode on a
    plucked string is a one-frame octave jump that an average would smear instead of discard.
  - _Validation:_ the detector was measured before anything was built on it — **<0.05 cents**
    across E2→E5 on synthetic harmonic tones, silence rejected, white noise clarity 0.41 (so the
    0.9 gate holds). The full chain is then checked end to end in a real browser by
    **`tools/mic-check.js`**, which feeds Chromium a synthetic guitar WAV as a fake mic over a
    localhost secure context: low E, open A, high e, and deliberately ±30/−22-cent detuned cases
    all read the right note and direction. jsdom covers the maths and the DOM contract (+71 checks).
- **F1 — Onset (when). ✅ Shipped v2.13.0.** Energy attack detection — **hand-rolled** (the light
  lift; unlike pitch there is nothing subtle to get wrong). **The app's first scoring feature:**
  every tier before it was a coach that couldn't hear you.
  - **Runs in an AudioWorklet, not on rAF.** A tuner needle only has to be approximately live,
    but a timing score *is* the timestamp: rAF samples at ~16.7 ms and stalls under layout, which
    at 120 BPM is an eighth of a sixteenth-note of pure harness noise in a measurement whose whole
    job is telling "tight" from "rushing". The single-file guarantee survives because the processor
    source is turned into a **Blob URL** — an in-memory object URL, not a network fetch.
    Measured **0.1 ms** mean interval error end to end (`tools/onset-check.js`).
  - **Latency calibration rebuilt, and redesigned.** The v2.5.0 version was a *tap* test, which
    measured output latency **plus human reaction** — and tap-scored tiers are the one thing this
    roadmap forbids shipping. It now measures the audio **round trip** with no human in the loop:
    play a click, hear it back through the new onset detector, median the deltas. Without it every
    player on earth reads as "dragging" by the buffer size; the harness asserts exactly that, by
    scoring one perfect run with and without the correction. Headphones remain the honest failure
    case (no acoustic path to measure) — it says so and keeps a manual slider.
  - **First scored tier: the subdivision & timing coach (7a).** A 🎤 toggle flips it from coach to
    scored; with the mic off it stays a coach and *says so*. Reports mean absolute error, evenness
    (spread) and rushing/dragging (bias) as **separate** numbers, because "always 30 ms late" and
    "randomly ±30 ms" are different problems needing opposite advice. Rushing/dragging is only
    claimed when the bias actually exceeds the spread — otherwise it's noise with a sign.
  - **Rhythm pillar tiers wired ✅ v2.14.0**, and the machinery extracted to `13-scored.js` on the
    way (one scoring engine, three drills — the same move `13-mic.js` made for one mic and three
    consumers). Each drill keeps only its own answer to "what is a slot you are expected to play":
    the timing coach marks every grid tick; **5b strum** marks the pattern's *sounding* slots at
    `time+swDelay` (scoring a correctly swung player against the un-swung slot would mark them late
    by the swing amount); **5c comp** marks the **bar downbeats** only — comping is your own rhythm,
    so the drill scores *landing the change* and leaves what you play in between in `extra`.
  - **The self-hearing hole, found and closed ✅ v2.14.0.** F1 shipped a scored tier that could
    score *itself*: on speakers the mic hears the app's click, and because the click was scheduled
    on the grid — and calibration measures exactly that path — it lands on the grid perfectly after
    correction. A run where the player never touched the guitar came back "Tight · 32/32". Timing
    alone cannot separate the two signals, since a perfectly played note is *supposed* to arrive
    with the guide it follows. Two-part fix: **structural** — the scored Rhythm tiers mute their
    guide guitar, which was landing on precisely the slots being measured (and that is the better
    lesson anyway: mic off, the pattern is played *to* you; mic on, you play it) — and a
    **plausibility guard**, `onsetSelfHeard`: near-total hit rate *and* a spread tighter than any
    human hand means the microphone is listening to the speakers, so the panel prints the refusal
    instead of a flattering number. Conservative by design; a false accusation calls a good player
    a liar. Headphones are the clean answer and every scored drill now says so.
  - _Still open:_ tempo laddering (auto-bump BPM when consistently in the pocket).
- **F2 — Pitch (which).** Monophonic McLeod (MPM) via **the `pitchy` + `fft.js` pair already
  vendored by F0** — no new dependency to take, and proven there on sustained notes, so what F2
  adds is doing it *under time pressure*. Unlocks the **Lead pillar** scored
  tier and real-guitar note-naming. Single notes first; polyphonic chord recognition remains
  the moonshot.

**Substrate (free platform API, no dependency):** **AudioWorklet** — run the mic analysis (and
ideally the synth) off the main thread, or scoring latency will be unacceptable. Treat as a
requirement of the *scored* tiers (F1/F2), not of F0.

The scoring paths need latency compensation (the Phase 3 calibration) and a permission step;
F0 needs only the permission step, which is why it goes first.

_Deferred / niche:_ Web MIDI could give perfect input for the few players with a MIDI guitar or
pickup, but that audience is tiny and the mic path already covers everyone — not planned.

---

## Phase 10 — Unify the shell  (the whole-UI rework · two tracks)

**Size:** XL — two tracks, A1–A4 and B1–B4 below, each shippable · **Risk:** med (A2 and B2 are
refactors of shipped, working surfaces; B1 needs a schema migration) · **Status:** in progress —
**Track A complete (A1–A4) and B1 done** (unreleased); B2–B4 planned.

_(Sequenced between F1 and F2, not after Phase 9 — Phase 9 "runs throughout" and is not a gate.
B3 delivers the first real slice of Phase 9's guided path, A4 the first slice of its onboarding.)_

> **Supersedes two earlier plans in this slot** — the "Shell rework" (R1–R4) and the Practice-only
> "Unify Practice". The first treated cluttered drill screens as the problem; the second found the
> cause one level down but scoped it to Practice. A whole-app audit says the same fault runs through
> both halves, so the phase is now two tracks: **the shell** (A) and **practice** (B).

### The diagnosis

**The shell is cumulative, not contextual.** Everything that was ever global stayed global. The header
now carries brand · version · language · install · mode · tabs · transport · tempo · Settings ▾ ·
Backing ▾, and each tool below it re-implements locally whatever the header doesn't scope for it. Two
competing homes for the same function, nothing arbitrating between them — which is why, measured on
the shipped v2.14.0 build:

- **Tempo exists twice on one screen.** The subdivision drill shows `ТЕМП 90 BPM` in the header *and*
  `ТЕМП − 90 BPM +` in the drill. Same value, two controls, two visual languages. `14-drill-timing.js`
  grew its own because the header's isn't scoped to it.
- **Play exists twice on every drill screen**, and the header's one strums the reference chord *over*
  the running drill. Metronome likewise (Backing panel vs the drill's own click).
- **The key picker — spine #1's own control — has three forms and one absence.** 12 buttons in the
  context bar on Harmony/Scales; **gone entirely on Circle** (`applyContextBar` hides the whole bar,
  `15-wiring-init.js:80`, so you set the key by clicking the wheel instead); 12 buttons again in
  `#drill-ctx` for drills that declare `onKey`, and nothing for those that don't. The app's single
  most important piece of state is controlled four different ways.

**Navigation is three strips deep for one question.** *Mode* (Reference · Practice — pills on desktop,
fixed bottom bar on phone), *tab* (Harmony · Scales · Circle — underline strip), and *view*
(Chord tones · Triads · Arpeggio · Identify, or Scale · Notes — pill buttons in the context bar).
Three visual languages, three locations, all answering "what am I looking at" — and the third vanishes
on Circle along with the root picker. Phase 1b already unified these *structurally* (one board, four
renderers); the UI never followed.

**Chrome outweighs content, everywhere.** On a 1440-wide desktop the Harmony neck — the app's actual
subject — starts **41% of the way down the viewport**, behind eight stacked horizontal bands (brand,
mode, tabs, transport, context bar, heading, quality picker, info box). And the width is unused where
it is most available: **Practice on desktop is a phone layout stretched** — one column of full-width
cards, each ~200 px tall to hold two lines of text, five of nine visible; **Circle leaves ~63% of the
viewport empty**, its wheel pinned to a 360-unit viewBox beside a half-empty text panel.

**Six disclosure mechanisms**, each with its own affordance: `Settings ▾`, `Backing ▾`, `?` help,
`more ▾` (chord qualities), and two `−` card collapses (aside, shapes) — plus the condensing header.

**And the copy contradicts the product.** Three drills tell the player mic scoring "comes later" while
the mic button sits on the same screen: `sd_hint` ("A coach: mic-scored timing arrives later" — it
arrived in v2.13.0), `tg_hint` ("not your guitar — mic scoring comes later" — comping has been scored
since v2.14.0), and the four `*_meta` card subtitles still reading "coach". The most expensive feature
the app has ever built is being actively denied by its own interface.

### Where the spine actually stands

| Spine | The claim | Actual |
|---|---|---|
| **#1** One musical context | every view reflects one key/mode | ⚠️ **the model holds, the control is closer** — A1 gave Circle the picker it never had; the drill strip is still a second one (B2) |
| **#2** Reference ↔ practice seam | *"from any reference view → drill this"* | ❌ **one button** — `nt-drill`, in 1 of 7 views |
| **#3** The learner model | *"the app knows what you know"* | ✅ **fixed by B1** — was 4 of 10 tracks |

**The evidence for #3** _(as audited at v2.14.0 — B1 has since fixed all of it)_. `13-learner.js`
hardcoded `REVIEW_NS = ['note','interval','chordq','rhythm']`, and only `14-drill-notes.js` +
`14-drill-ear.js` called `recordAttempt`. The other six tracks — the whole Rhythm pillar, the whole
Lead pillar, Timing — called `recordSession` only. So **"what should I practise next?" could never
name six of the ten tracks**; they were not in the queue's vocabulary. And `learnerStats()` returned
five aggregates with no trend, though the ring buffer held `{t, drill, score}` × 50 — a time series
nothing read as one. Two kinds of result were forced into one shape: recall items want SRS,
performance measures (CPM, bars, accuracy %, timing error in ms) want trend and a personal best. The
model had the first and merely *stored* the second.

**The unmet acceptance check.** From `Guiding principles`, written before any drill shipped: *"make
'does this feel good unscored?' an explicit acceptance check per drill — it's the real product risk
for Phases 3, 5 and 7 before the mic lands, not an afterthought."* It was never run. Six coach drills
shipped recording a number the player never sees again. **B4 is that check, finally paid.**

### Why the two halves are weighted differently

**Reference has had five dedicated UX passes** — 1d feel (v1.18.0), 1e clarity (v1.19.0), the mobile
shell pass (v1.24.0), the desktop/reachability follow-up (v1.25.0), the pre-Phase-3 polish (v1.25.1).
**Practice has had none.** All five landed *before* Phase 3 shipped Practice at v2.0.0; the two passes
since were in-drill *functionality* (v2.6.0) and *packaging* (v2.11.0), not shell work. Reference is
the mature half **because** of those passes — which is why Track B is the larger one. But Track A is
whole-app: every finding above spans both halves, and three of them (transport, navigation, the key
picker) are Reference-side surfaces that Practice merely inherits.

---

### Track A — the shell

**A1 — One function, one home.** ✅ **done** (unreleased — Track A ships as one release). Every
global verb gets exactly one control, which the shell *scopes* to whatever is active. A drill does not
build its own tempo, play or metronome; it declares that it is tempo-driven and the shell's transport
drives it. As shipped:
- **Tempo: one setter, one control per context.** `setTempo()` (12) clamps and repaints every
  readout, so no control has to know another exists. The timing drill's private −/BPM/+ is gone; the
  shell's stepper lives in `#drill-ctx` and is **derived from the registry** (`tempo:true`) exactly
  as the key picker is derived from `onKey`. Net: one control instead of two, and the *other three*
  scheduler-driven drills (strum, over-the-changes, changes) gained a reachable tempo they never had.
- **The reference transport is scoped out of Practice** — Listen, Loop, Tempo and the whole Backing
  panel act on the reference board, which isn't on screen there. `stopReferenceTransport()` (06) ends
  the loop / progression / metronome on entry, instead of leaving the reference chord strumming over
  the drill on a clock the drill doesn't control. Space / L / M follow their controls.
- **Master volume moved out of the Backing panel** into Settings. It scales everything the app makes;
  filing it under the backing band both mis-described it and put it out of reach in Practice.
- **The key picker exists wherever a key is meaningful, Circle included** — `applyContextBar` used to
  hide the whole bar there, taking spine #1's own control with it (you set the key by knowing to
  click the wheel). Down from four forms to three; A2 takes the rest.
- **A latent bug, found on the way:** `.tb-bar > .btn { display:inline-flex }` silently defeated the
  transport buttons' own `[hidden]`, because an author `display` rule beats the UA `[hidden]` rule
  whatever the specificity — so `updateGlobalPlay()` hiding Listen in the Notes / Identify views (no
  chord to listen to) had never actually worked in a browser. jsdom's `.hidden` reported success.

  _26 assertions in the smoke suite; lint / scroll-check / kbd-check clean._

**A2 — Navigation: three strips to two (the risky one · isolate it).** ✅ **done** (unreleased).
Mode × subject in one navigation surface; **the view switch became a lens on the board**, adjacent to
it, not a third strip in the header — which is what Phase 1b already made true underneath (one board,
four renderers). As shipped:
- **One nav, four destinations.** The mode pill strip (Reference · Practice) and the tab underline
  strip (Harmony · Scales · Circle) were one question asked twice, so they are one control:
  `#mainnav`, with Practice as the fourth peer. The **mode axis survives in code** — `setMode` still
  drives `body.mode-practice` and is still orthogonal to `currentTab` — it just stopped being a
  second thing on screen. "Reference" as a word disappeared with it: it was a container label for
  three destinations that are now listed by name.
- **Painted from state, not from clicks.** `applyNav()` is called by *both* `setMode` and
  `selectTab`, so the shortcut keys, the reference→practice seam and a restored share link move the
  nav too — the seam in particular used to be able to leave it pointing at the wrong place.
- **All four are honest tabs.** `#panel-practice` is a real sibling section, so the `tablist` /
  `tabpanel` roles, arrow-key traversal and the roving tabindex now cover Practice as well, instead
  of a mode switch being dressed as something it wasn't.
- **A phone bottom bar that earns the name.** It was a 2-item mode bar with a *separately* scrolling
  tab strip up in the header (with an edge-fade "more →" hint and the JS to toggle it); it is now a
  conventional 4-item bottom nav, which is what the labels were shortened for. The scroll-fade
  machinery is gone rather than retargeted.
- **The lens lives on the board.** Moving the view groups into `#board-region` means they hide, move
  and stick *with* the neck — Circle needs no special case, because a tab with no board has no lens.
- `4` reaches Practice. It had no shortcut at all while it was a separate axis.

  _20 assertions in the smoke suite; lint / scroll-check / kbd-check clean, and `kbd-check`
  + `shoot.js` were updated to the merged nav._

**A3 — Board-first, and use the desktop.** ✅ **done** (unreleased). The neck leads in every
board-bearing view instead of sitting behind six bands of chrome; the two board-less surfaces get
layouts that acknowledge a wide viewport instead of stretching a phone column across it. Riding A2,
while the layout was already open — 1e's move, in 1e's position. As shipped:
- **The neck leads.** Measured before: on a 1280×800 laptop the top of the fretboard sat **645px down
  a 708px viewport** — header, context bar, panel heading, control rows, info readout and the lens, and
  then 63px of the app's centrepiece. `#context-bar` was promoted out of `.main` into a grid area of
  its own, so the three bands could be ordered independently; the reading order is now *in what key*
  (context) → **the neck** + its legend → *how it is built* (the view's own controls and info) → the
  reference rows. The board now starts at **355px and ends at 631** — the whole neck, and its legend,
  above the fold. At 1920×1080 the entire Scales view fits in one screen.
- **Source order is focus order.** The area maps alone would have put the neck above controls that
  still came *first* in the DOM, so a keyboard or screen-reader user would meet the chord picker before
  the neck it changes and the lens after it. The markup moved too — this is a reorder, not a repaint.
- **The neck keeps the full width.** Controls compact into a horizontal rail under it, never a vertical
  one beside it: the reclaimed ~264px belongs to the fretboard (the 1.26.0 full-width-neck decision
  stands). The suggester rides beside the *controls*, where it reads as commentary on them.
- **Circle uses the desktop.** The circle is that tab's content — its equivalent of the neck — and it
  was a fixed **360px island in a 1193px panel** with the right two-thirds empty. It now grows with its
  column to a **520px** cap (~2.1× the area), and the reading pane is capped too so no dead strip
  trails the key readout. Below the shell breakpoint the two panes wrap exactly as before.
- **Practice's home is two columns.** Ten drill cards, each holding two short strings, were stacked one
  per row down a 1200px column — a phone layout that was never told the viewport got wider. Cards now
  wrap into a grid (a pillar's cards read as a set) and the progress card rides a sticky rail. The
  readout that answers *"what should I practise next?"* moved from **1727px down the page to 354** —
  visible on the first screen, which is the one question the home exists to answer. The whole surface
  went from 1952px of scroll to 1152.
- **Two latent bugs fixed on the way.** `.practice-list li` still carried the background + border of
  the Phase-3a "coming soon" text stub it began as, so every real drill card had been rendering as a
  bordered box **inside** a bordered box. And the new two-column rule walked straight into this
  codebase's documented `[hidden]` trap — an author `display` rule outranks the UA
  `[hidden]{display:none}`, so a running drill was leaving the practice home on screen behind it, with
  jsdom's `.hidden` reporting success throughout. Both are pinned by assertion.

  _24 assertions in the smoke suite; lint / scroll-check / kbd-check clean. Two dev tools were
  repaired: `shoot.js`'s **tab** selector was still `.tab[data-panel]`, dead since A2, so `shoot.js
  tabs` had been silently capturing Harmony for every tab (this is what the "broken" circle screenshot
  during A2's review actually was); and `scroll-check.js` now retries once on an EMPTY result, because
  it kept reporting a phantom failure for whichever viewport lost the cold browser-launch race — a
  gate that cries wolf gets ignored. A result that comes back and reports a problem is never re-rolled._

**A4 — Tools, preferences, and the cold start.** ✅ **done** (unreleased). As shipped:
- **Settings sorts by what you DO with a control**, which is the question a visitor actually has,
  rather than by what the control acts on. **Інструмент / Instrument** — the guitar you're holding and
  the music you're counting (tuning, custom tuning, capo, frets, meter); you change these mid-session
  and keep going. **Інструменти / Tools** — you come to *do* something, watch a readout and leave
  (both tuners, latency). **Налаштування застосунку / Preferences** — set once and forget (volume,
  lefty, the two accessibility toggles, Share). The old middle cluster, "Neck & meter", had split the
  guitar across two headings: frets sat away from tuning and capo though all three describe the same
  neck.
- **Tools is reachable from Practice**, which the plan called for — though checking rather than
  assuming showed it already *was*: nothing in A1's transport-scoping list hid the Settings
  disclosure. The real fault was findability, not reachability. Calibration was the last row of an
  "Instrument" list, between dropdowns, reading as configuration — when it is the prerequisite that
  decides whether a scored drill is telling the truth. It now has a heading that says so. Pinned by
  assertion so no future mode-scoping list quietly hides it.
- **The mic funnel's real hole was calibration, and it was worse than "no guidance".**
  `calOffsetSec()` returned 0 whether the round trip had been measured or *never measured* — and 0 is
  not a latency, it is the absence of one. So a player who had never calibrated was scored against an
  offset of zero and told, as a fact about their playing, that they were dragging — by exactly the
  buffer size. That is the same lie `onsetSelfHeard` exists to refuse, arriving by a different road.
  Latency now carries a **`calKnown`** flag (persisted; a hand-set slider counts, since the player
  asserted a value; an older save with a non-zero reading is grandfathered in rather than re-prompted).
  With it unset the scorer **reports the half it can stand behind and names the half it can't**:
  spread is a *difference* between hits and survives any constant offset untouched, so evenness is
  honest immediately, while the ms figure and the rushing/dragging verdict are withheld with a line
  saying what is missing and where to fix it. The warning also fires when the mic is switched **on**,
  before a note is played — telling someone their result can't be judged is worth much less
  afterwards. And `scoredErr()` refuses uncalibrated runs exactly as it refuses self-heard ones, so
  B4's "45 ms → 28 ms" can never turn out to be charting a device change as progress.
- **The cold start asks one question and every answer routes.** It used to *list* two abstract nouns
  and hand you a Got it that landed you on chord tones in A minor regardless of which you'd read —
  it described the app instead of asking anything, so nothing a visitor knew about themselves could
  change where they went. It now asks "What do you want to do right now?" with three real
  destinations: look something up → Harmony · practise → the Practice home · **tune the guitar** →
  whichever tuner is available (the third is a genuine reason to open a guitar app and had no route
  at all). The answers reuse the Practice home's `.drill-card` pattern, so the first card a visitor
  taps looks like the cards they meet next.
- **A bug the cold start had been shipping since A2, and the gate that now catches it.** The welcome
  card's first bullet still pointed at `mode_reference`, a key A2 deleted. `applyLang` *skips*
  undefined keys rather than blanking the element, so the template's hardcoded Ukrainian survived —
  every **English** visitor's first-ever screen showed "Довідник". The linter checked keys present in
  one language but not the other, and keys referenced by nobody; it had no check for the mirror case,
  a key referenced but declared in **neither**. It does now, and that was the only instance.

- **A phone overflow the new headings exposed.** `.tbc-label` is `white-space: nowrap` +
  `flex-shrink: 0` — a deliberate choice, since a wrapped 10px caption reads as noise — which also
  means it *cannot give way*. A longer heading therefore pushes the first control group past the
  viewport edge and the whole page scrolls sideways: the label length had been quietly load-bearing,
  and A4's headings were the first to test it. The heading now takes its own row below 700px, which
  makes any label in any language safe (and matches how the context bar un-boxes on phones — caption
  above its controls, not competing with them for one line). The Ukrainian "Preferences" was also
  shortened to **Уподобання**: the first draft began with the same word as the Settings button that
  opens it.

  _26 assertions in the smoke suite (including a build-wide check that every `data-i18n` key in the
  markup exists); lint / kbd-check / scroll-check clean. Three `shoot.js` fixes, each found by using
  it: a **`settings` token** (how you check Tools from Practice); **frozen animation** in the shot,
  because panels revealed by a post-load click carry `animation: fade 0.25s`, which does not advance
  under `--virtual-time-budget` — Practice photographed blank, which looked exactly like a real
  regression and wasn't (a probe of the live DOM showed the state correct the whole time); and the
  overflow probe now **names the widest offending element** instead of only reporting that the page
  is too wide, which is what turned "SW=415" into "`div.tb-group`" without bisecting CSS by hand._

### Track B — practice

**B1 — One practice model (foundational · low risk · pure logic).** ✅ **done** (unreleased). The
direct analogue of 1a's "one diatonic source": two half-models collapsed into one that every drill
reports into. As shipped:
- **Every drill declares its TRACKS** through the existing registry (`13-drill-registry.js`) —
  `{id, kind:'recall'|'perf', items, sess, better, unit, label, start}`. A track, not a drill, is the
  unit the model cares about: over-the-changes is one drill with **two** (comping and targeting have
  different metrics and different cards), ear training is one drill with **three**, and the note drill
  is **both kinds at once** (per-item SRS plus a per-round accuracy). Ten tracks over seven registry
  entries — one per practice card, and the smoke suite counts the cards from the markup rather than
  pinning a number, so a card without a track fails the build.
- **The review queue covers the app.** `REVIEW_NS`'s four hardcoded strings are derived from the
  registry, and a performance track falls due on **staleness** (cold for `PERF_STALE_DAYS`, or never
  run) or **slippage** (recent runs trending down against the earlier ones) rather than SM-2. The
  progress card, which used to go blank for anyone practising rhythm or lead no matter how much
  history the app held on them, now names a track and opens it.
- **One less hand-maintained list, twice over.** `startReview`'s four-branch `ns → starter` router
  became the registry's own `start`, and `cmPairBest`'s hand-rolled scan of the ring buffer became
  the shared `learnerBest`. Three lists encoded the same knowledge; all three were incomplete.
- **The trend is readable** — `learnerTrend(id|namespace)` gives runs, latest, personal best,
  direction of travel and staleness, with a `TREND_EPS` dead band so noise doesn't read as
  improvement. B4 has something to render.
- **The scored tiers' timing error is finally kept.** It was computed, shown once and discarded (the
  drill even said so in a comment); it now rides alongside the session as `err`, so "your timing went
  from 45 ms to 28 ms" is a sentence the app can form. `scoredErr()` refuses runs the self-hearing
  guard refused — letting the app's own click into the trend would poison the number.
- **Retention is per-track, not global.** One cap of 50 across ten tracks meant a drill practised
  daily evicted the entire history of one practised weekly — about five points to trend on. Now
  `SESS_PER_ID` newest per session id, with the global figure demoted to a safety ceiling.
- **Schema migration, done the sanctioned way:** `LEARNER_V` 1 → 2, per Phase 3's own rule (*"a `v`
  bump + migration is the only sanctioned way it changes"*), and **purely additive** — `items` and
  `sessions` carry over untouched, and `best` (the one thing that must outlive its history) is
  reconstructed from the sessions still held. Asserted against a captured v1 store, as 1a asserted
  parity before deleting the duplicate diatonic helper.

  _43 assertions in the smoke suite; lint / kbd-check clean._

**B2 — One drill shell (the risky refactor · isolated).** The analogue of 1b's "one board, not four":
nine hand-rolled layouts collapse into one shell each drill fills in — **header** (drill name · key ·
🎤), **setup** (the drill's controls, in a disclosure open before the first Play and folded during the
run), **stage**, **action bar**, **summary**. Three problems, one cause — `#drill-ctx` is a key picker
with an Exit button where a drill header should be:
- **A drill never says which drill it is.** All nine render under the same `<h2>Практика</h2>`;
  `.drill-head` shows the chord, the hit count or the round — never the name.
- **Controls before content.** *Over the changes* stacks Key · What-you-play · Progression · Position ·
  Target above NOW/NEXT and the neck: roughly **55% of a 390×844 viewport is chrome**, and it stays
  there during the run, when it is least useful.
- **Play sits below the longest paragraph on screen** — every drill's primary verb is in
  `.cm-active-foot`, after a 3–6 line hint.

  The pattern is in the tree twice, unshared: `14-drill-rhythm-1-changes.js` has the right shape
  (`#cm-setup` → `#cm-active` → `#cm-summary`), and the reference panels already tuck their description
  behind `.ph-help`'s `?`. **Caveat, a real regression risk:** collapsing the hint helps someone who
  knows the drill and hurts a first-timer, for whom that paragraph is the only instruction — so it
  needs a first-run-per-drill reveal, not a blanket collapse.

**B3 — The session, and the seam (net-new value).** 1c's "the questions players actually arrive with",
for practice. The question is **"I have 15 minutes — what do I do?"**, and the app has no answer: every
drill is an infinite loop exited by hand, with no notion of *today*.
- **A practice session** — pick a length, the app chains drills from the B1 queue, tracks the clock,
  **ends**, and reports. The ritual is what practice apps live on; this is the first thing here that
  is one.
- **The seam, honoured** — "drill this" from **all seven** reference views, not only Notes. Cheap, and
  a claim the app currently makes and does not keep.
- **"Jam over this"** — the other seam, inherited from A4's answer to the Jam question (see above).
  Playing along to the harmony on screen currently takes five steps; it should take one, from the
  suggester that already says "What to play over this" and already knows what to play. Same shape as
  "drill this", same vocabulary, so it costs almost nothing once that vocabulary exists.

**B4 — Progress, and copy that tells the truth.** Replace the five-number stats dump with the narrative
B1 makes possible: per-drill history, direction of travel, personal bests, and — for the three scored
tiers — the timing trend in milliseconds. Invert the Practice home: progress + next-up on top, the nine
cards as compact rows below. Badge them **🎤 Scored** vs **Coach**. And run a **copy-truth pass** over
every string that promises a shipped feature is "coming later": `sd_hint`, `tg_hint` and the four
`*_meta` subtitles, EN and UK both.

**Two bugs, fixed on the way:** the `.divider` before `#tg-mic` is never hidden when
`14-drill-overchanges.js:256` hides the button, leaving a stray vertical rule under PROGRESSION; and
the stale strings above.

---

**Answered in A4: no, Jam is not a destination — it is a verb on the one you're already in.**
The backing band is a genuinely strong feature with no front door: it lives as a `Backing ▾`
disclosure inside the transport bar, so "play along to something" isn't offered, it's *assembled* —
pick a key, pick a chord or progression, open Backing, enable bass and drums, hit Loop. Five steps to
reach one of the best things the app does. That complaint is real and stands.

A fifth nav item is the wrong answer to it, for two reasons the earlier steps established rather than
assumed. **A2** made the nav a list of *subjects* — Harmony, Scales, Circle, Practice are things you
can be looking at. Jam is not a subject; it is something you do **over** whichever subject is on
screen, and a destination whose content is "whatever you last had elsewhere" is a mode wearing a
destination's clothes, which is exactly what A2 deleted. **A4's own taxonomy** says the same from the
other side: Settings now sorts by what you do with a control — change mid-session, do-and-leave, or
set-once — and the backing band is none of the three. It is *transport*, which is why it sits beside
Listen and Loop and not in Settings at all. (The practical cost is real too — the phone bottom bar is
a 4-item strip at its working width, with labels already shortened to single words, so a fifth means
icons or a demotion — but that is the weakest of the three arguments and would not decide it alone.)

So the fix is not navigation, it is **one action instead of five**: a "jam over this" affordance on
the harmony already on screen, next to the suggester that is *already* captioned "What to play over
this" and already knows the answer. That is a seam, so it belongs with **B3**, which is building the
seam vocabulary — not with the shell.

**Sequencing and the F2 gate.** **A1, B1 and B2 gate F2** — F2 stacks the Lead pillar's scored tier
onto these drill screens, into this model, through this transport, so all three get unified before
they are inherited. A2/A3 were the risky pair and wanted their own release — **Track A is now complete
and unreleased, so it is one release ready to cut**; B3 and B4 can trickle.
Per the convention Phases 5 and 7 used, each track ships as one release rather than eight.

**Why this is less risk than the smaller plans it replaces.** A1 and B1 are mostly deletion and pure
logic, both fully assertable, like 1a. A2 and B2 are isolated behind a green harness, like 1b. The
smaller plans' risk was worse for being hidden: they would have shipped a Review queue promoted to the
top of the Practice home that structurally ignores two-thirds of the app, and found out in use.

**Validation:** the v1 → v2 learner migration round-trips a captured real store with no progress lost
(asserted before the v1 read path is deleted); the registry seam stays enforced (every `*-area` claimed
by a registered drill); one-board and responsive/a11y assertions stay green across A2/A3, as they did
across 1b; `npm test` + `npm run lint` green throughout; symmetric EN/UK for every new string;
`scroll-check` + `kbd-check` clean (A1–A3 move the header, the sticky board and the shortcut targets);
and — because most of Track A is layout with no new logic — the **`visual-review` orientation matrix is
the real gate**, across all three reference tabs *and* every drill surface at phone portrait, landscape
phone, tablet and desktop.

---

## Phase 9 — Product layer  (good tool → competitive product · runs throughout)

**Size:** M · **Risk:** low — no DSP; all high-leverage product work.

Finishing the phases above makes an excellent free *toolbox*. These three turn it into a
product people find, adopt, and recommend — none of them DSP, all high-leverage:

- **Guided path (curriculum).** An opinionated "start here → next" thread that chains existing
  content, riding the learner model (spine #3). Turns scattered tools into a sense of progress.
  _First step shipped (v2.5.0):_ the Practice/Ear progress card now **closes the SRS loop** — a
  **Due-for-review** count + **Active-days** stat (`learnerReview` / `learnerActivity`) and a
  one-tap **Review** that routes into the drill for the most-overdue namespace (`startReview`).
  Not yet a curriculum, but the "what to practice next" surface the curriculum will sit on.
- **Distribution & shareability.** Installable PWA (offline, "add to home screen") ✅;
  **shareable deep links** ✅ **(v2.5.0)** — a Settings *Share* button copies a URL whose hash
  encodes the musical context (`encodeShareState`), applied once on load then stripped
  (`applyShareHash`); every share is a discovery channel. _Still open:_ a few crawlable landing
  pages for SEO, and **printable / exportable chord & scale sheets** — a print stylesheet (and/or
  a one-page export) of the current board + diagrams, useful for teachers and a low-effort offline
  artifact.
- **Polish & feel.** Drill responsiveness and animation, cue sound, empty/error states —
  the bar "good" actually lives at, owned by no other phase. _Shipped early (v2.4.0):_ a
  **first-run welcome card** (lightweight onboarding for brand-new visitors, dismissed once
  and remembered) and the **colour-blind / alternate palette** option — an Okabe–Ito CVD-safe
  palette plus distinct per-function dot **shapes** (toggles in Settings ▸ Accessibility), so
  the function colours (root / third / fifth / seventh) no longer carry meaning by hue alone.
  _Still open:_ deeper onboarding, empty/error states, and the broader feel pass. _(Onboarding is
  partly claimed by **Phase 10**: A4 adds the opening question the first-run card never asks, and
  B3/B4 build the session + progress narrative it needs somewhere to route **to**. What stays here
  is the depth — a real curriculum on top of that routing.)_

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
               └─ Phase 8  Mic input            F0 (tuner) ✅ shipped v2.12.0 — no scoring, low risk
                                                F1 (onset) ✅ shipped v2.13.0 — scores 7 + 5 (v2.14.0)
                                                     │
                                                     ├─ Phase 10  Unify the shell  ← ships next
                                                     │   A  shell    A1 one function one home ─┐
                                                     │               A2 nav · A3 board-first   │ A1+B1+B2
                                                     │               A4 tools + cold start     │  gate F2
                                                     │   B  practice B1 one model ─────────────┘
                                                     │               B2 drill shell · B3 session + seam
                                                     │               B4 progress + copy truth
                                                     │
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
- **Open Phase 8 with F0, the tuner.** It's the one mic feature that is genuinely useful with no
  scoring attached, so it lands the permission/plumbing layer and validates `pitchy` while the
  cost of being wrong is still a tuner needle rather than a corrupted score.
- **Phase 10 comes between F1 and F2, and it is Phase 1 for everything Phase 1 didn't reach.**
  Phase 1 was non-negotiable because the spine is what later phases reuse — but it unified the
  *reference content* and left the *shell* cumulative: every global control stayed global, and each
  tool since re-implemented locally whatever the shell wouldn't scope, which is why tempo and Play
  now exist twice on one screen. Nine drills then shipped as islands on top of that, with a learner
  model reading two of them. F1 made it acute (scored tiers shipped while the UI still calls them
  coaches), and F2 would stack the Lead pillar onto the same shell, the same screens and the same
  model. So all three get unified once, before they are inherited — the same argument that put
  Phase 1 first, applied to what it left behind.
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
