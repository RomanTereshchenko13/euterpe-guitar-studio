#!/usr/bin/env node
/* Capture real saves from past releases into tests/fixtures/.

   Each scenario boots the bundle of an old release straight out of git under jsdom, puts
   the app into a state a player could have reached (through that build's own functions
   where they exist), lets that build's saveState() write localStorage, and records:
     save  — the bytes that build stored, verbatim
     seen  — what that build showed (tests/boot.js readVisible), the compat suite's oracle
     hash  — for the share-link era, a link from that build pointing somewhere else

   The fixtures are checked in; tests/compat.js asserts the current build against them.
   Re-run only to add a scenario — an old release never changes, so neither do its saves:

     node tools/capture-fixtures.js            # write every fixture
     node tools/capture-fixtures.js v2.16      # only the scenarios whose name starts so

   Needs git history and tests/node_modules (cd tests && npm install). */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'fixtures');
let boot, readVisible;
try { ({ boot, readVisible } = require(path.join(ROOT, 'tests', 'boot.js'))); }
catch (e) { console.error('jsdom missing: run `cd tests && npm install` first.'); process.exit(1); }

const NOW = 1757000000000, DAY = 86400000;   // fixed clock, so a re-capture is byte-identical

/* `js` runs inside the old page. S(name, value) assigns a global only if that build has it,
   so one scenario never invents state its build couldn't save. */
const SCENARIOS = [
  { name: 'v1.11-notes', rev: 'd0885cc', note: 'first release in git; the Notes tab with a progression', js: `
      S('lang','en'); S('tuningIdx',1); S('fretRangeIdx',2); S('tempo',120); S('lefty',true); S('toolbarOpen',false);
      S('gRoot',6); S('gRootLbl','F#'); S('gMode','deg'); S('chQual',0);
      seqAddCurrent(); S('gRoot',11); S('gRootLbl','B'); S('chQual',1); seqAddCurrent();
      seq[1].bars=2; S('seqLoopOn',false); S('bassOn',true);
      S('scIdx',2); S('scPos',3); S('ntRoot','F#'); S('ntFilter','nat'); S('cofSel',4); S('cofMinor',true);
      S('currentTab','notes');` },
  { name: 'v1.11-triads', rev: 'd0885cc', note: 'the Triads view, before it became a toggle', js: `
      S('lang','uk'); S('gRoot',2); S('gRootLbl','D'); S('chQual',4);
      S('hView','triads'); S('trQual',1); S('trSet',2); S('trInv',2); S('currentTab','harmony');` },
  { name: 'v1.20-identify', rev: '68e4d50', note: 'Identify view (cut in v2.17.0), capo, flat root', js: `
      S('lang','en'); S('gRoot',3); S('gRootLbl','Eb'); S('chQual',6); S('capo',3); S('gMode','deg');
      S('hView','identify'); S('currentTab','harmony');` },
  { name: 'v1.20-arpeggio', rev: '68e4d50', note: 'Arpeggio box and a voicing pick', js: `
      S('lang','uk'); S('gRoot',7); S('gRootLbl','G'); S('chQual',5); S('arpPos',3); S('chVoicing',1);
      S('fretRangeIdx',3); S('hView','arp'); S('currentTab','harmony');` },
  { name: 'v2.2-ear', rev: '4758066', note: "the retired 'ear' mode; volume, backing panel, first learner model (v1)", js: `
      S('lang','en'); S('gRoot',10); S('gRootLbl','Bb'); S('masterVol',0.6); S('backingOpen',true); S('shapesOpen',false);
      S('bassOn',true); S('grooveOn',true); S('scIdx',3); S('scPos',2); S('scView','scale'); S('currentTab','scales');
      recordAttempt('note:C',true,${NOW - 3 * DAY}); recordAttempt('note:F#',false,${NOW - 3 * DAY});
      recordAttempt('note:F#',true,${NOW - 2 * DAY}); recordSession('notes',80,${NOW - 2 * DAY});
      S('currentMode','ear');` },
  { name: 'v2.4-circle', rev: '11d0cd6', note: 'the Circle tab, colour-blind palette and shapes, welcome seen', js: `
      S('lang','uk'); S('gRoot',4); S('gRootLbl','E'); S('scIdx',5); S('cbPalette',true); S('fnShapes',true); S('welcomeSeen',true);
      S('tuningIdx',2); recordSession('notes',64,${NOW - 5 * DAY}); S('currentMode','reference'); S('currentTab','circle');` },
  { name: 'v2.11-custom', rev: 'e470b51', note: 'custom tuning, time signature, the timing coach', js: `
      S('lang','en'); S('tuningIdx',TUNINGS.findIndex(t=>t.custom)); S('customTuning',[62,57,55,50,45,36]);
      S('meterIdx',METERS.findIndex(m=>m.id==='6/8')); S('tempo',72); S('gRoot',0); S('gRootLbl','C'); S('chQual',2);
      recordSession('timing:8ths',12,${NOW - DAY}); S('currentMode','practice'); S('currentTab','harmony');` },
  { name: 'v2.14-practice', rev: 'f2a6627', note: 'learner v2 with timing error, personal bests, latency, drills seen', js: `
      S('lang','uk'); S('calMs',42); S('calKnown',true); S('drillSeen',{timing:1,strum:1,notes:1});
      recordAttempt('interval:P5',true,${NOW - 4 * DAY}); recordAttempt('interval:m3',false,${NOW - 4 * DAY});
      recordSession('timing:16ths',8,${NOW - 3 * DAY},{err:18.5}); recordSession('strum:folk',6,${NOW - 2 * DAY},{err:24});
      S('currentMode','practice'); S('currentTab','scales');` },
  { name: 'v2.16-full', rev: 'e695fae', note: 'last build before the cuts: every field, cut drills\' history, and a share link to elsewhere', js: `
      S('lang','en'); S('tuningIdx',1); S('fretRangeIdx',1); S('capo',2); S('tempo',104); S('meterIdx',METERS.findIndex(m=>m.id==='3/4'));
      S('masterVol',0.8); S('lefty',true); S('backingOpen',true); S('cbPalette',true); S('welcomeSeen',true);
      S('gRoot',9); S('gRootLbl','A'); S('chQual',1); seqAddCurrent(); S('gRoot',2); S('gRootLbl','D'); S('chQual',1); seqAddCurrent();
      S('gRoot',4); S('gRootLbl','E'); S('chQual',0); seqAddCurrent(); S('gRoot',9); S('gRootLbl','A'); S('chQual',1);
      S('grooveOn',true); S('calMs',55); S('calKnown',true); S('sessMins',15); S('drillSeen',{timing:1,rhythm:1,target:1,callresp:1});
      recordAttempt('rhythm:r3',false,${NOW - 6 * DAY}); recordAttempt('interval:P4',true,${NOW - 6 * DAY});
      recordSession('ear-rhythm',50,${NOW - 6 * DAY}); recordSession('target:I-V-vi-IV',72,${NOW - 5 * DAY});
      recordSession('callresp:A',80,${NOW - 4 * DAY}); recordSession('timing:8ths',10,${NOW - DAY},{err:14.25});
      S('hView','arp'); S('arpPos',2); S('currentMode','reference'); S('currentTab','harmony');`,
    share: `S('gRoot',0); S('gRootLbl','C'); S('scIdx',3); S('currentTab','scales'); S('scView','notes');` },
  { name: 'v2.17-triads', rev: 'ebf8667', note: 'the current schema: triads as a toggle on Chord tones', js: `
      S('lang','uk'); S('gRoot',1); S('gRootLbl','C#'); S('chQual',2); S('chTriads',true); S('trSet',1); S('trInv',0);
      S('hView','chords'); S('scView','notes'); S('ntFilter','nat'); S('currentTab','harmony');` }
];

function version(html) { const m = html.match(/APP_VERSION\s*=\s*'([\d.]+)'/); return m ? m[1] : '?'; }

function capture(sc) {
  const html = execFileSync('git', ['show', sc.rev + ':index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  const win = boot(html);
  const errors = [];
  win.addEventListener('error', e => errors.push(e.message));
  win.eval(`function S(n,v){ if(eval('typeof '+n)==='undefined') return; eval(n+'=v'); }`);
  win.eval(sc.js);
  win.eval('saveState()');
  const raw = win.localStorage.getItem('guitarStudio.v1');
  if (!raw) throw new Error(sc.name + ': the old build saved nothing');
  const seen = readVisible(win);
  let hash;
  if (sc.share) { win.eval(sc.share); hash = '#' + win.eval('encodeShareState()'); }
  if (errors.length) throw new Error(sc.name + ': page errors: ' + errors.join('; '));
  win.close();
  const fx = { name: sc.name, app: version(html), commit: sc.rev, note: sc.note, save: JSON.parse(raw), seen };
  if (hash) fx.hash = hash;
  return fx;
}

const only = process.argv[2] || '';
fs.mkdirSync(OUT, { recursive: true });
for (const sc of SCENARIOS.filter(s => s.name.startsWith(only))) {
  const fx = capture(sc);
  fs.writeFileSync(path.join(OUT, sc.name + '.json'), JSON.stringify(fx, null, 2) + '\n');
  console.log('captured', sc.name, '(v' + fx.app + ')');
}
