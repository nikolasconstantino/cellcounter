/* Textura geométrica: o mesmo glifo determinístico do aplicativo Swift. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CellWallpaper = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const uint64 = value => BigInt.asUintN(64, BigInt(value));
  const SYMMETRIES = Object.freeze(['vertical', 'horizontal', 'quadrant', 'diagonal']);
  const PERIODS = Object.freeze([
    { label: 'Madrugada', hours: '00h–06h', start: 0, length: 6, h: 220, s: 0.10, b: 0.92, darkRGB: [20, 23, 29] },
    { label: 'Amanhecer', hours: '06h–09h', start: 6, length: 3, h: 10, s: 0.08, b: 0.95, darkRGB: [31, 25, 23] },
    { label: 'Manhã', hours: '09h–12h', start: 9, length: 3, h: 210, s: 0.06, b: 0.97, darkRGB: [22, 28, 33] },
    { label: 'Meio-dia', hours: '12h–15h', start: 12, length: 3, h: 40, s: 0.04, b: 0.98, darkRGB: [26, 29, 30] },
    { label: 'Tarde', hours: '15h–18h', start: 15, length: 3, h: 35, s: 0.10, b: 0.96, darkRGB: [30, 27, 23] },
    { label: 'Pôr do sol', hours: '18h–20h', start: 18, length: 2, h: 20, s: 0.12, b: 0.94, darkRGB: [33, 24, 20] },
    { label: 'Crepúsculo', hours: '20h–22h', start: 20, length: 2, h: 280, s: 0.08, b: 0.93, darkRGB: [24, 23, 30] },
    { label: 'Noite', hours: '22h–00h', start: 22, length: 2, h: 225, s: 0.10, b: 0.91, darkRGB: [19, 22, 28] }
  ].map(anchor => Object.freeze({ ...anchor, darkRGB: Object.freeze(anchor.darkRGB) })));

  // UInt64 wrapping and the 53-bit fraction match SplitMix64 in Swift.
  function splitMix64(seed) {
    let state = uint64(seed);
    function next() {
      state = uint64(state + 0x9E3779B97F4A7C15n);
      let z = state;
      z = uint64((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n);
      z = uint64((z ^ (z >> 27n)) * 0x94D049BB133111EBn);
      return z ^ (z >> 31n);
    }
    return Object.freeze({ next, nextUnit: () => Number(next() >> 11n) / 9007199254740992 });
  }

  function period(hour) {
    if (hour >= 0 && hour < 6) return 0;
    if (hour >= 6 && hour < 9) return 1;
    if (hour >= 9 && hour < 12) return 2;
    if (hour >= 12 && hour < 15) return 3;
    if (hour >= 15 && hour < 18) return 4;
    if (hour >= 18 && hour < 20) return 5;
    if (hour >= 20 && hour < 22) return 6;
    return 7;
  }

  function mix(seed, phase) {
    return uint64(seed) ^ uint64(BigInt(phase) * 0xD1B54A32D192ED03n + 1n);
  }

  function symmetry(seed, phase) {
    const rng = splitMix64(mix(seed, phase) ^ 0x53594D4D45545259n);
    return SYMMETRIES[Number(rng.next() % 4n)];
  }

  function density(seed, phase) {
    const rng = splitMix64(mix(seed, phase) ^ 0x44454E5349545921n);
    return 0.30 + rng.nextUnit() * 0.30;
  }

  function cells(seed, phase) {
    const n = 7, middle = 3;
    const kind = symmetry(seed, phase);
    const threshold = density(seed, phase);
    const rng = splitMix64(mix(seed, phase) ^ 0x46494C4C43454C4Cn);
    const grid = Array.from({ length: n }, () => Array(n).fill(false));
    const on = () => rng.nextUnit() < threshold;

    if (kind === 'vertical') {
      for (let row = 0; row < n; row++) {
        for (let col = 0; col <= middle; col++) {
          const value = on();
          grid[row][col] = value;
          grid[row][n - 1 - col] = value;
        }
      }
    } else if (kind === 'horizontal') {
      for (let row = 0; row <= middle; row++) {
        for (let col = 0; col < n; col++) {
          const value = on();
          grid[row][col] = value;
          grid[n - 1 - row][col] = value;
        }
      }
    } else if (kind === 'quadrant') {
      for (let row = 0; row <= middle; row++) {
        for (let col = 0; col <= middle; col++) {
          const value = on();
          grid[row][col] = value;
          grid[row][n - 1 - col] = value;
          grid[n - 1 - row][col] = value;
          grid[n - 1 - row][n - 1 - col] = value;
        }
      }
    } else {
      for (let row = 0; row < n; row++) {
        for (let col = 0; col <= row; col++) {
          const value = on();
          grid[row][col] = value;
          grid[col][row] = value;
        }
      }
    }

    const count = grid.reduce((total, row) => total + row.filter(Boolean).length, 0);
    if (count === 0) grid[middle][middle] = true;
    else if (count === n * n) grid[middle][middle] = false;
    return grid;
  }

  function tileRotation(seed, row, col) {
    const mixed = uint64(uint64(seed) + uint64(row) * 0x46556B5Dn + uint64(col) * 0x2EB14A07n);
    const rng = splitMix64(mixed ^ 0xA5A55A5AF0F00F0Fn);
    return (rng.nextUnit() * 2 - 1) * 7 * Math.PI / 180;
  }

  function baseHSB(date, dark = false) {
    const hour = date.getHours(), minute = date.getMinutes();
    const index = period(hour);
    const current = PERIODS[index], next = PERIODS[(index + 1) % PERIODS.length];
    const t = Math.max(0, Math.min(0.9999, (hour + minute / 60 - current.start) / current.length));
    // Dark anchors stay close to graphite. Channel interpolation avoids unrelated
    // violet/green detours around the hue wheel; light retains the native palette.
    // Rationale and full-day contrast audit: docs/dark-palette-study.md.
    if (dark) return rgbHSB(current.darkRGB.map((value, channel) => value + (next.darkRGB[channel] - value) * t));
    let delta = next.h - current.h;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;
    let h = current.h + delta * t;
    if (h < 0) h += 360;
    else if (h >= 360) h -= 360;
    return { h, s: current.s + (next.s - current.s) * t, b: current.b + (next.b - current.b) * t };
  }

  function periodHSB(index, dark = false) {
    const anchor = PERIODS[Number.isInteger(index) && index >= 0 && index < PERIODS.length ? index : 0];
    return dark ? rgbHSB(anchor.darkRGB) : { h: anchor.h, s: anchor.s, b: anchor.b };
  }

  function rgbHSB(rgb) {
    const [r, g, b] = rgb.map(value => value / 255);
    const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b);
    const delta = maximum - minimum;
    let hue = 0;
    if (delta) {
      if (maximum === r) hue = ((g - b) / delta) % 6;
      else if (maximum === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
      hue = (hue * 60 + 360) % 360;
    }
    return { h: hue, s: maximum ? delta / maximum : 0, b: maximum };
  }

  function colorCSS({ h, s, b }) {
    const chroma = b * s;
    const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
    const offset = b - chroma;
    const sectors = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
    return `rgb(${sectors[Math.floor(h / 60) % 6].map(value => Math.round((value + offset) * 255)).join(',')})`;
  }

  function glyphHSB(base, dark = false) {
    return {
      h: base.h,
      s: dark ? base.s : Math.max(0, Math.min(0.30, base.s + 0.17)),
      b: dark ? Math.min(1, base.b + 0.06) : Math.max(0, base.b - 0.10)
    };
  }

  function tileSVG(seed, phase) {
    const grid = cells(seed, phase);
    const glyphSize = 20, stride = 27, side = 8, unit = glyphSize / grid.length;
    const margin = (stride - glyphSize) / 2;
    const number = value => String(Math.round(value * 1000000) / 1000000);
    const rectangles = [];
    grid.forEach((row, r) => row.forEach((filled, c) => {
      if (filled) rectangles.push(`<rect x="${number(c * unit + unit * 0.08)}" y="${number(r * unit + unit * 0.08)}" width="${number(unit * 0.84)}" height="${number(unit * 0.84)}" rx="${number(unit * 0.22)}"/>`);
    }));
    const tiles = [];
    for (let row = 0; row < side; row++) {
      for (let col = 0; col < side; col++) {
        const degrees = tileRotation(seed, row, col) * 180 / Math.PI;
        // Center each glyph in its stride so rotated corners never clip at a repeat boundary.
        tiles.push(`<use href="#wallpaper-glyph" transform="translate(${col * stride + margin} ${row * stride + margin}) rotate(${number(degrees)} 10 10)"/>`);
      }
    }
    const size = stride * side;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="#000"><defs><g id="wallpaper-glyph">${rectangles.join('')}</g></defs>${tiles.join('')}</svg>`;
  }

  return Object.freeze({ PERIODS, splitMix64, period, cells, symmetry, density, tileRotation, baseHSB, periodHSB, colorCSS, glyphHSB, tileSVG });
});
