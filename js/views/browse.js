// Browse: search + filters over all open settlements, rendered incrementally.
import { icon, esc, debounce, $ } from '../ui.js';
import { store } from '../store.js';
import { isEasyFor, eligibleForLists, matchesFor, sortItems, categories } from '../data.js';
import { card, empty } from '../components.js';

const SS_KEY = 'settle.browse';
const PAGE = 24;
let ui = { q: '', f: 'easy', cat: '', sort: 'deadline' };
let io = null;
try { ui = { ...ui, ...JSON.parse(sessionStorage.getItem(SS_KEY) || '{}') }; } catch { /* ignore */ }
const persist = () => { try { sessionStorage.setItem(SS_KEY, JSON.stringify(ui)); } catch { /* ignore */ } };

const FILTERS = [
  ['easy', 'No proof', 'check'], ['match', 'For you', 'sparkles'], ['soon', 'Ending soon', 'clock'], ['new', 'New', 'trend'], ['all', 'All open', 'compass'],
];

export function render(root, { data, params }) {
  if (params.get('f')) { ui.f = params.get('f'); ui.cat = ''; persist(); history.replaceState(null, '', '#/browse'); }
  const prefs = store.prefs, kws = prefs.kw;
  const visible = (i) => store.claim(i.id)?.s !== 'skip';
  const pool = {
    easy: (i) => isEasyFor(i, prefs),
    match: (i) => (isEasyFor(i, prefs) || eligibleForLists(i, prefs)) && matchesFor(i, kws).length > 0,
    soon: (i) => (isEasyFor(i, prefs) || eligibleForLists(i, prefs)) && i.days != null && i.days <= 14,
    new: (i) => i.isNew && (isEasyFor(i, prefs) || eligibleForLists(i, prefs)),
    all: (i) => isEasyFor(i, prefs) || eligibleForLists(i, prefs),
  };
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, data.items.filter((i) => visible(i) && pool[k](i)).length]));
  const cats = categories(data.items.filter((i) => visible(i) && pool[ui.f](i)));

  root.innerHTML = `
    <div class="page-head view-enter"><div><div class="eyebrow">${data.items.length} open settlements</div><h1>Browse</h1></div></div>
    <div class="toolbar">
      <div class="toolbar-row">
        <div class="input-wrap">${icon('search')}<input class="input" id="q" type="search" placeholder="Search company, product, or keyword" value="${esc(ui.q)}" autocomplete="off" enterkeyhint="search" aria-label="Search settlements"><span class="kbd hide-mobile">/</span></div>
        <select class="input" id="sort" style="width:auto" aria-label="Sort">
          <option value="deadline" ${ui.sort === 'deadline' ? 'selected' : ''}>Deadline</option>
          <option value="payout" ${ui.sort === 'payout' ? 'selected' : ''}>Payout</option>
          <option value="new" ${ui.sort === 'new' ? 'selected' : ''}>Newest</option>
        </select>
      </div>
      <div class="chips" role="toolbar" aria-label="Filters">${FILTERS.map(([k, label, ic]) =>
        `<button class="chip" aria-pressed="${ui.f === k}" data-f="${k}">${icon(ic, 'sm')}${label}<span class="count">${counts[k]}</span></button>`).join('')}</div>
      ${cats.length > 1 ? `<div class="chips" aria-label="Categories"><button class="chip" aria-pressed="${!ui.cat}" data-cat="">All categories</button>${cats.map(([c, n]) =>
        `<button class="chip" aria-pressed="${ui.cat === c}" data-cat="${esc(c)}">${esc(c[0].toUpperCase() + c.slice(1))}<span class="count">${n}</span></button>`).join('')}</div>` : ''}
    </div>
    <div class="result-meta" id="meta"></div>
    <div id="results"></div>
    <div id="sentinel" style="height:1px"></div>`;

  const results = $('#results', root), meta = $('#meta', root), sentinel = $('#sentinel', root);
  let list = [], shown = 0;
  io?.disconnect();

  function compute() {
    const q = ui.q.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    list = sortItems(data.items.filter((i) => visible(i) && pool[ui.f](i) && (!ui.cat || i.category === ui.cat) && words.every((w) => i.hay.includes(w))), ui.sort);
  }
  function paint(reset = true) {
    if (reset) { compute(); shown = 0; results.innerHTML = ''; }
    meta.innerHTML = `<span>${list.length} result${list.length === 1 ? '' : 's'}${ui.q ? ` for “${esc(ui.q)}”` : ''}</span>${ui.f === 'match' && !kws.length ? '<a class="btn sm" href="#/settings">Add brands</a>' : ''}`;
    if (!list.length) {
      results.innerHTML = ui.f === 'match' && !kws.length
        ? empty({ art: 'sparkles', title: 'Add brands to see matches', body: 'Settlements mentioning brands you use show up here.', action: '<a class="btn primary" href="#/settings">Add brands</a>' })
        : empty({ art: 'search', title: 'Nothing found', body: 'Try a different search or filter.', action: ui.q || ui.cat ? '<button class="btn" data-clear>Clear search</button>' : '' });
      return;
    }
    let grid = results.querySelector('.grid-cards');
    if (!grid) { grid = document.createElement('div'); grid.className = 'grid-cards three'; results.append(grid); }
    const next = list.slice(shown, shown + PAGE);
    grid.insertAdjacentHTML('beforeend', next.map((i, n) => card(i, { kws, claim: store.claim(i.id), i: n })).join(''));
    shown += next.length;
  }

  paint();
  io = new IntersectionObserver((es) => { if (es[0].isIntersecting && shown < list.length) paint(false); }, { rootMargin: '600px' });
  io.observe(sentinel);

  $('#q', root).addEventListener('input', debounce((e) => { ui.q = e.target.value; persist(); paint(); }, 120));
  $('#sort', root).addEventListener('change', (e) => { ui.sort = e.target.value; persist(); paint(); });
  root.onclick = (e) => {
    const f = e.target.closest('[data-f]'); const c = e.target.closest('[data-cat]'); const clr = e.target.closest('[data-clear]');
    if (f) { ui.f = f.dataset.f; ui.cat = ''; persist(); render(root, { data, params: new URLSearchParams() }); }
    else if (c) { ui.cat = c.dataset.cat; persist(); render(root, { data, params: new URLSearchParams() }); }
    else if (clr) { ui.q = ''; ui.cat = ''; persist(); render(root, { data, params: new URLSearchParams() }); }
  };
  return () => io?.disconnect();
}

export function focusSearch() { const q = document.getElementById('q'); if (q) { q.focus(); q.select(); return true; } return false; }
