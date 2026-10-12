// My claims: saved → filed → paid pipeline, payment tracking, CSV export.
import { icon, esc, money, fmtDate, ago, $, downloadFile, countUp, $$ } from '../ui.js';
import { store, claimTotals } from '../store.js';
import { avatar } from '../components.js';
import { askPaid } from './detail.js';

const TABS = [
  ['filed', 'Filed', 'clock'], ['paid', 'Paid', 'wallet'], ['saved', 'Saved', 'bookmark'], ['skip', 'Hidden', 'ban'],
];
let tab = 'filed';

export function render(root, { data, params }) {
  if (params.get('tab')) { tab = params.get('tab'); history.replaceState(null, '', '#/claims'); }
  const all = Object.entries(store.claims).filter(([, c]) => c.s);
  const counts = Object.fromEntries(TABS.map(([k]) => [k, all.filter(([, c]) => c.s === k).length]));
  const totals = claimTotals(data.items);
  const itemFor = (id, c) => data.byId.get(id) || { id, title: c.title || 'Settlement', company: c.company || c.title || 'Settlement', url: c.url, claim_url: c.claim_url, deadline: c.deadline, days: null, closed: true, hay: '', regionCodes: [] };
  const sortKey = { filed: 'filedAt', paid: 'paidAt', saved: 'savedAt', skip: 'ts' }[tab];
  const rows = all.filter(([, c]) => c.s === tab).sort((a, b) => String(b[1][sortKey] || b[1].ts).localeCompare(String(a[1][sortKey] || a[1].ts)));
  const filedOrPaid = counts.filed + counts.paid;
  const rate = filedOrPaid ? Math.round((counts.paid / filedOrPaid) * 100) : 0;

  root.innerHTML = `
    <div class="page-head view-enter">
      <div><div class="eyebrow">Your pipeline</div><h1>My claims</h1></div>
      ${all.length ? `<button class="btn" data-act="csv">${icon('download', 'sm')}Export CSV</button>` : ''}
    </div>

    <div class="kpis">
      <div class="surface kpi enter" style="--i:0"><span class="k-label">${icon('wallet')}Received</span><span class="k-value" data-count="${totals.received}">${money(totals.received)}</span><span class="k-sub">${counts.paid} payment${counts.paid === 1 ? '' : 's'}</span></div>
      <div class="surface kpi enter" style="--i:1"><span class="k-label">${icon('clock')}Pending</span><span class="k-value">${money(totals.pending)}</span><span class="k-sub">${counts.filed} awaiting payment</span></div>
      <div class="surface kpi enter" style="--i:2"><span class="k-label">${icon('claims')}Filed</span><span class="k-value">${filedOrPaid}</span><span class="k-sub">all time</span></div>
      <div class="surface kpi enter" style="--i:3;grid-auto-flow:column;align-items:center;justify-content:space-between"><div style="display:grid;gap:6px"><span class="k-label">${icon('trend')}Paid out</span><span class="k-value">${rate}%</span><span class="k-sub">of filed claims</span></div><div class="progress-ring" style="--p:${rate}"><b>${rate}</b></div></div>
    </div>

    <div class="section" style="margin-top:24px">
      <div class="segmented" role="tablist" id="seg">${TABS.map(([k, label, ic]) =>
        `<button role="tab" aria-pressed="${tab === k}" aria-selected="${tab === k}" data-tab="${k}">${icon(ic, 'sm')}${label}${counts[k] ? ` <span class="subtle num">${counts[k]}</span>` : ''}</button>`).join('')}<span class="thumb"></span></div>
    </div>

    <div style="margin-top:16px">${rows.length ? `<div class="list view-enter">${rows.map(([id, c], n) => row(itemFor(id, c), c, n)).join('')}</div>` : emptyFor(tab)}</div>
    ${tab === 'filed' && rows.length ? `<p class="group-note">Settlement payments usually arrive a few months after the claim deadline and final court approval. Tap <b>Paid</b> when the money lands.</p>` : ''}
  `;

  placeThumb(root);
  $$('[data-count]', root).forEach((el) => countUp(el, Number(el.dataset.count), (n) => money(Math.round(n * 100) / 100)));

  root.onclick = (e) => {
    const t = e.target.closest('[data-tab], [data-act], [data-paid]'); if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; render(root, { data, params: new URLSearchParams() }); return; }
    if (t.dataset.paid) { e.stopPropagation(); const id = t.dataset.paid; askPaid(itemFor(id, store.claims[id]), t); return; }
    if (t.dataset.act === 'csv') exportCsv(data);
  };
}

function row(item, c, n) {
  const sub = {
    filed: `Filed ${fmtDate(c.filedAt)}${c.confirmation ? ' · #' + c.confirmation : ''}`,
    paid: `${fmtDate(c.paidAt)}${c.method ? ' · ' + c.method : ''}`,
    saved: item.closed ? 'Closed' : item.days != null ? `${item.days <= 0 ? 'Due today' : item.days + ' days left'} · ${fmtDate(item.deadline)}` : 'No fixed deadline',
    skip: `Hidden ${ago(c.ts)}`,
  }[c.s];
  const end = {
    filed: `${c.expected ? `<span class="r-amount subtle">${money(Number(c.expected))}</span>` : ''}<button class="btn sm" data-paid="${esc(item.id)}">${icon('dollar', 'sm')}Paid</button>`,
    paid: `<span class="r-amount" style="color:var(--accent-text)">${c.amount != null ? money(Number(c.amount), true) : '—'}</span>`,
    saved: icon('chevronRight', 'sm'),
    skip: icon('chevronRight', 'sm'),
  }[c.s];
  return `<div class="row enter" style="--i:${n};cursor:pointer" data-open="${esc(item.id)}" role="button" tabindex="0">
    ${avatar(item)}
    <span class="r-main"><span class="r-title">${esc(item.company)}</span><span class="r-sub">${esc(sub)}</span></span>
    <span class="r-end">${end}</span></div>`;
}

function emptyFor(t) {
  const m = {
    filed: ['claims', 'No filed claims yet', 'Open a settlement, file it on the official site, then check "I\'ve filed this claim".'],
    paid: ['wallet', 'No payments yet', 'When a payout arrives, tap Paid on the filed claim to log the amount.'],
    saved: ['bookmark', 'Nothing saved', 'Save settlements to come back to them before the deadline.'],
    skip: ['ban', 'Nothing hidden', 'Settlements you mark as not eligible appear here.'],
  }[t];
  return `<div class="surface empty view-enter"><div class="e-art">${icon(m[0])}</div><h3>${m[1]}</h3><p>${esc(m[2])}</p>${t !== 'skip' ? '<a class="btn primary" href="#/browse">Browse settlements</a>' : ''}</div>`;
}

function placeThumb(root) {
  const seg = $('#seg', root), on = seg.querySelector('[aria-pressed="true"]'), th = seg.querySelector('.thumb');
  if (!on) return;
  th.style.width = on.offsetWidth + 'px';
  th.style.transform = `translateX(${on.offsetLeft - 3}px)`;
}

function exportCsv(data) {
  const cols = ['company', 'status', 'filed_at', 'confirmation', 'expected', 'paid_at', 'amount', 'method', 'deadline', 'notes', 'url'];
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.join(',')];
  Object.entries(store.claims).filter(([, c]) => c.s).forEach(([id, c]) => {
    const it = data.byId.get(id) || {};
    lines.push([it.company || c.company || c.title, c.s, c.filedAt, c.confirmation, c.expected, c.paidAt, c.amount, c.method, it.deadline || c.deadline, c.notes, c.claim_url || c.url || it.url].map(q).join(','));
  });
  downloadFile(`claims-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv');
}
