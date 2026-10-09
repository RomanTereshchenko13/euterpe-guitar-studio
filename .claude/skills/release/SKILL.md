---
name: release
description: Ship a new Euterpe version. Use when asked to release, cut a version, bump the version, publish a build, or tag a release. Handles APP_VERSION, the EN+UK changelog entry, build/lint/test, PLAN.md version line, and the git tag.
---

# Release a new Euterpe version

Cut a release the safe way. `APP_VERSION` in `src/js/01-version.js` is the **single
source of truth** — everything else (generated `index.html`, `sw.js` cache name,
`CHANGELOG.md`) is stamped from `src/` by `build.js`. Never hand-edit generated files.

## 1. Decide the bump

- **Patch** (1.27.2 → 1.27.3): polish, fixes, small tweaks. This is the default.
- **Minor** (1.27.2 → 1.28.0): a new user-facing feature.
- Major: only on the user's explicit call.

When unsure, prefer patch — see the project's "small changes = patch" rule.

## 2. Edit the sources (never the generated files)

1. `src/js/01-version.js` — set `APP_VERSION` to the new version.
2. `src/js/02-changelog.js` — add a **new entry at the top** of the `CHANGELOG`
   array (newest first):
   ```js
   { v:'X.Y.Z', date:'YYYY-MM-DD',
     en:['User-facing bullet describing the change in plain language.'],
     uk:['Те саме українською — справжній переклад, не машинний.'] },
   ```
   - `date` = today.
   - **`en` and `uk` arrays must have the same number of bullets** and say the
     same thing. Write for users (what changed for them), not commits.
3. `PLAN.md` — update the `_Shipping: vX.Y.Z_` line at the top.
4. `package.json` deliberately has **no** `version` field (the package is private and
   never published) — don't add one; `APP_VERSION` is the only version.

## 3. Build + verify

```bash
node build.js     # regenerates index.html, sw.js, CHANGELOG.md, dist/
npm run lint      # src/js as one concatenated scope
npm test          # rebuilds (pretest) then runs the jsdom smoke suite
```

All three must pass. If `npm test` flags an unpaired i18n key, you added a string
without its EN/UK twin — fix it (see the `add-i18n-string` skill).

Consider a visual pass if styles/markup changed (see the `visual-review` skill).

## 4. Commit + tag

Only commit when the release is the user's explicit ask (it is, here). Stage both
the edited `src/` files **and** the regenerated `index.html` / `sw.js` /
`CHANGELOG.md` so the committed artifacts match a fresh build.

```bash
git add -A
git commit          # message: "vX.Y.Z: <one-line summary>"
git tag vX.Y.Z
git push && git push --tags
```

End the commit message with the standard `Co-Authored-By` trailer.

## Done

Report: version, bump type, the one-line changelog summary, test/lint status, and
the tag pushed.
