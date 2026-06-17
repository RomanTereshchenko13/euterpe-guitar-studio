/* Build: assemble the shipped single-file app from editable sources.
   Concatenates src/js/*.js (alphabetical == intended order, files are
   zero-padded 01..12) into one <script>, inlines src/styles.css into <style>,
   and writes index.html. No bundler, no transpile — pure string assembly, so
   the output stays a zero-runtime-dependency single file.

   Run:  node build.js   (or: npm run build) */
'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;

const tpl = fs.readFileSync(path.join(root, 'src', 'index.template.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');

const jsDir = path.join(root, 'src', 'js');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
const js = jsFiles.map(f => fs.readFileSync(path.join(jsDir, f), 'utf8')).join('');

// APP_VERSION is the single source of truth: read it once and inject it into the
// header comment (@@VERSION@@) and the dist filename, so neither drifts from it.
const verMatch = js.match(/APP_VERSION\s*=\s*'([\d.]+)'/);
if (!verMatch) throw new Error('APP_VERSION not found in sources — cannot name versioned build');
const version = verMatch[1];

// Favicon: inline the guitar mark (src/icons/icon.svg) as a data URI so the
// single-file build stays self-contained (the dist copy has no sidecar files).
// The PNG/manifest icons are separate served files used by the installed PWA.
const iconSvg = fs.readFileSync(path.join(root, 'src', 'icons', 'icon.svg'), 'utf8').replace(/\n\s*/g, ' ').trim();
const favicon = 'data:image/svg+xml,' + encodeURIComponent(iconSvg);

// Function replacers: CSS/JS contain `$` (e.g. `${...}`), which a string
// replacement would mis-interpret as $-patterns. A function value is inserted verbatim.
const out = tpl
  .replace(/@@VERSION@@/g, () => version)
  .replace(/@@FAVICON@@/g, () => favicon)
  .replace('@@STYLES@@', () => css)
  .replace('@@SCRIPT@@', () => js);

// index.html: the stable entry point (GitHub Pages URL + what the test suite reads).
fs.writeFileSync(path.join(root, 'index.html'), out);

// sw.js: the service worker, generated from src/sw.template.js with the version
// baked into the cache name so every release busts the old offline cache.
const swTpl = fs.readFileSync(path.join(root, 'src', 'sw.template.js'), 'utf8');
fs.writeFileSync(path.join(root, 'sw.js'), swTpl.replace(/@@VERSION@@/g, () => version));

// Publish the icon SVG to the served icons/ dir (the manifest + SW reference
// icons/icon.svg). It's the same editable source used for the favicon and the
// PNG icons (tools/make-icons.js); copying it on every build keeps it in sync
// and present in CI. The raster PNGs are generated separately and committed.
fs.copyFileSync(path.join(root, 'src', 'icons', 'icon.svg'), path.join(root, 'icons', 'icon.svg'));

// Versioned standalone copy for file-based sharing / archival. It travels with
// no sidecar files, so strip the served-only <link>s (manifest + apple-touch
// icon) that would otherwise 404 when opened directly. The favicon stays — it's
// an inlined data URI — and 14-pwa.js self-disables on file://, so this copy is
// fully self-contained.
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });
const versioned = 'guitar-studio-v' + version + '.html';
const standalone = out
  .replace(/<link rel="manifest" href="manifest\.webmanifest">\r?\n/, '')
  .replace(/<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">\r?\n/, '');
fs.writeFileSync(path.join(distDir, versioned), standalone);

// CHANGELOG.md: a human-facing changelog generated from the same CHANGELOG array
// that powers the in-app "What's new" modal, so the two never drift. English
// bullets only (the modal localizes; the repo doc is English).
const changelogSrc = fs.readFileSync(path.join(jsDir, '02-changelog.js'), 'utf8');
const arrMatch = changelogSrc.match(/=\s*(\[[\s\S]*\]);/);
if (!arrMatch) throw new Error('could not locate CHANGELOG array in 02-changelog.js');
const CHANGELOG = new Function('return ' + arrMatch[1])();
let md = '# Changelog\n\n' +
  '_Generated from `src/js/02-changelog.js` by `build.js` — do not edit by hand._\n\n';
CHANGELOG.forEach(rel => {
  md += '## v' + rel.v + ' — ' + rel.date + '\n\n';
  rel.en.forEach(b => { md += '- ' + b + '\n'; });
  md += '\n';
});
fs.writeFileSync(path.join(root, 'CHANGELOG.md'), md);

console.log('Built from styles.css + ' + jsFiles.length + ' JS modules:');
jsFiles.forEach(f => console.log('  src/js/' + f));
console.log('Wrote index.html, sw.js, dist/' + versioned + ', and CHANGELOG.md');
