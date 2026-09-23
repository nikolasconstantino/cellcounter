/* Paleta compacta com cor automática, personalização e código hexadecimal opcional. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./counter.js'));
  else root.CellColorPicker = factory(root.CellCounter);
})(typeof window !== 'undefined' ? window : this, function (Core) {
  'use strict';

  const PALETTE = Object.freeze([
    ['Verde sálvia', '#88b8a7'], ['Areia', '#cdac80'], ['Malva', '#a79abd'],
    ['Azul acinzentado', '#9bb5c1'], ['Rosa antigo', '#c99797'], ['Lavanda', '#aaa7ca'],
    ['Coral', '#e4aaa0'], ['Pêssego', '#edc19b'], ['Amarelo suave', '#e4d18d'],
    ['Verde claro', '#b4c99a'], ['Azul suave', '#a1c4e0'], ['Rosa suave', '#ddb3ce']
  ].map(Object.freeze));
  const escape = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  return class CellColorPicker {
    constructor(container, { id, allowAutomatic = true, onChange = () => {} }) {
      this.container = container;
      this.allowAutomatic = allowAutomatic;
      this.onChange = onChange;
      this.value = '';
      this.inheritedColor = '';
      this.valid = allowAutomatic;
      const prefix = escape(id);
      container.classList.add('cell-color-picker');
      container.innerHTML = `
        <div class="cell-color-toolbar">
          <div class="cell-color-preview">
            <span class="cell-color-sample" aria-hidden="true"></span>
            <span class="cell-color-description"></span>
          </div>
          <div class="cell-color-actions">
            ${allowAutomatic ? '<button type="button" class="cell-color-automatic" aria-pressed="true" title="Usar a cor do grupo ou o padrão da célula">Automática</button>' : ''}
            <label class="cell-color-custom" for="${prefix}-native">
              Personalizar
              <input type="color" class="cell-color-native" id="${prefix}-native" aria-label="Personalizar cor" value="#88b8a7">
            </label>
          </div>
        </div>
        <div class="cell-color-palette" role="group" aria-label="Cores sugeridas">
          ${PALETTE.map(([name, color]) => `<button type="button" class="cell-color-swatch" data-color="${color}" aria-label="${name}" title="${name}" aria-pressed="false" style="--swatch-color:${color}"></button>`).join('')}
        </div>
        <details class="cell-color-code">
          <summary>Inserir código de cor</summary>
          <div class="cell-color-code-field">
            <label for="${prefix}-hex">Código HEX</label>
            <input type="text" class="cell-color-hex" id="${prefix}-hex" placeholder="#88B8A7" maxlength="7" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="${prefix}-hint ${prefix}-error" aria-invalid="false">
          </div>
          <p class="cell-color-hint" id="${prefix}-hint">3 ou 6 caracteres, com ou sem #.</p>
        </details>
        <p class="cell-color-error" id="${prefix}-error" role="status" aria-live="polite" hidden></p>`;
      this.sample = container.querySelector('.cell-color-sample');
      this.description = container.querySelector('.cell-color-description');
      this.automatic = container.querySelector('.cell-color-automatic');
      this.native = container.querySelector('.cell-color-native');
      this.hex = container.querySelector('.cell-color-hex');
      this.details = container.querySelector('.cell-color-code');
      this.error = container.querySelector('.cell-color-error');
      this.swatches = [...container.querySelectorAll('.cell-color-swatch')];
      this.swatches.forEach(button => button.addEventListener('click', () => this.choose(button.dataset.color)));
      this.automatic?.addEventListener('click', () => this.choose(''));
      this.native.addEventListener('input', () => this.choose(this.native.value));
      this.native.addEventListener('change', () => {
        if (this.native.value !== this.value) this.choose(this.native.value);
      });
      this.hex.addEventListener('input', () => {
        const draft = this.hex.value.trim();
        const color = Core.normalizeColor(draft);
        this.value = color || '';
        this.valid = !!color || (!draft && this.allowAutomatic);
        this.render(false);
        this.onChange(this.getValue(), this.isValid());
      });
      this.set('');
    }

    set(value, inheritedColor = '') {
      const draft = typeof value === 'string' ? value.trim() : '';
      this.value = Core.normalizeColor(draft) || '';
      this.inheritedColor = Core.normalizeColor(inheritedColor) || '';
      this.valid = !!this.value || (!draft && this.allowAutomatic);
      this.hex.value = this.value || draft;
      this.details.open = false;
      this.render(false);
    }

    getValue() { return this.value; }
    isValid() { return this.valid; }

    focus() {
      if (!this.valid) {
        this.details.open = true;
        this.hex.focus();
      } else {
        const selected = this.swatches.find(button => button.dataset.color === this.value);
        (selected || (this.value ? this.native : this.automatic) || this.swatches[0]).focus();
      }
    }

    choose(value) {
      this.value = Core.normalizeColor(value) || '';
      this.valid = !!this.value || this.allowAutomatic;
      this.render(true);
      this.onChange(this.getValue(), this.isValid());
    }

    render(syncHex) {
      const color = this.value || this.inheritedColor;
      const automatic = this.valid && !this.value;
      this.sample.style.setProperty('--sample-color', color || 'transparent');
      this.sample.classList.toggle('is-empty', !color);
      this.description.textContent = !this.valid ? 'Escolha uma cor' : automatic
        ? (this.inheritedColor ? 'Cor do grupo' : 'Cor padrão')
        : (PALETTE.find(([, hex]) => hex === this.value)?.[0] || this.value.toUpperCase());
      this.automatic?.setAttribute('aria-pressed', String(automatic));
      this.swatches.forEach(button => button.setAttribute('aria-pressed', String(this.valid && button.dataset.color === this.value)));
      this.native.value = color || '#88b8a7';
      if (syncHex) this.hex.value = this.value;
      this.hex.setAttribute('aria-invalid', String(!this.valid));
      this.error.hidden = this.valid;
      this.error.textContent = this.valid ? '' : 'Escolha uma cor ou insira um código HEX válido, como #88B8A7.';
    }
  };
});
