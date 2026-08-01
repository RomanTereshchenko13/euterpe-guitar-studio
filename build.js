/* Build: assemble the shipped single-file app from editable sources.
   Concatenates src/js/*.js (alphabetical == intended order, files are
   zero-padded 01..14) into one <script>, inlines src/styles.css into <style>,
   and writes index.html. No bundler, no transpile — pure string assembly, so
   the output stays a zero-runtime-dependency single file.

   Run:  node build.js   (or: npm run build) */
'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;

/* ---------------------------------------------------------------------------
   Comment stripping for the SHIPPED bundle only.

   src/ is where the explanations live and they stay there untouched — but they
   were also ~22% of the JS and ~28% of the CSS in index.html, i.e. a fifth of
   what every visitor downloads is commentary addressed to whoever edits src/.

   Both strippers are real character scanners, not regexes: a regex that hunts
   for `/*` happily corrupts "https://…" inside a string, a `/regex/` literal,
   or `content: "/*"` in CSS. The JS scanner tracks strings, template literals
   (including nested `${}`), and regex literals; the CSS scanner tracks strings.

   Belt and braces: stripJs output is syntax-checked before it's used, and the
   build falls back to the untouched source if the check fails. A bug in the
   scanner can cost bytes; it can't ship a broken app.
   --------------------------------------------------------------------------- */

// `/` starts a regex literal only when the previous significant token can't end
// an expression. Anything else (identifier, number, `)`, `]`) means division.
function regexCanFollow(prev) {
  if (!prev) return true;
  if (/[\w$)\]]/.test(prev)) return false;
  return true;
}

function stripJs(src) {
  const n = src.length;
  let out = '';
  const literal = [];        // literal[k] = out[k] belongs to a string/template/regex
  const push = (s, isLiteral) => { out += s; for (let k = 0; k < s.length; k++) literal.push(isLiteral); };

  // `templates` holds, for each template literal we're inside an interpolation of,
  // the brace depth its `${` opened at — so the matching `}` resumes the template.
  const templates = [];
  let mode = 'code', braceDepth = 0, prev = '', i = 0;

  while (i < n) {
    if (mode === 'template') {
      let j = i;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '`') { j++; mode = 'code'; prev = '`'; break; }
        if (src[j] === '$' && src[j + 1] === '{') {
          j += 2; templates.push(braceDepth); braceDepth++;
          mode = 'code'; prev = '{'; break;
        }
        j++;
      }
      push(src.slice(i, j), true);
      i = j;
      continue;
    }

    const c = src[i], c2 = src[i + 1];

    if (c === '/' && c2 === '/') {                       // line comment
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && c2 === '*') {                       // block comment
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {                        // quoted string
      const q = c; let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === q) { j++; break; }
        j++;
      }
      push(src.slice(i, j), true); prev = q; i = j; continue;
    }
    if (c === '`') {                                     // template literal opens
      push(c, true); i++; mode = 'template'; continue;
    }
    if (c === '}' && templates.length && braceDepth - 1 === templates[templates.length - 1]) {
      templates.pop(); braceDepth--;                     // interpolation closes
      push(c, true); i++; mode = 'template'; continue;
    }
    if (c === '/' && regexCanFollow(prev)) {             // regex literal
      let j = i + 1, inClass = false, closed = false;
      while (j < n) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;                           // unterminated => it was division
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) { j++; closed = true; break; }
        j++;
      }
      if (closed) {
        while (j < n && /[a-z]/.test(src[j])) j++;        // flags
        push(src.slice(i, j), true); prev = '/'; i = j; continue;
      }
    }
    if (c === '{') braceDepth++;
    else if (c === '}') braceDepth--;
    push(c, false);
    if (!/\s/.test(c)) prev = c;
    i++;
  }

  // Comments leave whitespace-only lines behind. Drop such a line only when none
  // of its characters came from a literal, so a blank line inside a template
  // literal (which is real output) is never touched.
  const kept = [];
  let start = 0;
  for (let k = 0; k <= out.length; k++) {
    if (k !== out.length && out[k] !== '\n') continue;
    const text = out.slice(start, k);
    let pureCode = true;
    for (let q = start; q < k; q++) if (literal[q]) { pureCode = false; break; }
    if (!(pureCode && /^[ \t]*$/.test(text))) kept.push(text);
    start = k + 1;
  }
  return kept.join('\n');
}

function stripCss(src) {
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === q) { j++; break; }
        j++;
      }
      out += src.slice(i, j); i = j; continue;
    }
    out += c; i++;
  }
  // collapse the blank lines the comments left behind
  return out.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n');
}

// Compiling the body validates syntax without running a line of it.
function parsesAsScript(code) {
  try { new Function(code); return true; } catch (e) { return false; }
}

const tpl = fs.readFileSync(path.join(root, 'src', 'index.template.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');

const jsDir = path.join(root, 'src', 'js');
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();

// The changelog is the single source of truth for BOTH the in-app modal and
// CHANGELOG.md, so it's parsed once here and consumed twice below.
const changelogSrc = fs.readFileSync(path.join(jsDir, '02-changelog.js'), 'utf8');
const arrMatch = changelogSrc.match(/=\s*(\[[\s\S]*\]);/);
if (!arrMatch) throw new Error('could not locate CHANGELOG array in 02-changelog.js');
const CHANGELOG = new Function('return ' + arrMatch[1])();

// …but only the newest few releases ship in the bundle. The full history was
// 15% of index.html — release notes nobody scrolls back through, downloaded by
// every visitor. CHANGELOG.md (written below) still gets all of it, and the
// modal links there. Keep this >= 1 so the current version always has an entry.
const CHANGELOG_KEEP = 5;
const changelogJs = 'const CHANGELOG = ' + JSON.stringify(CHANGELOG.slice(0, CHANGELOG_KEEP)) + ';\n';

const jsRaw = jsFiles
  .map(f => (f === '02-changelog.js' ? changelogJs : fs.readFileSync(path.join(jsDir, f), 'utf8')))
  .join('');

// Strip comments for the bundle, but only if the result still compiles — a
// scanner bug must degrade to "shipped the comments", never to a broken app.
const jsStripped = stripJs(jsRaw);
const jsOk = parsesAsScript(jsStripped);
if (!jsOk) console.warn('build: comment-stripped JS failed its syntax check — shipping the unstripped source.');
const js = jsOk ? jsStripped : jsRaw;
const cssOut = stripCss(css);

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
  .replace('@@STYLES@@', () => cssOut)
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
// bullets only (the modal localizes; the repo doc is English). Unlike the
// bundle, this gets the FULL history — it costs the visitor nothing.
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
