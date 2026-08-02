# Euterpe (guitar-studio)

Guitar theory & practice app — scales, modes, chords, triads, circle of fifths,
fretboard viz, Karplus-Strong audio engine, jam-along backing band. Bilingual
UI (Ukrainian / English). Brand is **Euterpe**; the package slug / internal ids
stay `guitar-studio`.

## The one rule that matters: edit `src/`, never the generated files

The core app is a single `index.html` **generated** by `build.js` (pure string
assembly — no bundler, no transpile). "Zero-dependency" here means *behavioural*:
it fetches nothing at runtime and has no supply-chain dependency — not that
third-party code is banned (it can be vendored; see Dependency policy below). On top of that, a thin
**additive PWA layer** makes it installable/offline when served over HTTPS (e.g.
GitHub Pages): `manifest.webmanifest` + a service worker (`sw.js`) + raster
`icons/` add a home-screen icon, its own window, and offline caching. The PWA is
sidecar-only — it's dormant on a `file://` / `dist/` copy and in the jsdom tests
(`src/js/14-pwa.js` self-disables off HTTPS), so the app is still the one file.

These files are **build output / generated — never hand-edit them**, your changes
will be overwritten:

- `index.html`   → generated from `src/index.template.html` + `src/styles.css` + `src/js/*.js`
  (the changelog is **sliced**: `build.js` inlines only the newest `CHANGELOG_KEEP` releases
  into the bundle — the full history was 15% of the file — and the modal links to `CHANGELOG.md`.
  **Comments are stripped** from the bundled JS + CSS: they were ~22% / ~28% of those files,
  i.e. a fifth of every visitor's download was commentary addressed to whoever edits `src/`.
  `stripJs`/`stripCss` in `build.js` are character scanners, not regexes — a regex hunting
  `/*` corrupts `https://` inside a string, a `/regex/` literal, or `content: "/*"` — and the
  stripped JS is syntax-checked before use, falling back to the unstripped source if it fails,
  so a scanner bug can cost bytes but never ship a broken app. **`src/` keeps every comment.**)
- `sw.js`        → generated from `src/sw.template.js` (`APP_VERSION` stamped into the cache name)
- `CHANGELOG.md` → generated from `src/js/02-changelog.js`
- `icons/icon.svg` → copied from `src/icons/icon.svg`
- `icons/*.png`  → rasterized from `src/icons/icon.svg` by `tools/make-icons.js`
- `dist/*`       → versioned standalone copies (gitignored)

Editable PWA sidecar (NOT generated, edit directly): `manifest.webmanifest`.

Edit the sources, then run the build.

## Where things live (all editable sources under `src/`)

- `src/js/NN-*.js` — ordered modules, concatenated alphabetically (zero-padded
  `00`..`16`). Order matters; the number is the load order.
  - `00-vendor-fft.js` + `00-vendor-pitchy.js` — **the only third-party code in the
    repo** (Phase 8/F0). `fft.js` 4.0.4 (MIT) and `pitchy` 4.1.0 (MIT/ISC — the
    roadmap's "0BSD" label was wrong, and pitchy is not alone: it *needs* fft.js).
    Vendored per the dependency policy: copied in, audited, concatenated — nothing
    fetched at runtime. **Do not edit them**; the only sanctioned change is swapping
    in a newer upstream release and re-applying the documented deltas (drop
    `module.exports` / `import` / `export`, wrap in an IIFE). The wrapper is
    load-bearing: `00-vendor-fft.js` sorts first, so an unwrapped upstream
    `'use strict'` would become the *script-level* directive and silently switch the
    whole hand-written app to strict mode. Each returns one symbol (`FFT`,
    `PitchDetector`) into the shared scope and keeps its helpers private.
  - `01-version.js` — `APP_VERSION`, the **single source of truth** for the version
  - `02-changelog.js` — release notes (EN/UK); drives the in-app modal AND `CHANGELOG.md`
  - `03-i18n.js` — translation strings · `04-constants.js` (incl. custom-tuning state:
    `customTuning` + `tuningMidi()`; and the meter model `METERS`/`meterIdx` +
    `barBeats`/`pulseSec`/`barSec`/`midPulseSec`/`meterGroupStarts`/`setMeter`, Phase 7b — 4/4 is
    byte-identical to the old `beat()*4`) · `05-audio.js` (the timing-calibration tap-test lived
    here; it was built ahead of the mic/scored tier meant to consume it, nothing ever called
    `calOffsetSec()`, so it was removed — bring it back with Phase 8/F1)
  - `06-backing.js` — the backing band + metronome + sequencer, all **meter-aware** (they read
    `barSec()`/`pulseSec()`/`barBeats()` instead of hard-wired 4/4); the merged over-the-changes
    drill (5c/6a) follows the same meter. Also `stopReferenceTransport()` (Phase 10/A1): the
    loop / progression / metronome are **Reference's**, so entering Practice ends them rather
    than strumming the reference chord over a drill on a clock the drill doesn't control —
    playback still persists across *tabs*, where the subject is the same
    · `07-render-shared.js` · `08-chords.js` · `09-triads.js`
  - `10-scales.js` · `11-notes-circle-lang.js` · `12-toolbar-state.js` (state save/load +
    the custom-tuning editor + the share-link codec `encodeShareState`/`applyShareHash` +
    `setTempo()`, the one clamped setter both tempo controls go through, Phase 10/A1)
  - `13-drill-registry.js` — the **drill registry**: `DRILLS` + `registerDrill()`, plus the
    generic shell helpers `activeDrill`/`exitAllDrills`/`showDrillHome`/`refreshDrillsLang`/
    `drillKeyChanged`/`applyDrillCtx`. Every drill file self-registers at load
    (`{id, area, isActive, exit, refreshLang?, onKey?, tempo?, tracks}`), and `setMode` (15) / `applyLang`
    (11) iterate `DRILLS` instead of naming drills — so **adding a drill is one new `14-*.js`
    file + its markup, with nothing to register by hand**.
    There used to be a `mode:'practice'|'ear'` field; **Ear was folded into Practice** (it was
    a pillar, not a mode — same home shell, same progress card, same learner model), so the
    field went away and the mode axis is Reference vs Practice again.
    Loads at slot 13 (before the slot-14 drills) because `const DRILLS` isn't hoisted. The
    smoke suite guards the seam: every `*-area` in the markup must be claimed by a registered
    drill, so an unregistered drill fails the build rather than silently half-working.
    **Shared drill chrome** (`#drill-ctx` in the template, built in 15): one Key picker, one
    Tempo stepper and one Exit button for *all* drills, instead of the identical copy each
    drill used to carry. Exit calls `activeDrill().exit()`; the key picker calls `setKey` then
    `drillKeyChanged()`, which invokes the running drill's optional `onKey()` — "re-derive
    yourself from the new key" (rebuild bars, deal a new round, repaint the board). A drill
    with nothing key-dependent just omits `onKey`. CSS derives the strip's visibility from
    `#practice-home:not([hidden]) ~ #drill-ctx`, so no drill manages it. Both *halves* of the
    strip are derived too: `applyDrillCtx()` shows the key picker only for a drill declaring
    `onKey` (so the ear / note-naming / one-minute-changes drills don't get a picker that
    adjusts nothing) and the tempo stepper only for one declaring **`tempo:true`** (Phase
    10/A1 — the four scheduler-driven drills: timing, strum, over-the-changes, changes).
    It's called from one delegated listener on `#practice-home` (every drill starts
    from a card or the Review button in there), so drills still register nothing by hand.
    **Tracks** (Phase 10/B1): a drill also declares what it *teaches* —
    `tracks:[{id, kind:'recall'|'perf', items, sess, better, unit, label, start}]`. A track, not
    a drill, is the unit the learner model reads: over-the-changes is one drill with **two**
    (comping and targeting), ear training is one with **three**, and the note drill is **both
    kinds at once**. Ten tracks over seven entries — one per practice card, and the smoke suite
    counts the cards from the markup, so a card without a track fails the build. Helpers:
    `drillTracks`/`trackById`/`trackBySess`/`trackByItems`/`sessNs`/`startTrack`.
    **Watch the `[hidden]` trap**: `#drill-ctx-key` / `#drill-ctx-tempo` are `.group`s
    (`display:flex`), which outrank the UA `[hidden]{display:none}` — hiding them needs the
    explicit CSS rule, and jsdom's `.hidden` property will happily report success without it.
  - `13-mic.js` — the **shared mic layer** (Phase 8). One microphone, three consumers
    (F0's tuner, F1's onset detector, F1's calibration), so acquisition, the permission
    prompt and the error vocabulary (`micErrKey` → i18n key) live here instead of being
    copy-pasted. **Refcounted** (`micAcquire`/`micRelease`), because the tuner and a
    scored drill can be open at once and whoever stops *second* must be the one that
    actually releases the device; `micReleaseAll()` is the hard override for tab-hide /
    pagehide. Asks for the raw signal — `echoCancellation`/`noiseSuppression`/
    `autoGainControl` all off, since AGC destroys onset dynamics and noise suppression
    destroys sustained pitch. Self-disables off a secure context like `16-pwa.js`.
  - `13-scored.js` — the **shared scored-run layer** (Phase 8/F1). One scoring tier, three
    drills: F1 shipped this inside the subdivision coach, and when the Rhythm tiers (5b, 5c)
    needed the identical five steps it moved here rather than being pasted twice more —
    same reasoning as `13-mic.js`. `scoredRun(cfg)` returns a controller
    (`begin`/`mark`/`end`/`render`/`toggle`/`release`); the drill keeps only what is
    drill-specific: **what counts as a slot you're expected to play**, the tolerance, and
    the count-row label. **The expected times come from the drill's own tick** via
    `mark(when)`, never from a formula — the scheduler is the only thing that knows where a
    sound actually landed after swing, meter and any mid-run tempo change. Slot 13 for the
    usual reason (its `const`s would be in the TDZ for a slot-14 drill loading earlier).
    Consumers: `sdScore` (every grid tick), `spScore` (the pattern's sounding slots, swing
    included), `tgScore` (the bar downbeats — see the comp drill below).
  - `13-learner.js` — learner model (spine #3), **schema v2** since Phase 10/B1: per-item SRS
    history + a sessions ring buffer + a stored per-id **personal best**; persists via
    `12-toolbar-state.js`'s `saveState`/`loadState`. Exposes the progress-card readouts
    `learnerReview` (the queue) + `learnerActivity` (active days) + **`learnerTrend`** (runs,
    latest, best, direction of travel, staleness — the ring buffer read as the time series it
    always was) + `learnerBest`.
    **What B1 changed and why**: `REVIEW_NS` was four hardcoded strings and `startReview` a
    four-branch router, so six of the ten practice tracks were not ranked low by "what should I
    practise next?" — they were absent from its vocabulary. Both are now derived from the
    registry's `tracks` (below), and a **performance** track falls due on *staleness* or
    *slippage* instead of SM-2. Sessions may carry an optional **`err`** (the scored tiers' mean
    absolute timing error, which used to be shown once and thrown away); `scoredErr()` in
    `13-scored.js` refuses runs the self-hearing guard refused, so the app's own click can't
    poison the trend. Retention is **per session id** (`SESS_PER_ID`), not one global cap — a
    daily drill used to evict a weekly drill's entire history. The `v1 → v2` migration is
    **purely additive**: items and sessions carry over untouched and `best` is reconstructed
    from them, asserted against a captured v1 store.
  - `14-drill-ear.js` + `14-drill-notes.js` + `14-drill-overchanges.js` +
    `14-drill-lead-callresponse.js` + `14-drill-rhythm-{1-changes,2-strum}.js` +
    `14-drill-timing.js`
    — the drills (all at load slot 14, before wiring). `14-drill-notes.js` is the Practice
    note-naming drill (3c); `14-drill-ear.js` is Ear training (Phase 4) — interval /
    chord-quality / rhythm recognition, multiple-choice on the audio buses. It's **three
    drills behind one registry entry** (they share the `ear` state and `#ear-area`), and it
    lives in the Practice home's Ear group: Phase 4 gave it its own top-level mode, but that
    mode was a duplicate of Practice's shell (same drill-card list, same progress card
    rendering the same `renderProgressInto` from the same learner model, its own Quit), so it
    folded in. `#ear-home`, `#ear-progress`, `#ear-quit`, `.ear-panel`, `body.mode-ear` and
    `body.mode-activity` are all gone; a save or share link pinned to `m=ear` lands on Practice.
    `14-drill-rhythm-1-changes.js` (`cm*`) is the "one-minute changes" chord-change coach (5a),
    a setup→timed run→summary flow. `14-drill-rhythm-2-strum.js` (`sp*`) is **Strumming & feel**
    — the 5b pattern trainer and the 5d groove lab **merged**: one 8th-note clock over the
    context chord with a pattern picker (`STRUM_PATTERNS`) *and* the feel controls
    (`SP_SWINGS` swing, backbeat accent, palm-mute, optional drums+bass band), so the
    cross-combinations neither drill could reach now work. **Scored tier (v2.14.0):**
    `spScore` marks the pattern's *sounding* slots at `time+swDelay` — the empty slots are
    where the hand deliberately misses, and scoring a correctly swung player against the
    un-swung slot would mark them late by the swing amount. Turning the mic on **mutes the
    guide strum** (it lands on exactly the slot being measured) and force-enables the click
    if nothing else is sounding, since a timing score against silence is meaningless.
    `14-drill-overchanges.js` (`tg*`) is **Over the changes** — comp-the-progression (5c) and
    chord-tone targeting (6a/6b/6c) **merged**, because they were one machine: the same
    `SEQ_PRESETS` bar expansion on the same `barSec()` clock with the same
    `scheduleBand(force)`/`compStrum` bed, NOW/NEXT stage and beat dots (6a's markup already
    reused 5c's `co-*` CSS). A `tgMode` switch picks what you play: `chords` (loud guide comp
    + mid-bar push, chord **diagrams**, no neck, records `comp:<prog>` by bars) or `tones`
    (lighter comp, chord **names**, tappable neck of lit chord tones, records `target:<prog>`
    by accuracy; **Position** windows them to one arpeggio box via Phase 2's `boxWindow`,
    **Target** narrows to a single degree — other chord tones stay neutral, only off-chord
    notes miss). Both practice cards (`start-comp` in Rhythm, `start-target` in Lead) open
    this one drill in their own mode, so each pillar's picker stays honest; both session
    namespaces are kept so pre-merge progress still reads. The DOM ids stay `tg-*`.
    **Scored tier (v2.14.0), `chords` mode only:** `tgScore` marks the **bar downbeats** —
    comping is your own rhythm, so the drill has no business scoring how many times you hit
    the chord inside a bar. It scores what the exercise is about: *landing the change*.
    In-bar strums fall into `extra` and are not penalised, hence the count row reads
    "changes landed", not "played", and the tolerance is half a beat (a change is a coarser
    target than a 16th). The guide comp is **muted** when scoring, for the same reason as
    the strum drill's. `tones` stays tap-scored on accuracy — touch latency corrupts
    timing, and real lead scoring waits on F2.
    `14-drill-lead-callresponse.js` (`cr*`) is
    6c call-and-response — the app plays a scale-box motif (LISTEN) and you echo it back on its own
    board (YOUR TURN); self-paced, scored on echo accuracy, its listen/answer turns being the
    play-vs-rest phrasing lesson.
    `14-drill-timing.js` (`sd*`) is the Foundations subdivision & timing coach (Phase 7a):
    a smart visual metronome — a subdivision picker (`SUBDIVS`, `div` per beat) + tempo drive a
    3-level accented click + a `SD_BEATS·div` grid on its own scheduler clock, while the context
    scale is walked note-by-note across the grid inside one Phase-2 `boxWindow` on its own display
    board; in-drill position only (key **and tempo** come from the shared `#drill-ctx` strip —
    its private tempo stepper was the duplicate Phase 10/A1 collapsed), records a
    `timing:<subdiv>` session (no SRS). Coach tier
    (serves both pillars) — mic scoring is Phase 8/F1.
    They reuse the cue bus and the
    learner model; the shared progress readout (`renderProgressInto`) lives in the ear module.
    The note/ear drills write per-item SRS; the rhythm + lead coaches write only a sessions entry
    (best-per-pair / bars-played / accuracy is derived from the ring buffer, so the pinned item shape stays untouched).
  - `14-mic-tuner.js` — the **chromatic mic tuner** (Phase 8/F0, `mic*`/`mt*`, `#mt-*`). Real
    `getUserMedia` → `AnalyserNode` → the vendored `PitchDetector` → a ±50-cent needle, note
    name + octave, and a nearest-open-string readout derived from the live `OPEN_MIDI`/`SNAMES`
    (so it re-labels for Drop D / DADGAD / Open G). **Complements** the reference-tone tuner in
    `05-audio.js` — that one plays a pitch at you, this one listens. It asks for the raw signal
    (`echoCancellation`/`noiseSuppression`/`autoGainControl` all **off** — voice-call DSP mangles
    sustained tones), never connects the mic to `destination` (that's a feedback loop), calls
    `tunerStop()` before listening, and stops the tracks on close / tab-hide / pagehide. Readings
    are median-filtered (MPM's failure mode on a plucked string is a one-frame octave jump) then
    eased; the easing lives in a module-level `mtCents` *outside* the session object, so the whole
    readout is drivable with no mic attached — which is what the jsdom checks use.
    **Why slot 14** and not 17 beside the PWA sidecar it otherwise resembles: `applyLang` (11)
    calls `micRefreshLang`, and `applyLang` first runs from wiring-init (15), so loading after 15
    makes `let mt` throw on the temporal dead zone — the same trap that pins the drill registry to
    slot 13. **Self-disables like the PWA sidecar**: with no secure context / no `getUserMedia`
    (a `file://` dist copy, jsdom) the entry button is *removed*, not disabled — a control that
    can only ever report an error shouldn't be on screen. It is **not** a drill: no registry
    entry, no `-area`, no learner-model writes.
  - `14-onset.js` — **onset detection** (Phase 8/F1, `onset*`/`ON_*`) — the app's first
    *scoring* feature. Hand-rolled per the dependency policy: unlike pitch, energy-based
    attack detection is genuinely the light lift. Runs in an **AudioWorklet**, not on rAF,
    because a timing score *is* the timestamp — rAF samples at ~16.7 ms and stalls under
    layout, which would inject an eighth of a sixteenth-note's worth of pure harness noise
    at 120 BPM. The processor source is a **string** (it compiles in a different global
    scope and can see nothing in this file) turned into a **Blob URL** at runtime — an
    in-memory object URL, *not* a network fetch, so the single-file / offline guarantee
    holds. Detector: pre-emphasis (`x − 0.97·x[n−1]`, the cheap half of spectral flux —
    tilts toward the broadband attack and away from low-frequency body ring) → fast/slow
    envelope pair → trigger when fast beats the adaptive baseline by `ON_RATIO`, with a
    refractory period and a re-arm hysteresis so one attack's decay can't double-trigger.
    Falls back to `ScriptProcessor` (deprecated but audio-thread-driven) rather than rAF,
    so onset *times* stay honest on the fallback path. Also holds the **pure** scoring
    maths — `onsetMatch` (greedy nearest, each expected slot claimed once, so a flam is
    one hit plus one extra), `onsetScore` (mean absolute error, signed bias, spread,
    hit rate), `onsetVerdict`/`onsetFeel` — kept free of DOM and audio so the harness can
    assert the numbers without a microphone. Also `onsetSelfHeard` — **the self-hearing
    guard** (v2.14.0), the honesty hole at the centre of mic scoring: on speakers the mic
    hears the app's own click/comp, and those land on the grid *exactly*, because they were
    scheduled there and the round-trip calibration measures precisely that path. So after
    correction the app's own click reads as a flawless hit on every slot and a player who
    put the guitar down scores "Tight · 32/32". **Timing cannot separate the two** — a
    perfectly played note is *supposed* to arrive with the guide it follows. What the app's
    own sound is not is *human*: the guard is a plausibility floor (`ON_HUMAN_MS` spread
    AND `ON_SELF_HITRATE` over `ON_SELF_MIN_N` slots), and the panel prints the refusal
    instead of the score. Deliberately conservative — a false accusation calls a good
    player a liar, so both conditions must hold. The structural half of the fix is in the
    drills: the scored Rhythm tiers **mute their guide guitar**, which was landing on
    exactly the slots being measured.
  - `14-calibration.js` — **latency calibration** (`cal*`), restored for F1, which is its
    first real consumer (the v2.5.0 version was cut in v2.11.0 for having none). **Not the
    old tap test**: that measured output latency *plus human reaction*, and tap-scored
    tiers are the thing the roadmap forbids shipping. This measures the audio **round
    trip** with no human in the loop — play a click, hear it back through `14-onset.js`,
    take the delta, **median** over `CAL_CLICKS` so one door slam can't move the number.
    `calOffsetSec()` is what every scorer subtracts; without it *every* player reads as
    dragging by the buffer size. Headphones are the honest failure case (no acoustic path,
    so nothing to measure) — it says so and leaves the manual slider. Rides
    `saveState`/`loadState`, bounds-checked against `CAL_MAX_MS`.
    **`calKnown` / `calMeasured()`** (Phase 10/A4) is the distinction the module was missing:
    whether the round trip was ever *established*, as against the `0` it starts at. Those are
    different claims — `0` means "the round trip is instant", true of no device ever made —
    and without the flag a player who never calibrated was scored against zero and told, as
    fact, that they drag by exactly the buffer size. `13-scored.js` consumes it twice: the
    panel withholds the ms figure and the rushing/dragging verdict while it's unset (spread
    is a *difference* measure, so evenness stays honest and is still shown), and `scoredErr()`
    refuses the run entirely, exactly as it refuses a self-heard one — an uncalibrated error
    in the trend would chart a device change as progress. A hand-set slider counts as known
    (the player asserted a value); a pre-A4 save with a non-zero reading is grandfathered in.
  - `15-wiring-init.js` — wiring + init. Holds the **one navigation surface** (Phase 10/A2):
    `#mainnav` with four destinations (Harmony · Scales · Circle · Practice), replacing the
    mode pill strip stacked above the reference tab strip. `navTo(panel)` is the only entry
    point; `applyNav()` paints the strip from the live state and is called by **both**
    `setMode` and `selectTab`, so a keyboard shortcut (`1`–`4`), a seam jump or a restored
    share link move the nav too. The **mode axis is unchanged in code** — `setMode` still
    drives `body.mode-practice`, still orthogonal to `currentTab` — it just stopped being a
    second thing on screen. All four are genuine `tab`/`tabpanel` pairs, since
    `#panel-practice` is a real sibling section. On a phone CSS pins the strip as a fixed
    4-item bottom bar (which is why the labels are single words). The **view switch** left
    the header for `#board-lens` inside `#board-region` — a lens on the board it changes,
    hidden and moved with the neck by `applyBoardRegion`, which is what Phase 1b already
    made true underneath (one board, four renderers).
  - `16-pwa.js`
- `src/styles.css` — all CSS. The shell's layout lives in **`.layout`'s named grid areas**, and
  since Phase 10/A3 the neck **leads**: the maps run `ctx` → `board` → `boardmeta` → `main` →
  `shapes`/`aside`/`extras`, so the fretboard sits above the active view's own controls instead of
  behind them (it used to start 645px down a 708px laptop viewport). There are **four** area maps —
  desktop, `.no-aside`, portrait phone, landscape phone — plus Practice's single-`"main"` collapse,
  and a new band has to be placed in all of them. `#context-bar` is a grid item in its own right
  (not part of `.main`) precisely so those three can be ordered independently. **The neck keeps the
  full page width on desktop** — controls compact into a horizontal rail under it, never a vertical
  one beside it; the suggester rides beside the *controls*. **Watch the `[hidden]` trap** (same one
  the `#drill-ctx` groups hit): any author `display` rule on an element something toggles with
  `.hidden` needs its own `[hidden]{display:none}` escape hatch — `#practice-home` got a
  `display:grid` in A3 and instantly started showing through behind every running drill, with jsdom
  reporting success the whole time.
- `src/index.template.html` — markup shell with `@@STYLES@@` / `@@SCRIPT@@` / `@@FAVICON@@` markers.
  `#board-region` + `.board-meta` sit **before** `.main` in the source, not only in the area maps
  (Phase 10/A3): source order is focus order, so a grid-only reorder would have handed a keyboard
  user the chord picker before the neck it changes. Practice's home wraps its pillars in
  `.ph-drills` so the progress card has something to sit *beside* on a desktop viewport.
- `src/sw.template.js` — service worker (`@@VERSION@@` → cache name)
- `src/icons/icon.svg` — the app icon, authored once

## Commands

```bash
node build.js     # rebuild index.html, sw.js, dist/, CHANGELOG.md from src/
npm test          # from repo root: rebuilds first (pretest), then runs jsdom suite
npm run lint      # static-analysis gate: lints src/js as one concatenated scope (CI runs this too)
```

**Pre-commit gate (one-time per clone):** `git config core.hooksPath tools/githooks`
installs `tools/githooks/pre-commit`, which runs lint → build+smoke → and verifies
the generated `index.html`/`sw.js`/`CHANGELOG.md` still match a fresh build of `src/`
(blocks the commit if they're stale). It nudges a manual visual pass when
`src/styles.css` or `src/index.template.html` changed.

- `npm test` (root) rebuilds then runs `tests/smoke.js` (270+ jsdom checks). CI
  runs the same on every push/PR, so **the committed `index.html` must always
  match `src/`** — rebuild before committing.
- `tests/` needs a one-time `cd tests && npm install` (jsdom, dev-only).

## `tools/` — dev-only helpers

Most drive the **system Edge/Chrome in headless mode** — no bundled browser,
nothing added to the shipped app. The browser-driven ones read the built
`index.html`, so `node build.js` first; they locate the browser under
`Program Files\{Microsoft\Edge,Google\Chrome}` and bail if not found. The
linter (`lint.js`) is pure Node — ESLint + `globals` are dev-only
devDependencies in the **root** `package.json` (same status as jsdom in
`tests/`), so the root needs a one-time `npm install`.

- `node tools/shoot.js [widths]` — responsive **screenshots** for eyeballing
  layout. Default widths `390 768 1280`; pass custom (`360 414 820`) or
  `WxH` (`390x3200`). Renders inside a fixed-width `<iframe>` so the iframe width
  is the true layout viewport, and flags **HORIZONTAL OVERFLOW** if the page
  exceeds it — **naming the widest offending element**, since knowing the page is
  25px too wide tells you nothing about which rule did it (elements inside a
  deliberate `.scroll` are skipped: a wide neck overflowing *that* is the design).
  Throwaway PNGs → `tools/shots/wNNN.png`. Tokens select what to
  capture (`tabs`, `practice`, a drill name, `a11y`, a time signature, and — since
  A4 — `settings`, which expands the Settings disclosure; `settings practice` is
  how you check Tools is reachable from Practice). It **freezes animation** in the
  shot (`animation:none;transition:none`): every token is a *click after load*, and
  a panel revealed by one carries `animation: fade 0.25s`, which does not advance
  under `--virtual-time-budget` — so the surface photographs blank or half-faded and
  looks exactly like a layout regression that isn't there. Layout review wants the
  settled state, not motion.
- `node tools/scroll-check.js [WxH ...]` — headless **scroll/sticky-header
  regression check** (CI-style, exits 1 on issue). Injects a diagnostic that
  scrolls the page in real time and reports condensing-header bugs: flip-flop,
  scroll drift, slow-scroll thrash, layout jump. Default `390x740 390x1100`;
  ~15s real time per viewport (uses real timers, not virtual-time, because the
  condense trigger is an IntersectionObserver). An **empty** result (no diagnostic
  output) is retried **once**: whichever viewport lost the cold browser-launch race
  used to report a phantom failure — clean alone, clean in second position — and a
  gate that cries wolf gets ignored. A diagnostic that comes back and *reports* a
  problem is a real finding and is never re-rolled.
- `node tools/kbd-check.js` — headless **keyboard-shortcut functional check**
  (exits 1 on failure). Dispatches real keydown events and asserts the DOM
  responds: tab switch (`1/2/3`), root set (`g/a/c`), transpose (`[`/`]`), help
  overlay (`?`/`Escape`), and the typing/focus guards.
- `node tools/mic-check.js` — **end-to-end check for the F0 mic tuner** (exits 1 on
  failure). The jsdom suite covers the pitch→readout maths and the DOM contract but
  has no `getUserMedia`, so the half that matters — real capture → `AnalyserNode` →
  the vendored detector → the needle — is only testable in a real browser. It
  synthesizes a guitar-ish WAV at a known pitch, hands it to Chromium as a fake mic
  (`--use-file-for-fake-audio-capture` + `--use-fake-ui-for-media-stream`), and asserts
  the tuner names the right note and cents. Serves the build over a throwaway
  `127.0.0.1` port because **`getUserMedia` needs a secure context and `file://` isn't
  one**. Real time, not `--virtual-time-budget` (which starves the audio pipeline —
  same reason `scroll-check.js` avoids it). ~1 browser launch per pitch, ~30 s total.
- `node tools/onset-check.js` — **end-to-end check for F1 onset detection** (exits 1 on
  failure). Proves the AudioWorklet loads, detects real attacks in a real capture stream,
  and — the property scoring rests on — reports their *times* accurately. Feeds Chromium a
  synthetic pluck WAV as a fake mic and asserts **inter-onset intervals**, not absolute
  times: the fake device starts at an arbitrary phase against the audio clock, and absolute
  offset is precisely what calibration removes anyway. Every number F1 shows a player is
  built from differences, so intervals are the honest thing to check. Currently measures
  **0.1 ms** mean interval error. _(The acoustic round-trip calibration can NOT be checked
  headlessly — it needs a real speaker and mic in one room.)_
- `node tools/make-icons.js` — **rasterize** `src/icons/icon.svg` into the PWA
  PNGs (`icon-192`, `icon-512`, `icon-maskable`, `apple-touch-icon`) in `icons/`.
  Run after editing the SVG; the PNGs are committed (Pages serves them). The
  maskable variant nests the mark in the safe circle on a `#1b1712` full-bleed bg.
- `npm run lint` (`node tools/lint.js`) — **static-analysis gate.** Concatenates
  `src/js/*.js` in build order and lints it as **one shared script scope** (the
  shipped reality — all modules share one scope), then maps findings back to
  `src/js/NN-*.js:line`. Catches the bug class jsdom can miss: a typo'd/missing
  cross-file symbol (`no-undef`), a duplicate top-level name (`no-redeclare`),
  and dead code (`no-unused-vars`, warnings). Errors exit 1; **runs in CI** as a
  second job (`.github/workflows/test.yml`). Config: `eslint.config.js`.
  `no-use-before-define` is deliberately OFF — cross-file refs execute post-load,
  so the lexical check is all false positives here.
  It also runs **dead-resource + source-hygiene checks** ESLint structurally can't:
  an i18n key present in one language but not the other; an i18n key no longer
  referenced anywhere; an i18n key **referenced but declared in neither** language
  (Phase 10/A4 — the mirror of the other two, and the one that had no check:
  `applyLang` *skips* an undefined key instead of blanking the element, so a deleted
  key leaves the template's hardcoded Ukrainian on screen for English readers and
  nothing complains. That is how A2's deleted `mode_reference` shipped on the
  first-run welcome card); a CSS class styled but never applied; and a silent
  `catch(e){}` (`catch(_){}` is the codebase's deliberate-swallow marker and is
  allowed). Dynamic lookups are handled without an allowlist that could go stale:
  the literal fragments flanking a `+` inside `t(...)` are harvested as
  prefixes/suffixes, so `t('qg_'+g)` keeps every `qg_*` key alive and
  `t(head+'_h')` keeps every `*_h` key alive; the same trick covers class names
  built as `'ear-'+type`. The silent-catch rule used to live in the smoke suite,
  but the bundle now ships comment-stripped, so the explanatory comment that
  satisfies it is no longer visible in the built file.

**Visual / orientation review** is not a script — run `node tools/shoot.js` with the
orientation matrix and have an AI (e.g. this Claude Code session) review the PNGs.
Each `WxH` token is a real viewport so the shape-based shells fire (landscape phone =
`max-width:940 & max-height:500`), and the `tabs` token captures **all three tabs**
(harmony/scales/circle) per size → `w{W}-{panel}.png`:
`node tools/shoot.js tabs 390x844 844x390 360x740 768x1024 1024x768 1280x800 1920x1080`.

## Skills (`.claude/skills/`)

Recurring project workflows packaged as **AI-invokable skills**. They are prompts
for the agent (this session), not shell scripts — Claude auto-picks one when your
request matches its description, or you can run it by name (e.g. `/release`). Each
leads with the "edit `src/`, never the generated files" rule.

- **`release`** — bump `APP_VERSION` + paired EN/UK changelog entry, build/lint/test,
  ROADMAP version line, tag & push.
- **`visual-review`** — run the `shoot.js` orientation matrix across all tabs and
  review the PNGs for overflow / landscape-parity / header issues (the manual step
  the pre-commit hook only nudges about).
- **`add-i18n-string`** — add a UI string with symmetric `uk`/`en` keys in
  `03-i18n.js`, then rebuild + test.
- **`preflight`** — run every gate on demand: lint → test → generated-file sync →
  scroll-check → kbd-check (the pre-commit hook's superset).
- **`project-review`** — review a diff against Euterpe's invariants (generated-file
  edits, i18n symmetry, single concatenated scope, dependency policy,
  version↔changelog) — complements `/code-review`.

## Conventions

- **Every new UI string needs symmetric Ukrainian + English entries** — the test
  harness enforces this; an unpaired key fails the suite.
- Versioning: bump `APP_VERSION` in `src/js/01-version.js`; add a matching
  `02-changelog.js` entry. Polish/fixes = patch bump (1.25.0 → 1.25.1), not minor.
- Release: `git tag vX.Y.Z && git push --tags`. Current shipping version is at the
  top of `ROADMAP.md`.
- **Dependency policy (the guarantee is behavioural, not purist):** one file,
  fetches nothing at runtime, no supply-chain dependency, works offline. The only
  thing the app fetches is Google Fonts. Third-party code is *not* banned but is
  tightly gated — it must be (a) **permissively licensed** (MIT/BSD/0BSD/Apache-2.0,
  **never copyleft** — GPL would relicense the whole single-file output),
  (b) **vendored**: source copied into `src/`, audited, and concatenated by
  `build.js` so nothing is fetched at runtime, and (c) solving a genuinely hard,
  already-solved problem. **Vendored so far (Phase 8/F0): `pitchy` 4.1.0 + its one
  dependency `fft.js` 4.0.4**, both MIT-class, both in `src/js/00-vendor-*.js`, for
  pitch detection. Note the roadmap originally promised "the one code dependency,
  0BSD" and both halves were off — pitchy is MIT/ISC, and it does not stand alone.
  Everything else stays hand-rolled. See the Dependency policy in `ROADMAP.md`
  before adding any lib.

See `README.md` for the full architecture write-up and `ROADMAP.md` for the
phased plan.
