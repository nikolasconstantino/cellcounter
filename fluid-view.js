/* Câmara de líquidos e montagem do editor compartilhado do diferencial. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./fluids.js') : root.CellFluids);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CellFluidView = api;
})(typeof window !== 'undefined' ? window : this, function (F) {
  'use strict';
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const format = n => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n);
  const options = (items, value) => items.map(([key, name]) => `<option value="${escape(key)}"${String(key) === String(value) ? ' selected' : ''}>${escape(name)}</option>`).join('');
  const select = (id, title, items, value, disabled = false, extra = '') => `<label class="fluid-field" for="${id}"><span>${title}</span><select id="${id}" ${extra}${disabled ? ' disabled' : ''}>${options(items, value)}</select></label>`;
  const button = (id, text, disabled, extra = '') => `<button id="${id}" type="button" class="button small"${disabled ? ' disabled' : ''} ${extra}>${text}</button>`;
  const materialName = data => F.MATERIALS.find(item => item.key === data.material).name;
  function summary(state) {
    const data = state.fluid, total = F.differentialTotal(data);
    const table = (head, rows) => `<table class="results-table print-table"><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    const row = cells => `<tr>${cells.map((v, i) => i ? `<td>${v}</td>` : `<th scope="row">${v}</th>`).join('')}</tr>`;
    const chamberRows = ['nucleated', 'rbc'].map(population => {
      const r = F.chamberResult(data, population);
      return row([population === 'rbc' ? 'Hemácias' : 'Células nucleadas', r.ready ? `${format(r.value)} células/µL` : 'Não calculado', !r.method ? 'Método não configurado' : `${F.CHAMBERS.find(c => c.key === r.method).name}<br>Área/lado: ${format(r.area)} mm² · profundidade: ${format(r.depth)} mm · FD: ${format(r.dilution)}<br>A: ${r.counts.A} (${r.examined.A ? 'examinado' : 'não concluído'}) · B: ${r.counts.B} (${r.examined.B ? 'examinado' : 'não concluído'})${r.ready ? `<br>Volume A+B: ${format(r.volume)} µL · diferença: ${format(r.differencePercent)}%` : ''}`]);
    }).join('');
    const diffRows = F.differentialCells(data).map(cell => row([escape(cell.name), data.differential.counts[cell.key], cell.excluded ? 'Fora do denominador' : total ? `${format(data.differential.counts[cell.key] / total * 100)}%` : '—'])).join('');
    return `<div class="fluid-report"><p class="fluid-material-title">${materialName(data)}</p><section><h3>Contagem em câmara</h3>${table(['População', 'Concentração', 'Método e avaliação'], chamberRows)}<p class="field-help">Concentração = soma de A e B × fator de diluição ÷ volume total examinado. Diferença entre lados avaliada conforme o protocolo do laboratório.</p></section><section><h3>Diferencial de ${F.differentialDenominator(data)}</h3><p>${total} células contadas · meta ${state.target} · ${data.differential.closedLowCellularity ? 'encerrado por baixa celularidade' : F.differentialComplete(data,state.target) ? 'meta atingida' : 'em andamento'}</p>${table(['Célula', 'Contagem', 'Percentual'], diffRows)}<p class="field-help">${total ? `Percentuais sobre ${total} ${F.differentialDenominator(data)}, com arredondamento.` : 'Sem células no denominador; percentuais não calculados.'}${data.differential.counts.atypical ? ' Células atípicas / não classificadas requerem revisão citológica.' : ''}</p></section></div>`;
  }
  function create(panel, { getState, allowed, canNavigate, apply, confirm, changed, notify }) {
    let tab = 'chamber', population = 'nucleated';
    let currentBlocked = false, currentNavigationBlocked = false, currentEditing = false;
    const doc = panel.ownerDocument;
    const $ = id => doc.getElementById(id);
    function render(blocked = currentBlocked, editing = currentEditing, navigationBlocked = currentNavigationBlocked) {
      currentBlocked = blocked;
      currentNavigationBlocked = navigationBlocked;
      currentEditing = editing;
      const state = getState();
      const isFluid = state.mode === 'fluids';
      const tabs = $('fluid-tabs');
      tabs.hidden = !isFluid;
      for (const control of tabs.querySelectorAll('button')) {
        control.disabled = navigationBlocked;
        control.setAttribute('aria-pressed', String(control.dataset.fluidTab === tab));
      }
      const differentialActive = isFluid && tab === 'differential';
      const closed = isFluid && state.fluid.differential.closedLowCellularity;
      $('fluid-finish-low').hidden = !differentialActive || closed;
      $('fluid-reopen').hidden = !differentialActive || !closed;
      $('fluid-finish-low').disabled = blocked || (isFluid && F.differentialTotal(state.fluid) >= state.target);
      $('fluid-reopen').disabled = blocked;
      panel.hidden = !isFluid || differentialActive;
      if (panel.hidden) return;
      const focused = panel.contains(doc.activeElement) ? doc.activeElement.id : null;
      panel.dataset.area = tab;
      panel.classList.toggle('is-disabled', blocked && !editing);
      const d = state.fluid;
      panel.innerHTML = `<div class="fluid-workspace">${chamber(d,blocked)}</div>`;
      const c = d.chambers[population];
      $('fluid-population').value = population;
      $('fluid-method').value = c.method || '';
      $('fluid-area').value = c.area === null ? '' : String(c.area);
      if (focused && $(focused) && !$(focused).disabled) $(focused).focus({preventScroll:true});
    }
    function chamber(data, blocked) {
      const c=data.chambers[population], r=F.chamberResult(data,population), method=F.CHAMBERS.find(m=>m.key===c.method);
      return `<div class="fluid-chamber-config">${select('fluid-population','População contada',[['nucleated','Células nucleadas'],['rbc','Hemácias']],population,blocked)}${select('fluid-method','Câmara',[['','Selecione a câmara'],...F.CHAMBERS.map(m=>[m.key,m.name])],c.method||'',blocked||c.locked)}${select('fluid-area','Área por lado (mm²)',[['','Selecione a área'],...(method?.areas||[]).map(a=>[a,format(a)])],c.area||'',blocked||c.locked)}<label class="fluid-field" for="fluid-dilution"><span>Fator de diluição</span><input id="fluid-dilution" type="number" min="1" max="1000000" step="any" inputmode="decimal" placeholder="1 = sem diluição" value="${c.dilution??''}"${blocked||c.locked?' disabled':''}></label>${button('fluid-configure','Aplicar método',blocked||c.locked)}</div><p class="field-help">Conte a mesma área em ambos os lados. Informe o fator final de diluição (ex.: 1:20 → 20). ${c.locked?'Para mudar o método, reinicie esta população.':'A concentração só será calculada depois de concluir os dois lados.'}</p><div class="fluid-chamber-grid">${['A','B'].map((side,index)=>`<section class="fluid-side"><div class="fluid-side-title"><h3>Lado ${side}</h3><kbd>${index?'J':'H'}</kbd></div><div class="fluid-counter">${button(`fluid-remove-${side}`,'−',blocked||!method||!c.counts[side],`aria-label="Remover célula do lado ${side}"`)}<label class="sr-only" for="fluid-count-${side}">Contagem do lado ${side}</label><input id="fluid-count-${side}" type="number" min="0" max="1000000" step="1" value="${c.counts[side]}"${blocked||!method?' disabled':''}>${button(`fluid-add-${side}`,'+',blocked||!method,`aria-label="Adicionar célula ao lado ${side}"`)}</div>${button(`fluid-examined-${side}`,c.examined[side]?'✓ Lado examinado':'Concluir este lado',blocked||!method,`aria-pressed="${c.examined[side]}"`)}<p class="field-help">${c.examined[side]?'Resultado considerado no cálculo.':'Confirme também quando contar zero células.'}</p></section>`).join('')}<section class="fluid-concentration" aria-live="polite"><span class="eyebrow">${population==='rbc'?'HEMÁCIAS':'CÉLULAS NUCLEADAS'}</span><strong>${r.ready?format(r.value):'—'}</strong><span>células/µL</span><p>${r.ready?`Volume: ${format(r.volume)} µL · diferença: ${format(r.differencePercent)}%`:'Aguardando avaliação dos dois lados'}</p></section></div><div class="fluid-bottom"><p class="field-help">H e J contam nos lados A e B. Shift corrige. A diferença entre lados deve seguir o protocolo do laboratório.</p>${button('fluid-reset-chamber','Reiniciar esta população',blocked||!c.locked)}</div>`;
    }
    function commit(result, message='Registro atualizado', delta=0) { apply(result,message,delta); }
    function handleAction(event) {
      const el=event.target.closest('button'); if(!el||el.disabled||!allowed())return;
      const state=getState(),d=state.fluid,id=el.id;
      if(id==='fluid-configure') { const result=F.updateChamber(d,{population,method:$('fluid-method').value,area:Number($('fluid-area').value),dilution:Number($('fluid-dilution').value)}); if(!result.changed&&result.reason!=='unchanged')notify('Selecione uma câmara, uma área válida e um fator de diluição igual ou maior que 1.'); commit(result,'Método de câmara definido');return;}
      if(id==='fluid-reset-chamber'){const selected=population;confirm('Reiniciar contagem em câmara?',`Serão zerados os dois lados de ${selected==='rbc'?'hemácias':'células nucleadas'}. O diferencial será mantido.`,()=>commit(F.resetChamber(getState().fluid,selected),'População da câmara reiniciada'));return;}
      if(id==='fluid-finish-low'){confirm('Encerrar por baixa celularidade?',`O diferencial será encerrado com ${F.differentialTotal(d)} células. Os percentuais usarão esse total; com zero células, não serão calculados.`,()=>commit(F.finishDifferential(getState().fluid,getState().target),'Diferencial encerrado por baixa celularidade'));return;}
      if(id==='fluid-reopen'){commit(F.reopenDifferential(d),'Diferencial reaberto');return;}
      const examined=id.match(/^fluid-examined-([AB])$/);if(examined){const side=examined[1];commit(F.markChamber(d,population,side,!d.chambers[population].examined[side]),`Avaliação do lado ${side} atualizada`);return;}
      const match=id.match(/^fluid-(add|remove)-(.+)$/);if(match)record(match[2],match[1]==='add'?1:-1);
    }
    panel.addEventListener('click',handleAction);
    $('fluid-finish-low').addEventListener('click',handleAction);
    $('fluid-reopen').addEventListener('click',handleAction);
    $('fluid-tabs').addEventListener('click',event=>{
      const control = event.target.closest('[data-fluid-tab]');
      if (!control || control.disabled || !canNavigate()) return;
      tab = control.dataset.fluidTab; changed();
    });
    // Counts are saved while typing too; a tab switch cannot discard a typed value.
    panel.addEventListener('input', event => {
      const el = event.target;
      const count = el.id?.match(/^fluid-count-([AB])$/);
      if (!count || !allowed() || el.value.trim() === '') return;
      const value = Number(el.value);
      if (Number.isInteger(value) && value >= 0 && value <= 1000000)
        commit(F.setChamberCount(getState().fluid, population, count[1], value), 'Contagem em câmara atualizada');
    });
    panel.addEventListener('change',event=>{
      const el=event.target;if(!allowed()){render();return;} const d=getState().fluid;
      if(el.id==='fluid-population'){population=el.value==='rbc'?'rbc':'nucleated';render();return;}
      if(el.id==='fluid-method'){const method=F.CHAMBERS.find(m=>m.key===el.value);$('fluid-area').innerHTML=options([['','Selecione a área'],...(method?.areas||[]).map(a=>[a,format(a)])],'');$('fluid-area').value='';return;}
      const count=el.id.match(/^fluid-count-([AB])$/);if(count){const value=el.value.trim()===''?NaN:Number(el.value);const result=F.setChamberCount(d,population,count[1],value);if(!result.changed&&result.reason!=='unchanged')notify('Informe uma contagem inteira entre 0 e 1.000.000.');commit(result,'Contagem em câmara atualizada');render();return;}
    });
    function record(key,delta) {
      if (!allowed() || tab !== 'chamber' || !['A','B'].includes(key)) return;
      commit(F.changeChamber(getState().fluid,population,key,delta),`${delta>0?'+1':'−1'} no lado ${key}`,delta);
    }
    function key(event) {
      if (tab !== 'chamber' || !allowed() || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;
      const side = ({h:'A',j:'B'})[event.key.toLowerCase()];
      if (!side) return false;
      event.preventDefault(); record(side,event.shiftKey?-1:1); return true;
    }
    return {render,key,get tab(){return tab;}};
  }
  return Object.freeze({create,summary});
});
