/* Dev-only end-to-end check for Phase 8 / F1 onset detection.

   The jsdom suite asserts the matching/scoring maths — the part that decides what a
   player is told. This asserts the part underneath it: that the AudioWorklet loads
   at all, that it detects real attacks in a real capture stream, and that the times
   it reports are accurate enough for the scores to mean anything.

   WHAT IS AND ISN'T MEASURABLE HEADLESSLY. Chromium's fake mic
   (--use-file-for-fake-audio-capture) starts the WAV at an arbitrary phase relative
   to the audio clock, so ABSOLUTE onset times can't be verified this way — and
   neither can the acoustic round-trip calibration, which needs a real speaker and a
   real microphone in one room. What CAN be verified, and is what scoring actually
   rests on, is RELATIVE timing: if the WAV has attacks exactly 400 ms apart, the
   detector must report them 400 ms apart. Every number F1 shows a player (mean
   error, bias, spread) is built from differences, so this is the property that
   matters. The absolute offset is exactly what calibration exists to remove.

   Run:  node tools/onset-check.js         (after node build.js)
   Exits 1 on any failure. No npm install, no bundled browser. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const indexHtml = path.join(root, 'index.html');
const outDir = path.join(__dirname, 'shots');
const CANDIDATES = [
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
  process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
  process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
].filter(Boolean);
const browser = CANDIDATES.find(p => fs.existsSync(p));
if (!browser) { console.error('No Edge/Chrome found.'); process.exit(1); }
if (!fs.existsSync(indexHtml)) { console.error('index.html not found — run `node build.js` first.'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const RATE = 44100;

/* A plucked note: a sharp broadband attack decaying into a harmonic tone. The
   attack is what the detector is supposed to find; the tone is what it must NOT
   re-trigger on while it decays. */
function pluckInto(data, atSec, freq, seconds) {
  const start = Math.floor(atSec * RATE);
  const n = Math.floor(seconds * RATE);
  for (let i = 0; i < n; i++) {
    const idx = start + i;
    if (idx * 2 + 1 >= data.length) break;
    const t = i / RATE;
    const env = Math.exp(-t * 6);
    // broadband pick transient, ~4 ms
    const attack = (i < RATE * 0.004) ? (Math.random() * 2 - 1) * 0.9 * (1 - i / (RATE * 0.004)) : 0;
    let tone = 0;
    for (let h = 1; h <= 6; h++) tone += (1 / h) * Math.sin(2 * Math.PI * freq * h * t);
    const v = Math.max(-1, Math.min(1, (attack + tone * 0.22) * env));
    const prev = data.readInt16LE(idx * 2);
    data.writeInt16LE(Math.max(-32767, Math.min(32767, prev + Math.round(v * 26000))), idx * 2);
  }
}

function wavFrom(events, totalSec) {
  const n = Math.floor(RATE * totalSec);
  const data = Buffer.alloc(n * 2);
  events.forEach(e => pluckInto(data, e.at, e.freq || 196, 0.5));
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
  hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20);
  hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(RATE, 24); hdr.writeUInt32LE(RATE * 2, 28);
  hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  return Buffer.concat([hdr, data]);
}

/* Injected probe: start onset detection, collect timestamps, report. */
const PROBE = `
<script>window.__GS_ALLOW_TEST__ = true;</script>
`;
const PROBE_TAIL = `
<script>
addEventListener('load', function () {
  var out = { ok:false, err:null, times:[], supported:null };
  function done(){ console.log('ONSET_RESULT:' + btoa(unescape(encodeURIComponent(JSON.stringify(out))))); }
  setTimeout(function () {
    var T = window.__GS_TEST__;
    if (!T) { out.err = 'test hook missing'; return done(); }
    out.supported = T.onsetSupported();
    if (!out.supported) { out.err = 'onsetSupported() false — no worklet / no secure context'; return done(); }
    var off = T.onOnset(function (t) { out.times.push(t); });
    T.initAudio();
    Promise.resolve(window.__onsetStart()).then(function (r) {
      if (!r || !r.ok) { out.err = 'onsetStart failed: ' + (r && r.key); off(); return done(); }
      // Listen well past the last scheduled attack in the WAV.
      setTimeout(function () { off(); window.__onsetStop(); out.ok = true; done(); }, 5200);
    }).catch(function (e) { out.err = String(e && e.message || e); off(); done(); });
  }, 700);
});
</script>
</body>`;

// onsetStart/onsetStop aren't on the test hook (they're side-effecting lifecycle,
// not assertable state), so expose them for the probe only.
const EXPOSE = `<script>window.__onsetStart=function(){return onsetStart();};window.__onsetStop=function(){return onsetStop();};</script>`;

const baseHtml = fs.readFileSync(indexHtml, 'utf8');
const appHtml = PROBE + baseHtml.replace('</body>', EXPOSE + PROBE_TAIL);

function runCase(spec) {
  return new Promise(resolve => {
    const wav = path.join(outDir, '_onset_' + spec.slug + '.wav');
    fs.writeFileSync(wav, wavFrom(spec.events, spec.totalSec));
    const server = http.createServer((q, r) => {
      r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(appHtml);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'onset-prof-'));
      const child = spawn(browser, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--enable-logging=stderr', '--v=0',
        '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
        '--use-file-for-fake-audio-capture=' + wav,
        '--autoplay-policy=no-user-gesture-required',
        `--user-data-dir=${profile}`, `http://127.0.0.1:${port}/`,
      ]);
      let buf = '', finished = false;
      const finish = (r) => {
        if (finished) return; finished = true;
        clearTimeout(timer);
        try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); }
        catch (e) { child.kill('SIGKILL'); }
        try { server.close(); } catch (e) {}
        try { fs.unlinkSync(wav); fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
        resolve(r);
      };
      const onData = d => {
        buf += d.toString();
        const m = buf.match(/ONSET_RESULT:([A-Za-z0-9+/=]+)/);
        if (m) { try { finish(JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'))); } catch (e) { finish(null); } }
      };
      child.stderr.on('data', onData);
      child.stdout.on('data', onData);
      const timer = setTimeout(() => finish(null), 45000);
    });
  });
}

/* The WAV loops, so keep the pattern shorter than the listening window and judge on
   the intervals we can see rather than an exact event count. */
const CASES = [
  {
    slug: 'steady', desc: 'eight attacks exactly 400 ms apart',
    totalSec: 4.0,
    events: [0.30, 0.70, 1.10, 1.50, 1.90, 2.30, 2.70, 3.10].map(at => ({ at, freq: 196 })),
    expectGap: 0.400, tolMs: 12,
  },
  {
    slug: 'displaced', desc: 'same grid with one note pushed 80 ms late',
    totalSec: 4.0,
    // ...0.70, then 1.18 instead of 1.10, then back on the grid
    events: [0.30, 0.70, 1.18, 1.50, 1.90, 2.30, 2.70, 3.10].map(at => ({ at, freq: 196 })),
    expectGap: null, tolMs: 12,
  },
];

(async function () {
  let failed = 0;
  console.log('Onset detection — end-to-end check (real AudioWorklet, synthetic plucks)\n');

  for (const c of CASES) {
    const r = await runCase(c);
    if (!r || !r.ok) {
      console.log(`  FAIL ${c.desc}\n       ${r ? r.err : 'no probe output (timed out / page error)'}`);
      failed++;
      continue;
    }
    const times = r.times.slice().sort((a, b) => a - b);
    // Intervals between consecutive detections. The WAV loops, so drop any gap far
    // longer than the pattern (the wrap) before judging.
    const gaps = [];
    for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
    const inPattern = gaps.filter(g => g < 0.9);

    if (times.length < 6) {
      console.log(`  FAIL ${c.desc}\n       only ${times.length} onsets detected — expected at least 6`);
      failed++;
      continue;
    }

    if (c.expectGap != null) {
      const errs = inPattern.map(g => Math.abs(g - c.expectGap) * 1000);
      const worst = Math.max.apply(null, errs);
      const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
      const pass = worst <= c.tolMs;
      if (!pass) failed++;
      console.log(`  ${pass ? 'PASS' : 'FAIL'} ${c.desc}`);
      console.log(`       ${times.length} onsets · ${inPattern.length} intervals · ` +
                  `mean err ${mean.toFixed(1)} ms · worst ${worst.toFixed(1)} ms (tol ${c.tolMs})`);
      if (!pass) console.log(`       ✗ interval accuracy outside tolerance`);
    } else {
      // The displaced case: one interval must come out ~80 ms long and the next
      // ~80 ms short, proving the detector reports real deviation rather than
      // smoothing everything onto the grid.
      const longG = inPattern.filter(g => g > 0.44 && g < 0.52);
      const shortG = inPattern.filter(g => g > 0.28 && g < 0.36);
      const pass = longG.length >= 1 && shortG.length >= 1;
      if (!pass) failed++;
      console.log(`  ${pass ? 'PASS' : 'FAIL'} ${c.desc}`);
      console.log(`       ${times.length} onsets · found ${longG.length} long + ${shortG.length} short interval(s)`);
      console.log(`       intervals: ${inPattern.map(g => Math.round(g * 1000)).join(', ')} ms`);
      if (!pass) console.log(`       ✗ the displaced note was not reflected in the intervals`);
    }
  }

  console.log(`\nOnset detection check: ${CASES.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
