/* Posições e atalhos. A identidade da célula nunca depende de sua posição ou tecla. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./counter.js'));
  else root.CellLayout = factory(root.CellCounter);
})(typeof window !== 'undefined' ? window : this, function (Core) {
  'use strict';
  const AVAILABLE_KEYS = [...'abcdefghijklmnopqrstuvwxyzç0123456789'];
  const validKey = key => typeof key === 'string' && /^[a-z0-9ç]$/u.test(key);
  function create(customCells = [], mode = 'blood', deletedCells = [], cellNames = {}, visual) {
    const state = Core.create(undefined, customCells, mode, deletedCells, cellNames, visual);
    const custom = state.customCells;
    const definitions = Core.allCells(state);
    const bindings = {};
    for (const cell of definitions) {
      const desired = cell.defaultShortcut || cell.key;
      bindings[cell.key] = Object.values(bindings).includes(desired)
        ? AVAILABLE_KEYS.find(key => !Object.values(bindings).includes(key)) : desired;
    }
    return { version: 5, mode: state.mode, deletedCells: state.deletedCells, cellNames: state.cellNames, ...Core.visualSettings(state), customCells: custom, order: definitions.map(cell => cell.key), bindings };
  }
  function restore(data) {
    if (!data || ![1, 2, 3, 4, 5].includes(data.version)) return null;
    const custom = data.customCells || [];
    const mode = data.version >= 3 ? data.mode : 'blood';
    const deletedCells = data.version >= 3 ? data.deletedCells : [];
    if (!Core.validCatalog(mode, custom, deletedCells)) return null;
    const cellNames = data.version >= 4 ? data.cellNames : {};
    if (!Core.validCellNames({ mode, customCells: custom, deletedCells }, cellNames)) return null;
    const visual = data.version >= 5 || Object.hasOwn(data, 'cellGroups') || Object.hasOwn(data, 'cellColors')
      ? { cellGroups: data.cellGroups, cellColors: data.cellColors } : undefined;
    const catalog = { mode, customCells: custom, deletedCells };
    if (visual && !Core.validVisual(catalog, visual)) return null;
    const ids = Core.allCells({ mode, customCells: custom, deletedCells }).map(cell => cell.key);
    if (!Array.isArray(data.order) || data.order.length !== ids.length) return null;
    if (new Set(data.order).size !== ids.length || data.order.some(id => !ids.includes(id))) return null;
    if (!data.bindings || typeof data.bindings !== 'object' || Array.isArray(data.bindings)) return null;
    const values = ids.map(id => data.bindings[id]);
    if (values.some(key => !validKey(key)) || new Set(values).size !== ids.length) return null;
    return { version: 5, mode, deletedCells: [...deletedCells], cellNames: { ...cellNames }, ...Core.visualSettings({ ...catalog, ...visual }), customCells: custom.map(cell => ({ ...cell })), order: [...data.order], bindings: Object.fromEntries(ids.map(id => [id, data.bindings[id]])) };
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
    if (!Core.validCatalog(layout.mode, customCells, layout.deletedCells) || layout.order.includes(id)) return { changed: false, reason: 'limit' };
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
    const compatible = layout?.mode === state.mode;
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
    return { version: 5, mode: state.mode, cellNames: { ...state.cellNames }, ...Core.visualSettings(state), customCells: state.customCells.map(cell => ({ ...cell })),
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
      deletedCells: Core.baseCells(layout.mode).some(cell => cell.key === id) ? [...layout.deletedCells, id] : [...layout.deletedCells]
    } };
  }
  function gridSpec(count, width, height) {
    count = Math.max(1, count);
    const gap = width < 1000 ? 8 : 10;
    let columns = Math.min(count, width >= 1000 ? 7 : 5);
    const maximum = Math.min(count, Math.max(columns, Math.floor((width + gap) / 112)));
    while (columns < maximum && (height - gap * (Math.ceil(count / columns) - 1)) / Math.ceil(count / columns) < 78) columns++;
    const compactMaximum = Math.min(count, Math.max(columns, Math.floor((width + gap) / 94)));
    while (columns < compactMaximum && (height - gap * (Math.ceil(count / columns) - 1)) / Math.ceil(count / columns) < 62) columns++;
    const rows = Math.ceil(count / columns);
    const cellWidth = (width - gap * (columns - 1)) / columns;
    const cellHeight = (height - gap * (rows - 1)) / rows;
    return { columns, rows, gap, dense: cellWidth < 135 || cellHeight < 120, tight: cellHeight < 96 || cellWidth < 108, micro: cellHeight < 62 || cellWidth < 82, cellWidth, cellHeight };
  }
  return Object.freeze({ create, restore, normalizeKey, assign, move, targetAt, add, reconcile, sync, remove, gridSpec, AVAILABLE_KEYS });
});
