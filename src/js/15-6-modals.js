/* ===================== MODALS: changelog, shortcuts sheet, first-run welcome ===================== */
/* ---- changelog modal ---- */
function renderChangelog(){
  const body=document.getElementById('cl-body'); if(!body) return;
  body.innerHTML = CHANGELOG.map(r=>{
    const cur = r.v===APP_VERSION;
    const bullets=(r[lang]||r.en).map(li=>`<li>${li}</li>`).join('');
    return `<div class="cl-rel${cur?' current':''}"><div class="cl-rel-head">`+
      `<span class="cl-ver">v${r.v}</span>`+
      (cur?`<span class="cl-badge">${t('cl_current')}</span>`:'')+
      `<span class="cl-date">${r.date}</span></div><ul>${bullets}</ul></div>`;
  }).join('') +
    // only the newest few releases ship in the bundle; CHANGELOG.md has the rest
    `<p class="cl-older"><a href="https://github.com/RomanTereshchenko13/euterpe-guitar-studio/blob/main/CHANGELOG.md" target="_blank" rel="noopener">${t('cl_older')}</a></p>`;
}
function openChangelog(){ const o=document.getElementById('cl-overlay'); renderChangelog(); o.hidden=false; o.classList.add('open'); }
function closeChangelog(){ const o=document.getElementById('cl-overlay'); o.classList.remove('open'); o.hidden=true; }
document.getElementById('app-ver').onclick=openChangelog;
document.getElementById('cl-close').onclick=closeChangelog;
document.getElementById('cl-overlay').addEventListener('click',e=>{ if(e.target.id==='cl-overlay') closeChangelog(); });

/* ---- keyboard-shortcuts cheat-sheet ---- */
function openKbd(){ const o=document.getElementById('kbd-overlay'); if(!o) return; o.hidden=false; o.classList.add('open'); }
function closeKbd(){ const o=document.getElementById('kbd-overlay'); if(!o) return; o.classList.remove('open'); o.hidden=true; }
{ const c=document.getElementById('kbd-close'); if(c) c.onclick=closeKbd;
  const ov=document.getElementById('kbd-overlay'); if(ov) ov.addEventListener('click',e=>{ if(e.target.id==='kbd-overlay') closeKbd(); });
  const ob=document.getElementById('kbd-open'); if(ob) ob.onclick=openKbd; }
/* ---- first-run welcome ----
   A one-time card for new visitors; dismissing it records welcomeSeen. dismissWelcome
   is a no-op when the card isn't open, so the shared Escape handler can call it. */
function showWelcome(){ const o=document.getElementById('welcome-overlay'); if(!o) return; o.hidden=false; o.classList.add('open');
  const f=document.getElementById('wc-go-practice'); if(f) try{ f.focus(); }catch(_){} }
function dismissWelcome(){ const o=document.getElementById('welcome-overlay'); if(!o||o.hidden) return; o.classList.remove('open'); o.hidden=true; welcomeSeen=true; saveState(); }
{ const g=document.getElementById('wc-got');   if(g) g.onclick=dismissWelcome;
  const c=document.getElementById('wc-close'); if(c) c.onclick=dismissWelcome;
  /* Each answer routes somewhere. Dismiss first, so the destination isn't rendered
     behind the modal. */
  const route=(id,go)=>{ const b=document.getElementById(id); if(b) b.onclick=()=>{ dismissWelcome(); go(); }; };
  route('wc-go-practice', ()=>navTo('practice'));
  route('wc-go-tune',     micOpen);
  const o=document.getElementById('welcome-overlay'); if(o) o.addEventListener('click',e=>{ if(e.target.id==='welcome-overlay') dismissWelcome(); }); }

/* Escape closes the modal on top; with none open, it shuts the strip's sheet */
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  const modal=['cl-overlay','kbd-overlay','welcome-overlay','mic-overlay'].some(id=>{ const o=document.getElementById(id); return o && !o.hidden; });
  closeChangelog(); closeKbd(); dismissWelcome();
  if(!modal) closeSheets();
});
