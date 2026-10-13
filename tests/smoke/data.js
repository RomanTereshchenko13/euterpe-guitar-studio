/* Euterpe smoke suite — note glyphs and data safety (export, import, persistence).
   Run by ../smoke.js, in order, against its one booted page: the blocks share that page's
   state, so an area may rely on what an earlier one left behind. */
'use strict';
module.exports = function (ctx) {
  const { ok, approx, html, dom, win, T, byShort } = ctx;


  /* ---- Step 1: one spelling of accidentals on screen. Data labels stay ASCII ('Eb',
     'C#' — saves, share links and session ids hold them); everything rendered goes
     through noteTxt(). Walk the views in a flat key and a sharp key and scan the text
     that is actually painted (scripts and the changelog excluded). ---- */
  (function noteGlyphs() {
    const doc = win.document;
    const ascii = /(^|[^A-Za-z])[A-G](#|b(?![a-ln-z]))/;
    const offenders = [];
    const scan = (where) => {
      const tw = doc.createTreeWalker(doc.body, win.NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const p = n.parentElement;
        if (!p || p.closest('script,style,#cl-overlay')) continue;
        const m = n.nodeValue.match(ascii);
        if (m) offenders.push(where + ': ' + (p.id || p.className || p.tagName) + ' "' + n.nodeValue.trim().slice(0, 40) + '"');
      }
    };
    ok('glyphs: noteTxt spells for display', T.noteTxt('Eb') === 'E♭' && T.noteTxt('C#') === 'C♯' && T.noteTxt('B') === 'B');
    [[3, 'Eb'], [1, 'C#'], [10, 'Bb']].forEach(([pc, lbl]) => {
      T.setKey(pc, lbl);
      ok('glyphs: the key label itself stays ASCII in state (' + lbl + ')', T.state().keyLbl === lbl && T.state().chLbl === lbl);
      ['harmony', 'scales', 'key sheet', 'chord sheet'].forEach(tab => {
        if (tab === 'harmony') { T.selectTab(tab); ['chords', 'triads', 'arp'].forEach(v => { T.setHView(v); scan(lbl + '/' + v); }); }
        else if (tab === 'scales') { T.selectTab(tab); ['scale', 'notes'].forEach(v => { T.setScView(v); scan(lbl + '/' + v); }); }
        else { const k = tab === 'key sheet' ? 'key' : 'chord'; T.toggleSheet(k); scan(lbl + '/' + tab); T.toggleSheet(k); }
      });
    });
    ok('glyphs: no ASCII accidental is painted anywhere', offenders.length === 0, offenders.slice(0, 6).join(' | '));
    const btn = doc.querySelector('#g-roots .btn[data-pc="3"]');
    ok('glyphs: root buttons carry their pitch class, not a label to parse back',
       !!btn && btn.textContent === 'E♭');
    T.setKey(9, 'A'); T.setHView('chords'); T.setScView('scale'); T.selectTab('harmony');
  })();

  /* ---- Step 0: protect progress. Export is the saved snapshot in an envelope;
     import validates it (envelope, version, learner via normalizeLearner, known keys
     only) and must round-trip the learner exactly; a failed save says so once. ---- */
  (function protectProgress() {
    const doc = win.document;
    ['bk-export', 'bk-import', 'bk-file', 'bk-status', 'app-toast'].forEach(id =>
      ok('backup: DOM id resolves: ' + id, !!doc.getElementById(id)));

    const NOW = Date.UTC(2026, 9, 8, 12);
    T.resetLearner();
    T.recordAttempt('note:C', true, NOW);
    T.recordSession('timing:8th', 12, NOW, { err: 18 });
    const before = JSON.stringify(T.getLearner());

    // the envelope carries exactly what saveState writes
    const pay = T.progressPayload(NOW);
    ok('backup: envelope identifies the file',
       pay.app === 'guitar-studio' && pay.kind === 'progress' && pay.format === T.BACKUP_FORMAT &&
       pay.exported === new Date(NOW).toISOString() && typeof pay.version === 'string');
    ok('backup: payload state has the same keys as the saved snapshot',
       JSON.stringify(Object.keys(pay.state)) === JSON.stringify(Object.keys(T.snapshotState())));
    ok('backup: file name is dated', /^euterpe-progress-2026-10-08\.json$/.test(T.progressFileName(NOW)),
       T.progressFileName(NOW));

    // parse: round-trip, and every way a file can be wrong
    const text = JSON.stringify(pay);
    const r = T.progressParse(text);
    ok('backup: own export parses', r.ok && r.exported === NOW, JSON.stringify(r).slice(0, 120));
    ok('backup: learner survives the round trip intact', r.ok && JSON.stringify(r.state.learner) === before);
    const err = (txt) => { const x = T.progressParse(txt); return x.ok ? 'ok' : x.err; };
    ok('backup: non-JSON refused', err('{nope') === 'bk_err_parse');
    ok('backup: foreign JSON refused', err('{"a":1}') === 'bk_err_notours');
    ok('backup: state that is not an object refused',
       err(JSON.stringify(Object.assign({}, pay, { state: [1] }))) === 'bk_err_notours');
    ok('backup: newer file format refused',
       err(JSON.stringify(Object.assign({}, pay, { format: T.BACKUP_FORMAT + 1 }))) === 'bk_err_newer');
    // an unknown learner version would normalize to an EMPTY model — i.e. wipe progress
    const future = JSON.parse(text); future.state.learner.v = T.LEARNER_V + 1;
    ok('backup: newer learner version refused, not imported as empty', err(JSON.stringify(future)) === 'bk_err_newer');
    // a tampered learner is normalized; unknown top-level keys are dropped
    const dirty = JSON.parse(text);
    dirty.state.learner.items['note:C'].correct = 99;   // more correct than seen
    dirty.state.evil = '<script>';
    const rd = T.progressParse(JSON.stringify(dirty));
    ok('backup: learner goes through normalizeLearner',
       rd.ok && rd.state.learner.items['note:C'].correct === rd.state.learner.items['note:C'].seen);
    ok('backup: keys we do not save are dropped', rd.ok && !('evil' in rd.state));
    // a v1 learner (older app) is migrated, not refused
    const old = JSON.parse(text); old.state.learner.v = 1; delete old.state.learner.best;
    const ro = T.progressParse(JSON.stringify(old));
    ok('backup: v1 learner file migrates', ro.ok && ro.state.learner.v === T.LEARNER_V &&
       ro.state.learner.best['timing:8th'] && ro.state.learner.best['timing:8th'].score === 12);

    // apply → load: the imported progress is what the next boot reads
    T.resetLearner();
    ok('backup: apply writes storage', T.progressApply(r.state) === true);
    ok('backup: apply blocks saves until the reload', T.getSaveBlocked() === true);
    T.saveState();   // must not overwrite the import with the (now empty) live model
    T.loadState();
    ok('backup: imported learner is what loads', JSON.stringify(T.getLearner()) === before);
    T.setSaveBlocked(false);

    // a failed save shows the notice once, with an export action
    const toast = doc.getElementById('app-toast');
    const SP = win.Storage.prototype, setItem = SP.setItem;
    let warned = 0; const warn = win.console.warn; win.console.warn = () => { warned++; };
    try {
      SP.setItem = function () { throw new Error('QuotaExceededError'); };
      T.resetSaveFailShown(); toast.hidden = true;
      T.saveState();
      ok('backup: failed save shows a notice', !toast.hidden && !!doc.getElementById('app-toast-act'));
      toast.hidden = true;
      T.saveState();
      ok('backup: ...only once per page load', toast.hidden);
    } finally { SP.setItem = setItem; win.console.warn = warn; }
    ok('backup: failed save still logs for developers', warned >= 1);
    toast.hidden = true;

    T.resetLearner();
    T.saveState();
  })();
};
