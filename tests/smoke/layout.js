/* Euterpe smoke suite — one function one home, the nav, the neck first, tools and cold start, the meter.
   Run by ../smoke.js, in order, against its one booted page: the blocks share that page's
   state, so an area may rely on what an earlier one left behind. */
'use strict';
module.exports = function (ctx) {
  const { ok, approx, html, dom, win, T, byShort } = ctx;


  /* ---- Phase 10/A1: one function, one home ----
     Every global verb gets exactly one control that the shell scopes to whatever is
     active. Before this the shell was cumulative: everything that was ever global
     stayed global, and each drill re-implemented locally whatever the header wouldn't
     scope for it — so a drill screen carried two Play buttons, two metronome concepts
     and (in the timing drill) two tempo controls. These checks pin the dedup. */
  (function oneFunctionOneHome() {
    const doc = win.document;

    /* --- tempo: one setter, one control per context --- */
    ok('A1: the timing drill no longer carries a private tempo stepper',
       !doc.getElementById('sd-slower') && !doc.getElementById('sd-faster') && !doc.getElementById('sd-bpm'));
    ok('step 8: the strip\'s tempo sheet holds the one tempo control, steppers included',
       ['tb-slower', 'tb-faster', 'tb-tempo', 'tb-bpm'].every(id => !!doc.querySelector('#sheet-tempo #' + id))
       && !doc.getElementById('drill-ctx-slower') && !doc.getElementById('drill-ctx-tempo'));
    // every readout is painted by the ONE setter, so none can drift from `tempo`
    T.setTempo(132);
    ok('A1: setTempo drives the readout', doc.getElementById('tb-bpm').textContent === '132 BPM');
    ok('A1: setTempo drives the slider', +doc.getElementById('tb-tempo').value === 132);
    ok('step 8: setTempo drives the tempo chip', /132 · 4\/4/.test(doc.getElementById('chip-tempo').textContent),
       doc.getElementById('chip-tempo').textContent);
    doc.getElementById('tb-faster').click();
    ok('step 8: the stepper moves the same tempo', T.getTempo() === 137);
    // clamped to the slider's own range, so the stepper can't walk past what the slider allows
    T.setTempo(9999); ok('A1: setTempo clamps high', T.getTempo() === 200);
    T.setTempo(-5);   ok('A1: setTempo clamps low',  T.getTempo() === 40);
    T.setTempo(90);

    /* --- the tempo chip is DERIVED from the registry, like the key chip --- */
    const tempoShown = () => !doc.getElementById('chip-tempo').hidden;
    T.setMode('practice');
    T.startTiming();
    T.applyDrillCtx();
    ok('A1: a tempo-driven drill (timing) shows the tempo chip', tempoShown());
    T.exitTiming();
    T.startEar('interval');
    T.applyDrillCtx();
    ok('A1: an untimed drill (ear) hides the tempo stepper', !tempoShown());
    T.exitEar();
    ok('A1: returning to the practice home hides it too', !tempoShown());
    // every drill that rides the shared scheduler must declare it, or it silently loses
    // the only tempo control it has left
    const timed = ['timing', 'rhythm-guitar', 'changes'];
    ok('A1: all three scheduler-driven drills declare tempo:true',
       timed.every(id => { const d = T.DRILLS.find(x => x.id === id); return d && d.tempo === true; }),
       T.DRILLS.filter(d => d.tempo).map(d => d.id).join(','));
    ok('A1: and no untimed drill declares it',
       T.DRILLS.filter(d => d.tempo).length === timed.length);

    /* --- entering Practice stops what the reference transport owns --- */
    T.setMode('reference');
    T.initAudio();
    T.selectTab('harmony');
    T.loopToggle();
    ok('A1: (precondition) the reference loop is running', T.transportActive());
    T.setMode('practice');
    ok('A1: entering Practice stops the reference loop instead of strumming over the drill',
       !T.transportActive());
    /* the shortcut follows the control it stands for: M is the tempo sheet's "click with
       ▶" (step 11), a setting for whatever ▶ starts, never a transport of its own */
    const press = k => doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
    const click0 = T.getClickOn();
    press('m');
    ok('A1: M does nothing on the Practice home, where no tempo is on screen', T.getClickOn() === click0 && !T.transportActive());
    press(' ');
    ok('step 8: Space on the Practice home (no ▶ on screen) starts nothing', !T.transportActive());
    T.setMode('reference');
    press('m');
    ok('step 11: in Reference M switches the click with ▶, and starts nothing', T.getClickOn() === !click0 && !T.transportActive());
    press('m');
    ok('A1: ...and toggles back', T.getClickOn() === click0);

    /* --- master volume is app-level, not a property of the backing band --- */
    ok('A1: master volume moved out of the Backing panel',
       !doc.getElementById('backing-panel').contains(doc.getElementById('tb-vol')));
    ok('A1: ...and into Settings, so it stays reachable in Practice',
       doc.getElementById('toolbar').contains(doc.getElementById('tb-vol')));

    /* --- spine #1's control exists wherever a key is meaningful: the strip's key chip --- */
    T.selectTab('scales'); T.setScView('notes');
    ok('step 8: the key chip is on Scales ▸ Notes too', !doc.getElementById('chip-key').hidden);
    ok('A1: ...without the fretboard-only Display toggle, which Notes has no use for',
       doc.getElementById('ctx-display').hidden === true);
    T.setScView('scale');
    T.selectTab('harmony');
    ok('A1: Harmony gets its own view switch, and Names/Intervals, back',
       !doc.getElementById('ctx-view-harmony').hidden && doc.getElementById('ctx-display').hidden === false);
    T.setKey(0, 'C');
    T.resetLearner();
  })();

  /* ---- Phase 10/A2: three navigation strips became two ----
     Mode (Reference · Practice), subject (Harmony · Scales · Circle) and view
     (Chord tones · Triads · … ) were three strips in three visual languages in three
     places, all answering "what am I looking at". Now: one nav with four
     destinations, and the view switch demoted to a lens sitting on the board it
     changes — which is what Phase 1b already made true underneath (one board, four
     renderers) without the UI ever following. */
  (function oneNavSurface() {
    const doc = win.document;

    /* --- one strip, four destinations --- */
    ok('A2: the two old nav strips are gone',
       !doc.getElementById('modenav') && !doc.getElementById('tabs')
       && !doc.querySelector('.modebtn') && !doc.querySelector('.tab'));
    const btns = [...doc.querySelectorAll('#mainnav .navbtn')];
    ok('A2: one nav holds all three destinations',
       btns.map(b => b.dataset.panel).join(',') === 'harmony,scales,practice');
    ok('A2: every destination has a panel to control',
       btns.every(b => !!doc.getElementById('panel-' + b.dataset.panel)));
    ok('A2: all three are real tabs over real tabpanels',
       btns.every(b => b.getAttribute('role') === 'tab' && b.getAttribute('aria-controls') === 'panel-' + b.dataset.panel)
       && btns.every(b => doc.getElementById(b.dataset.panel === 'practice' ? 'panel-practice' : 'panel-' + b.dataset.panel)
                            .getAttribute('role') === 'tabpanel'));
    // exactly one destination is current at a time, mode and tab alike
    const current = () => btns.filter(b => b.classList.contains('active')).map(b => b.dataset.panel);
    T.selectTab('scales');
    ok('A2: a reference subject is the current destination', current().join() === 'scales');
    T.setMode('practice');
    ok('A2: Practice takes its place — never both', current().join() === 'practice');
    T.setMode('reference');
    ok('A2: leaving Practice restores the subject underneath', current().join() === 'scales');
    /* The nav is painted from the live state, not by whatever was clicked — so a
       keyboard shortcut, a seam jump or a restored share link move it too. The seam
       is the one that used to be able to desync it: it calls setMode + a drill
       starter directly. */
    const seam = doc.getElementById('nt-drill');
    if (seam) { seam.click(); ok('A2: the reference→practice seam moves the nav with it', current().join() === 'practice');
                T.exitDrill(); T.setMode('reference'); }
    ok('A2: only one destination is ever current', current().length === 1);
    // roving tabindex, so the strip is one tab stop
    ok('A2: the nav is a single tab stop',
       btns.filter(b => b.tabIndex === 0).length === 1);

    /* --- the view switch is a lens on the board, not a third strip --- */
    ok('A2: the view groups sit on the board they change',
       !!doc.querySelector('#board-region #board-lens #ctx-view-harmony')
       && !!doc.querySelector('#board-region #board-lens #ctx-view-scales'));
    ok('A2: the view buttons still work from there', !!doc.getElementById('hv-arp'));
    T.selectTab('harmony');
    ok('A2: Harmony shows its lens, Scales\' is stood down',
       !doc.getElementById('ctx-view-harmony').hidden && doc.getElementById('ctx-view-scales').hidden);
    T.selectTab('scales');
    ok('A2: ...and the other way round',
       doc.getElementById('ctx-view-harmony').hidden && !doc.getElementById('ctx-view-scales').hidden);
    ok('step 8: ...and so does Names/Intervals, a lens on the same board',
       !!doc.querySelector('#board-lens #ctx-display #g-names'));
    T.selectTab('harmony');

    /* --- the number keys are the nav, in nav order --- */
    const press = k => doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: k, bubbles: true }));
    press('3');
    ok('A2: 3 reaches Practice', T.state().currentMode === 'practice');
    press('2');
    ok('A2: 2 comes back out to Scales',
       T.state().currentMode === 'reference' && T.state().currentTab === 'scales');
    press('1');
    ok('A2: 1 is Harmony', T.state().currentTab === 'harmony');
    T.dismissWelcome();   // Escape closes a modal first, and the first-run card may still be up
    press('k');
    ok('step 8: K opens the key sheet, where the circle lives', T.sheetShown('key') && !doc.getElementById('sheet-key').hidden);
    press('Escape');
    ok('step 8: Escape shuts it', !T.sheetShown('key') && doc.getElementById('sheet-key').hidden);
    T.setKey(0, 'C');
  })();

  /* ---- Phase 10 / A3: board-first, and use the desktop ----
     The neck used to start 645px down a 708px laptop viewport, behind six bands of
     chrome — 63px of the app's centrepiece visible without scrolling. A3 reorders the
     shell so the board leads, and gives the two board-less surfaces (Circle, Practice)
     layouts that acknowledge a wide viewport instead of stretching a phone column
     across it. jsdom has no layout, so what is asserted here is the STRUCTURE the
     layout falls out of: which grid area map orders which band, that the DOM agrees
     with the visual order, and that the two rails exist. The pixel result is the
     visual review's job. */
  (function boardFirst() {
    const doc = win.document;

    /* --- the bands above the neck --- */
    ok('step 8: the strip is its own grid item in Reference, not part of .main',
       !!doc.querySelector('.layout > #strip-ref > #strip') && !doc.querySelector('.main #strip'));
    /* Only the strip (strip → view switch → neck; the heading went in step 11) stands
       between the header and the neck. Counting the .layout children that precede
       #board-region is the durable form of "the neck leads": adding another band above it
       fails here, whatever it is called. */
    const layoutKids = [...doc.querySelector('.layout').children];
    const beforeBoard = layoutKids.slice(0, layoutKids.findIndex(el => el.id === 'board-region'));
    ok('A3: only the strip precedes the neck',
       beforeBoard.map(el => el.id).join(',') === 'strip-ref',
       beforeBoard.map(el => el.id || el.className).join(','));
    /* Source order IS focus order. The area maps alone would have shown the neck above
       controls that still came first in the DOM — so a keyboard user would meet the
       chord picker before the neck it changes, and the lens after it. */
    ok('A3: the neck leads in the DOM too, not only in the grid',
       layoutKids.findIndex(el => el.id === 'board-region') < layoutKids.findIndex(el => el.classList.contains('main')));
    ok('A3: the legend follows the neck it annotates',
       layoutKids.findIndex(el => el.id === 'board-region') < layoutKids.findIndex(el => el.classList.contains('board-meta')));

    /* --- every area map tells the same story --- */
    const maps = [...html.matchAll(/grid-template-areas:\s*([^;]+);/g)].map(m =>
      (m[1].match(/"[^"]*"/g) || []).map(r => r.replace(/"/g, '').trim().split(/\s+/)));
    const rowOf = (map, area) => map.findIndex(r => r.includes(area));
    const boardMaps = maps.filter(m => rowOf(m, 'board') >= 0);
    ok('A3: every shape that shows a board has a map for it', boardMaps.length >= 3, String(boardMaps.length));
    ok('A3: the neck outranks the controls on every shape',
       boardMaps.every(m => rowOf(m, 'board') < rowOf(m, 'main')));
    // above the neck, or (landscape phone) beside it, in the rows the neck spans
    ok('A3: ...and the strip (the key you are in) outranks the neck',
       boardMaps.every(m => rowOf(m, 'strip') >= 0 && (rowOf(m, 'strip') <= rowOf(m, 'board') || m[rowOf(m, 'strip')].includes('board'))));
    /* prioritize-fretboard-width: the neck keeps the whole page width on desktop. The
       controls compact into a horizontal rail under it, never a vertical one beside it. */
    const desktop = maps.find(m => m.length && m[0].join() === 'strip,strip');
    ok('A3: the desktop neck still spans every column',
       !!desktop && desktop[rowOf(desktop, 'board')].every(c => c === 'board'));
    ok('A3: the suggester rides beside the controls, not beside the neck',
       !!desktop && rowOf(desktop, 'aside') === rowOf(desktop, 'main'));
    ok('A3: Practice still collapses to the single-area shell',
       maps.some(m => m.length === 1 && m[0].join() === 'main'));

    /* --- Practice home: two columns on a desktop viewport --- */
    const home = doc.getElementById('practice-home');
    const drills = home.querySelector('.ph-drills');
    ok('A3: the drill picker has a wrapper to be a column of', !!drills);
    ok('A3: every card sits in it',
       [...home.querySelectorAll('.drill-card')].every(c => c.closest('.ph-drills') === drills));
    /* B4 finished the move A3 started: the progress card was pulled out of the bottom of
       a 1700px column and set beside the picker; it now sits ON TOP of it, beside the
       session starter. What A3 asserted — that it is not buried inside the picker — is
       still the point, so it is still asserted, one level up. */
    ok('A3/B4: the progress card is not buried inside the picker',
       !!home.querySelector('#ph-top-block > .practice-progress-card')
       && !drills.querySelector('.practice-progress-card'));
    ok('B4: ...and the whole top block comes BEFORE the picker in source order',
       [...home.children].indexOf(doc.getElementById('ph-top-block')) < [...home.children].indexOf(drills));
    ok('A3: every card survived the reflow',
       home.querySelectorAll('.drill-card').length === T.drillTracks().length);
  })();

  /* ---- Phase 10 / A4: tools, preferences, and the cold start ---- */
  (function toolsAndColdStart() {
    const doc = win.document;

    /* --- every referenced string exists (the bug class that broke the cold start) ---
       applyLang SKIPS an undefined key rather than blanking the element, so a deleted
       key leaves the template's hardcoded Ukrainian on screen for English readers and
       nothing complains. A2 deleted `mode_reference`; the welcome card kept pointing at
       it and shipped that way. `npm run lint` now fails on it — this is the same guard
       from the other side, against the BUILT file. */
    const declared = new Set(Object.keys(T.I18N.uk));
    const asked = [...html.matchAll(/data-i18n=["']([A-Za-z_][\w-]*)["']/g)].map(m => m[1]);
    const missing = [...new Set(asked)].filter(k => !declared.has(k));
    ok('A4: every data-i18n key in the markup is actually defined', missing.length === 0, missing.join(','));

    /* --- the cold start asks something, and every answer is a route --- */
    const wc = doc.getElementById('welcome-overlay');
    ok('A4: the welcome card asks a question rather than listing nouns',
       !!doc.querySelector('#welcome-overlay .wc-lead[data-i18n="wc_lead"]')
       && /\?$/.test(T.I18N.en.wc_lead) && /\?$/.test(T.I18N.uk.wc_lead));
    const routes = ['wc-go-practice', 'wc-go-tune'];   // step 12: "look around" is the dismiss button
    ok('A4: it offers two answers, and no third that only closes it', routes.every(id => !!doc.getElementById(id)) && !doc.getElementById('wc-go-look'));
    ok('A4: ...and every one of them is wired to go somewhere',
       routes.every(id => typeof doc.getElementById(id).onclick === 'function'));
    ok('A4: the answers reuse the card the visitor meets next, not a parallel pattern',
       routes.every(id => doc.getElementById(id).classList.contains('drill-card')));
    // the route that is easiest to get wrong: it has to leave the modal AND move the nav
    T.setMode('reference'); T.setWelcomeSeen(false);
    wc.hidden = false;
    doc.getElementById('wc-go-practice').click();
    ok('A4: answering "practise" dismisses the card and lands on Practice',
       wc.hidden === true && T.state().currentMode === 'practice');
    T.setMode('reference'); T.setWelcomeSeen(true);

    /* --- Settings sorts by what you DO with a control --- */
    const clusters = [...doc.querySelectorAll('#toolbar .tb-cluster')];
    // step 8: Instrument · Sound · Display (language included) · Progress
    ok('A4: Settings is four clusters', clusters.length === 4);
    ok('step 8: ...named Instrument / Sound / Display / Progress',
       clusters.map(c => c.querySelector('.tbc-label').dataset.i18n).join(',')
         === 'tbc_instrument,tbc_sound,lbl_display,tbc_progress');
    /* The tools you come to USE and leave are not buried in Settings: the tuner (in the
       app header since step 11)
       (checked live — it works everywhere), and the latency, in the mic flow. That one is
       checked in the markup only: 14-calibration.js removes it where there is no mic path,
       which jsdom is, and that removal is deliberate — a control that can only ever fail
       should not be on screen. */
    ok('step 11: the tuner sits in the app header', !!doc.querySelector('header .hdr-tools #tb-tuner'));
    const atPractice = html.indexOf('id="panel-practice"'), atCal = html.indexOf('id="cal-row"'),
          atHome = html.indexOf('id="practice-home"'), atSettings = html.indexOf('id="toolbar"');
    ok('step 8: ...and the latency in the mic flow, above the drill, not in Settings',
       atCal > atPractice && atCal < atHome && !html.slice(atSettings, html.indexOf('id="bk-export"')).includes('cal-row'));
    ok('A4: the guitar is described in one place',
       ['tb-tuning', 'tb-capo', 'tb-frets', 'tb-lefty']
         .every(id => doc.getElementById(id).closest('.tb-cluster') === clusters[0]));
    ok('step 8: ...and the meter rides with the tempo it shapes', !!doc.querySelector('#sheet-tempo #tb-meter'));
    ok('step 8: what the screen shows sits together, the language included',
       ['tb-cbpalette', 'tb-shapes', 'lang-switch']
         .every(id => doc.getElementById(id).closest('.tb-cluster') === clusters[2])
       && doc.getElementById('tb-vol').closest('.tb-cluster') === clusters[1]);
    /* --- the mic funnel: an unmeasured latency is not a latency of zero --- */
    T.setCalKnown(false);
    ok('A4: latency starts UNKNOWN, which is not the same as zero',
       T.calMeasured() === false && T.calOffsetSec() === 0);
    T.calSetMs(80, true);
    ok('A4: setting it by hand counts — the player asserted a value',
       T.calMeasured() === true && Math.abs(T.calOffsetSec() - 0.08) < 1e-9);
    ok('A4: the drill can say what is missing before a note is played',
       !!T.I18N.uk.on_needcal && !!T.I18N.en.on_needcal);
    /* A save written before the flag existed but carrying a real measurement belongs to
       someone already calibrated; re-prompting them would be a regression for the only
       users who did the work. migrateSave is pure, so the rule is exercised directly. */
    ok('A4: an older save with a real latency is grandfathered in, not re-prompted',
       T.migrateSave({ calMs: 87 }).calKnown === true && T.migrateSave({ calMs: 0 }).calKnown === false);
    ok('A4: ...an explicit flag is never overridden', T.migrateSave({ calMs: 87, calKnown: false }).calKnown === false);
    ok('A4: ...and the flag is persisted alongside the number it qualifies',
       ['calMs', 'calKnown'].every(k => k in T.snapshotState()));
    T.setCalKnown(true);
  })();

  /* ---- Phase 7b: time signatures / meter ---- */
  (function meter() {
    const doc = win.document;
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    ok('7b: meter select present with all presets',
       !!doc.getElementById('tb-meter') && T.METERS.length === 5);
    ok('7b: default meter is 4/4', T.curMeter().id === '4/4' && T.getMeterIdx() === 2);

    // 4/4 must reproduce the OLD hard-wired bar math EXACTLY (no backing-band regression)
    T.setMeter(2);
    ok('7b: 4/4 bar = beat()*4 (unchanged bar math)', near(T.barSec(), T.beat() * 4));
    ok('7b: 4/4 pulse = a quarter', near(T.pulseSec(), T.beat()));
    ok('7b: 4/4 mid-bar push = beat 3', near(T.midPulseSec(), 2 * T.beat()));
    ok('7b: 4/4 accents the downbeat only', T.meterGroupStarts().join(',') === '0');
    ok('7b: 4/4 keeps kick 1&3 / snare 2&4',
       T.METERS[2].kick.join(',') === '0,2' && T.METERS[2].snare.join(',') === '1,3');

    // 3/4 (simple): three quarter pulses, bar shrinks to 3 beats
    T.setMeter(1);
    ok('7b: 3/4 has three quarter pulses', T.barBeats() === 3 && near(T.pulseSec(), T.beat()) && near(T.barSec(), 3 * T.beat()));

    // 6/8 (compound): six eighth pulses, bar = 3 quarters, felt in 2 (accents 0 & 3)
    T.setMeter(3);
    ok('7b: 6/8 pulse = an eighth', near(T.pulseSec(), T.beat() / 2));
    ok('7b: 6/8 bar = three quarters', T.barBeats() === 6 && near(T.barSec(), 3 * T.beat()));
    ok('7b: 6/8 accents the two dotted beats', T.meterGroupStarts().join(',') === '0,3');

    ok('7b: setMeter is bounds-checked', (T.setMeter(99), T.getMeterIdx() === 3));   // out-of-range ignored
    T.setMeter(2);   // restore 4/4 for the rest of the suite
    ok('7b: restored to 4/4', T.curMeter().id === '4/4');
  })();
};
