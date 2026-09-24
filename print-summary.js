/* Relatório de impressão independente do tema e do layout da contagem. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./counter.js') : root.CellCounter, typeof module === 'object' && module.exports ? require('./fluid-view.js') : root.CellFluidView);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CellPrintSummary = api;
})(typeof window !== 'undefined' ? window : this, function (Core, FluidView) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  function applicationURL(address) {
    try {
      const url = new URL(address);
      if (!['https:', 'http:', 'file:'].includes(url.protocol)) return '';
      url.username = ''; url.password = ''; url.search = ''; url.hash = '';
      return url.href;
    } catch (_) { return ''; }
  }

  function render(state, { appName = 'Contador de Células', version = 'v2.4', address = '', now = new Date() } = {}) {
    const total = Core.total(state);
    const duration = Core.sessionDuration(state, now.getTime());
    const elapsed = duration === null
      ? state.timing === null ? 'Não registrada' : 'Ainda não iniciada'
      : Core.formatDuration(duration);
    const row = cell => `<tr${state.counts[cell.key] ? '' : ' class="print-zero"'}><th scope="row">${escape(cell.name)}</th><td>${state.counts[cell.key]}</td><td>${Core.formatPercent(Core.percentage(state, cell.key))}${total ? '%' : ''}</td></tr>`;
    const rows = state.mode === 'marrow'
      ? Core.series(state).map(group => `<tr class="print-series"><th scope="row">${escape(group.name)}</th><td>${group.count}</td><td>${Core.formatPercent(group.percentage)}${total ? '%' : ''}</td></tr>${group.entries.map(row).join('')}`).join('')
      : Core.allCells(state).filter(cell => !cell.excluded).map(row).join('');
    const excluded = Core.allCells(state).filter(cell => cell.excluded);
    const url = applicationURL(address);
    const printedAt = now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const tableHead = '<colgroup><col><col class="print-number-column"><col class="print-percent-column"></colgroup><thead><tr><th scope="col">Célula</th><th scope="col">Contagem</th><th scope="col">Percentual</th></tr></thead>';
    return `<header class="print-header">
      <div><p class="print-eyebrow">HEMATOLOGIA · RESUMO DA SESSÃO</p><h1>${escape(Core.modeInfo(state).name)}</h1></div>
      <span class="print-status">${state.mode === 'fluids' ? 'Câmara · diferencial' : Core.complete(state) ? 'Contagem concluída' : 'Contagem parcial'}</span>
    </header>
    <div class="print-session"><div><span>Sessão</span><strong>${escape(state.sessionLabel.name)} <small>${escape(state.sessionLabel.shortID)}</small></strong></div><div class="print-issued"><span>Emitido em</span><strong>${escape(printedAt)}</strong></div></div>
    <dl class="print-metrics"><div><dt>${state.mode === 'fluids' ? 'Células no diferencial' : 'Células contadas'}</dt><dd>${total}</dd></div><div><dt>Meta de contagem</dt><dd>${state.target}</dd></div><div><dt>Duração da sessão</dt><dd class="print-duration">${escape(elapsed)}</dd></div></dl>
    ${state.mode === 'fluids' ? FluidView.summary(state) : `<table class="print-table${Core.allCells(state).length > 20 ? ' print-table-dense' : ''}">${tableHead}<tbody>${rows || '<tr><td colspan="3">Nenhuma célula no total global.</td></tr>'}</tbody></table>
    ${excluded.length ? `<section class="print-separated"><h2>Contagens separadas</h2><p>Fora do total global e dos percentuais.</p><table class="print-table"><colgroup><col><col class="print-number-column"><col class="print-percent-column"></colgroup><tbody>${excluded.map(cell => `<tr><th scope="row">${escape(cell.name)}</th><td>${state.counts[cell.key]}</td><td>—</td></tr>`).join('')}</tbody></table></section>` : ''}
    <p class="print-note">${total ? `Percentuais calculados sobre ${total} células do total global, com arredondamento.` : 'Percentuais indisponíveis: nenhuma célula registrada no total global.'} A duração inclui pausas. O nome da sessão é um identificador automático para orientação.</p>`}
    ${state.mode === 'fluids' ? '<p class="print-note">A duração inclui pausas e todas as áreas da sessão. O nome automático identifica a sessão para orientação.</p>' : ''}
    <footer class="print-footer"><strong>${escape(appName)} <span>· ${escape(version)}</span></strong>${url ? `<a href="${escape(url)}">${escape(url)}</a>` : '<span>Aplicação executada localmente</span>'}</footer>`;
  }
  return Object.freeze({ render, applicationURL });
});
