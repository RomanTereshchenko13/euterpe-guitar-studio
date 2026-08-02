/* Dev-only behavioural-inspection tool: drives the built index.html on a phone-sized
   viewport, scrolls it programmatically, and reports the *dynamic* scroll bugs a static
   screenshot can't show — the ones we kept chasing in the condensing sticky header:

     • flip-flop      the header condense/expand toggling while the page sits still
     • scroll drift   the scroll position moving on its own at rest (a self-scroll loop)
     • slow-scroll    the header thrashing as you ease across the trigger (>1 toggle on a
                      single monotonic down-scroll)
     • layout jump    the pinned board lurching between frames during a condense

   Like tools/shoot.js it uses the system Edge/Chrome headless — NO npm install, no bundled
   browser, nothing added to the shipped app. Two hard-won details about THIS Chrome build:
     1. We can't script scroll/clicks from the CLI, so we INJECT a diagnostic into the page
        that runs the whole scroll sequence itself, then console.logs its findings.
     2. --virtual-time-budget (the usual "fast-forward + dump" trick) silently breaks
        IntersectionObserver — it never fires — and the app's condense trigger is an IO. So we
        must run in REAL time: we launch with --enable-logging=stderr, stream the console line
        the diagnostic prints (base64 JSON behind a DIAG_RESULT: marker), and kill the browser
        the moment it arrives. Each viewport takes ~15s of real time.

   The app runs inside a fixed-width <iframe> for the same reason shoot.js does: the iframe
   width IS the app's layout viewport (--window-size only sizes the canvas, imprecisely). The
   diagnostic runs in the iframe's own window, so window.scrollTo / scrollY are the app's, and
   its console.log still reaches the shared stderr log.

   Run:  node tools/scroll-check.js                 # default 390x740 and 390x1100
         node tools/scroll-check.js 414x900         # custom width x viewport-height
   A tall viewport vs. short content is the case that provokes the bottom-clamp loop, so we
   test a couple of heights by default. Exit code is 1 on any detected issue (CI-friendly).   */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
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
if (!browser) { console.error('No Edge/Chrome found in the usual install locations.'); process.exit(1); }
if (!fs.existsSync(indexHtml)) { console.error('index.html not found — run `node build.js` first.'); process.exit(1); }

const specs = (process.argv.slice(2).length ? process.argv.slice(2) : ['390x740', '390x1100'])
  .map(s => { const [w, h] = s.split('x'); return { w: parseInt(w, 10), h: parseInt(h, 10) || 740 }; })
  .filter(s => s.w > 0);

fs.mkdirSync(outDir, { recursive: true });
const fileUrl = p => 'file:///' + p.replace(/\\/g, '/');

/* The in-page diagnostic. Runs inside the app's (iframe) window and prints its result to the
   console as DIAG_RESULT:<base64-json>. Kept as a plain function we stringify so it's readable
   here and runs verbatim there. Real timers, so transitions (~220ms) and the magnet (~110ms)
   play out for real — which is exactly the fidelity we want. */
function DIAGNOSTIC() {
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var hdr = document.querySelector('header');
  var board = document.getElementById('board-region');
  var docH = function () { return document.documentElement.scrollHeight; };
  var isCond = function () { return hdr ? hdr.classList.contains('scrolled') : false; };

  // count every condense<->expand flip, live
  var toggles = 0, last = isCond();
  if (hdr) new MutationObserver(function () {
    var s = isCond(); if (s !== last) { toggles++; last = s; }
  }).observe(hdr, { attributes: true, attributeFilter: ['class'] });

  // Park at a target, let it settle, then WATCH (without re-asserting the scroll) for the
  // header toggling or the scroll position wandering — either means a self-sustaining loop.
  async function park(target) {
    var before = toggles;
    window.scrollTo(0, target);
    await sleep(500);                                  // settle: transition + magnet + margin
    var settleY = window.scrollY, settleToggles = toggles - before;
    var ys = [];
    for (var i = 0; i < 16; i++) { ys.push(window.scrollY); await sleep(50); }   // ~0.8s pure observation
    var watchToggles = toggles - before - settleToggles;
    var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
    return {
      target: target, settleY: settleY, condensed: isCond(),
      settleToggles: settleToggles, watchToggles: watchToggles, drift: hi - lo,
      fail: watchToggles > 2 || (hi - lo) > 4               // flip-flop or auto-scroll while parked
    };
  }

  return (async function () {
    var out = { viewport: { w: window.innerWidth, h: window.innerHeight }, docHeight: docH() };
    try {
      // measured header heights, for context
      window.scrollTo(0, 0); await sleep(500);
      out.headerExpanded = hdr ? hdr.offsetHeight : 0;
      window.scrollTo(0, 400); await sleep(500);
      out.headerCondensed = hdr ? hdr.offsetHeight : 0;
      out.docHeightCondensed = docH();

      // 1) PARK TESTS around the trigger band and beyond
      out.park = [];
      var pts = [0, 8, 16, 24, 40, 56, 64, 80, 120, 200];
      for (var i = 0; i < pts.length; i++) out.park.push(await park(pts[i]));

      // 2) SLOW-SCROLL SWEEP: ease down 0 -> 160px in 2px steps. On a monotonic down-scroll the
      //    header should condense exactly once; more flips == thrashing across the trigger. Also
      //    track the biggest single-step jump of the pinned board's top (a layout lurch).
      window.scrollTo(0, 0); await sleep(500);
      var sweepBefore = toggles, prevTop = board ? board.getBoundingClientRect().top : 0, maxStep = 0;
      for (var y = 0; y <= 160; y += 2) {
        window.scrollTo(0, y); await sleep(24);
        if (board) { var top = board.getBoundingClientRect().top; maxStep = Math.max(maxStep, Math.abs(top - prevTop)); prevTop = top; }
      }
      // maxBoardStep is informational only: reclaiming the header's height moves the pinned board
      // by design, and this coarse sweep sampling makes that smooth motion look large — it is NOT
      // a bug signal. Thrash (toggles>1 on one monotonic down-scroll) is.
      out.sweep = { toggles: toggles - sweepBefore, maxBoardStepPx: Math.round(maxStep) };
      out.sweep.fail = out.sweep.toggles > 1;

      // CONDENSE TRACE: from the top, jump past the trigger and sample header height as it animates.
      // A smooth transition steps down gradually; a non-animated property would drop ~its full size
      // in a single 16ms sample. maxDrop is the real smoothness signal (a snap reads as a jump).
      window.scrollTo(0, 0); await sleep(500);
      window.scrollTo(0, 120);
      out.condenseTrace = []; out.boardTrace = [];
      for (var k = 0; k < 22; k++) {
        out.condenseTrace.push(hdr ? hdr.offsetHeight : 0);
        out.boardTrace.push(board ? Math.round(board.getBoundingClientRect().top) : 0);
        await sleep(16);
      }
      // smoothness = the biggest single-sample move of each. The header animates via CSS; the
      // board is pinned to --hdr-h (JS/ResizeObserver), so a choppy board vs a smooth header
      // pins the jank on the board-tracking, not the transition.
      var maxDrop = 0, maxBoardJump = 0;
      for (var j = 1; j < out.condenseTrace.length; j++) {
        maxDrop = Math.max(maxDrop, out.condenseTrace[j - 1] - out.condenseTrace[j]);
        maxBoardJump = Math.max(maxBoardJump, Math.abs(out.boardTrace[j - 1] - out.boardTrace[j]));
      }
      out.condenseMaxDropPx = maxDrop;
      out.boardMaxJumpPx = maxBoardJump;
      out.condenseSnap = maxDrop > 50 || maxBoardJump > 50;   // a smooth 140px/220ms ease peaks ~25px/sample

      out.fail = out.park.some(function (p) { return p.fail; }) || out.sweep.fail || out.condenseSnap;
    } catch (e) { out.error = String(e && e.message || e); out.fail = true; }

    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(out))));
    console.log('DIAG_RESULT:' + b64);
  })();
}

const appHtml = fs.readFileSync(indexHtml, 'utf8').replace('</body>', `
<script>addEventListener('load',function(){ setTimeout(function(){ (${DIAGNOSTIC.toString()})(); }, 200); });</script>
</body>`);

// Run one browser per viewport; resolve with the parsed diagnostic (or null on timeout/failure).
function runSpec({ w, h }) {
  return new Promise(resolve => {
    const appCopy = path.join(outDir, `_sc_app_${w}_${h}.html`);
    const wrapper = path.join(outDir, `_sc_wrap_${w}_${h}.html`);
    fs.writeFileSync(appCopy, appHtml);
    fs.writeFileSync(wrapper, `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#333">
<iframe src="${path.basename(appCopy)}" style="width:${w}px;height:${h}px;border:0;display:block"></iframe>
</body></html>`);
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-prof-'));

    const child = spawn(browser, [
      // --headless=new, not the bare --headless: Chromium REMOVED the old headless
      // mode in 132, and on a newer Edge/Chrome the legacy flag makes the browser
      // never produce diagnostic output, so this gate silently "failed" everywhere.
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--enable-logging=stderr', '--v=1', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profile}`, fileUrl(wrapper),
    ]);

    let buf = '', done = false;
    const finish = (result) => {
      if (done) return; done = true;
      clearTimeout(timer);
      try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { child.kill('SIGKILL'); }
      try { fs.unlinkSync(wrapper); fs.unlinkSync(appCopy); fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
      resolve(result);
    };
    const onData = d => {
      buf += d.toString();
      const m = buf.match(/DIAG_RESULT:([A-Za-z0-9+/=]+)/);
      if (m) { try { finish(JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'))); } catch (e) { finish(null); } }
    };
    child.stderr.on('data', onData);
    child.stdout.on('data', onData);
    // Safety net so a wedged browser can't hang CI. 60 s was too tight once the
    // diagnostic itself takes ~15 s of REAL time and a cold second browser launch
    // (fresh profile, no warm cache) eats the rest — each viewport passed alone but
    // the pair flaked. Generous, because the normal exit is the DIAG_RESULT above,
    // not this timer.
    const timer = setTimeout(() => finish(null), 150000);
  });
}

(async function () {
  let anyFail = false;
  for (const spec of specs) {
    /* One retry on a NO-OUTPUT result only. This gate kept reporting a phantom failure
       for whichever viewport happened to launch first — clean when run alone, clean in
       second position, "no diagnostic output" as the cold first launch — which is a
       browser-startup race (a previous headless instance still shutting down, a cold
       profile), not a layout bug. A gate that cries wolf gets ignored, and this one was
       starting to be. Only the empty result is retried: a diagnostic that comes back
       and REPORTS a problem is a real finding and is never re-rolled. */
    let r = await runSpec(spec);
    if (!r) { console.error(`   (${spec.w}×${spec.h}: no output — retrying once, the browser may have lost the launch race)`); r = await runSpec(spec); }
    if (!r) { console.error(`\n✗ ${spec.w}×${spec.h}: no diagnostic output (timed out / page error)`); anyFail = true; continue; }
    anyFail = anyFail || r.fail;
    console.log(`\n── ${spec.w}×${spec.h}  ${r.fail ? '✗ ISSUES' : '✓ clean'} ───────────────────────────`);
    if (r.error) console.log(`   error: ${r.error}`);
    console.log(`   header  expanded=${r.headerExpanded}px  condensed=${r.headerCondensed}px  (Δ ${r.headerExpanded - r.headerCondensed}px reclaimed)`);
    console.log(`   docHeight  top=${r.docHeight}px  condensed=${r.docHeightCondensed}px  (Δ ${r.docHeightCondensed - r.docHeight}px — want ~0; the spacer holds it constant)`);
    console.log(`   slow sweep  toggles=${r.sweep.toggles} (want 1)${r.sweep.fail ? '  ✗ THRASH' : ''}   [maxBoardStep ${r.sweep.maxBoardStepPx}px — info only]`);
    console.log(`   condense  header maxDrop=${r.condenseMaxDropPx}px/16ms  board maxJump=${r.boardMaxJumpPx}px/16ms (want ≤50)${r.condenseSnap ? '   ✗ SNAP' : ''}`);
    if (r.condenseTrace) console.log(`     header px: ${r.condenseTrace.join(' ')}`);
    if (r.boardTrace) console.log(`     board top: ${r.boardTrace.join(' ')}`);
    r.park.forEach(p => {
      const bad = p.fail ? '  ✗ LOOP/DRIFT' : '';
      console.log(`   park y=${String(p.target).padStart(3)}  settled@${String(p.settleY).padStart(3)}  ${p.condensed ? 'condensed' : 'expanded '}  watchToggles=${p.watchToggles}  drift=${p.drift}px${bad}`);
    });
  }
  console.log(anyFail ? '\nResult: scroll issues detected ✗' : '\nResult: no flip-flop / drift / thrash detected ✓');
  process.exit(anyFail ? 1 : 0);
})();
