/* Uma gravação atômica por modo reúne contagem e organização. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./counter.js'), require('./layout.js'));
  else root.CellSession = factory(root.CellCounter, root.CellLayout);
})(typeof window !== 'undefined' ? window : this, function (Core, Layout) {
  'use strict';
  const key = mode => `cellCounterSession_v4_${mode}`;
  function create(mode = 'blood', sessionLabel) {
    const state = Core.create(undefined, [], mode, [], {}, undefined, sessionLabel);
    if (mode === 'fluids') state.fluid.materialSelected = false;
    return { version: 1, state, layout: Layout.sync(null, state) };
  }
  function restore(data, mode) {
    if (!data || data.version !== 1) return null;
    const state = Core.restore(data.state);
    if (!state || state.mode !== mode) return null;
    const layout = Layout.restore(data.layout);
    if (mode === 'fluids' && data.layout?.version >= 6 && (!layout || layout.material !== state.fluid.material)) return null;
    return { version: 1, state, layout: mode === 'fluids' ? captureFluidLayout(state, Layout.sync(layout, state)) : Layout.sync(layout, state) };
  }
  function parse(raw, mode) {
    try { return restore(JSON.parse(raw), mode); } catch (_) { return null; }
  }
  function migrate(stateRaw, layoutRaw) {
    let state, layout;
    try { state = stateRaw === null ? Core.create() : Core.restore(JSON.parse(stateRaw)); } catch (_) {}
    if (!state || state.mode !== 'blood') return null;
    try { layout = Layout.restore(JSON.parse(layoutRaw)); } catch (_) {}
    if (layout?.mode === 'blood') state = Core.withCustomCells(state, layout.customCells);
    return { version: 1, state, layout: Layout.sync(layout, state) };
  }
  function serialize(state, layout) {
    const checked = Core.restore(state);
    const checkedLayout = Layout.restore(layout);
    if (!checked || !checkedLayout || checked.mode !== checkedLayout.mode) throw new Error('Sessão inválida');
    if (checked.mode === 'fluids' && checked.fluid.material !== checkedLayout.material) throw new Error('Materiais incompatíveis');
    const catalog = value => Core.allCells(value).map(cell => cell.key).sort().join('|');
    if (catalog(checked) !== catalog(checkedLayout)) throw new Error('Catálogos incompatíveis');
    return JSON.stringify({ version: 1, state: checked, layout: checked.mode === 'fluids' ? captureFluidLayout(checked, checkedLayout) : Layout.sync(checkedLayout, checked) });
  }

  // A preset contains editor settings only. The active state and layout always
  // replace the cached preset together in the same persisted session envelope.
  function captureFluidLayout(state, layout) {
    const checked = Layout.restore(Layout.sync(layout, state));
    if (!checked) throw new Error('Organização de líquidos inválida');
    const { fluidPresets, ...preset } = checked;
    return { ...checked, fluidPresets: { ...fluidPresets, [state.fluid.material]: preset } };
  }

  function switchFluidMaterial(state, layout, material) {
    const unchanged = reason => ({ changed: false, state, layout, reason });
    const checked = Core.restore(state);
    if (!checked || checked.mode !== 'fluids' || !['synovial', 'csf', 'pleural', 'ascitic', 'pericardial'].includes(material)) return unchanged('invalid-material');
    if (checked.paused) return unchanged('paused');
    if (checked.fluid.material === material && checked.fluid.materialSelected) return unchanged('same');
    if (Core.hasProgress(checked)) return unchanged('session-started');
    let current;
    try { current = captureFluidLayout(checked, layout); } catch (_) { return unchanged('invalid-layout'); }
    const preset = current.fluidPresets[material] || Layout.create([], 'fluids', [], {}, undefined, material);
    const next = Core.create(checked.target, preset.customCells, 'fluids', preset.deletedCells, preset.cellNames, Core.visualSettings(preset), checked.sessionLabel, material, checked);
    next.createdAt = checked.createdAt;
    next.updatedAt = new Date().toISOString();
    next.timing = checked.timing;
    const nextLayout = captureFluidLayout(next, { ...preset, fluidPresets: current.fluidPresets });
    return { changed: true, state: next, layout: nextLayout };
  }

  function newFluidCount(state, layout, target, sessionLabel, targetSource = 'preset') {
    const unchanged = reason => ({ changed: false, state, layout, reason });
    const checked = Core.restore(state);
    if (!checked || checked.mode !== 'fluids' || !['preset', 'custom'].includes(targetSource) ||
        (targetSource === 'custom' ? checked.customTarget === null || target !== checked.customTarget : !Core.modeInfo(checked).targets.includes(target))) return unchanged('invalid');
    let current;
    try { current = captureFluidLayout(checked, layout); } catch (_) { return unchanged('invalid-layout'); }
    const next = Core.create(target, checked.customCells, 'fluids', checked.deletedCells, checked.cellNames, Core.visualSettings(checked), sessionLabel, checked.fluid.material, { customTarget: checked.customTarget, targetSource });
    next.fluid.materialSelected = false;
    next.updatedAt = new Date().toISOString();
    return { changed: true, state: next, layout: captureFluidLayout(next, current) };
  }

  function restoreDefaultLayout(state, layout) {
    const unchanged = reason => ({ changed: false, state, layout, reason });
    const checked = Core.restore(state);
    const checkedLayout = Layout.restore(layout);
    if (!checked || !checkedLayout || checked.mode !== checkedLayout.mode ||
        (checked.mode === 'fluids' && checked.fluid.material !== checkedLayout.material)) return unchanged('invalid');
    const result = Core.restoreDefaultCells(state);
    if (!result.changed && result.reason !== 'same') return { ...unchanged(result.reason), requiredSlots: result.requiredSlots };
    const next = result.state;
    const defaults = Layout.create(next.customCells, next.mode, next.deletedCells, next.cellNames, Core.visualSettings(next), next.fluid?.material);
    if (next.mode === 'fluids') defaults.fluidPresets = checkedLayout.fluidPresets;
    return { changed: true, state: next,
      layout: next.mode === 'fluids' ? captureFluidLayout(next, defaults) : defaults,
      restoredIds: result.restoredIds || [] };
  }

  return Object.freeze({ key, create, restore, parse, migrate, serialize, switchFluidMaterial, newFluidCount, restoreDefaultLayout });
});
