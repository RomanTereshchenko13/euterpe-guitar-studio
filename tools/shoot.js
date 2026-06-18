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

   Run:  node tools/shoot.js                 # default widths 390, 768, 1280
         node tools/shoot.js 360 414 820     # custom widths
         node tools/shoot.js 390x3200        # explicit width x height        */
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

const specs = (process.argv.slice(2).length ? process.argv.slice(2) : ['390', '768', '1280'])
  .map(s => { const [w, h] = s.split('x'); return { w: parseInt(w, 10), h: parseInt(h, 10) || 3200 }; })
  .filter(s => s.w > 0);

fs.mkdirSync(outDir, { recursive: true });
const fileUrl = p => 'file:///' + p.replace(/\\/g, '/');

// the app's HTML, with a self-overflow probe appended (runs in the app's OWN
// document, so it sees the true iframe viewport and needs no cross-origin read).
const appHtml = fs.readFileSync(indexHtml, 'utf8').replace('</body>', `
<div id="__probe" style="position:fixed;left:6px;bottom:6px;z-index:99999;font:bold 12px monospace;padding:4px 7px;border-radius:5px"></div>
<script>addEventListener('load',function(){setTimeout(function(){
  var sw=document.documentElement.scrollWidth,iw=innerWidth,p=document.getElementById('__probe'),over=sw>iw+1;
  p.textContent=(over?'HORIZONTAL OVERFLOW ':'fits ')+'IW='+iw+' SW='+sw;
  p.style.background=over?'#c0392b':'#1f7a3f';p.style.color='#fff';
},500);});</script>
</body>`);

for (const { w, h } of specs) {
  const appCopy = path.join(outDir, `_app_${w}.html`);
  const wrapper = path.join(outDir, `_wrap_${w}.html`);
  fs.writeFileSync(appCopy, appHtml);
  // app in a fixed-width iframe so the iframe width IS the app's layout viewport
  fs.writeFileSync(wrapper, `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#333">
<iframe src="_app_${w}.html" style="width:${w}px;height:${h}px;border:0;display:block"></iframe>
</body></html>`);

  const out = path.join(outDir, `w${w}.png`);
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
    '--virtual-time-budget=3000',
    `--screenshot=${out}`, `--window-size=${w},${h}`, fileUrl(wrapper),
  ], { stdio: 'ignore' });
  fs.unlinkSync(wrapper); fs.unlinkSync(appCopy);
  console.log(`  ${w}px -> ${path.relative(root, out)}`);
}
console.log('Done. (Fresh headless profile => first-run UI, no saved state.)');
