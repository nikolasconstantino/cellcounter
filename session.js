/* Uma gravação atômica por modo reúne contagem e organização. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./counter.js'), require('./layout.js'));
  else root.CellSession = factory(root.CellCounter, root.CellLayout);
})(typeof window !== 'undefined' ? window : this, function (Core, Layout) {
  'use strict';
  const key = mode => `cellCounterSession_v4_${mode}`;
  function create(mode = 'blood') {
    const state = Core.create(undefined, [], mode);
    return { version: 1, state, layout: Layout.sync(null, state) };
  }
  function restore(data, mode) {
    if (!data || data.version !== 1) return null;
    const state = Core.restore(data.state);
    if (!state || state.mode !== mode) return null;
    const layout = Layout.restore(data.layout);
    return { version: 1, state, layout: Layout.sync(layout, state) };
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
    const catalog = value => Core.allCells(value).map(cell => cell.key).sort().join('|');
    if (catalog(checked) !== catalog(checkedLayout)) throw new Error('Catálogos incompatíveis');
    return JSON.stringify({ version: 1, state: checked, layout: Layout.sync(checkedLayout, checked) });
  }
  return Object.freeze({ key, create, restore, parse, migrate, serialize });
});
