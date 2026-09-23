/* Textura decorativa independente da contagem, com identidade local por navegador. */
(() => {
  'use strict';
  const Wallpaper = window.CellWallpaper;
  const layer = document.getElementById('app-wallpaper');
  if (!Wallpaper || !layer) return;

  const storageKey = 'cellCounterWallpaperSeed_v1';
  function resolveSeed() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (typeof stored === 'string' && /^[a-f0-9]{16}$/i.test(stored)) return BigInt(`0x${stored}`);
    } catch (_) { /* A textura também funciona sem armazenamento disponível. */ }
    const words = new Uint32Array(2);
    try { window.crypto.getRandomValues(words); }
    catch (_) {
      for (let index = 0; index < words.length; index++) words[index] = Math.floor(Math.random() * 0x100000000);
    }
    const hex = [...words].map(word => word.toString(16).padStart(8, '0')).join('');
    try { localStorage.setItem(storageKey, hex); } catch (_) {}
    return BigInt(`0x${hex}`);
  }

  function colorCSS({ h, s, b }) {
    const chroma = b * s;
    const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
    const offset = b - chroma;
    const sectors = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
    return `rgb(${sectors[Math.floor(h / 60) % 6].map(value => Math.round((value + offset) * 255)).join(',')})`;
  }

  let enabled = true;
  try { enabled = JSON.parse(localStorage.getItem('cellCounterPrefs_v3') || '{}')?.wallpaper !== false; }
  catch (_) { /* Preferências indisponíveis mantêm o padrão visual. */ }
  let seed;
  let currentPeriod = null;
  let timer;
  function refresh() {
    window.clearTimeout(timer);
    layer.hidden = !enabled;
    if (!enabled || document.visibilityState === 'hidden') return;
    if (seed === undefined) seed = resolveSeed();
    const now = new Date();
    const period = Wallpaper.period(now.getHours());
    if (period !== currentPeriod) {
      const svg = Wallpaper.tileSVG(seed, period);
      layer.style.setProperty('--wallpaper-mask', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
      currentPeriod = period;
      layer.dataset.period = String(period);
    }
    for (const dark of [false, true]) {
      const color = Wallpaper.glyphHSB(Wallpaper.baseHSB(now, dark), dark);
      layer.style.setProperty(`--wallpaper-${dark ? 'dark' : 'light'}-ink`, colorCSS(color));
    }
    layer.dataset.ready = 'true';
    // Mesma cadência do Swift: uma atualização por minuto, sem animação contínua.
    timer = window.setTimeout(refresh, 60000 - Date.now() % 60000);
  }

  window.CellWallpaperView = Object.freeze({
    setEnabled(value) {
      const next = value !== false;
      if (enabled === next) return;
      enabled = next;
      refresh();
    }
  });

  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pagehide', () => window.clearTimeout(timer));
  window.addEventListener('pageshow', refresh);
  refresh();
})();
