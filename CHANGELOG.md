# Changelog

_Generated from `src/js/02-changelog.js` by `build.js` — do not edit by hand._

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

