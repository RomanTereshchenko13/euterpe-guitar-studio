# Euterpe

A guitar theory and practice app — scales, modes, chords, triads, the circle of
fifths, and fretboard visualisation, with a Karplus-Strong audio engine and a
jam-along backing band. Bilingual UI (Ukrainian / English). Named after
**Euterpe**, the Greek muse of music.

**The app is one file: [`index.html`](./index.html)** — zero runtime
dependencies, runs entirely offline, opening it in a browser *is* running the
app. That file is **generated** from editable sources under [`src/`](./src/) by
a tiny pure-string [`build.js`](./build.js) (no bundler, no transpile). The split
keeps each concern in its own small module for editing; the build reassembles
them so the core stays a single zero-dependency file.

When **served over HTTPS** (e.g. GitHub Pages) it also behaves as an installable
[PWA](#install-pwa): a web-app manifest + service worker add a home-screen/desktop
icon, its own window, and offline caching. These are a thin, additive layer of
sidecar files (`manifest.webmanifest`, `sw.js`, `icons/`) alongside `index.html`
— the app itself is still the single file, and the double-clicked `file://` /
`dist/` copy works exactly as before (the PWA layer is simply dormant there).

## Run

Open `index.html` in any modern browser. That's it — no server, no install.

<a name="install-pwa"></a>
### Install (PWA)

From the **hosted** (HTTPS) build, install it like an app:

- **Desktop (Chrome/Edge):** the install icon in the address bar, or menu → *Install*.
- **Android (Chrome):** menu → *Add to Home screen* / *Install app*.
- **iOS (Safari):** Share → *Add to Home Screen*.

Installed, it opens in its own window and works with no connection. The service
worker (`sw.js`) precaches the app shell + icons; its cache name is stamped with
`APP_VERSION`, so each release automatically supersedes the old offline cache.

> The service worker needs an HTTPS (or `localhost`) origin, so install/offline
> only apply to the hosted copy — a double-clicked `file://` `index.html` runs
> normally but without the PWA layer.

### Icons

The icon is authored once as [`src/icons/icon.svg`](./src/icons/icon.svg) (a
guitar inside a Greek-key border — a nod to the muse Euterpe). `build.js` inlines
it as the favicon and copies it to `icons/icon.svg`; the raster PNGs the manifest
and iOS need are generated from it with **system Edge/Chrome headless** (no npm
install, like `tools/shoot.js`):

```bash
node tools/make-icons.js   # regenerate icons/*.png after editing src/icons/icon.svg
```

## Edit & build

Edit the sources under `src/` (CSS in `src/styles.css`, JS modules in
`src/js/NN-*.js`, markup in `src/index.template.html`), then regenerate the
shipped file:

```bash
node build.js      # or: npm run build
```

`build.js` concatenates `src/js/*.js` (alphabetical = intended order; files are
zero-padded `01`..`15`) into one `<script>`, inlines `src/styles.css` and the
favicon, and writes `index.html` (the stable, committed entry point that GitHub
Pages serves) plus a versioned copy `dist/guitar-studio-vX.Y.Z.html` (name taken
automatically from `APP_VERSION`) for file-based sharing or archiving a specific
release. It also emits the service worker `sw.js` from
[`src/sw.template.js`](./src/sw.template.js) (stamping `APP_VERSION` into the
cache name) and copies `src/icons/icon.svg` to the served `icons/icon.svg`. `dist/` is gitignored — it's a local, build-on-demand convenience, not
published. The committed `index.html` must always match the sources — `npm test`
rebuilds first (`pretest`) so CI catches a stale commit.

## Deploy

`index.html` is the primary artifact; the PWA adds a few static sidecars
(`manifest.webmanifest`, `sw.js`, `icons/`). On GitHub Pages, serve the repo
root; everything loads as static files. GitHub Pages is a natural fit: it's
HTTPS (required for the service worker) and same-origin. All PWA paths are
**relative**, so it works whether Pages serves from a domain root or a project
subpath (`https://<you>.github.io/guitar-studio/`). Rebuild before committing so
the published files reflect the latest sources.

## Test

The release gate is a headless [jsdom](https://github.com/jsdom/jsdom) suite.
`jsdom` is a **dev-only** dependency — nothing in the shipped file depends on it.

```bash
cd tests
npm install      # installs jsdom (dev only)
npm test         # boots index.html headless, runs 270+ checks
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
├── manifest.webmanifest    PWA manifest (name, icons, standalone display)
├── sw.js                   service worker (generated from src/sw.template.js)
├── icons/                  served icon assets: icon.svg (copied) + generated PNGs
├── dist/                   generated versioned copies (gitignored; built on demand)
├── build.js                assembles index.html + sw.js + dist/ + CHANGELOG.md from src/
├── CHANGELOG.md             generated from src/js/02-changelog.js (do not hand-edit)
├── package.json            build + test scripts
├── src/                    editable sources (the things you change)
│   ├── index.template.html markup shell with @@STYLES@@ / @@SCRIPT@@ / @@FAVICON@@ markers
│   ├── styles.css          all CSS
│   ├── sw.template.js      service-worker source (@@VERSION@@ → cache name)
│   ├── icons/icon.svg      the app icon, authored once (favicon + PNG source)
│   └── js/                 ordered modules (01-version, 02-changelog … 16-pwa)
├── README.md               this file
├── ROADMAP.md              phased plan; current shipping version at the top
├── .gitignore
├── tools/
│   ├── shoot.js            dev-only responsive screenshots (system Edge/Chrome)
│   ├── scroll-check.js     dev-only headless scroll/sticky-header regression check
│   ├── kbd-check.js        dev-only headless keyboard-shortcut functional check
│   └── make-icons.js       dev-only icon PNG rasterizer (system Edge/Chrome)
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
  single-file `index.html`. The core is still plain HTML/CSS/JS; the only
  external resource it *fetches* is Google Fonts.
- PWA layer (additive, hosted-only): `manifest.webmanifest` + a service worker
  (`sw.js`, generated from `src/sw.template.js`) make it installable and
  offline-first. The SW precaches the app shell + icons (cache-first, with the
  cached `index.html` served for navigations) and runtime-caches Google Fonts.
  Registration ([`src/js/16-pwa.js`](./src/js/16-pwa.js)) is guarded to a no-op
  off HTTPS, so `file://` and the jsdom tests are unaffected.
- Web Audio API: Karplus-Strong synthesis, body-resonance EQ, compressor +
  convolution reverb, a lookahead scheduler for drift-free timing, and named
  buses (backing / lead-target / cue) plus a synthesized backing band.
- `localStorage` persists the full working state across reloads.
- All new UI strings need symmetric Ukrainian + English entries (enforced by the
  test harness).
