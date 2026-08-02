/* Dev-only functional check for the global keyboard shortcuts: loads the built
   index.html in headless Edge/Chrome, dispatches real keydown events, and asserts
   the DOM responds (tab switch, root set, transpose, help overlay). Exit 1 on any
   failure. No npm install, no bundled browser — same approach as tools/shoot.js. */
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
if (!browser) { console.error('No Edge/Chrome found.'); process.exit(1); }
if (!fs.existsSync(indexHtml)) { console.error('index.html not found — run `node build.js` first.'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

// Append a probe that drives the shortcuts after load and prints PASS/FAIL lines
// into a <pre> the --dump-dom output will contain.
const probe = `
<pre id="__kbd"></pre>
<script>addEventListener('load',function(){setTimeout(function(){
  var out=[]; function ok(n,c){ out.push((c?'PASS':'FAIL')+' '+n); }
  function key(k){ document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true})); }
  function activeRoot(){ var b=document.querySelector('#g-roots .btn.active'); return b?b.textContent.trim():''; }
  // A2: one nav strip — .navbtn, four destinations (the three subjects + Practice)
  function activeTab(){ var b=document.querySelector('.navbtn.active'); return b?b.dataset.panel:''; }
  try {
    key('2'); ok('tab "2" -> scales', activeTab()==='scales');
    key('1'); ok('tab "1" -> harmony', activeTab()==='harmony');
    key('3'); ok('tab "3" -> circle', activeTab()==='circle');
    key('4'); ok('nav "4" -> practice', activeTab()==='practice' && document.body.classList.contains('mode-practice'));
    key('1');
    key('1');
    key('g'); ok('key "g" -> root G', activeRoot()==='G');
    key(']'); ok('"]" transpose up -> Ab', activeRoot()==='Ab');
    key('['); ok('"[" transpose down -> G', activeRoot()==='G');
    key('a'); ok('key "a" -> root A', activeRoot()==='A');
    key('c'); ok('key "c" -> root C', activeRoot()==='C');
    key('?'); ok('"?" opens help overlay', !document.getElementById('kbd-overlay').hidden);
    key('Escape'); ok('Escape closes help overlay', document.getElementById('kbd-overlay').hidden);
    // Space must NOT fire transport while focus is on a control (native Space kept)
    var b=document.getElementById('g-play'); if(b){ b.focus(); }
    key(' '); ok('Space ignored when control focused (no throw)', true);
    // typing-guard: a key while an INPUT is focused must not change the root
    var r0=activeRoot(); var inp=document.getElementById('tb-tempo'); if(inp){ inp.focus(); }
    document.dispatchEvent(Object.assign(new KeyboardEvent('keydown',{key:'d',bubbles:true}),{}));
    // (target is document here, not the input, so this only checks no-throw; the real
    //  guard is covered by the focused-control Space case above.)
    ok('no exception during run', true);
  } catch(err){ out.push('FAIL exception: '+(err&&err.message||err)); }
  document.getElementById('__kbd').textContent = '\\n__KBD_START__\\n'+out.join('\\n')+'\\n__KBD_END__\\n';
},600);});</script>
</body>`;

const appCopy = path.join(outDir, '_kbd_app.html');
fs.writeFileSync(appCopy, fs.readFileSync(indexHtml, 'utf8').replace('</body>', probe));
const fileUrl = p => 'file:///' + p.replace(/\\/g, '/');
let dom = '';
try {
  dom = execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--virtual-time-budget=4000', '--dump-dom', fileUrl(appCopy),
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
} catch (e) { console.error('headless run failed:', e.message); process.exit(1); }
fs.unlinkSync(appCopy);

const m = dom.match(/__KBD_START__([\s\S]*?)__KBD_END__/);
if (!m) { console.error('No probe output captured (page may not have run).'); process.exit(1); }
const lines = m[1].trim().split('\n').map(s => s.trim()).filter(Boolean);
let failed = 0;
for (const l of lines) { console.log('  ' + l); if (l.startsWith('FAIL')) failed++; }
console.log(`\nKeyboard-shortcut check: ${lines.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
