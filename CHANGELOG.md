# Changelog

_Generated from `src/js/02-changelog.js` by `build.js` — do not edit by hand._

## v1.21.1 — 2026-06-17

- Fixed: on the Arpeggio and Identify views, the fretboard now updates straight away when you change the tuning, capo, fret window or handedness — previously it kept its old layout on those two views until you switched away and back.

## v1.21.0 — 2026-06-17

- The app is now called Euterpe — after the Greek muse of music. "Guitar studio" stays on as a descriptor; nothing about how the app works has changed.
- Scales view now colours the fifth and the seventh, not just the root and third.
- Each scale shows its tonic-seventh skeleton — root, third, fifth, seventh — in the same colours used across the chord and triad views, with the remaining passing tones (2 · 4 · 6) in a neutral tone. The fifth is finally named in the legend instead of blending into a generic "other" that had borrowed the fifth’s blue.
- The legend now lists only the degrees the selected scale actually contains, so a pentatonic with no seventh no longer shows a seventh swatch.

## v1.20.0 — 2026-06-16

- Phase 2 — completing the reference: arpeggios, a capo, and the CAGED framework, added without crowding the three-tab layout.
- New "Arpeggio" view under Chords / triads: the same chord, shown as a melodic shape you run up the neck. Listen plays it ascending, and you can isolate one position as a practice box — the bridge between a chord and the scale you solo with over it.
- Capo: a new control in Settings (next to Tuning and Frets). Set a capo and the fretboard dims the frets behind it and marks the capo as a movable nut, so you can see where your shapes sit — the notes themselves don't move.
- CAGED: in the major scale, the five fretboard positions are now labelled with their C·A·G·E·D chord shapes (E·D·C·A·G up the neck) instead of plain numbers, and the panel names the chord form each scale box is built around — making the link between chord shapes and scale positions explicit.

## v1.19.0 — 2026-06-16

- Clarity pass: the same tools, less clutter — and the fretboard front and centre.
- The neck now sits directly under the controls. The chord-shape cards and the progression sequencer moved below the board, so on a phone you reach the fretboard right after picking a chord instead of scrolling past everything first.
- The chord picker is grouped into Basic / Sevenths / Extended tiers, so the 21 chord types read as organised sections instead of one long wall of buttons.
- The timing bar is tidier: the metronome, bass and drums are collected into one labelled "Backing" group, so the bar reads as a few clusters rather than a row of loose buttons.
- Backing that starts itself: turning on Bass or Drums now starts the chord loop when nothing is playing, so they behave like the metronome instead of staying silent until you start a loop or progression first.
- Fewer control layers: the view switch (chord tones / triad shapes / identify, or scale / notes) moved up next to the root, so each tab shows one "View · Root · Display" header instead of a separate row above the board; the dot-label toggle is now "Names / Intervals" so it no longer reads as a second "Notes".
- "Play over this" where you need it: on a phone the suggestion panel now sits directly under the fretboard instead of at the very bottom of the page, below the chord shapes and the progression builder.
- Smaller polish: on a narrow screen the tab strip now fades at its right edge to show more tabs scroll off-screen, and the root / note-name separator no longer strands itself on its own line when the controls wrap.

## v1.18.0 — 2026-06-16

- Feel pass (Phase 1d): subtle, motion-respecting animation that makes sound and rhythm visible.
- Beat pulse — while a loop or the backing band plays, the transport indicator now pumps on every beat (a stronger pulse on the downbeat), locked to the same precise clock as the sound, so you can see the tempo.
- Pluck ripple — tapping a note on the fretboard sends a one-shot halo out from the dot, so a pluck reads as sound emanating.
- Smoother board changes — when you change key, chord or scale the fretboard dots now fade in with a quick left-to-right sweep instead of snapping, so a re-draw reads as a transition.
- Circle of fifths — picking a key now draws a connecting arc through the subdominant, tonic and dominant, turning the recolour into a visible harmonic relationship.
- All of the above is disabled automatically if your system prefers reduced motion, and the timing-bar controls were aligned to a common height so they stay tidy at any browser zoom.

## v1.17.0 — 2026-06-16

- New "Identify" view under Chords / Triads: tap the notes you are playing on the neck and the app names the chord — including the real alternatives (e.g. C6 and Am7 are the same notes) and slash chords when the bass note is not the root.
- When the notes don't fit any chord exactly, Identify now shows the closest matches instead of just "unknown" — naming the chord you are one or two notes away from and telling you which tone is missing or extra.
- The sidebar is now a live "Play over this" panel instead of a static table: for the chord you are looking at it shows the arpeggio and the scales that fit, and tapping a scale jumps you straight to it.

## v1.16.0 — 2026-06-16

- One fretboard instead of four: the chord-tones, triads, scale and notes views now share a single neck that just changes what it highlights, so switching views keeps the board steady in front of you.
- Fewer tabs: "Notes on the neck" moved from its own tab into a Notes view inside Scales (next to Scale), the same way Chords and Triads sit together under one tab.
- Tidier controls: the selectors above the neck were grouped into a more compact area.

## v1.15.0 — 2026-06-16

- Pick your key once and the whole app follows: choosing a root — or a key on the circle of fifths — now switches the chords, scales, circle and notes views together, instead of each tab keeping its own separate key.
- The circle of fifths is now tied to your current key: it always highlights the key you are in and its closest neighbours, and tapping any key on it sets that key everywhere.

## v1.14.0 — 2026-06-15

- The drums now have a backbeat: a snare lands on beats 2 and 4, so turning on Drums sounds like a real groove instead of a ticking pulse.
- Listen now plays at a fixed, comfortable speed no matter your tempo — so slowing the metronome down for practice no longer makes the preview crawl. Loop and progression Play still follow the tempo, since they are backings you play over.

## v1.13.0 — 2026-06-15

- Easier to use on phones: fretboard notes and buttons now have bigger touch targets, and tapping a note no longer triggers zoom or selects text.
- The interface accent is now a distinct teal, so a selected control is no longer the same blue as the "fifth" note on the fretboard.
- The fretboard now shows position-marker inlays on its face — single dots at frets 3·5·7·9 and a double at 12 — so you can orient at a glance.
- Chord and triad diagrams now print a suggested fingering (1–4) inside each dot.
- The neck fades at its right edge when more frets are scrollable off-screen, and the fret wires gained a subtle metallic sheen.

## v1.12.0 — 2026-06-15

- Chord diagrams now show every common way to play the chord — the open shape plus the E-shape and A-shape barre forms — instead of just one.
- Tap a voicing card to select it: Listen and Loop then play that exact shape in its real register, so an open chord and its barre version actually sound different.
- Chord-card dots are now live — click one to hear that string — and are coloured by their role in the chord (root, third, fifth…).
- Triads now have shape cards too, one per inversion, matching the chord view.
- You can finally loop a triad as a backing track, and Listen plays the inversion and string set you are actually looking at — with the bass following the triad’s correct fifth.
- Strums now sweep across the strings instead of sounding all at once.

## v1.11.0 — 2026-06-15

- Playback controls are clearer: Listen and Loop now sit together in the timing bar, so hearing the current chord once (Listen) and looping it as a backing (Loop) are one obvious pair.
- Loop now appears only on the chord-tones view where it applies; the transport chip is still there to stop playback from any tab.
- The fretboard fits phones: a windowed fret range now scales to the screen with no sideways scrolling — only the full "All frets" view still scrolls. It re-fits when you rotate.
- Sturdier on unusual browsers: if a browser has no audio support, the playback buttons are disabled with a note instead of doing nothing.

## v1.10.0 — 2026-06-14

- Backing now plays as a band: turn on Bass and Drums in the timing bar and the loop or progression becomes a jam-along bed for improvising over.
- A synthesized bass follows each chord — root on beat 1, the chord’s fifth on beat 3 — and sits cleanly under the guitar.
- An optional groove adds a kick on beats 1 and 3 with steady 8th-note hi-hats, accented on the downbeat.
- The guitar comping is more human now: small note-to-note changes in loudness and timing, plus a softer push on beat 3 when the band is on.
- Your Bass and Drums choices are remembered across reloads.

## v1.9.0 — 2026-06-14

- Playback timing was rebuilt on a precise audio clock, so the metronome, loop and progression no longer drift out of time — especially on phones and in background tabs.
- The tempo slider now glides smoothly while something is playing, instead of restarting the beat.
- The lit notes during the loop and progression now stay locked to the sound.
- Groundwork for the upcoming practice modes: separate internal audio channels and short correct / wrong / count-in cue sounds.

## v1.8.0 — 2026-06-14

- The guitar tone was reworked to sound more like a real instrument.
- Notes now ring through a body resonance, so they sound like they come from a guitar body rather than a bare synthesized string.
- Tuning is accurate across the whole neck — high notes no longer drift slightly flat.
- Plucking responds to dynamics: harder is louder and brighter, with subtle note-to-note variation so long loops feel less robotic.
- Low and high strings now have their own character — darker, longer-ringing bass and rounder treble.

## v1.7.0 — 2026-06-14

- Chord vocabulary expanded from 7 to 21 types — sus2/sus4, 6 and m6, m7♭5, dim7, add9, 9/maj9/m9, 11, 13, 7♭9 and the 7♯9 "Hendrix" chord.
- Extensions (6, 9, 11, 13) now have their own violet colour, and every tone is labelled by its true degree so a ♯9 reads as ♯9, not ♭3.
- Chord diagrams now generate a playable shape for every chord automatically, instead of showing "no simple shape" for the rarer ones.
- You can now tab to any note on the fretboard and play it with Enter or Space.
- On phones the frets are narrower and open in a 5-fret window, so the neck fits the screen better.
- The app now remembers your full working state across reloads — chord quality, scale and position, triad set and inversion, circle selection, the highlighted note, and your built progression.

## v1.6.0 — 2026-06-14

- Removed the subtitle tagline — the header is cleaner and the tabs sit higher.
- Added keyboard focus rings on every control and support for reduced-motion.
- Tabs now scroll sideways on phones instead of wrapping, plus a subtle hover on each tab.

## v1.5.0 — 2026-06-13

- Chord tones and Triads merged into one "Chords / triads" tab with a view toggle.
- Root and Notes/Intervals are now one shared bar across Harmony and Scales — pick a root once, it follows you.
- A single context-aware Play in the timing bar replaces the four separate Listen/Cadence buttons.

## v1.4.0 — 2026-06-13

- Loop and progression now keep playing when you switch tabs — backing-track mode.
- New transport in the timing bar shows what is playing and stops it from any tab.
- Added this changelog (tap the version badge any time).

## v1.3.0 — 2026-06-13

- Tempo and metronome moved to an always-visible timing bar.
- Settings now holds instrument options only — tuning, handedness, fret range.

## v1.2.0 — 2026-06-13

- Chord progression sequencer: presets, per-chord bar counts, board follows the active chord, cycle or once.

## v1.1.0 — 2026-06-13

- Single-chord background loop.

## v1.0.0 — 2026-06-13

- Initial release: chord tones, triads, scales and modes, circle of fifths, notes on the neck.

