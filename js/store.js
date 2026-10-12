// App state: preferences + per-settlement claim records, persisted to localStorage.
// Reads the v1 format from the first version of the site and migrates it.

const KEY = 'settle.v2';
const LEGACY_KEY = 'settle.v1';
export const STATUSES = ['saved', 'filed', 'paid', 'skip'];

const DEFAULT_PREFS = { theme: 'system', kw: [], state: '', showNotice: false, showDocs: false, showAuto: false, showOther: false, onboarded: false };
const listeners = new Set();

export function parseKeywords(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(',');
  const seen = new Set();
  return arr.map((s) => String(s).trim()).filter((s) => s.length > 1 && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

export function normClaim(c) {
  if (!c || typeof c !== 'object') return null;
  const out = { ...c };
  if (out.s === 'want') out.s = 'saved';
  if (out.amt != null && out.amount == null) { out.amount = parseFloat(out.amt) || null; delete out.amt; }
  if (out.s === 'filed' && !out.filedAt && out.at) out.filedAt = out.at;
  if (out.s === 'paid' && !out.paidAt && out.at) out.paidAt = out.at;
  out.ts ||= 0;
  return out;
}

export function normPrefs(p) {
  const out = { ...DEFAULT_PREFS, ...(p || {}) };
  out.kw = parseKeywords(out.kw);
  if (!['system', 'light', 'dark'].includes(out.theme)) out.theme = 'system';
  return out;
}

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* ignore */ }
  if (!raw) {
    try {
      const v1 = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (v1) raw = { prefs: { ...v1, onboarded: !!v1.kw }, claims: v1.status || {} };
    } catch { /* ignore */ }
  }
  const claims = {};
  Object.entries(raw?.claims || {}).forEach(([id, c]) => { const n = normClaim(c); if (n) claims[id] = n; });
  return { prefs: normPrefs(raw?.prefs), claims, owner: raw?.owner || null };
}

const state = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}
function emit(source = 'local') { persist(); listeners.forEach((fn) => fn(source)); }

export const store = {
  get prefs() { return state.prefs; },
  get claims() { return state.claims; },
  // Which account this browser's local data belongs to (null = signed-out data).
  get owner() { return state.owner; },
  setOwner(uid) { state.owner = uid; persist(); },
  claim(id) { const c = state.claims[id]; return c && c.s ? c : null; },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  setPref(key, value) { state.prefs[key] = key === 'kw' ? parseKeywords(value) : value; emit(); },
  setPrefs(patch) { Object.assign(state.prefs, patch); state.prefs = normPrefs(state.prefs); emit(); },

  // Update a claim record. Keeps a copy of the settlement's basics so it survives the feed dropping it.
  setClaim(id, patch, item) {
    const prev = state.claims[id] || {};
    const next = { ...prev, ...patch, ts: Date.now() };
    if (item) Object.assign(next, { title: item.title, url: item.url, claim_url: item.claim_url || null, deadline: item.deadline || null, company: item.company });
    if (patch.s === 'filed' && !next.filedAt) next.filedAt = today();
    if (patch.s === 'paid' && !next.paidAt) next.paidAt = today();
    if (patch.s === 'saved' && !next.savedAt) next.savedAt = today();
    state.claims[id] = next;
    emit();
    return next;
  },
  clearClaim(id) { if (state.claims[id]) { state.claims[id] = { s: '', ts: Date.now() }; emit(); } },

  // Replace everything (sync pull / import). source 'remote' prevents an immediate push loop.
  replace({ prefs, claims }, source = 'remote') {
    if (prefs) state.prefs = normPrefs(prefs);
    if (claims) {
      const out = {};
      Object.entries(claims).forEach(([id, c]) => { const n = normClaim(c); if (n) out[id] = n; });
      state.claims = out;
    }
    emit(source);
  },
  // 'reset' source: the account module must not push this wipe to the server.
  resetAll() { state.prefs = normPrefs({ theme: state.prefs.theme }); state.claims = {}; state.owner = null; emit('reset'); },
  snapshot() { return JSON.parse(JSON.stringify(state)); },
};

export function mergeClaims(a = {}, b = {}) {
  const out = {};
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach((id) => {
    const x = normClaim(a[id]), y = normClaim(b[id]);
    out[id] = !x ? y : !y ? x : (y.ts > x.ts ? y : x);
  });
  return out;
}

export function today() { return new Date().toISOString().slice(0, 10); }

export function claimTotals(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  let received = 0, pending = 0, filed = 0, paid = 0, saved = 0;
  Object.entries(state.claims).forEach(([id, c]) => {
    if (c.s === 'paid') { paid++; received += Number(c.amount) || 0; }
    if (c.s === 'filed') { filed++; pending += Number(c.expected) || estimateFor(byId.get(id)) || 0; }
    if (c.s === 'saved') saved++;
  });
  return { received, pending, filed, paid, saved };
}

// Best guess at a per-person payout: no-proof amount, else stated maximum (capped to avoid "up to $5,000" skew).
export function estimateFor(item) {
  if (!item) return 0;
  if (item.no_proof_amount) return item.no_proof_amount;
  if (item.proof === 'none' && item.payout_max) return Math.min(item.payout_max, 500);
  return 0;
}
