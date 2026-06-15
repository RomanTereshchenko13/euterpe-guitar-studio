# Guitar Studio (Гітарна студія)

A guitar theory and practice app — scales, modes, chords, triads, the circle of
fifths, and fretboard visualisation, with a Karplus-Strong audio engine and a
jam-along backing band. Bilingual UI (Ukrainian / English).

**The shipped app is one file: [`index.html`](./index.html)** — zero runtime
dependencies, runs entirely offline, opening it in a browser *is* running the
app. That file is **generated** from editable sources under [`src/`](./src/) by
a tiny pure-string [`build.js`](./build.js) (no bundler, no transpile). The split
keeps each concern in its own small module for editing; the build reassembles
them so the deployable stays a single zero-dependency file.

## Run

Open `index.html` in any modern browser. That's it — no server, no install.

## Edit & build

Edit the sources under `src/` (CSS in `src/styles.css`, JS modules in
`src/js/NN-*.js`, markup in `src/index.template.html`), then regenerate the
shipped file:

```bash
node build.js      # or: npm run build
```

`build.js` concatenates `src/js/*.js` (alphabetical = intended order; files are
zero-padded `01`..`13`) into one `<script>`, inlines `src/styles.css`, and writes
two identical files: `index.html` (the stable, committed entry point that GitHub
Pages serves) and a versioned copy `dist/guitar-studio-vX.Y.Z.html` (name taken
automatically from `APP_VERSION`) for file-based sharing or archiving a specific
release. `dist/` is gitignored — it's a local, build-on-demand convenience, not
published. The committed `index.html` must always match the sources — `npm test`
rebuilds first (`pretest`) so CI catches a stale commit.

## Deploy

`index.html` is the deployable artifact. On GitHub Pages, serve the repo root;
the app loads as static files. Rebuild before committing so the published file
reflects the latest sources.

## Test

The release gate is a headless [jsdom](https://github.com/jsdom/jsdom) suite.
`jsdom` is a **dev-only** dependency — nothing in the shipped file depends on it.

```bash
cd tests
npm install      # installs jsdom (dev only)
npm test         # boots index.html headless, runs ~140 checks
```

Or from the repo root, `npm test` rebuilds `index.html` from `src/` first, then
runs the suite — so the gate always tests freshly-built output.

`npm test` exits non-zero on any failure, so it works as a CI gate. The
[GitHub Action](./.github/workflows/test.yml) runs it on every push and PR. See
[`tests/README.md`](./tests/README.md) for what the suite covers.

## Versioning

The single source of truth for the version is `APP_VERSION` in
[`src/js/01-version.js`](./src/js/01-version.js) (mirrored into the built
`<meta name="version">` tag, the header comment, and the in-app changelog — tap
the version badge to view it). `build.js` reads it to name the `dist/` copy. The
stable `index.html` carries no version in its name; releases are also marked with
git tags. Release notes live once in
[`src/js/02-changelog.js`](./src/js/02-changelog.js) (localized EN/UK, drives the
in-app modal); `build.js` regenerates [`CHANGELOG.md`](./CHANGELOG.md) from its
English bullets, so the two never drift:

```bash
git tag v1.11.0 && git push --tags
```

The currently shipping version is recorded at the top of
[`ROADMAP.md`](./ROADMAP.md).

## Layout

```
guitar-studio/
├── index.html              the app (generated, committed; stable URL, zero-dependency)
├── dist/                   generated versioned copies (gitignored; built on demand)
├── build.js                assembles index.html + dist/ + CHANGELOG.md from src/
├── CHANGELOG.md             generated from src/js/02-changelog.js (do not hand-edit)
├── package.json            build + test scripts
├── src/                    editable sources (the things you change)
│   ├── index.template.html markup shell with @@STYLES@@ / @@SCRIPT@@ markers
│   ├── styles.css          all CSS
│   └── js/                 ordered modules (01-version, 02-changelog … 13-wiring-init)
├── README.md               this file
├── ROADMAP.md              phased plan; current shipping version at the top
├── .gitignore
├── .github/workflows/
│   └── test.yml            CI: runs the smoke suite on push/PR
└── tests/                  dev-only test harness
    ├── package.json
    ├── package-lock.json   committed for reproducible CI
    ├── smoke.js            the suite
    └── README.md           what it covers
```

## Architecture notes

- Authored as small modules under `src/`; `build.js` concatenates them into a
  single-file `index.html`. The shipped file is still plain HTML/CSS/JS with the
  only external resource being Google Fonts.
- Web Audio API: Karplus-Strong synthesis, body-resonance EQ, compressor +
  convolution reverb, a lookahead scheduler for drift-free timing, and named
  buses (backing / lead-target / cue) plus a synthesized backing band.
- `localStorage` persists the full working state across reloads.
- All new UI strings need symmetric Ukrainian + English entries (enforced by the
  test harness).
