/* Dev-only visual-inspection tool: render the built index.html at one or more
   viewport widths and save PNGs under tools/shots/, so layout (especially
   responsive / mobile) can be eyeballed without a manual browser.

   Uses the system Edge/Chrome in headless mode — NO npm install, no bundled
   browser download, nothing added to the shipped single-file app. tools/shots/
   is gitignored (throwaway output).

   Why the iframe: headless `--window-size` controls only the screenshot canvas,
   NOT the layout viewport (innerWidth stays pinned at a default), so a naive
   screenshot crops a wider layout and looks falsely "clipped". Rendering the app
   inside a fixed-width <iframe> makes the iframe width the app's real viewport,
   and we size the canvas to match — so the picture is faithful. The wrapper also
   measures scrollWidth vs innerWidth and prints HORIZONTAL OVERFLOW if the page
   itself (not the in-board scroller) exceeds the viewport.

   Tabs: by default only the first-load tab (harmony) is captured. Pass tab tokens
   to reach the others — `harmony` / `scales` / `circle`, or `tabs` for all three.
   With a tab token the file is `w{W}-{panel}.png`; without, `w{W}.png` (unchanged).
   This is how the visual review covers ALL tabs across orientations.

   Mode axis (Phase 3): pass `practice` to capture the Practice surface, or `drill`
   to start the note-naming drill (clicks the bottom-nav Practice button, then the
   drill card, after load); the file gains a `-practice` / `-drill` suffix.
   `reference` is the default and needs no token. Phase 4 Ear: pass `ear` for the
   Ear home, or `ear-interval` / `ear-chordq` / `ear-rhythm` to start that drill.
   Phase 5 Rhythm: pass `changes` for the one-minute-changes setup, or `changes-run`
   to also press Start and land on the running tally; `strum` for the strumming-pattern
   trainer, or `strum-run` to also press Play and land on the looping grid; `comp` for the
   comp-the-progression drill, or `comp-run` to also press Play and land on the cycling now/next;
   `groove` for the groove/feel lab, or `groove-run` to also press Play and land on the looping groove.
   Phase 6 Lead: `target` for the chord-tone-targeting drill, or `target-run` to also press Play and
   land on the lit-tones neck with the band cycling.

   Run:  node tools/shoot.js                       # default widths 390 768 1280, harmony
         node tools/shoot.js 360 414 820           # custom widths
         node tools/shoot.js 390x3200              # explicit width x height
         node tools/shoot.js tabs 390x844 1280x800 # all 3 tabs at those viewports
         node tools/shoot.js practice 390x844 1280x800 # the Practice surface */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

// Split args into tab tokens and size tokens. Tabs default to [null] (capture the
// first-load tab, original behaviour); `tabs` expands to all three panels.
const PANELS = ['harmony', 'scales', 'circle'];
const tabArgs = [];
const sizeArgs = [];
const a11yArgs = [];                              // accessibility toggles (additive): cbpalette / shapes / a11y (both)
let mode = null;                                  // null = reference (default), 'practice' = Practice surface
for (const a of process.argv.slice(2)) {
  if (a === 'tabs') tabArgs.push(...PANELS);
  else if (PANELS.includes(a)) tabArgs.push(a);
  else if (a === 'cbpalette' || a === 'shapes' || a === 'a11y') a11yArgs.push(a);
  else if (a === 'practice' || a === 'reference' || a === 'drill' || a === 'changes' || a === 'changes-run'
           || a === 'strum' || a === 'strum-run' || a === 'comp' || a === 'comp-run'
           || a === 'groove' || a === 'groove-run' || a === 'target' || a === 'target-run'
           || a === 'ear' || a === 'ear-interval' || a === 'ear-chordq' || a === 'ear-rhythm')
    mode = (a === 'reference') ? null : a;
  else sizeArgs.push(a);
}
const tabs = tabArgs.length ? [...new Set(tabArgs)] : [null];

const specs = (sizeArgs.length ? sizeArgs : ['390', '768', '1280'])
  .map(s => { const [w, h] = s.split('x'); return { w: parseInt(w, 10), h: parseInt(h, 10) || 3200 }; })
  .filter(s => s.w > 0);

fs.mkdirSync(outDir, { recursive: true });
const fileUrl = p => 'file:///' + p.replace(/\\/g, '/');
const baseHtml = fs.readFileSync(indexHtml, 'utf8');

// the app's HTML, with an optional tab-switch and a self-overflow probe appended
// (both run in the app's OWN document, so they see the true iframe viewport).
function appFor(panel) {
  // click the tab first (sets the reference sub-view), then — if requested — the
  // bottom-nav Practice button, so the shot lands on the Practice surface.
  const clicks = [];
  if (panel) clicks.push(`var b=document.querySelector('.tab[data-panel="${panel}"]');if(b)b.click();`);
  if (mode === 'practice' || mode === 'drill' || mode === 'changes' || mode === 'changes-run' || mode === 'strum' || mode === 'strum-run' || mode === 'comp' || mode === 'comp-run' || mode === 'groove' || mode === 'groove-run' || mode === 'target' || mode === 'target-run') clicks.push(`var m=document.querySelector('.modebtn[data-mode="practice"]');if(m)m.click();`);
  if (mode === 'drill') clicks.push(`var s=document.getElementById('start-notes');if(s)s.click();`);
  if (mode === 'changes' || mode === 'changes-run') clicks.push(`var s=document.getElementById('start-changes');if(s)s.click();`);
  if (mode === 'changes-run') clicks.push(`var g=document.getElementById('cm-start-btn');if(g)g.click();`);
  if (mode === 'strum' || mode === 'strum-run') clicks.push(`var s=document.getElementById('start-strum');if(s)s.click();`);
  if (mode === 'strum-run') clicks.push(`var g=document.getElementById('sp-play');if(g)g.click();`);
  if (mode === 'comp' || mode === 'comp-run') clicks.push(`var s=document.getElementById('start-comp');if(s)s.click();`);
  if (mode === 'comp-run') clicks.push(`var g=document.getElementById('co-play');if(g)g.click();`);
  if (mode === 'groove' || mode === 'groove-run') clicks.push(`var s=document.getElementById('start-groove');if(s)s.click();`);
  if (mode === 'groove-run') clicks.push(`var g=document.getElementById('gf-play');if(g)g.click();`);
  if (mode === 'target' || mode === 'target-run') clicks.push(`var s=document.getElementById('start-target');if(s)s.click();`);
  if (mode === 'target-run') clicks.push(`var g=document.getElementById('tg-play');if(g)g.click();`);
  if (mode && mode.indexOf('ear') === 0) clicks.push(`var m=document.querySelector('.modebtn[data-mode="ear"]');if(m)m.click();`);
  const earStart = { 'ear-interval': 'start-interval', 'ear-chordq': 'start-chordq', 'ear-rhythm': 'start-rhythm' }[mode];
  if (earStart) clicks.push(`var s=document.getElementById('${earStart}');if(s)s.click();`);
  // accessibility toggles (additive): flip the colour-blind palette and/or dot shapes
  if (a11yArgs.includes('cbpalette') || a11yArgs.includes('a11y')) clicks.push(`var b=document.getElementById('tb-cbpalette');if(b)b.click();`);
  if (a11yArgs.includes('shapes') || a11yArgs.includes('a11y')) clicks.push(`var b=document.getElementById('tb-shapes');if(b)b.click();`);
  // any non-default capture: dismiss the first-run welcome first so it doesn't block
  // the surface (the no-arg shot keeps it, to capture the onboarding card itself).
  if (panel || mode || a11yArgs.length) clicks.unshift(`var wc=document.getElementById('wc-got');if(wc)wc.click();`);
  const switcher = clicks.length
    ? `<script>addEventListener('load',function(){try{${clicks.join('')}}catch(e){}});</script>`
    : '';
  return baseHtml.replace('</body>', `${switcher}
<div id="__probe" style="position:fixed;left:6px;bottom:6px;z-index:99999;font:bold 12px monospace;padding:4px 7px;border-radius:5px"></div>
<script>addEventListener('load',function(){setTimeout(function(){
  var sw=document.documentElement.scrollWidth,iw=innerWidth,p=document.getElementById('__probe'),over=sw>iw+1;
  p.textContent=(over?'HORIZONTAL OVERFLOW ':'fits ')+'IW='+iw+' SW='+sw;
  p.style.background=over?'#c0392b':'#1f7a3f';p.style.color='#fff';
},600);});</script>
</body>`);
}

for (const { w, h } of specs) {
  for (const panel of tabs) {
    const tag = (panel ? `${w}-${panel}` : `${w}`) + (mode ? '-' + mode : '') + (a11yArgs.length ? '-' + a11yArgs.join('-') : '');
    const appCopy = path.join(outDir, `_app_${tag}.html`);
    const wrapper = path.join(outDir, `_wrap_${tag}.html`);
    fs.writeFileSync(appCopy, appFor(panel));
    // app in a fixed-width iframe so the iframe width IS the app's layout viewport
    fs.writeFileSync(wrapper, `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#333">
<iframe src="_app_${tag}.html" style="width:${w}px;height:${h}px;border:0;display:block"></iframe>
</body></html>`);

    const out = path.join(outDir, `w${tag}.png`);
    execFileSync(browser, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
      '--virtual-time-budget=3000',
      `--screenshot=${out}`, `--window-size=${w},${h}`, fileUrl(wrapper),
    ], { stdio: 'ignore' });
    fs.unlinkSync(wrapper); fs.unlinkSync(appCopy);
    console.log(`  ${w}px${panel ? ' / ' + panel : ''} -> ${path.relative(root, out)}`);
  }
}
console.log('Done. (Fresh headless profile => first-run UI, no saved state.)');
