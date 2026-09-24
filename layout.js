/* Posições e atalhos. A identidade da célula nunca depende de sua posição ou tecla. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./counter.js'));
  else root.CellLayout = factory(root.CellCounter);
})(typeof window !== 'undefined' ? window : this, function (Core) {
  'use strict';
  const AVAILABLE_KEYS = [...'abcdefghijklmnopqrstuvwxyzç0123456789'];
  const validKey = key => typeof key === 'string' && /^[a-z0-9ç]$/u.test(key);
  const materialOf = value => value?.fluid?.material || value?.material || 'synovial';
  const materialValid = material => ['synovial', 'csf', 'pleural', 'ascitic', 'pericardial'].includes(material);
  function create(customCells = [], mode = 'blood', deletedCells = [], cellNames = {}, visual, material = 'synovial') {
    const state = Core.create(undefined, customCells, mode, deletedCells, cellNames, visual, undefined, material);
    const custom = state.customCells;
    const definitions = Core.allCells(state);
    const bindings = {};
    for (const cell of definitions) {
      const desired = cell.defaultShortcut || cell.key;
      bindings[cell.key] = Object.values(bindings).includes(desired)
        ? AVAILABLE_KEYS.find(key => !Object.values(bindings).includes(key)) : desired;
    }
    return { version: mode === 'fluids' ? 6 : 5, mode: state.mode, ...(mode === 'fluids' ? { material: materialOf(state), fluidPresets: {} } : {}), deletedCells: state.deletedCells, cellNames: state.cellNames, ...Core.visualSettings(state), customCells: custom, order: definitions.map(cell => cell.key), bindings };
  }
  function restore(data, preset = false) {
    if (!data || ![1, 2, 3, 4, 5, 6].includes(data.version)) return null;
    const custom = data.customCells || [];
    const mode = data.version >= 3 ? data.mode : 'blood';
    const material = mode === 'fluids' ? data.material || 'synovial' : undefined;
    if (mode === 'fluids' && !materialValid(material)) return null;
    const deletedCells = data.version >= 3 ? data.deletedCells : [];
    if (!Core.validCatalog(mode, custom, deletedCells, material)) return null;
    const cellNames = data.version >= 4 ? data.cellNames : {};
    if (!Core.validCellNames({ mode, material, customCells: custom, deletedCells }, cellNames)) return null;
    const visual = data.version >= 5 || Object.hasOwn(data, 'cellGroups') || Object.hasOwn(data, 'cellColors')
      ? { cellGroups: data.cellGroups, cellColors: data.cellColors } : undefined;
    const catalog = { mode, material, customCells: custom, deletedCells };
    if (visual && !Core.validVisual(catalog, visual)) return null;
    const ids = Core.allCells(catalog).map(cell => cell.key);
    if (!Array.isArray(data.order) || data.order.length !== ids.length) return null;
    if (new Set(data.order).size !== ids.length || data.order.some(id => !ids.includes(id))) return null;
    if (!data.bindings || typeof data.bindings !== 'object' || Array.isArray(data.bindings)) return null;
    const values = ids.map(id => data.bindings[id]);
    if (values.some(key => !validKey(key)) || new Set(values).size !== ids.length) return null;
    const fluidPresets = {};
    if (mode === 'fluids' && !preset && data.fluidPresets !== undefined) {
      if (!data.fluidPresets || typeof data.fluidPresets !== 'object' || Array.isArray(data.fluidPresets)) return null;
      for (const [key, value] of Object.entries(data.fluidPresets)) {
        if (!materialValid(key) || value?.mode !== 'fluids' || value?.material !== key) return null;
        const checked = restore(value, true);
        if (!checked) return null;
        fluidPresets[key] = checked;
      }
    }
    return { version: mode === 'fluids' ? 6 : 5, mode, ...(mode === 'fluids' ? { material, ...(!preset ? { fluidPresets } : {}) } : {}), deletedCells: [...deletedCells], cellNames: { ...cellNames }, ...Core.visualSettings({ ...catalog, ...visual }), customCells: custom.map(cell => ({ ...cell })), order: [...data.order], bindings: Object.fromEntries(ids.map(id => [id, data.bindings[id]])) };
  }
  function normalizeKey(value) {
    if (typeof value !== 'string') return null;
    const key = value.toLowerCase();
    return validKey(key) ? key : null;
  }
  function assign(layout, id, value) {
    const key = normalizeKey(value);
    if (!layout.order.includes(id) || !key) return { changed: false, layout, reason: 'invalid' };
    if (layout.bindings[id] === key) return { changed: false, layout, reason: 'same' };
    const other = layout.order.find(candidate => candidate !== id && layout.bindings[candidate] === key);
    const bindings = { ...layout.bindings, [id]: key };
    if (other) bindings[other] = layout.bindings[id];
    return { changed: true, layout: { ...layout, bindings }, swapped: other || null };
  }
  function move(order, id, targetIndex) {
    const from = order.indexOf(id);
    if (from === -1 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= order.length || from === targetIndex) return [...order];
    const result = [...order];
    result.splice(from, 1);
    result.splice(targetIndex, 0, id);
    return result;
  }
  // Usa as posições finais dos slots, não as posições intermediárias da animação.
  function targetAt(rectangles, x, y, currentId) {
    return rectangles.findIndex(rect => {
      if (rect.id === currentId) return false;
      const insetX = Math.min(16, rect.width * .16);
      const insetY = Math.min(12, rect.height * .16);
      return x >= rect.left + insetX && x <= rect.left + rect.width - insetX &&
        y >= rect.top + insetY && y <= rect.top + rect.height - insetY;
    });
  }
  function add(layout, { id, name, key, excluded }) {
    const cleanName = Core.normalizeName(name);
    const shortcut = normalizeKey(key);
    if (!cleanName || cleanName.length > 40 || /[\u0000-\u001f\u007f]/.test(cleanName)) return { changed: false, reason: 'name' };
    if (Core.allCells(layout).some(cell => cell.name.toLocaleLowerCase('pt-BR') === cleanName.toLocaleLowerCase('pt-BR'))) return { changed: false, reason: 'duplicate-name' };
    if (!shortcut) return { changed: false, reason: 'key' };
    const conflict = layout.order.find(cell => layout.bindings[cell] === shortcut);
    if (conflict) return { changed: false, reason: 'conflict', conflict };
    const definition = { key: id, name: cleanName, excluded: excluded === true, defaultShortcut: shortcut };
    const customCells = [...layout.customCells, definition];
    if (!Core.validCatalog(layout.mode, customCells, layout.deletedCells, materialOf(layout)) || layout.order.includes(id)) return { changed: false, reason: 'limit' };
    return { changed: true, definition, layout: { ...layout, customCells, order: [...layout.order, id], bindings: { ...layout.bindings, [id]: shortcut } } };
  }
  function reconcile(layout, customCells) {
    let next = { ...layout, customCells: [...layout.customCells], order: [...layout.order], bindings: { ...layout.bindings } };
    for (const cell of customCells) {
      if (next.order.includes(cell.key)) continue;
      const used = Object.values(next.bindings);
      const key = used.includes(cell.defaultShortcut) ? AVAILABLE_KEYS.find(value => !used.includes(value)) : cell.defaultShortcut;
      if (!key) continue;
      next.customCells.push({ ...cell });
      next.order.push(cell.key);
      next.bindings[cell.key] = key;
    }
    return next;
  }
  // O catálogo da sessão é a fonte de verdade. Não ressuscita células excluídas.
  function sync(layout, state) {
    const definitions = Core.allCells(state);
    const ids = definitions.map(cell => cell.key);
    const compatible = layout?.mode === state.mode && (state.mode !== 'fluids' || materialOf(layout) === materialOf(state));
    const order = compatible ? layout.order.filter(id => ids.includes(id)) : [];
    for (const id of ids) if (!order.includes(id)) order.push(id);
    const bindings = {};
    if (compatible) for (const id of order) {
      const key = layout.bindings[id];
      if (validKey(key) && !Object.values(bindings).includes(key)) bindings[id] = key;
    }
    for (const cell of definitions) {
      if (bindings[cell.key]) continue;
      const desired = cell.defaultShortcut || cell.key;
      bindings[cell.key] = Object.values(bindings).includes(desired)
        ? AVAILABLE_KEYS.find(key => !Object.values(bindings).includes(key)) : desired;
    }
    return { version: state.mode === 'fluids' ? 6 : 5, mode: state.mode, ...(state.mode === 'fluids' ? { material: materialOf(state), fluidPresets: layout?.mode === 'fluids' ? { ...layout.fluidPresets } : {} } : {}), cellNames: { ...state.cellNames }, ...Core.visualSettings(state), customCells: state.customCells.map(cell => ({ ...cell })),
      deletedCells: [...state.deletedCells], order, bindings };
  }
  function remove(layout, id) {
    if (!layout.order.includes(id)) return { changed: false, layout, reason: 'invalid' };
    const bindings = { ...layout.bindings };
    const cellNames = { ...layout.cellNames };
    const visual = Core.visualSettings(layout);
    delete bindings[id];
    delete cellNames[id];
    delete visual.cellColors[id];
    visual.cellGroups = visual.cellGroups.map(group => ({ ...group, cellIds: group.cellIds.filter(key => key !== id) }));
    return { changed: true, layout: { ...layout, bindings, cellNames, ...visual, order: layout.order.filter(key => key !== id),
      customCells: layout.customCells.filter(cell => cell.key !== id),
      deletedCells: Core.baseCells(layout).some(cell => cell.key === id) ? [...layout.deletedCells, id] : [...layout.deletedCells]
    } };
  }
  function gridSpec(count, width, height, options = {}) {
    count = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
    width = Number.isFinite(width) ? Math.max(1, width) : 1;
    height = Number.isFinite(height) ? Math.max(1, height) : 1;
    let gap = width < 1000 ? 8 : 10;
    const scroll = options?.scroll === true;
    const maxWidth = 236;
    const maxHeight = 164;
    const preferredRatio = maxWidth / maxHeight;
    let best;
    // O tamanho de referência é um teto, não uma razão para esticar os cartões.
    // Compara as divisões possíveis e usa o espaço que cada uma realmente ocupa.
    function choose() {
      for (let columns = 1; columns <= count; columns++) {
        const rows = Math.ceil(count / columns);
        const cellWidth = Math.min(maxWidth, (width - gap * (columns - 1)) / columns);
        const cellHeight = scroll
          ? Math.min(maxHeight, Math.max(103, cellWidth / preferredRatio))
          : Math.min(maxHeight, (height - gap * (rows - 1)) / rows);
        if (cellWidth <= 0 || cellHeight <= 0) continue;
        if (scroll && cellWidth < Math.min(145, width)) continue;
        const gridHeight = rows * cellHeight + gap * (rows - 1);
        const unusedWidth = Math.max(0, width - columns * cellWidth - gap * (columns - 1)) / width;
        const emptyFraction = (columns * rows - count) / (columns * rows);
        const areaLoss = Math.log(maxWidth * maxHeight / (cellWidth * cellHeight));
        // No desktop, prioriza a largura dos nomes antes da proporção original,
        // preservando altura para número e controles. No celular, equilibra tamanho e largura ocupada
        // sem reduzir o alvo de toque para fazer todas as linhas caberem na tela.
        const score = scroll ? unusedWidth + areaLoss * .3
          : areaLoss + .2 * Math.log(cellWidth / cellHeight / preferredRatio) ** 2 +
            4 * (Math.max(0, 170 - cellWidth) / 170) ** 2 +
            4 * (Math.max(0, 60 - cellHeight) / 60) ** 2;
        const fullSize = !scroll && cellWidth === maxWidth && cellHeight === maxHeight;
        const fitsControls = cellHeight >= 46;
        const sameScore = best && Math.abs(score - best.score) < 1e-9;
        // Não troca a altura mínima dos controles por largura extra para o nome.
        if (best?.fitsControls && !fitsControls) continue;
        if (!best || (fitsControls && !best.fitsControls) || (fullSize && !best.fullSize) || (fullSize === best.fullSize &&
          (score < best.score - 1e-9 || (sameScore &&
            (rows < best.rows || (rows === best.rows && emptyFraction < best.emptyFraction)))))) {
          best = { columns, rows, cellWidth, cellHeight, gridHeight, score, fullSize, fitsControls, emptyFraction };
        }
      }
    }
    choose();
    // Durante um redimensionamento, a área pode ser menor do que os próprios gaps.
    if (!best) { gap = 0; choose(); }
    const { columns, rows, cellWidth, cellHeight, gridHeight } = best;
    return { columns, rows, gap, gridHeight, dense: cellWidth < 200 || cellHeight < 132,
      tight: cellWidth < 156 || cellHeight < 104, micro: cellWidth < 122 || cellHeight < 78, cellWidth, cellHeight };
  }
  return Object.freeze({ create, restore, normalizeKey, assign, move, targetAt, add, reconcile, sync, remove, gridSpec, AVAILABLE_KEYS });
});
