# Guitar Studio — Roadmap

The next chapter is not "more features." It's turning what we have — a strong **reference**
app plus a planned set of **drills** — into **one learning system** where a single musical
context flows from reference into practice and back, the app tracks what you know, and
practice covers *both* halves of real playing.

**Hard constraint throughout:** zero runtime dependencies, shipped as a single `index.html`.
Code is authored as small `src/js/NN-*.js` modules and concatenated by a pure-string
`build.js` (no bundler, no transpile). Every item below is reachable with the Web Audio API
and vanilla JS. New phases add new `src/` modules; they never add a dependency.

_Last updated: 2026-06-16 · shipping: v1.15.0_

---

## Where we are

The reference app and audio engine are mature. Shipped so far (full detail in `CHANGELOG.md`):

- **Tone** — a guitar-like Karplus-Strong voice (body resonance, pick position, velocity,
  fractional tuning, per-string timbre). _(v1.8)_
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

**1b — One board, modes (the risky refactor · isolated).** The highest-risk near-term change, so
it lands on its own behind the green harness and ships by itself.
- **One board, not four.** Collapse the four separate DOM boards (`ch`/`tr`/`sc`/`nt`) into a
  single board that switches what it highlights — less code, consistent behaviour, the home for
  the context. Keep the responsive + a11y assertions green throughout.
- **Consolidate control strips.** Group the many separate button rows (quality / set / inversion
  / position / root) into one compact control area.
- **Fewer tabs.** Fold the **Notes on fretboard** tab into a "Notes" *mode* on the unified board
  (4 tabs → 3). Its one unique function — highlight every instance of a note — is what the
  Phase 3 note-finder does, interactively and better; it doesn't need its own tab.

**1c — Reverse lookup (net-new value).** The questions players actually arrive with, currently
impossible — and the biggest usefulness gain per unit of new code:
- a **chord identifier** (frets/notes → name), and
- a **scale/arpeggio suggester** (chord or progression → what to play over it).

**1d — Feel pass (the polish bar, scoped).** Hold the "every phase ships feel" bar here rather
than deferring all of it to Phase 9 — and ride 1b's board rebuild while the board is already
open. Pure CSS / Web Animations, transform/opacity only, gated on `prefers-reduced-motion` (the
global reset already neutralizes CSS animation; any JS-driven motion checks it explicitly), and
the dot/cell-count harness assertions stay green throughout. The app already lights played notes
off the scheduler's RAF visual queue and fades panels on tab-switch; this adds the cheap wins
that build on that, since an audio/timing app's animation should make *sound and rhythm visible*:
- **Beat pulse** — a subtle downbeat pulse while the loop/backing band plays, reusing the
  existing scheduler + visual queue, so rhythm is *seen*, not just heard (pitch already is).
- **Pluck ripple** — a one-shot expanding halo from a dot on pluck; slots into the existing
  `.playing` toggle, reads as sound emanating, satisfying on touch.
- **Board-change stagger** — a brief (~150 ms) staggered fade/scale-in when the context, chord,
  or scale changes, so a re-render reads as a transition instead of a hard cut.
- **Circle relationship motion** — animate the tonic→subdominant→dominant sweep / connecting arc
  on key selection, turning a static recolor into a visible harmonic relationship.

Broader feel — onboarding, empty/error states, drill responsiveness — stays Phase 9's; 1d is
just the reference-level polish that belongs with the views being built here.

**Validation:** the single diatonic helper reproduces the old scales + circle output (assert
parity before deleting the duplicate); context round-trips through localStorage; the chord
identifier names known shapes; the one-board refactor keeps the responsive + a11y assertions
green; the feel pass leaves those assertions green and is fully neutralized under reduced-motion.

---

## Phase 2 — Complete the reference  (content · trickles alongside)

**Size:** M · **Risk:** low — reuses the existing triad/board rendering.

Fill the genuine content gaps, roughly by payoff:

- **Arpeggios** — the chord↔scale bridge, played melodically up the neck. Reuses triad rendering.
- **Intervals on the neck** — the visual counterpart to Phase 4's interval ear training.
- **CAGED** — surfaced as the explicit framework connecting chord shapes, scale positions, and
  arpeggios (the pieces already exist; the *system* doesn't).
- **Capo** — core for the rhythm/acoustic audience (we have alternate tunings but not this).

_Lower priority:_ deeper voicings (full-chord inversions / drop-2 / slash chords) for
intermediate+ players; modes shown as a *family* (relationship to the parent major) instead of
a flat list of twelve scales.

---

## Phase 3 — Practice core  (where the spine pays off)

**Size:** L · **Risk:** med — the learner model is net-new; pin its schema first (below).

The **Practice** tab and the machinery every drill shares:

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
- **The seam** (spine #2) wired in: jump from any reference view into a drill on that content.

**Validation:** drill logic, scoring-window correctness with the calibration offset applied,
persistence of stats + streak/SRS state.

---

## Phase 4 — Ear  (foundation · parallel, independent)

**Size:** S · **Risk:** low — multiple-choice on the existing audio buses; nothing new underneath.

Recognition by sound — feeds both pillars, depends on nothing but the audio buses:

- **Pitch:** interval and chord-quality recognition; prompt on the lead voice, multiple-choice
  answer, cue feedback.
- **Rhythm:** rhythmic dictation — hear a figure, clap/tap it back (the time-axis mirror of
  interval training).

Bilingual EN/UK like everything else. Low-risk, high value-per-effort; can run in parallel
with Phases 1–3.

---

## Phase 5 — Rhythm pillar  (play THE changes · broad audience)

**Size:** L · **Risk:** med — many coach tiers; scoring waits on F1 (Phase 8).

The half of playing nearly everyone does, built mostly by turning the existing backing band
into something the user plays *along with*. Coach tiers ship with no mic:

- **Chord-change fluency** — switch cleanly between shapes in time; score clean changes per
  cycle (the famous "one-minute changes"). We already have every shape.
- **Strumming-pattern trainer** — down/up patterns on the beat grid, synced to the scheduler;
  see and hear the pattern even without scoring.
- **Comping the progression** — play the right chord at the right time as the progression
  cycles (the rhythm-side mirror of chord-tone targeting).
- **Groove / feel** — accents, syncopation, palm-mute dynamics, swing.

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
  landing pages for SEO. Currently absent and cheap.
- **Polish & feel.** Onboarding/first-run, drill responsiveness and animation, cue sound,
  empty/error states — the bar "good" actually lives at, owned by no other phase.

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

- **Mobile:** audio unlock on user gesture (already required); account for `outputLatency` in
  any scoring window; keep all new UI within the reflowed responsive layout.
- **i18n:** every label, drill name, and cue caption needs symmetric EN + UK entries (enforced
  by the harness).
- **Persistence:** the musical context, drill settings, and learner-model state all ride the
  full-state localStorage with bounds-checked restores — added through `saveState()` /
  `loadState()`, never as free-floating globals.
- **Accessibility:** keep new interactive elements focusable and Enter/Space-activatable.
- **Tests are the release gate:** `npm test` green on every phase; the CI action runs on push.
