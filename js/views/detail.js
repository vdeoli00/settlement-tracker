// Settlement detail sheet: facts, filing check, payment tracking, quick-copy claim info.
import { icon, esc, money, fmtDate, relDays, safeUrl, openSheet, openModal, toast, copyText, confetti, haptic, downloadIcs, $ } from '../ui.js';
import { store, today } from '../store.js';
import { PROOF, matchesFor } from '../data.js';
import { avatar, proofBadge, statusBadge } from '../components.js';
import { account, VAULT_FIELDS } from '../account.js';

const PENDING_KEY = 'settle.pendingFile';

export function openDetail(item, { onClose } = {}) {
  let sheet = null;
  const unsub = [store.on(() => sheet && renderBody()), account.on(() => sheet && renderBody())];

  sheet = openSheet(`<div class="grabber"></div>
    <div class="sheet-head">${avatar(item)}
      <div style="flex:1;min-width:0"><h2 style="font-size:19px">${esc(item.company)}</h2><p class="subtle" style="font-size:13px;margin-top:2px">${esc(item.title)}</p></div>
      <button class="btn ghost icon-only sm" data-act="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="sheet-body" tabindex="-1"></div>
    <div class="sheet-actions"></div>`, {
    label: item.company,
    onClose() { unsub.forEach((u) => u()); onClose?.(); },
  });
  const root = sheet.el;
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  renderBody();

  function renderBody() {
    const claim = store.claim(item.id);
    const s = claim?.s || '';
    const kws = store.prefs.kw;
    const m = matchesFor(item, kws);
    const p = PROOF[item.proof] || PROOF.unknown;
    const claimUrl = safeUrl(item.claim_url), pageUrl = safeUrl(item.url);
    const vault = account.vault.get();
    const days = item.days;

    const badges = [proofBadge(item)];
    if (item.isNew) badges.push('<span class="badge new">New</span>');
    if (m.length) badges.push(`<span class="badge blue">${icon('sparkles')}Matches ${esc(m.join(', '))}</span>`);
    if (item.region) badges.push(`<span class="badge">${icon('pin')}${esc(item.region)}</span>`);
    if (claim) badges.push(statusBadge(claim));

    const filed = s === 'filed' || s === 'paid', paid = s === 'paid';
    const bodyScroll = $('.sheet-body', root).scrollTop;
    $('.sheet-body', root).innerHTML = `
      <div class="badges" style="margin-bottom:16px">${badges.join('')}</div>

      <div class="kpis" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
        <div class="surface kpi"><span class="k-label">${icon('clock')}Deadline</span>
          <span class="k-value" style="font-size:20px;${days != null && days <= 7 ? 'color:var(--danger)' : ''}">${days != null ? esc(relDays(days)) : 'Open'}</span>
          <span class="k-sub">${esc(item.deadline ? fmtDate(item.deadline, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : item.deadline_text || 'No fixed deadline')}</span></div>
        <div class="surface kpi"><span class="k-label">${icon('dollar')}Payout</span>
          <span class="k-value" style="font-size:20px">${item.no_proof_amount ? money(item.no_proof_amount) : item.payout_max ? money(item.payout_max) : '—'}</span>
          <span class="k-sub">${esc(item.no_proof_amount ? 'without proof' : item.payout_max ? 'maximum stated' : 'varies by claim')}</span></div>
      </div>

      ${item.payout_text ? `<p class="muted" style="font-size:14px;margin-bottom:12px"><b style="color:var(--text)">Payout:</b> ${esc(item.payout_text)}</p>` : ''}
      <div class="callout ${item.easy ? 'green' : item.proof === 'docs' ? 'warn' : ''}" style="margin-bottom:12px">${icon(p.icon)}
        <div><b>${esc(item.no_proof_option && item.proof !== 'none' ? 'No-proof option available' : p.label)}</b>${item.proof_text ? `<div style="margin-top:2px">${esc(item.proof_text)}</div>` : ''}</div></div>
      ${item.summary ? `<p class="muted" style="font-size:14px;line-height:1.6">${esc(item.summary)}${item.summary.length >= 400 ? '…' : ''}</p>` : ''}

      <div class="group-label">Your claim</div>
      <div class="list">
        <div class="row">
          <button class="check" role="checkbox" aria-checked="${filed}" data-act="toggle-filed" aria-label="I've filed this claim">
            <svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg></button>
          <div class="r-main"><div class="r-title" style="white-space:normal">I've filed this claim</div>
            <div class="r-sub">${filed ? 'Filed ' + esc(fmtDate(claim.filedAt)) : 'Tap after you submit the official form'}</div></div>
        </div>
        ${filed ? `
        <div class="row" style="display:grid;gap:10px">
          <div class="field"><label for="d-conf">Confirmation / claim number</label>
            <input class="input mono" id="d-conf" data-field="confirmation" value="${esc(claim.confirmation || '')}" placeholder="e.g. ABC-123456" autocomplete="off"></div>
          <div class="field"><label for="d-exp">Expected payout</label>
            <input class="input" id="d-exp" data-field="expected" inputmode="decimal" value="${esc(claim.expected ?? (item.est || ''))}" placeholder="$0.00"></div>
        </div>
        <div class="row">
          <button class="check" role="checkbox" aria-checked="${paid}" data-act="toggle-paid" aria-label="Payment received">
            <svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg></button>
          <div class="r-main"><div class="r-title">Payment received</div>
            <div class="r-sub">${paid ? `${money(Number(claim.amount) || 0, true)} on ${esc(fmtDate(claim.paidAt))}${claim.method ? ' · ' + esc(claim.method) : ''}` : 'Payments usually arrive months after the deadline'}</div></div>
          ${paid ? `<button class="btn sm" data-act="edit-paid">Edit</button>` : ''}
        </div>` : ''}
        <div class="row" style="display:block">
          <div class="field"><label for="d-notes">Notes</label>
            <textarea class="input" id="d-notes" data-field="notes" rows="2" placeholder="Anything to remember (email used, product, etc.)">${esc(claim?.notes || '')}</textarea></div>
        </div>
      </div>

      <div class="group-label">Quick copy for the claim form</div>
      ${vault && Object.values(vault).some(Boolean) ? `<div class="copy-grid">${copyButtons(vault)}</div>
        <p class="group-note">Tap a field to copy it, then paste into the form.</p>`
        : `<div class="callout">${icon('lock')}<div>${account.state.session ? (account.state.vaultUnlocked ? 'Add your claim info in Settings to copy it here in one tap.' : 'Unlock your claim info in Settings.') : 'Sign in and add your claim info in Settings to copy it here in one tap.'}
          <div style="margin-top:8px"><a class="btn sm" href="#/settings" data-act="close-nav">${icon('settings', 'sm')}Open settings</a></div></div></div>`}

      <div class="group-label">More</div>
      <div class="list">
        ${item.deadline ? `<button class="row" data-act="ics"><span class="r-icon blue">${icon('calendar')}</span><span class="r-main"><span class="r-title">Add deadline to calendar</span><span class="r-sub">Alerts you 3 days before</span></span>${icon('chevronRight', 'sm')}</button>` : ''}
        <button class="row" data-act="${s === 'saved' ? 'unsave' : 'save'}"><span class="r-icon">${icon('bookmark')}</span><span class="r-main"><span class="r-title">${s === 'saved' ? 'Remove from saved' : 'Save for later'}</span></span>${icon('chevronRight', 'sm')}</button>
        <button class="row" data-act="${s === 'skip' ? 'unskip' : 'skip'}"><span class="r-icon red">${icon('ban')}</span><span class="r-main"><span class="r-title">${s === 'skip' ? 'Show this again' : "Not eligible / hide"}</span></span>${icon('chevronRight', 'sm')}</button>
        ${pageUrl ? `<a class="row" href="${esc(pageUrl)}" target="_blank" rel="noopener noreferrer"><span class="r-icon">${icon('info')}</span><span class="r-main"><span class="r-title">Full details</span><span class="r-sub">${esc(item.source || new URL(pageUrl).hostname)}</span></span>${icon('external', 'sm')}</a>` : ''}
        ${(item.also || []).map((a) => safeUrl(a.url) ? `<a class="row" href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer"><span class="r-icon">${icon('file')}</span><span class="r-main"><span class="r-title">Also on ${esc(a.source)}</span></span>${icon('external', 'sm')}</a>` : '').join('')}
      </div>
      <p class="group-note" style="margin-bottom:8px">Only file if you qualify. Claim forms are signed under penalty of perjury. Confirm details on the official settlement site.</p>`;
    $('.sheet-body', root).scrollTop = bodyScroll;

    const fileHref = claimUrl || pageUrl;
    $('.sheet-actions', root).innerHTML = filed
      ? `<button class="btn lg" data-act="${s === 'saved' ? 'unsave' : 'save'}" ${filed ? 'disabled' : ''}>${icon('check')}${paid ? 'Paid' : 'Filed'}</button>
         ${fileHref ? `<a class="btn lg primary" href="${esc(fileHref)}" target="_blank" rel="noopener noreferrer">${icon('external')}Claim site</a>` : '<span></span>'}`
      : `<button class="btn lg" data-act="${s === 'saved' ? 'unsave' : 'save'}">${icon('bookmark')}${s === 'saved' ? 'Saved' : 'Save'}</button>
         ${fileHref ? `<a class="btn lg primary" href="${esc(fileHref)}" target="_blank" rel="noopener noreferrer" data-act="file">${icon('external')}${claimUrl ? 'File claim' : 'Details & file'}</a>` : '<span></span>'}`;
  }

  function copyButtons(v) {
    const addr = [v.address1, v.address2].filter(Boolean).join(', ');
    const cityLine = [v.city, [v.state, v.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const fields = [
      ['Full name', [v.first_name, v.last_name].filter(Boolean).join(' ')], ['First name', v.first_name], ['Last name', v.last_name],
      ['Email', v.email], ['Phone', v.phone], ['Street', addr], ['City', v.city], ['State', v.state], ['ZIP', v.zip],
      ['City, State ZIP', cityLine], ['PayPal', v.paypal], ['Venmo', v.venmo], ['Zelle', v.zelle],
    ].filter(([, val]) => val);
    return fields.map(([label, val]) => `<button class="copy-btn" data-copy="${esc(val)}"><span>${esc(label)}</span><b>${esc(val)}</b></button>`).join('');
  }

  async function onClick(e) {
    const t = e.target.closest('[data-act], [data-copy]'); if (!t) return;
    if (t.dataset.copy != null) {
      if (await copyText(t.dataset.copy)) { haptic(); t.classList.add('copied'); setTimeout(() => t.classList.remove('copied'), 900); toast('Copied ' + t.querySelector('span').textContent.toLowerCase()); }
      return;
    }
    const act = t.dataset.act;
    if (act === 'close') return sheet.close();
    if (act === 'close-nav') { sheet.close(); return; }
    if (act === 'save') { store.setClaim(item.id, { s: 'saved' }, item); haptic(); toast('Saved for later', { icon: 'bookmark', action: 'Undo', onAction: () => store.clearClaim(item.id) }); }
    if (act === 'unsave') store.clearClaim(item.id);
    if (act === 'skip') { store.setClaim(item.id, { s: 'skip' }, item); toast('Hidden from your lists', { icon: 'ban', action: 'Undo', onAction: () => store.clearClaim(item.id) }); sheet.close(); }
    if (act === 'unskip') store.clearClaim(item.id);
    if (act === 'ics') { downloadIcs(item); toast('Calendar reminder downloaded', { icon: 'calendar' }); }
    if (act === 'file') {
      // Remember that a filing started so we can ask "did you finish?" when the user comes back.
      try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ id: item.id, at: Date.now() })); } catch { /* ignore */ }
    }
    if (act === 'toggle-filed') {
      const c = store.claim(item.id);
      if (c && (c.s === 'filed' || c.s === 'paid')) {
        store.setClaim(item.id, { s: 'saved', filedAt: null, paidAt: null, amount: null });
        toast('Marked as not filed', { icon: 'x' });
      } else markFiled(item, t);
    }
    if (act === 'toggle-paid') {
      const c = store.claim(item.id);
      if (c?.s === 'paid') { store.setClaim(item.id, { s: 'filed', paidAt: null }); toast('Marked as not paid', { icon: 'x' }); }
      else askPaid(item, t);
    }
    if (act === 'edit-paid') askPaid(item, t);
  }

  function onChange(e) {
    const f = e.target.dataset.field; if (!f) return;
    let v = e.target.value.trim();
    if (f === 'expected') v = v === '' ? null : parseFloat(v.replace(/[$,]/g, '')) || null;
    const c = store.claim(item.id);
    store.setClaim(item.id, { s: c?.s || 'saved', [f]: v }, item);
    toast('Saved', { duration: 1400 });
  }
  return sheet;
}

export function markFiled(item, fromEl) {
  store.setClaim(item.id, { s: 'filed', filedAt: today(), expected: store.claims[item.id]?.expected ?? (item.est || null) }, item);
  haptic(14);
  const r = fromEl?.getBoundingClientRect?.();
  confetti(r ? r.left + r.width / 2 : undefined, r ? r.top : undefined);
  toast(`Filed ${item.company}`, { icon: 'check', action: 'Undo', onAction: () => store.setClaim(item.id, { s: 'saved', filedAt: null }) });
}

export function askPaid(item, fromEl) {
  const c = store.claims[item.id] || {};
  const m = openModal(`
    <div class="m-icon">${icon('dollar', 'lg')}</div>
    <h2>Payment received</h2>
    <p class="muted">${esc(item.company)}</p>
    <form class="stack" style="margin-top:16px" novalidate>
      <div class="field"><label for="p-amt">Amount</label><input class="input" id="p-amt" inputmode="decimal" placeholder="$0.00" value="${esc(c.amount ?? c.expected ?? '')}" autofocus></div>
      <div class="field"><label for="p-date">Date received</label><input class="input" id="p-date" type="date" value="${esc(c.paidAt || today())}"></div>
      <div class="field"><label for="p-method">How you were paid</label>
        <select class="input" id="p-method">${['', 'PayPal', 'Venmo', 'Zelle', 'Check', 'Direct deposit', 'Prepaid card', 'Other'].map((x) => `<option ${c.method === x ? 'selected' : ''} value="${x}">${x || 'Choose…'}</option>`).join('')}</select></div>
      <div class="m-actions"><button class="btn lg primary" type="submit">${icon('check')}Save payment</button><button class="btn lg ghost" type="button" data-cancel>Cancel</button></div>
    </form>`, { label: 'Payment received' });
  m.el.querySelector('[data-cancel]').addEventListener('click', () => m.close());
  m.el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(m.el.querySelector('#p-amt').value.replace(/[$,]/g, ''));
    store.setClaim(item.id, { s: 'paid', amount: isNaN(amount) ? null : amount, paidAt: m.el.querySelector('#p-date').value || today(), method: m.el.querySelector('#p-method').value }, item);
    m.close();
    haptic(20);
    const r = fromEl?.getBoundingClientRect?.();
    confetti(r ? r.left + r.width / 2 : undefined, r ? r.top : undefined);
    toast(isNaN(amount) ? 'Marked as paid' : `${money(amount, true)} received`, { icon: 'dollar' });
  });
}

// When the user returns from a claim site, ask whether they finished filing.
export function checkPendingFiling(lookup) {
  let p = null;
  try { p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch { /* ignore */ }
  if (!p || Date.now() - p.at < 6000 || Date.now() - p.at > 3 * 3600000) return;
  sessionStorage.removeItem(PENDING_KEY);
  const item = lookup(p.id);
  const c = item && store.claim(item.id);
  if (!item || (c && (c.s === 'filed' || c.s === 'paid'))) return;
  const m = openModal(`
    <div class="m-icon">${icon('claims', 'lg')}</div>
    <h2>Did you finish filing?</h2>
    <p class="muted">${esc(item.company)}</p>
    <div class="field" style="margin-top:16px"><label for="pf-conf">Confirmation number (optional)</label>
      <input class="input mono" id="pf-conf" placeholder="Paste it here so you can check status later" autocomplete="off"></div>
    <div class="m-actions">
      <button class="btn lg primary" data-yes>${icon('check')}Yes, mark as filed</button>
      <button class="btn lg ghost" data-no>Not yet</button>
    </div>`, { label: 'Did you finish filing?' });
  m.el.querySelector('[data-yes]').addEventListener('click', (e) => {
    const conf = m.el.querySelector('#pf-conf').value.trim();
    markFiled(item, e.currentTarget);
    if (conf) store.setClaim(item.id, { confirmation: conf });
    m.close();
  });
  m.el.querySelector('[data-no]').addEventListener('click', () => { store.setClaim(item.id, { s: store.claim(item.id)?.s || 'saved' }, item); m.close(); toast('Saved for later', { icon: 'bookmark' }); });
}
