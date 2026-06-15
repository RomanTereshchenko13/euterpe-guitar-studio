# Guitar Studio — Roadmap

Sound realism and a practice/training mode, planned as dependency-ordered phases.
Zero-dependency, single-file *output* remains a hard constraint throughout: every
item below is achievable with the Web Audio API and vanilla JS, no libraries. As of
v1.12.x the app is authored as small modules under `src/` and assembled into the shipped
`index.html` by a pure-string `build.js` (concatenation only — no bundler, no transpile,
no runtime dependency added). New phases add their code as new `src/js/NN-*.js` modules.

_Last updated: 2026-06-15 · current shipping version: v1.12.0_

---

## Guiding principles

- **Stay zero-dependency; ship single-file.** No DSP rewrite, no sample libraries, no
  runtime deps. Body filters, comb excitation, allpass tuning, scheduler, onset
  detection — all small additions, not a new engine. Code lives in `src/` modules and
  is concatenated into one `index.html` by `build.js`; the build adds no dependency.
- **Validate musically, not just syntactically.** Each phase ships with checks in the
  jsdom harness (spectral/tuning checks for tone, grid-timing checks for the scheduler,
  drill-logic and scoring-window checks for practice).
- **Each phase should stand on its own** where possible, so partial progress is shippable.
- **Honest framing of feedback-free features.** A practice feature that can't hear the
  player is a coach/guide, not scored training — label it as such.

---

## Phase A — Tone realism  (standalone · low risk) → ✅ shipped v1.8.0

Make the Karplus-Strong voice sound more like a guitar. The current synth is already
strong (double-softened excitation, pitch-dependent decay, averaging-lowpass loop
damping, attack-brightness rolloff, per-note detune). These additions fill what it does
*not* model yet. Ordered by perceptual payoff per unit of code:

1. **Body resonance (biggest win).** The master bus reverb is a *room*, not a *body*.
   Add 2–3 peaking biquads on the bus tuned to a guitar's fixed body modes
   (~100 Hz air/Helmholtz, ~200 Hz top plate, ~400–500 Hz cluster). This is what makes
   an isolated note read as "guitar body" instead of "filtered pluck."
2. **Pick position.** Comb the excitation burst in `ksBuffer` (mix it with a copy delayed
   by ~1/5–1/8 of the period) to null harmonics the way a real pluck point does —
   round near the neck, nasal near the bridge.
3. **Velocity → brightness + level.** Add a velocity argument to `pluck` that scales both
   excitation amplitude and the opening lowpass cutoff. Harder = louder *and* brighter.
   Also the main cure for robotic, fatiguing loops.
4. **Fractional tuning + light stiffness.** `N = Math.round(rate/freq)` quantizes the
   delay length, so upper-register notes drift out of tune. A single allpass in the loop
   gives fractional delay (correct pitch) and, detuned slightly, the stretched overtones
   that wound strings actually have. Fixes a correctness bug *and* adds realism.
5. **Per-string timbre.** Pass the string index (already known at call sites) into `pluck`
   and bias brightness/decay/stiffness — wound bass strings darker/longer/more inharmonic
   than plain trebles. Makes chords sound voiced rather than stacked.

_Lower priority polish:_ two-stage decay (fast prompt → slow sustain), stereo width /
subtle per-string chorus, sympathetic resonance.

**Validation:** FFT peak vs target frequency (tuning), spectral centroid shift with
velocity, no regression in existing playback.

---

## Phase B — Audio engine foundation  (the gate for everything timed) → ✅ shipped v1.9.0

Finding: individual notes are sample-accurate (`pluck` schedules on `ctx.currentTime`),
but the rhythmic grid — metronome, loop, sequencer — runs on `setInterval`/`setTimeout`
and drifts (worse on mobile and in background tabs). The dot-lighting sync
(`flashAt`/`pulseAt`) is also `setTimeout`-based.

- **Lookahead scheduler.** Replace the timer-driven metronome/loop/sequencer with the
  "two clocks" pattern: a ~25 ms `setInterval` that *queues* audio events slightly ahead
  using `ctx.currentTime`. Move dot-lighting onto the same scheduled events so visuals
  stop drifting too. Fixes what already ships and is the prerequisite for any scored or
  play-along drill.
- **Named buses.** Split `master` into `backing` / `lead-target` / `cue`, each with its
  own gain, so later features can balance and duck.
- **Cue sounds.** Short synthesized correct / wrong / count-in cues on the cue bus.

**Validation:** scheduled event times vs the intended grid; no regression in metronome,
loop, or sequencer playback.

---

## Phase C — Backing realism  (builds on B) → ✅ shipped v1.10.0

- Synthesized **bass** (root/fifth on the downbeats) under the progression.
- **Humanization:** velocity + micro-timing variation on the comping.
- Optional groove click (filtered-noise hat/kick).

Turns the existing sequencer into a real jam-along bed for improv practice.

---

## Phase C+ — Release hardening  (gate before Phase D) → ✅ shipped v1.11.0

Not new capability — the readiness pass that makes the app safe to publish and keeps the
codebase from sprawling once the Practice phases start adding their own state. Three
workstreams, in priority order:

1. **Responsive fretboard (the headline · biggest reach win).** ✅ Done. Root cause was a
   hard `min-width: 1150px` on `.board`. Fixed by deriving the fret-cell width from the
   width actually available (with a 34 px readable floor), so a windowed range (≤5 frets)
   fits a phone with no horizontal scroll; only the wide "All frets" view falls below the
   floor and keeps the `.scroll` fallback. The board re-fits on rotation/resize. The
   separate fret-0 / open-string column and the playback-dot alignment both survive the
   reflow (asserted by the harness at 360 / 390 / 414 px).
2. **Commit the test harness.** ✅ Done. The multi-stage jsdom suite now lives in `tests/`
   with an `npm test` script and a dev-only `jsdom` devDependency (the app stays
   zero-dependency at runtime). Added the checks the later phases assume: scheduler
   grid-timing (Phase B), backing bass-note correctness incl. ♭5/♯5 (Phase C), and an
   equal-temperament tuning-target check (Phase A — a true spectral/FFT check needs a real
   AudioContext, noted as out of scope for jsdom). A GitHub Action runs the gate on push.
3. **State + error-handling guardrail.** ✅ Done. The silent `catch(e){}` swallows now log a
   dev `console.warn`, and a browser without `AudioContext` degrades gracefully — playback
   controls are disabled with a hint instead of being dead buttons. The loose musical-state
   globals are now documented as one catalogue (the sanctioned "clear, documented grouping"
   rather than a risky rename), so the Practice / ear / rhythm phases extend it through
   `saveState()` / `loadState()` instead of multiplying top-level globals.

_Also shipped in v1.11.0 (not originally a C+ item): playback-control clarity — the per-chord
**Listen** and **Loop** were consolidated into the timing bar as one obvious pair (hear once
vs keep going as a backing), with Loop shown only where it applies; the progression Play/Cycle
stays with its strip._

**Validation:** headless render at 360 / 390 / 414 px asserts no horizontal overflow in
windowed fret ranges, with intact open-string column + dot alignment; `npm test` green as
the release gate; audio-unavailable path degrades without throwing.

---

## v1.12.0 — Voicing parity polish  (pre-D consistency pass) → ✅ shipped v1.12.0

A focused cleanup before Phase D, closing the chord/triad anatomy gap surfaced in review.
The chord diagram now shows the canonical voicing set per chord — open (where one exists)
plus the E-shape (root on string 6) and A-shape (root on string 5) barre forms, deduped by
resolved fret array. Cards are selectable: the single context-aware Listen / Loop play the
selected voicing in its real register (so an open chord and its barre form actually sound
different), and card dots are live (click a string) and coloured by chord function. Triads
gained the matching anatomy — a shape card per inversion (normalized to a fully-fretted
movable block), Listen plays the displayed inversion / string set, and **Loop is now shown
in the triads view too**, looping the shown triad as a backing with the bass following its
true fifth (♭5 dim / ♯5 aug). Strums sweep low→high instead of stacking. Extended jazz
chords keep their single computed voicing — there is no canonical CAGED set for a 13.

**Validation:** smoke suite 193/193 (added voicing-correctness + triad-loop coverage; flipped
the old "Loop hidden on triads" assertion); an independent exhaustive check confirms across
all 12 roots × every quality (240 combinations) that every sounded note is a real chord tone,
no two cards share a fret array, and barre roots land on the correct string. Still
zero-dependency at runtime.

---

## Phase D — Practice mode v1  (flagship · screen-based, no mic)

New **Practice** tab. Two drills first, both reusing the fretboard rendering + B's
scheduler + cues:

- **Fretboard note-naming.** App asks for a note; you tap every instance; timed and scored.
- **Chord-tone targeting.** The progression loops with C's backing; target tones light per
  chord; you tap inside a scoring window; scored on accuracy and timing.

Plus session scoring and light progress stats, persisted through the full-state
localStorage added in v1.7.0.

**Note on input:** these are tap-based, so timing scores are subject to touch latency —
acceptable for note-finding, weaker for strict-timing drills. Strict timing is properly
solved by Phase F's onset detection.

**Validation:** drill logic, scoring-window correctness, persistence of stats.

---

## Phase E — Ear training  (builds on B buses + A tone)

Interval and chord-quality recognition: prompt on the lead voice, multiple-choice answer,
cue feedback. Mostly audio + simple UI. Naturally bilingual (EN/UK) like the rest of the app.

---

## Phase F — Real instrument input  (ambitious · optional)

Mic input via `AnalyserNode`, split into two capabilities because they differ sharply in
difficulty:

- **F1 — Onset detection (when).** Energy / spectral-flux attack detection. *Simpler* than
  pitch tracking, and the enabler for rhythm scoring (Phase G). Can land first.
- **F2 — Pitch detection (which).** Monophonic autocorrelation / YIN. Turns note-naming and
  matching drills into "play it on your actual guitar." Scope to single notes first;
  polyphonic chord recognition is a separate, much harder problem.

Both need latency compensation in the scoring window and a permission + calibration step.
Highest risk in the roadmap; gate carefully.

---

## Phase G — Rhythm & subdivision training  (builds on B; scored tier needs F1)

**Goal:** subdivision fluency and picking-hand consistency — play steady 8th notes,
triplets, and 16th notes cleanly in time, ideally over the app's own scale/triad content.

> **Scope note.** The original idea was "8th notes, triads, 16th notes." Read as a
> rhythmic ladder, the middle rung is *triplets* (8ths → triplets → 16ths). Triad
> *arpeggios* are excellent *content* to play in any of those subdivisions, so both
> readings converge: a subdivision trainer that runs over scales/triads.

Two tiers:

- **Coach tier (needs B only).** Pick a subdivision (8th / triplet / 16th) and tempo; the
  app plays an accented click grid, visually pulses the subdivision, and can walk a chosen
  scale or triad shape note-by-note across the grid so there's something musical to play.
  This is a smart metronome + visual coach — useful, but *not scored*.
- **Scored tier (needs F1 onset detection).** Score timing accuracy and evenness against
  the grid, flag rushing/dragging, and ladder the tempo (auto-bump BPM when consistently
  in the pocket). This is where it becomes real training.

**Why it makes sense:** subdivision command is a core improviser skill (progressive
rock / blues / jazz / Govan-style playing), it reuses the existing scale + triad material,
and onset detection is a lighter lift than full pitch tracking — so the scored version can
arrive without waiting on polyphonic detection.

**Honest caveat:** before mic onset detection exists, this is a coaching metronome, not
feedback-based training. Don't ship the scored tier on tap input — touch latency corrupts
timing scores, especially on mobile.

---

## Suggested sequence

```
A  (tone)            ✅ shipped v1.8.0
   │
B  (scheduler/buses) ✅ shipped v1.9.0  ── the gate; also fixed existing drift
   │
C  (backing realism) ✅ shipped v1.10.0
   │
C+ (release hardening) ✅ shipped v1.11.0  ── mobile board + committed tests + state guardrail
   │                       GATE CLEARED: public launch + user-facing practice now unblocked
   ├── D  (practice v1: note-naming, chord-tone targeting)   ← do next
   ├── E  (ear training)
   └── F1 (onset) ── G scored tier (rhythm/subdivision)
        └── F2 (pitch) ── real-guitar note-naming / matching
```

Recommendation: A–C+ are shipped — the release gate is cleared, so a public launch and the
user-facing practice features are unblocked. Build **D** next on solid ground. E, F, and G
are extensions; F2 (polyphonic-adjacent pitch work) is the moonshot.

---

## Cross-cutting concerns

- **Mobile:** audio unlock on user gesture (already required); account for
  `outputLatency` in any scoring window. The fixed-width, scroll-bound fretboard is
  addressed in C+ (responsive board); keep new Practice UI within the reflowed layout.
- **i18n:** every new label, drill name, and cue caption needs EN + UK entries
  (symmetric dictionaries — enforced by the test harness).
- **Persistence:** practice stats and drill settings ride the existing full-state
  localStorage; add them with bounds-checked restores like the v1.7.0 fields.
- **Accessibility:** dots are keyboard-reachable as of v1.7.0; keep new interactive
  elements focusable and Enter/Space-activatable.
