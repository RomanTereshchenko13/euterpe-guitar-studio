/* Dev-only end-to-end check for the Phase 8 / F0 chromatic mic tuner.

   The jsdom suite covers the pitch→readout maths and the DOM contract, but it
   has no getUserMedia, so the half that actually matters — real microphone
   capture → AnalyserNode → the vendored pitch detector → the needle — is
   untested there. This drives the whole chain in a real headless browser and
   asserts the tuner names the right note and the right cents deviation.

   How the "microphone" works: Chromium's --use-file-for-fake-audio-capture
   feeds a WAV file to getUserMedia as if it were a live device, and
   --use-fake-ui-for-media-stream auto-accepts the permission prompt. So we
   synthesize a guitar-ish tone at a known pitch, hand it to the browser as the
   mic, and check what the tuner says.

   Why an HTTP server: getUserMedia needs a secure context and file:// is not
   one (that's the same rule that makes 14-mic-tuner.js remove its own button in
   the dist copy). 127.0.0.1 IS treated as trustworthy, so we serve the built
   index.html over a throwaway localhost port.

   Real time, not --virtual-time-budget: audio capture is a real-time pipeline
   and fast-forwarding virtual time starves it — the same reason
   tools/scroll-check.js avoids it.

   Run:  node tools/mic-check.js         (after node build.js)
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

/* A plucked-string-ish tone: fundamental plus 1/h harmonics. Not a bare sine —
   a sine is an unrealistically easy target for a pitch detector, and the whole
   point of this check is that the detector survives real harmonic content. */
function toneWav(freq, seconds) {
  const n = Math.floor(RATE * seconds);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let h = 1; h <= 8; h++) s += (1 / h) * Math.sin(2 * Math.PI * freq * h * i / RATE);
    // keep well clear of full scale so the 8 summed harmonics can't clip
    const v = Math.max(-1, Math.min(1, s * 0.22));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
  hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20);
  hdr.writeUInt16LE(1, 22);                     // mono
  hdr.writeUInt32LE(RATE, 24); hdr.writeUInt32LE(RATE * 2, 28);
  hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  return Buffer.concat([hdr, data]);
}

/* Injected into the page: open the tuner, start the mic, let the needle settle,
   then report what it says. Runs in the browser, so keep it ES5-ish and
   self-contained. */
const PROBE = `
<script>
addEventListener('load', function () {
  var out = { ok:false, err:null, note:null, oct:null, cents:null, inTune:null, dir:null, string:null, status:null };
  function done() {
    console.log('MIC_RESULT:' + btoa(unescape(encodeURIComponent(JSON.stringify(out)))));
  }
  setTimeout(function () {
    try {
      var btn = document.getElementById('tb-mic');
      if (!btn) { out.err = 'mic button missing — page is not a secure context?'; return done(); }
      btn.click();                                  // open the overlay
      var tog = document.getElementById('mt-toggle');
      if (!tog) { out.err = 'toggle missing'; return done(); }
      tog.click();                                  // request the mic + start listening
      // Give the capture pipeline time to spin up and the median/easing filters
      // time to converge on a stable reading.
      setTimeout(function () {
        try {
          var g = document.getElementById('mt-gauge');
          var st = document.getElementById('mt-status');
          out.note   = (document.getElementById('mt-note') || {}).textContent;
          out.oct    = (document.getElementById('mt-oct') || {}).textContent;
          out.cents  = (document.getElementById('mt-cents') || {}).textContent;
          out.string = (document.getElementById('mt-string') || {}).textContent;
          out.status = (st && !st.hidden) ? st.textContent : null;
          out.inTune = !!(g && g.classList.contains('in-tune'));
          out.dir    = g ? g.getAttribute('data-dir') : null;
          out.ok = true;
        } catch (e) { out.err = String(e && e.message || e); }
        done();
      }, 2500);
    } catch (e) { out.err = String(e && e.message || e); done(); }
  }, 800);
});
</script>
</body>`;

const appHtml = fs.readFileSync(indexHtml, 'utf8').replace('</body>', PROBE);

function runCase(spec) {
  return new Promise(resolve => {
    const wav = path.join(outDir, '_mic_' + spec.slug + '.wav');
    fs.writeFileSync(wav, toneWav(spec.hz, 4));

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(appHtml);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mic-prof-'));
      const child = spawn(browser, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--enable-logging=stderr', '--v=0',
        // the fake-microphone setup
        '--use-fake-ui-for-media-stream',            // auto-accept the permission prompt
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-audio-capture=' + wav,  // ...fed from our synthetic tone
        '--autoplay-policy=no-user-gesture-required',
        `--user-data-dir=${profile}`,
        `http://127.0.0.1:${port}/`,
      ]);

      let buf = '', finished = false;
      const finish = (result) => {
        if (finished) return; finished = true;
        clearTimeout(timer);
        try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); }
        catch (e) { child.kill('SIGKILL'); }
        try { server.close(); } catch (e) {}
        try { fs.unlinkSync(wav); fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
        resolve(result);
      };
      const onData = d => {
        buf += d.toString();
        const m = buf.match(/MIC_RESULT:([A-Za-z0-9+/=]+)/);
        if (m) {
          try { finish(JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'))); }
          catch (e) { finish(null); }
        }
      };
      child.stderr.on('data', onData);
      child.stdout.on('data', onData);
      const timer = setTimeout(() => finish(null), 30000);
    });
  });
}

/* One case per run: a fresh browser per pitch is slower than sequencing tones in
   one WAV, but it can't drift out of sync with the readout, which matters more
   for a check that's meant to be trusted. */
const CASES = [
  { slug: 'lowE',   hz: 82.41,  note: 'E', oct: '2', cents: 0,  desc: 'low E (82.41 Hz, weak fundamental — the hard case)' },
  { slug: 'A2',     hz: 110.00, note: 'A', oct: '2', cents: 0,  desc: 'open A (110 Hz)' },
  { slug: 'highE',  hz: 329.63, note: 'E', oct: '4', cents: 0,  desc: 'high e (329.63 Hz)' },
  { slug: 'A2sharp', hz: 110 * Math.pow(2, 30 / 1200), note: 'A', oct: '2', cents: 30, desc: 'A 30 cents SHARP (needle must read sharp)' },
  { slug: 'A2flat',  hz: 110 * Math.pow(2, -22 / 1200), note: 'A', oct: '2', cents: -22, desc: 'A 22 cents FLAT (needle must read flat)' },
];

(async function () {
  let failed = 0;
  console.log('Chromatic mic tuner — end-to-end check (real getUserMedia, synthetic guitar tone)\n');
  for (const c of CASES) {
    const r = await runCase(c);
    if (!r || !r.ok) {
      console.log(`  FAIL ${c.desc}\n       ${r ? r.err : 'no probe output (timed out / page error)'}`);
      failed++;
      continue;
    }
    if (r.status) {
      console.log(`  FAIL ${c.desc}\n       tuner reported: "${r.status}"`);
      failed++;
      continue;
    }
    const gotCents = parseFloat(String(r.cents).replace(/[^-\d.]/g, ''));
    const noteOk = r.note === c.note && r.oct === c.oct;
    // ±8 cents of slack: the readout is an eased average of a median-filtered
    // stream, so it lands close to but never exactly on the injected value.
    const centsOk = Math.abs(gotCents - c.cents) <= 8;
    const dirOk = c.cents === 0 ? (r.inTune === true)
                                : (r.dir === (c.cents > 0 ? 'sharp' : 'flat'));
    const pass = noteOk && centsOk && dirOk;
    if (!pass) failed++;
    console.log(`  ${pass ? 'PASS' : 'FAIL'} ${c.desc}`);
    console.log(`       read ${r.note}${r.oct}  ${r.cents}  ${r.inTune ? '[in tune]' : '[' + r.dir + ']'}  · ${r.string}`);
    if (!noteOk) console.log(`       ✗ expected note ${c.note}${c.oct}`);
    if (!centsOk) console.log(`       ✗ expected ~${c.cents} cents, got ${gotCents}`);
    if (!dirOk) console.log(`       ✗ expected ${c.cents === 0 ? 'in-tune' : (c.cents > 0 ? 'sharp' : 'flat')}`);
  }
  console.log(`\nMic tuner check: ${CASES.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
