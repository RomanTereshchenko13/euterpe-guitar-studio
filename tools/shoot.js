/* Dev-only visual-inspection tool: render the built index.html at one or more viewport
   sizes and save PNGs under tools/shots/ (gitignored), so layout can be eyeballed without
   a manual browser. Uses the system Edge/Chrome headless — no npm install, nothing added
   to the shipped app.

   Why the iframe: headless `--window-size` sets only the screenshot canvas, not the
   layout viewport, so a naive shot crops a wider layout and looks falsely "clipped". The
   app renders inside a fixed-width <iframe> (its real viewport) on a canvas sized to
   match. A probe prints HORIZONTAL OVERFLOW, and the widest culprit, if the page itself
   (not the board's own scroller) is wider than the viewport.

   Tokens (any order; each adds its name to the file, w{W}[-panel][-token…].png):
     sizes      390  390x844  1280x800 …       default 390 768 1280, height 3200
     tabs       harmony · scales · tabs (both)  default: the first-load tab
     Practice   practice (the home) · drill (note naming) · ear · ear-interval · ear-chordq
                changes · changes-run (pressed ▶) · rhythm · rhythm-run · rhythm-prog
                timing · timing-run
     sheets     settings · key · chord · tempo · drawer — opened last, in whatever mode
                was picked, so `settings practice` checks Settings from Practice
     views      triads (Harmony's Triads view) · tuner · pos4 (Scales position 4) ·
                shape3 (the third chord-shape card) — on a phone the neck scrolls to it
     display    cbpalette · shapes · a11y (both)
     meter      3/4, 6/8 … — set before anything starts
   Every capture but the bare default dismisses the first-run welcome; the bare one keeps
   it, to photograph the welcome itself.

   The orientation matrix for a layout change:
     node tools/shoot.js tabs 390x844 844x390 360x740 768x1024 1024x768 1280x800 1920x1080 */
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
const PANELS = ['harmony', 'scales'];
const tabArgs = [];
const sizeArgs = [];
const a11yArgs = [];                              // accessibility toggles (additive): cbpalette / shapes / a11y (both)
let mode = null;                                  // null = reference (default), 'practice' = Practice surface
let openSettings = false;                         // 'settings': open the Settings sheet
let openSheet = null;                             // 'key' / 'chord' / 'tempo' / 'drawer' — one of the strip's sheets
let openTriads = false, openTuner = false;          // 'triads' / 'tuner' tokens
let pickPos = false, pickShape = false;             // 'pos4' / 'shape3' tokens (neck auto-scroll)
let meterArg = null;                              // optional time signature (e.g. '3/4') set before the drill starts
for (const a of process.argv.slice(2)) {
  if (a === 'tabs') tabArgs.push(...PANELS);
  else if (PANELS.includes(a)) tabArgs.push(a);
  else if (a === 'cbpalette' || a === 'shapes' || a === 'a11y') a11yArgs.push(a);
  else if (a === 'settings') openSettings = true;          // the Settings sheet
  else if (a === 'key' || a === 'chord' || a === 'tempo' || a === 'drawer') openSheet = a;   // one of the strip's sheets
  else if (a === 'triads') openTriads = true;              // Harmony's Triads view
  else if (a === 'tuner') openTuner = true;                // the one tuner
  else if (a === 'pos4') pickPos = true;                   // Scales position 4 (the neck scrolls to it)
  else if (a === 'shape3') pickShape = true;               // the third chord-shape card
  else if (/^\d+\/\d+$/.test(a)) meterArg = a;              // time signature, e.g. 3/4
  else if (a === 'practice' || a === 'reference' || a === 'drill'
           || a === 'changes' || a === 'changes-run'
           || a === 'rhythm' || a === 'rhythm-run' || a === 'rhythm-prog'
           || a === 'timing' || a === 'timing-run'
           || a === 'ear' || a === 'ear-interval' || a === 'ear-chordq')
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
  if (panel) clicks.push(`var b=document.querySelector('.navbtn[data-panel="${panel}"]');if(b)b.click();`);   // the one nav
  // every drill lives under Practice now (the Ear mode folded in), so any non-reference
  // token starts by entering Practice — the ear tokens included.
  if (mode) clicks.push(`var m=document.querySelector('.navbtn[data-panel="practice"]');if(m)m.click();`);   // the one nav
  if (mode === 'drill') clicks.push(`var s=document.getElementById('start-notes');if(s)s.click();`);
  if (mode === 'changes' || mode === 'changes-run') clicks.push(`var s=document.getElementById('start-changes');if(s)s.click();`);
  // every drill's Play / Start is the strip's ▶
  if (mode === 'changes-run') clicks.push(`var g=document.getElementById('g-play');if(g)g.click();`);
  if (/^rhythm/.test(mode || '')) clicks.push(`var s=document.getElementById('start-rhythm-guitar');if(s)s.click();`);
  if (mode === 'rhythm-prog') clicks.push(`var o=document.querySelectorAll('#sp-over .btn')[1];if(o)o.click();var f=document.querySelector('#sp-patterns [data-i="-1"]');if(f)f.click();`);
  if (mode === 'rhythm-run' || mode === 'rhythm-prog') clicks.push(`var g=document.getElementById('g-play');if(g)g.click();`);
  if (mode === 'timing' || mode === 'timing-run') clicks.push(`var s=document.getElementById('start-timing');if(s)s.click();`);
  if (mode === 'timing-run') clicks.push(`var g=document.getElementById('g-play');if(g)g.click();`);
  const earStart = { 'ear-interval': 'start-interval', 'ear-chordq': 'start-chordq' }[mode];
  if (earStart) clicks.push(`var s=document.getElementById('${earStart}');if(s)s.click();`);
  // Settings and the strip's sheets: opened LAST, in whichever mode was
  // selected above — `settings practice` checks Settings is reachable from Practice
  if (openSettings) clicks.push(`var st=document.getElementById('tb-toggle');if(st)st.click();`);
  const SHEET_CHIP = { key: 'chip-key', chord: 'chip-chord', tempo: 'chip-tempo', drawer: 'backing-toggle' };
  if (openSheet) clicks.push(`var sc=document.getElementById('${SHEET_CHIP[openSheet]}');if(sc)sc.click();`);
  if (openTriads) clicks.push(`var tr=document.getElementById('hv-triads');if(tr)tr.click();`);
  if (openTuner) clicks.push(`var tu=document.getElementById('tb-tuner');if(tu)tu.click();`);
  if (pickPos) clicks.push(`var p=document.querySelectorAll('#sc-pos .btn')[4];if(p)p.click();`);
  if (pickShape) clicks.push(`var c=document.querySelectorAll('#ch-diagram .chordbox')[2];if(c)c.click();`);
  // accessibility toggles (additive): flip the colour-blind palette and/or dot shapes
  if (a11yArgs.includes('cbpalette') || a11yArgs.includes('a11y')) clicks.push(`var b=document.getElementById('tb-cbpalette');if(b)b.click();`);
  if (a11yArgs.includes('shapes') || a11yArgs.includes('a11y')) clicks.push(`var b=document.getElementById('tb-shapes');if(b)b.click();`);
  // time signature: set #tb-meter to the requested option BEFORE the drill
  // starts, so the backing band / sequencer pick up the meter as they spin up.
  if (meterArg) clicks.unshift(`var ms=document.getElementById('tb-meter');if(ms){for(var i=0;i<ms.options.length;i++){if(ms.options[i].textContent==='${meterArg}'||ms.options[i].value==='${meterArg}'){ms.selectedIndex=i;break;}}ms.dispatchEvent(new Event('change'));}`);
  // any non-default capture: dismiss the first-run welcome first so it doesn't block
  // the surface (the no-arg shot keeps it, to capture the onboarding card itself).
  if (panel || mode || a11yArgs.length || openSettings || openSheet || openTriads || openTuner || pickPos || pickShape) clicks.unshift(`var wc=document.getElementById('wc-got');if(wc)wc.click();`);
  const switcher = clicks.length
    ? `<script>addEventListener('load',function(){try{${clicks.join('')}}catch(e){}});</script>`
    : '';
  /* Freeze animation. Everything above is a CLICK after load, and any
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
    const tag = (panel ? `${w}-${panel}` : `${w}`) + (mode ? '-' + mode : '') + (openSettings ? '-settings' : '') + (openSheet ? '-' + openSheet : '') + (openTriads ? '-triads' : '') + (openTuner ? '-tuner' : '') + (pickPos ? '-pos4' : '') + (pickShape ? '-shape3' : '') + (a11yArgs.length ? '-' + a11yArgs.join('-') : '');
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
      '--headless=new', '--disable-gpu', '--disable-extensions', '--disable-sync', '--hide-scrollbars', '--force-device-scale-factor=2',
      '--virtual-time-budget=3000',
      // headless virtual time never advances a smooth scroll: jump, so the shot shows where the neck lands
      ...(pickPos || pickShape ? ['--force-prefers-reduced-motion'] : []),
      `--screenshot=${out}`, `--window-size=${w},${h}`, fileUrl(wrapper),
    ], { stdio: 'ignore' });
    fs.unlinkSync(wrapper); fs.unlinkSync(appCopy);
    console.log(`  ${w}px${panel ? ' / ' + panel : ''} -> ${path.relative(root, out)}`);
  }
}
console.log('Done. (Fresh headless profile => first-run UI, no saved state.)');
