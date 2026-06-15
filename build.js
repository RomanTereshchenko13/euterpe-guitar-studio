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

// Function replacers: CSS/JS contain `$` (e.g. `${...}`), which a string
// replacement would mis-interpret as $-patterns. A function value is inserted verbatim.
const out = tpl
  .replace('@@STYLES@@', () => css)
  .replace('@@SCRIPT@@', () => js);

// index.html: the stable entry point (GitHub Pages URL + what the test suite reads).
fs.writeFileSync(path.join(root, 'index.html'), out);

// Versioned copy (identical bytes) for file-based sharing / archival. The version
// is read from APP_VERSION so the name follows releases with no manual rename.
const verMatch = js.match(/APP_VERSION\s*=\s*'([\d.]+)'/);
if (!verMatch) throw new Error('APP_VERSION not found in sources — cannot name versioned build');
const version = verMatch[1];
const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });
const versioned = 'guitar-studio-v' + version + '.html';
fs.writeFileSync(path.join(distDir, versioned), out);

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
console.log('Wrote index.html, dist/' + versioned + ', and CHANGELOG.md');
