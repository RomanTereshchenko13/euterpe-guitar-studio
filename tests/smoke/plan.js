/* Euterpe smoke suite — PLAN steps 8–12: the context strip, the key in one place, the layout pass, smaller seams.
   Run by ../smoke.js, in order, against its one booted page: the blocks share that page's
   state, so an area may rely on what an earlier one left behind. */
'use strict';
module.exports = function (ctx) {
  const { ok, approx, html, dom, win, T, byShort } = ctx;


  /* ---- PLAN step 8: the context strip, one layout grammar ----
     One row — key · chord · tempo · ▶ · tuner · ⚙ — above the neck in Reference and above
     the drill stage in Practice; one element, moved between the two. Each chip opens a
     sheet, one at a time. In a drill the row offers what the drill declares. */
  (function contextStrip() {
    const doc = win.document, st0 = T.state(), seq0 = JSON.parse(JSON.stringify(T.getSeq()));
    const vis = id => { const e = doc.getElementById(id); return !!e && !e.hidden && !e.closest('[hidden]'); };
    const strip = doc.getElementById('strip');
    T.dismissWelcome();
    T.setMode('reference'); T.selectTab('harmony'); T.setHView('chords'); T.closeSheets();

    /* --- where it lives --- */
    ok('step 8: one strip, above the neck in Reference', strip.parentNode.id === 'strip-ref');
    ok('step 8: ...every chip on it', ['chip-key', 'chip-chord', 'chip-tempo', 'chip-play', 'backing-toggle', 'tb-tuner', 'tb-toggle'].every(vis));
    T.setMode('practice');
    ok('step 8: in Practice the same element sits under the drill header',
       strip.parentNode.id === 'strip-drill' && doc.querySelectorAll('#strip').length === 1);
    ok('step 8: on the Practice home it offers only the tuner and Settings',
       vis('tb-tuner') && vis('tb-toggle') && ['chip-key', 'chip-chord', 'chip-tempo', 'chip-play', 'backing-toggle'].every(id => !vis(id)));
    T.setMode('reference');
    ok('step 8: ...and goes back above the neck', strip.parentNode.id === 'strip-ref');

    /* --- the sheets: a chip opens its own, one at a time --- */
    doc.getElementById('chip-key').click();
    ok('step 8: the key chip opens the key sheet', vis('sheet-key') && doc.getElementById('chip-key').getAttribute('aria-expanded') === 'true');
    doc.getElementById('chip-chord').click();
    ok('step 8: opening another shuts the first', vis('sheet-chord') && !vis('sheet-key')
       && doc.getElementById('chip-key').getAttribute('aria-expanded') === 'false');
    doc.getElementById('chip-chord').click();
    ok('step 8: the chip again shuts it', !vis('sheet-chord') && doc.getElementById('sheets').hidden);
    doc.getElementById('tb-toggle').click();
    ok('step 8: ⚙ opens Settings, and it is remembered', vis('toolbar') && T.state().toolbarOpen === true
       && JSON.parse(win.localStorage.getItem('guitarStudio.v1')).toolbarOpen === true);
    doc.querySelector('#toolbar [data-close]').click();
    ok('step 8: a sheet\'s ✕ shuts it and hands focus back to its chip',
       !vis('toolbar') && doc.activeElement === doc.getElementById('tb-toggle'));

    /* --- the key sheet: root, scale family + more, and the circle as the picker --- */
    T.setKey(9, 'A', 5); T.setChQual(1);
    T.toggleSheet('key');
    ok('step 8: the key chip names the key', /^A minor|^A мінор/.test(doc.getElementById('chip-key').textContent),
       doc.getElementById('chip-key').textContent);
    const fams = () => [...doc.querySelectorAll('#sc-fams [data-sc]')].map(b => +b.dataset.sc);
    ok('step 8: the common keys first (major, minor, the pentatonics, blues)', fams().join() === '0,5,7,8,9', fams().join());
    doc.getElementById('sc-fams-toggle').click();
    ok('step 8: "more" adds the modes', fams().length === T.SCALES.length);
    doc.getElementById('sc-fams-toggle').click();
    T.setChord(4, 'E', 6);   // E7, the V of A minor
    doc.querySelector('#sc-fams [data-sc="0"]').click();
    ok('step 8: a scale pick moves the key\'s scale and keeps the root and the chord',
       T.state().scIdx === 0 && T.state().keyRoot === 9 && T.state().chRoot === 4 && T.state().chQual === 6);
    T.setScale(1);           // Dorian lives behind "more"
    ok('step 8: a key in "more" opens it by itself', fams().length === T.SCALES.length
       && doc.querySelector('#sc-fams [data-sc="1"]').classList.contains('active'));
    ok('step 8: the circle is in the key sheet', !!doc.querySelector('#sheet-key #cof-svg .cof-node') && !!doc.querySelector('#sheet-key #cof-info'));
    doc.querySelector('#g-roots [data-pc="7"]').click();
    ok('step 8: a root button sets the key', T.state().keyRoot === 7 && T.state().scIdx === 1);
    T.toggleSheet('key');

    /* --- the chord sheet: the key's degrees first, then the quality --- */
    T.setKey(0, 'C', 0); T.toggleSheet('chord');
    ok('step 8: the chord sheet opens on the key\'s seven degrees', doc.querySelectorAll('#sheet-chord #h-degrees [data-deg]').length === 7);
    const quals = () => [...doc.querySelectorAll('#ch-quals button')];
    quals().find(b => b.textContent === 'm').click();
    ok('step 8: a quality changes the chord, keeps its root', T.state().chRoot === 0 && T.QUALITIES[T.state().chQual].short === 'm'
       && /^Cm/.test(doc.getElementById('chip-chord').textContent));
    ok('step 8: the quality row no longer sits under the neck', !doc.querySelector('.main #ch-quals') && !doc.querySelector('.main #h-degrees'));
    doc.getElementById('ch-quals-toggle').click();
    ok('step 8: "more" opens the sevenths and extensions', quals().length === T.QUALITIES.length);
    doc.getElementById('ch-quals-toggle').click();
    T.toggleSheet('chord');

    /* --- the tempo sheet: BPM and meter, one chip --- */
    T.setTempo(90);
    const mt = doc.getElementById('tb-meter'); mt.value = '1'; mt.dispatchEvent(new win.Event('change'));
    ok('step 8: the tempo chip reads ♩ BPM · meter', /90 · 3\/4/.test(doc.getElementById('chip-tempo').textContent), doc.getElementById('chip-tempo').textContent);
    mt.value = '2'; mt.dispatchEvent(new win.Event('change'));

    /* --- the one ▶ and its drawer --- */
    T.initAudio();
    T.setChTriads(false);
    ok('step 8: ▶ says what it will play', /^▶C/.test(doc.getElementById('g-play').textContent.replace(/\s/g, '')), doc.getElementById('g-play').textContent);
    T.stripPlay();
    ok('step 8: ▶ loops the chord', T.state().loop && doc.getElementById('g-play').classList.contains('active')
       && doc.getElementById('g-play').getAttribute('aria-pressed') === 'true');
    T.stripPlay();
    ok('step 8: ...and the same press stops it', !T.transportActive());
    T.applyPreset(T.SEQ_PRESETS[2]);
    doc.getElementById('backing-toggle').click();
    ok('step 8: the caret opens the drawer: what ▶ plays, the progression, the band',
       vis('backing-panel') && ['pl-src', 'seq-presets', 'seq-strip', 'tb-bass', 'tb-drums'].every(id => !!doc.querySelector('#backing-panel #' + id)));
    doc.querySelectorAll('#pl-src .btn')[1].click();
    ok('step 8: "the progression" is remembered', T.getPlaySrc() === 'prog' && JSON.parse(win.localStorage.getItem('guitarStudio.v1')).playSrc === 'prog');
    T.stripPlay();
    ok('step 8: ▶ then plays the progression', T.state().seq && !T.state().loop);
    doc.querySelectorAll('#pl-src .btn')[0].click();
    ok('step 8: switching to the chord while it plays switches what sounds', T.state().loop && !T.state().seq);
    T.stripPlay();
    T.setMode('practice');
    ok('step 8: the drawer is the reference transport\'s: shut and unoffered in Practice', !vis('backing-panel') && !vis('backing-toggle'));
    T.setMode('reference');
    ok('step 8: ...and back where it was in Reference', vis('backing-panel'));
    T.toggleSheet('play');

    /* --- the drills: the strip offers what each declares, and ▶ is the drill's verb --- */
    T.setMode('practice');
    T.startTrack('timing');
    ok('step 8: timing reads the key and the tempo: key, tempo and ▶ — no chord',
       vis('chip-key') && vis('chip-tempo') && vis('chip-play') && !vis('chip-chord'));
    ok('step 8: ...with no Play button of its own', !doc.querySelector('#sd-area .btn.play'));
    T.stripPlay();
    ok('step 8: ▶ starts the drill', T.getSd().playing === true && doc.getElementById('g-play').getAttribute('aria-pressed') === 'true');
    ok('step 8: ...and folds its setup and hint so the stage moves up', !doc.body.classList.contains('drill-setup-open') && !doc.body.classList.contains('drill-help-open'));
    T.stripPlay();
    ok('step 8: ■ stops it', T.getSd().playing === false);
    T.startTrack('rhythm-guitar');
    ok('step 8: strumming reads the chord: chord, tempo and ▶ — no key', vis('chip-chord') && vis('chip-tempo') && vis('chip-play') && !vis('chip-key'));
    T.toggleSheet('chord');
    quals().find(b => b.textContent === 'maj').click();
    ok('step 8: a chord picked in a drill reaches the drill', T.QUALITIES[T.state().chQual].short === '' && doc.getElementById('sp-chord').textContent.endsWith(' · ' + T.noteTxt(T.state().chLbl)));
    T.toggleSheet('chord');
    T.startTrack('changes');
    ok('step 8: one-minute changes: ▶ is Start', doc.getElementById('g-play').getAttribute('aria-label') === T.I18N[T.state().lang].cm_start);
    T.stripPlay();
    ok('step 8: ...then Finish, while the clock runs', T.getCm().phase === 'run' && doc.getElementById('g-play').getAttribute('aria-label') === T.I18N[T.state().lang].cm_stop);
    T.stripPlay();
    ok('step 8: ...which ends the run', T.getCm().phase === 'done');
    T.startTrack('interval');
    ok('step 8: in an ear drill ▶ is Replay, not a toggle',
       vis('chip-play') && doc.getElementById('g-play').getAttribute('aria-label') === T.I18N[T.state().lang].ear_replay
       && !doc.getElementById('g-play').hasAttribute('aria-pressed') && !doc.getElementById('ear-replay'));
    ['sd-play', 'sp-play', 'tg-play', 'cm-start-btn', 'cm-stop', 'ear-replay']
      .forEach(id => ok('step 8: no drill keeps its own play button: #' + id, !doc.getElementById(id)));
    /* the drill header is one row: name · ? · setup · 🎤 · ✕, and nothing else rides in it */
    ok('step 8: the drill header carries no key, tempo or play control',
       !doc.querySelector('#drill-ctx .root-row, #drill-ctx input, #drill-ctx .btn.play'));
    ok('step 8: ✕ is named for screen readers', doc.getElementById('drill-ctx-quit').getAttribute('aria-label') === T.I18N[T.state().lang].drill_quit);
    T.quitDrill();
    T.setMode('reference');

    /* --- every screen: exactly one tempo control and one play control --- */
    // shown = not under [hidden], and not in the layer the mode's CSS collapses
    const plays = () => [...doc.querySelectorAll('.btn.play, #g-play')].filter(b => !b.closest('[hidden]') && !b.closest('.drill-summary')
      && !b.closest(T.state().currentMode === 'practice' ? '.main > .panel, .aside, #shapes-card, #strip-ref' : '#panel-practice'));
    T.selectTab('harmony');
    ok('step 8: Reference shows one play control', plays().length === 1, plays().map(b => b.id || b.className).join());
    ok('step 8: ...and one tempo control', doc.querySelectorAll('input[type="range"][id$="tempo"]').length === 1);
    T.setMode('practice'); T.startTrack('timing');
    ok('step 8: a drill shows one play control too', plays().length === 1, plays().map(b => b.id || b.className).join());
    T.quitDrill(); T.setMode('reference');

    /* --- the header: brand only; language in Settings, version in the footer --- */
    ok('step 8: the header holds the brand and the nav, no controls',
       !doc.querySelector('header .lang, header .ver, header .btn, header select, header input'));
    ok('step 8: the language switch is in Settings ▸ Display', !!doc.querySelector('#toolbar #lang-switch .langbtn'));
    ok('step 8: the version badge is in the footer', !!doc.querySelector('footer #app-ver'));

    /* --- old saves on the circle open Scales with the key sheet --- */
    const mig = T.migrateSave({ tab: 'circle', scView: 'notes' });
    ok('step 8: a save on the circle tab migrates to Scales with the key sheet', mig.tab === 'scales' && mig.keySheet === true && mig.scView === 'notes');
    ok('step 8: ...and the marker is never saved', !('keySheet' in T.snapshotState()));

    // put everything back
    T.closeSheets();
    T.setPlaySrc('chord');
    T.seqClear(); T.setSeq(seq0);
    T.setTempo(st0.tempo);
    T.setKey(st0.keyRoot, st0.keyLbl, st0.scIdx);
    T.setChord(st0.chRoot, st0.chLbl, st0.chQual);
    T.selectTab('harmony'); T.setHView('chords');
    T.resetLearner();
  })();

  /* ---- PLAN step 10: wrong output, and the key's chords in one place ----
     The key panel names the key by its own scale and reads a mode's signature from its
     parent major; the key's chords are the chord sheet's degree row only (one roman-numeral
     system, keyDegrees); Scales shows the strip's chord over the scale with one toggle; the
     footer claims no tuning; the tempo sheet's free Metronome is not offered in a drill. */
  (function keyOnePlace() {
    const doc = win.document, st0 = T.state(), L = T.I18N[st0.lang];
    const vis = id => { const e = doc.getElementById(id); return !!e && !e.hidden && !e.closest('[hidden]'); };
    const info = () => doc.getElementById('cof-info').textContent;
    T.setMode('reference'); T.closeSheets();
    T.toggleSheet('key');

    /* --- the key panel --- */
    T.setKey(9, 'A', 5);
    ok('step 10: A minor is titled by its key, not its tonic chord ("Am minor")',
       info().startsWith('A ' + T.SCALES[5].kn[st0.lang]) && !/Am\s/.test(info().slice(0, 12)), info().slice(0, 40));
    T.setKey(9, 'A', 1);
    ok('step 10: A Dorian is titled A Dorian', info().startsWith('A ' + T.SCALES[1].kn[st0.lang]), info().slice(0, 40));
    ok('step 10: ...written in its parent\'s signature (G major: one sharp, F♯)', info().includes('1 ♯ — F♯'), info());
    ok('step 10: ...and names that parent instead of a relative major', info().includes(L.samenotes + ' G ') && !info().includes(L.cof_rel_major), info());
    // the signature each scale is written in: a mode's parent, any other scale its family's key
    const sigs = [[4, 'E', 2, 0], [5, 'F', 3, 0], [2, 'D', 4, 1], [11, 'B', 6, 0], [9, 'A', 10, 0], [4, 'E', 7, 1],
                  [7, 'G', 8, 1], [10, 'Bb', 0, -2], [2, 'D', 9, -1]];
    const badSig = sigs.filter(([pc, lbl, sc, n]) => {
      T.setKey(pc, lbl, sc);
      const want = n === 0 ? L.cof_sig0 : n > 0 ? n + ' ♯' : (-n) + ' ♭';
      return !info().includes(L.cof_sig + ': ' + want);
    }).map(x => x[1] + '/' + x[2]);
    ok('step 10: every scale reads its signature from its parent or family key', badSig.length === 0, badSig.join(' '));
    T.setKey(9, 'A', 5);
    ok('step 10: the key panel no longer lists the key\'s chords', !doc.querySelector('#cof-info .cof-deg') && !/\bVII\b/.test(info()), info());
    T.toggleSheet('chord');
    const rn = [...doc.querySelectorAll('#h-degrees .deg-rn')].map(e => e.textContent);
    ok('step 10: ...the chord sheet does, with keyDegrees\' numerals (A minor: ♭III ♭VI ♭VII)',
       ['♭III', '♭VI', '♭VII'].every(r => rn.includes(r)), rn.join(' '));
    T.closeSheets();

    /* --- Scales: the strip's chord over the scale, one toggle --- */
    T.selectTab('scales'); T.setScView('scale');
    const btn = doc.getElementById('sc-chord');
    ok('step 10: the Scales chord row is gone, one toggle in its place', !doc.getElementById('sc-diatonic') && vis('sc-chord'));
    T.setChord(4, 'E', 0);                                     // E over A minor: G♯ is outside the scale
    ok('step 10: the toggle names the strip\'s chord', btn.textContent.includes('E') && btn.getAttribute('aria-pressed') === 'false', btn.textContent);
    ok('step 10: ...and is off: the plain scale', !doc.querySelector('#board .dot.d-dim'));
    btn.click();
    const byPc = pc => [...doc.querySelectorAll('#board .dot')].filter(d => ((+d.dataset.midi % 12) + 12) % 12 === pc);
    ok('step 10: on, the chord\'s tones take their chord colours (E root, G♯ third, B fifth)',
       byPc(4).every(d => d.classList.contains('d-root')) && byPc(11).every(d => d.classList.contains('d-fifth')) && byPc(4).length > 0,
       byPc(4).map(d => d.className).join());
    ok('step 10: ...a chord tone outside the scale is shown too (G♯)', byPc(8).length > 0 && byPc(8).every(d => d.classList.contains('d-third')));
    ok('step 10: ...and the rest of the scale is dimmed', byPc(0).length > 0 && byPc(0).every(d => d.classList.contains('d-dim')));
    T.setChord(2, 'D', 1);
    ok('step 10: it follows the chord as it moves (Dm: D is the root, E dimmed, no G♯)', btn.textContent.includes('D') && btn.getAttribute('aria-pressed') === 'true'
       && byPc(2).length > 0 && byPc(2).every(d => d.classList.contains('d-root'))
       && byPc(4).every(d => d.classList.contains('d-dim')) && byPc(8).length === 0);
    ok('step 10: the overlay is not saved', !('scOverlay' in T.snapshotState()) && !('scShowChord' in T.snapshotState()));
    btn.click();
    ok('step 10: off again, the plain scale', btn.getAttribute('aria-pressed') === 'false' && !doc.querySelector('#board .dot.d-dim'));

    /* --- the footer --- */
    const foot = doc.querySelector('footer');
    ok('step 10: the footer claims no tuning and repeats no brand', !/E A D G B e|Euterpe/.test(foot.textContent), foot.textContent);
    ok('step 10: ...it holds the version badge and the shortcuts link', !!foot.querySelector('#app-ver') && !!foot.querySelector('#kbd-open'));

    /* --- the tempo sheet's click: since step 11 one "click with ▶", offered wherever the
       tempo is (step 10 hid the free metronome in drills) --- */
    ok('step 11: the tempo sheet offers the click in Reference', !doc.getElementById('tb-metro').hidden);
    T.setMode('practice'); T.startTrack('changes');
    ok('step 11: ...and inside a drill with a tempo, which honours it', T.chipOffered('tempo') && !doc.getElementById('tb-metro').hidden);
    T.quitDrill(); T.setMode('reference');

    // put everything back
    T.setKey(st0.keyRoot, st0.keyLbl, st0.scIdx);
    T.setChord(st0.chRoot, st0.chLbl, st0.chQual);
    T.selectTab('harmony'); T.setHView('chords');
  })();

  /* ---- PLAN step 11: the neck higher, one control per job ----
     The tuner and Settings live in the app header; the strip is key · chord · tempo · ▶
     and a screen that offers none of them has no strip row. One metronome: the tempo
     sheet's "click with ▶", honoured by the reference loop and the drills, saved. The ▶
     drawer has no Jam and shows the progression editor only for a progression. */
  (function layoutPass() {
    const doc = win.document, st0 = T.state();
    const vis = id => { const e = doc.getElementById(id); return !!e && !e.hidden && !e.closest('[hidden]'); };
    T.setMode('reference'); T.closeSheets();

    /* --- the header holds the tools; the strip holds the context --- */
    ok('step 11: the tuner and Settings are in the app header',
       !!doc.querySelector('header #tb-tuner') && !!doc.querySelector('header #tb-toggle') && !doc.querySelector('#strip #tb-tuner, #strip #tb-toggle'));
    ok('step 11: the strip is key · chord · tempo · ▶',
       [...doc.querySelectorAll('#strip-row > *')].map(e => e.id).join() === 'chip-key,chip-chord,chip-tempo,chip-play');
    doc.getElementById('tb-toggle').click();
    ok('step 11: the header gear still opens Settings', vis('toolbar') && doc.getElementById('tb-toggle').getAttribute('aria-expanded') === 'true');
    T.closeSheets();
    T.setMode('practice');
    ok('step 11: the Practice home has no strip row', !vis('strip-row'));
    T.startDrill();
    ok('step 11: ...nor does note naming, which declares no key, chord, tempo or ▶', !vis('strip-row'));
    T.exitDrill();
    T.startTrack('changes');
    ok('step 11: a drill with a tempo and a ▶ has its row', vis('strip-row') && vis('chip-tempo') && vis('chip-play'));
    ok('step 11: the drill has no Click button of its own', !doc.getElementById('cm-click') && !doc.getElementById('sp-click'));
    ok('step 11: One-minute changes promises no mic scoring', !/згодом|comes later/.test(doc.getElementById('cm-setup-note').textContent));
    T.quitDrill();
    T.startRhythm();
    const sb = doc.getElementById('drill-ctx-setup');
    ok('step 11: the drill header\'s setup handle is an icon with a name',
       !sb.hidden && !!sb.querySelector('svg') && sb.textContent.trim() === '' && sb.getAttribute('aria-label') === T.I18N[st0.lang].drill_setup);
    T.exitRhythm(); T.setMode('reference');

    /* --- the ▶ drawer --- */
    T.setPlaySrc('chord');
    T.toggleSheet('play');
    ok('step 11: the drawer has no Jam', !doc.getElementById('pl-jam') && vis('tb-bass') && vis('tb-drums'));
    ok('step 11: ...and no progression editor while ▶ plays the chord', !vis('ch-seq'));
    T.setPlaySrc('prog');
    ok('step 11: ...which shows for the progression', vis('ch-seq'));
    T.setPlaySrc('chord'); T.closeSheets();

    /* --- one metronome: click with ▶ --- */
    T.initAudio();
    const ctx = win.__AC.__ctx, mk = ctx.createOscillator;
    let squares = 0;
    ctx.createOscillator = () => { const o = mk(); return new Proxy(o, { set(t, k, v) { if (k === 'type' && v === 'square') squares++; t[k] = v; return true; } }); };
    const run = () => { squares = 0; ctx.currentTime = 0; T.loopToggle();
      for (let tms = 0; tms <= 3000; tms += 25) { ctx.currentTime = tms / 1000; T.schedAdvance(); }
      T.loopToggle(); return squares; };
    if (T.getClickOn()) T.clickToggle();
    const quiet = run();
    T.clickToggle();
    const clicked = run();
    ctx.createOscillator = mk;
    ok('step 11: the click is off by default: the loop schedules none', quiet === 0, String(quiet));
    ok('step 11: on, the reference loop clicks every beat', clicked >= 4, String(clicked));
    ok('step 11: the click starts no transport of its own', !T.transportActive());
    ok('step 11: ...the tempo chip and the tempo sheet say it is on',
       doc.getElementById('chip-tempo').classList.contains('on') && doc.getElementById('tb-metro').getAttribute('aria-pressed') === 'true');
    ok('step 11: ...and it is saved', T.snapshotState().clickOn === true);
    ok('step 11: an older save has the click off', T.migrateSave({}).clickOn === undefined);
    T.clickToggle();

    T.setKey(st0.keyRoot, st0.keyLbl, st0.scIdx);
    T.setChord(st0.chRoot, st0.chLbl, st0.chQual);
  })();

  /* ---- PLAN step 12: smaller seams ----
     Rhythm guitar's band is the drawer's Bass and Drums; the circle's colours mean what
     they mean on the neck; a phone's key sheet folds the circle; note naming stops at
     the 12th fret. (Next up, which replaced the timed session, is tested with the seam.) */
  (function smallerSeams() {
    const doc = win.document, st0 = T.state();
    T.setMode('reference'); T.closeSheets();

    /* --- the circle: tonic green, V the fifth's blue, IV and the relative key a ring --- */
    T.setKey(0, 'C', 0); T.toggleSheet('key');
    const node = (i, type) => doc.querySelector('#cof-svg .cof-node[data-i="' + i + '"][data-type="' + type + '"] circle');
    ok('step 12: the tonic is the root\'s green', node(0, 'maj').getAttribute('fill') === 'var(--root)');
    ok('step 12: V (G) is the fifth\'s blue, as the 5th is on the neck', node(1, 'maj').getAttribute('fill') === 'var(--fifth)');
    ok('step 12: IV (F) takes no colour, only a ring',
       node(11, 'maj').getAttribute('fill') === 'var(--bg-panel-2)' && +node(11, 'maj').getAttribute('stroke-width') > 2);
    ok('step 12: ...and so does the relative key (Am)',
       node(0, 'min').getAttribute('fill') === 'var(--bg-panel)' && +node(0, 'min').getAttribute('stroke-width') > 2);
    ok('step 12: no circle node reuses the third or seventh colour',
       ![...doc.querySelectorAll('#cof-svg circle')].some(c => /--third|--seventh/.test(c.getAttribute('fill'))));
    /* --- a phone's key sheet folds the circle behind a toggle (CSS-only; pinned by rule) --- */
    const tog = doc.getElementById('cof-toggle');
    ok('step 12: the key sheet has a Circle of fifths toggle', !!tog && tog.getAttribute('aria-controls') === 'cof-wrap');
    tog.click();
    ok('step 12: ...which unfolds the circle', doc.querySelector('#sheet-key .key-layout').classList.contains('cof-open') && tog.getAttribute('aria-expanded') === 'true');
    tog.click();
    ok('step 12: on a phone the circle is folded until asked for (desktop shows the toggle not at all)',
       /@media \(max-width: 940px\) \{[^@]*\.cof-toggle \{ display: inline-flex; \}\s*\.key-layout:not\(\.cof-open\) \.cof-wrap \{ display: none; \}/.test(html)
       && /\.cof-toggle \{ display: none; \}/.test(html));
    T.closeSheets();

    /* --- note naming: frets 0–12 whatever the range --- */
    const fr0 = T.snapshotState().fretRangeIdx;
    T.setFret(0);                                   // All frets
    T.setMode('practice'); T.startDrill();
    const frets =[...doc.querySelectorAll('#drill-board .dot.quiz')].map(d => +d.dataset.f);
    ok('step 12: note naming stops at the 12th fret', frets.length > 0 && Math.max.apply(null, frets) === 12, String(Math.max.apply(null, frets)));
    ok('step 12: ...and its targets do too', [...T.drillTargetsFor(4)].every(k => +k.split(':')[1] <= 12));
    ok('step 12: ...without touching the reference neck\'s range', T.FRET_HI() === 22);
    T.exitDrill(); T.setFret(fr0);

    /* --- rhythm guitar's band is the drawer's --- */
    T.startRhythm();
    const was = [T.state().bassOn, T.state().grooveOn];
    doc.getElementById('sp-bass').click();
    ok('step 12: Rhythm guitar\'s Bass is the drawer\'s Bass', T.state().bassOn === !was[0] && doc.getElementById('sp-bass').getAttribute('aria-pressed') === String(!was[0]));
    doc.getElementById('sp-drums').click();
    ok('step 12: ...and its Drums the drawer\'s Drums', T.state().grooveOn === !was[1]);
    doc.getElementById('sp-bass').click(); doc.getElementById('sp-drums').click();
    ok('step 12: no band flag of its own', !doc.getElementById('sp-band'));
    T.exitRhythm(); T.setMode('reference');

    T.setKey(st0.keyRoot, st0.keyLbl, st0.scIdx);
    T.setChord(st0.chRoot, st0.chLbl, st0.chQual);
  })();
};
