/*  Contador de Células - script.js
    - Compatível com o HTML atual (data-key nos cards + ids count-*)
    - Touch-friendly: tocar no card incrementa; long-press decrementa
    - Teclado: tecla incrementa; Shift+tecla decrementa
    - Persistência local: localStorage (sem banco de dados)
*/

(() => {
  'use strict';

  // =========================
  // Configurações
  // =========================
  const TARGET_TOTAL = 100;
  const STORAGE_KEY = 'cellCounterState_v2';
  const LONG_PRESS_MS = 450;

  // Som de finalização (se o arquivo não existir, não quebra)
  const finishSound = new Audio('sounds/finish.mp3');
  finishSound.preload = 'auto';

  // =========================
  // Estado
  // =========================
  let totalCount = 0;             // total SEM eritroblasto
  let eritroCount = 0;            // eritroblasto (separado)
  let finishedAlerted = false;    // evita alert repetido no 100

  // Mapa: key -> { cellEl, countEl, isEritro }
  const cells = new Map();

  // =========================
  // Helpers DOM
  // =========================
  const $ = (sel) => document.querySelector(sel);

  function safeInt(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }

  function setTotalUI() {
    const totalEl = $('#total');
    const totalCounterEl = $('#total-counter');

    if (totalEl) totalEl.textContent = String(totalCount);

    if (totalCounterEl) {
      totalCounterEl.style.color = totalCount >= TARGET_TOTAL ? 'red' : 'black';
    }
  }

  function animateCell(cellEl, mode = 'add') {
    if (!cellEl) return;

    const addClass = 'animate';          // verde (incremento)
    const removeClass = 'animate-remove'; // vermelho (decremento)

    const cls = mode === 'remove' ? removeClass : addClass;

    // garante re-trigger mesmo em cliques rápidos
    cellEl.classList.remove(addClass);
    cellEl.classList.remove(removeClass);
    void cellEl.offsetWidth;

    cellEl.classList.add(cls);
    setTimeout(() => {
      cellEl.classList.remove(addClass);
      cellEl.classList.remove(removeClass);
    }, 300);
  }

  function tryFinish() {
    if (totalCount === TARGET_TOTAL && !finishedAlerted) {
      finishedAlerted = true;
      setTotalUI();
      // tenta tocar som (em alguns navegadores mobile só toca após interação do usuário)
      finishSound.play().catch(() => {});
      //alert('Você já contou 100 células!');
      const modalEl = document.getElementById('finishModal');
      if (modalEl && window.bootstrap?.Modal) {
      const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl, {
       backdrop: 'static',
       keyboard: false
  });
  modal.show();
}
    }
  }

  function updateCountUI(key, value) {
    const meta = cells.get(key);
    if (!meta) return;

    if (meta.isEritro) {
      eritroCount = value;
      // seu HTML usa #eritro-count
      if (meta.countEl) meta.countEl.textContent = String(eritroCount);

      const specificCount = $('#specific-count');
      if (specificCount) specificCount.textContent = String(eritroCount);
      return;
    }

    if (meta.countEl) meta.countEl.textContent = String(value);
  }

  function getCount(key) {
    const meta = cells.get(key);
    if (!meta) return 0;

    if (meta.isEritro) return eritroCount;
    return safeInt(meta.countEl?.textContent ?? '0');
  }

  function setCount(key, newValue) {
    const meta = cells.get(key);
    if (!meta) return;

    const value = Math.max(0, newValue);

    if (meta.isEritro) {
      updateCountUI(key, value);
      saveState();
      return;
    }

    updateCountUI(key, value);
    saveState();
  }

  function increment(key) {
    const meta = cells.get(key);
    if (!meta) return;

    if (meta.isEritro) {
      eritroCount += 1;
      updateCountUI(key, eritroCount);
      animateCell(meta.cellEl, 'add');
      saveState();
      return;
    }

  // Bloqueia incrementos ao atingir o alvo (não ultrapassa 100)
    if (totalCount >= TARGET_TOTAL) {
    tryFinish();
    return;
  }

    const current = getCount(key);
    const next = current + 1;

    updateCountUI(key, next);
    totalCount += 1;
    setTotalUI();
    animateCell(meta.cellEl, 'add');
    tryFinish();
    saveState();
  }

  function decrement(key) {
    const meta = cells.get(key);
    if (!meta) return;

    if (meta.isEritro) {
      if (eritroCount <= 0) return;
      eritroCount -= 1;
      updateCountUI(key, eritroCount);
      animateCell(meta.cellEl, 'remove');
      saveState();
      return;
    }

    const current = getCount(key);
    if (current <= 0) return;

    const next = current - 1;
    updateCountUI(key, next);
    totalCount = Math.max(0, totalCount - 1);
    finishedAlerted = totalCount >= TARGET_TOTAL; // se voltar abaixo de 100, permite alert de novo ao chegar
    setTotalUI();
    animateCell(meta.cellEl, 'remove');
    saveState();
  }

  // =========================
  // Persistência (localStorage)
  // =========================
  function serializeState() {
    const counts = {};
    for (const [key, meta] of cells.entries()) {
      if (meta.isEritro) {
        counts[key] = eritroCount;
      } else {
        counts[key] = getCount(key);
      }
    }

    return {
      version: 2,
      totalCount,
      eritroCount,
      counts,
      finishedAlerted
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
    } catch (_) {
      // se localStorage falhar (modo privado/restrição), não quebra
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;

      // restaura contagens por chave
      if (data.counts && typeof data.counts === 'object') {
        for (const key of Object.keys(data.counts)) {
          if (!cells.has(key)) continue;
          const meta = cells.get(key);
          const value = Math.max(0, safeInt(data.counts[key]));

          if (meta.isEritro) {
            eritroCount = value;
            updateCountUI(key, eritroCount);
          } else {
            updateCountUI(key, value);
          }
        }
      }

      // recalcula total (sem eritro)
      totalCount = 0;
      for (const [key, meta] of cells.entries()) {
        if (meta.isEritro) continue;
        totalCount += getCount(key);
      }

      // flags
      finishedAlerted = Boolean(data.finishedAlerted) || totalCount >= TARGET_TOTAL;

      setTotalUI();
    } catch (_) {
      // ignora estado corrompido
    }
  }

  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  // =========================
  // Setup: descobre células pelo DOM
  // =========================
  function initCellsFromDOM() {
    const cellEls = document.querySelectorAll('.cell[data-key]');
    cellEls.forEach((cellEl) => {
      const key = (cellEl.getAttribute('data-key') || '').toLowerCase().trim();
      if (!key) return;

      // Por padrão, seu padrão é id="count-x"
      // Eritroblasto é especial: id="eritro-count"
      let countEl = cellEl.querySelector(`#count-${CSS.escape(key)}`);

      const isEritro = key === 'p';
      if (isEritro) {
        countEl = $('#eritro-count') || cellEl.querySelector('#eritro-count') || cellEl.querySelector('.count');
      } else {
        // fallback: pega o primeiro .count dentro do card
        if (!countEl) countEl = cellEl.querySelector('.count');
      }

      cells.set(key, { cellEl, countEl, isEritro });
    });
  }

  // =========================
  // Touch / Pointer: tap + long-press
  // =========================
  function attachTouchHandlers() {
    // Usa pointer events (funciona em mouse + touch)
    for (const [key, meta] of cells.entries()) {
      const { cellEl } = meta;
      if (!cellEl) continue;

      let pressTimer = null;
      let longPressed = false;

      const start = (ev) => {
        // se tocou em um botão, não trata como toque no card
        if (ev.target && ev.target.closest && ev.target.closest('button')) return;

        longPressed = false;

        pressTimer = window.setTimeout(() => {
          longPressed = true;
          decrement(key);
          // vibração sutil (se suportado)
          if (navigator.vibrate) navigator.vibrate(15);
        }, LONG_PRESS_MS);
      };

      const end = (ev) => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }

        // Se foi long press, não incrementa
        if (longPressed) return;

        // se soltou em botão, não incrementa pelo card
        if (ev.target && ev.target.closest && ev.target.closest('button')) return;

        increment(key);
      };

      const cancel = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };

      cellEl.addEventListener('pointerdown', start, { passive: true });
      cellEl.addEventListener('pointerup', end, { passive: true });
      cellEl.addEventListener('pointercancel', cancel, { passive: true });
      cellEl.addEventListener('pointerleave', cancel, { passive: true });
    }
  }

  // =========================
  // Teclado: tecla incrementa / Shift+tecla decrementa
  // =========================
  function attachKeyboardHandlers() {
    document.addEventListener('keydown', (event) => {
      // evita repetir se segurar tecla 
      if (event.repeat) return;

      const key = (event.key || '').toLowerCase();
      if (!cells.has(key)) return;

      // Evita que teclas em inputs etc causem efeitos (se no futuro adicionar inputs)
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

      // Ctrl/Cmd + Z para desfazer (simples: desfaz 1 da última tecla pressionada)
      // (Implementação mínima: desfaz da própria tecla atual quando Ctrl/Cmd+Z)
      if ((event.ctrlKey || event.metaKey) && key === 'z') {
        // Sem histórico completo: não dá pra saber qual foi a última célula.
        return;
      }

      if (event.shiftKey) {
        decrement(key);
      } else {
        increment(key);
      }
    });
  }

  // =========================
  // Foco 
  // =========================
  function attachFocusHandlers() {
    window.addEventListener('blur', () => {
      const msg = $('#focus-message');
      const container = $('.container');
      if (msg) msg.style.display = 'flex';
      if (container) container.classList.add('container-blurred');
    });

    window.addEventListener('focus', () => {
      const msg = $('#focus-message');
      const container = $('.container');
      if (msg) msg.style.display = 'none';
      if (container) container.classList.remove('container-blurred');
    });
  }

  // =========================
  // Proteção ao sair (só se existir algo contado)
  // =========================
  function attachBeforeUnload() {
    window.addEventListener('beforeunload', (event) => {
      const hasAny =
        totalCount > 0 ||
        eritroCount > 0 ||
        [...cells.keys()].some((k) => getCount(k) > 0);

      if (!hasAny) return;

      const confirmationMessage = 'A contagem de células será perdida. Deseja continuar?';
      event.returnValue = confirmationMessage;
      return confirmationMessage;
    });
  }

  // =========================
  // API global (onclick inline)
  // =========================
  function incrementCount(key) {
    if (!key) return;
    increment(String(key).toLowerCase());
  }

  function decrementCount(key) {
    if (!key) return;
    decrement(String(key).toLowerCase());
  }

  function resetCount() {
    totalCount = 0;
    eritroCount = 0;
    finishedAlerted = false;

    // zera tudo que existe no DOM
    for (const [key, meta] of cells.entries()) {
      if (meta.isEritro) {
        updateCountUI(key, 0);
      } else if (meta.countEl) {
        meta.countEl.textContent = '0';
      }
    }

    const specificCount = $('#specific-count');
    if (specificCount) specificCount.textContent = '0';

    setTotalUI();
    clearState();
  }

  // Expõe no window para os botões inline funcionarem
  window.incrementCount = incrementCount;
  window.decrementCount = decrementCount;
  window.resetCount = resetCount;

  // =========================
  // Inicialização
  // =========================
  function init() {
    initCellsFromDOM();
    loadState();          // restaura sessão (se existir)
    setTotalUI();

    attachTouchHandlers();
    attachKeyboardHandlers();
    attachFocusHandlers();
    attachBeforeUnload();

    // Foco inicial na página
    window.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
