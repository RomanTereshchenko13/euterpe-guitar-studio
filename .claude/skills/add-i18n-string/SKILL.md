---
name: add-i18n-string
description: Add or change a user-facing UI string in Euterpe with paired Ukrainian + English entries. Use when adding a label, button, heading, hint, or any visible text, or when the smoke test fails on an unpaired/missing i18n key.
---

# Add a UI string (UK + EN, symmetric)

Every user-facing string lives in `src/js/03-i18n.js` in the `I18N` object, which
has two parallel blocks: `uk` (Ukrainian) and `en` (English). **The smoke suite
fails if a key exists in one block but not the other** — symmetry is enforced.

## Rules

1. **Add the key to BOTH `uk` and `en`.** Same key, same meaning. An unpaired key
   = failing test.
2. **Write a real Ukrainian translation**, not a placeholder or machine output.
   Match the tone of the surrounding strings (informal "ти", musical terminology
   already used in the file — гриф, лад, тоніка, квінта, …).
3. **Follow the key-naming convention** — short, grouped-by-feature prefixes
   already in the file: `tab_*`, `view_*`, `lbl_*`, `cof_*` (circle of fifths),
   `ch_*` (chords), `tr_*` (triads), `arp_*`, `leg_*` (legend), `shape_*` (full chord · triads),
   `b_*` (buttons). Reuse an existing key if one already fits.
4. Place the new key near its feature group in **both** blocks so they stay
   parallel and easy to diff.

## Steps

1. Add the key + value in the `uk` block and the `en` block of
   `src/js/03-i18n.js`.
2. Reference it from the rendering code the same way neighbouring strings are
   looked up (find an existing use of a sibling key and mirror it).
3. Rebuild and test:
   ```bash
   node build.js
   npm test
   ```
   A green suite confirms the pair is symmetric and wired in.

## Example

```js
// in uk:
b_open_harmony:'Відкрити в акордах',
// in en:
b_open_harmony:'Open in chords',
```
