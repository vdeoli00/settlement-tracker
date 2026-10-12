// Theme switching with a smooth cross-fade, plus live tracking of the OS setting.
const mq = matchMedia('(prefers-color-scheme: dark)');
let current = 'system';

export function applyTheme(pref = current, animate = false) {
  current = pref;
  const dark = pref === 'dark' || (pref === 'system' && mq.matches);
  const set = () => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#08090c' : '#f6f7f9'));
  };
  if (animate && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(set);
  else set();
}
mq.addEventListener('change', () => { if (current === 'system') applyTheme('system', true); });
