/* Contagem manual de líquidos: diferencial e câmara independentes.
 * Referências de método: doi:10.11613/BM.2020.010502 (Apêndice 1),
 * doi:10.11613/BM.2020.030501 e doi:10.1371/journal.pone.0288551.
 * Não interpreta resultados nem produz diagnósticos.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CellFluids = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const LIMIT = 1000000;
  const MATERIALS = Object.freeze([
    { key: 'synovial', name: 'Líquido sinovial', denominator: 'leucócitos' },
    { key: 'csf', name: 'Líquor (LCR)', denominator: 'células nucleadas' },
    { key: 'pleural', name: 'Líquido pleural', denominator: 'células nucleadas' },
    { key: 'ascitic', name: 'Líquido ascítico', denominator: 'células nucleadas' },
    { key: 'pericardial', name: 'Líquido pericárdico', denominator: 'células nucleadas' }
  ].map(Object.freeze));
  const CHAMBERS = Object.freeze([
    { key: 'neubauer', name: 'Neubauer melhorada', depth: 0.1,
      areas: Object.freeze([0.2, 1, 2, 3, 4, 5, 6, 7, 8, 9]), presets: Object.freeze([0.2, 1, 4, 9]) },
    { key: 'fuchs', name: 'Fuchs-Rosenthal', depth: 0.2,
      areas: Object.freeze(Array.from({ length: 16 }, (_, i) => i + 1)), presets: Object.freeze([1, 4, 16]) }
  ].map(Object.freeze));
  const LEUKOCYTES = Object.freeze([
    { key: 'neutro', name: 'Neutrófilo', shortcut: 'h' },
    { key: 'lymph', name: 'Linfócito', shortcut: 'j' },
    { key: 'mono', name: 'Monócito', shortcut: 'k' },
    { key: 'macro', name: 'Macrófago', shortcut: 'm' },
    { key: 'eos', name: 'Eosinófilo', shortcut: 's' },
    { key: 'baso', name: 'Basófilo', shortcut: 'a' },
    { key: 'plasma', name: 'Plasmócito', shortcut: 'e' }
  ].map(item => Object.freeze({ ...item, excluded: false, review: false })));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integer = value => Number.isInteger(value) && value >= 0 && value <= LIMIT;
  const targetValid = value => Number.isSafeInteger(value) && value > 0;
  const populationValid = value => value === 'nucleated' || value === 'rbc';
  const sideValid = value => value === 'A' || value === 'B';
  const materialInfo = material => MATERIALS.find(item => item.key === material);
  const chamberInfo = method => CHAMBERS.find(item => item.key === method);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const emptyChamber = () => ({ method: null, area: null, dilution: null, counts: { A: 0, B: 0 }, examined: { A: false, B: false }, locked: false });

  function baseCells(material) {
    if (!materialInfo(material)) return [];
    const cells = LEUKOCYTES.map(item => ({ ...item }));
    if (material === 'synovial') cells.push({ key: 'synoviocyte', name: 'Sinoviócito', shortcut: 'u', excluded: true, review: false });
    else if (material !== 'csf') cells.push({ key: 'mesothelial', name: 'Célula mesotelial', shortcut: 'u', excluded: false, review: false });
    cells.push({ key: 'atypical', name: 'Atípica / não classificada', shortcut: 'q', excluded: material === 'synovial', review: true });
    return cells;
  }

  function differentialCells(data) {
    if (typeof data === 'string') return baseCells(data);
    return data?.differential?.cells || baseCells(data?.material);
  }

  function cleanCells(cells, material) {
    if (!Array.isArray(cells) || cells.length > 37) return null;
    const defaults = new Set(baseCells(material).map(cell => cell.key));
    const ids = new Set();
    const result = [];
    for (const cell of cells) {
      const shortcut = cell?.defaultShortcut || cell?.shortcut;
      if (!object(cell) || typeof cell.key !== 'string' || ids.has(cell.key) ||
          (!defaults.has(cell.key) && !/^custom_[a-z0-9_-]{1,64}$/.test(cell.key)) ||
          typeof cell.name !== 'string' || !cell.name.trim() || cell.name.length > 40 || /[\u0000-\u001f\u007f]/.test(cell.name) ||
          typeof shortcut !== 'string' || !/^[a-z0-9ç]$/u.test(shortcut) || typeof cell.excluded !== 'boolean') return null;
      ids.add(cell.key);
      result.push({ key: cell.key, name: cell.name, shortcut, excluded: cell.excluded, review: cell.review === true });
    }
    return result;
  }

  function differentialDenominator(data) {
    return materialInfo(typeof data === 'string' ? data : data?.material)?.denominator || '';
  }

  function create(material = 'synovial') {
    if (!materialInfo(material)) return null;
    return {
      version: 2, material, materialSelected: true,
      differential: { cells: baseCells(material), counts: Object.fromEntries(baseCells(material).map(item => [item.key, 0])), closedLowCellularity: false },
      chambers: { nucleated: emptyChamber(), rbc: emptyChamber() },
      history: []
    };
  }

  function configured(chamber) {
    const method = chamberInfo(chamber?.method);
    return !!method && method.areas.includes(chamber.area) && Number.isFinite(chamber.dilution) && chamber.dilution >= 1 && chamber.dilution <= LIMIT;
  }

  function sanitizeChamber(raw) {
    if (!object(raw) || !object(raw.counts) || !object(raw.examined)) return null;
    if (!integer(raw.counts.A) || !integer(raw.counts.B) || typeof raw.examined.A !== 'boolean' || typeof raw.examined.B !== 'boolean') return null;
    if (raw.locked !== undefined && typeof raw.locked !== 'boolean') return null;
    const chamber = emptyChamber();
    if (raw.method !== null || raw.area !== null || raw.dilution !== null) {
      if (!configured(raw)) return null;
      chamber.method = raw.method; chamber.area = raw.area; chamber.dilution = raw.dilution;
    }
    chamber.counts = { A: raw.counts.A, B: raw.counts.B };
    chamber.examined = { A: raw.examined.A, B: raw.examined.B };
    chamber.locked = raw.locked === true || chamber.counts.A > 0 || chamber.counts.B > 0 || chamber.examined.A || chamber.examined.B;
    if (chamber.locked && !configured(chamber)) return null;
    return chamber;
  }

  // Rebuild from the schema, dropping free text and unknown keys at every level.
  function snapshot(raw) {
    if (!object(raw) || ![1, 2].includes(raw.version) || !materialInfo(raw.material) || !object(raw.differential) || !object(raw.differential.counts) || !object(raw.chambers)) return null;
    if (typeof raw.differential.closedLowCellularity !== 'boolean') return null;
    if (raw.materialSelected !== undefined && typeof raw.materialSelected !== 'boolean') return null;
    const data = create(raw.material);
    // Older sessions already had a material, even before selection was explicit.
    data.materialSelected = raw.materialSelected !== false;
    const cells = raw.version === 1 ? baseCells(raw.material) : cleanCells(raw.differential.cells, raw.material);
    if (!cells) return null;
    data.differential.cells = cells;
    data.differential.counts = {};
    for (const cell of differentialCells(data)) {
      if (!integer(raw.differential.counts[cell.key])) return null;
      data.differential.counts[cell.key] = raw.differential.counts[cell.key];
    }
    data.differential.closedLowCellularity = raw.differential.closedLowCellularity;
    for (const population of ['nucleated', 'rbc']) {
      const chamber = sanitizeChamber(raw.chambers[population]);
      if (!chamber) return null;
      data.chambers[population] = chamber;
    }
    if (!data.materialSelected && (hasProgress(data) || Object.values(data.chambers).some(configured))) return null;
    delete data.history;
    return data;
  }

  // The editor's active catalog is projected into the counter. Rebase historical
  // counts onto it too, so undo cannot resurrect deleted or renamed definitions.
  function withCatalog(raw, definitions) {
    const data = restore(raw);
    const cells = data && cleanCells(definitions, data.material);
    if (!data || !cells) return null;
    const project = previous => ({ ...previous, differential: {
      ...previous.differential,
      cells: cells.map(cell => ({ ...cell })),
      counts: Object.fromEntries(cells.map(cell => [cell.key, previous.differential.counts[cell.key] || 0]))
    } });
    const result = project(data);
    result.history = data.history.filter(item => item.material === data.material).map(project);
    return result;
  }

  function restore(raw) {
    const data = snapshot(raw);
    if (!data) return null;
    data.history = Array.isArray(raw.history) ? raw.history.slice(-50).map(snapshot).filter(Boolean) : [];
    return data;
  }

  function differentialTotal(data) {
    return differentialCells(data).reduce((sum, item) => sum + (item.excluded ? 0 : data.differential.counts[item.key]), 0);
  }

  function differentialComplete(data, target) {
    return data?.materialSelected !== false && (!!data?.differential?.closedLowCellularity || (targetValid(target) && differentialTotal(data) >= target));
  }

  function hasProgress(data) {
    if (!data) return false;
    if (data.differential.closedLowCellularity || Object.values(data.differential.counts).some(value => value > 0)) return true;
    return Object.values(data.chambers).some(chamber => chamber.locked || chamber.counts.A > 0 || chamber.counts.B > 0 || chamber.examined.A || chamber.examined.B);
  }

  const fail = (data, reason) => ({ changed: false, data, reason });
  function commit(before, after) {
    const data = snapshot(after);
    if (!data) return fail(before, 'invalid-data');
    if (same(snapshot(before), data)) return fail(before, 'unchanged');
    const clean = restore(before);
    if (!clean) return fail(before, 'invalid-data');
    data.history = [...clean.history, snapshot(clean)].slice(-50);
    return { changed: true, data };
  }

  function changeDifferential(raw, key, delta, target) {
    const data = restore(raw);
    if (!data || !targetValid(target) || !Number.isInteger(delta) || delta === 0) return fail(raw, 'invalid-input');
    if (!data.materialSelected) return fail(raw, 'material-required');
    const cell = differentialCells(data).find(item => item.key === key);
    if (!cell) return fail(raw, 'invalid-cell');
    const next = data.differential.counts[key] + delta;
    if (!integer(next)) return fail(raw, 'count-limit');
    if (delta > 0 && data.differential.closedLowCellularity) return fail(raw, 'differential-closed');
    if (delta > 0 && !cell.excluded && differentialTotal(data) + delta > target) return fail(raw, 'target-reached');
    data.differential.counts[key] = next;
    if (delta < 0) data.differential.closedLowCellularity = false;
    return commit(raw, data);
  }

  function finishDifferential(raw, target) {
    const data = restore(raw);
    if (!data || !targetValid(target)) return fail(raw, 'invalid-input');
    if (!data.materialSelected) return fail(raw, 'material-required');
    if (differentialComplete(data, target)) return fail(raw, 'already-complete');
    data.differential.closedLowCellularity = true;
    return commit(raw, data);
  }

  function reopenDifferential(raw) {
    const data = restore(raw);
    if (!data) return fail(raw, 'invalid-data');
    if (!data.materialSelected) return fail(raw, 'material-required');
    data.differential.closedLowCellularity = false;
    return commit(raw, data);
  }

  function setMaterial(raw, material) {
    const data = restore(raw);
    if (!data || !materialInfo(material)) return fail(raw, 'invalid-material');
    // Selecting the material is setup, not a count that Undo should revert.
    if (!data.materialSelected) return { changed: true, data: create(material) };
    if (material === data.material) return fail(raw, 'unchanged');
    if (hasProgress(data)) return fail(raw, 'session-started');
    return commit(raw, create(material));
  }

  function updateChamber(raw, settings) {
    const data = restore(raw);
    if (!data || !object(settings) || !populationValid(settings.population)) return fail(raw, 'invalid-input');
    if (!data.materialSelected) return fail(raw, 'material-required');
    const chamber = data.chambers[settings.population];
    const updated = { ...chamber };
    for (const key of ['method', 'area', 'dilution']) if (own(settings, key)) updated[key] = settings[key];
    if (!configured(updated)) return fail(raw, 'invalid-method');
    if (same(chamber, updated)) return fail(raw, 'unchanged');
    if (chamber.locked) return fail(raw, 'reset-required');
    data.chambers[settings.population] = updated;
    return commit(raw, data);
  }

  function setChamberCount(raw, population, side, value) {
    const data = restore(raw);
    if (!data || !populationValid(population) || !sideValid(side) || !integer(value)) return fail(raw, 'invalid-input');
    if (!data.materialSelected) return fail(raw, 'material-required');
    const chamber = data.chambers[population];
    if (!configured(chamber)) return fail(raw, 'method-required');
    if (chamber.counts[side] === value) return fail(raw, 'unchanged');
    chamber.counts[side] = value;
    chamber.examined[side] = false;
    chamber.locked = true;
    return commit(raw, data);
  }

  function changeChamber(raw, population, side, delta) {
    if (!populationValid(population) || !sideValid(side) || !Number.isInteger(delta) || delta === 0) return fail(raw, 'invalid-input');
    const data = restore(raw);
    if (!data) return fail(raw, 'invalid-data');
    return setChamberCount(raw, population, side, data.chambers[population].counts[side] + delta);
  }

  function markChamber(raw, population, side, examined) {
    const data = restore(raw);
    if (!data || !populationValid(population) || !sideValid(side) || typeof examined !== 'boolean') return fail(raw, 'invalid-input');
    if (!data.materialSelected) return fail(raw, 'material-required');
    const chamber = data.chambers[population];
    if (!configured(chamber)) return fail(raw, 'method-required');
    chamber.examined[side] = examined;
    if (examined) chamber.locked = true;
    return commit(raw, data);
  }

  function resetChamber(raw, population) {
    const data = restore(raw);
    if (!data || !populationValid(population)) return fail(raw, 'invalid-input');
    if (!data.materialSelected) return fail(raw, 'material-required');
    const previous = data.chambers[population];
    data.chambers[population] = { ...emptyChamber(), method: previous.method, area: previous.area, dilution: previous.dilution };
    return commit(raw, data);
  }

  function chamberResult(data, population) {
    const chamber = populationValid(population) ? sanitizeChamber(data?.chambers?.[population]) : null;
    const result = { ready: false, value: null, volume: null, differencePercent: null, total: 0, method: null, area: null, depth: null, dilution: null, counts: { A: 0, B: 0 }, examined: { A: false, B: false }, reason: 'method-required' };
    if (data?.materialSelected === false) return { ...result, reason: 'material-required' };
    if (!chamber) return { ...result, reason: 'invalid-data' };
    result.counts = { ...chamber.counts }; result.examined = { ...chamber.examined };
    result.total = chamber.counts.A + chamber.counts.B;
    if (!configured(chamber)) return result;
    result.method = chamber.method; result.area = chamber.area; result.depth = chamberInfo(chamber.method).depth; result.dilution = chamber.dilution;
    result.volume = chamber.area * result.depth * 2;
    if (!chamber.examined.A || !chamber.examined.B) return { ...result, reason: 'sides-not-examined' };
    result.ready = true;
    result.value = result.total / result.volume * chamber.dilution;
    const mean = result.total / 2;
    result.differencePercent = mean === 0 ? 0 : Math.abs(chamber.counts.A - chamber.counts.B) / mean * 100;
    result.reason = null;
    return result;
  }

  function undo(raw) {
    const data = restore(raw);
    if (!data) return fail(raw, 'invalid-data');
    if (!data.materialSelected) return fail(raw, 'material-required');
    const previous = data.history.pop();
    if (!previous) return fail(raw, 'empty-history');
    return { changed: true, data: { ...previous, history: data.history } };
  }

  function report(raw, target) {
    const data = restore(raw);
    if (!data) return '';
    if (!data.materialSelected) return 'Material não selecionado.';
    const format = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
    const total = differentialTotal(data);
    const lines = [`Material: ${materialInfo(data.material).name}`, '', `Diferencial de ${differentialDenominator(data)}`, `Células no diferencial: ${total}${targetValid(target) ? ` / meta ${target}` : ''}`];
    if (data.differential.closedLowCellularity) lines.push('Encerrado por baixa celularidade; percentuais baseados no número efetivamente contado.');
    else lines.push(differentialComplete(data, target) ? 'Meta do diferencial atingida.' : 'Diferencial em andamento.');
    if (total === 0) lines.push('Sem células no denominador do diferencial; percentuais não calculados.');
    for (const cell of differentialCells(data)) {
      const count = data.differential.counts[cell.key];
      const percent = cell.excluded ? 'fora do denominador' : total > 0 ? `${format(count / total * 100)}%` : 'percentual não calculado';
      lines.push(`${cell.name}: ${count} (${percent})`);
    }
    if (data.differential.counts.atypical > 0) lines.push('Células atípicas / não classificadas registradas: requerem revisão citológica.');
    lines.push('', 'Contagem em câmara (independente do diferencial)');
    for (const [population, name] of [['nucleated', 'Células nucleadas'], ['rbc', 'Hemácias']]) {
      const result = chamberResult(data, population);
      if (!result.method) { lines.push(`${name}: método não configurado; concentração não calculada.`); continue; }
      lines.push(`${name} — ${chamberInfo(result.method).name}; área por lado ${format(result.area)} mm²; profundidade ${format(result.depth)} mm; FD ${format(result.dilution)}.`);
      lines.push(`Lado A: ${result.counts.A} (${result.examined.A ? 'examinado' : 'não concluído'}); lado B: ${result.counts.B} (${result.examined.B ? 'examinado' : 'não concluído'}).`);
      if (!result.ready) lines.push('Concentração não calculada: conclua a avaliação dos dois lados.');
      else {
        lines.push(`Volume total A + B: ${format(result.volume)} µL; soma contada: ${result.total}.`);
        lines.push(`${name}: ${format(result.value)} células/µL (equivalente a ×10⁶/L).`);
        lines.push(`Diferença entre lados: ${format(result.differencePercent)}%; avaliar conforme o protocolo do laboratório.`);
      }
    }
    lines.push('Este resumo não estabelece diagnóstico.');
    return lines.join('\n');
  }

  return Object.freeze({ MATERIALS, CHAMBERS, create, restore, withCatalog, baseCells, hasProgress, differentialCells, differentialDenominator, differentialTotal, differentialComplete, changeDifferential, finishDifferential, reopenDifferential, setMaterial, updateChamber, changeChamber, setChamberCount, markChamber, resetChamber, chamberResult, undo, report });
});
