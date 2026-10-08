/* ===================== Protect progress (backup) =====================
   The learner model is the one thing in localStorage that can't be rebuilt by
   clicking around again, and three things put it at risk:
     - the browser evicting it (Safari drops script-written storage after 7 days
       without a visit, unless the site is installed or the storage is persistent),
     - a save that fails silently (private mode, storage full, blocked cookies),
     - a new device or a cleared browser.
   So: ask for persistent storage once there is history to protect, say so once when
   saving fails, and let the player carry everything out and back in as a JSON file.
   Local file only — nothing leaves the device.

   The file is the same snapshot saveState() writes (snapshotState), wrapped in an
   envelope that says what it is. Import is validated here (envelope, format, learner
   version, the learner itself through normalizeLearner, keys limited to the ones we
   save) and then written to storage and reloaded, so every preference goes through
   loadState()'s own bounds checks exactly as a normal boot does.

   Flags are `var`, not `let`: saveState() can fail from any module, and a `let` here
   would be in the temporal dead zone for anything that runs before slot 13. */

const BACKUP_APP = 'guitar-studio';
const BACKUP_KIND = 'progress';
const BACKUP_FORMAT = 1;
const BACKUP_MAX_BYTES = 5e6;   // a real file is tens of KB; anything this big isn't ours

var persistAsked = false;       // navigator.storage.persist() asked this page load
var saveFailShown = false;      // the failed-save notice is shown once per page load

/* Ask the browser to keep our storage out of eviction. Installed PWAs are usually
   granted silently; Firefox may prompt, which is why this runs after a finished
   session (the moment there is something to keep) and never at boot. */
function progressPersist(){
  if(persistAsked) return;
  persistAsked = true;
  try{
    const st = (typeof navigator!=='undefined') ? navigator.storage : null;
    if(!st || typeof st.persist!=='function') return;
    const ask = ()=>st.persist().catch(()=>false);
    if(typeof st.persisted==='function') st.persisted().then(p=>{ if(!p) ask(); }).catch(_=>{});
    else ask();
  }catch(_){}
}

function progressPayload(now){
  now = (typeof now==='number') ? now : Date.now();
  return { app:BACKUP_APP, kind:BACKUP_KIND, format:BACKUP_FORMAT, version:APP_VERSION,
           exported:new Date(now).toISOString(), state:snapshotState() };
}
function progressFileName(now){
  const d = new Date((typeof now==='number') ? now : Date.now());
  const p = n=>(n<10?'0':'')+n;
  return 'euterpe-progress-'+d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'.json';
}

/* Parse and validate a backup file's text. Pure: returns {ok:true, state, exported}
   or {ok:false, err:<i18n key>}, and touches neither storage nor the live model. */
function progressParse(text){
  if(typeof text!=='string' || text.length > BACKUP_MAX_BYTES) return { ok:false, err:'bk_err_notours' };
  let raw;
  try{ raw = JSON.parse(text); }catch(_){ return { ok:false, err:'bk_err_parse' }; }
  if(!raw || typeof raw!=='object' || raw.app!==BACKUP_APP || raw.kind!==BACKUP_KIND ||
     !raw.state || typeof raw.state!=='object' || Array.isArray(raw.state))
    return { ok:false, err:'bk_err_notours' };
  if(!Number.isInteger(raw.format) || raw.format < 1) return { ok:false, err:'bk_err_notours' };
  // A newer app may have reshaped things this build can't read; normalizeLearner would
  // turn an unknown learner version into an EMPTY model, which here means wiping the
  // player's progress with their own backup. Refuse instead.
  if(raw.format > BACKUP_FORMAT) return { ok:false, err:'bk_err_newer' };
  const rl = raw.state.learner;
  if(rl && typeof rl==='object' && typeof rl.v==='number' && rl.v > LEARNER_V) return { ok:false, err:'bk_err_newer' };
  const known = snapshotState(), state = {};
  Object.keys(known).forEach(k=>{ if(Object.prototype.hasOwnProperty.call(raw.state, k)) state[k] = raw.state[k]; });
  state.learner = normalizeLearner(rl);
  const ex = Date.parse(raw.exported);
  return { ok:true, state, exported: isFinite(ex) ? ex : null };
}

function progressExport(){
  const now = Date.now();
  const name = progressFileName(now);
  try{
    const blob = new Blob([JSON.stringify(progressPayload(now))], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.hidden = true;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 10000);
    backupStatus(t('bk_exported')+' '+name);
  }catch(e){ devWarn('export failed', e); backupStatus(t('bk_err_export')); }
}

/* Write an already-validated state and reload into it. Returns false (and changes
   nothing) if storage refuses the write. */
function progressApply(state){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch(e){ devWarn('import could not be stored', e); return false; }
  saveBlocked = true;
  return true;
}

function progressImportText(text){
  const r = progressParse(text);
  if(!r.ok){ backupStatus(t(r.err)); return; }
  const loc = lang==='en' ? 'en-GB' : 'uk-UA';
  const when = r.exported ? new Date(r.exported).toLocaleDateString(loc) : '?';
  const msg = t('bk_confirm').replace('{cur}', learner.sessions.length)
    .replace('{date}', when).replace('{n}', r.state.learner.sessions.length);
  if(!window.confirm(msg)) return;
  if(!progressApply(r.state)){ backupStatus(t('bk_err_store')); return; }
  location.reload();
}

function backupStatus(msg){
  const el = document.getElementById('bk-status');
  if(!el) return;
  el.textContent = msg; el.hidden = !msg;
}

/* Called by saveState() when the write throws. Once per page load: a player who can't
   save needs to hear it, not to hear it on every tap. The action exports right away,
   since this tab is the only place their progress still exists. */
function saveFailed(){
  if(saveFailShown) return;
  const toast = document.getElementById('app-toast');
  if(!toast) return;
  saveFailShown = true;
  toast.innerHTML =
    '<span class="toast-msg">' + t('bk_save_fail') + '</span>' +
    '<button class="toast-act" id="app-toast-act">' + t('bk_export') + '</button>' +
    '<button class="toast-x" id="app-toast-x" aria-label="' + t('pwa_dismiss') + '">✕</button>';
  toast.hidden = false;
  document.getElementById('app-toast-act').onclick = function(){ toast.hidden = true; progressExport(); };
  document.getElementById('app-toast-x').onclick = function(){ toast.hidden = true; };
}

{ const ex = document.getElementById('bk-export'), im = document.getElementById('bk-import'),
        f = document.getElementById('bk-file');
  if(ex) ex.onclick = progressExport;
  if(im && f){
    im.onclick = ()=>{ f.value = ''; f.click(); };
    f.onchange = ()=>{
      const file = f.files && f.files[0];
      if(!file) return;
      if(file.size > BACKUP_MAX_BYTES){ backupStatus(t('bk_err_notours')); return; }
      const rd = new FileReader();
      rd.onload = ()=>progressImportText(String(rd.result));
      rd.onerror = ()=>backupStatus(t('bk_err_parse'));
      rd.readAsText(file);
    };
  }
}
