/* Logo procedural: 29 bases e 22 cores, com opção de manter a escolha.
 * Preferência isolada da textura, das contagens e das demais configurações. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else {
    root.CellLogo = factory(root);
    root.CellLogo.start();
  }
})(typeof window !== 'undefined' ? window : this, function (browser) {
  'use strict';

  const Grammar = (function () {
      'use strict';

      const TAU = Math.PI * 2;
      const FAMILIES = Object.freeze([
        { id: 'petals', name: 'Flores' },
        { id: 'arcs', name: 'Arcos' },
        { id: 'loops', name: 'Laços' },
        { id: 'folds', name: 'Dobras' },
        { id: 'discs', name: 'Discos' }
      ].map(Object.freeze));

      function hash(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
        let h = 2166136261;
        for (const ch of String(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
        return h >>> 0;
      }

      function random(seed) {
        let state = seed >>> 0;
        return function () {
          state = (state + 0x6D2B79F5) >>> 0;
          let t = Math.imul(state ^ (state >>> 15), 1 | state);
          t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }

      function ellipse(x, y, rx, ry, angle, alpha, role = 'primary', ring = false) {
        return { type: 'ellipse', x, y, rx, ry, angle, alpha, role, ring };
      }

      function polygon(points, round, x, y, angle, alpha) {
        return { type: 'polygon', points, round, x, y, angle, alpha, role: 'primary' };
      }

      // Normalize the whole construction together, preserving every relationship.
      function contain(elements) {
        let extent = 0;
        for (const e of elements) {
          if (e.type === 'ellipse') {
            extent = Math.max(extent, Math.hypot(e.x, e.y) + Math.max(e.rx, e.ry));
          } else if (e.type === 'sector') {
            extent = Math.max(extent, Math.hypot(e.x, e.y) + e.outer);
          } else {
            const c = Math.cos(e.angle), s = Math.sin(e.angle);
            for (const [x, y] of e.points) {
              extent = Math.max(extent, Math.hypot(e.x + x * c - y * s, e.y + x * s + y * c));
            }
          }
        }
        const scale = Math.min(1, 38 / extent);
        if (scale === 1) return;
        for (const e of elements) {
          e.x *= scale;
          e.y *= scale;
          if (e.type === 'ellipse') { e.rx *= scale; e.ry *= scale; }
          else if (e.type === 'sector') { e.inner *= scale; e.outer *= scale; }
          else { e.round *= scale; e.points = e.points.map(p => p.map(v => v * scale)); }
        }
      }

      function create(inputSeed = 1, options = {}) {
        const seed = hash(inputSeed);
        const family = options.family || FAMILIES[Math.floor(random(seed)() * FAMILIES.length)].id;
        if (!FAMILIES.some(f => f.id === family)) throw new RangeError('Família desconhecida: ' + family);
        const rng = random(seed ^ hash(family));
        const between = (a, b) => a + (b - a) * rng();
        const pick = values => values[Math.floor(rng() * values.length)];
        const n = pick(family === 'loops' || family === 'discs' ? [3, 4, 5] : [3, 4, 5, 6]);
        const phase = -Math.PI / 2 + pick([0, Math.PI / n]);
        const elements = [];
        const params = { count: n, phase };
        const alpha = i => n % 2 === 0 ? (i % 2 ? 0.61 : 0.85) : 0.77;
        const repeat = callback => {
          for (let i = 0; i < n; i++) callback(phase + i * TAU / n, i);
        };
        let recipe;

        if (family === 'petals') {
          const distance = between(14, 17);
          const length = between(19, 21);
          const width = ({ 3: 14.4, 4: 12.5, 5: 10.7, 6: 9.4 })[n] * between(0.94, 1.07);
          repeat((a, i) => elements.push(ellipse(distance * Math.cos(a), distance * Math.sin(a), length, width, a, alpha(i))));
          const center = rng() < 0.55;
          if (center) elements.push(ellipse(0, 0, width * 0.46, width * 0.46, 0, 0.88, 'secondary'));
          Object.assign(params, { distance, length, width, center });
          recipe = `${n} pétalas iguais em torno de um centro${center ? ', com núcleo circular' : ''}.`;
        } else if (family === 'arcs') {
          const outer = between(34, 37.5);
          const inner = outer * between(0.36, 0.49);
          const gap = between(0.025, 0.065);
          repeat((a, i) => elements.push({
            type: 'sector', inner, outer, start: -Math.PI / n + gap / 2,
            end: Math.PI / n - gap / 2, x: 0, y: 0, angle: a, alpha: alpha(i), role: 'primary'
          }));
          Object.assign(params, { inner, outer, gap });
          recipe = `${n} segmentos circulares iguais, com uma abertura central comum.`;
        } else if (family === 'loops') {
          const distance = ({ 3: 13.2, 4: 15.6, 5: 17.5 })[n] * between(0.95, 1.04);
          const width = between(7.7, 9.7);
          const length = distance * Math.tan(Math.PI / n) + width * between(0.45, 0.65);
          const points = [[-length, -width], [length, -width], [length, width], [-length, width]];
          repeat((a, i) => elements.push(polygon(points.map(p => p.slice()), width, distance * Math.cos(a), distance * Math.sin(a), a + Math.PI / 2, alpha(i))));
          Object.assign(params, { distance, length, width });
          recipe = `${n} cápsulas iguais, sobrepostas ao redor de uma abertura.`;
        } else if (family === 'folds') {
          const reach = between(34, 37.5);
          const shoulder = reach * between(0.44, 0.52);
          const width = ({ 3: 15.6, 4: 13.7, 5: 11.8, 6: 10.3 })[n] * between(0.94, 1.05);
          const root = between(2.8, 4.4);
          const twist = between(-0.065, 0.065);
          const round = between(1.4, 2.3);
          const points = [[-root, 0], [shoulder, -width], [reach, 0], [shoulder, width]];
          repeat((a, i) => elements.push(polygon(points.map(p => p.slice()), round, 0, 0, a + twist, alpha(i))));
          Object.assign(params, { reach, shoulder, width, root, twist, round });
          recipe = `${n} losangos alongados e arredondados, unidos pelo centro.`;
        } else {
          const distance = between(13.7, 17.1);
          const radius = distance * between(1.08, 1.23);
          repeat((a, i) => elements.push(ellipse(distance * Math.cos(a), distance * Math.sin(a), radius, radius, a, alpha(i))));
          const ring = rng() < 0.55;
          if (ring) elements.push(ellipse(0, 0, radius * 0.42, radius * 0.42, 0, 0.92, 'secondary', true));
          Object.assign(params, { distance, radius, ring });
          recipe = `${n} discos iguais e sobrepostos${ring ? ', com um contorno circular central' : ''}.`;
        }

        contain(elements);
        return { version: 1, seed, family, elements, params, recipe };
      }

      return Object.freeze({ FAMILIES, create });
  })();

  const Classics = (function () {
      'use strict';

      // Geometry only: no DOM, storage or wallpaper dependencies.
      const SHAPES = Object.freeze([
        ['triad', 'Tríade', 'petals', 3], ['clover', 'Trevo', 'rosette', 4],
        ['flower', 'Flor', 'rosette', 6], ['rosette', 'Roseta', 'rosette', 8],
        ['diamond', 'Losango', 'polygon', 4], ['crystal', 'Cristal', 'polygon', 6],
        ['octagon', 'Octógono', 'polygon', 8], ['triangle', 'Triângulo', 'triangle', 3],
        ['helix', 'Hélice', 'helix', 3], ['ring', 'Anel', 'ring', 6],
        ['star', 'Estrela', 'star', 4], ['interlace', 'Enlace', 'interlace', 2],
        ['petals-four', 'Quatro pétalas', 'petals', 4], ['petals-five', 'Cinco pétalas', 'petals', 5],
        ['rosette-five', 'Roseta de cinco', 'rosette', 5], ['rosette-ten', 'Roseta de dez', 'rosette', 10],
        ['pentagon', 'Pentágono', 'polygon', 5], ['heptagon', 'Heptágono', 'polygon', 7],
        ['decagon', 'Decágono', 'polygon', 10], ['star-five', 'Estrela de cinco', 'star', 5],
        ['star-six', 'Estrela de seis', 'star', 6], ['star-eight', 'Estrela de oito', 'star', 8],
        ['ring-eight', 'Anel octogonal', 'ring', 8], ['capsule', 'Cápsula', 'capsule', 8]
      ].map(([id, name, kind, n]) => Object.freeze({ id, name, kind, n })));
      const TAU = Math.PI * 2;
      const K = 0.552284749831;
      const point = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
      const regular = (n, r, phase = -Math.PI / 2) => Array.from({ length: n }, (_, i) => point(r, phase + i * TAU / n));

      function hash(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
        let h = 2166136261;
        for (const ch of String(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
        return h >>> 0;
      }

      function random(seed) {
        let state = seed >>> 0;
        return () => {
          state = (state + 0x6D2B79F5) >>> 0;
          let t = Math.imul(state ^ state >>> 15, state | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      }

      function rounded(points, radius = 0) {
        if (!radius) return points.map((p, i) => [i ? 'L' : 'M', ...p]).concat([['Z']]);
        const corners = points.map((p, i) => {
          const before = points[(i + points.length - 1) % points.length];
          const after = points[(i + 1) % points.length];
          const near = q => {
            const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
            const f = Math.min(0.24, radius / d);
            return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
          };
          return [near(before), p, near(after)];
        });
        const commands = [['M', ...corners[0][0]]];
        corners.forEach(([a, p, b], i) => {
          if (i) commands.push(['L', ...a]);
          commands.push(['Q', ...p, ...b]);
        });
        commands.push(['Z']);
        return commands;
      }

      function oval(rx, ry) {
        return [['M', rx, 0], ['C', rx, K * ry, K * rx, ry, 0, ry],
          ['C', -K * rx, ry, -rx, K * ry, -rx, 0],
          ['C', -rx, -K * ry, -K * rx, -ry, 0, -ry],
          ['C', K * rx, -ry, rx, -K * ry, rx, 0], ['Z']];
      }

      // A smooth, symmetric outline: every lobe uses the same sinusoidal profile.
      function lobes(n, reach, depth) {
        const steps = n * 8, step = TAU / steps;
        const at = a => {
          const r = reach - depth + depth * Math.cos(n * (a + Math.PI / 2));
          const dr = -depth * n * Math.sin(n * (a + Math.PI / 2));
          return { p: point(r, a), d: [dr * Math.cos(a) - r * Math.sin(a), dr * Math.sin(a) + r * Math.cos(a)] };
        };
        const first = at(-Math.PI / 2), commands = [['M', ...first.p]];
        for (let i = 0; i < steps; i++) {
          const a = at(-Math.PI / 2 + i * step), b = at(-Math.PI / 2 + (i + 1) * step);
          commands.push(['C', a.p[0] + a.d[0] * step / 3, a.p[1] + a.d[1] * step / 3,
            b.p[0] - b.d[0] * step / 3, b.p[1] - b.d[1] * step / 3, ...b.p]);
        }
        commands.push(['Z']);
        return commands;
      }

      function path(commands, options = {}) {
        return Object.assign({ type: 'path', commands, x: 0, y: 0, angle: 0, alpha: 0.88, role: 'primary', fillRule: 'nonzero' }, options);
      }

      function facet(points, outline, options = {}) {
        return Object.assign({ type: 'polygon', points, round: 0, x: 0, y: 0, angle: 0,
          alpha: 0.7, role: 'primary', stroke: false,
          clip: { type: 'path', commands: outline, fillRule: 'evenodd' } }, options);
      }

      function facets(elements, outline, n, reach, inner, phase = -Math.PI / 2) {
        elements.push(path(outline, { fillRule: 'evenodd', stroke: false }));
        const tones = [-0.2, 0.32, 0.02, 0.58, -0.38, 0.18];
        for (let i = 0; i < n; i++) {
          const a = phase + i * TAU / n, b = phase + (i + 1) * TAU / n;
          const p = point(reach, a), q = point(reach, b), u = point(inner, a), v = point(inner, b);
          const tone = tones[i % tones.length];
          elements.push(facet([[0, 0], u, v], outline, { tone: tone - 0.15 }));
          elements.push(facet([u, p, q], outline, { tone }));
          elements.push(facet([u, q, v], outline, { tone: tone + 0.28 }));
          elements.push(path([['M', ...p], ['L', ...u], ['L', ...v]], {
            outlineonly: true, alpha: 0.44, clip: { type: 'path', commands: outline, fillRule: 'evenodd' }
          }));
        }
        elements.push(path(outline, { outlineonly: true, alpha: 0.64, fillRule: 'evenodd' }));
      }

      // Conservatively bound curve control points. Facets are bounded by their clips.
      function contain(elements) {
        let extent = 0;
        for (const element of elements) {
          const source = element.clip || element;
          const points = source.commands ? source.commands.flatMap(command => {
            const ps = [];
            for (let i = 1; i < command.length; i += 2) ps.push([command[i], command[i + 1]]);
            return ps;
          }) : source.points;
          const c = Math.cos(element.angle), s = Math.sin(element.angle);
          for (const [x, y] of points) extent = Math.max(extent,
            Math.hypot(element.x + x * c - y * s, element.y + x * s + y * c));
        }
        const scale = Math.min(1, 40 / extent);
        const scaledCommands = new Map();
        const scaleCommands = commands => {
          if (!scaledCommands.has(commands)) scaledCommands.set(commands, commands.map(command => command.map((v, i) => i ? v * scale : v)));
          return scaledCommands.get(commands);
        };
        for (const e of elements) {
          e.x *= scale; e.y *= scale;
          if (e.commands) e.commands = scaleCommands(e.commands);
          if (e.points) e.points = e.points.map(p => p.map(v => v * scale));
          if (e.round) e.round *= scale;
          if (e.clip) e.clip = Object.assign({}, e.clip, { commands: scaleCommands(e.clip.commands) });
        }
        return scale;
      }

      function create(inputSeed = 1, options = {}) {
        const seed = hash(inputSeed);
        const id = options.shape || SHAPES[Math.floor(random(seed)() * SHAPES.length)].id;
        const shape = SHAPES.find(s => s.id === id);
        if (!shape) throw new RangeError('Forma desconhecida: ' + id);
        const rng = random(seed ^ hash(id));
        const between = (a, b) => a + (b - a) * rng();
        const elements = [], n = shape.n;
        const reach = between(37, 40);
        const params = { kind: shape.kind, count: n, reach };
        let recipe;

        if (shape.kind === 'petals') {
          const width = ({ 3: 23, 4: 20, 5: 17.5 })[n] * between(0.84, 1.08);
          const root = between(5, 10), shoulder = between(0.5, 0.67);
          const outline = [['M', 0, root], ['C', -width, 0, -width * 0.88, -reach * shoulder, 0, -reach],
            ['C', width * 0.88, -reach * shoulder, width, 0, 0, root], ['Z']];
          for (let i = 0; i < n; i++) {
            const angle = i * TAU / n;
            elements.push(path(outline, { angle, alpha: 0.73, tone: i % 2 ? 0.15 : 0, stroke: false }));
            elements.push(facet([[0, -reach], [0, root], [-width * 1.4, -reach * 0.3]], outline, { angle, tone: 0.6, alpha: 0.55 }));
            elements.push(facet([[0, -reach * 0.45], [width * 1.4, -reach * 0.2], [0, root]], outline, { angle, tone: -0.35, alpha: 0.32 }));
            elements.push(path(outline, { angle, outlineonly: true, alpha: 0.66 }));
            elements.push(path([['M', 0, -reach], ['L', 0, root]], { angle, outlineonly: true, alpha: 0.4 }));
          }
          Object.assign(params, { width, root, shoulder });
          recipe = `${n} pétalas pontudas iguais; largura, curvatura e sobreposição variam em conjunto.`;
        } else if (shape.kind === 'rosette') {
          const depth = ({ 4: 7, 5: 5.6, 6: 4.7, 8: 3, 10: 2.3 })[n] * between(0.8, 1.2);
          const inner = reach * between(0.38, 0.59);
          const outline = lobes(n, reach, depth);
          facets(elements, outline, n * 2, reach / Math.cos(Math.PI / (n * 2)), inner);
          Object.assign(params, { depth, inner });
          recipe = `Um contorno com ${n} lóbulos simétricos; profundidade e proporção das facetas variam.`;
        } else if (shape.kind === 'polygon' || shape.kind === 'triangle') {
          const phase = n === 8 ? Math.PI / 8 : -Math.PI / 2;
          const aspect = shape.id === 'diamond' ? between(0.77, 1.05) : 1;
          const rounding = shape.kind === 'triangle' ? between(2.5, 7) : between(0.2, 2.4);
          const inner = reach * between(0.3, 0.59);
          const points = regular(n, reach, phase).map(([x, y]) => [x * aspect, y]);
          const outline = rounded(points, rounding);
          facets(elements, outline, n, reach * 1.08, inner, phase);
          Object.assign(params, { aspect, rounding, inner });
          recipe = `Um ${shape.name.toLowerCase()} simétrico, com cantos e divisões internas proporcionais à seed.`;
        } else if (shape.kind === 'helix') {
          const width = between(19, 25), curl = between(0.43, 0.61), root = between(1.4, 4.5);
          const outline = [['M', 0, root], ['C', -width * 0.64, -reach * 0.3, -width * 0.38, -reach * 0.85, width * 0.15, -reach],
            ['C', width * 0.95, -reach * 1.03, width * 1.18, -reach * curl, width * 0.58, -reach * 0.22],
            ['Q', width * 0.17, -reach * 0.05, 0, root], ['Z']];
          for (let i = 0; i < n; i++) {
            const angle = i * TAU / n;
            elements.push(path(outline, { angle, alpha: 0.81, stroke: false, tone: i * 0.1 }));
            elements.push(facet([[0, root], [width * 0.15, -reach], [width * 1.2, -reach * curl]], outline, { angle, tone: 0.55, alpha: 0.7 }));
            elements.push(facet([[0, root], [0, -reach * 0.42], [width * 1.2, -reach * curl]], outline, { angle, tone: -0.4, alpha: 0.28 }));
            elements.push(path(outline, { angle, outlineonly: true, alpha: 0.62 }));
          }
          Object.assign(params, { width, curl, root });
          recipe = 'Três pás curvas iguais; largura, curvatura e encontro no centro variam juntos.';
        } else if (shape.kind === 'ring') {
          const inner = reach * between(0.4, 0.61), rounding = between(0.5, 2.6);
          const outline = rounded(regular(n, reach), rounding).concat(rounded(regular(n, inner), rounding * 0.7));
          facets(elements, outline, n, reach * 1.05, (reach + inner) / 2);
          Object.assign(params, { inner, rounding });
          recipe = `Dois polígonos concêntricos de ${n} lados definem um anel com espessura variável.`;
        } else if (shape.kind === 'star') {
          const depth = ({ 4: [0.43, 0.57], 5: [0.48, 0.62], 6: [0.54, 0.69], 8: [0.65, 0.77] })[n];
          const inner = reach * between(...depth), rounding = between(0.6, 1.6);
          const outline = rounded(Array.from({ length: n * 2 }, (_, i) => point(i % 2 ? inner : reach, -Math.PI / 2 + i * Math.PI / n)), rounding);
          const core = inner * between(0.55, 0.81);
          facets(elements, outline, n * 2, reach / Math.cos(Math.PI / (n * 2)), core);
          Object.assign(params, { inner, rounding, core });
          recipe = `Uma estrela de ${n} pontas; profundidade dos recortes e tamanho do centro variam simetricamente.`;
        } else if (shape.kind === 'interlace') {
          const rx = between(20, 24), ry = between(28, 33), thickness = between(7.5, 10.5);
          const distance = between(10.5, 14), rise = between(2.5, 5), angle = between(-0.74, -0.52);
          const outline = oval(rx, ry).concat(oval(rx - thickness, ry - thickness));
          for (let i = 0; i < 2; i++) {
            const position = { x: i ? distance : -distance, y: i ? rise : -rise, angle };
            elements.push(path(outline, Object.assign({ fillRule: 'evenodd', alpha: 0.78, tone: i ? -0.1 : 0.25, stroke: false }, position)));
            elements.push(facet([[-rx * 1.5, -ry * 1.5], [0, 0], [rx * 1.5, -ry * 1.5]], outline, Object.assign({ tone: 0.6, alpha: 0.42 }, position)));
            elements.push(facet([[0, 0], [rx * 1.5, ry * 1.5], [rx * 1.5, -ry * 1.5]], outline, Object.assign({ tone: -0.45, alpha: 0.25 }, position)));
            elements.push(path(outline, Object.assign({ fillRule: 'evenodd', outlineonly: true, alpha: 0.54 }, position)));
          }
          Object.assign(params, { rx, ry, thickness, distance, rise, angle });
          recipe = 'Dois anéis elípticos sobrepostos; proporção, espessura e distância variam de forma vinculada.';
        } else {
          const rx = between(19, 25), ry = between(18, 23), straight = between(10, 16);
          const outline = [['M', -rx, -straight], ['C', -rx, -straight - K * ry, -K * rx, -straight - ry, 0, -straight - ry],
            ['C', K * rx, -straight - ry, rx, -straight - K * ry, rx, -straight], ['L', rx, straight],
            ['C', rx, straight + K * ry, K * rx, straight + ry, 0, straight + ry],
            ['C', -K * rx, straight + ry, -rx, straight + K * ry, -rx, straight], ['Z']];
          const inner = between(13, 21);
          facets(elements, outline, 8, 48, inner);
          Object.assign(params, { rx, ry, straight, inner });
          recipe = 'Uma cápsula simétrica; largura, alongamento e escala das facetas variam.';
        }

        params.scale = contain(elements);
        return { version: 1, seed, family: 'classic', shape: shape.id, name: shape.name, elements, params, recipe };
      }

      return Object.freeze({ SHAPES, create });
  })();

  const Palettes = (function () {
      'use strict';

      const PALETTES = Object.freeze([
        { id: 'verde-salvia', name: 'Verde sálvia', hex: '#88b8a7', source: 'app' },
        { id: 'areia', name: 'Areia', hex: '#cdac80', source: 'app' },
        { id: 'malva', name: 'Malva', hex: '#a79abd', source: 'app' },
        { id: 'azul-acinzentado', name: 'Azul acinzentado', hex: '#9bb5c1', source: 'app' },
        { id: 'rosa-antigo', name: 'Rosa antigo', hex: '#c99797', source: 'app' },
        { id: 'lavanda', name: 'Lavanda', hex: '#aaa7ca', source: 'app' },
        { id: 'coral', name: 'Coral', hex: '#e4aaa0', source: 'app' },
        { id: 'pessego', name: 'Pêssego', hex: '#edc19b', source: 'app' },
        { id: 'amarelo-suave', name: 'Amarelo suave', hex: '#e4d18d', source: 'app' },
        { id: 'verde-claro', name: 'Verde claro', hex: '#b4c99a', source: 'app' },
        { id: 'azul-suave', name: 'Azul suave', hex: '#a1c4e0', source: 'app' },
        { id: 'rosa-suave', name: 'Rosa suave', hex: '#ddb3ce', source: 'app' },
        { id: 'jade', name: 'Jade', hex: '#57bfa4', source: 'extra' },
        { id: 'turquesa', name: 'Turquesa', hex: '#6abdc2', source: 'extra' },
        { id: 'azul-ceruleo', name: 'Azul cerúleo', hex: '#77add7', source: 'extra' },
        { id: 'pervinca', name: 'Pervinca', hex: '#969bdb', source: 'extra' },
        { id: 'orquidea', name: 'Orquídea', hex: '#bd93cf', source: 'extra' },
        { id: 'framboesa', name: 'Framboesa', hex: '#ca85a8', source: 'extra' },
        { id: 'tangerina', name: 'Tangerina', hex: '#e89b74', source: 'extra' },
        { id: 'mel', name: 'Mel', hex: '#d9ba64', source: 'extra' },
        { id: 'pistache', name: 'Pistache', hex: '#a6bc73', source: 'extra' },
        { id: 'terracota', name: 'Terracota', hex: '#c99277', source: 'extra' }
      ].map(Object.freeze));

      const BY_ID = new Map(PALETTES.map(entry => [entry.id, entry]));

      function hash(value) {
        const text = String(value);
        let result = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
          result ^= text.charCodeAt(i);
          result = Math.imul(result, 16777619);
        }
        // Avalanche prevents nearby seeds from tracking nearby palette entries.
        result ^= result >>> 16;
        result = Math.imul(result, 0x7feb352d);
        result ^= result >>> 15;
        result = Math.imul(result, 0x846ca68b);
        return (result ^ (result >>> 16)) >>> 0;
      }

      /** An explicit palette ID overrides pool. Unknown IDs/pools throw RangeError. */
      function choose(seed, { palette, pool = 'all' } = {}) {
        if (!['all', 'app', 'extra'].includes(pool)) throw new RangeError('Unknown palette pool: ' + pool);
        if (palette !== undefined && palette !== null) {
          const entry = BY_ID.get(palette);
          if (!entry) throw new RangeError('Unknown palette ID: ' + palette);
          return entry;
        }
        const entries = pool === 'all' ? PALETTES : PALETTES.filter(entry => entry.source === pool);
        return entries[hash('color:' + seed) % entries.length];
      }

      function mix(hex, target, amount) {
        const components = hex.slice(1).match(/../g).map(value => parseInt(value, 16));
        return '#' + components.map(value => Math.round(value + (target - value) * amount)
          .toString(16).padStart(2, '0')).join('');
      }

      /** All tones stay in one hue family; base preserves the selected source HEX. */
      function tones(entry, { dark = false } = {}) {
        if (!entry || !/^#[0-9a-f]{6}$/i.test(entry.hex)) throw new TypeError('A palette entry with a six-digit HEX color is required.');
        const base = entry.hex.toLowerCase();
        return Object.freeze({
          light: mix(base, 255, dark ? 0.32 : 0.40),
          base,
          deep: mix(base, 0, dark ? 0.15 : 0.22),
          line: mix(base, 255, dark ? 0.67 : 0.87)
        });
      }

      return Object.freeze({ PALETTES, choose, tones });
  })();

  const Lab = (function (Grammar, Classics, Palettes) {
      'use strict';

      const SOURCES = Object.freeze([
        ...Grammar.FAMILIES.map(f => ({ id: 'new:' + f.id, key: f.id, name: f.name, origin: 'new', group: 'new:' + f.id })),
        ...Classics.SHAPES.map(s => ({ id: 'app:' + s.id, key: s.id, name: s.name, origin: 'app', group: 'app:' + s.kind }))
      ].map(Object.freeze));
      const GROUPS = Object.freeze([...new Set(SOURCES.map(s => s.group))]);

      function hash(value) {
        let h = 2166136261;
        for (const ch of String(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
        return h >>> 0;
      }

      function random(seed) {
        let state = seed >>> 0;
        return () => {
          state = (state + 0x6d2b79f5) >>> 0;
          let n = Math.imul(state ^ state >>> 15, state | 1);
          n ^= n + Math.imul(n ^ n >>> 7, n | 61);
          return ((n ^ n >>> 14) >>> 0) / 4294967296;
        };
      }

      function sourceFor(seed) {
        const rng = random(hash('source:' + seed));
        const group = GROUPS[Math.floor(rng() * GROUPS.length)];
        const candidates = SOURCES.filter(s => s.group === group);
        return candidates[Math.floor(rng() * candidates.length)];
      }

      function paletteFor(colorSeed, source, options) {
        if (options.palette) return Palettes.choose(colorSeed, { palette: options.palette });
        const pool = options.pool || 'all';
        if (!['all', 'app', 'extra'].includes(pool)) throw new RangeError('Paleta desconhecida.');
        const entries = Palettes.PALETTES.filter(p => pool === 'all' || p.source === pool);
        const rng = random(hash('colors:' + colorSeed));
        for (let i = entries.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [entries[i], entries[j]] = [entries[j], entries[i]];
        }
        // The gallery exposes every available color before repeating any color.
        return entries[SOURCES.findIndex(s => s.id === source.id) % entries.length];
      }

      function create(inputSeed = 1, options = {}) {
        const seed = typeof inputSeed === 'number' && Number.isFinite(inputSeed) ? inputSeed >>> 0 : hash(inputSeed);
        const source = options.source ? SOURCES.find(s => s.id === options.source) : sourceFor(seed);
        if (!source) throw new RangeError('Forma desconhecida: ' + options.source);
        const geometrySeed = hash('geometry:' + seed + ':' + source.id);
        const geometry = source.origin === 'app'
          ? Classics.create(geometrySeed, { shape: source.key })
          : Grammar.create(geometrySeed, { family: source.key });
        const colorSeed = options.colorSeed === undefined ? seed : options.colorSeed;
        return { ...geometry, seed, geometrySeed, sourceId: source.id, name: source.name, origin: source.origin,
          palette: paletteFor(colorSeed, source, options) };
      }

      function catalog(seed, options = {}) {
        return SOURCES.map(source => create(seed, { ...options, source: source.id }));
      }

      return Object.freeze({ SOURCES, PALETTES: Palettes.PALETTES, create, catalog, tones: Palettes.tones });
  })(Grammar, Classics, Palettes);

  const SHAPES = Object.freeze([
    ...Classics.SHAPES,
    ...Grammar.FAMILIES.map(f => Object.freeze({ id: 'new-' + f.id, name: f.name, kind: f.id }))
  ]);
  const PALETTES = Palettes.PALETTES;

  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }

  function create(seed, options = {}) {
    const normalized = Number.isFinite(seed) ? seed >>> 0 : 0;
    const pool = options.pool === undefined ? 'all' : options.pool;
    if (!['all', 'app', 'extra'].includes(pool)) throw new RangeError('Paleta desconhecida: ' + pool);
    let source;
    if (options.shape !== undefined) {
      const shape = SHAPES.find(s => s.id === options.shape);
      if (!shape) throw new RangeError('Forma desconhecida: ' + options.shape);
      source = shape.id.startsWith('new-') ? 'new:' + shape.id.slice(4) : 'app:' + shape.id;
    }
    if (options.palette !== undefined && !PALETTES.some(p => p.id === options.palette)) {
      throw new RangeError('Cor desconhecida: ' + options.palette);
    }
    const model = Lab.create(normalized, { source, palette: options.palette, colorSeed: options.colorSeed, pool });
    return freeze({ ...model, shape: model.origin === 'app' ? model.sourceId.slice(4) : 'new-' + model.family });
  }

  const number = value => {
    if (!Number.isFinite(value)) throw new TypeError('Coordenada inválida no logo.');
    return String(Math.round(value * 1000) / 1000);
  };
  const xy = point => point.map(number).join(' ');

  function roundedPath(points, radius) {
    if (!radius) return points.map((point, i) => (i ? 'L' : 'M') + xy(point)).join(' ') + ' Z';
    return points.map((point, i) => {
      const previous = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
      const d1 = Math.hypot(previous[0] - point[0], previous[1] - point[1]);
      const d2 = Math.hypot(next[0] - point[0], next[1] - point[1]);
      const distance = Math.min(radius, d1 / 2, d2 / 2);
      const inset = (target, length) => point.map((v, j) => v + (target[j] - v) * distance / length);
      return (i ? 'L' : 'M') + xy(inset(previous, d1)) + ' Q' + xy(point) + ' ' + xy(inset(next, d2));
    }).join(' ') + ' Z';
  }

  function primitive(element) {
    if (element.type === 'ellipse') {
      return { tag: 'ellipse', attributes: `cx="0" cy="0" rx="${number(element.rx)}" ry="${number(element.ry)}"` };
    }
    let d;
    if (element.type === 'path') {
      const lengths = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
      d = element.commands.map(([op, ...values]) => {
        if (!Object.hasOwn(lengths, op) || lengths[op] !== values.length) throw new TypeError('Traçado inválido no logo.');
        return op + values.map(number).join(' ');
      }).join(' ');
    } else if (element.type === 'polygon') {
      d = roundedPath(element.points, element.round || 0);
    } else if (element.type === 'sector') {
      const { inner, outer, start, end } = element;
      const point = (r, a) => xy([Math.cos(a) * r, Math.sin(a) * r]);
      const large = end - start > Math.PI ? 1 : 0;
      d = `M${point(outer, start)} A${number(outer)} ${number(outer)} 0 ${large} 1 ${point(outer, end)}`;
      d += inner > 0
        ? ` L${point(inner, end)} A${number(inner)} ${number(inner)} 0 ${large} 0 ${point(inner, start)} Z`
        : ' L0 0 Z';
    } else throw new TypeError('Geometria inválida no logo.');
    return { tag: 'path', attributes: `d="${d}"` };
  }

  function mix(a, b, amount) {
    const channels = hex => hex.slice(1).match(/../g).map(v => parseInt(v, 16));
    const x = channels(a), y = channels(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * amount).toString(16).padStart(2, '0')).join('');
  }

  // Fit the painted geometry, rather than its construction radius. Bounds include
  // round strokes and clipping; a small guard covers SVG's coordinate rounding.
  function fit(model) {
    const fallback = () => ({ scale: 1, x: 50, y: 50,
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } });
    const empty = () => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    const valid = b => Object.values(b).every(Number.isFinite) && b.minX <= b.maxX && b.minY <= b.maxY;
    const add = (b, p) => {
      b.minX = Math.min(b.minX, p[0]); b.maxX = Math.max(b.maxX, p[0]);
      b.minY = Math.min(b.minY, p[1]); b.maxY = Math.max(b.maxY, p[1]);
    };
    const numeric = value => {
      if (!Number.isFinite(value)) throw new TypeError('Invalid geometry.');
      return value;
    };
    const inflate = (b, radius) => ({ minX: b.minX - radius, minY: b.minY - radius,
      maxX: b.maxX + radius, maxY: b.maxY + radius });
    const roots = (a, b, c) => {
      const epsilon = 1e-12 * Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c));
      if (Math.abs(a) <= epsilon) return Math.abs(b) <= epsilon ? [] : [-c / b];
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) return [];
      if (!discriminant) return [-b / (2 * a)];
      // This form avoids subtracting nearly equal values for a small root.
      const q = -0.5 * (b + (b < 0 ? -1 : 1) * Math.sqrt(discriminant));
      return [q / a, c / q];
    };
    const primitiveBounds = (shape, transform) => {
      const b = empty(), { x, y, c, s } = transform;
      const point = (px, py) => [x + numeric(px) * c - numeric(py) * s,
        y + px * s + py * c];
      if (shape.type === 'ellipse') {
        const rx = numeric(shape.rx), ry = numeric(shape.ry);
        if (rx <= 0 || ry <= 0) throw new TypeError('Empty ellipse.');
        const ex = Math.hypot(rx * c, ry * s), ey = Math.hypot(rx * s, ry * c);
        return { minX: x - ex, minY: y - ey, maxX: x + ex, maxY: y + ey };
      }
      if (shape.type === 'polygon') {
        if (!Array.isArray(shape.points) || shape.points.length < 3) throw new TypeError('Empty polygon.');
        // Rounded corners stay inside the convex hull of their original vertices.
        for (const p of shape.points) {
          if (!Array.isArray(p) || p.length !== 2) throw new TypeError('Invalid polygon.');
          add(b, point(...p));
        }
      } else if (shape.type === 'sector') {
        const inner = numeric(shape.inner), outer = numeric(shape.outer);
        const start = numeric(shape.start), end = numeric(shape.end), tau = 2 * Math.PI;
        if (inner < 0 || outer <= inner || end <= start || end - start >= tau) throw new TypeError('Invalid sector.');
        const angle = Math.atan2(s, c), a = start + angle, z = end + angle;
        const polar = (r, t) => [x + r * Math.cos(t), y + r * Math.sin(t)];
        for (const r of [inner, outer]) {
          add(b, polar(r, a)); add(b, polar(r, z));
          for (let axis = 0; axis < 4; axis++) {
            const t = axis * Math.PI / 2;
            const candidate = t + Math.ceil((a - t) / tau) * tau;
            if (candidate <= z) add(b, polar(r, candidate));
          }
        }
      } else if (shape.type === 'path') {
        if (!Array.isArray(shape.commands)) throw new TypeError('Invalid path.');
        const lengths = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
        let current = null, start = null;
        for (const command of shape.commands) {
          if (!Array.isArray(command)) throw new TypeError('Invalid command.');
          const [op, ...values] = command;
          if (!Object.hasOwn(lengths, op) || values.length !== lengths[op]) throw new TypeError('Invalid command.');
          const points = [];
          for (let i = 0; i < values.length; i += 2) points.push(point(values[i], values[i + 1]));
          if (op === 'M') { current = points[0]; start = current; continue; }
          if (!current) throw new TypeError('Missing path start.');
          if (op === 'Z') { add(b, current); add(b, start); current = start; continue; }
          const last = points[points.length - 1];
          add(b, current); add(b, last);
          if (op === 'Q' || op === 'C') {
            const ps = [current, ...points], candidates = [];
            for (let axis = 0; axis < 2; axis++) {
              const p = ps.map(v => v[axis]);
              if (op === 'Q') {
                const denominator = p[0] - 2 * p[1] + p[2];
                if (denominator) candidates.push((p[0] - p[1]) / denominator);
              } else {
                candidates.push(...roots(-p[0] + 3 * p[1] - 3 * p[2] + p[3],
                  2 * (p[0] - 2 * p[1] + p[2]), p[1] - p[0]));
              }
            }
            for (const t of candidates) {
              if (!(t > 0 && t < 1)) continue;
              const u = 1 - t;
              add(b, [0, 1].map(axis => op === 'Q'
                ? u * u * ps[0][axis] + 2 * u * t * ps[1][axis] + t * t * ps[2][axis]
                : u * u * u * ps[0][axis] + 3 * u * u * t * ps[1][axis]
                  + 3 * u * t * t * ps[2][axis] + t * t * t * ps[3][axis]));
            }
          }
          current = last;
        }
      } else throw new TypeError('Unknown primitive.');
      return b;
    };

    try {
      if (!model || !Array.isArray(model.elements) || !model.elements.length) return fallback();
      const all = empty();
      for (const element of model.elements) {
        const angle = numeric(element.angle ?? 0), x = numeric(element.x ?? 0), y = numeric(element.y ?? 0);
        const transform = { x, y, c: Math.cos(angle), s: Math.sin(angle) };
        let b = primitiveBounds(element, transform);
        if (!valid(b) || (b.minX === b.maxX && b.minY === b.maxY)) continue;
        const width = element.stroke === false ? 0 : numeric(element.lineWidth || (model.origin === 'app' ? 1.05 : 1.8));
        if (width < 0) return fallback();
        b = inflate(b, width / 2);
        if (element.clip) {
          const clip = primitiveBounds(element.clip, transform);
          if (!valid(clip)) return fallback();
          b = { minX: Math.max(b.minX, clip.minX), minY: Math.max(b.minY, clip.minY),
            maxX: Math.min(b.maxX, clip.maxX), maxY: Math.min(b.maxY, clip.maxY) };
        }
        if (!valid(b)) continue;
        add(all, [b.minX, b.minY]); add(all, [b.maxX, b.maxY]);
      }
      if (!valid(all)) return fallback();
      const extent = Math.max(all.maxX - all.minX, all.maxY - all.minY);
      if (!(extent > 0) || !Number.isFinite(extent)) return fallback();
      const guard = 0.005 + Math.max(Math.abs(all.minX), Math.abs(all.minY),
        Math.abs(all.maxX), Math.abs(all.maxY)) * 0.00001;
      const bounds = inflate(all, guard);
      const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
      const scale = Math.min(1.35, 84 / size);
      const x = 50 - (bounds.minX / 2 + bounds.maxX / 2) * scale;
      const y = 50 - (bounds.minY / 2 + bounds.maxY / 2) * scale;
      return scale > 0 && [scale, x, y].every(Number.isFinite)
        ? { scale, x, y, bounds } : fallback();
    } catch (_) { return fallback(); }
  }

  function svg(model, options = {}) {
    const source = model || create(0), dark = Boolean(options.dark);
    const colors = Palettes.tones(source.palette, { dark });
    const layout = fit(source);
    const shape = SHAPES.find(s => s.id === source.shape);
    if (!shape) throw new RangeError('Forma desconhecida.');
    const prefix = 'cell-logo-' + (source.seed >>> 0).toString(36) + '-' + shape.id;
    const definitions = [], gradients = new Map(), clips = new Map();
    const lineWidth = 0.75;
    const body = source.elements.map(element => {
      let clipping = '';
      if (element.clip) {
        const clip = primitive(element.clip), rule = element.clip.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
        const key = clip.tag + clip.attributes + rule;
        if (!clips.has(key)) {
          const id = prefix + '-clip-' + clips.size;
          definitions.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><${clip.tag} ${clip.attributes} clip-rule="${rule}"/></clipPath>`);
          clips.set(key, id);
        }
        clipping = ` clip-path="url(#${clips.get(key)})"`;
      }

      const drawing = primitive(element), rule = element.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
      let fill = 'none';
      if (!element.ring && !element.outlineonly) {
        const tone = Math.max(-1, Math.min(1, element.tone || 0));
        let base = dark ? mix(colors.base, colors.light, 0.14) : colors.base;
        if (tone) base = mix(base, tone > 0 ? colors.light : colors.deep, Math.abs(tone));
        const light = mix(base, '#ffffff', dark ? 0.37 : 0.48);
        const deep = mix(base, colors.deep, dark ? 0.1 : 0.72);
        const key = light + deep;
        if (!gradients.has(key)) {
          const id = prefix + '-paint-' + gradients.size;
          definitions.push(`<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox"><stop stop-color="${light}"/><stop offset="1" stop-color="${deep}"/></linearGradient>`);
          gradients.set(key, id);
        }
        fill = 'url(#' + gradients.get(key) + ')';
      }
      const opacity = Math.min(1, (element.alpha ?? 0.8) + 0.13 + (dark ? 0.07 : 0));
      const stroke = element.stroke === false ? ''
        : ` stroke="${colors.line}" stroke-opacity="${number(element.ring ? 0.92 : 0.62)}" stroke-width="${number(element.lineWidth || lineWidth)}" stroke-linejoin="round" stroke-linecap="round"`;
      const transform = `translate(${number(element.x || 0)} ${number(element.y || 0)}) rotate(${number((element.angle || 0) * 180 / Math.PI)})`;
      return `<g transform="${transform}"${clipping}><${drawing.tag} ${drawing.attributes} fill="${fill}" fill-opacity="${number(opacity)}" fill-rule="${rule}"${stroke}/></g>`;
    }).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">'
      + '<defs>' + definitions.join('') + `</defs><g transform="translate(${number(layout.x)} ${number(layout.y)}) scale(${number(layout.scale)})">` + body + '</g></svg>';
  }

  let currentModel = null;
  let started = false;
  let waiting = false;
  let fixed = false;
  let storageError = null;
  let notice = '';
  let renderCurrent = () => {};
  const STORAGE_KEY = 'cellCounterLogo_v1';

  function settings() {
    return Object.freeze({ fixed, persisted: storageError === null });
  }

  function storedSeed() {
    let raw;
    try { raw = browser.localStorage.getItem(STORAGE_KEY); }
    catch (_) { storageError = 'read'; return null; }
    if (!raw) return null;
    try {
      const saved = JSON.parse(raw);
      if (saved && saved.version === 1 && saved.fixed === true && Number.isInteger(saved.seed)
          && saved.seed >= 0 && saved.seed <= 0xffffffff) return saved.seed;
    } catch (_) { /* Corrupt or obsolete preferences fall back to a fresh logo. */ }
    return null;
  }

  function persistChoice() {
    try {
      if (fixed) browser.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, fixed: true, seed: currentModel.seed }));
      else browser.localStorage.removeItem(STORAGE_KEY);
      storageError = null;
    } catch (_) { storageError = 'write'; }
  }

  function setFixed(value) {
    if (typeof value !== 'boolean') throw new TypeError('A opção de manter o logo deve ser booleana.');
    if (!started) start();
    if (!currentModel) return settings();
    fixed = value;
    persistChoice();
    notice = fixed ? 'Ícone salvo neste navegador.' : 'O ícone voltará a mudar na próxima abertura.';
    renderCurrent();
    return settings();
  }

  function regenerate() {
    if (!started) start();
    if (!currentModel) return null;
    let seed = freshSeed();
    if (seed === currentModel.seed) seed = (seed + 1) >>> 0;
    currentModel = create(seed);
    if (fixed || storageError === 'write') persistChoice();
    notice = fixed ? 'Novo ícone salvo para as próximas aberturas.' : 'Novo ícone gerado.';
    renderCurrent(true);
    return currentModel;
  }

  function freshSeed() {
    if (browser.crypto && typeof browser.crypto.getRandomValues === 'function') {
      try { return browser.crypto.getRandomValues(new Uint32Array(1))[0]; }
      catch (_) { /* Local previews may not provide usable crypto. */ }
    }
    return Math.floor(Math.random() * 4294967296);
  }

  function start() {
    if (!browser || !browser.document || started) return currentModel;
    const document = browser.document;
    if (document.readyState === 'loading') {
      if (!waiting) {
        waiting = true;
        document.addEventListener('DOMContentLoaded', function () {
          waiting = false;
          start();
        }, { once: true });
      }
      return currentModel;
    }
    const logo = document.getElementById('app-logo');
    const favicon = document.getElementById('app-favicon');
    const preview = document.getElementById('logo-preview');
    const fixedInput = document.getElementById('logo-fixed-setting');
    const generateButton = document.getElementById('generate-logo-button');
    const help = document.getElementById('logo-mode-help');
    const status = document.getElementById('logo-status');
    if (!logo && !favicon && !preview) return currentModel;
    started = true;
    const savedSeed = storedSeed();
    fixed = savedSeed !== null;
    currentModel = create(fixed ? savedSeed : freshSeed());
    const scheme = typeof browser.matchMedia === 'function'
      ? browser.matchMedia('(prefers-color-scheme: dark)') : null;
    let lastDark = null;
    let lastModel = null;
    const transitions = new Map();

    function render(animate = false) {
      const theme = document.documentElement.dataset.theme;
      const dark = theme === 'dark' || (theme !== 'light' && Boolean(scheme && scheme.matches));
      if (dark !== lastDark || currentModel !== lastModel) {
        const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(currentModel, { dark }));
        if (logo) logo.src = uri;
        if (favicon) favicon.href = uri;
        if (preview) {
          preview.src = uri;
          preview.alt = 'Ícone atual: ' + currentModel.name;
        }
        const reduceMotion = typeof browser.matchMedia === 'function'
          && browser.matchMedia('(prefers-reduced-motion: reduce)').matches;
        for (const image of [logo, preview]) {
          if (!image) continue;
          image.style?.setProperty('--icon-color', currentModel.palette.hex);
          if (image === preview) image.parentElement?.style?.setProperty('--icon-color', currentModel.palette.hex);
          transitions.get(image)?.cancel();
          transitions.delete(image);
          if (animate === true && !reduceMotion && typeof image.animate === 'function') {
            const transition = image.animate([
              { opacity: 0.35, transform: 'scale(0.93)' },
              { opacity: 1, transform: 'scale(1)' }
            ], { duration: 260, easing: 'ease-out' });
            transitions.set(image, transition);
            transition.onfinish = () => { if (transitions.get(image) === transition) transitions.delete(image); };
          }
        }
        lastDark = dark;
        lastModel = currentModel;
      }
      if (fixedInput) fixedInput.checked = fixed;
      if (help) help.textContent = fixed
        ? 'Este ícone será mantido nas próximas aberturas.' : 'Um novo ícone a cada abertura.';
      if (status) {
        status.textContent = storageError === 'read'
          ? 'Não foi possível recuperar o ícone salvo. Um novo ícone foi gerado nesta aba.'
          : storageError === 'write'
            ? 'A alteração vale nesta aba, mas o ícone não pôde ser salvo para a próxima abertura.' : notice;
        status.hidden = !status.textContent;
      }
    }

    renderCurrent = render;
    if (fixedInput) fixedInput.addEventListener('change', event => setFixed(event.target.checked));
    if (generateButton) generateButton.addEventListener('click', regenerate);
    render();
    if (typeof browser.MutationObserver === 'function') {
      new browser.MutationObserver(render).observe(document.documentElement, {
        attributes: true, attributeFilter: ['data-theme']
      });
    }
    if (scheme && typeof scheme.addEventListener === 'function') scheme.addEventListener('change', render);
    else if (scheme && typeof scheme.addListener === 'function') scheme.addListener(render);
    return currentModel;
  }

  return Object.freeze({ SHAPES, PALETTES, create, fit, svg, start, settings, setFixed, regenerate, current: () => currentModel });
});
