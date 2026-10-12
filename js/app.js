// App bootstrap: shell, hash router, refresh (button + pull-to-refresh), shortcuts, service worker.
import { icon, esc, toast, transition, ago, $, $$ } from './ui.js';
import { store } from './store.js';
import { loadData, getData } from './data.js';
import { account } from './account.js';
import { applyTheme } from './theme-apply.js';
import { skeletonCards, empty } from './components.js';
import * as home from './views/home.js';
import * as browse from './views/browse.js';
import * as claims from './views/claims.js';
import * as settings from './views/settings.js';
import { passwordModal } from './views/settings.js';
import { openDetail, checkPendingFiling } from './views/detail.js';

const ROUTES = { '': home, browse, claims, settings };
const NAV = [['', 'Home', 'home'], ['browse', 'Browse', 'compass'], ['claims', 'My claims', 'claims'], ['settings', 'Settings', 'settings']];
const TITLES = { '': 'Home', browse: 'Browse', claims: 'My claims', settings: 'Settings' };

let baseRoute = null, cleanup = null, sheet = null, sheetId = null, queued = false;
const view = () => $('#view');

// ---------- shell ----------
function shell() {
  const logo = `<span class="logo">${'<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7"/></svg>'}</span>`;
  $('#sidebar').innerHTML = `
    <a class="brand" href="#/">${logo}Settled</a>
    <nav class="nav" aria-label="Main">${NAV.map(([r, l, ic]) => `<a href="#/${r}" data-route="${r}">${icon(ic)}${l}<span class="count" data-count-for="${r}"></span></a>`).join('')}</nav>
    <div class="foot">
      <button class="btn ghost sm" data-act="refresh" style="justify-content:flex-start">${icon('refresh', 'sm')}<span data-fresh>Refresh</span></button>
      <a class="btn ghost sm" href="#/settings" style="justify-content:flex-start" data-acct>${icon('user', 'sm')}<span>Sign in</span></a>
    </div>`;
  $('#tabbar').innerHTML = NAV.map(([r, l, ic]) => `<a href="#/${r}" data-route="${r}">${icon(ic)}<span>${l.replace('My claims', 'Claims')}</span><span class="dot hidden" data-dot-for="${r}"></span></a>`).join('');
  $('#topbar').innerHTML = `<a class="brand-mini" href="#/" aria-label="Home">${logo}</a><span class="title" id="page-title"></span>
    <button class="btn ghost icon-only sm" data-act="refresh" aria-label="Refresh settlements">${icon('refresh')}</button>
    <a class="btn ghost icon-only sm show-mobile" href="#/settings" aria-label="Account" data-acct-mobile>${icon('user')}</a>`;
}

function updateChrome(route) {
  $$('[data-route]').forEach((a) => { if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#page-title').textContent = TITLES[route] || '';
  document.title = `${TITLES[route] || 'Settled'} · Settled`;
  const d = getData();
  const filed = Object.values(store.claims).filter((c) => c.s === 'filed').length;
  const setCount = (r, n) => { const el = $(`[data-count-for="${r}"]`); if (el) el.textContent = n || ''; };
  setCount('claims', filed);
  const urgent = d ? d.items.filter((i) => i.easy && i.days != null && i.days <= 3 && !store.claim(i.id)).length : 0;
  const dot = $('[data-dot-for=""]'); if (dot) { dot.textContent = urgent; dot.classList.toggle('hidden', !urgent); }
  const s = account.state.session;
  const acct = $('[data-acct] span'); if (acct) acct.textContent = s ? s.user.email : 'Sign in';
  if (d) { const f = $('[data-fresh]'); if (f) f.textContent = 'Updated ' + ago(d.updated); }
}

// ---------- routing ----------
function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  if (path.startsWith('s/')) return { detail: decodeURIComponent(path.slice(2)), params: new URLSearchParams(qs) };
  return { route: ROUTES[path] ? path : '', params: new URLSearchParams(qs) };
}

let renderToken = 0;
function renderRoute(route, params, animate = true) {
  const mod = ROUTES[route];
  const token = ++renderToken;
  const run = () => {
    // A view transition runs its callback later; skip it if a newer render already happened.
    if (token !== renderToken) return;
    const data = getData();
    cleanup?.(); cleanup = null;
    if (!data) { view().innerHTML = `<div class="page-head"><div><div class="skeleton" style="width:120px;height:14px;margin-bottom:10px"></div><div class="skeleton" style="width:220px;height:32px"></div></div></div>${skeletonCards(6)}`; return; }
    cleanup = mod.render(view(), { data, params }) || null;
  };
  if (animate && baseRoute !== route) transition(run); else run();
  baseRoute = route;
  updateChrome(route);
}

function onHash() {
  const p = parse();
  if (p.detail) {
    if (baseRoute == null) renderRoute('', new URLSearchParams(), false);
    showDetail(p.detail);
    return;
  }
  if (sheet) { const s = sheet; sheet = null; sheetId = null; s.close(); }
  const changed = baseRoute !== p.route;
  renderRoute(p.route, p.params);
  if (changed) window.scrollTo(0, 0);
}

export function lookup(id) {
  const d = getData();
  const it = d?.byId.get(id);
  if (it) return it;
  const c = store.claims[id];
  if (!c) return null;
  return { id, title: c.title || 'Settlement', company: c.company || c.title || 'Settlement', url: c.url, claim_url: c.claim_url, deadline: c.deadline, days: null,
    deadline_text: 'Closed or no longer listed', proof: 'unknown', hay: '', regionCodes: [], also: [], summary: '' };
}

function showDetail(id) {
  if (sheetId === id) return;
  const item = lookup(id);
  if (!item) { if (getData()) { toast('That settlement is no longer listed', { icon: 'info' }); history.replaceState(null, '', '#/' + (baseRoute || '')); } return; }
  if (sheet) { const s = sheet; sheet = null; s.close(); }
  sheetId = id;
  sheet = openDetail(item, {
    onClose() {
      sheet = null; sheetId = null;
      if (parse().detail) history.replaceState(null, '', '#/' + (baseRoute || ''));
    },
  });
}

// Re-render the current view after state changes (batched).
function queueRender() {
  if (queued) return; queued = true;
  requestAnimationFrame(() => { queued = false; if (baseRoute != null) { const y = scrollY; renderRoute(baseRoute, new URLSearchParams(), false); scrollTo(0, y); } });
}

// ---------- refresh ----------
let refreshing = false;
async function refresh({ quiet = false } = {}) {
  if (refreshing) return; refreshing = true;
  $$('[data-act="refresh"] .icon').forEach((i) => i.style.animation = 'spin .8s linear infinite');
  try {
    const before = getData()?.updated;
    const d = await loadData({ fresh: true });
    queueRender();
    if (!quiet) toast(d.updated !== before ? `Updated · ${d.items.length} open settlements` : 'Already up to date', { icon: 'refresh' });
  } catch (e) { toast('Could not refresh. Check your connection.', { icon: 'alert' }); }
  $$('[data-act="refresh"] .icon').forEach((i) => i.style.animation = '');
  refreshing = false;
}

function pullToRefresh() {
  const ptr = $('#ptr'); let y0 = null, dy = 0;
  addEventListener('touchstart', (e) => { if (scrollY <= 0 && !document.querySelector('.sheet.open, .modal.open')) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0) return;
    const d = Math.min(dy * 0.5, 90);
    ptr.style.opacity = Math.min(1, d / 60); ptr.style.transform = `translateY(${d - 40}px) rotate(${d * 4}deg)`;
  }, { passive: true });
  addEventListener('touchend', async () => {
    if (y0 == null) return; y0 = null;
    if (dy * 0.5 > 70) { ptr.classList.add('spin'); ptr.style.transform = 'translateY(20px)'; await refresh(); ptr.classList.remove('spin'); }
    ptr.style.opacity = 0; ptr.style.transform = '';
  });
}

// ---------- service worker ----------
function registerSW() {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          toast('A new version is ready', { icon: 'sparkles', action: 'Reload', duration: 12000, onAction: () => w.postMessage('skipWaiting') });
        }
      });
    });
  }).catch(() => { /* offline support is optional */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

// ---------- boot ----------
async function boot() {
  applyTheme(store.prefs.theme);
  shell();
  addEventListener('hashchange', onHash);
  addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', scrollY > 4), { passive: true });
  addEventListener('app:refresh', () => refresh());
  document.addEventListener('click', (e) => {
    const r = e.target.closest('[data-act="refresh"]'); if (r) { refresh(); return; }
    const o = e.target.closest('[data-open]');
    if (o && !e.target.closest('[data-paid], a[href^="http"]')) { e.preventDefault(); location.hash = '#/s/' + encodeURIComponent(o.dataset.open); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) {
      if (e.key === 'Enter' && e.target.matches('[data-open][role="button"]')) e.target.click();
      return;
    }
    if (e.key === '/') { e.preventDefault(); if (baseRoute !== 'browse') location.hash = '#/browse'; setTimeout(() => browse.focusSearch(), 50); }
    if (e.key === 'Enter' && e.target.matches?.('[data-open][role="button"]')) e.target.click();
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkPendingFiling(lookup); if (Date.now() - Date.parse(getData()?.updated || 0) > 6 * 3600000) refresh({ quiet: true }); } });
  addEventListener('focus', () => checkPendingFiling(lookup));

  store.on(() => { applyTheme(store.prefs.theme); queueRender(); });
  let recoveryShown = false;
  account.on((st) => {
    queueRender();
    if (st.recovery && st.session && !recoveryShown) {
      recoveryShown = true;
      passwordModal({ title: 'Set a new password', body: 'Choose a new password for your account. Claim info saved before the reset may need to be re-entered.', submit: 'Save password',
        async onSubmit(pw) { const kept = await account.finishRecovery(pw); toast(kept ? 'Password updated' : 'Password updated. Re-enter your claim info in Settings.', { icon: 'key', duration: 5000 }); } });
    }
  });
  pullToRefresh();
  onHash();

  try { await loadData(); }
  catch (e) {
    view().innerHTML = empty({ art: 'alert', title: "Couldn't load settlements", body: 'Check your connection and try again.', action: '<button class="btn primary" data-act="refresh">Try again</button>' });
  }
  if (getData()) { const p = parse(); renderRoute(p.route ?? baseRoute ?? '', p.params, false); if (p.detail) showDetail(p.detail); }
  account.init();
  registerSW();
}

boot();
