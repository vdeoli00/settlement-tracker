// Runs before first paint (classic script in <head>) so there is no light/dark flash.
(function () {
  var pref = 'system';
  try { pref = (JSON.parse(localStorage.getItem('settle.v2') || '{}').prefs || {}).theme || 'system'; } catch (e) { /* default */ }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
