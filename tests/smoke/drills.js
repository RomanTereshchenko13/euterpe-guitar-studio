/* Euterpe smoke suite — the drills: note naming, ear, chord changes, rhythm guitar, timing; the registry and the shared drill key.
   Run by ../smoke.js, in order, against its one booted page: the blocks share that page's
   state, so an area may rely on what an earlier one left behind. */
'use strict';
module.exports = function (ctx) {
  const { ok, approx, html, dom, win, T, byShort } = ctx;


  /* ---- 3c: note-naming drill — target positions, scoring, learner writes ---- */
  (function noteDrill() {
    // drillTargetsFor mirrors the board's cell set (open strings + window)
    const eT = T.drillTargetsFor(4);   // pc 4 = E
    ok('3c: targets include both open E strings', eT.has('0:0') && eT.has('5:0'));
    ok('3c: targets find E on the A string at fret 7', eT.has('4:7'));
    ok('3c: targets exclude a wrong position', !eT.has('1:0'));   // B string open = B, not E

    T.resetLearner();
    T.startDrill();
    let d = T.getDrill();
    ok('3c: drill starts active', !!d && !d.finished);
    ok('3c: session length = DRILL_LEN', d.total === T.DRILL_LEN);
    ok('3c: first prompt has a target pc', Number.isInteger(d.targetPc));

    // a wrong tap (a position of a DIFFERENT note) registers a miss, never advances
    const wrongPos = [...T.drillTargetsFor((d.targetPc + 1) % 12)][0];
    const [wsi, wf] = wrongPos.split(':').map(Number);
    const wrongBefore = T.getDrill().totalWrong;
    T.drillAnswer(wsi, wf);
    ok('3c: wrong tap counts a miss', T.getDrill().totalWrong === wrongBefore + 1);
    ok('3c: wrong tap does not advance the prompt', T.getDrill().done === 0);

    // drive the whole session correctly: answer every target of each prompt
    let guard = 0;
    while (!T.getDrill().finished && guard++ < 50) {
      const cur = T.getDrill();
      for (const key of T.drillTargetsFor(cur.targetPc)) { const [si, f] = key.split(':').map(Number); T.drillAnswer(si, f); }
    }
    const fin = T.getDrill();
    ok('3c: drill finishes after all prompts', fin.finished);
    ok('3c: every prompt scored', fin.done === fin.total);
    // only the first prompt had a wrong tap, so exactly one prompt is non-clean
    ok('3c: clean prompts = total - 1 (the one with a wrong tap)', fin.correctPrompts === fin.total - 1);

    // learner writes: one item per distinct note prompt + one bounded session
    ok('3c: per-note attempts recorded to learner', T.learnerStats().items === fin.total);
    const sessions = T.getLearner().sessions;
    ok('3c: a session was recorded', sessions.length === 1);
    ok('3c: session score = clean-prompt accuracy %',
       sessions[0].score === Math.round((fin.correctPrompts / fin.total) * 100));

    T.exitDrill();
    ok('3c: exit clears the active drill', T.getDrill() === null);
    T.resetLearner();
  })();

  /* ---- Phase 4: the three recognition drills, now an Ear group under Practice ---- */
  (function earMode() {
    const doc = win.document;
    const nav = doc.getElementById('mainnav');
    const dests = [...nav.querySelectorAll('.navbtn')].map(b => b.dataset.panel);
    // Ear was a top-level mode once; it is a Practice pillar, and after A2 the nav
    // holds four destinations — three reference subjects and Practice — not five.
    ok('P4: ear folded into Practice — no ear destination in the nav',
       dests.length === 3 && dests.indexOf('ear') < 0, dests.join(','));
    ok('P4: the separate ear panel + home are gone',
       !doc.getElementById('panel-ear') && !doc.getElementById('ear-home')
       && !doc.getElementById('ear-progress') && !doc.querySelector('.ear-panel'));
    ok('P4: ear drill area now lives inside the practice panel',
       !!doc.querySelector('#panel-practice #ear-area'));
    ok('P4: reference shell: 2 subjects / 2 reference panels',
       dests.filter(d => d !== 'practice').length === 2 && doc.querySelectorAll('.main > .panel').length === 2);
    // two ear drill starters, now cards in the practice home
    ['start-interval', 'start-chordq'].forEach(id =>
      ok('P4: ear drill starter present in practice home: ' + id,
         !!doc.querySelector('#practice-home #' + id)));

    // the ear drills ride the Practice mode: body classes + button state + persistence
    T.setMode('practice');
    ok('P4: body marks practice mode only',
       doc.body.classList.contains('mode-practice')
       && !doc.body.classList.contains('mode-ear') && !doc.body.classList.contains('mode-activity')
       && !doc.body.classList.contains('mode-reference'));
    const eBtn = nav.querySelector('.navbtn[data-panel="practice"]');
    ok('P4: the Practice destination reads as current',
       eBtn.classList.contains('active') && eBtn.getAttribute('aria-selected') === 'true');
    ok('P4: state() / persistence carry mode practice',
       T.state().currentMode === 'practice' &&
       JSON.parse(win.localStorage.getItem('guitarStudio.v1') || '{}').mode === 'practice');

    // ---- interval drill: ids namespaced interval:*, fixed 12-choice grid ----
    T.resetLearner();
    T.startEar('interval');
    let e = T.getEar();
    ok('P4: interval drill starts active', !!e && !e.finished && e.type === 'interval');
    ok('P4: interval session length = 8 (a narrow pool is dealt again)', e.total === 8);
    ok('P4: interval prompt has an interval + base midi',
       e.cur && typeof e.cur.iv === 'object' && Number.isInteger(e.cur.base));
    ok('P4: interval id is namespaced interval:*', /^interval:/.test(e.cur.key));
    ok('step 9: a new player starts narrow: three intervals (M3, P5, P8)', T.earChoices().map(c => c.html).join() === 'M3,P5,P8');

    // a wrong guess records a miss and never the prompt's item as correct
    const wrongKey = T.INTERVALS.map(iv => 'interval:' + iv.name).find(k => k !== e.cur.key);
    T.earAnswer(wrongKey);
    e = T.getEar();
    ok('P4: wrong guess counts a miss + marks answered', e.totalWrong === 1 && e.answered === true);
    ok('P4: a second guess on the same prompt is ignored', (T.earAnswer(e.cur.key), T.getEar().correctPrompts === 0));
    T.earNext();
    ok('P4: Next advances to a fresh prompt', T.getEar().answered === false && T.getEar().done === 1);

    // drive the rest correctly
    let guard = 0;
    while (!T.getEar().finished && guard++ < 50) {
      const cur = T.getEar().cur; T.earAnswer(cur.key); T.earNext();
    }
    const fin = T.getEar();
    ok('P4: interval drill finishes after all prompts', fin.finished && fin.done === fin.total);
    ok('P4: exactly one prompt was non-clean (the wrong guess)', fin.correctPrompts === fin.total - 1);
    ok('P4: every prompt is an attempt in the learner, on the narrow pool',
       T.learnerStats().seen === fin.total && T.learnerStats().items <= 3);
    const sess = T.getLearner().sessions;
    ok('P4: an ear session was recorded with ear-interval label',
       sess.length === 1 && sess[0].drill === 'ear-interval');
    ok('P4: session score = correct-prompt accuracy %',
       sess[0].score === Math.round((fin.correctPrompts / fin.total) * 100));

    // ---- chord-quality drill: chordq:* ids, 8-choice grid ----
    T.resetLearner();
    T.startEar('chordq');
    const ec = T.getEar();
    ok('P4: chordq drill starts, 8 prompts', ec.type === 'chordq' && ec.total === 8);
    ok('P4: chordq id is namespaced chordq:*', /^chordq:/.test(ec.cur.key));
    ok('step 9: ...and major vs minor', T.earChoices().map(c => c.html).join() === 'maj,m');
    ok('P4: chordq prompt carries a quality index + root', Number.isInteger(ec.cur.qi) && Number.isInteger(ec.cur.root));

    // the rhythm-ear drill was cut in step 1: no starter, no card
    T.exitEar();
    ok('step 1: rhythm ear no longer starts', (T.startEar('rhythm'), T.getEar() === null));

    T.exitEar();
    ok('P4: exit clears the active ear drill', T.getEar() === null);
    T.setMode('reference');
    T.resetLearner();
  })();

  /* ---- step 3: quick UI fixes ---- */
  (function quickUiFixes() {
    const doc = win.document;
    T.setMode('reference'); T.setKey(9, 'A'); T.setGMode('names');

    /* step 11: no heading above the neck — the lens names the view; its description
       folds under the neck behind the lens's ? and follows the view */
    const L = T.I18N[T.state().lang], desc = () => doc.getElementById('view-desc').textContent;
    T.selectTab('harmony'); T.setHView('arp');
    ok('step 11: no view heading above the neck', !doc.getElementById('view-head') && !doc.getElementById('harmony-h') && !doc.getElementById('scales-h'));
    ok('step 11: the ? sits in the lens row', !!doc.querySelector('#board-lens .ph-help'));
    ok('step 11: the description follows the view (Arpeggio)', desc() === L.arp_p);
    T.setHView('chords');
    T.selectTab('scales'); T.setScView('notes');
    ok('step 11: ...and the sub-view (Notes)', desc() === L.nt_p);
    T.setScView('scale');

    /* chord-shape cards: selectable, and the selected one rings its notes on the neck */
    T.selectTab('harmony'); T.setHView('chords'); T.setChTriads(false); T.setChQual(1);
    T.renderAllBoards();
    const cards = () => [...doc.querySelectorAll('#ch-diagram .chordbox')];
    ok('step 3: only the selected card says it plays',
       cards().filter(c => c.querySelector('.cb-plays')).map(c => c.dataset.v).join() === '0');
    const ringCount = v => v.frets.filter(f => f != null).length;
    const list = T.currentChordVoicing().list;
    ok('step 3: the selected shape is ringed on the neck, one ring per played string',
       doc.querySelectorAll('#board .dot.in-shape').length === ringCount(list[0]));
    cards()[1].click();
    ok('step 3: a card click selects that voicing', T.state().chVoicing === 1);
    ok('step 3: ...moves the "plays" label to it', !!cards()[1].querySelector('.cb-plays') && !cards()[0].querySelector('.cb-plays'));
    const rings = [...doc.querySelectorAll('#board .dot.in-shape')].map(d => +d.dataset.midi).sort((a, b) => a - b);
    ok('step 3: ...and the rings to its notes', rings.join() === T.voicingMidi(list[1]).sort((a, b) => a - b).join(), rings.join());
    ok('step 3: ...keeping keyboard focus on the chosen card', doc.activeElement === cards()[1]);
    T.setTuningIdx(1);   // Drop D: the standard-tuning cards no longer match the neck
    T.renderAllBoards();
    ok('step 3: on another tuning nothing is ringed', !doc.querySelector('#board .dot.in-shape'));
    T.setTuningIdx(0); T.setChVoicing(0); T.renderAllBoards();
    ok('step 3: revealFrets is a no-op without layout', (T.revealFrets(doc.getElementById('board'), [5, 9]), true));

    /* a zoomed range that can't hold the picked box gives way to the whole neck */
    const fretCells = id => doc.querySelectorAll('#' + id + ' .srow:first-child .cell').length;
    T.setFret(1); T.selectTab('scales'); T.setScView('scale');
    doc.querySelectorAll('#sc-pos .btn')[0].click();
    ok('step 3: the 1–5 zoom paints 5 frets for the whole-neck view', fretCells('board') === 5);
    doc.querySelectorAll('#sc-pos .btn')[4].click();   // A minor pos 4: frets 12–16
    ok('step 3: a box outside the zoom paints the whole neck', fretCells('board') === T.FRET_RANGES[0].hi);
    ok('step 3: ...without touching the saved range', T.state().fretRangeIdx === 1 && T.FRET_HI() === 5);
    doc.querySelectorAll('#sc-pos .btn')[1].click();   // pos 1: frets 5–9, still outside 1–5
    doc.querySelectorAll('#sc-pos .btn')[0].click();
    ok('step 3: back to the whole-neck view, the zoom returns', fretCells('board') === 5);
    T.setMode('practice'); T.startTrack('timing');
    doc.querySelectorAll('#sd-pos .btn')[3].click();
    ok('step 3: the timing drill’s box gets the whole neck too', fretCells('sd-board') === T.FRET_RANGES[0].hi
       && doc.querySelectorAll('#sd-board .sd-dot.pal').length > 0);
    T.exitAllDrills(); T.setMode('reference');
    T.setFret(0); T.selectTab('harmony'); T.renderAllBoards();

    /* drill summaries lead back to the view that teaches the misses */
    T.resetLearner();
    T.setMode('practice'); T.startDrill();
    const missed = T.getDrill().targetPc;
    const [wsi, wf] = [...T.drillTargetsFor((missed + 1) % 12)][0].split(':').map(Number);
    T.drillAnswer(wsi, wf);
    let guard = 0;
    while (!T.getDrill().finished && guard++ < 50) {
      for (const key of T.drillTargetsFor(T.getDrill().targetPc)) { const [si, f] = key.split(':').map(Number); T.drillAnswer(si, f); }
    }
    let rv = [...doc.querySelectorAll('#drill-summary [data-rv]')];
    ok('step 3: the note summary offers the one missed note', rv.length === 1 && rv[0].textContent.startsWith(T.noteTxt(['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][missed])));
    rv[0].click();
    ok('step 3: ...which opens Scales ▸ Notes with that note lit',
       T.state().currentMode === 'reference' && T.state().currentTab === 'scales' && T.state().scView === 'notes'
       && T.state().ntRoot === ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][missed] && T.getDrill() === null);
    ok('step 3: ...and leaves the key alone', T.state().keyRoot === 9);
    T.setScView('scale');

    T.setMode('practice'); T.startDrill();
    guard = 0;
    while (!T.getDrill().finished && guard++ < 50) {
      for (const key of T.drillTargetsFor(T.getDrill().targetPc)) { const [si, f] = key.split(':').map(Number); T.drillAnswer(si, f); }
    }
    ok('step 3: a clean round has no review row', !doc.querySelector('#drill-summary .drill-review'));
    T.exitDrill();

    T.startEar('interval');
    guard = 0;
    while (!T.getEar().finished && guard++ < 50) {
      const cur = T.getEar().cur;
      T.earAnswer(T.getEar().done === 0 ? T.INTERVALS.map(iv => 'interval:' + iv.name).find(k => k !== cur.key) : cur.key); T.earNext();
    }
    rv = [...doc.querySelectorAll('#ear-summary [data-rv]')];
    ok('step 3: a missed interval offers Chord tones', rv.length === 1);
    rv[0].click();
    ok('step 3: ...opened with the Intervals display',
       T.state().currentTab === 'harmony' && T.state().hView === 'chords' && T.state().gMode === 'deg');
    T.setGMode('names');

    T.setMode('practice'); T.startEar('chordq');
    let missQ = null; guard = 0;
    while (!T.getEar().finished && guard++ < 50) {
      const cur = T.getEar().cur;
      if (T.getEar().done === 0) { missQ = cur.qi; T.earAnswer(T.earChoices().map(c => c.key).find(k => k !== cur.key)); }
      else T.earAnswer(cur.key);
      T.earNext();
    }
    rv = [...doc.querySelectorAll('#ear-summary [data-rv]')];
    ok('step 3: a missed chord quality offers that chord', rv.length === 1);
    rv[0].click();
    ok('step 3: ...opened in Chord tones on that quality, in the player’s key',
       T.state().currentTab === 'harmony' && T.state().chQual === missQ && T.state().keyRoot === 9 && T.state().chRoot === 9);
    T.setChQual(1); T.renderAllBoards();
    T.resetLearner();
  })();

  /* ---- Phase 5a: chord-change fluency (one-minute changes) coach drill ---- */
  (function changesDrill() {
    const doc = win.document;
    // home gains the Rhythm group + the new card; the drill area exists
    ok('5a: rhythm drill card present (start-changes)', !!doc.getElementById('start-changes'));
    ok('5a: chord-change area present (cm-area)', !!doc.getElementById('cm-area'));
    ok('step 11: the practice home is one list of six cards, no section labels or intro',
       doc.querySelectorAll('#practice-home .practice-list').length === 1 && doc.querySelectorAll('#practice-home .practice-list .drill-card').length === 6
       && !doc.querySelector('#practice-home .ps-label, #practice-home .practice-soon'));
    // the drill uses chord-diagram SVGs, not a fretboard, so the board count is unchanged
    // (3 total: reference #board + the note-naming and timing drill boards)
    ok('5a: no extra fretboard added', doc.querySelectorAll('.fretboard').length === 3);

    // presets + durations are sane
    ok('5a: at least 6 chord pairs', T.CM_PAIRS.length >= 6);
    ok('5a: 60s is a duration option', T.CM_DURS.indexOf(60) >= 0);

    // setup → run lifecycle
    T.resetLearner();
    T.setMode('practice');
    T.startChanges();
    ok('5a: startChanges opens setup phase', T.getCm() && T.getCm().phase === 'setup');
    T.setCmPair(3); T.setCmDur(0);          // pair index 3, 30 s
    T.cmBegin();
    let cm = T.getCm();
    ok('5a: cmBegin enters the running phase', cm.phase === 'run' && cm.pairIdx === 3 && cm.dur === 30);
    ok('5a: count starts at zero', cm.count === 0);

    // tally counts taps; undo floors at zero
    T.cmTap(); T.cmTap(); T.cmTap();
    ok('5a: each tap counts a change', T.getCm().count === 3);
    T.cmUntap();
    ok('5a: undo removes one change', T.getCm().count === 2);
    T.cmUntap(); T.cmUntap(); T.cmUntap();   // over-undo
    ok('5a: undo floors at zero', T.getCm().count === 0);

    // a 30s run with 5 changes = 10 changes/minute; finish records a session + sets a best
    for (let i = 0; i < 5; i++) T.cmTap();
    T.finishChanges();
    cm = T.getCm();
    ok('5a: finish computes changes-per-minute (5 in 30s = 10)', cm.cpm === 10);
    ok('5a: finish marks a new personal best', cm.newBest === true && cm.best === 10);
    const sessId = T.cmPairId(3);
    const sess = T.getLearner().sessions;
    ok('5a: a session is recorded under the pair id', sess.length === 1 && sess[0].drill === sessId);
    ok('5a: session score is the changes-per-minute', sess[0].score === 10);
    ok('5a: cmPairBest reads the best from sessions', T.cmPairBest(3) === 10);

    // a weaker run does not beat the best
    T.cmBegin();
    T.cmTap();                 // 1 change in 30s = 2 cpm
    T.finishChanges();
    cm = T.getCm();
    ok('5a: a weaker run is not a new best', cm.newBest === false && cm.cpm === 2);
    ok('5a: best stays at the prior record', T.cmPairBest(3) === 10);

    // changes drill writes sessions, not per-item SRS (accuracy stays about recognition)
    ok('5a: changes drill mints no learner items', T.learnerStats().items === 0);

    // exit clears the drill; leaving Practice mode also exits it
    T.exitChanges();
    ok('5a: exit clears the active drill', T.getCm() === null);
    T.startChanges();
    T.setMode('reference');
    ok('5a: leaving Practice exits a running changes drill', T.getCm() === null);
    T.resetLearner();
  })();

  /* ---- PLAN step 9: rhythm guitar — strumming & feel and comp, one drill ----
     A pattern of down/up strums, or your own rhythm, over one chord or a progression (a
     preset in the key, or the one built in the ▶ drawer); the feel layer (swing, accent,
     palm mute, band) over all of it. It records rhythm:<over>:<pattern>, and its track
     reads the strum:* and comp:* history of the two drills it replaced. */
  (function rhythmGuitar() {
    const doc = win.document;
    ok('step 9: one rhythm card instead of two', !!doc.getElementById('start-rhythm-guitar')
       && !doc.getElementById('start-strum') && !doc.getElementById('start-comp') && !doc.getElementById('start-rhythm'));
    ok('step 9: the comp drill and its area are gone', !doc.getElementById('tg-area') && !T.DRILLS.some(d => d.id === 'overchanges' || d.id === 'strum' || d.id === 'rhythm'));
    ok('step 9: the rhythm area carries the grid, the NOW/NEXT stage and the beats',
       ['sp-area', 'sp-grid', 'sp-stage', 'sp-now', 'sp-next', 'sp-beats', 'sp-over', 'sp-progs'].every(id => !!doc.getElementById(id)));
    ok('step 9: the feel controls are still there', ['sp-swings', 'sp-accent', 'sp-mute', 'sp-bass', 'sp-drums'].every(id => !!doc.getElementById(id)));
    // patterns are well-formed: 8 eighth-note slots, only D/U/'' and inline en+uk names
    ok('5b: at least 4 strum patterns', T.STRUM_PATTERNS.length >= 4);
    ok('5b: every pattern is one 4/4 bar of 8 slots',
       T.STRUM_PATTERNS.every(p => p.seg.length === 8 && p.seg.every(s => s === 'D' || s === 'U' || s === '')));
    ok('5b: every pattern carries en + uk names', T.STRUM_PATTERNS.every(p => p.en && p.uk));
    ok('5d: three swing feels, straight first', T.SP_SWINGS.length === 3 && T.SP_SWINGS[0].amt === 0 && T.SP_SWINGS[2].amt > 0
       && T.SP_SWINGS.every(s => s.en && s.uk));
    // the track carries the old history on
    const tr = T.trackById('rhythm-guitar');
    ok('step 9: one rhythm track, reading the strum and comp history', !!tr && tr.sess === 'rhythm'
       && tr.reads.join() === 'strum,comp' && !T.trackById('strum') && !T.trackById('comp'));
    ok('step 9: an old strum or comp session belongs to it', T.trackBySess('strum').id === tr.id && T.trackBySess('comp').id === tr.id);

    // a preset is laid on the key, spelled in it
    T.setKey(0, 'C');
    const bars = T.presetBars(T.SEQ_PRESETS[1]);
    ok('5c: I–V–vi–IV is four bars in the key (C G Am F)', bars.map(b => b.lbl).join(' ') === 'C G A F'
       && bars.map(b => b.qi).join() === '0,0,1,0', JSON.stringify(bars));

    T.resetLearner();
    T.initAudio();
    T.setCtxNow(0);
    T.setMode('practice');
    T.startRhythm();
    ok('step 9: it opens over the chord, not yet playing', !!T.getSp() && T.getSp().playing === false && T.getSp().over === 'chord');
    ok('step 9: ...so the strip offers the chord, not the key', !doc.getElementById('chip-chord').hidden && doc.getElementById('chip-key').hidden);
    // a pattern over one chord, with the whole feel layer on
    T.setSpPattern(2); T.setSpSwing(2); T.setSpAccent(true); T.setSpMute(true); T.setSpBand(true);
    T.spPlay();
    ok('5b: play starts the loop on the chosen pattern', T.getSp().playing === true && T.getSp().patIdx === 2);
    for (let s = 0; s <= 10; s += 0.05) { T.setCtxNow(s); T.schedAdvance(); }
    ok('5b: the playhead stays in the bar', T.getSp().slot >= 0 && T.getSp().slot < 8);
    ok('5b: at least one bar elapses with the feel layer on', T.getSp().barsPlayed >= 1);
    T.spStop();
    let ss = T.getLearner().sessions;
    ok('step 9: a run records rhythm:<over>:<pattern>', ss.length === 1 && ss[0].drill === 'rhythm:chord:common' && ss[0].score >= 1, ss.map(s => s.drill).join());
    T.setSpSwing(0); T.setSpAccent(false); T.setSpMute(false); T.setSpBand(false);

    // the progression, with your own rhythm
    T.setSpOver('prog'); T.setSpProg(2); T.setSpPattern(-1);
    ok('step 9: over a preset progression the strip offers the key, not the chord',
       !doc.getElementById('chip-key').hidden && doc.getElementById('chip-chord').hidden);
    ok('step 9: ...the stage shows NOW and NEXT, and free shows beats, not a pattern grid',
       !doc.getElementById('sp-stage').hidden && doc.getElementById('sp-grid').hidden && !doc.getElementById('sp-beats').hidden
       && /^C/.test(doc.getElementById('sp-now').textContent));
    T.setCtxNow(0);
    T.spPlay();
    ok('step 9: I–IV–V is three bars', T.getSp().bars.length === 3);
    for (let s = 0; s <= 10; s += 0.05) { T.setCtxNow(s); T.schedAdvance(); }
    ok('step 9: the bar moves through the progression', T.getSp().barsPlayed >= 3 && T.getSp().bar >= 0 && T.getSp().bar < 3);
    T.spStop();
    ss = T.getLearner().sessions;
    ok('step 9: ...and records under its name', ss[ss.length - 1].drill === 'rhythm:I–IV–V:free', ss[ss.length - 1].drill);
    // the drawer's own progression, once there is one
    const seq0 = JSON.parse(JSON.stringify(T.getSeq()));
    T.setSeq([{ pc: 2, lbl: 'D', qi: 1, bars: 2 }, { pc: 7, lbl: 'G', qi: 6, bars: 1 }]);
    T.setSpProg(-1);
    ok('step 9: "yours" is the ▶ drawer\'s progression, bar for bar', T.spBars().map(b => b.lbl).join() === 'D,D,G'
       && !!doc.querySelector('#sp-progs [data-i="-1"].active'));
    T.setSeq([]);
    T.setSpProg(-1);
    ok('step 9: ...and with none built it is not offered', !doc.querySelector('#sp-progs [data-i="-1"]') && T.spBars().length === 4);
    T.setSeq(seq0);
    // a key change re-lays a preset progression
    T.setSpProg(1);
    T.setKey(7, 'G');
    ok('step 9: a new key re-lays the progression (G D Em C)', T.getSp().bars.map(b => b.lbl).join(' ') === 'G D E C');
    T.setKey(0, 'C');
    T.setSpOver('chord'); T.setSpPattern(0);

    // the history it carries on
    T.resetLearner();
    T.recordSession('strum:common', 8, 1700000000000);
    T.recordSession('comp:ii–V–I', 12, 1700000001000);
    T.recordSession('rhythm:chord:folk', 10, 1700000002000);
    ok('step 9: the track\'s trend reads all three namespaces', T.learnerTrend('rhythm', 1700000003000).n === 3);
    T.renderPractice();
    ok('step 9: ...so the progress card has one rhythm row', [...doc.querySelectorAll('#practice-progress .pp-row')].map(r => r.dataset.track).join() === 'rhythm-guitar');

    // leaving Practice stops + clears a running drill
    T.spPlay();
    T.setMode('reference');
    ok('5b: leaving Practice exits a running rhythm drill', T.getSp() === null);
    T.setCtxNow(0);
    T.resetLearner();
  })();

  /* ---- PLAN step 9: timing by its error, your own pair, ear that widens, a home that
     says how you are doing ---- */
  (function practiceStep9() {
    const doc = win.document, DAY = 86400000, T0 = Date.now() - 3 * DAY;

    /* --- timing: with the mic the score and trend are the timing error; without, a run
       is recorded unscored and still keeps the track from falling due --- */
    T.resetLearner();
    T.recordSession('timing:eighth', 9, T0);                         // a coach run: bars, no error
    let tn = T.learnerTrend('timing');
    ok('step 9: a coach timing run is recorded but unscored', tn.n === 1 && tn.last === null && tn.unit === 'ms');
    ok('step 9: ...and keeps the track from falling due', !T.learnerReview().due.some(d => d.track === 'timing'));
    [40, 34, 30, 24].forEach((e, i) => T.recordSession('timing:eighth', 9, T0 + (i + 1) * 1000, { err: e }));
    tn = T.learnerTrend('timing');
    ok('step 9: scored runs are read on their timing error, lower is better',
       tn.last === 24 && tn.best === 24 && tn.dir === 'up' && tn.better === 'low', JSON.stringify(tn));
    T.setMode('practice');
    T.startTiming(); T.sdScore.setOn(true); T.setCalKnown(true);
    T.getSd().bars = 2; T.getSd().playing = true;
    T.sdScore._set([1, 2, 3], [1.01, 2.01, 3.01]);
    T.sdToggle();
    ok('step 9: a scored run is said aloud as its timing error', /±\d+ ms$/.test(doc.getElementById('drill-live').textContent), doc.getElementById('drill-live').textContent);
    T.sdScore.setOn(false); T.exitTiming();

    /* --- the practice home: last result, trend and a due dot on each card --- */
    T.renderPractice();
    const card = id => doc.querySelector('#practice-home .drill-card[data-track="' + id + '"]');
    ok('step 9: a card shows its last result and the direction of travel',
       /^±\d+ ms/.test(card('timing').querySelector('.dc-last').textContent) && !!card('timing').querySelector('.dc-last .pp-dir.up'));
    ok('step 9: an untouched drill shows no result, and no dot for merely being new',
       card('changes').querySelector('.dc-last').textContent === '' && !card('changes').querySelector('.dc-due'));
    T.recordAttempt('interval:M3', false, Date.now() - 120000);   // overdue
    T.recordSession('changes:C-G', 30, Date.now() - 9 * DAY);     // gone cold
    T.renderPractice();
    ok('step 9: a due dot on a drill with overdue items, and on one gone cold',
       !!card('interval').querySelector('.dc-due') && !!card('changes').querySelector('.dc-due') && !card('timing').querySelector('.dc-due'));

    /* --- one-minute changes: any two chords, barre chords included --- */
    T.startChanges();
    T.setCmPair(-1); T.setCmCustom([[6, 1], [11, 0]]);   // F♯m – B
    T.cmBegin();
    ok('step 9: your own pair runs, shapes and all', T.getCm().phase === 'run'
       && /F♯m/.test(doc.getElementById('cm-chord-a').textContent) && !!doc.querySelector('#cm-chord-b svg'));
    ok('step 9: ...under its own session id', T.cmPairId(-1) === 'changes:F#m-B');
    T.finishChanges(); T.exitChanges();
    T.startChanges();
    T.setCmPair(-1);
    doc.querySelector('#cm-pairs [data-i="-1"]').click();
    ok('step 9: the pair picker offers it, with a root and quality per chord',
       !doc.getElementById('cm-custom').hidden && doc.querySelectorAll('#cm-custom select').length === 4);
    const sel = doc.querySelector('#cm-custom select[data-k="0"][data-part="pc"]');
    sel.value = '5'; sel.dispatchEvent(new win.Event('change', { bubbles: true }));
    ok('step 9: ...and it is remembered', T.getCmCustom()[0][0] === 5
       && JSON.stringify(JSON.parse(win.localStorage.getItem('guitarStudio.v1')).cmCustom) === JSON.stringify(T.getCmCustom()));
    T.exitChanges(); T.setCmPair(0);

    /* --- ear: narrow first, wider as each level is mastered, more directions with it --- */
    T.resetLearner();
    ok('step 9: intervals start at level 1 of 4', T.earLevel('interval') === 0 && T.earPool('interval').length === 3);
    T.EAR_LEVELS.interval[0].forEach(k => { T.recordAttempt(k, true); T.recordAttempt(k, true); });
    ok('step 9: mastering a level widens the pool', T.earLevel('interval') === 1 && T.earPool('interval').length === 5);
    T.startEar('interval');
    const dirs = new Set(); for (let i = 0; i < 40; i++) { dirs.add(T.getEar().cfg.make('interval:P5').dir); }
    ok('step 9: descending joins ascending at level 2, harmonic not yet', dirs.has('up') && dirs.has('down') && !dirs.has('harm'), [...dirs].join());
    ok('step 9: the drill says the level', new RegExp('^' + T.I18N[T.state().lang].ear_level.replace('{n}', '2').replace('{m}', '4')).test(doc.getElementById('ear-count').textContent),
       doc.getElementById('ear-count').textContent);
    T.exitEar();
    T.EAR_LEVELS.chordq.forEach(l => l.forEach(k => { T.recordAttempt(k, true); T.recordAttempt(k, true); }));
    ok('step 9: chord quality widens to all eight', T.earPool('chordq').length === 8);
    T.setMode('reference');
    T.resetLearner();
    T.setCalKnown(true);
  })();

  /* ---- PLAN step 1: three drills cut, their history kept ----
     Rhythm ear, Chord-tone targeting and Call & response are gone: no card, no area, no
     track. Their history stays in the store, untouched, and nothing that reads the
     registry (review, the progress card, the session planner) trips over it. Checked
     against a captured save that holds all three. */
  (function cutDrills() {
    const doc = win.document;
    ['start-target', 'start-callresp', 'start-rhythm', 'cr-area', 'cr-board', 'tg-board']
      .forEach(id => ok('step 1: removed from the markup: #' + id, !doc.getElementById(id)));
    ok('step 1: Practice has 7 cards or fewer (6 since step 9)',
       doc.querySelectorAll('#practice-home .drill-card').length <= 6);
    ok('step 1: no Lead group left behind', !doc.querySelector('[data-i18n="practice_grp_lead"]'));

    const NOW = 1760000000000, DAY = 86400000;
    // the live state, with the cut drills' history put in — so loading it changes nothing
    // else under the assertions that follow, and restoring it afterwards is exact
    const before = JSON.parse(JSON.stringify(T.snapshotState()));
    const oldSave = Object.assign(JSON.parse(JSON.stringify(before)), {
      drillSeen: { rhythm: 1, target: 1, callresp: 1, timing: 1 },
      learner: {
        v: 2,
        items: {
          'rhythm:r3':  { seen: 4, correct: 2, streak: 0, ease: 2.1, due: NOW - DAY },
          'interval:P5': { seen: 3, correct: 3, streak: 3, ease: 2.8, due: NOW + 9 * DAY }
        },
        sessions: [
          { t: NOW - 3 * DAY, drill: 'ear-rhythm', score: 50 },
          { t: NOW - 2 * DAY, drill: 'target:I–V–vi–IV', score: 72 },
          { t: NOW - DAY,     drill: 'callresp:A', score: 80 },
          { t: NOW - DAY + 1, drill: 'timing:8ths', score: 12 }
        ],
        best: { 'target:I–V–vi–IV': { score: 72, t: NOW - 2 * DAY }, 'callresp:A': { score: 80, t: NOW - DAY } }
      }
    });
    // an old build kept progress inside the settings: no progress key of its own yet
    win.localStorage.removeItem('guitarStudio.progress.v1');
    win.localStorage.setItem('guitarStudio.v1', JSON.stringify(oldSave));
    ok('step 1: the old save loads', T.loadState() === true);
    const L = T.getLearner();
    ok('step 1: recall items of the cut drills are kept', !!L.items['rhythm:r3'] && L.items['rhythm:r3'].seen === 4);
    ok('step 1: ...and their sessions', ['ear-rhythm', 'target:I–V–vi–IV', 'callresp:A']
         .every(id => L.sessions.some(x => x.drill === id)));
    ok('step 1: ...and their personal bests', L.best['target:I–V–vi–IV'].score === 72 && L.best['callresp:A'].score === 80);
    const rev = T.learnerReview(NOW);
    ok('step 1: an overdue item of a cut track is not offered for review',
       rev.total === 0 && !rev.due.some(d => /^(rhythm|target|callresp)$/.test(d.track)), JSON.stringify(rev.due));
    ok('step 1: Next up only offers registered tracks', !!T.trackById(T.nextUp(NOW).track));
    T.setMode('practice');
    const rows = [...doc.querySelectorAll('#practice-progress .pp-row')].map(r => r.dataset.track);
    ok('step 1: the progress card has rows only for registered tracks',
       rows.length === 1 && rows[0] === 'timing', rows.join(','));
    // a save → reload keeps every byte of the cut drills' history
    T.saveState();
    const again = JSON.parse(win.localStorage.getItem('guitarStudio.progress.v1'));
    ok('step 1: saving again keeps the history of the cut drills',
       !!again.items['rhythm:r3'] && again.sessions.length === 4 && !!again.best['callresp:A']);
    win.localStorage.setItem('guitarStudio.v1', JSON.stringify(before));
    T.loadState();
    T.setMode('reference');
    T.resetLearner();
    T.setDrillSeen({});
  })();

  /* ---- Phase 7a: subdivision & timing (Foundations coach) ---- */
  (function timing() {
    const doc = win.document;
    ok('7a: timing card + area + board present',
       !!doc.getElementById('start-timing') && !!doc.getElementById('sd-area') && !!doc.getElementById('sd-board'));
    ok('7a: a Timing card sits in the practice home',
       !!doc.querySelector('#practice-home .practice-list [data-i18n="drill_timing"]'));
    ok('7a: four subdivisions (quarter → sixteenth) with the right per-beat divisions',
       T.SUBDIVS.length === 4 && T.SUBDIVS.map(s => s.div).join(',') === '1,2,3,4');

    T.resetLearner();
    T.initAudio();
    T.setCtxNow(0);
    T.setMode('practice');
    T.setKey(0, 'C');       // C Aeolian by default context
    T.setSdPos(1);
    T.setSdSub(1);          // eighths
    T.startTiming();
    let s = T.getSd();
    ok('7a: start opens the drill (paused)', s && s.playing === false);

    // the walked path is the box scale ascended then descended (a smooth run, no leaps)
    const path = T.sdPath();
    ok('7a: the walk builds a note path from the scale box', path.length >= 4);
    let asc = true; for (let i = 1; i < path.length; i++) { if (path[i].midi < path[i-1].midi) { asc = false; break; } }
    ok('7a: the path is not strictly ascending (it turns around)', !asc);

    // play, then drive one full 4/4 bar of eighths (8 ticks) + the downbeat of the next
    T.sdToggle();
    s = T.getSd();
    ok('7a: play arms the clock and captures div = 2 for eighths', s.playing === true && s.div === 2);
    for (let c = 0; c <= 8; c++) T.sdTickNow(0.01 * c, c);
    s = T.getSd();
    ok('7a: a full bar of subdivisions counts one bar', s.bars === 1);

    // stopping after ≥1 bar records a coach session and mints no per-item SRS
    T.sdToggle();
    const ss = T.getLearner().sessions;
    ok('7a: a timing session is recorded (bars played)',
       ss.length >= 1 && /^timing:eighth$/.test(ss[ss.length - 1].drill));
    ok('7a: timing mints no per-item SRS', T.learnerStats().items === 0);

    T.setMode('reference');
    ok('7a: leaving Practice exits the timing drill', T.getSd() === null);
    T.setCtxNow(0);
    T.resetLearner();
  })();

  /* ---- Drill registry: the shell must never carry a hand-written drill list ----
     Every drill self-registers (13-drill-registry.js) and setMode/applyLang iterate
     DRILLS. These checks are the drift guard: before the registry, two inline lists
     in setMode had already gone stale (the 7a timing drill was missing from both),
     which painted the practice home ON TOP of the running drill. */
  (function drillRegistry() {
    const doc = win.document;
    const R = T.DRILLS;

    // no drill-count literal here on purpose: merging or adding a drill changes the
    // count legitimately, and the markup-vs-registry check below already pins it
    // exactly. This one guards the SHAPE of each registration.
    ok('registry: every drill is registered with an id + area + isActive + begin + end',
       Array.isArray(R) && R.length > 0 &&
       R.every(d => d.id && d.area && typeof d.isActive === 'function' &&
                    typeof d.begin === 'function' && typeof d.end === 'function'));

    // the `mode` field went away with the Ear mode — every drill lives under Practice
    ok('registry: no drill carries a mode field any more',
       R.every(d => d.mode === undefined));

    ok('registry: drill ids are unique',
       new Set(R.map(d => d.id)).size === R.length);

    ok('registry: every registered area element exists in the DOM',
       R.every(d => !!doc.getElementById(d.area)));

    // the real drift guard: an area in the markup that no drill claims means a
    // drill was added without registering it — exactly the 7a failure mode.
    const domAreas = [...doc.querySelectorAll('[id$="-area"]')].map(e => e.id).sort();
    const regAreas = R.map(d => d.area).sort();
    ok('registry: every *-area in the markup is claimed by a registered drill',
       domAreas.join(',') === regAreas.join(','),
       'markup: ' + domAreas.join(',') + '  |  registry: ' + regAreas.join(','));

    const vis = id => { const e = doc.getElementById(id); return !!e && !e.hidden; };

    // Re-entering the mode you are already in must not disturb a running drill.
    // Reproduces the fixed bug: modenav has no same-mode guard, so clicking the
    // active "Practice" button re-runs setMode('practice') with a drill open.
    T.setMode('practice');
    T.startTiming();
    ok('registry: starting a drill hides the practice home',
       vis('sd-area') && !vis('practice-home'));
    T.setMode('practice');
    ok('registry: re-entering Practice leaves the running drill alone (no home on top)',
       vis('sd-area') && !vis('practice-home'));
    ok('registry: re-entering Practice does not tear the drill down', T.getSd() !== null);

    // and the generic teardown still works for a drill the old list DID cover
    T.setMode('reference');
    ok('registry: leaving Practice exits the drill and restores the home',
       T.getSd() === null && !vis('sd-area') && vis('practice-home'));

    // the ear drills are ordinary practice drills now: same home, same teardown
    T.setMode('practice');
    T.startEar('interval');
    ok('registry: an ear drill hides the shared practice home',
       vis('ear-area') && !vis('practice-home'));
    T.setMode('reference');
    ok('registry: leaving Practice exits the ear drill and restores the home',
       T.getEar() === null && !vis('ear-area') && vis('practice-home'));

    // activeDrill() reports the running drill
    T.setMode('practice');
    T.startRhythm();
    const a = T.activeDrill();
    ok('registry: activeDrill() finds the running drill', !!a && a.id === 'rhythm-guitar');

    // refreshDrillsLang is what applyLang now calls — it must repaint, not throw
    let threw = false;
    try { T.refreshDrillsLang(); } catch (e) { threw = true; }
    ok('registry: refreshDrillsLang repaints an in-flight drill without throwing', !threw);

    T.setMode('reference');
    ok('registry: no drill is left running after the mode returns to reference',
       T.activeDrill() === null);
    T.resetLearner();
  })();

  /* ---- one shared drill key: the strip's key chip (step 8; it replaced six per-drill
     key rows, then the drill header's own picker) ---- */
  (function sharedDrillKey() {
    const doc = win.document;
    ok('drill ctx: the strip\'s key chip exists', !!doc.getElementById('chip-key'));
    // the whole point: no drill carries its own copy of the key row any more
    ok('drill ctx: no per-drill key pickers remain',
       ['sp-key', 'co-key', 'gf-key', 'tg-key', 'cr-key', 'sd-key', 'drill-ctx-key', 'drill-ctx-keylbl']
         .every(id => !doc.getElementById(id)));
    ok('drill ctx: its sheet holds the root buttons',
       doc.getElementById('g-roots').children.length >= 12 && !!doc.querySelector('#sheet-key #g-roots'));
    // Quit was a seventh identical per-drill button; the shell owns it now
    ok('drill ctx: one shared Quit button', !!doc.getElementById('drill-ctx-quit'));
    // with Ear folded in, the ear drill drops its own quit too — the strip serves all
    ok('drill ctx: no per-drill quit buttons remain at all',
       ['cm-quit', 'sp-quit', 'tg-quit', 'cr-quit', 'sd-quit', 'drill-quit', 'ear-quit']
         .every(id => !doc.getElementById(id)));
    // the shared Quit must end whichever drill is up
    T.setMode('practice');
    T.startTiming();
    doc.getElementById('drill-ctx-quit').click();
    ok('drill ctx: the shared Quit exits the running drill', T.activeDrill() === null);
    ok('drill ctx: quitting restores the practice home',
       doc.getElementById('practice-home').hidden === false);
    // ...including an ear drill, which used to carry its own
    T.setMode('practice');
    T.startEar('interval');
    doc.getElementById('drill-ctx-quit').click();
    ok('drill ctx: the shared Quit exits an ear drill too',
       T.getEar() === null && doc.getElementById('practice-home').hidden === false);

    /* The key chip is only shown to a drill that declares `key`. The ear / note-naming /
       one-minute-changes drills don't re-derive from the key, so parking a key picker in
       front of them would be a control that adjusts nothing — the same defect the
       timing-calibration slider was removed for. */
    const keyShown = () => !doc.getElementById('chip-key').hidden;
    T.startTiming();
    T.applyDrillCtx();
    ok('drill ctx: a key-dependent drill (timing) shows the key picker', keyShown());
    T.exitTiming();
    T.startEar('interval');
    T.applyDrillCtx();
    ok('drill ctx: a key-independent drill (ear) hides the key picker', !keyShown());
    /* B2: no dividers left in the strip. The key picker is twelve buttons and wraps at
       phone widths, so a divider between the groups reliably landed at the START of a
       line — where it is not a separator but a stray vertical rule, the same defect B2
       fixed under PROGRESSION. The group labels do the separating. */
    ok('drill ctx: no stray vertical rules in the header',
       doc.querySelectorAll('#drill-ctx .divider').length === 0);
    T.exitEar();
    ok('drill ctx: returning to the home hides the key picker', !keyShown());

    // drillKeyChanged() must reach the RUNNING drill's onKey — for the comp
    // drill that means its bars are re-resolved into the new key, which is the behaviour
    // the drill's own picker used to own.
    T.initAudio();
    T.setMode('practice');
    T.setKey(0, 'C');
    T.startRhythm();
    T.setSpOver('prog'); T.setSpProg(1);     // I–V–vi–IV
    ok('drill ctx: bars start in the context key (C)', T.getSp().bars[0].pc === 0);
    T.setKey(7, 'G');
    T.drillKeyChanged();
    ok('drill ctx: a key change re-resolves the running drill into the new key (G)',
       T.getSp().bars[0].pc === 7, String(T.getSp().bars[0].pc));

    // a drill with nothing key-dependent simply omits onKey — that must not throw
    T.setSpOver('chord');
    T.exitRhythm();
    T.startChanges();
    let threw = false;
    try { T.drillKeyChanged(); } catch (e) { threw = true; }
    ok('drill ctx: a drill without onKey is skipped, not crashed', !threw);

    T.setMode('reference');
    T.setKey(0, 'C');
    T.resetLearner();
  })();
};
