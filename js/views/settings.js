// Settings: account, appearance, profile, filters, claim info vault, data, about.
import { icon, esc, toast, $, $$, ago, downloadFile, openModal, copyText } from '../ui.js';
import { store, parseKeywords, mergeClaims } from '../store.js';
import { STATES } from '../data.js';
import { account, VAULT_FIELDS } from '../account.js';
import { applyTheme } from '../theme-apply.js';

const SUGGESTIONS = ['Apple', 'Google', 'Amazon', 'Facebook', 'Verizon', 'AT&T', 'T-Mobile', 'Walmart', 'Target', 'Netflix', 'Spotify', 'Uber', 'PayPal', 'Chase', 'Comcast', 'Ticketmaster'];
const BUILD = document.querySelector('meta[name="build"]')?.content || 'dev';
// Kept outside render() so account-state re-renders during sign-in don't lose them.
const auth = { busy: false, error: '', email: '', mode: 'in' };
let family = null; // cached invite list for admins

export function render(root, { data }) {
  const p = store.prefs, a = account.state;
  const v = account.vault.get();
  const email = a.session?.user?.email || '';

  root.innerHTML = `
    <div class="page-head view-enter"><div><div class="eyebrow">Preferences &amp; account</div><h1>Settings</h1></div></div>
    <div style="max-width:720px">

    <div class="group-label">Account</div>
    ${a.session ? `
      <div class="list">
        <div class="row"><span class="avatar-lg">${esc(email[0]?.toUpperCase() || '?')}</span>
          <span class="r-main"><span class="r-title">${esc(email)}</span><span class="r-sub">${syncText(a)}</span></span>
          <button class="btn sm" data-act="sync" aria-label="Sync now">${icon('refresh', 'sm')}</button></div>
        <button class="row" data-act="password"><span class="r-icon">${icon('key')}</span><span class="r-main"><span class="r-title">Change password</span><span class="r-sub">Your claim info is re-encrypted, nothing is lost</span></span>${icon('chevronRight', 'sm')}</button>
        <button class="row" data-act="signout"><span class="r-icon red">${icon('logout')}</span><span class="r-main"><span class="r-title" style="color:var(--danger)">Sign out</span><span class="r-sub">Clears your data from this device. It stays safe in your account.</span></span></button>
      </div>`
    : `
      <form class="surface auth-card" id="signin" style="margin:0;max-width:none" novalidate>
        <div class="row-gap" style="margin-bottom:16px"><span style="width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent-text)">${icon('shield')}</span>
          <div><h3>${auth.mode === 'up' ? 'Create your account' : 'Sign in to sync'}</h3><p class="muted" style="font-size:13.5px">${auth.mode === 'up' ? 'Use the email the owner invited.' : 'Keep claims and claim info in sync across devices.'}</p></div></div>
        <div class="segmented" style="width:100%;margin-bottom:14px" id="auth-seg">
          <button type="button" aria-pressed="${auth.mode === 'in'}" data-mode="in">Sign in</button>
          <button type="button" aria-pressed="${auth.mode === 'up'}" data-mode="up">Create account</button><span class="thumb"></span></div>
        <div class="stack">
          <div class="field"><label for="si-email">Email</label><input class="input" id="si-email" type="email" autocomplete="username" inputmode="email" required value="${esc(auth.email)}"></div>
          <div class="field"><label for="si-pass">Password</label><input class="input" id="si-pass" type="password" autocomplete="${auth.mode === 'up' ? 'new-password' : 'current-password'}" required minlength="8"></div>
          ${auth.mode === 'up' ? '<div class="field"><label for="si-pass2">Confirm password</label><input class="input" id="si-pass2" type="password" autocomplete="new-password" required minlength="8"></div>' : ''}
          <p class="error-text ${auth.error ? '' : 'hidden'}" id="si-err" role="alert">${esc(auth.error)}</p>
          <button class="btn lg primary block" type="submit" id="si-btn" ${auth.busy ? 'disabled' : ''}>${auth.busy ? `<span class="spinner"></span>${auth.mode === 'up' ? 'Creating account…' : 'Signing in…'}` : auth.mode === 'up' ? 'Create account' : 'Sign in'}</button>
          ${auth.mode === 'in' ? '<button type="button" class="btn ghost sm" data-act="forgot" style="justify-self:center">Forgot password?</button>' : ''}
          <p class="hint">${auth.mode === 'up' ? 'Accounts are invite-only. Each person’s claims and info are private to them.' : 'Your password also encrypts your claim info.'}</p>
        </div>
      </form>`}

    ${a.session && a.isAdmin ? `
    <div class="group-label">Family &amp; invites</div>
    <div class="list" id="family">
      <div class="row" style="display:grid;gap:10px">
        <span class="r-sub" style="white-space:normal">Add someone's email, then send them the link. They tap <b>Create account</b> using that email. Everyone's data is private to them.</span>
        <form class="toolbar-row" id="fam-form" novalidate><input class="input" id="fam-email" type="email" inputmode="email" placeholder="family@example.com" autocomplete="off"><button class="btn primary" type="submit">${icon('plus', 'sm')}Invite</button></form>
      </div>
      <div id="fam-list">${familyRows()}</div>
      <button class="row" data-act="share"><span class="r-icon blue">${icon('copy')}</span><span class="r-main"><span class="r-title">Copy invite message</span><span class="r-sub">Includes the link and instructions</span></span></button>
    </div>` : ''}

    <div class="group-label">Appearance</div>
    <div class="list"><div class="row"><span class="r-icon">${icon('palette')}</span><span class="r-main"><span class="r-title">Theme</span></span>
      <div class="segmented" id="theme-seg" role="radiogroup" aria-label="Theme">${[['system', 'monitor', 'Auto'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']].map(([k, ic, l]) =>
        `<button role="radio" aria-checked="${p.theme === k}" aria-pressed="${p.theme === k}" data-theme-set="${k}">${icon(ic, 'sm')}<span class="hide-mobile">${l}</span></button>`).join('')}<span class="thumb"></span></div></div></div>

    <div class="group-label">Your profile</div>
    <div class="list">
      <div class="row" style="display:block">
        <div class="field"><label for="kw-add">Brands, banks, apps, stores and employers you've used</label>
          <div class="chips" style="flex-wrap:wrap;margin:6px 0 10px" id="kw-list">${p.kw.length ? p.kw.map((k) => `<span class="chip removable">${esc(k)}<button aria-label="Remove ${esc(k)}" data-rm="${esc(k)}">${icon('x', 'sm')}</button></span>`).join('') : '<span class="subtle" style="font-size:13px">None yet</span>'}</div>
          <div class="toolbar-row"><input class="input" id="kw-add" placeholder="Type and press Enter (e.g. Netflix, Chase)" autocomplete="off" enterkeyhint="done"><button class="btn" data-act="kw-add">${icon('plus', 'sm')}Add</button></div>
          <div class="suggest" style="margin-top:10px">${SUGGESTIONS.filter((s) => !p.kw.includes(s)).map((s) => `<button class="chip" data-kw="${esc(s)}">${icon('plus', 'sm')}${esc(s)}</button>`).join('')}</div>
        </div>
      </div>
      <div class="row"><span class="r-icon">${icon('pin')}</span><span class="r-main"><label class="r-title" for="st">State</label><span class="r-sub">Hides state-only settlements elsewhere</span></span>
        <select class="input" id="st" style="width:auto;max-width:180px"><option value="">Not set</option>${Object.entries(STATES).map(([k, n]) => `<option value="${k}" ${p.state === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    </div>

    <div class="group-label">What to show</div>
    <div class="list">
      ${toggle('showNotice', 'Include claims that need a notice ID', 'Off by default. Turn on only if you got a settlement email or letter with a Claim ID', 'mail', p)}
      ${toggle('showDocs', 'Documentation-required claims', 'Show claims that need receipts or records', 'file', p)}
      ${toggle('showAuto', 'Automatic payments', 'Show settlements that pay without a claim form', 'sparkles', p)}
      ${toggle('showOther', 'Other states & Canada', 'Show settlements limited to other regions', 'pin', p)}
    </div>

    <div class="group-label">Claim info</div>
    ${!a.session ? `<div class="list"><div class="row"><span class="r-icon">${icon('lock')}</span><span class="r-main"><span class="r-title">Sign in to save claim info</span><span class="r-sub">Name, address and payment handles for one-tap copy while filing</span></span></div></div>`
      : !a.vaultUnlocked ? `<form class="list" id="unlock" novalidate><div class="row" style="display:grid;gap:10px">
          <span class="r-title">Enter your password to unlock claim info on this device</span>
          <div class="toolbar-row"><input class="input" id="un-pass" type="password" autocomplete="current-password"><button class="btn primary" type="submit">Unlock</button></div>
          <p class="error-text hidden" id="un-err"></p></div></form>`
      : `<form class="surface" id="vault" style="padding:16px" novalidate>
          <div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">${VAULT_FIELDS.map(([k, label, ac]) =>
            `<div class="field"><label for="v-${k}">${label}</label><input class="input" id="v-${k}" name="${k}" autocomplete="${ac}" value="${esc(v?.[k] || '')}"></div>`).join('')}</div>
          <div class="row-gap" style="margin-top:14px"><span class="hint" style="flex:1">${icon('shield', 'sm')} Encrypted with your password before it leaves this device.</span><button class="btn primary" type="submit">Save</button></div>
        </form>`}

    <div class="group-label">Data</div>
    <div class="list">
      <button class="row" data-act="backup"><span class="r-icon blue">${icon('download')}</span><span class="r-main"><span class="r-title">Download backup</span><span class="r-sub">Profile and claims as JSON (claim info excluded)</span></span>${icon('chevronRight', 'sm')}</button>
      <label class="row" style="cursor:pointer"><span class="r-icon blue">${icon('upload')}</span><span class="r-main"><span class="r-title">Restore from backup</span><span class="r-sub">Merges with what's here</span></span>${icon('chevronRight', 'sm')}<input type="file" accept="application/json,.json" id="restore" class="sr-only"></label>
      <button class="row" data-act="refresh"><span class="r-icon">${icon('refresh')}</span><span class="r-main"><span class="r-title">Refresh settlements</span><span class="r-sub">Updated ${esc(ago(data.updated))} · ${data.items.length} open</span></span>${icon('chevronRight', 'sm')}</button>
      <button class="row" data-act="reset"><span class="r-icon red">${icon('trash')}</span><span class="r-main"><span class="r-title" style="color:var(--danger)">Clear data on this device</span><span class="r-sub">Your synced account is not affected</span></span></button>
    </div>

    <div class="group-label">About</div>
    <div class="list">
      ${Object.entries(data.sources || {}).map(([name, s]) => `<div class="row"><span class="r-icon ${s.ok ? 'green' : 'red'}">${icon(s.ok ? 'check' : 'alert')}</span><span class="r-main"><span class="r-title">${esc(name)}</span><span class="r-sub">${s.ok ? `${s.count} settlements on last refresh` : 'Failed on last refresh: using previous data'}</span></span></div>`).join('')}
      <div class="row"><span class="r-icon">${icon('info')}</span><span class="r-main"><span class="r-title">Version</span><span class="r-sub mono">${esc(BUILD)}</span></span></div>
    </div>
    <p class="group-note">Settled is a personal tracker, not legal advice. Settlement data comes from public sources and is refreshed every 6 hours; always confirm eligibility and deadlines on the official settlement website. Only file claims you qualify for.</p>
    </div>`;

  placeThumb($('#theme-seg', root));
  placeThumb($('#auth-seg', root));
  if (a.session && a.isAdmin && family == null) loadFamily(root, data);
  wire(root, data);
}

function familyRows() {
  if (family == null) return '<div class="row"><span class="r-sub">Loading…</span></div>';
  if (!family.length) return '<div class="row"><span class="r-sub">No one invited yet.</span></div>';
  return family.map((f) => `<div class="row"><span class="avatar-lg" style="width:36px;height:36px;font-size:14px">${esc(f.email[0].toUpperCase())}</span>
    <span class="r-main"><span class="r-title">${esc(f.email)}</span><span class="r-sub">Invited ${esc(ago(f.added_at))}</span></span>
    <button class="btn ghost sm" data-uninvite="${esc(f.email)}" aria-label="Remove invite for ${esc(f.email)}">${icon('x', 'sm')}</button></div>`).join('');
}
async function loadFamily(root, data) {
  try { family = await account.family.list(); } catch (e) { family = []; toast('Could not load invites: ' + e.message, { icon: 'alert' }); }
  const el = $('#fam-list', root); if (el) el.innerHTML = familyRows();
}

function toggle(key, title, sub, ic, p) {
  return `<label class="row" style="cursor:pointer"><span class="r-icon">${icon(ic)}</span><span class="r-main"><span class="r-title">${title}</span><span class="r-sub" style="white-space:normal">${sub}</span></span>
    <span class="switch"><input type="checkbox" data-pref="${key}" ${p[key] ? 'checked' : ''} aria-label="${esc(title)}"><span></span></span></label>`;
}

function syncText(a) {
  if (a.sync === 'syncing') return 'Syncing…';
  if (a.sync === 'error') return 'Sync error: ' + esc(a.error || 'unknown');
  return a.syncAt ? 'Synced ' + esc(ago(a.syncAt)) : 'Signed in';
}

function placeThumb(seg) {
  if (!seg) return;
  const on = seg.querySelector('[aria-pressed="true"]'), th = seg.querySelector('.thumb');
  if (!on) return;
  th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 3}px)`;
}

function wire(root, data) {
  const addKw = () => {
    const inp = $('#kw-add', root); const add = parseKeywords(inp.value);
    if (!add.length) return;
    store.setPref('kw', [...store.prefs.kw, ...add]); store.setPrefs({ onboarded: true });
    toast(`Added ${add.join(', ')}`);
    setTimeout(() => $('#kw-add')?.focus(), 0);
  };
  $('#kw-add', root).addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKw(); } });
  $('#st', root).addEventListener('change', (e) => store.setPref('state', e.target.value));
  $$('[data-pref]', root).forEach((el) => el.addEventListener('change', () => store.setPref(el.dataset.pref, el.checked)));

  root.onclick = async (e) => {
    const t = e.target.closest('[data-act], [data-rm], [data-kw], [data-theme-set], [data-mode], [data-uninvite]'); if (!t) return;
    if (t.dataset.mode) { auth.mode = t.dataset.mode; auth.error = ''; auth.email = $('#si-email', root)?.value || auth.email; render(root, { data }); return; }
    if (t.dataset.uninvite) {
      try { await account.family.remove(t.dataset.uninvite); family = family.filter((f) => f.email !== t.dataset.uninvite); $('#fam-list', root).innerHTML = familyRows(); toast('Invite removed', { icon: 'x' }); }
      catch (x) { toast(x.message, { icon: 'alert' }); }
      return;
    }
    if (t.dataset.rm) { store.setPref('kw', store.prefs.kw.filter((k) => k !== t.dataset.rm)); return; }
    if (t.dataset.kw) { store.setPref('kw', [...store.prefs.kw, t.dataset.kw]); store.setPrefs({ onboarded: true }); return; }
    if (t.dataset.themeSet) { store.setPref('theme', t.dataset.themeSet); applyTheme(t.dataset.themeSet, true); return; }
    const act = t.dataset.act;
    if (act === 'kw-add') addKw();
    if (act === 'sync') { await account.syncNow(); toast('Synced'); }
    if (act === 'signout') { await account.signOut(); family = null; toast('Signed out', { icon: 'logout' }); }
    if (act === 'password') changePassword();
    if (act === 'forgot') {
      const email = $('#si-email', root).value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { auth.error = 'Enter your email above first.'; render(root, { data }); return; }
      try { await account.sendReset(email); toast('Password reset email sent', { icon: 'mail', duration: 5000 }); }
      catch (x) { auth.error = x.message; render(root, { data }); }
    }
    if (act === 'share') {
      const url = location.origin + location.pathname;
      const msg = `I set you up on Settled, an app that finds class action settlements you can claim and tracks payouts.\n\n1. Open ${url}\n2. Go to Settings → Create account\n3. Use the email I invited and pick a password\n\nTip: in Safari tap Share → Add to Home Screen.`;
      if (navigator.share) { try { await navigator.share({ title: 'Settled', text: msg }); return; } catch { /* cancelled */ } }
      if (await copyText(msg)) toast('Invite message copied');
    }
    if (act === 'backup') {
      downloadFile(`settled-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'settled', version: 2, ...store.snapshot() }, null, 2), 'application/json');
      toast('Backup downloaded', { icon: 'download' });
    }
    if (act === 'refresh') window.dispatchEvent(new CustomEvent('app:refresh'));
    if (act === 'reset') confirmReset();
  };

  $('#restore', root).addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!j || typeof j !== 'object' || !('claims' in j)) throw new Error('Not a Settled backup');
      store.replace({ prefs: { ...store.prefs, ...(j.prefs || {}) }, claims: mergeClaims(store.claims, j.claims || {}) }, 'local');
      toast('Backup restored');
    } catch (err) { toast('Restore failed: ' + err.message, { icon: 'alert' }); }
  });

  const signin = $('#signin', root);
  if (signin) signin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#si-email', root).value.trim(), pass = $('#si-pass', root).value;
    auth.email = email;
    if (!/^\S+@\S+\.\S+$/.test(email) || pass.length < 8) { auth.error = 'Enter your email and a password of 8+ characters.'; render(root, { data }); return; }
    if (auth.mode === 'up' && pass !== $('#si-pass2', root).value) { auth.error = "Passwords don't match."; render(root, { data }); return; }
    auth.busy = true; auth.error = ''; render(root, { data });
    try {
      if (auth.mode === 'up') { await account.signUp(email, pass); toast('Welcome to Settled', { icon: 'sparkles' }); }
      else { await account.signIn(email, pass); toast('Signed in', { icon: 'shield' }); }
      auth.busy = false; auth.mode = 'in';
    }
    catch (x) { auth.busy = false; auth.error = x.message; }
    if (document.body.contains(root)) render(root, { data });
  });

  const fam = $('#fam-form', root);
  if (fam) fam.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $('#fam-email', root), email = inp.value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Enter a valid email', { icon: 'alert' }); return; }
    try { await account.family.add(email); family = [{ email, added_at: new Date().toISOString() }, ...(family || [])]; $('#fam-list', root).innerHTML = familyRows(); inp.value = ''; toast(`Invited ${email}`, { icon: 'mail', action: 'Copy message', onAction: () => root.querySelector('[data-act="share"]')?.click() }); }
    catch (x) { toast(x.message, { icon: 'alert' }); }
  });

  const unlock = $('#unlock', root);
  if (unlock) unlock.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await account.unlock($('#un-pass', root).value);
    if (!ok) { const er = $('#un-err', root); er.textContent = 'Wrong password.'; er.classList.remove('hidden'); }
  });

  const vault = $('#vault', root);
  if (vault) vault.addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = {}; VAULT_FIELDS.forEach(([k]) => { out[k] = vault.elements[k].value.trim(); });
    try { await account.vault.save(out); toast('Claim info saved', { icon: 'shield' }); } catch (x) { toast(x.message, { icon: 'alert' }); }
  });
}

export function passwordModal({ title, body, submit, onSubmit }) {
  const m = openModal(`<div class="m-icon">${icon('key', 'lg')}</div><h2>${esc(title)}</h2><p class="muted">${esc(body)}</p>
    <form class="stack" style="margin-top:16px" novalidate>
      <div class="field"><label for="np1">New password</label><input class="input" id="np1" type="password" autocomplete="new-password" minlength="8" autofocus></div>
      <div class="field"><label for="np2">Confirm new password</label><input class="input" id="np2" type="password" autocomplete="new-password" minlength="8"></div>
      <p class="error-text hidden" id="np-err"></p>
      <div class="m-actions"><button class="btn lg primary" type="submit">${esc(submit)}</button><button class="btn lg ghost" type="button" data-cancel>Cancel</button></div>
    </form>`, { label: title });
  const err = m.el.querySelector('#np-err');
  m.el.querySelector('[data-cancel]').addEventListener('click', () => m.close());
  m.el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = m.el.querySelector('#np1').value, b = m.el.querySelector('#np2').value;
    const fail = (t) => { err.textContent = t; err.classList.remove('hidden'); };
    if (a.length < 8) return fail('Use at least 8 characters.');
    if (a !== b) return fail("Passwords don't match.");
    const btn = m.el.querySelector('button[type="submit"]'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Saving…';
    try { await onSubmit(a); m.close(); } catch (x) { btn.disabled = false; btn.textContent = submit; fail(x.message); }
  });
  return m;
}

function changePassword() {
  passwordModal({ title: 'Change password', body: 'Your saved claim info is re-encrypted with the new password.', submit: 'Change password',
    async onSubmit(pw) { await account.changePassword(pw); toast('Password changed', { icon: 'key' }); } });
}

function confirmReset() {
  const m = openModal(`<div class="m-icon" style="background:var(--danger-soft);color:var(--danger)">${icon('trash', 'lg')}</div>
    <h2>Clear this device?</h2><p class="muted">Removes your profile and claim tracking from this browser. If you're signed in, your account copy stays and will sync back.</p>
    <div class="m-actions"><button class="btn lg danger" data-yes>Clear data</button><button class="btn lg ghost" data-no>Cancel</button></div>`, { label: 'Clear data' });
  m.el.querySelector('[data-no]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-yes]').addEventListener('click', () => { store.resetAll(); m.close(); toast('Cleared', { icon: 'trash' }); });
}

