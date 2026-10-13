// Account: email/password auth (Supabase), cross-device sync, and the encrypted claim-info vault.
// Supabase's client (~200 KB) is only loaded when a session exists or the user signs in.
import { store, mergeClaims } from './store.js';

const cfg = window.TRACKER_CONFIG || {};
const projectRef = (cfg.supabaseUrl || '').replace(/^https:\/\//, '').split('.')[0];
const TOKEN_KEY = `sb-${projectRef}-auth-token`;
export const VAULT_FIELDS = [
  ['first_name', 'First name', 'given-name'], ['last_name', 'Last name', 'family-name'],
  ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'],
  ['address1', 'Street address', 'address-line1'], ['address2', 'Apt / unit', 'address-line2'],
  ['city', 'City', 'address-level2'], ['state', 'State', 'address-level1'],
  ['zip', 'ZIP', 'postal-code'], ['paypal', 'PayPal email', 'off'],
  ['venmo', 'Venmo', 'off'], ['zelle', 'Zelle', 'off'],
];

const listeners = new Set();
const state = { configured: !!(cfg.supabaseUrl && cfg.supabaseKey), loading: false, session: null, sync: 'idle', syncAt: null, error: null, vaultUnlocked: false, recovery: false, isAdmin: false };
let sb = null, row = null, vaultKey = null, vaultData = null, pushTimer = null;
const emit = () => listeners.forEach((fn) => fn(state));

// ---------------- crypto (format unchanged from v1 so existing vaults still open) ----------------
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12);
  return b64(out);
}
async function unseal(blob, key) {
  const raw = unb64(blob);
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12))));
}

// Non-exportable CryptoKey cached per device so the vault stays unlocked between visits.
function idb(mode, fn) {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open('settle-keys', 1); } catch { resolve(null); return; }
    req.onupgradeneeded = () => req.result.createObjectStore('k');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction('k', mode); const r = fn(tx.objectStore('k'));
        tx.oncomplete = () => resolve(r && 'result' in r ? r.result : null);
        tx.onerror = () => resolve(null);
      } catch { resolve(null); }
    };
  });
}
const keyGet = (uid) => idb('readonly', (s) => s.get(uid));
const keyPut = (uid, k) => idb('readwrite', (s) => s.put(k, uid));
const keyDel = (uid) => idb('readwrite', (s) => s.delete(uid));

// ---------------- client ----------------
function loadClient() {
  if (sb) return Promise.resolve(sb);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/supabase.js'; s.async = true;
    s.onload = () => {
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      sb.auth.onAuthStateChange((event, session) => {
        state.session = session;
        if (event === 'PASSWORD_RECOVERY') state.recovery = true;
        if (!session) { row = null; vaultKey = null; vaultData = null; state.vaultUnlocked = false; state.sync = 'idle'; }
        emit();
      });
      resolve(sb);
    };
    s.onerror = () => reject(new Error('Could not load sign-in library'));
    document.head.append(s);
  });
}

async function restoreVault() {
  const k = await keyGet(state.session.user.id);
  if (!k) return;
  if (row?.vault) { try { vaultData = await unseal(row.vault, k); vaultKey = k; } catch { /* stale key: ask for password */ } }
  else { vaultKey = k; vaultData = {}; }
  state.vaultUnlocked = !!vaultKey;
}

async function unlockWith(password) {
  const salt = row?.vault_salt ? unb64(row.vault_salt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  if (row?.vault) {
    try { vaultData = await unseal(row.vault, key); } catch { return false; }
  } else {
    vaultData = {};
    row = Object.assign(row || {}, { vault_salt: b64(salt) });
  }
  vaultKey = key; state.vaultUnlocked = true;
  await keyPut(state.session.user.id, key);
  emit();
  return true;
}

async function rekeyVault(newPassword, keepData) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(newPassword, salt);
  vaultData = keepData ? (vaultData || {}) : {};
  row = Object.assign(row || {}, { vault_salt: b64(salt), vault: await seal(vaultData, key) });
  vaultKey = key; state.vaultUnlocked = true;
  await keyPut(state.session.user.id, key);
}

async function checkAdmin() {
  const { data } = await sb.from('app_admins').select('user_id').eq('user_id', state.session.user.id).maybeSingle();
  state.isAdmin = !!data;
}

function friendly(msg) {
  if (/Database error saving new user|is not invited/i.test(msg)) return "This email hasn't been invited yet. Ask the account owner to add it under Settings → Family & invites.";
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email or password. New here? Tap "Create account" above to make your account first.';
  if (/User already registered/i.test(msg)) return 'That email already has an account. Sign in instead.';
  if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a few minutes and try again.';
  return msg;
}

// ---------------- sync ----------------
async function pull() {
  if (!state.session) return;
  const uid = state.session.user.id;
  // Data left in this browser by a different account must never merge into this one.
  if (store.owner && store.owner !== uid) store.resetAll();
  state.sync = 'syncing'; emit();
  const res = await sb.from('user_data').select('*').maybeSingle();
  if (res.error) { state.sync = 'error'; state.error = res.error.message; emit(); return; }
  row = res.data;
  if (row) {
    const local = store.snapshot();
    const rp = row.profile || {};
    const remoteHasProfile = Array.isArray(rp.kw) ? rp.kw.length : !!rp.kw;
    const prefs = remoteHasProfile || !local.prefs.kw.length ? { ...local.prefs, ...rp, theme: rp.theme || local.prefs.theme } : local.prefs;
    store.replace({ prefs, claims: mergeClaims(local.claims, row.statuses || {}) }, 'remote');
  }
  store.setOwner(uid);
  state.sync = 'synced'; state.syncAt = Date.now(); emit();
}

async function push() {
  if (!state.session) return;
  state.sync = 'syncing'; emit();
  const snap = store.snapshot();
  const out = {
    user_id: state.session.user.id, profile: snap.prefs, statuses: snap.claims,
    vault: row?.vault || null, vault_salt: row?.vault_salt || null, updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('user_data').upsert(out, { onConflict: 'user_id' });
  if (error) { state.sync = 'error'; state.error = error.message; } else { state.sync = 'synced'; state.syncAt = Date.now(); state.error = null; }
  emit();
}

store.on((source) => {
  if (source !== 'local' || !state.session) return;
  clearTimeout(pushTimer); pushTimer = setTimeout(push, 700);
});

// ---------------- public API ----------------
export const account = {
  state,
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  // Restore an existing session without loading Supabase for signed-out visitors.
  async init() {
    if (!state.configured) return;
    let hasToken = false;
    try { hasToken = !!localStorage.getItem(TOKEN_KEY); } catch { /* ignore */ }
    const authLink = /access_token=|[?&]code=|type=recovery|error_description=/.test(location.href);
    if (!hasToken && !authLink) return;
    state.loading = true; emit();
    try {
      await loadClient();
      const { data } = await sb.auth.getSession();
      state.session = data.session;
      if (authLink) {
        if (/type=recovery/.test(location.href)) state.recovery = true;
        history.replaceState(null, '', location.pathname + '#/');
      }
      if (state.session) { await pull(); await restoreVault(); checkAdmin().then(emit); }
    } catch (e) { state.error = e.message; }
    state.loading = false; emit();
  },

  async signIn(email, password) {
    await loadClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendly(error.message));
    state.session = data.session;
    await pull();
    await unlockWith(password);
    await push();
    checkAdmin().then(emit);
  },

  async signUp(email, password) {
    await loadClient();
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw new Error(friendly(error.message));
    if (!data.session) throw new Error('Account created. Check your email to confirm it, then sign in.');
    state.session = data.session;
    await pull();
    await unlockWith(password);
    await push();
    checkAdmin().then(emit);
  },

  async sendReset(email) {
    await loadClient();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(friendly(error.message));
  },

  // Change password while signed in: claim info is re-encrypted so nothing is lost.
  async changePassword(newPassword) {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error(friendly(error.message));
    await rekeyVault(newPassword, state.vaultUnlocked);
    await push(); emit();
  },

  // Finish a reset-password link: the old password is unknown, so old claim info can't be decrypted.
  async finishRecovery(newPassword) {
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error(friendly(error.message));
    if (!row) await pull();
    let kept = false;
    const k = await keyGet(state.session.user.id);
    if (k && row?.vault) { try { vaultData = await unseal(row.vault, k); kept = true; } catch { /* key gone */ } }
    await rekeyVault(newPassword, kept);
    state.recovery = false;
    await push(); emit();
    return kept;
  },

  family: {
    async list() {
      const { data, error } = await sb.from('allowed_emails').select('email, added_at').order('added_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
    async add(email) {
      const { error } = await sb.from('allowed_emails').insert({ email: email.trim().toLowerCase() });
      if (error) throw new Error(/duplicate/i.test(error.message) ? 'Already invited.' : error.message);
    },
    async remove(email) {
      const { error } = await sb.from('allowed_emails').delete().eq('email', email);
      if (error) throw new Error(error.message);
    },
  },

  async signOut() {
    if (!sb) return;
    if (state.session) await keyDel(state.session.user.id);
    await sb.auth.signOut();
    store.resetAll(); // shared devices: the next person starts clean
    state.session = null; state.vaultUnlocked = false; state.isAdmin = false; vaultKey = null; vaultData = null; row = null; emit();
  },

  async unlock(password) { return unlockWith(password); },
  async syncNow() { await pull(); await push(); },

  vault: {
    get() { return state.vaultUnlocked && vaultData ? { ...vaultData } : null; },
    async save(data) {
      if (!vaultKey) throw new Error('Vault is locked');
      vaultData = { ...data };
      row = Object.assign(row || {}, { vault: await seal(vaultData, vaultKey) });
      await push();
    },
  },
};
