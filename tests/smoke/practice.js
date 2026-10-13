/* Euterpe smoke suite — the Practice layer: mode axis, learner model, the one practice model, the drill shell, Next up and the seams, progress.
   Run by ../smoke.js, in order, against its one booted page: the blocks share that page's
   state, so an area may rely on what an earlier one left behind. */
'use strict';
module.exports = function (ctx) {
  const { ok, approx, html, dom, win, T, byShort } = ctx;

  /* ---- 3a: the mode axis (Reference · Practice) ----
     jsdom doesn't resolve the full stylesheet cascade, so the actual show/hide is a
     visual check (screenshots); here we assert the reliable signals: the body class,
     button state, the untouched reference shell, and persistence. */
  (function modeAxis() {
    const doc = win.document;
    /* A2 merged the mode strip into the one nav, so Practice is now the fourth
       destination beside the three reference subjects — but the mode AXIS is
       unchanged underneath, which is what these checks are about. */
    const nav = doc.getElementById('mainnav');
    ok('3a: the nav is present', !!nav);
    const pp = doc.getElementById('panel-practice');
    ok('3a: practice panel present and NOT a .panel (off the .panel.active machinery)',
       !!pp && !pp.classList.contains('panel'));
    ok('3a: reference shell untouched (2 reference panels)',
       doc.querySelectorAll('.main > .panel').length === 2);

    // enter Practice
    T.selectTab('harmony');
    T.setMode('practice');
    ok('3a: body marks practice mode',
       doc.body.classList.contains('mode-practice') && !doc.body.classList.contains('mode-reference'));
    const pBtn = nav.querySelector('.navbtn[data-panel="practice"]');
    ok('3a: the Practice destination reads as current',
       pBtn.classList.contains('active') && pBtn.getAttribute('aria-selected') === 'true');
    ok('3a: reference sub-tab stays selected underneath', T.state().currentTab === 'harmony');
    ok('3a: state() exposes mode', T.state().currentMode === 'practice');
    ok('3a: mode persists to localStorage',
       JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}').mode === 'practice');

    // back to Reference: body class + buttons flip back, mode persists
    T.setMode('reference');
    ok('3a: body marks reference mode',
       doc.body.classList.contains('mode-reference') && !doc.body.classList.contains('mode-practice'));
    // ...and the nav follows back to whichever reference subject was underneath
    const rBtn = nav.querySelector('.navbtn[data-panel="harmony"]');
    ok('3a: leaving Practice makes the reference subject current again',
       rBtn.classList.contains('active') && rBtn.getAttribute('aria-selected') === 'true'
       && !nav.querySelector('.navbtn[data-panel="practice"]').classList.contains('active'));
    ok('3a: reference active panel still .active underneath',
       doc.getElementById('panel-harmony').classList.contains('active'));
    ok('3a: mode reference persists',
       JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}').mode === 'reference');
  })();

  /* ---- 3b: learner model (spine #3) — SRS, ring buffer, bounds-checked restore ---- */
  (function learnerModel() {
    const NOW = 1000000000000;   // fixed epoch for deterministic due times
    T.resetLearner();

    // SM-2-lite: a correct attempt grows ease (2.5 -> 2.6) + pushes due out
    let it = T.recordAttempt('note:E:str6', true, NOW);
    ok('3b: correct increments seen+correct+streak', it.seen === 1 && it.correct === 1 && it.streak === 1);
    ok('3b: correct grows ease to 2.6', Math.abs(it.ease - 2.6) < 1e-9);
    ok('3b: correct schedules due in the future', it.due > NOW);

    // a miss zeroes the streak, drops ease (2.6 -> 2.4), re-queues to relearn soon
    it = T.recordAttempt('note:E:str6', false, NOW);
    ok('3b: miss increments seen but not correct', it.seen === 2 && it.correct === 1);
    ok('3b: miss resets streak', it.streak === 0);
    ok('3b: miss lowers ease to 2.4', Math.abs(it.ease - 2.4) < 1e-9);
    ok('3b: miss re-queues within the minute', it.due === NOW + 60000);

    // ease floors at 1.3 after repeated misses
    for (let i = 0; i < 10; i++) T.recordAttempt('note:E:str6', false, NOW);
    ok('3b: ease floored at 1.3', Math.abs(T.getLearner().items['note:E:str6'].ease - 1.3) < 1e-9);

    // due-queue: only past-due items surface, optionally namespaced by prefix
    T.resetLearner();
    T.recordAttempt('note:A:str5', false, NOW);   // due NOW+60000
    T.recordAttempt('note:C:str5', true, NOW);    // due ~1 day out
    const dueSoon = T.dueItems(NOW + 60000 + 1, 'note:');
    ok('3b: dueItems surfaces only past-due', dueSoon.indexOf('note:A:str5') >= 0 && dueSoon.indexOf('note:C:str5') < 0, dueSoon.join(','));
    ok('3b: dueItems prefix filter', T.dueItems(NOW + 2 * 86400000, 'interval:').length === 0);

    /* Sessions retention. This used to be one global cap of 50 across nine tracks —
       so a drill practised daily evicted the entire history of one practised weekly,
       and a trend had roughly five points to work with. Phase 10/B1 made the cap
       PER SESSION ID (newest kept), with the global figure demoted to a safety
       ceiling. The eviction rule is the thing to pin, not the number. */
    T.resetLearner();
    const PER_ID = T.SESS_PER_ID;
    for (let i = 0; i < PER_ID + 40; i++) T.recordSession('notes', i, NOW + i);
    const L = T.getLearner();
    ok('3b: sessions are capped per id', L.sessions.length === PER_ID, String(L.sessions.length));
    ok('3b: the newest are the ones kept',
       L.sessions[L.sessions.length - 1].score === PER_ID + 39
       && L.sessions[0].score === 40);
    // the point of per-id retention: a flood of one drill can't erase another's history
    T.resetLearner();
    T.recordSession('changes:C-G', 44, NOW);
    for (let i = 0; i < 200; i++) T.recordSession('notes', i, NOW + 1 + i);
    ok('3b: a busy drill no longer evicts a quiet one',
       T.getLearner().sessions.some(s => s.drill === 'changes:C-G'));
    ok('3b: ...and the global ceiling still holds', T.getLearner().sessions.length <= T.SESS_MAX);

    // aggregate stats
    T.resetLearner();
    T.recordAttempt('a', true, NOW); T.recordAttempt('a', true, NOW); T.recordAttempt('b', false, NOW);
    const st = T.learnerStats();
    ok('3b: stats count items', st.items === 2);
    ok('3b: stats accuracy = correct/seen', Math.abs(st.accuracy - 2 / 3) < 1e-9);
    ok('3b: stats best streak', st.bestStreak === 2);

    // normalizeLearner: a tampered blob degrades to a safe, valid model (never throws)
    const bad = T.normalizeLearner({
      v: T.LEARNER_V,
      items: {
        good: { seen: 5, correct: 3, streak: 2, ease: 2.4, due: 123 },
        liar: { seen: 2, correct: 9, streak: -4, ease: 99, due: -5 },   // correct>seen, neg streak, ease oob, neg due
        bad1: 'nope', bad2: null
      },
      sessions: [{ t: 1, drill: 'x', score: 1 }, { nope: true }, 'junk']
    });
    ok('3b: normalize keeps valid item', bad.items.good && bad.items.good.seen === 5 && bad.items.good.correct === 3);
    ok('3b: normalize clamps correct<=seen', bad.items.liar.correct === 2);
    ok('3b: normalize floors streak at 0', bad.items.liar.streak === 0);
    ok('3b: normalize clamps ease into [1.3,3.0]', bad.items.liar.ease <= 3.0 && bad.items.liar.ease >= 1.3);
    ok('3b: normalize floors due at 0', bad.items.liar.due === 0);
    ok('3b: normalize drops non-object items', bad.items.bad1 === undefined && bad.items.bad2 === undefined);
    ok('3b: normalize drops malformed sessions', bad.sessions.length === 1 && bad.sessions[0].drill === 'x');

    // unknown version / garbage → fresh model (the only sanctioned reshape is v-bump + migrate)
    const fresh = T.normalizeLearner({ v: 999, items: { z: { seen: 1 } } });
    ok('3b: normalize rejects unknown version → fresh', fresh.v === T.LEARNER_V && Object.keys(fresh.items).length === 0);
    ok('3b: normalize garbage → fresh', T.normalizeLearner(null).v === T.LEARNER_V && Object.keys(T.normalizeLearner('x').items).length === 0);

    // persistence: saveState writes the learner under its own key, apart from the settings
    T.resetLearner();
    T.recordAttempt('persist:test', true, NOW);
    T.setMode('practice');   // any state-mutating call triggers saveState()
    const saved = JSON.parse(win.localStorage.getItem('guitarStudio.progress.v1') || '{}');
    ok('3b: learner persists into saveState',
       saved.items && saved.items['persist:test'] && saved.items['persist:test'].correct === 1);
    ok('3b: persisted learner carries version', saved.v === T.LEARNER_V);
    ok('3b: ...and is not also written into the settings',
       !('learner' in JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}')));
    T.setMode('reference');   // restore mode
    T.resetLearner();         // leave a clean model for later tests
  })();

  /* ---- Phase 10/B1: one practice model ----
     Two half-models became one that every drill reports into. Before this, three
     separate hand-maintained lists encoded the same knowledge and all three were
     incomplete — REVIEW_NS's four namespaces, startReview's four-branch router, and
     nothing at all knowing which sessions were comparable. Six of the nine tracks
     were absent from "what should I practise next?"'s vocabulary. */
  (function onePracticeModel() {
    const NOW = 1700000000000;
    const DAY = 86400000;

    /* --- every drill declares its tracks; nothing is hand-wired --- */
    const tracks = T.drillTracks();
    ok('B1: every registered drill declares at least one track',
       T.DRILLS.every(d => Array.isArray(d.tracks) && d.tracks.length > 0),
       T.DRILLS.filter(d => !(d.tracks || []).length).map(d => d.id).join(','));
    /* The seam: one track per practice card, ten over seven registry entries (ear is
       three, over-the-changes is two). Counted from the markup rather than pinned to
       a number, so adding a card without declaring its track fails the build — the
       same discipline that makes an unregistered `*-area` fail.
       Counted from the practice home's SUBTREE, not from a raw `class="drill-card"`
       text match over the whole file: A4's welcome card reuses .drill-card for its
       three routes (deliberately — the first card a visitor taps should look like the
       cards they meet next), and a text count read those as untracked drills. Scoping
       the query is what keeps the invariant about practice cards specifically. */
    const cardCount = win.document.querySelectorAll('#practice-home .drill-card').length;
    ok('B1: every practice card has a track', tracks.length === cardCount,
       tracks.length + ' tracks vs ' + cardCount + ' cards');
    ok('B1: every track has an id, a kind and a drill that opens it',
       tracks.every(tr => tr.id && (tr.kind === 'recall' || tr.kind === 'perf') && tr.drill && typeof tr.drill.begin === 'function'));
    ok('B1: every track is nameable (a label key, for the queue to say what it means)',
       tracks.every(tr => tr.label && T.I18N.en[tr.label] && T.I18N.uk[tr.label]),
       tracks.filter(tr => !tr.label).map(tr => tr.id).join(','));
    ok('B1: every performance track declares its direction and unit',
       tracks.filter(tr => tr.kind === 'perf').every(tr => (tr.better === 'high' || tr.better === 'low') && tr.unit));
    ok('B1: track ids are unique', new Set(tracks.map(tr => tr.id)).size === tracks.length);
    // the entry that carries more than one skill
    ok('B1: ear declares its two skills separately',
       ['interval', 'chordq'].every(id => T.trackById(id) && T.trackById(id).kind === 'recall')
       && T.trackById('interval').drill === T.trackById('chordq').drill);
    ok('step 1: the cut tracks are gone from the registry',
       ['rhythm', 'target', 'callresp'].every(id => !T.trackById(id)));
    // and the lookups the model actually uses
    ok('B1: sessNs splits "ns:variant" and leaves a bare id alone',
       T.sessNs('timing:8ths') === 'timing' && T.sessNs('ear-interval') === 'ear-interval');
    ok('B1: trackBySess resolves a written session id', T.trackBySess(T.sessNs('changes:C-G')).id === 'changes');

    /* --- the review queue covers the app, instead of four hardcoded strings --- */
    T.resetLearner();
    const rev = T.learnerReview(NOW);
    ok('B1: a never-practised performance track is in the queue',
       rev.due.some(d => d.track === 'timing' && d.reason === 'new'));
    ok('B1: ...and so is every other one',
       ['timing', 'rhythm-guitar', 'changes']
         .every(id => rev.due.some(d => d.track === id)));
    // a fresh run takes it out of the queue; going cold puts it back
    T.recordSession('timing:8ths', 12, NOW);
    ok('B1: a fresh performance run leaves the queue',
       !T.learnerReview(NOW).due.some(d => d.track === 'timing'));
    ok('B1: ...and re-enters it once it goes stale',
       T.learnerReview(NOW + (T.PERF_STALE_DAYS + 1) * DAY).due.some(d => d.track === 'timing' && d.reason === 'stale'));
    // slipping: recent runs trending down against the earlier ones
    T.resetLearner();
    [40, 42, 41, 30, 28, 27].forEach((v, i) => T.recordSession('strum:common', v, NOW + i * 1000));
    ok('B1: a slipping track is flagged even while it is fresh',
       T.learnerReview(NOW + 6000).due.some(d => d.track === 'rhythm-guitar' && d.reason === 'slipping'));
    // recall still outranks performance — an overdue SRS item is a fact, a cold drill a hint
    T.resetLearner();
    T.recordAttempt('note:A', false, NOW - 120000);
    const mixed = T.learnerReview(NOW);
    ok('B1: overdue recall items lead the queue', mixed.due[0] && mixed.due[0].kind === 'recall');
    ok('B1: the old total/by/top contract still holds', mixed.total === 1 && mixed.top === 'note');
    // routing goes through the registry, so a track is openable the moment it is declared
    ok('B1: every track in the queue can actually be opened',
       T.learnerReview(NOW).due.every(d => !!T.trackById(d.track)));
    /* And the queue reaches the screen. With nothing due for review the "next" used to
       be blank — which is what anyone practising rhythm or lead saw, forever, no
       matter how much history the app held on them. Since step 12 it is the Next-up card. */
    T.resetLearner();
    T.recordSession('strum:common', 8, Date.now());
    T.setMode('practice');
    const btn = win.document.querySelector('#next-up [data-track]');
    ok('B1: with nothing due, Next up names a performance track instead of going blank',
       !!btn && T.trackById(btn.dataset.track).kind === 'perf', btn && btn.outerHTML);
    T.setMode('reference');

    /* --- the trend: the ring buffer read as the time series it always was --- */
    T.resetLearner();
    [20, 22, 26, 30].forEach((v, i) => T.recordSession('changes:C-G', v, NOW + i * DAY));
    const up = T.learnerTrend('changes:C-G', NOW + 3 * DAY);
    ok('B1: trend counts the runs', up.n === 4);
    ok('B1: trend reads the latest', up.last === 30);
    ok('B1: trend reads the direction of travel', up.dir === 'up', up.dir);
    ok('B1: trend knows the unit from the registry', up.unit === 'cpm');
    ok('B1: trend knows how cold the track is', Math.round(up.staleDays) === 0);
    T.resetLearner();
    [30, 28, 21, 20].forEach((v, i) => T.recordSession('changes:C-G', v, NOW + i * DAY));
    ok('B1: a declining track reads as down', T.learnerTrend('changes:C-G', NOW).dir === 'down');
    T.resetLearner();
    [30, 30, 31, 30].forEach((v, i) => T.recordSession('changes:C-G', v, NOW + i * DAY));
    ok('B1: noise is not a trend', T.learnerTrend('changes:C-G', NOW).dir === 'flat');
    // a whole namespace, not just one exact id — "how is my comping going", all progressions
    T.resetLearner();
    T.recordSession('comp:I-V-vi-IV', 8, NOW);
    T.recordSession('comp:ii-V-I', 12, NOW + 1000);
    ok('B1: a trend can span a namespace', T.learnerTrend('comp', NOW + 1000).n === 2);

    /* --- the personal best is STORED, because it must outlive its history --- */
    T.resetLearner();
    T.recordSession('changes:C-G', 55, NOW);
    T.recordSession('changes:C-G', 41, NOW + 1000);
    ok('B1: the best is kept, not the latest', T.learnerBest('changes:C-G').score === 55);
    // ...which is the bug the old derive-by-scanning had: flood it out and it survives
    for (let i = 0; i < T.SESS_PER_ID + 5; i++) T.recordSession('changes:C-G', 10, NOW + 2000 + i);
    ok('B1: the best survives its own runs rolling off the buffer',
       T.learnerBest('changes:C-G').score === 55
       && !T.getLearner().sessions.some(s => s.drill === 'changes:C-G' && s.score === 55));
    ok('B1: ...and the drill reads the same number', T.cmPairBest(3) === 55);   // pair 3 = C–G

    /* --- the scored tiers' timing error is kept, not shown once and discarded --- */
    T.resetLearner();
    T.recordSession('timing:8ths', 9, NOW, { err: 42 });
    T.recordSession('timing:8ths', 9, NOW + 1000, { err: 28 });
    const tn = T.learnerTrend('timing:8ths', NOW + 1000);
    ok('B1: the timing error rides along with the session', tn.lastErr === 28);
    ok('B1: ...and its best is the LOWEST, whatever the track\'s own direction is', tn.bestErr === 28);
    // scoredErr refuses anything that isn't an honest measurement.
    // A4: an absolute timing error is only meaningful once the round trip is known,
    // so establish it before asserting the happy path (and check the refusal below).
    T.setCalKnown(true);
    ok('B1: no score, no error recorded', T.scoredErr(null) === undefined);
    ok('B1: an empty run records no error', T.scoredErr({ n: 0, meanAbsMs: 0 }) === undefined);
    ok('B1: a real run records one', T.scoredErr({ n: 20, meanAbsMs: 31, spreadMs: 22, hitRate: 0.9 }).err === 31);
    /* A run the self-hearing guard refused is the app scoring its own click. It is kept
       off the screen for that reason; letting it into the TREND would poison the one
       number B4 is meant to render. */
    ok('B1: a self-heard run records no error — it would poison the trend',
       T.scoredErr({ n: 32, meanAbsMs: 1, spreadMs: 1, hitRate: 1 }) === undefined);
    /* A4: the second road to the same lie. With no measured round trip the offset is
       0 — not "instant", but "unknown" — so the error is the buffer size wearing the
       player's name, and charting it would show a device change as progress. */
    T.setCalKnown(false);
    ok('A4: an uncalibrated run records no error either — it would chart the buffer size',
       T.scoredErr({ n: 20, meanAbsMs: 31, spreadMs: 22, hitRate: 0.9 }) === undefined);
    T.setCalKnown(true);

    /* --- v1 → v2: existing progress must survive, asserted before anything relies on it --- */
    const v1 = {
      v: 1,
      items: { 'note:A': { seen: 4, correct: 3, streak: 2, ease: 2.5, due: NOW + DAY } },
      sessions: [
        { t: NOW, drill: 'changes:C-G', score: 51 },
        { t: NOW + 1000, drill: 'changes:C-G', score: 44 },
        { t: NOW + 2000, drill: 'timing:8ths', score: 7 }
      ]
    };
    const v2 = T.normalizeLearner(v1);
    ok('B1: a v1 store migrates instead of being discarded', v2.v === T.LEARNER_V);
    ok('B1: migration keeps every SRS item intact',
       v2.items['note:A'] && v2.items['note:A'].seen === 4 && v2.items['note:A'].correct === 3
       && v2.items['note:A'].streak === 2 && v2.items['note:A'].due === NOW + DAY);
    ok('B1: migration keeps every session intact', v2.sessions.length === 3
       && v2.sessions[0].score === 51 && v2.sessions[2].drill === 'timing:8ths');
    ok('B1: migration reconstructs the personal best a v1 store never stored',
       v2.best['changes:C-G'] && v2.best['changes:C-G'].score === 51);
    ok('B1: ...for each id independently', v2.best['timing:8ths'].score === 7);
    // and the guard rails hold: anything we don't know is still a fresh model
    ok('B1: an unknown future version is still refused',
       T.normalizeLearner({ v: 999, sessions: [{ t: NOW, drill: 'x', score: 1 }] }).sessions.length === 0);
    T.resetLearner();
  })();

  /* ---- Phase 10/B2: ONE DRILL SHELL ----------------------------------------
     Nine hand-rolled drill layouts collapse into one shell each drill fills in:
     header (name · setup handle · ? · 🎤 · key · tempo · Quit) → setup disclosure →
     hint → stage → action bar → summary. The three problems it fixes all had one
     cause — #drill-ctx was a key picker with an Exit button where a header belonged:
       • a drill never said WHICH drill it was (all nine under one <h2>Практика</h2>),
       • controls came before content and stayed there during the run,
       • Play sat below the longest paragraph on the screen.
     What the assertions guard is that the shell is DERIVED, not hand-wired: adding a
     drill must still be one file + its markup. -------------------------------- */
  (function oneDrillShell() {
    const doc = win.document;
    const vis = id => { const e = doc.getElementById(id); return !!e && !e.hidden; };
    const bodyHas = c => doc.body.classList.contains(c);

    /* --- the header exists and is one strip, not nine --- */
    ['drill-ctx-name', 'drill-ctx-setup', 'drill-ctx-help', 'drill-ctx-mic', 'drill-ctx-quit']
      .forEach(id => ok('B2: the shell header carries #' + id, !!doc.getElementById(id)));
    /* No drill area may re-declare a header of its own. .drill-head was the closest
       thing the drills had to a shared part and it never held the drill's name — so
       its removal is the seam: a new drill that brings one back fails here. */
    ok('B2: no drill area carries its own header any more',
       doc.querySelectorAll('#panel-practice .drill-head').length === 0);

    /* --- every declared setup element must exist (the registry seam, again) --- */
    ok('B2: every drill that declares a setup element has one in the markup',
       T.DRILLS.filter(d => d.setup).every(d => !!doc.getElementById(d.setup)),
       T.DRILLS.filter(d => d.setup && !doc.getElementById(d.setup)).map(d => d.id).join(','));
    ok('B2: a drill that declares mic() also declares onMic()',
       T.DRILLS.filter(d => d.mic).every(d => typeof d.onMic === 'function'));

    /* --- ONE DOOR: a practice card opens its track, and the header says which --- */
    T.setMode('practice');
    const cards = [...doc.querySelectorAll('#practice-home .drill-card')];
    ok('B2: every practice card names its track',
       cards.length > 0 && cards.every(c => c.dataset.track && T.trackById(c.dataset.track)),
       cards.filter(c => !T.trackById(c.dataset.track || '')).map(c => c.id).join(','));
    doc.getElementById('start-timing').click();
    ok('B2: a card click opens its drill', vis('sd-area') && !vis('practice-home'));
    ok('B2: ...and the header finally says which drill it is',
       doc.getElementById('drill-ctx-name').textContent === T.I18N[T.state().lang].drill_timing,
       doc.getElementById('drill-ctx-name').textContent);
    /* It is the TRACK, not the drill: ear hosts two, and "Ear" is not what the player
       pressed. */
    T.exitAllDrills();
    doc.getElementById('start-chordq').click();
    ok('B2: two tracks behind one drill are named apart',
       doc.getElementById('drill-ctx-name').textContent === T.I18N[T.state().lang].ear_chords);
    T.exitAllDrills();
    ok('B2: leaving a drill clears the name', T.getCurTrack() === null);

    /* --- the setup disclosure: open before Play, folded during the run --- */
    T.setDrillSeen({});
    doc.getElementById('start-rhythm-guitar').click();
    ok('B2: the setup handle is offered for a drill that has a setup', vis('drill-ctx-setup'));
    ok('B2: the setup opens on entry — you are about to configure a run', bodyHas('drill-setup-open'));
    T.drillRunStarted();
    ok('B2: ...and folds once the run starts', !bodyHas('drill-setup-open'));
    T.drillSetupToggle();
    ok('B2: ...and can be re-opened mid-run in one tap', bodyHas('drill-setup-open'));
    T.exitAllDrills();
    /* A drill that configures nothing gets no handle: a disclosure over an empty box is
       worse than no disclosure. */
    doc.getElementById('start-interval').click();
    ok('B2: a drill with nothing to set up gets no setup handle', !vis('drill-ctx-setup'));
    ok('B2: ...and no open-setup class to hide behind', !bodyHas('drill-setup-open'));
    T.exitAllDrills();

    /* --- the hint: revealed once per track, then collapsed ---
       Collapsing a drill's instructions helps someone who knows the drill and ambushes a
       first-timer, for whom that paragraph is the only instruction on the screen. So the
       reveal is per track, and it happens exactly once. */
    T.setDrillSeen({});
    doc.getElementById('start-changes').click();
    ok('B2: a drill you have never run opens with its hint showing', bodyHas('drill-help-open'));
    ok('B2: ...and is remembered as met', !!T.getDrillSeen().changes);
    T.exitAllDrills();
    doc.getElementById('start-changes').click();
    ok('B2: the second time, the hint is folded behind the ?', !bodyHas('drill-help-open'));
    T.drillHintToggle();
    ok('B2: ...and the ? brings it back', bodyHas('drill-help-open'));
    /* per TRACK, not per drill: meeting one ear skill does not mean you have met the
       other, and they are two different exercises behind one area. */
    T.exitAllDrills();
    doc.getElementById('start-chordq').click();
    ok('B2: a sibling track is still a first meeting', bodyHas('drill-help-open'));
    T.exitAllDrills();
    T.setDrillSeen({});

    /* --- the mic: one button, routed to whichever drill is running --- */
    doc.getElementById('start-rhythm-guitar').click();
    const micWasOn = T.spScore.on();
    T.drillMicToggle();
    ok('B2: the shared mic button reaches the running drill', T.spScore.on() !== micWasOn);
    T.drillMicToggle();
    ok('B2: the mic is offered in rhythm guitar', T.DRILLS.find(d => d.id === 'rhythm-guitar').mic() === T.spScore.available());
    T.exitAllDrills();
    /* ...and it is hidden where the running drill has no tier at all */
    doc.getElementById('start-interval').click();
    T.applyDrillCtx();
    ok('B2: the mic is not offered by a drill with no mic tier', !vis('drill-ctx-mic'));
    T.exitAllDrills();

    /* --- a language switch mid-drill re-localizes the header ---
       The name and the setup handle are painted from i18n by applyDrillCtx, not from a
       data-i18n attribute, so applyLang's attribute sweep does not see them — it has to
       call applyDrillCtx too, or a drill opened in one language keeps its old title. */
    doc.getElementById('start-timing').click();
    const langBtns = [...doc.querySelectorAll('.langbtn')];
    const other = langBtns.find(b => b.dataset.lang !== T.state().lang);
    other.click();
    ok('B2: the header name follows a language switch mid-drill',
       doc.getElementById('drill-ctx-name').textContent === T.I18N[T.state().lang].drill_timing,
       doc.getElementById('drill-ctx-name').textContent);
    langBtns.find(b => b.dataset.lang !== T.state().lang).click();   // back
    T.exitAllDrills();

    /* --- key and tempo stay derived, as A1 left them; step 8 moved them to the strip --- */
    doc.getElementById('start-notes').click();
    ok('B2: a drill that re-derives from nothing gets no key chip', !vis('chip-key'));
    ok('B2: ...no tempo chip', !vis('chip-tempo'));
    ok('step 8: ...and no ▶ — naming notes has nothing to play', !vis('chip-play'));
    T.exitAllDrills();
    T.setMode('reference');

  })();

  /* ---- NEXT UP, AND THE SEAM ----------------------------------------------------
     B3's timed session (a planner, a countdown, block chaining and a report for six
     drills) became one card in PLAN step 12: "Next up: ⟨the most due drill⟩ →". What is
     asserted is that it owns nothing itself: the queue is learnerReview's, and the door
     is startTrack, through the home's one data-track listener. --------------------- */
  (function nextUpAndSeam() {
    const doc = win.document;
    const vis = id => { const e = doc.getElementById(id); return !!e && !e.hidden && !e.closest('[hidden]'); };
    const T0 = 1700000000000, L = T.I18N[T.state().lang];

    /* --- the timed session is gone, with its header counter, Next and report --- */
    ok('step 12: no timed session left', T.sessionStart === undefined && !doc.getElementById('sess-start')
       && !doc.getElementById('session-report') && !doc.getElementById('drill-ctx-sess') && !doc.getElementById('drill-ctx-skip'));
    ok('step 12: ...and no session length saved', !('sessMins' in T.snapshotState()));

    /* --- the queue is learnerReview's, not a second ranking --- */
    T.resetLearner();
    T.recordAttempt('interval:P5', false, T0);        // one overdue recall item
    const due = T.learnerReview(T0 + 120000).due;
    const nx = T.nextUp(T0 + 120000);
    ok('step 12: Next up is whatever the review queue ranked first',
       due.length > 0 && nx.track === due[0].track && nx.reason === 'due' && nx.n === 1, JSON.stringify(nx));
    T.resetLearner();
    ok('step 12: on a fresh profile it offers a drill you have not tried',
       T.nextUp(T0).reason === 'new' && !!T.trackById(T.nextUp(T0).track));

    /* --- the card: the drill's name, why, and one press in --- */
    T.setMode('practice');
    T.recordAttempt('interval:P5', false, Date.now() - 600000);
    T.renderPractice();
    const go = doc.querySelector('#next-up .next-go');
    ok('step 12: the home leads with the Next-up card', vis('next-up') && !!go
       && doc.getElementById('ph-top-block').firstElementChild.id === 'next-up');
    ok('step 12: ...naming the drill', go.textContent.includes(L.ear_intervals), go.textContent);
    ok('step 12: ...and why', doc.querySelector('#next-up .next-why').textContent === L.next_due.replace('{n}', 1));
    ok('step 12: the progress card no longer repeats what is next', !doc.querySelector('#practice-progress .pp-review'));
    go.click();
    ok('step 12: one press opens it through the one door', T.getCurTrack() === 'interval' && !!T.activeDrill());
    T.quitDrill();
    T.resetLearner();
    T.setMode('reference');

    /* --- THE SEAM: "drill this" from the reference views that have a drill --- */
    const seams = [...doc.querySelectorAll('[data-seam]')];
    ok('B3: the drill seam is offered by three views',
       new Set(seams.map(b => b.dataset.seam)).size === 3,
       seams.map(b => b.dataset.seam).join(','));
    ok('B3: ...covering exactly those three',
       ['chords', 'scale', 'notes']
         .every(v => seams.some(b => b.dataset.seam === v)));
    ok('B3: every seam points at a track that exists',
       Object.keys(T.SEAM_TRACKS).every(v => !!T.trackById(T.SEAM_TRACKS[v])),
       Object.keys(T.SEAM_TRACKS).filter(v => !T.trackById(T.SEAM_TRACKS[v])).join(','));
    ok('B3: ...and every view in the markup has a mapping',
       seams.every(b => !!T.SEAM_TRACKS[b.dataset.seam]));
    /* pressing one lands you in Practice, in that drill, with the header naming it —
       because the seam goes through startTrack() like every other door (B2) */
    seams.find(b => b.dataset.seam === 'scale').click();
    ok('B3: a seam press opens the mapped drill',
       T.state().currentMode === 'practice' && T.getCurTrack() === 'timing');
    ok('B3: ...named', doc.getElementById('drill-ctx-name').textContent === T.I18N[T.state().lang].drill_timing);
    T.exitAllDrills();
    T.setMode('reference');

    /* --- step 8: the Jam is the band under the one ▶, not a button of its own --- */
    T.selectTab('harmony');
    ok('step 8: no Jam buttons left on the page (the drawer holds the band)',
       !doc.querySelector('[data-jam]') && !doc.querySelector('#sub-arp [data-seam]'));
    const bandWas = T.bandActive();
    T.bassToggle(); T.drumsToggle();
    ok('step 8: Bass and Drums turn the band on', T.state().bassOn && T.state().grooveOn && bandWas === false);
    ok('step 8: ...without starting anything — ▶ does that', !T.transportActive());
    T.stripPlay();
    ok('step 8: ▶ then plays the chord with the band', T.state().loop && T.bandActive());
    T.stripPlay();
    T.bassToggle(); T.drumsToggle();
    ok('step 8: ...and off again', !T.bandActive() && !T.transportActive());
  })();

  /* ---- Phase 10/B4: PROGRESS, AND COPY THAT TELLS THE TRUTH ------------------
     The five-number stats dump is replaced by the narrative B1 made possible, and
     every string that promised a shipped feature was "coming later" is retired. --- */
  (function progressAndTruth() {
    const doc = win.document;
    const T0 = 1700000000000;

    /* --- the badge is DERIVED, so a card cannot drift from its drill --- */
    T.setMode('practice');
    const cards = [...doc.querySelectorAll('#practice-home .drill-card[data-track]')];
    ok('step 9: six practice cards, each with a tag slot and a last-result line',
       cards.length === 6 && cards.every(c => !!c.querySelector('.dc-tags') && !!c.querySelector('.dc-last')));
    ok('step 9: one 🎤 where the drill listens — from the registry, not the markup',
       cards.filter(c => !!c.querySelector('.dc-mic')).map(c => c.dataset.track).sort().join(',') === 'rhythm-guitar,timing'
       && T.drillTracks().filter(T.trackMic).map(tr => tr.id).sort().join(',') === 'rhythm-guitar,timing');
    ok('step 9: the three badge kinds are gone', !doc.querySelector('.dc-badge') && T.I18N.en.badge_acc === undefined && T.I18N.en.badge_coach === undefined);

    /* --- the narrative: a row per drill you have run --- */
    T.resetLearner();
    T.renderPractice();
    ok('step 3: an untouched model hides the progress card',
       doc.querySelector('.practice-progress-card').hidden);
    // six runs on the timing coach, improving, with a timing error that improves too
    [4, 5, 6, 10, 11, 12].forEach((n, i) => T.recordSession('timing:8ths', n, T0 + i * 1000, { err: 60 - i * 5 }));
    T.recordSession('strum:down', 8, T0 + 9000);
    T.renderPractice();
    const rows = [...doc.querySelectorAll('#practice-progress .pp-row')];
    ok('step 3: ...and shows it once there is a run to report',
       !doc.querySelector('.practice-progress-card').hidden);
    ok('B4: only the drills you have actually run get a row',
       rows.length === 2, rows.map(r => r.dataset.track).join(','));
    ok('B4: most recently practised first', rows[0].dataset.track === 'rhythm-guitar');
    const timing = rows.find(r => r.dataset.track === 'timing');
    ok('step 9: the timing row leads with the timing error, its main score',
       /^±35 ms/.test(timing.querySelector('.pp-row-val').textContent),
       timing.querySelector('.pp-row-val').textContent);
    ok('B4: ...with the direction of travel B1 computed and nothing rendered',
       timing.querySelector('.pp-dir').classList.contains('up'));
    ok('B4: ...the personal best, in the same terms',
       timing.querySelector('.pp-row-sub').textContent.includes(T.I18N[T.state().lang].prog_best + ' ±35'));
    /* the number the app computed, displayed once and threw away until B1 kept it —
       "your timing went from 45 ms to 28 ms" is finally a sentence it can form */
    ok('B4: ...and the timing error, which used to be shown once and discarded',
       /±35/.test(timing.querySelector('.pp-row-sub').textContent),
       timing.querySelector('.pp-row-sub').textContent);
    ok('B4: a row is also a door into its drill',
       rows.every(r => r.tagName === 'BUTTON' && !!T.trackById(r.dataset.track)));
    timing.click();
    ok('B4: ...and pressing it opens that drill', T.getCurTrack() === 'timing');
    T.exitAllDrills();
    /* the aggregates survive, demoted: still worth knowing, no longer the whole card */
    ok('B4: the five-number dump is now a four-stat footer, below the story',
       doc.querySelectorAll('#practice-progress .pp-stat').length === 4);
    T.resetLearner();
    T.renderPractice();

    /* --- COPY TRUTH. F1 shipped mic scoring for three drills in v2.13/2.14 and the
       strings underneath them still said it was coming later. Nothing user-facing may
       promise a shipped feature is unbuilt; the badge carries the tier instead. --- */
    const later = /coming later|arrives later|comes later|додамо згодом|згодом додамо/;
    const promises = ['sd_hint', 'sp_hint', 'co_hint', 'drill_timing_meta', 'drill_strum_meta',
                      'drill_comp_meta', 'drill_changes_meta', 'drill_notes_meta'];
    ['uk', 'en'].forEach(lg => promises.forEach(k => {
      ok('B4: ' + lg + '.' + k + ' does not promise a shipped feature is unbuilt',
         !later.test(T.I18N[lg][k]), T.I18N[lg][k]);
    }));
    /* ...and the subtitles stop claiming a tier in prose at all — that is the badge's
       job now, and prose is exactly what went stale. */
    ['uk', 'en'].forEach(lg => {
      const metas = Object.keys(T.I18N[lg]).filter(k => /_meta$/.test(k));
      ok('B4: no ' + lg + ' subtitle still ends "· coach"',
         metas.every(k => !/·\s*(coach|коуч)/i.test(T.I18N[lg][k])),
         metas.filter(k => /·\s*(coach|коуч)/i.test(T.I18N[lg][k])).join(','));
    });
    ['uk', 'en'].forEach(lg => {
      const bad = Object.keys(T.I18N[lg]).filter(k => /next phase|наступна фаза|\bphase \d|фаза \d/i.test(T.I18N[lg][k]));
      ok('step 1: no ' + lg + ' string talks about roadmap phases', bad.length === 0, bad.join(','));
    });
    T.setMode('reference');
  })();
};
