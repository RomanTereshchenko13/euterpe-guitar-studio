
/* PWA: register the service worker (install + offline), surface an update toast
   when a new version is waiting, and offer a native install via beforeinstallprompt.
   Best-effort and guarded — service workers need an http(s) origin, so the SW half
   is a silent no-op on file:// (the double-clicked dist build) and in jsdom (no
   navigator.serviceWorker). The install half listens on window events that simply
   never fire in those environments, so it stays dormant there too. Relative 'sw.js'
   keeps it working on a GitHub Pages subpath. */
(function () {
  /* ---- update toast: shown when a new SW is installed and waiting ---- */
  function showUpdateToast(worker) {
    var toast = document.getElementById('pwa-toast');
    if (!toast || !worker) return;
    toast.innerHTML =
      '<span class="toast-msg">' + t('pwa_update') + '</span>' +
      '<button class="toast-act" id="pwa-update-btn">' + t('pwa_update_btn') + '</button>' +
      '<button class="toast-x" id="pwa-toast-x" aria-label="' + t('pwa_dismiss') + '">✕</button>';
    toast.hidden = false;
    document.getElementById('pwa-update-btn').onclick = function () {
      toast.hidden = true;
      worker.postMessage({ type: 'SKIP_WAITING' });   // → activates → controllerchange → reload
    };
    document.getElementById('pwa-toast-x').onclick = function () { toast.hidden = true; };
  }

  if (('serviceWorker' in navigator) &&
      (location.protocol === 'https:' || location.protocol === 'http:')) {
    // When the waiting worker takes control, reload once so the new version runs.
    // Guard with hadController: the first-install clients.claim() ALSO fires
    // controllerchange, and must not reload the very first visit (only a genuine
    // update — where a controller already existed at load — should).
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading || !hadController) return; reloading = true; location.reload();
    });
    addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        // A version may already be waiting from a previous visit.
        if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg.waiting);
        reg.addEventListener('updatefound', function () {
          var w = reg.installing; if (!w) return;
          w.addEventListener('statechange', function () {
            // 'installed' + an existing controller == an update (not first install).
            if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(w);
          });
        });
      }).catch(function () { /* offline support is optional */ });
    });
  }

  /* ---- native install prompt: capture the event, offer our own button ---- */
  var deferredPrompt = null;
  var installBtn = document.getElementById('pwa-install');
  addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();                 // suppress the browser's mini-infobar; use our button
    deferredPrompt = e;
    if (installBtn) { installBtn.title = t('pwa_install_tip'); installBtn.setAttribute('aria-label', t('pwa_install_tip')); installBtn.hidden = false; }
  });
  if (installBtn) installBtn.onclick = function () {
    if (!deferredPrompt) return;
    var p = deferredPrompt; deferredPrompt = null; installBtn.hidden = true;
    p.prompt();
  };
  addEventListener('appinstalled', function () {
    deferredPrompt = null;
    if (installBtn) installBtn.hidden = true;
  });
})();
