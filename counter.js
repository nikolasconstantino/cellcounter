/* Contador de Células 2.4 · Nikolas R. Constantino
 * Regras independentes da interface. Sem dependências ou etapa de build.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CellCounter = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const CELLS = Object.freeze([
    { key: 'h', name: 'Segmentado' }, { key: 'g', name: 'Bastonete' },
    { key: 'j', name: 'Linfócito' }, { key: 'k', name: 'Monócito' },
    { key: 's', name: 'Eosinófilo' }, { key: 'a', name: 'Basófilo' },
    { key: 'l', name: 'Atípico' }, { key: 'e', name: 'Plasmócito' },
    { key: 't', name: 'Promielócito' }, { key: 'd', name: 'Mielócito' },
    { key: 'f', name: 'Metamielócito' }, { key: 'r', name: 'Blasto' },
    { key: 'q', name: 'Outras', separate: true },
    { key: 'p', name: 'Eritroblasto', separate: true, excluded: true }
  ].map(Object.freeze));
  const stages = ['Promielócito', 'Mielócito', 'Metamielócito', 'Bastonete', 'Segmentado'];
  const MARROW_CELLS = Object.freeze([
    { key: 'bm_myeloblast', name: 'Mieloblasto', defaultShortcut: 'r', group: 'granulocytic' },
    ...[
      ['neutro', 'neutrófilo', 'N', ['t', 'd', 'f', 'g', 'h']],
      ['eos', 'eosinófilo', 'Eo', ['y', 'u', 'i', 'o', 's']],
      ['baso', 'basófilo', 'Ba', ['1', '2', '3', '4', 'a']]
    ].flatMap(([id, lineage, short, keys]) => stages.map((stage, index) => ({
      key: `bm_${id}_${index}`, name: `${stage} ${lineage}`, shortName: `${short} · ${stage}`,
      defaultShortcut: keys[index], group: 'granulocytic', lineage: id
    }))),
    { key: 'bm_monocyte', name: 'Monócito', defaultShortcut: 'k', group: 'monocytic' },
    { key: 'bm_monocytoid', name: 'Célula monocitoide', defaultShortcut: 'n', group: 'monocytic' },
    { key: 'bm_proerythroblast', name: 'Proeritroblasto', defaultShortcut: 'z', group: 'erythroid' },
    { key: 'bm_ery_baso', name: 'Eritroblasto basófilo', shortName: 'Eritro · Basófilo', defaultShortcut: 'x', group: 'erythroid' },
    { key: 'bm_ery_poly', name: 'Eritroblasto policromático', shortName: 'Eritro · Policromático', defaultShortcut: 'c', group: 'erythroid' },
    { key: 'bm_ery_ortho', name: 'Eritroblasto ortocromático', shortName: 'Eritro · Ortocromático', defaultShortcut: 'v', group: 'erythroid' },
    { key: 'bm_lymphocyte', name: 'Linfócito', defaultShortcut: 'j', group: 'lymphoplasmacytic' },
    { key: 'bm_lymphoid', name: 'Célula linfoide', defaultShortcut: 'l', group: 'lymphoplasmacytic' },
    { key: 'bm_plasma', name: 'Plasmócito', defaultShortcut: 'e', group: 'lymphoplasmacytic' },
    { key: 'bm_other', name: 'Outras células', defaultShortcut: 'q', group: 'other' },
    { key: 'bm_macrophage', name: 'Macrófago', defaultShortcut: 'm', group: 'other', excluded: true },
    { key: 'bm_mast', name: 'Mastócito', defaultShortcut: 'b', group: 'other' },
    { key: 'bm_blast', name: 'Célula blástica', defaultShortcut: 'p', group: 'other' }
  ].map(Object.freeze));
  const MODES = Object.freeze({
    blood: Object.freeze({ name: 'Sangue periférico', defaultTarget: 100, targets: Object.freeze([100, 200, 500]) }),
    marrow: Object.freeze({ name: 'Medula óssea', defaultTarget: 500, targets: Object.freeze([200, 500, 1000]) })
  });
  const GROUPS = Object.freeze({ granulocytic: 'Série granulocítica', monocytic: 'Série monocítica',
    erythroid: 'Série eritrocítica', lymphoplasmacytic: 'Série linfo-plasmocitária', other: 'Outras células', custom: 'Células personalizadas' });
  const TARGETS = Object.freeze([100, 200, 500]);
  const HISTORY_LIMIT = 1000;
  const validNumber = value => Number.isSafeInteger(value) && value >= 0;
  const modeInfo = state => MODES[typeof state === 'string' ? state : state.mode] || MODES.blood;
  const baseCells = (mode = 'blood') => mode === 'marrow' ? MARROW_CELLS : CELLS;
  const catalogCells = state => [...baseCells(state.mode).filter(cell => !(state.deletedCells || []).includes(cell.key)), ...(state.customCells || [])];
  const allCells = state => catalogCells(state).map(cell => Object.hasOwn(state.cellNames || {}, cell.key)
    ? { ...cell, name: state.cellNames[cell.key], shortName: state.cellNames[cell.key] } : cell);
  const cellById = (state, key) => allCells(state).find(cell => cell.key === key);
  const total = state => allCells(state).reduce((sum, cell) => sum + (cell.excluded ? 0 : state.counts[cell.key]), 0);
  const hasProgress = state => allCells(state).some(cell => state.counts[cell.key] > 0);
  const complete = state => total(state) === state.target;

  function validCustomCells(cells) {
    return Array.isArray(cells) && cells.length <= 37 && new Set(cells.map(cell => cell?.key)).size === cells.length && cells.every(cell =>
      cell && typeof cell.key === 'string' && /^custom_[a-z0-9_-]{1,64}$/.test(cell.key) && typeof cell.name === 'string' &&
      cell.name.trim().length > 0 && cell.name.length <= 40 && !/[\u0000-\u001f\u007f]/.test(cell.name) &&
      typeof cell.excluded === 'boolean' && typeof cell.defaultShortcut === 'string' && /^[a-z0-9ç]$/u.test(cell.defaultShortcut));
  }

  function validCatalog(mode, customCells, deletedCells) {
    return Object.hasOwn(MODES, mode) && validCustomCells(customCells) && Array.isArray(deletedCells) &&
      new Set(deletedCells).size === deletedCells.length && deletedCells.every(id => baseCells(mode).some(cell => cell.key === id)) &&
      baseCells(mode).length - deletedCells.length + customCells.length <= 37;
  }

  function copyCustom(cells) {
    return cells.map(cell => ({ key: cell.key, name: cell.name, excluded: cell.excluded, defaultShortcut: cell.defaultShortcut }));
  }

  const normalizeName = value => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : '';
  const validName = name => typeof name === 'string' && name.trim().length > 0 && name.length <= 40 && !/[\u0000-\u001f\u007f]/.test(name);
  const validGroupId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(id);
  function normalizeColor(value) {
    if (typeof value !== 'string') return null;
    const hex = value.trim().replace(/^#/, '').toLowerCase();
    if (/^[a-f0-9]{3}$/.test(hex)) return '#' + [...hex].map(char => char + char).join('');
    return /^[a-f0-9]{6}$/.test(hex) ? '#' + hex : null;
  }
  function defaultCellGroups(state) {
    if (state.mode !== 'marrow') return [];
    const cells = allCells(state);
    return [
      ['neutro', 'Granulocítica neutrofílica', '#88b8a7', cell => cell.lineage === 'neutro' || cell.key === 'bm_myeloblast'],
      ['eos', 'Granulocítica eosinofílica', '#cdac80', cell => cell.lineage === 'eos'],
      ['baso', 'Granulocítica basofílica', '#a79abd', cell => cell.lineage === 'baso'],
      ['monocytic', 'Monocítica', '#9bb5c1', cell => cell.group === 'monocytic'],
      ['erythroid', 'Eritrocítica', '#c99797', cell => cell.group === 'erythroid'],
      ['lymphoplasmacytic', 'Linfo-plasmocitária', '#aaa7ca', cell => cell.group === 'lymphoplasmacytic']
    ].map(([id, name, color, matches]) => ({ id: `group_${id}`, name, color, cellIds: cells.filter(matches).map(cell => cell.key) }));
  }
  function validVisual(state, visual) {
    if (!visual || typeof visual !== 'object' || !Array.isArray(visual.cellGroups) ||
        !visual.cellColors || typeof visual.cellColors !== 'object' || Array.isArray(visual.cellColors)) return false;
    const ids = new Set(allCells(state).map(cell => cell.key));
    const groupIds = new Set();
    const names = new Set();
    const members = new Set();
    for (const group of visual.cellGroups) {
      if (!group || !validGroupId(group.id) || groupIds.has(group.id) || !validName(group.name) ||
          !normalizeColor(group.color) || !Array.isArray(group.cellIds)) return false;
      const name = normalizeName(group.name).toLocaleLowerCase('pt-BR');
      if (names.has(name)) return false;
      groupIds.add(group.id); names.add(name);
      for (const id of group.cellIds) {
        if (!ids.has(id) || members.has(id)) return false;
        members.add(id);
      }
    }
    return Object.entries(visual.cellColors).every(([id, color]) => ids.has(id) && normalizeColor(color));
  }
  function visualSettings(state) {
    return {
      cellGroups: (state.cellGroups ?? defaultCellGroups(state)).map(group => ({
        id: group.id, name: normalizeName(group.name), color: normalizeColor(group.color), cellIds: [...group.cellIds]
      })),
      cellColors: Object.fromEntries(Object.entries(state.cellColors || {}).map(([id, color]) => [id, normalizeColor(color)]))
    };
  }
  function cellColor(state, id) {
    // As cores e os membros já são validados ao editar ou restaurar a sessão.
    // A contagem consulta apenas a cor pedida, sem copiar todos os grupos.
    if (state.cellColors && Object.hasOwn(state.cellColors, id)) return state.cellColors[id];
    return (state.cellGroups ?? defaultCellGroups(state)).find(group => group.cellIds.includes(id))?.color || '';
  }
  function validCellNames(state, names) {
    return names !== null && typeof names === 'object' && !Array.isArray(names) &&
      Object.entries(names).every(([id, name]) => catalogCells(state).some(cell => cell.key === id) && validName(name));
  }

  function create(target, customCells = [], mode = 'blood', deletedCells = [], cellNames = {}, visual) {
    if (!Object.hasOwn(MODES, mode)) mode = 'blood';
    const valid = validCatalog(mode, customCells, deletedCells);
    const custom = valid ? copyCustom(customCells) : [];
    const deleted = valid ? [...deletedCells] : [];
    const catalog = { mode, customCells: custom, deletedCells: deleted };
    return {
      version: 6, mode, target: modeInfo(mode).targets.includes(target) ? target : modeInfo(mode).defaultTarget,
      customCells: custom, deletedCells: deleted,
      cellNames: validCellNames({ mode, customCells: custom, deletedCells: deleted }, cellNames) ? { ...cellNames } : {},
      ...visualSettings(validVisual(catalog, visual) ? { ...catalog, ...visual } : catalog),
      counts: Object.fromEntries(allCells({ mode, customCells: custom, deletedCells: deleted }).map(cell => [cell.key, 0])),
      history: [], paused: false, createdAt: new Date().toISOString(), updatedAt: null
    };
  }

  function touch(state, changes) {
    return { ...state, ...changes, updatedAt: new Date().toISOString() };
  }

  function unchanged(state, reason) { return { state, changed: false, reason }; }

  function saveGroup(state, values) {
    if (!values || !validGroupId(values.id)) return unchanged(state, 'invalid');
    const name = normalizeName(values.name);
    if (!validName(name)) return unchanged(state, 'name');
    const visual = visualSettings(state);
    if (visual.cellGroups.some(group => group.id !== values.id && group.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return unchanged(state, 'duplicate-name');
    const color = normalizeColor(values.color);
    if (!color) return unchanged(state, 'color');
    if (!Array.isArray(values.cellIds) || new Set(values.cellIds).size !== values.cellIds.length ||
        values.cellIds.some(id => !cellById(state, id))) return unchanged(state, 'cells');
    const updated = { id: values.id, name, color, cellIds: [...values.cellIds] };
    const selected = new Set(updated.cellIds);
    const cellGroups = visual.cellGroups.map(group => group.id === updated.id ? updated : {
      ...group, cellIds: group.cellIds.filter(id => !selected.has(id))
    });
    if (!cellGroups.some(group => group.id === updated.id)) cellGroups.push(updated);
    if (JSON.stringify(cellGroups) === JSON.stringify(visual.cellGroups)) return unchanged(state, 'same');
    return { changed: true, state: touch(state, { ...visual, cellGroups }) };
  }

  function removeGroup(state, id) {
    const visual = visualSettings(state);
    if (!visual.cellGroups.some(group => group.id === id)) return unchanged(state, 'invalid');
    return { changed: true, state: touch(state, { ...visual, cellGroups: visual.cellGroups.filter(group => group.id !== id) }) };
  }

  function setCellColor(state, id, value) {
    if (!cellById(state, id)) return unchanged(state, 'invalid');
    const clear = value === '' || value === null;
    const color = clear ? null : normalizeColor(value);
    if (!clear && !color) return unchanged(state, 'color');
    const visual = visualSettings(state);
    if ((visual.cellColors[id] || null) === color) return unchanged(state, 'same');
    if (clear) delete visual.cellColors[id];
    else visual.cellColors[id] = color;
    return { changed: true, state: touch(state, visual) };
  }

  function renameCell(state, id, value) {
    const current = cellById(state, id);
    if (!current) return unchanged(state, 'invalid');
    const name = normalizeName(value);
    if (!validName(name)) return unchanged(state, 'name');
    if (allCells(state).some(cell => cell.key !== id && cell.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return unchanged(state, 'duplicate-name');
    if (current.name === name) return unchanged(state, 'same');
    const cellNames = { ...state.cellNames, [id]: name };
    if (catalogCells(state).find(cell => cell.key === id).name === name) delete cellNames[id];
    return { changed: true, state: touch(state, { cellNames }) };
  }

  function change(state, key, delta) {
    const cell = cellById(state, key);
    if (!cell || (delta !== 1 && delta !== -1)) return unchanged(state, 'invalid');
    if (state.paused) return unchanged(state, 'paused');
    if (delta > 0 && !cell.excluded && total(state) >= state.target) return unchanged(state, 'complete');
    const next = state.counts[key] + delta;
    if (!validNumber(next)) return unchanged(state, 'limit');
    const entry = { type: 'count', key, delta };
    return {
      changed: true, entry,
      state: touch(state, {
        counts: { ...state.counts, [key]: next },
        history: [...state.history, entry].slice(-HISTORY_LIMIT)
      })
    };
  }

  function setTarget(state, target) {
    if (!modeInfo(state).targets.includes(target)) return unchanged(state, 'invalid');
    if (target < total(state)) return unchanged(state, 'below-total');
    if (target === state.target) return unchanged(state, 'same');
    const entry = { type: 'target', from: state.target, to: target };
    return {
      changed: true, entry,
      state: touch(state, {
        target,
        history: hasProgress(state) ? [...state.history, entry].slice(-HISTORY_LIMIT) : []
      })
    };
  }

  function undo(state) {
    if (state.paused) return unchanged(state, 'paused');
    const entry = state.history[state.history.length - 1];
    if (!entry) return unchanged(state, 'empty');
    let changes;
    if (entry.type === 'target') {
      if (total(state) > entry.from) return unchanged(state, 'below-total');
      changes = { target: entry.from };
    } else {
      const next = state.counts[entry.key] - entry.delta;
      if (!validNumber(next)) return unchanged(state, 'invalid');
      if (!cellById(state, entry.key)?.excluded && total(state) - entry.delta > state.target) return unchanged(state, 'complete');
      changes = { counts: { ...state.counts, [entry.key]: next } };
    }
    return { changed: true, entry, state: touch(state, { ...changes, history: state.history.slice(0, -1) }) };
  }

  // A sessão é validada antes de qualquer valor salvo entrar na interface.
  // Histórico inválido é descartado, preservando contagens válidas.
  function restore(data) {
    if (!data || typeof data !== 'object' || ![2, 3, 4, 5, 6].includes(data.version)) return null;
    if (!data.counts || typeof data.counts !== 'object' || Array.isArray(data.counts)) return null;
    const custom = data.customCells ?? [];
    const mode = data.version >= 4 ? data.mode : 'blood';
    const deleted = data.version >= 4 ? data.deletedCells : [];
    if (!validCatalog(mode, custom, deleted)) return null;
    const names = data.version >= 5 ? data.cellNames : {};
    if (!validCellNames({ mode, customCells: custom, deletedCells: deleted }, names)) return null;
    const visual = data.version >= 6 || Object.hasOwn(data, 'cellGroups') || Object.hasOwn(data, 'cellColors')
      ? { cellGroups: data.cellGroups, cellColors: data.cellColors } : undefined;
    if (visual && !validVisual({ mode, customCells: custom, deletedCells: deleted }, visual)) return null;
    const state = create(data.version === 2 ? 100 : data.target, custom, mode, deleted, names, visual);
    if (data.version !== 2 && !modeInfo(state).targets.includes(data.target)) return null;
    for (const cell of allCells(state)) {
      const raw = data.counts[cell.key] ?? (cell.key === 'p' ? data.eritroCount : 0) ?? 0;
      if (!validNumber(raw)) return null;
      state.counts[cell.key] = raw;
    }
    if (total(state) > state.target) return null;
    const validDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));
    if (validDate(data.createdAt)) state.createdAt = data.createdAt;
    state.updatedAt = validDate(data.updatedAt) ? data.updatedAt : null;
    state.paused = data.paused === true;
    if (data.version >= 3 && Array.isArray(data.history)) {
      const candidate = data.history.slice(-HISTORY_LIMIT);
      const simulated = { ...state, counts: { ...state.counts } };
      let valid = true;
      for (let i = candidate.length - 1; i >= 0; i--) {
        const event = candidate[i];
        if (!event || typeof event !== 'object') { valid = false; break; }
        if (event.type === 'count' && cellById(state, event.key) && [1, -1].includes(event.delta)) {
          const next = simulated.counts[event.key] - event.delta;
          if (!validNumber(next)) { valid = false; break; }
          simulated.counts[event.key] = next;
          if (total(simulated) > simulated.target) { valid = false; break; }
        } else if (event.type === 'target' && modeInfo(state).targets.includes(event.from) && event.to === simulated.target) {
          if (total(simulated) > event.from) { valid = false; break; }
          simulated.target = event.from;
        } else { valid = false; break; }
      }
      if (valid) state.history = candidate.map(event => event.type === 'count'
        ? { type: 'count', key: event.key, delta: event.delta }
        : { type: 'target', from: event.from, to: event.to });
    }
    return state;
  }

  function percentage(state, key) {
    const n = total(state);
    const cell = cellById(state, key);
    return !cell || cell.excluded || !n ? null : state.counts[key] / n * 100;
  }

  function series(state) {
    const n = total(state);
    return Object.entries(GROUPS).map(([key, name]) => {
      const entries = allCells(state).filter(cell => (cell.group || 'custom') === key && !cell.excluded);
      const count = entries.reduce((sum, cell) => sum + state.counts[cell.key], 0);
      return { key, name, count, percentage: n ? count / n * 100 : null, entries };
    }).filter(group => group.entries.length);
  }

  const formatPercent = value => value === null ? '—' : value.toFixed(1).replace('.', ',');

  function report(state) {
    const n = total(state);
    return [
      `Contador de Células — ${complete(state) ? 'Contagem concluída' : 'Contagem parcial'}`,
      `Modo: ${modeInfo(state).name}`,
      `Total contado: ${n} | Meta: ${state.target}`, '',
      ...allCells(state).filter(cell => !cell.excluded).map(cell =>
        `${cell.name}: ${state.counts[cell.key]} (${formatPercent(percentage(state, cell.key))}${n ? '%' : ''})`),
      '', ...allCells(state).filter(cell => cell.excluded).map(cell => `${cell.key === 'p' && !state.cellNames?.p ? 'Eritroblastos' : cell.name}: ${state.counts[cell.key]} (contagem separada, fora do total diferencial).`),
      `Percentuais calculados sobre ${n} células contadas; valores arredondados.`,
      ...(state.mode === 'marrow' ? ['', 'Totais por série (células incluídas no diferencial):', ...series(state).map(group => `${group.name}: ${group.count} (${formatPercent(group.percentage)}${n ? '%' : ''})`)] : [])
    ].join('\n');
  }

  function csv(state) {
    const csvText = value => {
      let text = String(value);
      if (/^\s*[=+@-]/.test(text)) text = "'" + text;
      return /[;"\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    return '\uFEFF' + [
      'Célula;Contagem;Percentual (%);Observação',
      ...allCells(state).map(cell => `${csvText(cell.name)};${state.counts[cell.key]};${cell.excluded || !total(state) ? '' : formatPercent(percentage(state, cell.key))};${cell.excluded ? 'Fora do total diferencial' : ''}`),
      `Total diferencial;${total(state)};;Meta: ${state.target}`,
      `Modo;;;${modeInfo(state).name}`
    ].join('\r\n');
  }

  function shortcut(event, { blocked = false, editing = false, bindings = null } = {}) {
    if (blocked || editing || event.repeat || event.isComposing) return null;
    let key = (event.key || '').toLowerCase();
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === 'z') return { type: 'undo' };
    if (event.ctrlKey || event.metaKey || event.altKey) return null;
    // Shift+1 produz "!" em muitos teclados; a correção continua ligada ao 1.
    if (event.shiftKey && /^(Digit|Numpad)[0-9]$/.test(event.code || '')) key = event.code.slice(-1);
    const id = bindings ? Object.keys(bindings).find(id => bindings[id] === key) : CELLS.find(cell => cell.key === key)?.key;
    return id ? { type: 'count', key: id, delta: event.shiftKey ? -1 : 1 } : null;
  }

  function withCustomCells(state, customCells) {
    if (!validCustomCells(customCells)) return state;
    // Uma personalização nunca remove uma célula que já exista nesta sessão.
    const incoming = new Map(customCells.map(cell => [cell.key, cell]));
    for (const cell of state.customCells || []) if (!incoming.has(cell.key)) incoming.set(cell.key, cell);
    const custom = [...incoming.values()];
    if (!validCatalog(state.mode || 'blood', custom, state.deletedCells || [])) return state;
    return { ...state, customCells: copyCustom(custom), counts: {
      ...Object.fromEntries(custom.map(cell => [cell.key, 0])), ...state.counts
    } };
  }

  function removeCell(state, id) {
    if (!cellById(state, id)) return unchanged(state, 'invalid');
    const counts = { ...state.counts };
    const cellNames = { ...state.cellNames };
    const visual = visualSettings(state);
    delete counts[id];
    delete cellNames[id];
    delete visual.cellColors[id];
    visual.cellGroups = visual.cellGroups.map(group => ({ ...group, cellIds: group.cellIds.filter(key => key !== id) }));
    return { changed: true, removedCount: state.counts[id], state: touch(state, {
      counts, cellNames, ...visual, customCells: state.customCells.filter(cell => cell.key !== id),
      deletedCells: baseCells(state.mode).some(cell => cell.key === id) ? [...state.deletedCells, id] : [...state.deletedCells],
      history: state.history.filter(entry => entry.type !== 'count' || entry.key !== id)
    }) };
  }

  return Object.freeze({ CELLS, MARROW_CELLS, MODES, GROUPS, TARGETS, modeInfo, baseCells, allCells, validCatalog, validCustomCells, validCellNames, normalizeName, normalizeColor, validVisual, visualSettings, cellColor, saveGroup, removeGroup, setCellColor, withCustomCells, create, total, hasProgress, complete, change, setTarget, undo, restore, percentage, series, formatPercent, report, csv, shortcut, removeCell, renameCell });
});
