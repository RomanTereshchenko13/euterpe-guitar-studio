
/* PWA: register the service worker so the app installs and runs offline.
   Best-effort and guarded — service workers need an http(s) origin, so this is
   a silent no-op for the file:// (double-clicked dist) build and in jsdom tests
   (no navigator.serviceWorker). Relative 'sw.js' keeps it working on a GitHub
   Pages subpath. */
(function () {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.protocol !== 'http:') return;
  addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is optional */ });
  });
})();
