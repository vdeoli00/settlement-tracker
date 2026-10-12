// Home: personal dashboard.
import { icon, esc, money, greeting, countUp, $, $$, fmtDate } from '../ui.js';
import { store, claimTotals } from '../store.js';
import { STATES, isEasyFor, eligibleForLists, matchesFor, sortItems } from '../data.js';
import { card, empty, avatar } from '../components.js';
import { account } from '../account.js';

const SUGGESTIONS = ['Apple', 'Google', 'Amazon', 'Facebook', 'Instagram', 'Verizon', 'AT&T', 'T-Mobile', 'Comcast', 'Walmart', 'Target', 'Costco',
  'Netflix', 'Spotify', 'Uber', 'Lyft', 'PayPal', 'Venmo', 'Chase', 'Bank of America', 'Wells Fargo', 'Capital One', 'Ticketmaster', 'TikTok', 'Microsoft', 'Samsung'];

export function render(root, { data }) {
  const prefs = store.prefs, kws = prefs.kw;
  const done = (id) => ['filed', 'paid', 'skip'].includes(store.claim(id)?.s);
  const items = data.items.filter((i) => !done(i.id));
  const easy = items.filter((i) => isEasyFor(i, prefs));
  const matches = items.filter((i) => (isEasyFor(i, prefs) || eligibleForLists(i, prefs)) && matchesFor(i, kws).length);
  const matchEasy = matches.filter((i) => i.easy);
  const ending = sortItems(easy.filter((i) => i.days != null && i.days <= 14), 'deadline').slice(0, 8);
  const week = easy.filter((i) => i.days != null && i.days <= 7).length;
  const fresh = sortItems(items.filter((i) => i.isNew && (isEasyFor(i, prefs) || eligibleForLists(i, prefs))), 'new').slice(0, 6);
  const totals = claimTotals(data.items);
  const filedList = Object.entries(store.claims).filter(([, c]) => c.s === 'filed').sort((a, b) => (b[1].filedAt || '').localeCompare(a[1].filedAt || '')).slice(0, 4);
  const v = account.vault.get();
  const name = v?.first_name || '';
  const showOnboard = !kws.length && !prefs.onboarded;

  root.innerHTML = `
    <div class="page-head view-enter">
      <div><div class="eyebrow">${esc(fmtDate(new Date().toISOString(), { weekday: 'long', month: 'long', day: 'numeric' }))}</div>
        <h1>${esc(greeting())}${name ? ', ' + esc(name) : ''}</h1></div>
      <div class="row-gap">
        <a class="chip" href="#/settings" title="Change your state in Settings">${icon('pin', 'sm')}${prefs.state ? esc(STATES[prefs.state]) + ' + nationwide' : 'Set your state'}</a>
        <a class="btn" href="#/browse">${icon('search', 'sm')}Find settlements</a>
      </div>
    </div>

    ${showOnboard ? onboarding(prefs) : ''}

    <div class="kpis">
      <div class="surface kpi hero enter" style="--i:0">
        <span class="k-label">${icon('check')}No-proof claims you can file</span>
        <span class="k-value" data-count="${easy.length}" data-int="1">${easy.length}</span>
        <span class="k-sub">${kws.length ? `${matchEasy.length} match your brands` : 'Add brands to see which match you'} · ${week} closing this week</span>
      </div>
      <a class="surface kpi enter" style="--i:1" href="#/claims?tab=paid"><span class="k-label">${icon('wallet')}Received</span><span class="k-value" data-count="${totals.received}" data-cents="1">${money(totals.received)}</span><span class="k-sub">${totals.paid} paid claim${totals.paid === 1 ? '' : 's'}</span></a>
      <a class="surface kpi enter" style="--i:2" href="#/claims?tab=filed"><span class="k-label">${icon('clock')}Pending</span><span class="k-value" data-count="${totals.pending}">${money(totals.pending)}</span><span class="k-sub">${totals.filed} filed, awaiting payment</span></a>
    </div>

    ${ending.length ? `
    <section class="section">
      <div class="section-head"><h2>Ending soon <span class="subtle" style="font-weight:500">· no proof</span></h2><a href="#/browse?f=soon">See all ${icon('chevronRight', 'sm')}</a></div>
      <div class="rail">${ending.map((i, n) => card(i, { kws, claim: store.claim(i.id), i: n })).join('')}</div>
      ${week ? `<p class="group-note">${week} no-proof claim${week === 1 ? '' : 's'} close${week === 1 ? 's' : ''} within 7 days.</p>` : ''}
    </section>` : ''}

    <section class="section">
      <div class="section-head"><h2>For you</h2>${matches.length ? `<a href="#/browse?f=match">See all ${matches.length} ${icon('chevronRight', 'sm')}</a>` : ''}</div>
      ${kws.length
        ? (matches.length ? `<div class="grid-cards three">${sortItems(matches, 'deadline').slice(0, 6).map((i, n) => card(i, { kws, claim: store.claim(i.id), i: n })).join('')}</div>`
          : `<div class="surface">${empty({ art: 'search', title: 'No matches right now', body: 'New settlements are added every 6 hours. Try adding more brands you use.', action: '<a class="btn" href="#/settings">Edit brands</a>' })}</div>`)
        : `<div class="surface">${empty({ art: 'sparkles', title: 'Personalize your feed', body: 'Tell us which brands, banks and apps you use and we will surface settlements you likely qualify for.', action: '<a class="btn primary" href="#/settings">Add brands</a>' })}</div>`}
    </section>

    ${filedList.length ? `
    <section class="section">
      <div class="section-head"><h2>Awaiting payment</h2><a href="#/claims?tab=filed">All claims ${icon('chevronRight', 'sm')}</a></div>
      <div class="list">${filedList.map(([id, c]) => {
        const it = data.byId.get(id) || { id, title: c.title || id, company: c.company || c.title || 'Settlement' };
        return `<button class="row" data-open="${esc(id)}">${avatar(it)}<span class="r-main"><span class="r-title">${esc(it.company)}</span><span class="r-sub">Filed ${esc(fmtDate(c.filedAt))}${c.confirmation ? ' · #' + esc(c.confirmation) : ''}</span></span>
          <span class="r-end"><span class="r-amount">${c.expected ? money(Number(c.expected)) : ''}</span>${icon('chevronRight', 'sm')}</span></button>`;
      }).join('')}</div>
    </section>` : ''}

    ${fresh.length ? `
    <section class="section">
      <div class="section-head"><h2>New this week</h2><a href="#/browse?f=new">See all ${icon('chevronRight', 'sm')}</a></div>
      <div class="grid-cards three">${fresh.map((i, n) => card(i, { kws, claim: store.claim(i.id), i: n })).join('')}</div>
    </section>` : ''}
  `;

  $$('[data-count]', root).forEach((el) => {
    if (el.dataset.int) { countUp(el, Number(el.dataset.count)); return; }
    const cents = el.dataset.cents;
    countUp(el, Number(el.dataset.count), (n) => money(cents ? Math.round(n * 100) / 100 : Math.round(n)));
  });

  if (showOnboard) wireOnboarding(root);
}

function onboarding(prefs) {
  return `<div class="surface onboard enter" style="margin-bottom:24px" id="onboard">
    <div class="row-gap"><div class="logo">${'<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7"/></svg>'}</div>
      <div><h2>Let's find money you're owed</h2><p class="muted" style="font-size:14px">Pick what you use. It stays private to you.</p></div></div>
    <div class="suggest">${SUGGESTIONS.map((s) => `<button class="chip" aria-pressed="${prefs.kw.includes(s)}" data-kw="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <div class="row-gap">
      <select class="input" id="ob-state" style="max-width:240px" aria-label="Your state"><option value="">Your state…</option>${Object.entries(STATES).map(([k, v]) => `<option value="${k}" ${prefs.state === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <span class="spacer"></span>
      <button class="btn ghost" data-ob="skip">Skip</button>
      <button class="btn primary" data-ob="done">${icon('check', 'sm')}Done</button>
    </div>
  </div>`;
}

function wireOnboarding(root) {
  const box = $('#onboard', root);
  const picked = new Set(store.prefs.kw);
  box.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-kw]');
    if (chip) {
      const k = chip.dataset.kw;
      picked.has(k) ? picked.delete(k) : picked.add(k);
      chip.setAttribute('aria-pressed', picked.has(k));
      return;
    }
    const b = e.target.closest('[data-ob]'); if (!b) return;
    if (b.dataset.ob === 'done') store.setPrefs({ kw: [...picked], state: $('#ob-state', root).value, onboarded: true });
    else store.setPrefs({ onboarded: true });
  });
}
