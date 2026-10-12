// Reusable HTML fragments for settlements and claims.
import { icon, esc, money, relDays, fmtDate, avatarStyle, initials } from './ui.js';
import { PROOF, matchesFor } from './data.js';

export function avatar(item, size = '') {
  const name = item.company || item.title || '?';
  return `<span class="avatar ${size}" style="${avatarStyle(name)}" aria-hidden="true">${esc(initials(name))}</span>`;
}

export function proofBadge(item) {
  const p = PROOF[item.proof] || PROOF.unknown;
  if (item.proof !== 'none' && item.no_proof_option) {
    return `<span class="badge green">${icon('check')}No-proof option${item.no_proof_amount ? ' · ' + money(item.no_proof_amount) : ''}</span>`;
  }
  return `<span class="badge ${p.tone}">${icon(p.icon)}${p.short}</span>`;
}

export function deadline(item) {
  if (item.days == null) return `<span class="deadline">${icon('clock', 'sm')}${esc(item.deadline_text || 'No fixed deadline')}</span>`;
  const d = item.days, cls = d <= 3 ? 'urgent' : d <= 10 ? 'soon' : '';
  const pct = Math.max(6, Math.min(100, 100 - (d / 60) * 100));
  return `<span class="deadline ${cls}" title="${esc(fmtDate(item.deadline))}"><span class="bar"><i style="width:${pct}%"></i></span>${esc(relDays(d))}</span>`;
}

export function payoutHTML(item) {
  if (item.no_proof_amount) return `${money(item.no_proof_amount)}<small>no proof</small>`;
  if (item.payout_max) return `<small>up to</small> ${money(item.payout_max)}`;
  return `<small>${esc(item.payout_text ? 'see details' : 'amount varies')}</small>`;
}

const STATUS_META = {
  saved: { label: 'Saved', tone: 'blue', icon: 'bookmark' },
  filed: { label: 'Filed', tone: 'green', icon: 'check' },
  paid: { label: 'Paid', tone: 'solid', icon: 'dollar' },
  skip: { label: 'Skipped', tone: '', icon: 'ban' },
};
export function statusBadge(claim) {
  const m = claim && STATUS_META[claim.s];
  return m ? `<span class="badge ${m.tone}">${icon(m.icon)}${m.label}</span>` : '';
}

export function card(item, { kws = [], claim = null, i = 0 } = {}) {
  const m = matchesFor(item, kws);
  const badges = [proofBadge(item)];
  if (item.isNew) badges.push('<span class="badge new">New</span>');
  if (m.length) badges.push(`<span class="badge blue">${icon('sparkles')}${esc(m.slice(0, 2).join(', '))}</span>`);
  if (item.region) badges.push(`<span class="badge">${icon('pin')}${esc(item.region.replace(/ residents?$/i, ''))}</span>`);
  return `<button type="button" class="card enter${m.length ? ' match' : ''}" style="--i:${i}" data-open="${esc(item.id)}" aria-label="${esc(item.company)}: open details">
    ${claim ? `<span class="status-pin">${statusBadge(claim)}</span>` : ''}
    <div class="c-top">${avatar(item)}
      <div style="min-width:0;padding-right:${claim ? '64px' : '0'}">
        <div class="c-title">${esc(item.company)}</div>
        <div class="c-meta">${esc(item.title.length > 70 ? item.title.slice(0, 70) + '…' : item.title)}</div>
      </div>
    </div>
    <div class="badges">${badges.join('')}</div>
    <div class="c-foot"><span class="payout">${payoutHTML(item)}</span>${deadline(item)}</div>
  </button>`;
}

export function skeletonCards(n = 6) {
  return `<div class="grid-cards">${Array.from({ length: n }, () => '<div class="skeleton sk-card"></div>').join('')}</div>`;
}

export function empty({ art = 'inbox', title, body = '', action = '' }) {
  return `<div class="empty view-enter"><div class="e-art">${icon(art)}</div><h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}${action}</div>`;
}
