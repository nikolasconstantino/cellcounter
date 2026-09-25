/* Contador de Células 2.4 · Interface e persistência local */
(() => {
  'use strict';
  const Core = window.CellCounter;
  const Layout = window.CellLayout;
  const Session = window.CellSession;
  const SessionNames = window.CellSessionNames;
  const PrintSummary = window.CellPrintSummary;
  const Fluids = window.CellFluids;
  const FluidView = window.CellFluidView;
  const Wallpaper = window.CellWallpaper;
  let fluidView;
  let fluidConfirmation = null;
  const PREVIOUS_STORAGE = 'cellCounterState_v3';
  const LEGACY_STORAGE = 'cellCounterState_v2';
  const PREFS_STORAGE = 'cellCounterPrefs_v3';
  const PREVIOUS_LAYOUT = 'cellCounterLayout_v1';
  const MODE_STORAGE = 'cellCounterMode_v1';
  const countingModes = ['blood', 'fluids', 'marrow'];
  let mode = 'blood';
  let storageKey = Session.key(mode);
  const sessionCache = new Map();
  const $ = id => document.getElementById(id);
  const cells = new Map();
  const dialogs = [...document.querySelectorAll('dialog')];
  const defaults = { theme: 'system', sound: true, countSound: false, finishSound: true, milestoneSound: true, volume: 35, progressColors: true, progressMilestones: true, wallpaper: true, wallpaperAutomatic: true, wallpaperIntensity: 35, wallpaperTone: Wallpaper.period(new Date().getHours()) };
  const themeChoices = [
    { value: 'light', label: 'Claro' },
    { value: 'system', label: 'Automático' },
    { value: 'dark', label: 'Escuro' }
  ];
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
  let nameFitSignature = '';
  let nameMeasureContext;
  let lastStoredRaw = null;
  let restorePending = false;
  let restoreError = false;
  let recoveredExternally = false;
  let dirty = false;
  let storageFailed = false;
  let notesCleanupFailed = false;
  let findingsCleanupFailed = false;
  let pendingTarget = null;
  let lastKey = null;
  let lastAction = 'Aguardando a primeira célula';
  let toastTimer;
  let audioContext;
  let milestoneNotice = null;
  let milestoneTimer;
  let milestoneAudioRequest = 0;
  let milestoneAudioSession = null;
  const milestoneOscillators = new Set();
  const finishAudio = new Audio('./sounds/finish.mp3');
  finishAudio.preload = 'auto';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkPreference = window.matchMedia('(prefers-color-scheme: dark)');
  const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

  // As cores personalizadas podem ser muito claras ou escuras nos dois temas.
  function bandInk(color) {
    const channels = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    return luminance > .179 ? '#000000' : '#ffffff';
  }

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
    const home = $('cell-grid-home');
    const bounds = home.getBoundingClientRect();
    if (grid.hidden || home.hidden || bounds.width <= 0) return;
    const scroll = window.innerWidth < 800;
    // A viewport estimate stays stable while the mobile grid grows or the page scrolls.
    const availableHeight = scroll ? Math.max(230, window.innerHeight * .55) : bounds.height;
    if (availableHeight <= 0) return;
    const spec = Layout.gridSpec(layout.order.length + (editingLayout ? 1 : 0), bounds.width, availableHeight, { scroll });
    grid.style.setProperty('--layout-columns', spec.columns);
    grid.style.setProperty('--layout-rows', spec.rows);
    grid.style.setProperty('--layout-gap', `${spec.gap}px`);
    grid.style.setProperty('--layout-cell-width', `${spec.cellWidth}px`);
    grid.style.setProperty('--layout-cell-height', `${spec.cellHeight}px`);
    grid.style.setProperty('--layout-height', `${spec.gridHeight}px`);
    grid.dataset.density = spec.micro ? 'micro' : spec.tight ? 'tight' : spec.dense ? 'dense' : 'normal';
    const detail = spec.cellHeight < 66 ? 'minimal' : spec.cellHeight < 148 || spec.cellWidth < 156 ? 'compact' : 'full';
    grid.dataset.detail = detail;
    for (const { tile } of cells.values()) tile.dataset.detail = detail;
    fitCellNames(grid, grid.getBoundingClientRect());
    fitCellGroups();
  }

  function fitCellGroups() {
    // Reavalia com os grupos visíveis para que reapareçam assim que houver espaço.
    const grouped = [...cells.values()].filter(cell => !cell.groupName.hidden);
    for (const { tile } of grouped) tile.dataset.hideGroup = 'false';
    const fits = grouped.map(({ add, top, metrics }) => {
      const style = getComputedStyle(add);
      const available = add.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      // Dimensões de layout não variam com a animação de rotação do editor.
      return top.offsetHeight + metrics.offsetHeight + parseFloat(style.rowGap) <= available;
    });
    grouped.forEach(({ tile }, index) => { tile.dataset.hideGroup = String(!fits[index]); });
  }

  function fitCellNames(grid, rect) {
    if (!cells.size) return;
    if (nameMeasureContext === undefined) nameMeasureContext = document.createElement('canvas').getContext?.('2d') || null;
    if (!nameMeasureContext) return;
    const preferred = parseFloat(getComputedStyle(grid).getPropertyValue('--cell-name-preferred-size')) || 14;
    const labels = [...cells.values()].map(({ nameLabel }) => ({
      nameLabel, available: nameLabel.clientWidth - 1
    }));
    const signature = [window.innerWidth, window.innerHeight, rect.width, rect.height, grid.dataset.density, grid.dataset.detail,
      editingLayout, preferred, cells.size, ...labels.map(label => label.available)].join('|');
    if (signature === nameFitSignature) return;
    let size = preferred;
    for (const { nameLabel, available } of labels) {
      if (available <= 0) continue;
      const text = nameLabel.textContent.trim().replace(/\s+/g, ' ');
      const style = getComputedStyle(nameLabel);
      nameMeasureContext.font = `${style.fontWeight} ${preferred}px ${style.fontFamily}`;
      const spacing = parseFloat(style.letterSpacing) || 0;
      const spacingWidth = spacing * Math.max(0, [...text].length - 1);
      const width = nameMeasureContext.measureText(text).width;
      if (width > 0) size = Math.min(size, preferred * Math.max(0, available - spacingWidth) / width);
    }
    // A single size, rounded down, keeps every label complete and visually consistent.
    for (let pass = 0; pass < 4; pass++) {
      size = Math.floor(size * 10) / 10;
      grid.style.setProperty('--cell-name-size', `${size}px`);
      let ratio = 1;
      for (const { nameLabel } of cells.values()) {
        if (nameLabel.clientWidth > 1 && nameLabel.scrollWidth > nameLabel.clientWidth) {
          ratio = Math.min(ratio, (nameLabel.clientWidth - 1) / nameLabel.scrollWidth);
        }
      }
      if (ratio === 1) break;
      size *= ratio;
    }
    // A faixa permanece no mesmo lugar; os números se ajustam à área do corpo.
    {
      // Precompute every supported integer length so counting never changes the name fit.
      const sizes = Array(16).fill(Infinity);
      for (const { value } of cells.values()) {
        const style = getComputedStyle(value);
        const base = parseFloat(style.fontSize) || 29;
        const caption = value.querySelector('.cell-caption');
        const captionStyle = caption && getComputedStyle(caption);
        let unitWidth = 0;
        if (captionStyle?.display && captionStyle.display !== 'none') {
          nameMeasureContext.font = `${captionStyle.fontWeight} ${captionStyle.fontSize} ${captionStyle.fontFamily}`;
          unitWidth = nameMeasureContext.measureText('células').width + (parseFloat(style.columnGap) || 6);
        }
        const available = value.clientWidth - unitWidth - (parseFloat(style.paddingRight) || 0) - 2;
        if (available <= 0) continue;
        nameMeasureContext.font = `${style.fontWeight} ${base}px ${style.fontFamily}`;
        sizes.forEach((size, index) => {
          const width = nameMeasureContext.measureText('8'.repeat(index + 1)).width;
          sizes[index] = Math.min(size, base, base * available / width);
        });
      }
      sizes.forEach((size, index) => {
        if (Number.isFinite(size)) grid.style.setProperty(`--cell-count-size-${index + 1}`, `${Math.floor(size * 10) / 10}px`);
      });
    }
    nameFitSignature = signature;
  }

  function scheduleGrid() {
    if (gridFrame === null) gridFrame = window.requestAnimationFrame(sizeGrid);
  }

  function loadPreferences() {
    try {
      const stored = JSON.parse(localStorage.getItem(PREFS_STORAGE) || '{}');
      if (!stored || typeof stored !== 'object') return;
      if (['system', 'light', 'dark'].includes(stored.theme)) preferences.theme = stored.theme;
      for (const key of ['sound', 'countSound', 'finishSound', 'milestoneSound', 'progressColors', 'progressMilestones', 'wallpaper', 'wallpaperAutomatic']) if (typeof stored[key] === 'boolean') preferences[key] = stored[key];
      if (Number.isFinite(stored.volume)) preferences.volume = Math.min(100, Math.max(0, stored.volume));
      if (Number.isFinite(stored.wallpaperIntensity)) preferences.wallpaperIntensity = Math.min(100, Math.max(0, stored.wallpaperIntensity));
      if (Number.isInteger(stored.wallpaperTone) && stored.wallpaperTone >= 0 && stored.wallpaperTone < Wallpaper.PERIODS.length) preferences.wallpaperTone = stored.wallpaperTone;
    } catch (_) { /* As preferências padrão continuam disponíveis. */ }
  }

  function newSessionLabel() {
    const existing = [state.sessionLabel, ...[...sessionCache.values()].map(cached => cached.state.sessionLabel)];
    for (const storedMode of countingModes) {
      try { existing.push(JSON.parse(localStorage.getItem(Session.key(storedMode)))?.state?.sessionLabel); } catch (_) {}
    }
    return SessionNames.generate(existing.filter(label => SessionNames.valid(label)));
  }

  function persistSessionIdentity() {
    if (restoreError || storageFailed) return;
    // Salva também sessões vazias e nomes gerados para contagens de versões anteriores.
    if (Session.serialize(state, layout) !== lastStoredRaw) commit(state);
    // Um nome inicial sem registros não precisa bloquear a saída se o navegador não puder salvá-lo.
    if (!state.updatedAt && !Core.hasProgress(state)) dirty = false;
  }

  function removeLegacyFindings() {
    findingsCleanupFailed = false;
    for (const key of [Session.key('fluids'), 'cellCounterRecovery_v4_fluids']) {
      try {
        const raw = localStorage.getItem(key);
        let data;
        try { data = JSON.parse(raw); } catch (_) { continue; }
        const fluid = data?.state?.fluid;
        if (!fluid || typeof fluid !== 'object') continue;
        let changed = false;
        for (const snapshot of [fluid, ...(Array.isArray(fluid.history) ? fluid.history : [])]) {
          if (snapshot && typeof snapshot === 'object' && Object.hasOwn(snapshot, 'findings')) {
            delete snapshot.findings;
            changed = true;
          }
        }
        if (!changed) continue;
        const cleaned = JSON.stringify(data);
        localStorage.setItem(key, cleaned);
        if (key === storageKey && lastStoredRaw === raw) lastStoredRaw = cleaned;
      } catch (_) { findingsCleanupFailed = true; }
    }
  }

  function removeLegacyNotes() {
    notesCleanupFailed = false;
    removeLegacyFindings();
    // Limpa também o modo ainda não aberto e cópias antigas de migração.
    const entries = [...countingModes.map(value => [Session.key(value), true]), [PREVIOUS_STORAGE, false], [LEGACY_STORAGE, false]];
    for (const [key, wrapped] of entries) {
      try {
        const raw = localStorage.getItem(key);
        let data;
        try { data = JSON.parse(raw); } catch (_) { continue; }
        const savedState = wrapped ? data?.state : data;
        if (!savedState || typeof savedState !== 'object' || !Object.hasOwn(savedState, 'notes')) continue;
        delete savedState.notes;
        const cleaned = JSON.stringify(data);
        localStorage.setItem(key, cleaned);
        if (key === storageKey && lastStoredRaw === raw) lastStoredRaw = cleaned;
      } catch (_) { notesCleanupFailed = true; }
    }
  }

  function loadSession() {
    ({ state, layout } = Session.create(mode, newSessionLabel()));
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
    finally { persistSessionIdentity(); }
  }

  function renderModeControl() {
    const label = Core.modeInfo(mode).name;
    $('mode-select').value = String(countingModes.indexOf(mode));
    $('mode-select').disabled = editingLayout;
    $('mode-select').setAttribute('aria-valuetext', label);
    $('mode-control').dataset.countMode = mode;
    $('count-mode-label').textContent = label;
  }

  function switchMode(nextMode) {
    if (!Object.hasOwn(Core.MODES, nextMode) || nextMode === mode || editingLayout || modalOpen()) { renderModeControl(); return; }
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
    if (entry.type === 'fluid') return undone ? 'Última alteração em líquidos desfeita' : 'Registro em líquidos atualizado';
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
    const restored = raw === null ? Session.create(mode, newSessionLabel()) : Session.parse(raw, mode);
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
    persistSessionIdentity();
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

  function buildWallpaperTones() {
    $('wallpaper-tone-options').innerHTML = Wallpaper.PERIODS.map((period, index) => `<label class="wallpaper-tone" for="wallpaper-tone-${index}"><input id="wallpaper-tone-${index}" type="radio" name="wallpaper-tone" value="${index}"><span class="wallpaper-tone-card"><span class="wallpaper-tone-swatch" aria-hidden="true" style="--tone-light: ${Wallpaper.colorCSS(Wallpaper.periodHSB(index))}; --tone-dark: ${Wallpaper.colorCSS(Wallpaper.periodHSB(index, true))}"></span><span class="wallpaper-tone-name">${escapeHTML(period.label)}</span><small>${escapeHTML(period.hours)}</small></span></label>`).join('');
    for (const input of document.querySelectorAll('input[name="wallpaper-tone"]')) {
      input.addEventListener('change', event => {
        const tone = Number(event.target.value);
        if (!event.target.checked || preferences.wallpaperAutomatic || !preferences.wallpaper || !Number.isInteger(tone) || tone < 0 || tone >= Wallpaper.PERIODS.length) return;
        preferences.wallpaperTone = tone;
        savePreferences();
      });
    }
  }

  function renderPreferences() {
    if (preferences.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = preferences.theme;
    const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && darkPreference.matches);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#15191f' : '#f4f7f6');
    const soundLabel = preferences.sound ? 'Desativar sons' : 'Ativar sons';
    $('sound-button').setAttribute('aria-label', soundLabel);
    $('sound-button').title = soundLabel;
    $('sound-button').setAttribute('aria-pressed', String(preferences.sound));
    icon($('sound-button'), preferences.sound ? 'volume' : 'muted');
    const themePosition = themeChoices.findIndex(choice => choice.value === preferences.theme);
    $('theme-select').value = String(themePosition);
    $('theme-select').setAttribute('aria-valuetext', themeChoices[themePosition].label);
    $('theme-control').dataset.themeMode = preferences.theme;
    $('theme-mode-label').textContent = themeChoices[themePosition].label;
    $('wallpaper-setting').checked = preferences.wallpaper;
    $('wallpaper-controls').hidden = !preferences.wallpaper;
    $('wallpaper-automatic-setting').checked = preferences.wallpaperAutomatic;
    $('wallpaper-intensity-setting').value = preferences.wallpaperIntensity;
    $('wallpaper-intensity-label').textContent = `${preferences.wallpaperIntensity}%`;
    $('wallpaper-intensity-setting').setAttribute('aria-valuetext', `${preferences.wallpaperIntensity}%`);
    $('reset-wallpaper-intensity').disabled = preferences.wallpaperIntensity === defaults.wallpaperIntensity;
    $('wallpaper-tones').hidden = preferences.wallpaperAutomatic;
    for (const input of document.querySelectorAll('input[name="wallpaper-tone"]')) input.checked = Number(input.value) === preferences.wallpaperTone;
    window.CellWallpaperView?.setOptions?.({ automatic: preferences.wallpaperAutomatic, intensity: preferences.wallpaperIntensity, tone: preferences.wallpaperTone });
    window.CellWallpaperView?.setEnabled(preferences.wallpaper);
    $('progress-colors-setting').checked = preferences.progressColors;
    $('progress-milestones-setting').checked = preferences.progressMilestones;
    $('sound-setting').checked = preferences.sound;
    $('count-sound-setting').checked = preferences.countSound;
    $('finish-sound-setting').checked = preferences.finishSound;
    $('milestone-sound-setting').checked = preferences.milestoneSound;
    $('count-sound-setting').disabled = !preferences.sound;
    $('finish-sound-setting').disabled = !preferences.sound;
    $('milestone-sound-setting').disabled = !preferences.sound;
    $('volume-setting').value = preferences.volume;
    $('volume-setting').disabled = !preferences.sound;
    $('volume-label').textContent = `${preferences.volume}%`;
    $('test-sound').disabled = !preferences.sound;
    if (!preferences.sound) { finishAudio.pause(); finishAudio.currentTime = 0; }
    renderProgress();
    scheduleGrid();
  }

  function progressColor(ratio) {
    if (!preferences.progressColors) return 'var(--accent)';
    const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && darkPreference.matches);
    // A mesma escala contínua indica a completude da barra e da meta selecionada.
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
    const inactive = state.paused || restorePending || materialRequired();
    const color = inactive ? 'var(--muted)' : progressColor(ratio);
    const fill = $('progress-fill');
    fill.style.width = `${ratio * 100}%`;
    fill.style.backgroundColor = color;
    $('progress').style.setProperty('--completion-color', color);
    $('progress').classList.toggle('is-paused', inactive);
    const panel = $('progress').closest('.progress-panel');
    panel.classList.toggle('is-disabled', restorePending || materialRequired());
    panel.setAttribute('aria-disabled', String(restorePending || materialRequired()));
    renderMilestones(total, inactive);
    const options = $('target-options');
    if (options.dataset.mode !== mode) {
      const targets = [...Core.modeInfo(state).targets, null];
      options.style.setProperty('--target-options-count', targets.length);
      options.innerHTML = targets.map(target => `<button class="target-option" type="button" data-target="${target ?? ''}"${target === null ? ' data-custom="true"' : ''} aria-pressed="false">
        <span class="target-gauge" aria-hidden="true">
          <svg viewBox="0 0 100 96" focusable="false"><path class="target-arc-track" d="M23.13 74.87 A38 38 0 1 1 76.87 74.87"/><path class="target-arc-fill" d="M23.13 74.87 A38 38 0 1 1 76.87 74.87" pathLength="100"/></svg>
          <span class="target-count"></span><span class="target-goal">${target ?? 'Definir'}</span>
        </span>
      </button>`).join('');
      options.dataset.mode = mode;
    }
    for (const button of options.querySelectorAll('.target-option')) {
      const custom = button.dataset.custom === 'true';
      if (custom) button.dataset.target = state.customTarget == null ? '' : String(state.customTarget);
      const target = Number(button.dataset.target);
      const unset = custom && !target;
      const progress = unset ? 0 : Math.max(0, Math.min(1, total / target));
      const selected = !unset && target === state.target && (custom === (state.targetSource === 'custom'));
      const tone = selected ? color : 'var(--muted)';
      button.disabled = state.paused || restorePending || editingLayout || materialRequired();
      button.classList.toggle('is-unset', unset);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', unset ? 'Definir meta personalizada' : `${custom ? 'Editar meta personalizada' : 'Meta'} de ${target} células: ${total} contadas, ${Math.round(progress * 100)}% concluída`);
      button.title = custom ? (unset ? 'Definir meta personalizada' : `Editar meta personalizada de ${target} células`) : target < total ? `Meta atingida. O total atual de ${total} células excede este alvo.` : `Selecionar meta de ${target} células`;
      button.style.setProperty('--completion-color', tone);
      const count = button.querySelector('.target-count');
      count.textContent = unset ? '+' : selected ? gaugeNumber(total) : '';
      count.classList.toggle('is-placeholder', !unset && !selected);
      count.dataset.digits = Math.min(4, String(count.textContent).length);
      const goal = button.querySelector('.target-goal');
      goal.textContent = unset ? 'Definir' : gaugeNumber(target);
      goal.dataset.long = String(goal.textContent.length > 6);
      const arc = button.querySelector('.target-arc-fill');
      arc.style.strokeDashoffset = String(100 - progress * 100);
      arc.style.stroke = tone;
      arc.style.opacity = !unset && total ? '1' : '0';
    }
  }

  function clearMilestoneNotice() {
    clearTimeout(milestoneTimer);
    milestoneNotice = null;
  }

  function sameMilestoneSession(snapshot) {
    return snapshot && snapshot.mode === mode && snapshot.target === state.target && snapshot.session === state.sessionLabel.shortID;
  }

  function renderMilestones(total, inactive) {
    const points = [...Core.milestones(state), state.target];
    const visible = preferences.progressMilestones && points.length > 1;
    const segments = $('progress-segments');
    const labels = $('progress-milestones');
    const feedback = $('progress-milestone-feedback');
    const signature = points.join(',');
    if (segments.dataset.signature !== signature) {
      let previous = 0;
      segments.innerHTML = points.map(value => {
        const weight = value - previous;
        previous = value;
        return `<span class="progress-segment" data-value="${value}" style="flex:${weight}"><span class="progress-segment-fill"></span></span>`;
      }).join('');
      labels.innerHTML = points.map(value => `<span class="progress-milestone-label" data-value="${value}" style="left:${value / state.target * 100}%" title="${value} células">${gaugeNumber(value)}</span>`).join('');
      segments.dataset.signature = signature;
    }
    const unavailable = inactive || editingLayout || Core.complete(state) || (mode === 'fluids' && fluidView?.tab !== 'differential');
    if (milestoneNotice && (!visible || unavailable || !sameMilestoneSession(milestoneNotice) || total < milestoneNotice.value)) clearMilestoneNotice();
    if (!preferences.sound || !preferences.milestoneSound || preferences.volume === 0 || unavailable ||
        (milestoneAudioSession && (!sameMilestoneSession(milestoneAudioSession) || total < milestoneAudioSession.value))) stopMilestoneSound();
    $('progress').classList.toggle('is-segmented', visible);
    segments.hidden = !visible;
    $('progress-fill').hidden = visible;
    $('progress-milestone-detail').hidden = !visible;
    $('progress-milestone-detail').classList.toggle('is-paused', inactive);
    labels.hidden = !visible || Boolean(milestoneNotice);
    feedback.hidden = !visible || !milestoneNotice;
    feedback.textContent = milestoneNotice ? `✓ Marco de ${milestoneNotice.value} células atingido` : '';
    let previous = 0;
    for (const segment of segments.querySelectorAll('.progress-segment')) {
      const value = Number(segment.dataset.value);
      segment.querySelector('.progress-segment-fill').style.width = `${Math.max(0, Math.min(1, (total - previous) / (value - previous))) * 100}%`;
      segment.classList.toggle('is-milestone', milestoneNotice?.value === value);
      previous = value;
    }
    for (const label of labels.querySelectorAll('.progress-milestone-label')) label.classList.toggle('is-reached', total >= Number(label.dataset.value));
  }

  function gaugeNumber(value) {
    return value < 10000 ? String(value) : new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
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
    nameFitSignature = '';
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
      const label = `<span class="cell-heading${definition.excluded ? ' ery-top-label' : ''}"><span class="cell-name">${escapeHTML(definition.shortName || definition.name)}</span><span class="cell-group-name" hidden></span>${definition.excluded ? '<span class="ery-note">Fora do total</span>' : ''}</span>`;
      add.innerHTML = `<span class="cell-top">${label}<kbd class="cell-key" aria-hidden="true"></kbd></span><span class="cell-metrics"><span class="cell-value is-zero"><span class="cell-number-wrap"><span class="cell-number">0</span><span class="cell-deltas" aria-hidden="true"></span></span><span class="cell-caption" aria-hidden="true">células</span></span><span class="cell-share" aria-hidden="true"><span class="cell-share-track"><span class="cell-share-fill"></span></span><span class="cell-percent">—</span></span></span>`;
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
      const meta = { ...definition, slot, tile, add, remove, keyEdit, keyEditLabel, deleteButton, nameLabel: add.querySelector('.cell-name'), groupName: add.querySelector('.cell-group-name'), top: add.querySelector('.cell-top'), metrics: add.querySelector('.cell-metrics'), keyBadge: add.querySelector('.cell-key'), value: add.querySelector('.cell-value'), number: add.querySelector('.cell-number'), caption: add.querySelector('.cell-caption'), deltas: add.querySelector('.cell-deltas'), share: add.querySelector('.cell-share'), shareFill: add.querySelector('.cell-share-fill'), percent: add.querySelector('.cell-percent') };
      cells.set(definition.key, meta);
      bindCellInput(meta);
    }
  }

  function render() {
    const n = Core.total(state);
    const finished = Core.complete(state);
    const navigationBlocked = state.paused || restorePending || editingLayout;
    const needsMaterial = materialRequired();
    const blocked = navigationBlocked || needsMaterial;
    document.body.classList.toggle('editing-layout', editingLayout);
    $('count-title').textContent = editingLayout ? 'Editar células' : mode === 'fluids' ? 'Contagem de líquidos nobres' : mode === 'marrow' ? 'Contagem de medula óssea' : 'Contagem diferencial';
    $('session-name').textContent = state.sessionLabel.name;
    $('session-name').setAttribute('aria-label', `Sessão: ${state.sessionLabel.name}`);
    $('session-code').textContent = state.sessionLabel.shortID;
    $('session-code').setAttribute('aria-label', `Código da sessão: ${state.sessionLabel.shortID}`);
    $('count-hint').textContent = mode === 'fluids' ? needsMaterial ? 'Escolha o material para liberar a contagem' : fluidView?.tab === 'differential' ? `Diferencial de ${Fluids.differentialDenominator(state.fluid)} · porcentagens sobre as células contadas` : 'Câmara e diferencial · contagens independentes' : mode === 'marrow' ? 'N: neutrófilos · Eo: eosinófilos · Ba: basófilos' : 'Toque para contar · Use as teclas indicadas';
    renderModeControl();
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
    const fluidOther = mode === 'fluids' && fluidView?.tab !== 'differential';
    $('edit-button').disabled = restorePending || fluidOther || needsMaterial;
    $('edit-button').hidden = fluidOther;
    $('cell-grid-home').hidden = fluidOther;
    $('cell-grid').hidden = fluidOther || needsMaterial;
    $('fluid-material-empty').hidden = !needsMaterial;
    $('fluid-material-field').hidden = mode !== 'fluids';
    if (mode === 'fluids') {
      $('fluid-material').value = needsMaterial ? '' : state.fluid.material;
      $('fluid-material').disabled = navigationBlocked || Core.hasProgress(state);
      $('fluid-material').title = Core.hasProgress(state) ? 'Inicie uma nova contagem para mudar o material.' : 'Organização das células salva separadamente por material.';
    }
    fluidView?.render(blocked, editingLayout, blocked);
    $('progress').closest('.progress-overview').hidden = fluidOther;
    $('fluid-progress-context').hidden = !fluidOther;
    $('fluid-progress-context').textContent = needsMaterial ? 'Selecione o material para começar' : restorePending ? 'Sessão aguardando confirmação' : state.paused ? 'Contagem pausada' : mode === 'fluids' ? `${Fluids.MATERIALS.find(m => m.key === state.fluid.material).name} · Contagem em câmara` : '';
    $('target-options').closest('.target-selector').hidden = mode === 'fluids' && fluidView?.tab !== 'differential';
    $('target-options-label').textContent = mode === 'fluids' ? 'META DO DIFERENCIAL' : 'META DE CONTAGEM';
    document.querySelectorAll('[data-new]').forEach(button => {
      button.disabled = editingLayout || ((restorePending || needsMaterial) && !button.closest('#restore-banner'));
    });
    $('total').textContent = n;
    $('target-label').textContent = state.target;
    $('remaining').textContent = mode === 'fluids' && state.fluid.differential.closedLowCellularity ? 'Baixa celularidade' : finished ? 'Meta atingida' : `Faltam ${state.target - n}`;
    renderProgress();
    $('progress').setAttribute('aria-valuenow', String(n));
    $('progress').setAttribute('aria-valuemax', String(state.target));
    $('progress').setAttribute('aria-valuetext', `${n} de ${state.target} células`);
    $('state-text').textContent = needsMaterial ? 'Selecione o material' : editingLayout ? 'Edição · contagem suspensa' : restorePending ? (restoreError ? 'Recuperação indisponível' : 'Sessão recuperada') : state.paused ? 'Contagem pausada' : finished ? 'Concluída' : Core.hasProgress(state) ? 'Em contagem' : 'Pronta para contar';
    $('state-label').dataset.status = restorePending ? 'restore' : state.paused ? 'paused' : finished ? 'complete' : 'active';
    $('pause-button').disabled = restorePending || editingLayout || needsMaterial;
    $('pause-button').setAttribute('aria-pressed', String(state.paused));
    $('pause-button').querySelector('span').textContent = state.paused ? 'Retomar' : 'Pausar';
    icon($('pause-button'), state.paused ? 'play' : 'pause');
    $('undo-button').disabled = blocked || !state.history.length;
    $('summary-button').disabled = restorePending || restoreError || needsMaterial;
    const targetSignature = `${mode}:${state.customTarget ?? ''}`;
    if ($('new-target').dataset.signature !== targetSignature) {
      $('new-target').innerHTML = Core.modeInfo(state).targets.map(target => `<option value="${target}">${target} células</option>`).join('')
        + (state.customTarget ? `<option value="custom">${state.customTarget} células · personalizada</option>` : '');
      $('new-target').dataset.signature = targetSignature;
    }
    $('counting').classList.toggle('is-paused', blocked && !editingLayout);
    $('last-action').textContent = lastAction;
    const groupNames = new Map();
    for (const group of state.cellGroups || []) for (const id of group.cellIds) groupNames.set(id, group.name);
    const totalDescription = `${n} ${n === 1 ? 'célula contada' : 'células contadas'}`;
    for (const cell of cells.values()) {
      const color = Core.cellColor(state, cell.key);
      cell.tile.dataset.colored = String(Boolean(color));
      cell.tile.style.setProperty('--cell-color', color || 'transparent');
      cell.tile.style.setProperty('--cell-color-ink', color ? bandInk(color) : 'var(--muted)');
      const value = state.counts[cell.key];
      cell.number.textContent = value;
      cell.caption.textContent = value === 1 ? 'célula' : 'células';
      cell.value.dataset.digits = String(value).length;
      cell.value.style.setProperty('--cell-number-size', `var(--cell-count-size-${String(value).length},1em)`);
      cell.value.classList.toggle('is-zero', value === 0);
      const groupName = groupNames.get(cell.key) || '';
      cell.groupName.textContent = groupName;
      cell.groupName.setAttribute('title', groupName);
      cell.groupName.hidden = !groupName;
      const share = !cell.excluded && n > 0 ? value / n * 100 : null;
      const percent = share === null ? '—' : `${Core.formatPercent(share)}%`;
      cell.share.hidden = cell.excluded === true;
      cell.shareFill.style.width = `${share === null ? 0 : Math.min(100, Math.max(0, share))}%`;
      cell.percent.textContent = percent;
      const groupDescription = groupName ? ` Grupo: ${groupName}.` : '';
      const shareDescription = cell.excluded ? 'Fora do total.' : n > 0 ? `${percent} do total de ${totalDescription}.` : 'Percentual indisponível: nenhuma célula incluída contada.';
      const assigned = layout.bindings[cell.key];
      cell.add.disabled = !editingLayout && (blocked || (mode === 'fluids' && state.fluid.differential.closedLowCellularity) || (finished && !cell.excluded));
      cell.add.setAttribute('aria-label', editingLayout ? `${cell.name}.${groupDescription} Segure e arraste para mover, ou use Alt e as setas.` : `Adicionar ${cell.name.toLowerCase()}. Contagem: ${value}.${groupDescription} ${shareDescription} Tecla ${assigned.toUpperCase()}.`);
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
    $('completion-banner').hidden = mode === 'fluids' || !finished || restorePending || editingLayout;
    $('restore-banner').hidden = !restorePending;
    $('resume-button').hidden = restoreError;
    if (restorePending) {
      $('restore-title').textContent = restoreError ? 'Não foi possível recuperar a sessão' : recoveredExternally ? 'Sessão alterada em outra aba' : 'Contagem recuperada';
      const date = state.updatedAt ? new Date(state.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
      $('restore-detail').textContent = restoreError
        ? 'Os dados salvos não puderam ser lidos. Inicie uma nova contagem para continuar.'
        : `${Core.modeInfo(state).name}${mode === 'fluids' ? ' · câmara e diferencial recuperados' : ` · ${n} de ${state.target} células`}${date ? ` · ${date}` : ''}.`;
      $('resume-button').textContent = finished ? 'Revisar contagem' : 'Continuar';
    }
    renderStorageStatus();
    if ($('summary-dialog').open) renderSummary();
    scheduleGrid();
  }

  function renderStorageStatus() {
    $('save-indicator').dataset.status = notesCleanupFailed || findingsCleanupFailed || storageFailed || layoutDirty ? 'error' : state.updatedAt && !restorePending ? 'saved' : 'idle';
    $('save-label').textContent = findingsCleanupFailed ? 'Não foi possível limpar dados antigos deste navegador' : notesCleanupFailed ? 'Não foi possível remover observações antigas deste navegador' : layoutDirty ? 'Organização ainda não salva neste navegador' : storageFailed ? (dirty ? 'Alterações ainda não salvas neste navegador' : 'Salvamento indisponível neste navegador') : restorePending ? 'Sessão aguardando confirmação' : state.updatedAt ? 'Salvo neste navegador' : 'Salvamento automático neste navegador';
    $('retry-save').hidden = (!notesCleanupFailed && !findingsCleanupFailed && !storageFailed && !layoutDirty) || restorePending;
  }

  function renderSummary() {
    const n = Core.total(state);
    $('summary-title').textContent = mode === 'fluids' ? 'Resumo de líquidos nobres' : Core.complete(state) ? 'Contagem concluída' : 'Resumo parcial';
    $('summary-total').textContent = `${n} células`;
    $('summary-target').textContent = `Meta: ${state.target}`;
    const duration = Core.sessionDuration(state);
    $('summary-duration').textContent = duration === null
      ? state.timing === null ? 'Não registrada nesta sessão' : 'Ainda não iniciada'
      : Core.formatDuration(duration);
    $('summary-mode').textContent = Core.modeInfo(state).name;
    $('summary-session-name').textContent = state.sessionLabel.name;
    $('summary-session-id').textContent = state.sessionLabel.shortID;
    const row = cell => `<tr class="${state.counts[cell.key] === 0 ? 'is-zero' : ''}"><td>${escapeHTML(cell.name)}</td><td>${state.counts[cell.key]}</td><td>${Core.formatPercent(Core.percentage(state, cell.key))}</td></tr>`;
    $('summary-rows').innerHTML = mode === 'marrow'
      ? Core.series(state).map(group => `<tr class="summary-series-row"><th scope="row">${group.name}</th><td>${group.count}</td><td>${Core.formatPercent(group.percentage)}</td></tr>${group.entries.map(row).join('')}`).join('')
      : Core.allCells(state).filter(cell => !cell.excluded).map(row).join('');
    $('summary-excluded').innerHTML = Core.allCells(state).filter(cell => cell.excluded).map(cell => `<div class="ery-summary"><span>${escapeHTML(cell.name)}<small>Fora do total global</small></span><strong>${state.counts[cell.key]}</strong></div>`).join('');
    $('fluid-summary').hidden = mode !== 'fluids';
    $('summary-cell-table').hidden = mode === 'fluids';
    $('summary-excluded').hidden = mode === 'fluids';
    $('summary-total').textContent = mode === 'fluids' ? `${n} células no diferencial` : `${n} células`;
    $('summary-duration').parentElement.title = mode === 'fluids' ? 'Tempo desde o primeiro registro, incluindo pausas e as duas áreas da sessão.' : 'Tempo desde a primeira célula, incluindo pausas, até atingir a meta.';
    $('fluid-summary').innerHTML = mode === 'fluids' ? FluidView.summary(state) : '';
    $('summary-note').textContent = mode === 'fluids' ? 'Câmara e diferencial são contagens independentes. A duração inclui pausas e continua enquanto a sessão estiver aberta.' : n ? `Percentuais sobre ${n} células do total global, com arredondamento. As contagens separadas ficam fora do denominador.` : 'Os percentuais aparecem após o primeiro registro no total global.';
    $('report-text').value = Core.report(state);
  }

  function modalOpen() { return dialogs.some(dialog => dialog.open); }
  function materialRequired() { return mode === 'fluids' && state.fluid.materialSelected === false; }
  function canInteract() { return windowFocused && !editingLayout && !restorePending && !state.paused && !modalOpen() && document.visibilityState !== 'hidden'; }
  function canCount() { return canInteract() && !materialRequired(); }

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
    const feedbackColor = delta > 0
      ? Core.cellColor(state, key) || style.getPropertyValue('--tint').trim()
      : style.getPropertyValue('--danger-bg').trim();
    cell.flashAnimation?.cancel();
    cell.flashAnimation = tile.animate([{ backgroundColor: feedbackColor }, { backgroundColor: getComputedStyle(tile).backgroundColor }], { duration: 160, easing: 'ease-out' });
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
      // Zero identifica a negação: um tom descendente, distinto dos registros.
      oscillator.type = delta === 0 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(delta === 0 ? 240 : delta > 0 ? 900 : 420, now);
      const duration = delta === 0 ? .16 : delta > 0 ? .045 : .085;
      if (delta === 0) oscillator.frequency.exponentialRampToValueAtTime(120, now + duration);
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

  function stopMilestoneSound() {
    milestoneAudioRequest++;
    milestoneAudioSession = null;
    for (const oscillator of milestoneOscillators) {
      try { oscillator.stop(); } catch (_) { /* A nota pode já ter terminado. */ }
    }
    milestoneOscillators.clear();
  }

  async function playMilestoneSound(value) {
    stopMilestoneSound();
    const request = milestoneAudioRequest;
    milestoneAudioSession = { value, mode, target: state.target, session: state.sessionLabel.shortID };
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audioContext ??= new Audio();
      if (audioContext.state === 'suspended') await audioContext.resume();
      if (request !== milestoneAudioRequest || !preferences.sound || !preferences.milestoneSound || preferences.volume === 0 || !canCount()) return;
      for (const [index, frequency] of [659.25, 880].entries()) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const start = audioContext.currentTime + index * .105;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(preferences.volume / 100 * .16, start + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .13);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        milestoneOscillators.add(oscillator);
        oscillator.onended = () => { milestoneOscillators.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start);
        oscillator.stop(start + .15);
      }
    } catch (_) { /* O aviso visual e a contagem continuam sem áudio. */ }
  }

  function notifyMilestone(value) {
    if (preferences.progressMilestones) {
      clearMilestoneNotice();
      milestoneNotice = { value, mode, target: state.target, session: state.sessionLabel.shortID };
      renderProgress();
      milestoneTimer = setTimeout(() => { clearMilestoneNotice(); renderProgress(); }, 2300);
    }
    const sound = preferences.sound && preferences.milestoneSound && preferences.volume > 0;
    if (sound) playMilestoneSound(value);
    return sound;
  }

  function notifyCompletion(wasFinished) {
    if (wasFinished || !Core.complete(state)) return false;
    $('completion-dialog-title').textContent = mode === 'fluids' ? 'Diferencial concluído' : 'Contagem concluída';
    $('completion-message').textContent = mode === 'fluids' ? `${state.fluid.differential.closedLowCellularity ? 'O diferencial foi encerrado por baixa celularidade' : 'A meta do diferencial foi atingida'} com ${Core.total(state)} células. A contagem em câmara continua disponível.` : `A meta de ${state.target} células foi atingida. Feche este aviso para consultar o resumo ou corrigir a contagem.`;
    openDialog('completion-dialog');
    $('close-completion').focus();
    finishSound();
    announce(`Contagem concluída: ${Core.total(state)} células. Resultado disponível.`);
    return true;
  }

  function record(key, delta) {
    if (!canCount() || (mode === 'fluids' && fluidView.tab !== 'differential')) return;
    const result = Core.change(state, key, delta);
    if (!result.changed) {
      if (result.reason === 'complete') toast('Meta atingida. Você pode corrigir ou iniciar uma nova contagem.');
      return;
    }
    const wasFinished = Core.complete(state);
    const previousTotal = Core.total(state);
    const nextTotal = Core.total(result.state);
    const milestone = delta > 0 && nextTotal > previousTotal
      ? Core.milestones(state).find(value => value > Math.max(previousTotal, state.milestonePeak) && value <= nextTotal)
      : undefined;
    if (!commit(result.state)) return;
    lastKey = key;
    lastAction = describe(result.entry);
    render();
    flash(key, delta);
    if (!notifyCompletion(wasFinished)) {
      const milestoneSound = milestone !== undefined && notifyMilestone(milestone);
      if (!milestoneSound) tone(delta);
      const milestoneMessage = milestone !== undefined && (preferences.progressMilestones || milestoneSound) ? `Marco de ${milestone} células atingido. ` : '';
      announce(`${milestoneMessage}${lastAction}. Total: ${Core.total(state)} de ${state.target}.`);
    }
  }

  function undo() {
    if (!canCount()) return;
    const wasFinished = Core.complete(state);
    const result = Core.undo(state);
    if (!result.changed || !commit(result.state)) return;
    lastKey = result.entry.key || null;
    lastAction = describe(result.entry, true);
    render();
    if (result.entry.type === 'count') flash(result.entry.key, -result.entry.delta);
    if (!notifyCompletion(wasFinished)) {
      if (result.entry.type === 'count') tone(-result.entry.delta);
      announce(`${lastAction}. Total: ${Core.total(state)}.`);
    }
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
    if (restorePending || restoreError || materialRequired()) return;
    renderSummary();
    $('copy-fallback').hidden = true;
    $('copy-status').textContent = '';
    openDialog('summary-dialog');
  }

  function showNew() {
    const hasContent = Core.hasProgress(state);
    $('new-target').value = state.targetSource === 'custom' ? 'custom' : String(state.target);
    $('new-description').textContent = restoreError
      ? 'Iniciar uma nova contagem substitui a sessão que não pôde ser recuperada.'
      : hasContent
        ? mode === 'fluids' ? 'A contagem em câmara e o diferencial deste modo serão zerados. Um novo nome de sessão será gerado.' : `Os ${Core.total(state)} registros do total global e todas as contagens separadas serão zerados. Suas células, posições e teclas serão mantidas.`
        : 'Escolha a meta para começar.';
    $('confirm-new').textContent = hasContent || restoreError ? 'Zerar e iniciar' : 'Iniciar contagem';
    $('confirm-new').classList.toggle('danger', hasContent || restoreError);
    $('confirm-new').classList.toggle('primary', !hasContent && !restoreError);
    $('new-mode-hint').textContent = `${Core.modeInfo(state).name}. Apenas a contagem deste modo será reiniciada.`;
    openDialog('new-dialog');
  }

  function changeTarget(target, source = 'preset') {
    if (state.paused) return;
    const wasFinished = Core.complete(state);
    const result = source === 'custom' ? Core.setCustomTarget(state, target) : Core.setTarget(state, target);
    if (!result.changed) return;
    if (!commit(result.state)) return;
    lastAction = describe(result.entry);
    render();
    if (!notifyCompletion(wasFinished)) announce(lastAction);
  }

  function requestTargetChange(target, source = 'preset') {
    if (state.target === target && state.targetSource === source) return;
    if (!Core.complete(state)) { changeTarget(target, source); return; }
    pendingTarget = { target, source };
    $('target-description').textContent = `Alterar a meta de ${state.target} para ${target} células${source === 'custom' ? ' (personalizada)' : ''}? O total atual é ${Core.total(state)}.`;
    openDialog('target-dialog');
  }

  function showCustomTarget() {
    const input = $('custom-target-input');
    input.value = state.customTarget == null ? '' : String(state.customTarget);
    input.setAttribute('aria-invalid', 'false');
    $('custom-target-feedback').textContent = '';
    openDialog('custom-target-dialog');
    input.focus();
    input.select();
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

  function preparePrint() {
    const report = $('print-summary');
    report.replaceChildren();
    if (restorePending || restoreError || editingLayout || materialRequired()) return false;
    report.innerHTML = PrintSummary.render(state, {
      appName: document.querySelector('.brand-title').textContent,
      version: document.querySelector('.version').textContent,
      address: document.baseURI
    });
    return true;
  }

  function printSummary() {
    if (!$('summary-dialog').open || !preparePrint()) return;
    try { window.print(); }
    catch (_) { $('copy-status').textContent = 'Não foi possível abrir a impressão. Use a opção Imprimir do navegador.'; }
  }

  function startEditing() {
    if ((mode === 'fluids' && fluidView.tab !== 'differential') || restorePending || modalOpen() || materialRequired()) return;
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
      if (!editingLayout || !$('layout-reset-dialog').open) return;
      const result = Session.restoreDefaultLayout(state, layout);
      if (!result.changed) {
        $('layout-reset-dialog').close();
        const message = result.reason === 'limit'
          ? `Para restaurar todas as células padrão, remova ${result.requiredSlots} célula${result.requiredSlots === 1 ? '' : 's'} personalizada${result.requiredSlots === 1 ? '' : 's'}. O limite é de 37 células.`
          : 'Não foi possível restaurar o padrão. A sessão foi mantida.';
        toast(message);
        announce(message);
        return;
      }
      if (!commit(result.state, result.layout)) return;
      layoutDirty = dirty;
      editor.finishSettling();
      buildCells(true);
      editor.applyOrder(layout.order, false);
      render();
      $('layout-reset-dialog').close();
      announce('Células padrão, posições e teclas restauradas. Células personalizadas e contagens atuais mantidas.');
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
      observer.observe($('cell-grid-home'));
      observer.observe($('progress').closest('.progress-panel'));
    }
    window.addEventListener('resize', scheduleGrid);
    document.fonts?.ready.then(() => { nameFitSignature = ''; scheduleGrid(); });
  }

  function bindControls() {
    const selectMode = event => switchMode(countingModes.find((value, index) => String(index) === event.target.value));
    $('mode-select').addEventListener('input', selectMode);
    $('mode-select').addEventListener('change', selectMode);
    $('undo-button').addEventListener('click', undo);
    $('pause-button').addEventListener('click', () => {
      if (restorePending || editingLayout || modalOpen() || materialRequired()) return;
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
      removeLegacyNotes();
      if (commit(state)) { render(); if (!notesCleanupFailed && !findingsCleanupFailed && !dirty && !layoutDirty) toast('Alterações salvas neste navegador.'); }
    });
    for (const id of ['summary-button', 'completion-summary']) $(id).addEventListener('click', showSummary);
    document.querySelectorAll('[data-new]').forEach(button => button.addEventListener('click', () => {
      if ((restorePending || materialRequired()) && !button.closest('#restore-banner')) return;
      showNew();
    }));
    $('confirm-new').addEventListener('click', () => {
      if (restoreError) {
        try { localStorage.setItem(`cellCounterRecovery_v4_${mode}`, lastStoredRaw ?? localStorage.getItem(PREVIOUS_STORAGE) ?? localStorage.getItem(LEGACY_STORAGE) ?? ''); } catch (_) {}
      }
      const source = $('new-target').value === 'custom' ? 'custom' : 'preset';
      const target = source === 'custom' ? state.customTarget : Number($('new-target').value), label = newSessionLabel();
      const fresh = mode === 'fluids' ? Session.newFluidCount(state, layout, target, label, source) : {
        state: Core.create(target, state.customCells, mode, state.deletedCells, state.cellNames, Core.visualSettings(state), label, undefined, { customTarget: state.customTarget, targetSource: source }), layout
      };
      if (mode === 'fluids' && !fresh.changed) return;
      fresh.state.updatedAt = new Date().toISOString();
      if (!commit(fresh.state, fresh.layout)) return;
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
      if (state.paused || restorePending || editingLayout || modalOpen() || materialRequired()) return;
      if (button.dataset.custom === 'true') { showCustomTarget(); return; }
      const target = Number(button.dataset.target);
      if (!Core.modeInfo(state).targets.includes(target)) return;
      if (target < Core.total(state)) { toast(`Você já contou ${Core.total(state)} células. Escolha uma meta igual ou maior que esse total.`); return; }
      requestTargetChange(target);
    });
    $('confirm-target').addEventListener('click', () => {
      const pending = pendingTarget;
      $('target-dialog').close();
      if (pending !== null) changeTarget(pending.target, pending.source);
    });
    $('custom-target-input').addEventListener('input', () => {
      $('custom-target-input').setAttribute('aria-invalid', 'false');
      $('custom-target-feedback').textContent = '';
    });
    $('custom-target-form').addEventListener('submit', event => {
      event.preventDefault();
      if (state.paused || restorePending || editingLayout || materialRequired()) return;
      const input = $('custom-target-input');
      const value = input.value.trim();
      const target = Number(value);
      const invalid = !/^\d+$/.test(value) || !Number.isSafeInteger(target) || target <= 0;
      const message = invalid ? 'Digite um número inteiro maior que zero, sem casas decimais.'
        : target < Core.total(state) ? `Você já contou ${Core.total(state)} células. A meta deve ser igual ou maior que esse total.` : '';
      if (message) {
        input.setAttribute('aria-invalid', 'true');
        $('custom-target-feedback').textContent = message;
        input.focus();
        return;
      }
      $('custom-target-dialog').close();
      requestTargetChange(target, 'custom');
    });
    $('copy-result').addEventListener('click', copyResult);
    $('print-summary-button').addEventListener('click', printSummary);
    window.addEventListener('beforeprint', preparePrint);
    window.addEventListener('afterprint', () => { $('print-summary').replaceChildren(); });
    $('settings-button').addEventListener('click', () => { renderPreferences(); openDialog('settings-dialog'); });
    $('help-button').addEventListener('click', () => openDialog('help-dialog'));
    $('info-button').addEventListener('click', () => openDialog('info-dialog'));
    for (const [trigger, dialog] of [['session-name-help', 'session-name-dialog'], ['storage-help', 'storage-info-dialog']]) {
      $(trigger).addEventListener('click', event => { event.preventDefault(); openDialog(dialog); });
    }
    $('sound-button').addEventListener('click', () => { preferences.sound = !preferences.sound; savePreferences(); toast(preferences.sound ? 'Sons ativados' : 'Sons desativados'); });
    const selectTheme = event => {
      const choice = themeChoices.find((theme, index) => String(index) === event.target.value);
      if (!choice || choice.value === preferences.theme) return;
      preferences.theme = choice.value;
      savePreferences();
    };
    $('theme-select').addEventListener('input', selectTheme);
    $('theme-select').addEventListener('change', selectTheme);
    for (const [id, property] of [['sound-setting', 'sound'], ['count-sound-setting', 'countSound'], ['finish-sound-setting', 'finishSound'], ['milestone-sound-setting', 'milestoneSound'], ['progress-colors-setting', 'progressColors'], ['progress-milestones-setting', 'progressMilestones'], ['wallpaper-setting', 'wallpaper'], ['wallpaper-automatic-setting', 'wallpaperAutomatic']]) {
      $(id).addEventListener('change', event => { preferences[property] = event.target.checked; savePreferences(); });
    }
    const selectWallpaperIntensity = event => {
      const intensity = Number(event.target.value);
      if (!Number.isFinite(intensity) || intensity === preferences.wallpaperIntensity) return;
      preferences.wallpaperIntensity = Math.min(100, Math.max(0, intensity));
      savePreferences();
    };
    $('wallpaper-intensity-setting').addEventListener('input', selectWallpaperIntensity);
    $('wallpaper-intensity-setting').addEventListener('change', selectWallpaperIntensity);
    $('reset-wallpaper-intensity').addEventListener('click', () => {
      preferences.wallpaperIntensity = defaults.wallpaperIntensity;
      savePreferences();
    });
    $('new-wallpaper-button').addEventListener('click', () => {
      const result = window.CellWallpaperView?.regenerate();
      if (!result) return;
      $('wallpaper-status').textContent = result.saved ? 'Novo desenho salvo neste navegador.' : 'Novo desenho aplicado, mas não pôde ser salvo neste navegador.';
    });
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
      if ($('completion-dialog').open) {
        // Mantém Tab, Escape e o botão de fechar acessíveis pelo teclado.
        // Uma tecla mantida pressionada não repete sons nem fecha o aviso.
        if (event.repeat) {
          if (['Enter', ' '].includes(event.key)) event.preventDefault();
        } else if (windowFocused && document.visibilityState !== 'hidden') tone(0, true);
        return;
      }
      // Enter pressionado em um botão nativo também pode repetir cliques.
      if (event.repeat && ['Enter', ' '].includes(event.key) && target instanceof Element && (target.closest('.cell-add,.cell-remove') || ((target.closest('#fluid-panel') || target.closest('#fluid-tabs') || target.closest('.fluid-finish-button')) && target.closest('button')))) {
        event.preventDefault();
        return;
      }
      const typing = target instanceof Element && Boolean(target.closest('input,textarea,select,[role="textbox"]') || target.isContentEditable);
      if (mode === 'fluids' && !typing && fluidView.key(event)) return;
      const action = Core.shortcut(event, {
        blocked: !canCount(),
        bindings: mode === 'fluids' && fluidView.tab !== 'differential' ? {} : layout.bindings,
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
      if ([...countingModes.map(Session.key), PREVIOUS_STORAGE, LEGACY_STORAGE].includes(event.key)) {
        removeLegacyNotes();
        renderStorageStatus();
      }
    });
  }

  try {
    const storedMode = localStorage.getItem(MODE_STORAGE);
    if (Object.hasOwn(Core.MODES, storedMode)) mode = storedMode;
  } catch (_) {}
  loadPreferences();
  buildWallpaperTones();
  removeLegacyNotes();
  loadSession();
  buildCells();
  $('fluid-material').innerHTML = '<option value="" disabled>Selecionar material</option>' + Fluids.MATERIALS.map(material => `<option value="${material.key}">${escapeHTML(material.name)}</option>`).join('');
  $('fluid-material').addEventListener('change', () => {
    if (mode !== 'fluids' || !canInteract()) { render(); return; }
    const result = Session.switchFluidMaterial(state, layout, $('fluid-material').value);
    if (!result.changed || !commit(result.state, result.layout)) { render(); return; }
    lastKey = null;
    lastAction = 'Material selecionado';
    buildCells(true);
    editor.applyOrder(layout.order);
    render();
  });
  fluidView = FluidView.create($('fluid-panel'), {
    getState: () => state, allowed: () => mode === 'fluids' && canCount(), canNavigate: () => mode === 'fluids' && canCount(), changed: render, notify: toast,
    apply: (result, message, delta) => {
      if (mode !== 'fluids' || !canCount()) return;
      const wasFinished = Core.complete(state);
      const updated = Core.updateFluid(state, result);
      if (!updated.changed || !commit(updated.state)) return;
      lastAction = message;
      render();
      if (!notifyCompletion(wasFinished)) { if (delta) tone(delta); announce(message); }
    },
    confirm: (title, message, action) => {
      fluidConfirmation = action;
      $('fluid-confirm-title').textContent = title;
      $('fluid-confirm-message').textContent = message;
      openDialog('fluid-confirm-dialog');
    }
  });
  $('fluid-confirm-accept').addEventListener('click', () => {
    const action = fluidConfirmation;
    $('fluid-confirm-dialog').close();
    if (canCount()) action?.();
  });
  $('fluid-confirm-dialog').addEventListener('close', () => { fluidConfirmation = null; });
  bindControls();
  bindEditing();
  const copyrightYears = `2016–${new Date().getFullYear()}`;
  document.querySelectorAll('[data-copyright-years]').forEach(label => { label.textContent = copyrightYears; });
  document.querySelectorAll('svg.icon').forEach(svg => svg.setAttribute('aria-hidden', 'true'));
  renderPreferences();
  render();
  updateFocusShield();
})();
