/* Textura decorativa independente da contagem, com identidade local por navegador. */
(() => {
  'use strict';
  const Wallpaper = window.CellWallpaper;
  const layer = document.getElementById('app-wallpaper');
  if (!Wallpaper || !layer) return;
  const preview = document.getElementById('wallpaper-preview');
  const surfaces = [layer, preview].filter(Boolean);

  const storageKey = 'cellCounterWallpaperSeed_v1';
  function readSeed() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (typeof stored === 'string' && /^[a-f0-9]{16}$/i.test(stored)) return BigInt(`0x${stored}`);
    } catch (_) { /* A textura também funciona sem armazenamento disponível. */ }
    return undefined;
  }

  function randomSeed() {
    const words = new Uint32Array(2);
    try { window.crypto.getRandomValues(words); }
    catch (_) {
      for (let index = 0; index < words.length; index++) words[index] = Math.floor(Math.random() * 0x100000000);
    }
    const hex = [...words].map(word => word.toString(16).padStart(8, '0')).join('');
    return BigInt(`0x${hex}`);
  }

  function saveSeed(value) {
    try {
      localStorage.setItem(storageKey, value.toString(16).padStart(16, '0'));
      return true;
    } catch (_) { return false; }
  }

  function resolveSeed() {
    const stored = readSeed();
    if (stored !== undefined) return stored;
    const value = randomSeed();
    saveSeed(value);
    return value;
  }

  const normalizeIntensity = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 35;
  const normalizeTone = value => Number.isInteger(value) && value >= 0 && value < Wallpaper.PERIODS.length ? value : Wallpaper.period(new Date().getHours());
  function setStyle(key, value) {
    for (const surface of surfaces) surface.style.setProperty(key, value);
  }

  let enabled = true;
  let automatic = true;
  let intensity = 35;
  let tone = normalizeTone();
  try {
    const prefs = JSON.parse(localStorage.getItem('cellCounterPrefs_v3') || '{}');
    enabled = prefs?.wallpaper !== false;
    automatic = prefs?.wallpaperAutomatic !== false;
    intensity = normalizeIntensity(prefs?.wallpaperIntensity);
    tone = normalizeTone(prefs?.wallpaperTone);
  }
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
    const period = automatic ? Wallpaper.period(now.getHours()) : tone;
    if (period !== currentPeriod) {
      const svg = Wallpaper.tileSVG(seed, period);
      setStyle('--wallpaper-mask', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
      currentPeriod = period;
      for (const surface of surfaces) surface.dataset.period = String(period);
    }
    for (const dark of [false, true]) {
      const name = dark ? 'dark' : 'light';
      const base = automatic ? Wallpaper.baseHSB(now, dark) : Wallpaper.periodHSB(tone, dark);
      setStyle(`--wallpaper-${name}-base`, Wallpaper.colorCSS(base));
      setStyle(`--wallpaper-${name}-ink`, Wallpaper.colorCSS(Wallpaper.glyphHSB(base, dark)));
      // 35% preserva exatamente a intensidade anterior em ambos os temas.
      setStyle(`--wallpaper-${name}-opacity`, String(Number(((dark ? 0.16 : 0.105) * intensity / 35).toFixed(6))));
    }
    for (const surface of surfaces) surface.dataset.ready = 'true';
    // Mesma cadência do Swift: uma atualização por minuto, sem animação contínua.
    if (automatic) timer = window.setTimeout(refresh, 60000 - Date.now() % 60000);
  }

  window.CellWallpaperView = Object.freeze({
    setEnabled(value) {
      const next = value !== false;
      if (enabled === next) return;
      enabled = next;
      refresh();
    },
    setOptions(options = {}) {
      if (Object.prototype.hasOwnProperty.call(options, 'automatic')) automatic = options.automatic !== false;
      if (Object.prototype.hasOwnProperty.call(options, 'intensity')) intensity = normalizeIntensity(options.intensity);
      if (Object.prototype.hasOwnProperty.call(options, 'tone')) tone = normalizeTone(options.tone);
      refresh();
    },
    regenerate() {
      const previous = seed === undefined ? readSeed() : seed;
      seed = randomSeed();
      if (seed === previous) seed = BigInt.asUintN(64, seed + 1n);
      const saved = saveSeed(seed);
      currentPeriod = null;
      refresh();
      return { saved };
    }
  });

  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pagehide', () => window.clearTimeout(timer));
  window.addEventListener('pageshow', refresh);
  refresh();
})();
