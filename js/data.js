// Settlement data: fetch, derive display fields, and filter helpers.
import { daysUntil } from './ui.js';
import { estimateFor } from './store.js';

export const STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia' };

export const PROOF = {
  none: { label: 'No proof needed', short: 'No proof', tone: 'green', icon: 'check' },
  notice_id: { label: 'Needs ID from your notice', short: 'Notice ID', tone: 'blue', icon: 'mail' },
  docs: { label: 'Documentation required', short: 'Docs needed', tone: 'amber', icon: 'file' },
  automatic: { label: 'Automatic payment', short: 'Automatic', tone: '', icon: 'sparkles' },
  unknown: { label: 'Check claim site for proof rules', short: 'Check site', tone: '', icon: 'info' },
};

let cache = null;
let inflight = null;

function companyOf(title) {
  let t = title.replace(/^\$[\d.,]+\s?[MBK]?\s+/i, '').replace(/\s+\$[\d.,]+\s?(?:million|billion|[MBK])\b/gi, '');
  t = t.split(/\s[—–-]\s|:|\s(?:class action|settlement|data breach|privacy|false advertising|wage|lawsuit|recall)\b/i)[0];
  return t.trim().replace(/[’']s$/, '') || title;
}

function derive(it) {
  const days = daysUntil(it.deadline);
  const firstSeen = it.first_seen ? Date.parse(it.first_seen) : null;
  const company = companyOf(it.title);
  return Object.assign(it, {
    company,
    days,
    easy: it.proof === 'none' || !!it.no_proof_option,
    est: estimateFor(it),
    isNew: firstSeen ? Date.now() - firstSeen < 7 * 86400000 : false,
    hay: (it.title + ' ' + (it.summary || '') + ' ' + (it.category || '')).toLowerCase(),
    regionCodes: regionCodes(it.region),
  });
}

function regionCodes(r) {
  if (!r) return [];
  if (/canada/i.test(r)) return ['CANADA'];
  return Object.keys(STATES).filter((c) => new RegExp('\\b' + c + '\\b').test(r) || new RegExp(STATES[c], 'i').test(r));
}

export async function loadData({ fresh = false } = {}) {
  if (cache && !fresh) return cache;
  if (inflight) return inflight;
  inflight = fetch('data/settlements.json', { cache: fresh ? 'reload' : 'no-cache', credentials: 'omit' })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((d) => {
      const items = (d.items || []).map(derive).filter((i) => i.days == null || i.days >= 0);
      cache = { updated: d.updated, sources: d.sources || {}, items, byId: new Map(items.map((i) => [i.id, i])) };
      return cache;
    })
    .finally(() => { inflight = null; });
  return inflight;
}
export const getData = () => cache;

// ---------- selectors ----------
const kwCache = new Map();
function kwRe(k) {
  if (!kwCache.has(k)) kwCache.set(k, new RegExp('\\b' + k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'));
  return kwCache.get(k);
}
export function matchesFor(item, kws) { return kws.filter((k) => kwRe(k).test(item.hay)); }

export function regionOk(item, prefs) {
  if (!item.regionCodes.length) return true;
  if (prefs.showOther) return true;
  if (item.regionCodes.includes('CANADA')) return false;
  return !prefs.state || item.regionCodes.includes(prefs.state);
}

// Should this settlement show up in general lists given the user's filter preferences?
export function eligibleForLists(item, prefs) {
  if (!regionOk(item, prefs)) return false;
  if (item.proof === 'automatic') return prefs.showAuto;
  if (item.no_proof_option && item.proof !== 'notice_id') return true;
  if (item.proof === 'notice_id') return prefs.showNotice;
  if (item.proof === 'docs') return prefs.showDocs;
  return true;
}
export function isEasyFor(item, prefs) {
  return item.easy && regionOk(item, prefs) && (item.proof !== 'notice_id' || prefs.showNotice);
}

export function categories(items) {
  const m = new Map();
  items.forEach((i) => { if (i.category) m.set(i.category, (m.get(i.category) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function sortItems(list, by) {
  const arr = [...list];
  if (by === 'payout') arr.sort((a, b) => (b.payout_max || b.est || 0) - (a.payout_max || a.est || 0));
  else if (by === 'new') arr.sort((a, b) => (b.first_seen || '').localeCompare(a.first_seen || '') || (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  else arr.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  return arr;
}
