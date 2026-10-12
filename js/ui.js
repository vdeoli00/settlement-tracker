// Shared UI primitives: icons, escaping, formatting, toasts, sheets, modals, confetti.

const ICONS = {
  logo: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  claims: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m8 12 3 3 5-6"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 21v-5h-5"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  dollar: '<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sparkles: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  logout: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  cloud: '<path d="M7 18a5 5 0 0 1-.9-9.9A7 7 0 0 1 19.5 10 4 4 0 0 1 18 18z"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1.3-1-1.6-1-2.9 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
};

export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeUrl = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null; } catch { return null; } };
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// ---------- formatting ----------
const money0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n, cents = false) => (n == null || isNaN(n) ? '—' : (cents || n % 1 ? money2 : money0).format(n));
export function fmtDate(iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, opts);
}
export function daysUntil(iso) {
  if (!iso) return null;
  const end = new Date(iso + 'T23:59:59');
  return Math.ceil((end - Date.now()) / 86400000);
}
export function relDays(n) {
  if (n == null) return '';
  if (n <= 0) return 'Due today';
  if (n === 1) return '1 day left';
  if (n < 60) return `${n} days left`;
  return `${Math.round(n / 30)} months left`;
}
export function ago(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - (typeof ts === 'number' ? ts : Date.parse(ts))) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d < 30 ? `${d}d ago` : fmtDate(new Date(Date.now() - s * 1000).toISOString());
}
export function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// Stable color per company name for avatars.
const HUES = [158, 200, 230, 262, 290, 330, 12, 28, 45, 174, 214, 248];
export function avatarStyle(name) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = HUES[h % HUES.length];
  return `background:linear-gradient(135deg,hsl(${hue} 70% 52%),hsl(${(hue + 25) % 360} 72% 40%))`;
}
export function initials(name) {
  const w = name.replace(/[^A-Za-z0-9& ]/g, ' ').split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '?') + (w[1]?.[0] || '')).toUpperCase();
}

// ---------- feedback ----------
export function haptic(ms = 8) { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } }

let toastRoot;
export function toast(message, { action, onAction, icon: ic = 'check', duration = 3200 } = {}) {
  toastRoot ||= document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status');
  el.innerHTML = `${icon(ic)}<span class="t-msg">${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  if (action) el.querySelector('button').addEventListener('click', () => { onAction?.(); close(); });
  toastRoot.append(el);
  while (toastRoot.children.length > 3) toastRoot.firstElementChild.remove();
  setTimeout(close, duration);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}

export function confetti(x = innerWidth / 2, y = innerHeight / 2) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#12b981', '#34d399', '#6366f1', '#f59e0b', '#ec4899', '#38bdf8'];
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('i');
    p.className = 'confetti-piece';
    const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 140;
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d + 120}px;--rot:${Math.random() * 720 - 360}deg`;
    document.body.append(p); setTimeout(() => p.remove(), 1000);
  }
}

// ---------- overlays ----------
const openStack = [];
function trapFocus(container, e) {
  if (e.key !== 'Tab') return;
  const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', container).filter((x) => !x.disabled && x.offsetParent);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
document.addEventListener('keydown', (e) => {
  const top = openStack[openStack.length - 1]; if (!top) return;
  if (e.key === 'Escape') { e.preventDefault(); top.close(); }
  else trapFocus(top.el, e);
});

function overlay(kind, html, { onClose, label = 'Dialog' } = {}) {
  const prevFocus = document.activeElement;
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const el = document.createElement('div');
  el.className = kind; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label);
  el.innerHTML = html;
  document.body.append(scrim, el);
  document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('open'); el.classList.add('open'); }));
  let closed = false;
  const api = {
    el,
    close() {
      if (closed) return; closed = true;
      openStack.splice(openStack.indexOf(api), 1);
      scrim.classList.remove('open'); el.classList.remove('open');
      setTimeout(() => { scrim.remove(); el.remove(); }, 420);
      if (!openStack.length) document.documentElement.style.overflow = '';
      prevFocus?.focus?.({ preventScroll: true });
      onClose?.();
    },
  };
  scrim.addEventListener('click', () => api.close());
  openStack.push(api);
  setTimeout(() => (el.querySelector('[autofocus]') || el.querySelector('.sheet-body, .modal'))?.focus?.({ preventScroll: true }), 60);
  if (kind === 'sheet') enableSwipeDown(el, api);
  return api;
}
export const openSheet = (html, opts) => overlay('sheet', html, opts);
export const openModal = (html, opts) => overlay('modal', html, opts);

function enableSwipeDown(el, api) {
  let startY = null, dy = 0;
  el.addEventListener('touchstart', (e) => {
    const body = el.querySelector('.sheet-body');
    if (body && body.scrollTop > 0 && !e.target.closest('.sheet-head, .grabber')) return;
    startY = e.touches[0].clientY; dy = 0; el.style.transition = 'none';
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    if (dy > 0) el.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  el.addEventListener('touchend', () => {
    if (startY == null) return;
    el.style.transition = ''; el.style.transform = '';
    if (dy > 110) api.close();
    startY = null;
  });
}

// Wrap DOM updates in a View Transition when supported.
export function transition(fn) {
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) return document.startViewTransition(fn);
  fn(); return null;
}

// Animate a number counting up.
export function countUp(el, to, format = (n) => String(Math.round(n))) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = format(to); return; }
  const from = 0, start = performance.now(), dur = 700;
  const step = (t) => {
    const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = format(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// Calendar reminder (.ics) for a deadline, alert 3 days before.
export function downloadIcs(item) {
  const d = item.deadline.replace(/-/g, '');
  const clean = (s) => String(s).replace(/[\\,;]/g, ' ').replace(/\n/g, ' ');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//settled//EN', 'BEGIN:VEVENT',
    `UID:${item.id.replace(/[^\w-]/g, '')}@settled`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${d}`, `SUMMARY:Claim deadline: ${clean(item.company)}`, `DESCRIPTION:${clean(item.claim_url || item.url)}`,
    'BEGIN:VALARM', 'TRIGGER:-P3D', 'ACTION:DISPLAY', 'DESCRIPTION:Claim deadline in 3 days', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  downloadFile(`deadline-${item.deadline}.ics`, lines.join('\r\n'), 'text/calendar');
}
export function downloadFile(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
