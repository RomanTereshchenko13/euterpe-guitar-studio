/* Boot a built Euterpe page under jsdom: a stubbed Web Audio context and, optionally,
   a save already in localStorage and a URL hash. Shared by the compat suite and by
   tools/capture-fixtures.js, which also boots *old* builds with it — so nothing here may
   assume the current app's internals. */
'use strict';
const { JSDOM } = require('jsdom');

const LS_KEY = 'guitarStudio.v1';

/* Every node is a chainable proxy; AudioParams accept value sets and scheduling calls.
   Enough for the synth, loop and sequencer to run without a real AudioContext. */
function buildAudioStub() {
  function param() {
    const p = { value: 0 };
    ['setValueAtTime', 'setTargetAtTime', 'exponentialRampToValueAtTime',
     'linearRampToValueAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime']
      .forEach(m => { p[m] = () => p; });
    return p;
  }
  function node() {
    return new Proxy({}, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'connect') return () => node();
        if (k === 'disconnect' || k === 'start' || k === 'stop') return () => {};
        return (t[k] = param());
      },
      set(t, k, v) { t[k] = v; return true; }
    });
  }
  const ctx = {
    sampleRate: 44100, state: 'running', currentTime: 0,
    resume() {}, suspend() {},
    get destination() { return node(); },
    createGain: node, createOscillator: node, createBiquadFilter: node,
    createDynamicsCompressor: node, createConvolver: node, createBufferSource: node,
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(Math.max(1, len || 1)) })
  };
  function AC() { return ctx; }
  AC.__ctx = ctx;
  return AC;
}

/* opts: { save: string|object (the settings key's raw value), storage: {key: raw string} (any
   other keys, e.g. the progress key), hash: '#…', width, height, quiet (no dev warnings) } */
function boot(html, opts) {
  const o = opts || {};
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.test/' + (o.hash || ''),
    beforeParse(window) {
      window.__GS_ALLOW_TEST__ = true;
      const AC = buildAudioStub();
      window.AudioContext = AC;
      window.webkitAudioContext = AC;
      window.__AC = AC;
      if (o.quiet) window.console.warn = () => {};
      if (o.width) window.innerWidth = o.width;
      if (o.height) window.innerHeight = o.height;
      try {
        window.localStorage.clear();
        if (o.save != null) window.localStorage.setItem(LS_KEY, typeof o.save === 'string' ? o.save : JSON.stringify(o.save));
        Object.keys(o.storage || {}).forEach(k => window.localStorage.setItem(k, o.storage[k]));
      } catch (e) { /* no storage: the app boots on defaults */ }
    }
  });
  return dom.window;
}

/* What the player sees, read from inside the page in terms every build since v1.11 shares
   (the music tables' intervals, not their indices). It runs in old builds too, so a name a
   build doesn't have reads as null — "this build didn't show it" — instead of throwing. */
function readVisiblePage() {
  /* global currentTab, currentMode, hView, scView, chTriads, chTriadIdx, trQual, TRIADS, QUALITIES, chQual, arpPos,
     SCALES, scIdx, scPos, gRootLbl, keyLbl, chLbl, gMode, TUNINGS, tuningIdx, customTuning, FRET_RANGES, fretRangeIdx, capo, lefty,
     tempo, METERS, meterIdx, masterVol, toolbarOpen, backingOpen, shapesOpen, cbPalette, fnShapes, welcomeSeen,
     seq, seqLoopOn, bassOn, grooveOn, ntFilter, calMs, calKnown, sessMins, learner, lang, drillSeen */
  const g = f => { try { const v = f(); return v === undefined ? null : v; } catch (e) { return null; } };
  const tab = g(() => currentTab), hv = g(() => hView);
  const isNew = g(() => chTriads) !== null;               // triads became a toggle in v2.17.0
  const triads = tab === 'harmony' && (hv === 'triads' || (hv === 'chords' && g(() => chTriads) === true));
  const view = tab === 'circle' ? 'circle'
    : (tab === 'notes' || (tab === 'scales' && g(() => scView) === 'notes')) ? 'notes'
    : tab === 'scales' ? 'scales'
    : tab === 'harmony' ? 'harmony:' + (triads ? 'triads' : hv)
    : 'tab:' + tab;
  const iv = a => a.join('.');
  const L = g(() => learner);
  return {
    lang: g(() => lang),
    mode: g(() => currentMode) || 'reference',
    view,
    // one root was both key and chord until PLAN step 6: an older build shows it as both
    root: g(() => keyLbl) ?? g(() => gRootLbl),
    chordRoot: g(() => chLbl) ?? g(() => gRootLbl),
    labels: g(() => gMode),
    chord: triads ? g(() => iv(TRIADS[isNew ? chTriadIdx() : trQual].iv)) : g(() => iv(QUALITIES[chQual].iv)),
    arpBox: g(() => arpPos),
    scale: g(() => iv(SCALES[scIdx].iv)),
    scaleBox: g(() => scPos),
    tuning: g(() => iv(TUNINGS[tuningIdx].custom ? customTuning : TUNINGS[tuningIdx].midi)),
    frets: g(() => FRET_RANGES[fretRangeIdx].lo + '-' + FRET_RANGES[fretRangeIdx].hi),
    capo: g(() => capo), lefty: g(() => lefty), tempo: g(() => tempo),
    meter: g(() => METERS[meterIdx].id), volume: g(() => masterVol),
    settingsOpen: g(() => toolbarOpen), backingOpen: g(() => backingOpen), shapesOpen: g(() => shapesOpen),
    cbPalette: g(() => cbPalette), fnShapes: g(() => fnShapes), welcomeSeen: g(() => welcomeSeen),
    progression: g(() => seq.map(s => s.lbl + ':' + iv(QUALITIES[s.qi].iv) + ':' + s.bars).join(' ')),
    progLoop: g(() => seqLoopOn), bass: g(() => bassOn), drums: g(() => grooveOn),
    notesFilter: g(() => ntFilter),
    latencyMs: g(() => calMs), latencyKnown: g(() => calKnown),
    sessionMins: g(() => sessMins),
    drillSeen: g(() => Object.keys(drillSeen).filter(k => drillSeen[k]).sort().join(',')),
    learner: L && {
      items: Object.keys(L.items).sort().map(k => { const it = L.items[k]; return [k, it.seen, it.correct, it.streak, it.ease, it.due]; }),
      sessions: L.sessions.map(s => [s.t, s.drill, s.score, s.err === undefined ? null : s.err]),
      best: L.best ? Object.keys(L.best).sort().map(k => { const b = L.best[k]; return [k, b.score, b.t, b.err === undefined ? null : b.err]; }) : null   // v1 had no bests; v2 derives them
    }
  };
}
function readVisible(win) { return win.eval('(' + readVisiblePage.toString() + ')()'); }

module.exports = { boot, buildAudioStub, readVisible, LS_KEY };
