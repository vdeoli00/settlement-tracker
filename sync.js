// Sign-in, cross-device sync, and the encrypted claim-info vault.
// Works signed out too: everything falls back to this browser's localStorage.
(() => {
  const cfg = window.TRACKER_CONFIG || {};
  const T = window.tracker;
  const $ = (s) => document.querySelector(s);
  const VAULT_KEY = 'settle.vault.v1';
  const FIELDS = [
    ['first_name', 'First name', 'given-name'], ['last_name', 'Last name', 'family-name'],
    ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'],
    ['address1', 'Street address', 'address-line1'], ['address2', 'Apt / unit', 'address-line2'],
    ['city', 'City', 'address-level2'], ['state', 'State (2 letters)', 'address-level1'],
    ['zip', 'ZIP', 'postal-code'], ['paypal', 'PayPal email', 'off'],
    ['venmo', 'Venmo phone or @handle', 'off'], ['zelle', 'Zelle email or phone', 'off'],
  ];
  if (!T) return;

  const panel = $('#accountPanel');
  panel.classList.remove('hidden');
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  const msg = (t) => { $('#authMsg').textContent = t || ''; };

  // ---------------- vault (AES-GCM, key from passphrase via PBKDF2) ----------------
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  let vaultKey = null, vaultData = null;

  function readVault() {
    try { return JSON.parse(localStorage.getItem(VAULT_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeVault(v) {
    try { v ? localStorage.setItem(VAULT_KEY, JSON.stringify(v)) : localStorage.removeItem(VAULT_KEY); } catch (e) { /* ignore */ }
  }
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
  async function open(blob, key) {
    const raw = unb64(blob);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12));
    return JSON.parse(dec.decode(pt));
  }

  $('#vaultFields').innerHTML = FIELDS.map(([k, label, ac]) =>
    `<div><label for="v_${k}">${label}</label><input type="text" id="v_${k}" autocomplete="${ac}"></div>`).join('');

  function renderVault() {
    const v = readVault();
    show('#vaultNew', !v); show('#vaultLocked', !!v && !vaultKey); show('#vaultOpen', !!v && !!vaultKey);
    if (vaultKey && vaultData) FIELDS.forEach(([k]) => { $('#v_' + k).value = vaultData[k] || ''; });
    $('#accountSummary').textContent = (session ? '· signed in' : '· not signed in') + (v ? (vaultKey ? ' · vault unlocked' : ' · vault locked') : '');
  }

  $('#vaultCreate').addEventListener('click', async () => {
    const a = $('#vpNew1').value, b = $('#vpNew2').value;
    if (a.length < 10) return alertMsg('Use at least 10 characters.');
    if (a !== b) return alertMsg('Passphrases do not match.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    vaultKey = await deriveKey(a, salt); vaultData = {};
    writeVault({ vault: await seal(vaultData, vaultKey), salt: b64(salt), ts: Date.now() });
    $('#vpNew1').value = $('#vpNew2').value = '';
    alertMsg('Vault created. Fill in your details and press Save.'); renderVault(); queuePush();
  });
  $('#vaultUnlock').addEventListener('click', unlock);
  $('#vpUnlock').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });
  async function unlock() {
    const v = readVault(); if (!v) return;
    try {
      const key = await deriveKey($('#vpUnlock').value, unb64(v.salt));
      vaultData = await open(v.vault, key); vaultKey = key;
      $('#vpUnlock').value = ''; alertMsg(''); renderVault();
    } catch (e) { alertMsg('Wrong passphrase.'); }
  }
  $('#vaultSave').addEventListener('click', async () => {
    FIELDS.forEach(([k]) => { vaultData[k] = $('#v_' + k).value.trim(); });
    const v = readVault();
    writeVault({ vault: await seal(vaultData, vaultKey), salt: v.salt, ts: Date.now() });
    $('#vaultMsg').textContent = 'Saved ' + new Date().toLocaleTimeString();
    queuePush();
  });
  $('#vaultLock').addEventListener('click', () => { vaultKey = null; vaultData = null; FIELDS.forEach(([k]) => { $('#v_' + k).value = ''; }); renderVault(); });
  function alertMsg(t) { $('#vaultNote').textContent = t; }

  // ---------------- auth + sync ----------------
  let sb = null, session = null, pushTimer = null, pulling = false;
  if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseKey) {
    show('#authOut', false); msg('Sync unavailable (not configured).'); renderVault(); return;
  }
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, detectSessionInUrl: true } });

  $('#authSend').addEventListener('click', async () => {
    const email = $('#authEmail').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return msg('Enter a valid email.');
    $('#authSend').disabled = true; msg('Sending…');
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    $('#authSend').disabled = false;
    msg(error ? 'Could not send: ' + error.message : 'Check your email and tap the link (open it in this same browser).');
  });
  $('#authOutBtn').addEventListener('click', async () => { await sb.auth.signOut(); });

  sb.auth.onAuthStateChange((event, s) => {
    session = s;
    show('#authOut', !s); show('#authIn', !!s);
    $('#authWho').textContent = s ? 'Signed in as ' + s.user.email : '';
    $('#profileNote').textContent = s ? 'Synced to your account.' : 'Saved in this browser. Sign in below to sync it across your devices.';
    renderVault();
    if (s && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) { msg(''); setTimeout(pull, 0); }
    if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname);
  });

  const PROFILE_KEYS = ['kw', 'state', 'showNotice', 'showDocs', 'showAuto', 'showOther'];
  const profileOf = (st) => Object.fromEntries(PROFILE_KEYS.map((k) => [k, st[k]]));

  function mergeStatuses(a, b) {
    const out = { ...a };
    Object.entries(b || {}).forEach(([id, s]) => {
      if (!out[id] || (s.ts || 0) > (out[id].ts || 0)) out[id] = s;
    });
    return out;
  }

  async function pull() {
    if (!session) return;
    pulling = true; $('#syncState').textContent = 'Syncing…';
    const { data: row, error } = await sb.from('user_data').select('*').maybeSingle();
    if (error) { pulling = false; $('#syncState').textContent = 'Sync error: ' + error.message; return; }
    const local = T.store;
    const next = { ...local };
    if (row) {
      const rp = row.profile || {};
      // Prefer the account's profile unless this browser has one and the account doesn't.
      if (rp.kw || !local.kw) PROFILE_KEYS.forEach((k) => { if (k in rp) next[k] = rp[k]; });
      next.status = mergeStatuses(local.status || {}, row.statuses || {});
      const lv = readVault();
      if (row.vault && (!lv || (row.vault !== lv.vault && !(lv.ts > Date.parse(row.updated_at))))) {
        writeVault({ vault: row.vault, salt: row.vault_salt, ts: Date.parse(row.updated_at) });
        vaultKey = null; vaultData = null;
      }
    }
    T.apply(next);
    pulling = false;
    renderVault();
    await push();
  }

  function queuePush() {
    if (!session || pulling) return;
    clearTimeout(pushTimer); pushTimer = setTimeout(push, 800);
    $('#syncState').textContent = 'Saving…';
  }
  async function push() {
    if (!session) return;
    const v = readVault();
    const row = {
      user_id: session.user.id, profile: profileOf(T.store), statuses: T.store.status || {},
      vault: v ? v.vault : null, vault_salt: v ? v.salt : null, updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from('user_data').upsert(row, { onConflict: 'user_id' });
    $('#syncState').textContent = error ? 'Sync error: ' + error.message : 'Synced ' + new Date().toLocaleTimeString();
  }
  window.addEventListener('tracker:saved', queuePush);
  renderVault();
})();
