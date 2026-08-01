/* Dev-only static-analysis gate. Concatenates src/js/*.js in the SAME order
   build.js uses and lints the result as ONE shared script scope, then maps every
   finding back to its real src/js file:line. Modelling the single concatenated
   scope is the whole point: it makes `no-undef`, `no-redeclare`, `no-unused-vars`
   and `no-use-before-define` see cross-file references the way the shipped app
   does — the bug class the jsdom suite can't reach.

   No bundled browser, nothing added to the shipped app. ESLint + globals are
   dev-only devDependencies (same status as jsdom in tests/).

   Run:  npm run lint          (exits non-zero on any error) */
'use strict';
const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

const root = path.join(__dirname, '..');
const jsDir = path.join(root, 'src', 'js');
const concatPath = path.join(__dirname, '.eslint-concat.js');   // gitignored scratch

// Same selection + order as build.js: zero-padded NN-*.js, alphabetical.
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();

// Build the concatenation while recording the concat line each file starts on,
// so a reported line can be mapped back to "src/js/NN-foo.js:localLine".
let out = '';
let newlines = 0;          // newlines written so far == lines fully emitted
const map = [];            // { startLine, rel } per source file, ascending
const countNl = s => (s.match(/\n/g) || []).length;

for (const f of jsFiles) {
  const rel = path.posix.join('src/js', f);
  const banner = `/* ===== ${rel} ===== */\n`;
  out += banner; newlines += countNl(banner);
  map.push({ startLine: newlines + 1, rel });
  let content = fs.readFileSync(path.join(jsDir, f), 'utf8');
  if (!content.endsWith('\n')) content += '\n';   // keep file boundaries on line breaks
  out += content; newlines += countNl(content);
}
fs.writeFileSync(concatPath, out);

// Map a concat line number back to its source file + local line.
function locate(concatLine) {
  let hit = map[0];
  for (const m of map) { if (m.startLine <= concatLine) hit = m; else break; }
  return { rel: hit.rel, line: concatLine - hit.startLine + 1 };
}

/* ---------------------------------------------------------------------------
   Dead-resource checks. ESLint sees unused *bindings*; it can't see a
   translation key or a CSS class nobody references, because those are strings.
   That's the drift this catches: merging or removing a feature reliably leaves
   orphans behind (the 5c/6a and 5b/5d merges left 7 dead i18n keys and a dead
   .btn.co-prog rule, and the smoke suite was actively pinning two of them).

   Dynamic lookups are the tricky part — `t('qg_'+g)` and `t(head+'_h')` build
   keys at runtime. Rather than hand-maintaining an allowlist that goes stale,
   we harvest the literal fragments that flank a `+` inside a t(...) call and
   treat them as prefixes/suffixes: any key matching one counts as used. Same
   trick for class names assembled as `'ear-'+type`.
   --------------------------------------------------------------------------- */
const tplPath = path.join(root, 'src', 'index.template.html');
const cssPath = path.join(root, 'src', 'styles.css');
const I18N_FILE = '03-i18n.js';

// keys declared in a given `uk:{...}` / `en:{...}` block of 03-i18n.js
function i18nBlock(src, name) {
  const at = src.search(new RegExp('\\b' + name + '\\s*:\\s*\\{'));
  if (at < 0) return null;
  let depth = 0, i = src.indexOf('{', at);
  const start = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return src.slice(start, i);
}
function blockKeys(block) {
  const keys = new Set();
  // a key sits at the start of the file/line or right after `,` — never inside a
  // value string, which is what a naive /\w+:/ would happily match.
  const re = /(?:^|[{,])\s*([A-Za-z_]\w*)\s*:/gm;
  let m;
  while ((m = re.exec(block))) keys.add(m[1]);
  return keys;
}

function deadResourceReport() {
  const problems = [];
  const i18nSrc = fs.readFileSync(path.join(jsDir, I18N_FILE), 'utf8');
  const tpl = fs.existsSync(tplPath) ? fs.readFileSync(tplPath, 'utf8') : '';
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  const otherJs = jsFiles.filter(f => f !== I18N_FILE)
    .map(f => fs.readFileSync(path.join(jsDir, f), 'utf8')).join('\n');
  const hay = otherJs + '\n' + tpl;

  /* ---- error-handling guardrail: no silent swallows. Lives here rather than in
     the smoke suite because it's a rule about how src/ is written — the bundle
     ships comment-stripped, so the explanatory comment that satisfies the rule
     isn't visible in the built file any more.

     `catch(_){}` is the codebase's deliberate-swallow marker and stays allowed;
     an empty catch under any other binding is the accidental kind. */
  jsFiles.forEach(f => {
    const lines = fs.readFileSync(path.join(jsDir, f), 'utf8').split('\n');
    lines.forEach((ln, k) => {
      const m = ln.match(/catch\s*\(\s*(\w+)\s*\)\s*\{\s*\}/);
      if (m && m[1] !== '_')
        problems.push(`src/js/${f}:${k + 1} silent catch(${m[1]}){} — explain it, or use catch(_){} to mark it deliberate`);
    });
  });

  // ---- i18n symmetry (the smoke suite enforces it too; failing here is faster)
  const uk = i18nBlock(i18nSrc, 'uk'), en = i18nBlock(i18nSrc, 'en');
  if (uk && en) {
    const a = blockKeys(uk), b = blockKeys(en);
    [...a].filter(k => !b.has(k)).forEach(k => problems.push(`i18n key '${k}' exists in uk but not en`));
    [...b].filter(k => !a.has(k)).forEach(k => problems.push(`i18n key '${k}' exists in en but not uk`));
  }

  // ---- unreferenced i18n keys
  // literal fragments flanking a `+` inside t(...) => dynamic prefixes / suffixes
  const dynPrefix = [...otherJs.matchAll(/\bt\(\s*'([A-Za-z_]\w*)'\s*\+/g)].map(m => m[1]);
  const dynSuffix = [...otherJs.matchAll(/\+\s*'(\w+)'\s*\)/g)].map(m => m[1]);
  const keys = uk ? blockKeys(uk) : new Set();
  const usedKey = k =>
    new RegExp(`(['"\`])${k}\\1`).test(hay) ||
    new RegExp(`data-i18n=["']${k}["']`).test(tpl) ||
    dynPrefix.some(p => k.startsWith(p)) ||
    dynSuffix.some(s => k.endsWith(s));
  [...keys].filter(k => !usedKey(k)).sort()
    .forEach(k => problems.push(`i18n key '${k}' is never referenced (dead string in both languages)`));

  // ---- unreferenced CSS classes
  // selector text only: blank out declaration blocks so property values can't
  // masquerade as selectors.
  const selectorText = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^{}]*\}/g, '{}');
  const classes = new Set([...selectorText.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]));
  // class names built by concatenation, e.g. `'ear-'+ear.type` or `'pp-'+kind`
  const dynClass = [...otherJs.matchAll(/'([a-zA-Z][\w-]*-)'\s*\+/g)].map(m => m[1]);
  const usedClass = c =>
    new RegExp(`(^|[^\\w-])${c.replace(/-/g, '\\-')}([^\\w-]|$)`).test(hay) ||
    dynClass.some(p => c.startsWith(p));
  [...classes].filter(c => !usedClass(c)).sort()
    .forEach(c => problems.push(`CSS class '.${c}' is styled but never applied in markup or JS`));

  return problems;
}

(async () => {
  try {
    const eslint = new ESLint({ cwd: root });
    const results = await eslint.lintFiles([concatPath]);
    const msgs = results[0] ? results[0].messages : [];

    let errors = 0, warnings = 0;
    const byFile = new Map();
    for (const m of msgs) {
      const { rel, line } = locate(m.line);
      if (!byFile.has(rel)) byFile.set(rel, []);
      byFile.get(rel).push({ line, col: m.column, sev: m.severity, ruleId: m.ruleId, message: m.message });
      if (m.severity === 2) errors++; else warnings++;
    }

    const dead = deadResourceReport();
    errors += dead.length;

    if (msgs.length === 0 && dead.length === 0) {
      console.log(`lint: clean — ${jsFiles.length} modules linted as one scope, no dead strings.`);
    } else {
      for (const [rel, list] of byFile) {
        console.log('\n' + rel);
        list.sort((a, b) => a.line - b.line || a.col - b.col);
        for (const m of list) {
          const tag = m.sev === 2 ? 'error  ' : 'warning';
          console.log(`  ${String(m.line).padStart(4)}:${m.col}  ${tag}  ${m.message}  ${m.ruleId || ''}`);
        }
      }
      if (dead.length) {
        console.log('\ndead resources (src/js/03-i18n.js · src/styles.css)');
        dead.forEach(p => console.log(`  error    ${p}`));
      }
      console.log(`\nlint: ${errors} error(s), ${warnings} warning(s).`);
    }

    fs.unlinkSync(concatPath);
    process.exit(errors > 0 ? 1 : 0);
  } catch (err) {
    try { fs.unlinkSync(concatPath); } catch { /* already gone */ }
    console.error('lint: failed to run —', err.message);
    process.exit(2);
  }
})();
