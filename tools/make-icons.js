/* Dev-only: rasterize src/icons/icon.svg into the PNGs the PWA manifest +
   iOS need, using system Edge/Chrome headless (same approach as shoot.js —
   no npm install, no bundled browser). The SVG stays the editable source;
   PNGs are generated, committed (Pages serves them). Run: node tools/make-icons.js */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'src', 'icons', 'icon.svg'), 'utf8');
const outDir = path.join(root, 'icons');
fs.mkdirSync(outDir, { recursive: true });

const CANDIDATES = [
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft/Edge/Application/msedge.exe'),
  process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe'),
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
  process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
].filter(Boolean);
const browser = CANDIDATES.find(p => fs.existsSync(p));
if (!browser) { console.error('No Edge/Chrome found.'); process.exit(1); }
const fileUrl = p => 'file:///' + p.replace(/\\/g, '/');

// The decorative Greek-key frame sits near the tile edge, so it survives an
// un-masked render (the "any" icons, favicon, apple-touch which iOS only lightly
// rounds). But Android maskable icons crop to a circle that would eat a square
// frame — so the maskable build nests the whole mark scaled into the safe zone,
// on a full-bleed bg of the same solid colour (seamless, since both are #1b1712).
const BG = '#1b1712';
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
function maskable() {
  // 0.68 keeps even the frame's corners inside the maskable safe circle
  // (radius 0.4*size): corner reach 294*scale <= 205.
  const scale = 0.68, dim = Math.round(512 * scale), off = Math.round((512 - dim) / 2);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    '<rect width="512" height="512" fill="' + BG + '"/>' +
    '<svg x="' + off + '" y="' + off + '" width="' + dim + '" height="' + dim +
    '" viewBox="0 0 512 512">' + inner + '</svg></svg>';
}
const jobs = [
  { size: 192, name: 'icon-192.png', maskable: false },
  { size: 512, name: 'icon-512.png', maskable: false },
  { size: 512, name: 'icon-maskable.png', maskable: true },
  { size: 180, name: 'apple-touch-icon.png', maskable: false },
];

for (const j of jobs) {
  const s = j.maskable ? maskable() : svg;
  const page = path.join(outDir, '_p.html');
  fs.writeFileSync(page, '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<style>html,body{margin:0}#i{width:' + j.size + 'px;height:' + j.size + 'px}</style></head>' +
    '<body><div id="i">' + s + '</div></body></html>');
  const out = path.join(outDir, j.name);
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--default-background-color=00000000', '--virtual-time-budget=1500',
    '--screenshot=' + out, '--window-size=' + j.size + ',' + j.size, fileUrl(page),
  ], { stdio: 'ignore' });
  fs.unlinkSync(page);
  console.log('  ' + j.name + ' (' + j.size + 'px)');
}
console.log('Wrote icons to icons/');
