/* =============================================================================
   Euterpe — compatibility suite: real saves from past releases
   -----------------------------------------------------------------------------
   Run with:  npm test   (after smoke.js)   or:  node compat.js ../index.html

   tests/fixtures/*.json were written by the old releases themselves
   (tools/capture-fixtures.js boots each one out of git and lets it save). For each:
     1. the current build boots on that save without a page error;
     2. it shows what the old build showed (`seen`), apart from the migrations listed
        in MIGRATED, and the DOM agrees with the state it restored;
     3. every key the old build saved is still saved, or is listed in RETIRED;
     4. save → load is lossless: a second boot on what the first one saved restores the
        same state, and saving that again writes the same bytes.
   Any step that touches saved state (PLAN steps 5 and 6) must keep this green; a change
   that is meant to show something different adds its migration to MIGRATED.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { boot, readVisible, LS_KEY } = require('./boot.js');

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) pass++;
  else { fail++; fails.push(name + (detail ? '  — ' + detail : '')); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const html = fs.readFileSync(path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html')), 'utf8');
const dir = path.join(__dirname, 'fixtures');
const fixtures = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

/* What a release deliberately shows differently now: [field, old value → new value, why]. */
const MIGRATED = {
  view: { 'harmony:identify': 'harmony:chords' },   // Identify was cut in v2.17.0
  mode: { ear: 'practice' }                          // the ear drills moved into Practice
};
/* Keys old builds saved that the current one no longer writes, and why that loses nothing. */
const RETIRED = {
  trQual: 'Triads became a toggle (v2.17.0): folded into chQual when the save was on Triads',
  cofSel: 'the circle reads its selection from gRoot + scIdx',
  cofMinor: 'the circle reads its selection from gRoot + scIdx'
};
/* Fields a build before them didn't save: what a returning player must get instead. */
const ABSENT_DEFAULT = {
  welcomeSeen: () => true,                        // a returning visitor isn't welcomed again
  latencyKnown: now => now.latencyMs > 0          // a measured latency counts as known
};

function bootChecked(save, hash) {
  const errors = [];
  const win = boot(html, { save, hash });
  win.addEventListener('error', e => errors.push(e.message));
  return { win, T: win.__GS_TEST__, errors };
}

function domAgrees(label, win, T) {
  const doc = win.document, st = T.state();
  ok(label + ': <html lang> follows the language', doc.documentElement.lang === st.lang, doc.documentElement.lang);
  ok(label + ': body carries the restored mode', doc.body.classList.contains('mode-' + st.currentMode), doc.body.className);
  const nav = doc.querySelector('.navbtn.active');
  const want = st.currentMode === 'practice' ? 'practice' : st.currentTab;
  ok(label + ': the nav marks the restored destination', !!nav && nav.dataset.panel === want, nav && nav.dataset.panel);
  const panels = [...doc.querySelectorAll('.main > .panel.active')].map(p => p.id);
  ok(label + ': exactly one reference panel is shown, the restored tab',
     panels.length === 1 && panels[0] === 'panel-' + st.currentTab, panels.join(','));
  const root = doc.querySelector('#g-roots .btn.active');
  ok(label + ': the root buttons mark the restored root', !!root && +root.dataset.pc === st.gRoot, root && root.dataset.pc);
  ok(label + ': the tempo readout shows the restored tempo', doc.getElementById('tb-bpm').textContent === st.tempo + ' BPM');
  const snap = T.snapshotState();
  ok(label + ': the tuning select shows the restored tuning', doc.getElementById('tb-tuning').value === String(snap.tuningIdx));
  ok(label + ': no welcome for a returning player', !st.welcomeSeen || doc.getElementById('welcome-overlay').hidden === true);
}

for (const fx of fixtures) {
  const L = fx.name + ' (v' + fx.app + ')';
  const raw = JSON.stringify(fx.save);

  // 1. boot on the old save
  const a = bootChecked(raw, fx.hash);
  ok(L + ': boots without a page error', a.errors.length === 0, a.errors.join('; '));
  ok(L + ': exposes the test hook', !!a.T);
  if (!a.T) continue;

  // 2. the same visible state
  const now = readVisible(a.win);
  for (const k of Object.keys(fx.seen)) {
    const old = fx.seen[k];
    if (old === null) {
      if (ABSENT_DEFAULT[k]) ok(L + ': ' + k + ' (absent then) defaults for a returning player',
                                same(now[k], ABSENT_DEFAULT[k](now)), JSON.stringify(now[k]));
      continue;
    }
    if (k === 'learner' && old.best === null) {     // a v1 model: bests are derived from its sessions on load
      ok(L + ': keeps every practice item', same(now.learner.items, old.items));
      ok(L + ': keeps every session', same(now.learner.sessions, old.sessions));
      ok(L + ': derives a best per drill it has sessions for',
         same(now.learner.best.map(b => b[0]), [...new Set(old.sessions.map(s => s[1]))].sort()));
      continue;
    }
    const want = (MIGRATED[k] && Object.prototype.hasOwnProperty.call(MIGRATED[k], old)) ? MIGRATED[k][old] : old;
    ok(L + ': shows the same ' + k, same(now[k], want), 'was ' + JSON.stringify(want) + ', now ' + JSON.stringify(now[k]));
  }
  domAgrees(L, a.win, a.T);
  if (fx.hash) {
    ok(L + ': an old share link is cleared from the address', a.win.location.hash === '', a.win.location.hash);
    ok(L + ': ...and the save, not the link, decides what opens', same(now.view, fx.seen.view) && now.root === fx.seen.root);
  }

  // 3. nothing the old build saved is silently dropped
  const snap = a.T.snapshotState();
  const dropped = Object.keys(fx.save).filter(k => !(k in snap) && !RETIRED[k]);
  ok(L + ': every key it saved is still saved (or listed in RETIRED)', dropped.length === 0, dropped.join(','));

  // 4. save → load is lossless
  a.T.saveState();
  const saved1 = a.win.localStorage.getItem(LS_KEY);
  const b = bootChecked(saved1);
  ok(L + ': reboots on its own save without a page error', b.errors.length === 0 && !!b.T, b.errors.join('; '));
  if (b.T) {
    ok(L + ': save → load restores the same state', same(b.T.snapshotState(), JSON.parse(saved1)),
       Object.keys(JSON.parse(saved1)).filter(k => !same(b.T.snapshotState()[k], JSON.parse(saved1)[k])).join(','));
    ok(L + ': ...and shows the same thing', same(readVisible(b.win), now));
    b.T.saveState();
    ok(L + ': saving again writes the same bytes', b.win.localStorage.getItem(LS_KEY) === saved1);
    b.win.close();
  }
  a.win.close();
}

/* Damaged saves (hand-made, not captured): the app still opens on a real view. */
[['an unknown tab', { tab: 'bogus', lang: 'en' }],
 ['the Practice tab name', { tab: 'practice', lang: 'en' }],
 ['a save that is not JSON', '{"tab":"scal'],
 ['a save that is not an object', '42']].forEach(([what, save]) => {
  const c = bootChecked(save);
  ok('damaged save, ' + what + ': boots without a page error', c.errors.length === 0 && !!c.T, c.errors.join('; '));
  if (!c.T) return;
  const shown = [...c.win.document.querySelectorAll('.main > .panel.active')].map(p => p.id);
  ok('damaged save, ' + what + ': opens on one real panel', shown.length === 1, shown.join(',') || 'none');
  c.win.close();
});

ok('compat: at least one fixture per schema era', fixtures.length >= 8, fixtures.length + ' fixtures');

console.log('\nEuterpe compat suite: ' + pass + ' passed, ' + fail + ' failed  (' + fixtures.length + ' saves from past releases)');
if (fail) { console.log('\nFailures:'); fails.forEach(f => console.log('  ✗ ' + f)); }
process.exit(fail ? 1 : 0);
