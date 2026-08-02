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
   comp-the-progression drill, or `comp-run` to also press Play and land on the cycling now/next.
   Phase 6 Lead: `target` for the chord-tone-targeting drill, or `target-run` to also press Play and
   land on the lit-tones neck with the band cycling; `callresp` for the call-and-response drill.
   Phase 7 Timing: `timing` for the subdivision & timing coach, or `timing-run` to also press Play
   and land on the ticking grid with the scale walking the neck.

   Phase 10/A4 Settings: pass `settings` to expand the Settings disclosure (Instrument / Tools /
   Preferences). Combines with a mode token — `settings practice` is how you check that Tools is
   reachable from Practice, which is the whole point of splitting it out. Adds a `-settings` suffix.

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
let openSettings = false;                         // 'settings' token: expand the Settings panel (A4)
let meterArg = null;                              // optional time signature (e.g. '3/4') set before the drill starts
for (const a of process.argv.slice(2)) {
  if (a === 'tabs') tabArgs.push(...PANELS);
  else if (PANELS.includes(a)) tabArgs.push(a);
  else if (a === 'cbpalette' || a === 'shapes' || a === 'a11y') a11yArgs.push(a);
  else if (a === 'settings') openSettings = true;          // A4: expand the Settings disclosure
  else if (/^\d+\/\d+$/.test(a)) meterArg = a;              // time signature, e.g. 3/4 (Phase 7b)
  else if (a === 'practice' || a === 'reference' || a === 'drill' || a === 'changes' || a === 'changes-run'
           || a === 'strum' || a === 'strum-run' || a === 'comp' || a === 'comp-run'
           || a === 'target' || a === 'target-run' || a === 'callresp'
           || a === 'timing' || a === 'timing-run'
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
  if (panel) clicks.push(`var b=document.querySelector('.navbtn[data-panel="${panel}"]');if(b)b.click();`);   // A2: one nav strip
  // every drill lives under Practice now (the Ear mode folded in), so any non-reference
  // token starts by entering Practice — the ear tokens included.
  if (mode) clicks.push(`var m=document.querySelector('.navbtn[data-panel="practice"]');if(m)m.click();`);   // A2: one nav strip
  if (mode === 'drill') clicks.push(`var s=document.getElementById('start-notes');if(s)s.click();`);
  if (mode === 'changes' || mode === 'changes-run') clicks.push(`var s=document.getElementById('start-changes');if(s)s.click();`);
  if (mode === 'changes-run') clicks.push(`var g=document.getElementById('cm-start-btn');if(g)g.click();`);
  if (mode === 'strum' || mode === 'strum-run') clicks.push(`var s=document.getElementById('start-strum');if(s)s.click();`);
  if (mode === 'strum-run') clicks.push(`var g=document.getElementById('sp-play');if(g)g.click();`);
  if (mode === 'comp' || mode === 'comp-run') clicks.push(`var s=document.getElementById('start-comp');if(s)s.click();`);
  if (mode === 'comp-run') clicks.push(`var g=document.getElementById('tg-play');if(g)g.click();`);
  if (mode === 'target' || mode === 'target-run') clicks.push(`var s=document.getElementById('start-target');if(s)s.click();`);
  if (mode === 'target-run') clicks.push(`var g=document.getElementById('tg-play');if(g)g.click();`);
  if (mode === 'callresp') clicks.push(`var s=document.getElementById('start-callresp');if(s)s.click();`);
  if (mode === 'timing' || mode === 'timing-run') clicks.push(`var s=document.getElementById('start-timing');if(s)s.click();`);
  if (mode === 'timing-run') clicks.push(`var g=document.getElementById('sd-play');if(g)g.click();`);
  const earStart = { 'ear-interval': 'start-interval', 'ear-chordq': 'start-chordq', 'ear-rhythm': 'start-rhythm' }[mode];
  if (earStart) clicks.push(`var s=document.getElementById('${earStart}');if(s)s.click();`);
  // Settings disclosure (A4): expand it LAST, so the shot shows the three clusters
  // (Instrument / Tools / Preferences) in whichever mode was selected above — which is
  // how you check that Tools is reachable from Practice, not only from Reference.
  if (openSettings) clicks.push(`var st=document.getElementById('tb-toggle');if(st)st.click();`);
  // accessibility toggles (additive): flip the colour-blind palette and/or dot shapes
  if (a11yArgs.includes('cbpalette') || a11yArgs.includes('a11y')) clicks.push(`var b=document.getElementById('tb-cbpalette');if(b)b.click();`);
  if (a11yArgs.includes('shapes') || a11yArgs.includes('a11y')) clicks.push(`var b=document.getElementById('tb-shapes');if(b)b.click();`);
  // time signature (Phase 7b): set #tb-meter to the requested option BEFORE the drill
  // starts, so the backing band / sequencer pick up the meter as they spin up.
  if (meterArg) clicks.unshift(`var ms=document.getElementById('tb-meter');if(ms){for(var i=0;i<ms.options.length;i++){if(ms.options[i].textContent==='${meterArg}'||ms.options[i].value==='${meterArg}'){ms.selectedIndex=i;break;}}ms.dispatchEvent(new Event('change'));}`);
  // any non-default capture: dismiss the first-run welcome first so it doesn't block
  // the surface (the no-arg shot keeps it, to capture the onboarding card itself).
  if (panel || mode || a11yArgs.length || openSettings) clicks.unshift(`var wc=document.getElementById('wc-got');if(wc)wc.click();`);
  const switcher = clicks.length
    ? `<script>addEventListener('load',function(){try{${clicks.join('')}}catch(e){}});</script>`
    : '';
  /* Freeze animation (Phase 10/A4). Everything above is a CLICK after load, and any
     panel revealed by one carries `animation: fade 0.25s` — which does not advance
     under --virtual-time-budget, so the shot catches the keyframe's `from` state and
     the surface photographs blank or half-faded. That produced a "blank Practice page"
     that looked exactly like a real regression and wasn't (the DOM state was correct
     the whole time). Killing animations and transitions makes every shot deterministic
     and shows each element in its settled state, which is what a layout review wants;
     motion is not what these PNGs are for. */
  const freeze = '<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>';
  return baseHtml.replace('</body>', `${freeze}${switcher}
<div id="__probe" style="position:fixed;left:6px;bottom:6px;z-index:99999;font:bold 12px monospace;padding:4px 7px;border-radius:5px"></div>
<script>addEventListener('load',function(){setTimeout(function(){
  var sw=document.documentElement.scrollWidth,iw=innerWidth,p=document.getElementById('__probe'),over=sw>iw+1;
  var who='';
  if(over){
    // Name the culprit, not just the symptom. "HORIZONTAL OVERFLOW SW=415" tells you
    // the page is 25px too wide and nothing about which element did it, which used to
    // mean bisecting CSS by hand. Skip anything inside a deliberate scroller (.scroll
    // is the board's own; a wide neck overflowing THAT is the design) and report the
    // widest remaining offender.
    var worst=null,all=document.querySelectorAll('body *');
    for(var i=0;i<all.length;i++){
      var el=all[i]; if(el.id==='__probe'||el.closest('.scroll')) continue;
      var r=el.getBoundingClientRect();
      if(r.width>0&&r.right>iw+1&&(!worst||r.right>worst.r)) worst={r:r.right,el:el};
    }
    if(worst) who=' <- '+worst.el.tagName.toLowerCase()+(worst.el.id?'#'+worst.el.id:'')+
      (worst.el.className&&typeof worst.el.className==='string'?'.'+worst.el.className.trim().split(/\s+/).join('.'):'')+
      ' right='+Math.round(worst.r);
  }
  p.textContent=(over?'HORIZONTAL OVERFLOW ':'fits ')+'IW='+iw+' SW='+sw+who;
  p.style.background=over?'#c0392b':'#1f7a3f';p.style.color='#fff';p.style.maxWidth='96vw';
},600);});</script>
</body>`);
}

for (const { w, h } of specs) {
  for (const panel of tabs) {
    const tag = (panel ? `${w}-${panel}` : `${w}`) + (mode ? '-' + mode : '') + (openSettings ? '-settings' : '') + (a11yArgs.length ? '-' + a11yArgs.join('-') : '');
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
