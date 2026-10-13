---
name: visual-review
description: Screenshot Euterpe across the orientation/size matrix and review the PNGs for layout problems. Use after CSS or markup changes, when asked for a visual pass, layout review, responsive/landscape check, or "how does it look". This is the manual AI step the pre-commit hook only nudges about.
---

# Visual / orientation review

The pre-commit hook deliberately leaves visual review to a human/AI — this skill
*is* that step. Render the app across a real viewport matrix, then look at every
PNG and report layout problems.

## 1. Build first

The screenshot tools read the built `index.html`:

```bash
node build.js
```

## 2. Shoot the matrix

```bash
node tools/shoot.js tabs 390x844 844x390 360x740 768x1024 1024x768 1280x800 1920x1080
```

- Each `WxH` is a **real viewport**, so shape-based shells fire (landscape phone =
  `max-width:940 & max-height:500`).
- The `tabs` token captures **both tabs** (harmony / scales) per
  size → `tools/shots/w{W}-{panel}.png`.
- Watch the command output for any **HORIZONTAL OVERFLOW** flag — that's a hard
  fail, note the viewport.

## 3. Review every PNG

Read each file in `tools/shots/` (the Read tool renders images). For each
viewport × tab, check:

- **Overflow** — anything clipped or pushed past the viewport width.
- **Landscape parity** — landscape (`844x390`) should match portrait: same
  compact colour key, chord-shapes card stays beside the neck (not dumped at the
  page bottom).
- **Fretboard priority** — on desktop the neck stays full-width; side panels
  must not shrink it.
- **Condensing header** — no control stranded mid-row, no flip-flop.
- **Crowding/legibility** — controls, legends, chord rows readable at each size.

## 4. Optional regression checks

For header/scroll or keyboard behaviour, also run the headless checks (these exit
non-zero on failure):

```bash
node tools/scroll-check.js 390x740 390x1100
node tools/kbd-check.js
```

## 5. Report

List findings **per viewport and tab** with the PNG filename, severity, and a
concrete fix. If everything is clean, say so explicitly per size. The PNGs in
`tools/shots/` are throwaway.
