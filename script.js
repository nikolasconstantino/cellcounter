/* Contador de Células 2.4 · Interface e persistência local */
(() => {
  'use strict';
  const Core = window.CellCounter;
  const Layout = window.CellLayout;
  const Session = window.CellSession;
  const PREVIOUS_STORAGE = 'cellCounterState_v3';
  const LEGACY_STORAGE = 'cellCounterState_v2';
  const PREFS_STORAGE = 'cellCounterPrefs_v3';
  const PREVIOUS_LAYOUT = 'cellCounterLayout_v1';
  const MODE_STORAGE = 'cellCounterMode_v1';
  let mode = 'blood';
  let storageKey = Session.key(mode);
  const sessionCache = new Map();
  const $ = id => document.getElementById(id);
  const cells = new Map();
  const dialogs = [...document.querySelectorAll('dialog')];
  const defaults = { theme: 'system', sound: true, countSound: false, finishSound: true, volume: 35, progressColors: true };
  let preferences = { ...defaults };
  let state = Core.create();
  let layout = Layout.create();
  let editingLayout = false;
  let layoutDirty = false;
  let editor = null;
  let editingKey = null;
  let editingGroupId = null;
  const colorPickers = {};
  let newCellShortcut = '';
  let keyConflictAnimation = null;
  let windowFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  let focusShieldVisible = false;
  let deletingCell = null;
  let gridFrame = null;
  let lastStoredRaw = null;
  let restorePending = false;
  let restoreError = false;
  let recoveredExternally = false;
  let dirty = false;
  let storageFailed = false;
  let pendingTarget = null;
  let lastKey = null;
  let lastAction = 'Aguardando a primeira célula';
  let toastTimer;
  let audioContext;
  const finishAudio = new Audio('./sounds/finish.mp3');
  finishAudio.preload = 'auto';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkPreference = window.matchMedia('(prefers-color-scheme: dark)');
  const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  function saveLayout(next) {
    const checked = Layout.restore(next);
    if (!checked) return false;
    if (!commit(state, checked)) return false;
    layoutDirty = dirty;
    $('edit-status').textContent = layoutDirty ? 'Organização aplicada, mas ainda não salva neste navegador.' : 'Organização salva neste navegador.';
    render();
    return true;
  }

  function sizeGrid() {
    gridFrame = null;
    document.documentElement.style.setProperty('--progress-panel-height', `${$('progress').closest('.progress-panel').getBoundingClientRect().height}px`);
    const grid = $('cell-grid');
    if (window.innerWidth < 800) { delete grid.dataset.density; return; }
    const rect = grid.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const spec = Layout.gridSpec(layout.order.length + (editingLayout ? 1 : 0), rect.width, rect.height);
    grid.style.setProperty('--layout-columns', spec.columns);
    grid.style.setProperty('--layout-rows', spec.rows);
    grid.style.setProperty('--layout-gap', `${spec.gap}px`);
    grid.dataset.density = spec.micro ? 'micro' : spec.tight ? 'tight' : spec.dense ? 'dense' : 'normal';
  }

  function scheduleGrid() {
    if (gridFrame === null) gridFrame = window.requestAnimationFrame(sizeGrid);
  }

  function loadPreferences() {
    try {
      const stored = JSON.parse(localStorage.getItem(PREFS_STORAGE) || '{}');
      if (!stored || typeof stored !== 'object') return;
      if (['system', 'light', 'dark'].includes(stored.theme)) preferences.theme = stored.theme;
      for (const key of ['sound', 'countSound', 'finishSound', 'progressColors']) if (typeof stored[key] === 'boolean') preferences[key] = stored[key];
      if (Number.isFinite(stored.volume)) preferences.volume = Math.min(100, Math.max(0, stored.volume));
    } catch (_) { /* As preferências padrão continuam disponíveis. */ }
  }

  function loadSession() {
    ({ state, layout } = Session.create(mode));
    storageKey = Session.key(mode);
    restorePending = false; restoreError = false; recoveredExternally = false;
    dirty = false; layoutDirty = false; storageFailed = false;
    lastStoredRaw = null; lastKey = null; lastAction = 'Aguardando a primeira célula';
    try {
      lastStoredRaw = localStorage.getItem(storageKey);
      let restored;
      if (lastStoredRaw !== null) restored = Session.parse(lastStoredRaw, mode);
      else if (mode === 'blood') {
        const raw = localStorage.getItem(PREVIOUS_STORAGE) ?? localStorage.getItem(LEGACY_STORAGE);
        const previousLayout = localStorage.getItem(PREVIOUS_LAYOUT);
        if (raw === null && previousLayout === null) return;
        restored = Session.migrate(raw, previousLayout);
      } else return;
      if (!restored) { restoreError = true; restorePending = true; return; }
      ({ state, layout } = restored);
      restorePending = Core.hasProgress(state);
      if (restorePending) lastAction = 'Sessão recuperada · escolha continuar ou iniciar outra';
    } catch (_) { storageFailed = true; }
  }

  function switchMode(nextMode) {
    if (!Object.hasOwn(Core.MODES, nextMode) || nextMode === mode || editingLayout || modalOpen()) { $('mode-select').value = mode; return; }
    editor.cancel(); editor.finishSettling(); finishAudio.pause();
    sessionCache.set(mode, { state, layout, lastStoredRaw, restorePending, restoreError, recoveredExternally,
      dirty, layoutDirty, storageFailed, lastKey, lastAction });
    mode = nextMode;
    storageKey = Session.key(mode);
    const cached = sessionCache.get(mode);
    if (cached) ({ state, layout, lastStoredRaw, restorePending, restoreError, recoveredExternally,
      dirty, layoutDirty, storageFailed, lastKey, lastAction } = cached);
    else loadSession();
    try { localStorage.setItem(MODE_STORAGE, mode); } catch (_) {}
    buildCells(true);
    editor.applyOrder(layout.order, false);
    render();
    announce(`${Core.modeInfo(state).name}. ${Core.total(state)} de ${state.target} células.`);
  }

  function describe(entry, undone = false) {
    if (!entry) return 'Aguardando a primeira célula';
    if (entry.type === 'target') return undone ? `Meta restaurada para ${entry.from} células` : `Meta alterada para ${entry.to} células`;
    const name = Core.allCells(state).find(cell => cell.key === entry.key).name;
    return `${undone ? 'Desfeito: ' : ''}${entry.delta > 0 ? '+1' : '−1'} ${name}`;
  }

  function acceptExternal(raw) {
    editor?.cancel();
    editingLayout = false;
    editor?.setEnabled(false);
    dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
    lastStoredRaw = raw;
    const restored = raw === null ? Session.create(mode) : Session.parse(raw, mode);
    recoveredExternally = true;
    restoreError = !restored;
    if (restored) ({ state, layout } = restored);
    buildCells(true);
    editor?.applyOrder(layout.order, false);
    restorePending = true;
    dirty = false;
    layoutDirty = false;
    lastKey = null;
    lastAction = 'A sessão foi alterada em outra aba';
    render();
    announce('A sessão foi alterada em outra aba. Confira os valores e escolha continuar.');
  }

  // Evita sobrescrever uma alteração mais recente feita em outra aba.
  function commit(next, nextLayout = layout) {
    let raw;
    try { raw = Session.serialize(next, nextLayout); }
    catch (_) { toast('Não foi possível aplicar a alteração. A sessão foi mantida.'); return false; }
    try {
      const current = localStorage.getItem(storageKey);
      if (current !== lastStoredRaw) { acceptExternal(current); return false; }
      localStorage.setItem(storageKey, raw);
      lastStoredRaw = raw;
      state = next;
      layout = nextLayout;
      dirty = false;
      layoutDirty = false;
      storageFailed = false;
    } catch (_) {
      state = next;
      layout = nextLayout;
      dirty = true;
      storageFailed = true;
    }
    return true;
  }

  function savePreferences() {
    try {
      localStorage.setItem(PREFS_STORAGE, JSON.stringify(preferences));
      $('preferences-status').textContent = 'Preferências salvas neste navegador.';
    } catch (_) {
      $('preferences-status').textContent = 'As preferências estão ativas, mas não puderam ser salvas.';
    }
    renderPreferences();
  }

  function announce(text) { $('announcer').textContent = text; }

  function toast(text) {
    clearTimeout(toastTimer);
    $('toast').textContent = text;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }

  function icon(button, name) { button.querySelector('use').setAttribute('href', `#i-${name}`); }

  function renderPreferences() {
    if (preferences.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = preferences.theme;
    const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && darkPreference.matches);
    const themeLabel = dark ? 'Usar tema claro' : 'Usar tema escuro';
    $('theme-button').setAttribute('aria-label', themeLabel);
    $('theme-button').title = themeLabel;
    icon($('theme-button'), dark ? 'sun' : 'moon');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#121c19' : '#f4f7f6');
    const soundLabel = preferences.sound ? 'Desativar sons' : 'Ativar sons';
    $('sound-button').setAttribute('aria-label', soundLabel);
    $('sound-button').title = soundLabel;
    $('sound-button').setAttribute('aria-pressed', String(preferences.sound));
    icon($('sound-button'), preferences.sound ? 'volume' : 'muted');
    $('theme-select').value = preferences.theme;
    $('progress-colors-setting').checked = preferences.progressColors;
    $('sound-setting').checked = preferences.sound;
    $('count-sound-setting').checked = preferences.countSound;
    $('finish-sound-setting').checked = preferences.finishSound;
    $('count-sound-setting').disabled = !preferences.sound;
    $('finish-sound-setting').disabled = !preferences.sound;
    $('volume-setting').value = preferences.volume;
    $('volume-setting').disabled = !preferences.sound;
    $('volume-label').textContent = `${preferences.volume}%`;
    $('test-sound').disabled = !preferences.sound;
    if (!preferences.sound) { finishAudio.pause(); finishAudio.currentTime = 0; }
    renderProgress();
  }

  function progressColor(ratio) {
    if (!preferences.progressColors) return 'var(--accent)';
    const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && darkPreference.matches);
    // A mesma escala contínua indica a completude da barra e de cada meta.
    const tones = dark
      ? [[226, 157, 157], [226, 199, 132], [148, 185, 217], [140, 192, 160], [73, 151, 106]]
      : [[226, 164, 163], [232, 206, 139], [151, 193, 222], [156, 204, 172], [46, 112, 81]];
    const position = Math.max(0, Math.min(1, ratio)) * (tones.length - 1);
    const segment = Math.min(tones.length - 2, Math.floor(position));
    const fraction = position - segment;
    const color = tones[segment].map((value, i) => Math.round(value + (tones[segment + 1][i] - value) * fraction));
    return `rgb(${color.join(', ')})`;
  }

  function renderProgress() {
    const total = Core.total(state);
    const ratio = Math.max(0, Math.min(1, total / state.target));
    const color = progressColor(ratio);
    const fill = $('progress-fill');
    fill.style.width = `${ratio * 100}%`;
    fill.style.backgroundColor = color;
    $('progress').style.setProperty('--completion-color', color);
    const options = $('target-options');
    if (options.dataset.mode !== mode) {
      options.innerHTML = Core.modeInfo(state).targets.map(target => `<button class="target-option" type="button" data-target="${target}" aria-pressed="false">
        <span class="target-gauge" aria-hidden="true">
          <svg viewBox="0 0 100 96" focusable="false"><path class="target-arc-track" d="M23.13 74.87 A38 38 0 1 1 76.87 74.87"/><path class="target-arc-fill" d="M23.13 74.87 A38 38 0 1 1 76.87 74.87" pathLength="100"/></svg>
          <span class="target-count">0</span><span class="target-goal">${target}</span>
        </span><span class="target-choice-label" aria-hidden="true">Selecionar</span>
      </button>`).join('');
      options.dataset.mode = mode;
    }
    for (const button of options.querySelectorAll('.target-option')) {
      const target = Number(button.dataset.target);
      const progress = Math.max(0, Math.min(1, total / target));
      const selected = target === state.target;
      const tone = progressColor(progress);
      button.disabled = restorePending || editingLayout;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `Meta de ${target} células: ${total} contadas, ${Math.round(progress * 100)}% concluída`);
      button.title = target < total ? `Meta atingida. O total atual de ${total} células excede este alvo.` : `Selecionar meta de ${target} células`;
      button.style.setProperty('--completion-color', tone);
      const count = button.querySelector('.target-count');
      count.textContent = total;
      count.dataset.digits = String(total).length;
      button.querySelector('.target-choice-label').textContent = selected ? 'Selecionada' : 'Selecionar';
      const arc = button.querySelector('.target-arc-fill');
      arc.style.strokeDashoffset = String(100 - progress * 100);
      arc.style.stroke = tone;
      arc.style.opacity = total ? '1' : '0';
    }
  }

  function updateFocusShield() {
    const visible = !windowFocused || document.visibilityState === 'hidden';
    document.body.classList.toggle('is-unfocused', visible);
    const shield = $('focus-overlay');
    shield.hidden = !visible;
    if (visible !== focusShieldVisible) {
      // O popover mantém o aviso acima de diálogos abertos sem roubar o foco.
      try {
        if (visible && typeof shield.showPopover === 'function') shield.showPopover();
        if (!visible && typeof shield.hidePopover === 'function') shield.hidePopover();
      } catch (_) { /* A camada fixa continua disponível em páginas inativas. */ }
      focusShieldVisible = visible;
    }
  }

  function buildCells(reset = false) {
    if (reset) {
      for (const cell of cells.values()) cell.slot.remove();
      cells.clear();
    }
    for (const definition of Core.allCells(state)) {
      if (cells.has(definition.key)) continue;
      const slot = document.createElement('div');
      slot.className = 'cell-slot';
      slot.dataset.cellId = definition.key;
      const tile = document.createElement('div');
      tile.className = `cell-card${definition.excluded ? ' ery-card' : ''}`;
      tile.dataset.key = definition.key;
      tile.dataset.group = definition.group || '';
      tile.dataset.lineage = definition.lineage || '';
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'cell-add';
      add.setAttribute('aria-keyshortcuts', definition.key);
      const label = definition.excluded
        ? `<span class="ery-top-label"><span class="cell-name">${escapeHTML(definition.shortName || definition.name)}</span><span class="ery-note">Fora do total</span></span>`
        : `<span class="cell-name">${escapeHTML(definition.shortName || definition.name)}</span>`;
      add.innerHTML = `<span class="cell-top">${label}<kbd class="cell-key" aria-hidden="true"></kbd></span><span class="cell-value is-zero"><span class="cell-number-wrap"><span class="cell-number">0</span><span class="cell-deltas" aria-hidden="true"></span></span></span>`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'cell-remove';
      remove.setAttribute('aria-label', `Remover um ${definition.name.toLowerCase()}`);
      remove.setAttribute('aria-keyshortcuts', `Shift+${definition.key}`);
      remove.title = `Remover · Shift + ${definition.key.toUpperCase()}`;
      remove.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-minus"/></svg>';
      const keyEdit = document.createElement('button');
      keyEdit.type = 'button';
      keyEdit.className = 'cell-key-edit';
      keyEdit.hidden = true;
      const keyEditLabel = document.createElement('kbd');
      keyEditLabel.setAttribute('aria-hidden', 'true');
      keyEdit.append(keyEditLabel);
      const editMark = document.createElement('span');
      editMark.className = 'cell-edit-mark';
      editMark.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-pencil"/></svg>';
      keyEdit.append(editMark);
      keyEdit.addEventListener('click', () => showKeyDialog(definition.key));
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'cell-delete';
      deleteButton.hidden = true;
      deleteButton.title = `Excluir ${definition.name}`;
      deleteButton.setAttribute('aria-label', `Excluir célula ${definition.name}`);
      deleteButton.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-trash"/></svg>';
      deleteButton.addEventListener('click', () => showDeleteCell(definition.key));
      tile.append(add, remove, keyEdit, deleteButton);
      slot.append(tile);
      $('cell-grid').append(slot);
      const meta = { ...definition, slot, tile, add, remove, keyEdit, keyEditLabel, deleteButton, keyBadge: add.querySelector('.cell-key'), value: add.querySelector('.cell-value'), number: add.querySelector('.cell-number'), deltas: add.querySelector('.cell-deltas') };
      cells.set(definition.key, meta);
      bindCellInput(meta);
    }
  }

  function render() {
    const n = Core.total(state);
    const finished = Core.complete(state);
    const blocked = state.paused || restorePending || editingLayout;
    document.body.classList.toggle('editing-layout', editingLayout);
    $('count-title').textContent = editingLayout ? 'Editar células' : mode === 'marrow' ? 'Contagem de medula óssea' : 'Contagem diferencial';
    $('count-hint').textContent = mode === 'marrow' ? 'N: neutrófilos · Eo: eosinófilos · Ba: basófilos' : 'Toque para contar · Use as teclas indicadas';
    $('mode-select').value = mode;
    $('mode-select').disabled = editingLayout;
    document.body.dataset.mode = mode;
    document.title = `Contador de Células · ${Core.modeInfo(state).name}`;
    $('count-hint').hidden = editingLayout;
    $('edit-hint').hidden = !editingLayout;
    $('count-controls').hidden = editingLayout;
    $('editor-controls').hidden = !editingLayout;
    $('add-cell-slot').hidden = !editingLayout;
    $('empty-grid').hidden = editingLayout || cells.size > 0;
    $('add-cell-button').disabled = layout.order.length >= Layout.AVAILABLE_KEYS.length;
    $('add-cell-button').title = $('add-cell-button').disabled ? 'Todas as teclas disponíveis estão em uso' : 'Adicionar célula';
    $('last-action').hidden = editingLayout;
    $('edit-status').hidden = !editingLayout;
    $('edit-button').disabled = restorePending;
    document.querySelectorAll('[data-new]').forEach(button => { button.disabled = editingLayout; });
    $('total').textContent = n;
    $('target-label').textContent = state.target;
    $('remaining').textContent = finished ? 'Meta atingida' : `Faltam ${state.target - n}`;
    renderProgress();
    $('progress').setAttribute('aria-valuenow', String(n));
    $('progress').setAttribute('aria-valuemax', String(state.target));
    $('progress').setAttribute('aria-valuetext', `${n} de ${state.target} células`);
    $('state-text').textContent = editingLayout ? 'Edição · contagem suspensa' : restorePending ? (restoreError ? 'Recuperação indisponível' : 'Sessão recuperada') : state.paused ? 'Contagem pausada' : finished ? 'Concluída' : Core.hasProgress(state) ? 'Em contagem' : 'Pronta para contar';
    $('state-label').dataset.status = restorePending ? 'restore' : state.paused ? 'paused' : finished ? 'complete' : 'active';
    $('pause-button').disabled = restorePending || editingLayout;
    $('pause-button').setAttribute('aria-pressed', String(state.paused));
    $('pause-button').querySelector('span').textContent = state.paused ? 'Retomar' : 'Pausar';
    icon($('pause-button'), state.paused ? 'play' : 'pause');
    $('undo-button').disabled = blocked || !state.history.length;
    $('summary-button').disabled = restoreError;
    if ($('new-target').dataset.mode !== mode) {
      $('new-target').innerHTML = Core.modeInfo(state).targets.map(target => `<option value="${target}">${target} células</option>`).join('');
      $('new-target').dataset.mode = mode;
    }
    $('counting').classList.toggle('is-paused', blocked && !editingLayout);
    $('last-action').textContent = lastAction;
    for (const cell of cells.values()) {
      const color = Core.cellColor(state, cell.key);
      cell.tile.dataset.colored = String(Boolean(color));
      cell.tile.style.setProperty('--cell-color', color || 'transparent');
      const value = state.counts[cell.key];
      cell.number.textContent = value;
      cell.value.dataset.digits = Math.min(4, String(value).length);
      cell.value.classList.toggle('is-zero', value === 0);
      const assigned = layout.bindings[cell.key];
      cell.add.disabled = !editingLayout && (blocked || (finished && !cell.excluded));
      cell.add.setAttribute('aria-label', editingLayout ? `${cell.name}. Segure e arraste para mover, ou use Alt e as setas.` : `Adicionar ${cell.name.toLowerCase()}. Contagem: ${value}. Tecla ${assigned.toUpperCase()}.`);
      cell.add.setAttribute('aria-keyshortcuts', assigned);
      cell.add.title = `${cell.name}${cell.excluded ? ' · Fora do total global' : ''} · Tecla ${assigned.toUpperCase()}`;
      cell.remove.setAttribute('aria-keyshortcuts', `Shift+${assigned}`);
      cell.remove.title = `Remover · Shift + ${assigned.toUpperCase()}`;
      cell.remove.hidden = editingLayout;
      cell.keyBadge.textContent = assigned.toUpperCase();
      cell.keyBadge.hidden = editingLayout;
      cell.keyEditLabel.textContent = assigned.toUpperCase();
      cell.keyEdit.setAttribute('aria-label', `Editar nome, tecla e cor de ${cell.name}. Tecla atual: ${assigned.toUpperCase()}`);
      cell.keyEdit.title = `Editar nome, tecla e cor · ${cell.name}`;
      cell.keyEdit.hidden = !editingLayout;
      cell.deleteButton.hidden = !editingLayout;
      cell.remove.disabled = blocked || value === 0;
      cell.tile.dataset.last = String(cell.key === lastKey);
    }
    $('completion-banner').hidden = !finished || restorePending || editingLayout;
    $('restore-banner').hidden = !restorePending;
    $('resume-button').hidden = restoreError;
    if (restorePending) {
      $('restore-title').textContent = restoreError ? 'Não foi possível recuperar a sessão' : recoveredExternally ? 'Sessão alterada em outra aba' : 'Contagem recuperada';
      const date = state.updatedAt ? new Date(state.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
      $('restore-detail').textContent = restoreError
        ? 'Os dados salvos não puderam ser lidos. Inicie uma nova contagem para continuar.'
        : `${Core.modeInfo(state).name} · ${n} de ${state.target} células${date ? ` · ${date}` : ''}.`;
      $('resume-button').textContent = finished ? 'Revisar contagem' : 'Continuar';
    }
    $('save-indicator').dataset.status = storageFailed || layoutDirty ? 'error' : state.updatedAt && !restorePending ? 'saved' : 'idle';
    $('save-label').textContent = layoutDirty ? 'Organização ainda não salva neste navegador' : storageFailed ? (dirty ? 'Alterações ainda não salvas neste navegador' : 'Salvamento indisponível neste navegador') : restorePending ? 'Sessão aguardando confirmação' : state.updatedAt ? 'Salvo neste navegador' : 'Salvamento automático neste navegador';
    $('retry-save').hidden = (!storageFailed && !layoutDirty) || restorePending;
    if ($('summary-dialog').open) renderSummary();
    scheduleGrid();
  }

  function renderSummary() {
    const n = Core.total(state);
    $('summary-title').textContent = Core.complete(state) ? 'Contagem concluída' : 'Resumo parcial';
    $('summary-total').textContent = `${n} células`;
    $('summary-target').textContent = `Meta: ${state.target}`;
    $('summary-mode').textContent = Core.modeInfo(state).name;
    const row = cell => `<tr class="${state.counts[cell.key] === 0 ? 'is-zero' : ''}"><td>${escapeHTML(cell.name)}</td><td>${state.counts[cell.key]}</td><td>${Core.formatPercent(Core.percentage(state, cell.key))}</td></tr>`;
    $('summary-rows').innerHTML = mode === 'marrow'
      ? Core.series(state).map(group => `<tr class="summary-series-row"><th scope="row">${group.name}</th><td>${group.count}</td><td>${Core.formatPercent(group.percentage)}</td></tr>${group.entries.map(row).join('')}`).join('')
      : Core.allCells(state).filter(cell => !cell.excluded).map(row).join('');
    $('summary-excluded').innerHTML = Core.allCells(state).filter(cell => cell.excluded).map(cell => `<div class="ery-summary"><span>${escapeHTML(cell.name)}<small>Fora do total global</small></span><strong>${state.counts[cell.key]}</strong></div>`).join('');
    $('summary-note').textContent = n ? `Percentuais sobre ${n} células do total global, com arredondamento. As contagens separadas ficam fora do denominador.` : 'Os percentuais aparecem após o primeiro registro no total global.';
    $('report-text').value = Core.report(state);
  }

  function modalOpen() { return dialogs.some(dialog => dialog.open); }
  function canCount() { return windowFocused && !editingLayout && !restorePending && !state.paused && !modalOpen() && document.visibilityState !== 'hidden'; }

  function flash(key, delta) {
    const cell = cells.get(key);
    if (!cell) return;
    const marker = document.createElement('span');
    marker.className = `count-delta ${delta > 0 ? 'is-positive' : 'is-negative'}`;
    marker.textContent = delta > 0 ? '+1' : '−1';
    marker.setAttribute('aria-hidden', 'true');
    // Cada ação tem sua própria animação, inclusive em contagens rápidas.
    while (cell.deltas.children.length >= 6) cell.deltas.children[0].remove();
    cell.deltas.append(marker);
    const cleanup = setTimeout(() => marker.remove(), reducedMotion.matches ? 260 : 650);
    marker.addEventListener('animationend', () => { clearTimeout(cleanup); marker.remove(); });
    const tile = cell.tile;
    if (reducedMotion.matches || typeof tile.animate !== 'function') return;
    const style = getComputedStyle(document.documentElement);
    tile.animate([{ backgroundColor: style.getPropertyValue(delta > 0 ? '--tint' : '--danger-bg').trim() }, { backgroundColor: getComputedStyle(tile).backgroundColor }], { duration: 160, easing: 'ease-out' });
  }

  async function tone(delta, force = false) {
    if (!preferences.sound || (!force && !preferences.countSound) || preferences.volume === 0) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext ??= new Audio();
      if (audioContext.state === 'suspended') await audioContext.resume();
      if (!preferences.sound) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(delta > 0 ? 900 : 420, now);
      const duration = delta > 0 ? .045 : .085;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(preferences.volume / 100 * .22, now + .004);
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + duration + .01);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch (_) { /* A contagem não depende de áudio disponível. */ }
  }

  function finishSound() {
    if (!preferences.sound || !preferences.finishSound || preferences.volume === 0) return;
    finishAudio.volume = preferences.volume / 100;
    finishAudio.currentTime = 0;
    finishAudio.play().catch(() => { tone(1, true); });
  }

  function record(key, delta) {
    if (!canCount()) return;
    const result = Core.change(state, key, delta);
    if (!result.changed) {
      if (result.reason === 'complete') toast('Meta atingida. Você pode corrigir ou iniciar uma nova contagem.');
      return;
    }
    const wasFinished = Core.complete(state);
    if (!commit(result.state)) return;
    lastKey = key;
    lastAction = describe(result.entry);
    render();
    flash(key, delta);
    const nowFinished = Core.complete(state);
    if (!wasFinished && nowFinished) {
      finishSound();
      announce(`Contagem concluída: ${Core.total(state)} células. Resultado disponível.`);
    } else {
      tone(delta);
      announce(`${lastAction}. Total: ${Core.total(state)} de ${state.target}.`);
    }
  }

  function undo() {
    if (!canCount()) return;
    const result = Core.undo(state);
    if (!result.changed || !commit(result.state)) return;
    lastKey = result.entry.key || null;
    lastAction = describe(result.entry, true);
    render();
    if (result.entry.type === 'count') { flash(result.entry.key, -result.entry.delta); tone(-result.entry.delta); }
    announce(`${lastAction}. Total: ${Core.total(state)}.`);
  }

  function bindCellInput(cell) {
    let touch = null;
    let suppressClick = false;
    const clearPress = () => { if (touch) clearTimeout(touch.timer); touch = null; };
    cell.add.addEventListener('pointerdown', event => {
      clearPress();
      suppressClick = false;
      if (event.pointerType === 'mouse' || event.isPrimary === false || event.button !== 0 || !canCount()) return;
      const pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, timer: null };
      pointer.timer = setTimeout(() => {
        suppressClick = true;
        record(cell.key, -1);
      }, 500);
      touch = pointer;
    }, { passive: true });
    cell.add.addEventListener('pointermove', event => {
      if (touch && event.pointerId === touch.id && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) {
        suppressClick = true;
        clearPress();
      }
    }, { passive: true });
    cell.add.addEventListener('pointerup', clearPress, { passive: true });
    for (const type of ['pointercancel', 'pointerleave']) cell.add.addEventListener(type, () => {
      if (touch) suppressClick = true;
      clearPress();
    }, { passive: true });
    cell.add.addEventListener('contextmenu', event => { event.preventDefault(); });
    cell.add.addEventListener('click', event => {
      clearPress();
      if (event.detail !== 0 && suppressClick) { suppressClick = false; return; }
      suppressClick = false;
      record(cell.key, 1);
    });
    cell.remove.addEventListener('click', () => { record(cell.key, -1); });
  }

  function openDialog(id) {
    const dialog = $(id);
    if (modalOpen()) return;
    editor?.cancel();
    dialog.showModal();
    document.body.classList.add('has-dialog');
    if (id === 'new-dialog') $('cancel-new').focus();
  }

  function showSummary() {
    if (restoreError) return;
    renderSummary();
    $('copy-fallback').hidden = true;
    $('copy-status').textContent = '';
    openDialog('summary-dialog');
  }

  function showNew() {
    $('new-target').value = String(state.target);
    $('new-description').textContent = restoreError
      ? 'Iniciar uma nova contagem substitui a sessão que não pôde ser recuperada.'
      : Core.hasProgress(state)
        ? `Os ${Core.total(state)} registros do total global e todas as contagens separadas serão zerados. Suas células, posições e teclas serão mantidas.`
        : 'Escolha a meta para começar.';
    $('confirm-new').textContent = Core.hasProgress(state) || restoreError ? 'Zerar e iniciar' : 'Iniciar contagem';
    $('confirm-new').classList.toggle('danger', Core.hasProgress(state) || restoreError);
    $('confirm-new').classList.toggle('primary', !Core.hasProgress(state) && !restoreError);
    $('new-mode-hint').textContent = `${Core.modeInfo(state).name}. Apenas a contagem deste modo será reiniciada.`;
    openDialog('new-dialog');
  }

  function changeTarget(target) {
    const result = Core.setTarget(state, target);
    if (!result.changed) return;
    if (!commit(result.state)) return;
    lastAction = describe(result.entry);
    render();
    announce(lastAction);
  }

  async function copyResult() {
    const text = Core.report(state);
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); copied = true; } catch (_) {}
    }
    if (!copied) {
      $('report-text').value = text;
      $('copy-fallback').hidden = false;
      $('report-text').focus();
      $('report-text').select();
      try { copied = document.execCommand('copy') === true; } catch (_) {}
    }
    $('copy-status').textContent = copied ? 'Resultado copiado.' : 'Selecione e copie o texto acima.';
    if (copied) { $('copy-fallback').hidden = true; $('copy-result').focus(); }
  }

  function downloadCSV() {
    const blob = new Blob([Core.csv(state)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    link.href = url;
    link.download = `contagem-${mode === 'marrow' ? 'medula-ossea' : 'sangue-periferico'}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    $('copy-status').textContent = 'Arquivo CSV preparado para download.';
  }

  function startEditing() {
    if (restorePending || modalOpen()) return;
    editingLayout = true;
    editor.setEnabled(true);
    $('edit-status').textContent = layoutDirty ? 'Organização ainda não salva neste navegador.' : 'Células, grupos, cores e atalhos são salvos neste navegador.';
    render();
    announce('Edição de células. A contagem está suspensa. Segure e arraste para mover.');
  }

  function finishEditing() {
    editor.setEnabled(false);
    editingLayout = false;
    render();
    $('edit-button').focus({ preventScroll: true });
    if (layoutDirty) toast('A organização está ativa, mas ainda não pôde ser salva.');
    announce(state.paused ? 'Edição concluída. A contagem permanece pausada.' : 'Edição concluída. A contagem está disponível.');
  }

  function keyFeedback() {
    if (!editingKey || !cells.has(editingKey)) return;
    const key = Layout.normalizeKey($('key-input').value);
    const renamed = Core.renameCell(state, editingKey, $('edit-cell-name').value);
    const validName = renamed.changed || renamed.reason === 'same';
    $('edit-cell-name').setAttribute('aria-invalid', String(!validName));
    $('edit-name-feedback').dataset.tone = validName ? 'neutral' : 'error';
    $('edit-name-feedback').textContent = validName ? 'Até 40 caracteres.' : renamed.reason === 'duplicate-name' ? 'Já existe uma célula com esse nome.' : 'Informe um nome de até 40 caracteres.';
    $('save-key-button').disabled = !key || !validName || !colorPickers.edit.isValid();
    const conflict = key ? layout.order.find(id => id !== editingKey && layout.bindings[id] === key) : null;
    $('key-feedback').dataset.tone = !key ? 'error' : conflict ? 'warning' : 'success';
    $('key-feedback').textContent = !key ? 'Escolha uma letra (A–Z ou Ç) ou um número de 0 a 9.' : conflict
      ? `${key.toUpperCase()} já pertence a ${cells.get(conflict).name}. Ao confirmar, essa célula passará a usar ${layout.bindings[editingKey].toUpperCase()}.`
      : key === layout.bindings[editingKey] ? 'Esta é a tecla atual.' : 'Tecla disponível.';
    $('save-key-button').textContent = conflict ? 'Salvar e trocar teclas' : 'Salvar alterações';
  }

  function showKeyDialog(id) {
    if (!editingLayout || modalOpen()) return;
    editingKey = id;
    $('key-cell-name').textContent = 'Edite o nome, o atalho e a cor. Os valores contados serão mantidos.';
    $('edit-cell-name').value = cells.get(id).name;
    $('key-input').value = layout.bindings[id].toUpperCase();
    const inheritedColor = state.cellGroups.find(group => group.cellIds.includes(id))?.color || '';
    colorPickers.edit.set(state.cellColors[id] || '', inheritedColor);
    keyFeedback();
    openDialog('key-dialog');
    $('edit-cell-name').focus();
    $('edit-cell-name').select();
  }

  function customCellInput(id = 'custom_preview') {
    return { id, name: $('new-cell-name').value, key: newCellShortcut,
      excluded: $('new-cell-total').value === 'excluded' };
  }

  function newCellFeedback() {
    const result = Layout.add(layout, customCellInput());
    $('confirm-add-cell').disabled = !result.changed || !colorPickers.add.isValid();
    $('new-cell-feedback').dataset.tone = result.changed ? 'success' : 'error';
    $('new-cell-feedback').textContent = result.changed
      ? ($('new-cell-total').value === 'excluded' ? 'Tecla disponível. Esta célula será contada separadamente.' : 'Tecla disponível. Esta célula participará do total global.')
      : result.reason === 'conflict' ? 'Pressione uma tecla disponível para continuar.'
      : result.reason === 'duplicate-name' ? 'Já existe uma célula com esse nome.'
      : result.reason === 'name' ? 'Informe um nome de até 40 caracteres.'
      : result.reason === 'limit' ? 'Todas as teclas disponíveis já estão em uso.'
      : 'Selecione o campo de tecla e pressione uma letra ou número.';
  }

  function captureNewKey(value) {
    const field = $('new-cell-key');
    keyConflictAnimation?.cancel();
    keyConflictAnimation = null;
    const key = Layout.normalizeKey(value);
    newCellShortcut = key || '';
    field.value = value.toUpperCase();
    const conflict = key && layout.order.find(id => layout.bindings[id] === key);
    field.dataset.state = conflict ? 'conflict' : key ? 'ready' : value ? 'invalid' : 'waiting';
    field.setAttribute('aria-invalid', String(Boolean(conflict || (value && !key))));
    $('new-cell-key-status').dataset.tone = conflict || (value && !key) ? 'error' : key ? 'success' : 'neutral';
    $('new-cell-key-status').textContent = conflict
      ? `A tecla ${key.toUpperCase()} já está cadastrada para ${cells.get(conflict).name}. Pressione outra tecla.`
      : key ? `Tecla ${key.toUpperCase()} disponível. Pressione outra para alterar.`
      : value ? 'Use uma letra (A–Z ou Ç) ou um número de 0 a 9.' : 'Selecione o quadrado e pressione uma tecla.';
    if (conflict && !reducedMotion.matches && typeof field.animate === 'function') {
      const style = getComputedStyle(document.documentElement);
      keyConflictAnimation = field.animate([
        { backgroundColor: style.getPropertyValue('--surface').trim(), color: style.getPropertyValue('--ink').trim() },
        { backgroundColor: style.getPropertyValue('--danger-bg').trim(), color: style.getPropertyValue('--danger').trim(), offset: .5 },
        { backgroundColor: style.getPropertyValue('--surface').trim(), color: style.getPropertyValue('--ink').trim() }
      ], { duration: 360, iterations: 3, easing: 'ease-in-out' });
    }
    newCellFeedback();
  }

  function captureKeyDown(event) {
    if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (['Backspace', 'Delete'].includes(event.key)) { event.preventDefault(); captureNewKey(''); return; }
    let key = event.key;
    if (event.shiftKey && /^(Digit|Numpad)[0-9]$/.test(event.code || '')) key = event.code.slice(-1);
    if (key.length !== 1) return; // Tab, Escape e Enter mantêm a navegação nativa.
    event.preventDefault();
    event.stopPropagation();
    captureNewKey(key);
  }

  function showAddCell() {
    if (!editingLayout || modalOpen()) return;
    $('new-cell-name').value = '';
    $('new-cell-total').value = 'included';
    colorPickers.add.set('');
    $('key-picker').hidden = true;
    $('toggle-key-picker').setAttribute('aria-expanded', 'false');
    captureNewKey('');
    openDialog('add-cell-dialog');
    $('new-cell-name').focus();
  }

  function showDeleteCell(id) {
    if (!editingLayout || modalOpen() || !cells.has(id)) return;
    deletingCell = id;
    const cell = cells.get(id);
    const count = state.counts[id];
    $('delete-cell-description').textContent = `Excluir “${cell.name}” de ${Core.modeInfo(state).name.toLowerCase()}? A tecla ${layout.bindings[id].toUpperCase()} ficará disponível.`;
    $('delete-cell-impact').textContent = count
      ? `Esta célula tem ${count} registro${count === 1 ? '' : 's'}, que serão removidos${cell.excluded ? ' da contagem separada' : ' do total global'}. Os demais valores serão mantidos.`
      : 'Esta célula não possui registros. As contagens das outras células serão mantidas.';
    openDialog('delete-cell-dialog');
    $('cancel-delete-cell').focus();
  }

  function selectedGroupMembers() {
    return [...$('group-members').querySelectorAll('.group-cell-checkbox')].filter(input => input.checked).map(input => input.dataset.cellId);
  }

  function groupInput(id = editingGroupId || 'group_preview') {
    return { id, name: $('group-name').value, color: colorPickers.group.getValue(), cellIds: selectedGroupMembers() };
  }

  function groupFeedback() {
    const input = groupInput();
    const result = Core.saveGroup(state, input);
    const valid = colorPickers.group.isValid() && input.cellIds.length > 0 && (result.changed || result.reason === 'same');
    $('save-group-button').disabled = !valid;
    $('group-selection-count').textContent = `${input.cellIds.length} selecionada${input.cellIds.length === 1 ? '' : 's'}`;
    $('group-name').setAttribute('aria-invalid', String(['name', 'duplicate-name'].includes(result.reason)));
    $('group-feedback').dataset.tone = valid ? 'neutral' : 'error';
    $('group-feedback').textContent = !colorPickers.group.isValid() ? 'Escolha uma cor válida para o grupo.'
      : result.reason === 'duplicate-name' ? 'Já existe um grupo com esse nome.'
      : result.reason === 'name' ? 'Informe um nome de até 40 caracteres.'
      : !input.cellIds.length ? 'Selecione pelo menos uma célula.'
      : 'A cor será aplicada no topo dos cartões selecionados.';
    return valid;
  }

  function renderGroupList() {
    $('group-list').innerHTML = state.cellGroups.length ? state.cellGroups.map(group => `<button class="group-list-item" type="button" data-group-id="${escapeHTML(group.id)}" aria-pressed="${group.id === editingGroupId}"><span class="group-color-dot" style="background:${group.color}" aria-hidden="true"></span><span><strong>${escapeHTML(group.name)}</strong><small>${group.cellIds.length} célula${group.cellIds.length === 1 ? '' : 's'}</small></span></button>`).join('')
      : '<p class="field-help">Nenhum grupo neste modo. Crie um para organizar as cores dos cartões.</p>';
  }

  function loadGroup(id = null) {
    const group = state.cellGroups.find(item => item.id === id);
    editingGroupId = group?.id || null;
    $('group-name').value = group?.name || '';
    $('group-cell-search').value = '';
    colorPickers.group.set(group?.color || '#88b8a7');
    $('delete-group-button').hidden = !group;
    $('group-members').innerHTML = Core.allCells(state).map(cell => {
      const currentGroup = state.cellGroups.find(item => item.cellIds.includes(cell.key));
      return `<label class="group-member"><input type="checkbox" class="group-cell-checkbox" data-cell-id="${escapeHTML(cell.key)}"${group?.cellIds.includes(cell.key) ? ' checked' : ''}><span><strong>${escapeHTML(cell.name)}</strong>${currentGroup && currentGroup.id !== editingGroupId ? `<small>${escapeHTML(currentGroup.name)}</small>` : ''}</span></label>`;
    }).join('');
    renderGroupList();
    groupFeedback();
  }

  function applyAppearance(next) {
    if (!commit(next, Layout.sync(layout, next))) return false;
    layoutDirty = dirty;
    render();
    return true;
  }

  function bindGroups() {
    $('groups-button').addEventListener('click', () => {
      if (!editingLayout || modalOpen()) return;
      loadGroup(state.cellGroups[0]?.id);
      openDialog('groups-dialog');
      $('group-name').focus();
    });
    $('new-group-button').addEventListener('click', () => { loadGroup(); $('group-name').focus(); });
    $('group-list').addEventListener('click', event => {
      const button = event.target.closest('.group-list-item');
      if (button) {
        loadGroup(button.dataset.groupId);
        $('group-name').focus();
      }
    });
    $('group-name').addEventListener('input', groupFeedback);
    $('group-members').addEventListener('change', groupFeedback);
    $('group-cell-search').addEventListener('input', () => {
      const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
      const query = normalized($('group-cell-search').value.trim());
      for (const row of $('group-members').querySelectorAll('.group-member')) row.hidden = !normalized(row.querySelector('strong').textContent).includes(query);
    });
    $('group-select-visible').addEventListener('click', () => {
      for (const row of $('group-members').querySelectorAll('.group-member')) if (!row.hidden) row.querySelector('input').checked = true;
      groupFeedback();
    });
    $('group-clear-members').addEventListener('click', () => {
      for (const input of $('group-members').querySelectorAll('input')) input.checked = false;
      groupFeedback();
    });
    $('group-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!editingLayout || !$('groups-dialog').open || !groupFeedback()) return;
      const id = editingGroupId || `group_${window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`}`;
      const result = Core.saveGroup(state, groupInput(id));
      if (!result.changed && result.reason !== 'same') return;
      if (result.changed && !applyAppearance(result.state)) return;
      loadGroup(id);
      $('group-feedback').dataset.tone = dirty ? 'warning' : 'success';
      $('group-feedback').textContent = dirty ? 'Grupo aplicado. Não foi possível salvar neste navegador.' : 'Grupo salvo. As cores dos cartões foram atualizadas.';
      announce('Grupo e cores atualizados.');
    });
    $('delete-group-button').addEventListener('click', () => {
      if (!editingLayout || !$('groups-dialog').open || !editingGroupId) return;
      const result = Core.removeGroup(state, editingGroupId);
      if (!result.changed || !applyAppearance(result.state)) return;
      loadGroup(state.cellGroups[0]?.id);
      $('group-name').focus();
      $('group-feedback').dataset.tone = dirty ? 'warning' : 'success';
      $('group-feedback').textContent = 'Grupo excluído. As células, contagens e cores individuais foram mantidas.';
      announce('Grupo excluído. Células e contagens mantidas.');
    });
  }

  function bindEditing() {
    colorPickers.add = new window.CellColorPicker($('new-cell-color-picker'), { id: 'new-cell-color', onChange: newCellFeedback });
    colorPickers.edit = new window.CellColorPicker($('edit-cell-color-picker'), { id: 'edit-cell-color', onChange: keyFeedback });
    colorPickers.group = new window.CellColorPicker($('group-color-picker'), { id: 'group-color', allowAutomatic: false, onChange: groupFeedback });
    bindGroups();
    editor = new window.CellLayoutEditor({ grid: $('cell-grid'), cells, order: layout.order, reducedMotion,
      onCommit(order) { if (saveLayout({ ...layout, order })) announce('Posição da célula atualizada.'); },
      onStatus(message) { $('edit-status').textContent = message; announce(message); }
    });
    $('edit-button').addEventListener('click', startEditing);
    $('finish-edit-button').addEventListener('click', finishEditing);
    $('restore-layout-button').addEventListener('click', () => openDialog('layout-reset-dialog'));
    $('confirm-reset-layout').addEventListener('click', () => {
      const next = Layout.create(state.customCells, mode, state.deletedCells, state.cellNames, Core.visualSettings(state));
      if (!saveLayout(next)) return;
      editor.applyOrder(next.order);
      $('layout-reset-dialog').close();
      announce('Posições e teclas restauradas. Células personalizadas e contagens mantidas.');
    });
    $('key-input').addEventListener('input', keyFeedback);
    $('edit-cell-name').addEventListener('input', keyFeedback);
    $('key-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!editingLayout || !$('key-dialog').open) return;
      const result = Layout.assign(layout, editingKey, $('key-input').value);
      const renamed = Core.renameCell(state, editingKey, $('edit-cell-name').value);
      if (!colorPickers.edit.isValid() || (!result.changed && result.reason !== 'same') || (!renamed.changed && renamed.reason !== 'same')) { keyFeedback(); return; }
      const colored = Core.setCellColor(renamed.state, editingKey, colorPickers.edit.getValue());
      if (!colored.changed && colored.reason !== 'same') return;
      if (result.changed || renamed.changed || colored.changed) {
        const nextState = colored.state;
        const nextLayout = Layout.sync(result.layout, nextState);
        if (!commit(nextState, nextLayout)) return;
        layoutDirty = dirty;
        editor.finishSettling();
        buildCells(true);
        editor.applyOrder(layout.order, false);
        if (renamed.changed) lastAction = `Nome atualizado: ${cells.get(editingKey).name}`;
        render();
      }
      $('key-dialog').close();
      cells.get(editingKey)?.keyEdit.focus({ preventScroll: true });
      announce('Nome, tecla e cor da célula salvos.');
    });
    $('key-input').addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      let key = event.key;
      if (event.shiftKey && /^(Digit|Numpad)[0-9]$/.test(event.code || '')) key = event.code.slice(-1);
      if (key.length !== 1) return;
      event.preventDefault();
      $('key-input').value = key.toUpperCase();
      keyFeedback();
    });
    $('new-cell-key').addEventListener('keydown', captureKeyDown);
    for (const eventName of ['beforeinput', 'paste', 'drop']) $('new-cell-key').addEventListener(eventName, event => event.preventDefault());
    $('new-cell-key').addEventListener('input', () => { $('new-cell-key').value = newCellShortcut.toUpperCase(); });
    $('new-cell-key').addEventListener('focus', () => {
      if (!newCellShortcut) $('new-cell-key-status').textContent = 'Pressione agora uma letra ou um número.';
    });
    for (const key of Layout.AVAILABLE_KEYS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'key-picker-button';
      button.setAttribute('aria-label', `Selecionar tecla ${key.toUpperCase()}`);
      const keycap = document.createElement('kbd');
      keycap.textContent = key.toUpperCase();
      button.append(keycap);
      button.addEventListener('click', () => { captureNewKey(key); $('new-cell-key').focus({ preventScroll: true }); });
      $('key-picker').append(button);
    }
    $('toggle-key-picker').addEventListener('click', () => {
      $('key-picker').hidden = !$('key-picker').hidden;
      $('toggle-key-picker').setAttribute('aria-expanded', String(!$('key-picker').hidden));
    });
    $('add-cell-dialog').addEventListener('close', () => { keyConflictAnimation?.cancel(); keyConflictAnimation = null; });
    $('add-cell-button').addEventListener('click', showAddCell);
    $('new-cell-name').addEventListener('input', newCellFeedback);
    $('new-cell-total').addEventListener('change', newCellFeedback);
    $('add-cell-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!editingLayout || !$('add-cell-dialog').open || !colorPickers.add.isValid()) return;
      const suffix = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      const result = Layout.add(layout, customCellInput(`custom_${suffix}`));
      if (!result.changed) { newCellFeedback(); return; }
      const next = Core.setCellColor(Core.withCustomCells(state, result.layout.customCells), result.definition.key, colorPickers.add.getValue()).state;
      next.updatedAt = new Date().toISOString();
      if (!commit(next, Layout.sync(result.layout, next))) return;
      buildCells();
      editor.applyOrder(layout.order, true);
      $('add-cell-dialog').close();
      render();
      announce(`${result.definition.name} adicionada. Tecla ${result.definition.defaultShortcut.toUpperCase()}.`);
    });
    $('confirm-delete-cell').addEventListener('click', () => {
      if (!editingLayout || !$('delete-cell-dialog').open || !cells.has(deletingCell)) return;
      const name = cells.get(deletingCell).name;
      const result = Core.removeCell(state, deletingCell);
      const nextLayout = Layout.remove(layout, deletingCell);
      if (!result.changed || !nextLayout.changed || !commit(result.state, nextLayout.layout)) return;
      if (lastKey === deletingCell) lastKey = null;
      lastAction = `${name} excluída da contagem`;
      editor.finishSettling();
      buildCells(true);
      editor.applyOrder(layout.order, false);
      $('delete-cell-dialog').close();
      deletingCell = null;
      render();
      $('add-cell-button').focus({ preventScroll: true });
      announce(`${name} excluída. Os demais valores foram mantidos.`);
    });
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(scheduleGrid);
      observer.observe($('cell-grid'));
      observer.observe($('progress').closest('.progress-panel'));
    }
    window.addEventListener('resize', scheduleGrid);
  }

  function bindControls() {
    $('mode-select').addEventListener('change', event => switchMode(event.target.value));
    $('undo-button').addEventListener('click', undo);
    $('pause-button').addEventListener('click', () => {
      if (restorePending || editingLayout || modalOpen()) return;
      const next = { ...state, paused: !state.paused, updatedAt: new Date().toISOString() };
      if (!commit(next)) return;
      render();
      announce(state.paused ? 'Contagem pausada.' : 'Contagem retomada.');
    });
    $('resume-button').addEventListener('click', () => {
      if (restoreError) return;
      if (!commit({ ...state, paused: false, updatedAt: new Date().toISOString() })) return;
      restorePending = false;
      lastAction = 'Contagem retomada';
      render();
      announce('Contagem retomada.');
    });
    $('retry-save').addEventListener('click', () => {
      if (commit(state)) { render(); if (!dirty && !layoutDirty) toast('Alterações salvas neste navegador.'); }
    });
    for (const id of ['summary-button', 'completion-summary']) $(id).addEventListener('click', showSummary);
    document.querySelectorAll('[data-new]').forEach(button => button.addEventListener('click', showNew));
    $('confirm-new').addEventListener('click', () => {
      if (restoreError) {
        try { localStorage.setItem(`cellCounterRecovery_v4_${mode}`, lastStoredRaw ?? localStorage.getItem(PREVIOUS_STORAGE) ?? localStorage.getItem(LEGACY_STORAGE) ?? ''); } catch (_) {}
      }
      const next = Core.create(Number($('new-target').value), state.customCells, mode, state.deletedCells, state.cellNames, Core.visualSettings(state));
      next.updatedAt = new Date().toISOString();
      if (!commit(next)) return;
      restorePending = false;
      restoreError = false;
      recoveredExternally = false;
      lastKey = null;
      lastAction = 'Nova contagem iniciada';
      finishAudio.pause();
      $('new-dialog').close();
      render();
      announce(`Nova contagem. Meta: ${state.target} células.`);
    });
    $('target-options').addEventListener('click', event => {
      const button = event.target.closest('.target-option');
      if (!button) return;
      const target = Number(button.dataset.target);
      if (restorePending || editingLayout || modalOpen() || !Core.modeInfo(state).targets.includes(target) || target === state.target) return;
      if (target < Core.total(state)) { toast(`Você já contou ${Core.total(state)} células. Escolha uma meta igual ou maior que esse total.`); return; }
      if (!Core.hasProgress(state)) { changeTarget(target); return; }
      pendingTarget = target;
      $('target-description').textContent = `Alterar a meta de ${state.target} para ${target} células? O total atual é ${Core.total(state)}.`;
      openDialog('target-dialog');
    });
    $('confirm-target').addEventListener('click', () => {
      const target = pendingTarget;
      $('target-dialog').close();
      if (target !== null) changeTarget(target);
    });
    $('copy-result').addEventListener('click', copyResult);
    $('download-csv').addEventListener('click', downloadCSV);
    $('settings-button').addEventListener('click', () => { renderPreferences(); openDialog('settings-dialog'); });
    $('help-button').addEventListener('click', () => openDialog('help-dialog'));
    $('info-button').addEventListener('click', () => openDialog('info-dialog'));
    $('sound-button').addEventListener('click', () => { preferences.sound = !preferences.sound; savePreferences(); toast(preferences.sound ? 'Sons ativados' : 'Sons desativados'); });
    $('theme-button').addEventListener('click', () => {
      const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && darkPreference.matches);
      preferences.theme = dark ? 'light' : 'dark';
      savePreferences();
    });
    $('theme-select').addEventListener('change', event => { preferences.theme = event.target.value; savePreferences(); });
    for (const [id, property] of [['sound-setting', 'sound'], ['count-sound-setting', 'countSound'], ['finish-sound-setting', 'finishSound'], ['progress-colors-setting', 'progressColors']]) {
      $(id).addEventListener('change', event => { preferences[property] = event.target.checked; savePreferences(); });
    }
    $('volume-setting').addEventListener('input', event => { preferences.volume = Number(event.target.value); savePreferences(); });
    $('test-sound').addEventListener('click', () => { tone(1, true); });
    darkPreference.addEventListener('change', renderPreferences);
    document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { button.closest('dialog').close(); }));
    dialogs.forEach(dialog => {
      dialog.addEventListener('close', () => {
        if (!modalOpen()) document.body.classList.remove('has-dialog');
        if (dialog.id === 'target-dialog') pendingTarget = null;
      });
    });
    document.addEventListener('keydown', event => {
      const target = event.target;
      // Enter pressionado em um botão nativo também pode repetir cliques.
      if (event.repeat && ['Enter', ' '].includes(event.key) && target instanceof Element && target.closest('.cell-add,.cell-remove')) {
        event.preventDefault();
        return;
      }
      const action = Core.shortcut(event, {
        blocked: !canCount(),
        bindings: layout.bindings,
        editing: target instanceof Element && Boolean(target.closest('input,textarea,select,[role="textbox"]') || target.isContentEditable)
      });
      if (!action) return;
      event.preventDefault();
      if (action.type === 'undo') undo();
      else record(action.key, action.delta);
    });
    window.addEventListener('blur', () => { windowFocused = false; updateFocusShield(); });
    window.addEventListener('focus', () => { windowFocused = true; updateFocusShield(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden' && typeof document.hasFocus === 'function') windowFocused = document.hasFocus();
      updateFocusShield();
    });
    $('focus-return').addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      window.focus();
      windowFocused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
      updateFocusShield();
    });
    window.addEventListener('beforeunload', event => {
      if (!dirty && !layoutDirty && ![...sessionCache].some(([cachedMode, cached]) => cachedMode !== mode && (cached.dirty || cached.layoutDirty))) return;
      event.preventDefault();
      event.returnValue = '';
    });
    window.addEventListener('storage', event => {
      if (event.key === storageKey && event.newValue !== lastStoredRaw) acceptExternal(event.newValue);
      // Limpar os dados em outra aba também exige revisar a sessão.
      if (event.key === null) { sessionCache.clear(); acceptExternal(null); }
      for (const cachedMode of Object.keys(Core.MODES)) if (cachedMode !== mode && event.key === Session.key(cachedMode)) {
        if (!sessionCache.get(cachedMode)?.dirty) sessionCache.delete(cachedMode);
      }
    });
  }

  try {
    const storedMode = localStorage.getItem(MODE_STORAGE);
    if (Object.hasOwn(Core.MODES, storedMode)) mode = storedMode;
  } catch (_) {}
  loadPreferences();
  loadSession();
  buildCells();
  bindControls();
  bindEditing();
  document.querySelectorAll('svg.icon').forEach(svg => svg.setAttribute('aria-hidden', 'true'));
  renderPreferences();
  render();
  updateFocusShield();
})();
