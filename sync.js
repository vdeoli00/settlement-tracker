// Email/password sign-in, cross-device sync, and encrypted claim info.
// Signed out, the profile and statuses still work from this browser's localStorage.
// Claim info is encrypted with a key derived from the login password; the key is kept
// on each device in IndexedDB as a non-exportable CryptoKey so it stays unlocked.
(() => {
  const cfg = window.TRACKER_CONFIG || {};
  const T = window.tracker;
  const $ = (s) => document.querySelector(s);
  const FIELDS = [
    ['first_name', 'First name', 'given-name'], ['last_name', 'Last name', 'family-name'],
    ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'],
    ['address1', 'Street address', 'address-line1'], ['address2', 'Apt / unit', 'address-line2'],
    ['city', 'City', 'address-level2'], ['state', 'State (2 letters)', 'address-level1'],
    ['zip', 'ZIP', 'postal-code'], ['paypal', 'PayPal email', 'off'],
    ['venmo', 'Venmo phone or @handle', 'off'], ['zelle', 'Zelle email or phone', 'off'],
  ];
  if (!T) return;
  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseKey) return;

  $('#accountPanel').classList.remove('hidden');
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  const msg = (t) => { $('#authMsg').textContent = t || ''; };
  $('#vaultFields').innerHTML = FIELDS.map(([k, label, ac]) =>
    `<div><label for="v_${k}">${label}</label><input type="text" id="v_${k}" autocomplete="${ac}"></div>`).join('');

  // ---------------- crypto ----------------
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
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

  // Per-device key cache (IndexedDB holds CryptoKey objects without exposing the raw key).
  function idb(mode, fn) {
    return new Promise((resolve) => {
      let req;
      try { req = indexedDB.open('settle-keys', 1); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = () => req.result.createObjectStore('k');
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('k', mode); const r = fn(tx.objectStore('k'));
          tx.oncomplete = () => resolve(r && 'result' in r ? r.result : null);
          tx.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      };
    });
  }
  const keyGet = (uid) => idb('readonly', (s) => s.get(uid));
  const keyPut = (uid, k) => idb('readwrite', (s) => s.put(k, uid));
  const keyDel = (uid) => idb('readwrite', (s) => s.delete(uid));

  // ---------------- state ----------------
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true } });
  let session = null, row = null, vaultKey = null, vaultData = null, pushTimer = null, pulling = false;
  const PROFILE_KEYS = ['kw', 'state', 'showNotice', 'showDocs', 'showAuto', 'showOther'];
  const profileOf = (st) => Object.fromEntries(PROFILE_KEYS.map((k) => [k, st[k]]));

  // Header button: "Sign in" opens the account panel; once signed in it shows the account.
  $('#headerAuth').classList.remove('hidden');
  $('#headerAuth').addEventListener('click', () => {
    $('#accountPanel').open = true;
    $('#accountPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!session) setTimeout(() => $('#authEmail').focus(), 300);
  });

  function renderAccount() {
    $('#headerAuth').textContent = session ? 'Account' : 'Sign in';
    if (!session) $('#accountPanel').open = true;
    show('#authOut', !session); show('#authIn', !!session);
    show('#relock', !!session && !vaultKey); show('#vaultOpen', !!session && !!vaultKey);
    $('#authWho').textContent = session ? 'Signed in as ' + session.user.email : '';
    $('#accountSummary').textContent = session ? '· ' + session.user.email : '· sign in to sync and save claim info';
    $('#profileNote').textContent = session ? 'Synced to your account.' : 'Saved in this browser. Sign in under Account to sync it across your devices.';
    if (vaultKey) FIELDS.forEach(([k]) => { $('#v_' + k).value = (vaultData || {})[k] || ''; });
  }

  // Derive the vault key from the password the user just typed and cache it on this device.
  async function unlockWith(password) {
    const salt = row && row.vault_salt ? unb64(row.vault_salt) : crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(password, salt);
    if (row && row.vault) {
      try { vaultData = await unseal(row.vault, key); } catch (e) { return false; }
    } else {
      vaultData = {};
      row = Object.assign(row || {}, { vault_salt: b64(salt) });
    }
    vaultKey = key;
    await keyPut(session.user.id, key);
    return true;
  }

  // ---------------- sign in / up / out ----------------
  async function auth(kind) {
    const email = $('#authEmail').value.trim(), password = $('#authPass').value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return msg('Enter your email.');
    if (password.length < 8) return msg('Password must be at least 8 characters.');
    $('#authLogin').disabled = $('#authSignup').disabled = true; msg(kind === 'up' ? 'Creating account…' : 'Signing in…');
    const res = kind === 'up' ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
    $('#authLogin').disabled = $('#authSignup').disabled = false;
    if (res.error) return msg(res.error.message);
    if (!res.data.session) return msg('Account created. Supabase is set to confirm emails: check your inbox, or turn off "Confirm email" in Supabase and sign in.');
    session = res.data.session;
    await pull();
    await unlockWith(password);
    $('#authPass').value = ''; msg('');
    renderAccount(); await push();
  }
  $('#authLogin').addEventListener('click', () => auth('in'));
  $('#authSignup').addEventListener('click', () => auth('up'));
  $('#authPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') auth('in'); });
  $('#authOutBtn').addEventListener('click', async () => {
    if (session) await keyDel(session.user.id);
    await sb.auth.signOut();
  });
  $('#relockBtn').addEventListener('click', async () => {
    const ok = await unlockWith($('#relockPass').value);
    $('#relockPass').value = '';
    msg(ok ? '' : 'Wrong password.'); renderAccount();
  });

  sb.auth.onAuthStateChange((event, s) => {
    session = s;
    if (!s) { row = null; vaultKey = null; vaultData = null; renderAccount(); return; }
    if (event === 'INITIAL_SESSION') {
      // Returning visit: restore sync and this device's cached vault key.
      setTimeout(async () => {
        await pull();
        const k = await keyGet(s.user.id);
        if (k && row && row.vault) { try { vaultData = await unseal(row.vault, k); vaultKey = k; } catch (e) { /* stale key */ } }
        else if (k && !(row && row.vault)) { vaultKey = k; vaultData = {}; }
        renderAccount();
      }, 0);
    }
    renderAccount();
  });

  // ---------------- sync ----------------
  function mergeStatuses(a, b) {
    const out = { ...a };
    Object.entries(b || {}).forEach(([id, s]) => { if (!out[id] || (s.ts || 0) > (out[id].ts || 0)) out[id] = s; });
    return out;
  }
  async function pull() {
    if (!session) return;
    pulling = true; $('#syncState').textContent = 'Syncing…';
    const res = await sb.from('user_data').select('*').maybeSingle();
    pulling = false;
    if (res.error) { $('#syncState').textContent = 'Sync error: ' + res.error.message; return; }
    row = res.data;
    const local = T.store, next = { ...local };
    if (row) {
      const rp = row.profile || {};
      if (rp.kw || !local.kw) PROFILE_KEYS.forEach((k) => { if (k in rp) next[k] = rp[k]; });
      next.status = mergeStatuses(local.status || {}, row.statuses || {});
    }
    T.apply(next);
    $('#syncState').textContent = 'Synced ' + new Date().toLocaleTimeString();
  }
  function queuePush() {
    if (!session || pulling) return;
    clearTimeout(pushTimer); pushTimer = setTimeout(push, 800);
    $('#syncState').textContent = 'Saving…';
  }
  async function push() {
    if (!session) return;
    const out = {
      user_id: session.user.id, profile: profileOf(T.store), statuses: T.store.status || {},
      vault: row ? row.vault || null : null, vault_salt: row ? row.vault_salt || null : null, updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from('user_data').upsert(out, { onConflict: 'user_id' });
    $('#syncState').textContent = error ? 'Sync error: ' + error.message : 'Synced ' + new Date().toLocaleTimeString();
  }
  window.addEventListener('tracker:saved', queuePush);

  $('#vaultSave').addEventListener('click', async () => {
    if (!vaultKey) return;
    FIELDS.forEach(([k]) => { vaultData[k] = $('#v_' + k).value.trim(); });
    row = Object.assign(row || {}, { vault: await seal(vaultData, vaultKey) });
    await push();
    $('#vaultMsg').textContent = 'Saved ' + new Date().toLocaleTimeString();
  });

  renderAccount();
})();
