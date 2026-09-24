/* Arraste com espaço reservado, deslocamento FLIP e retorno ao soltar. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./layout.js'));
  else root.CellLayoutEditor = factory(root.CellLayout);
})(typeof window !== 'undefined' ? window : this, function (Layout) {
  'use strict';
  return class CellLayoutEditor {
    constructor({ grid, cells, order, onCommit, onStatus, reducedMotion }) {
      this.grid = grid;
      this.cells = cells;
      this.order = [...order];
      this.onCommit = onCommit;
      this.onStatus = onStatus;
      this.reducedMotion = reducedMotion;
      this.doc = grid.ownerDocument;
      this.win = this.doc.defaultView;
      this.enabled = false;
      this.pending = null;
      this.drag = null;
      this.settling = null;
      this.frame = null;
      grid.addEventListener('pointerdown', event => this.pointerDown(event));
      this.win.addEventListener('pointermove', event => this.pointerMove(event), { passive: false });
      this.win.addEventListener('pointerup', event => this.pointerUp(event));
      this.win.addEventListener('pointercancel', event => {
        if ((this.drag || this.pending)?.pointerId === event.pointerId) this.cancel();
      });
      this.win.addEventListener('blur', () => this.cancel());
      this.win.addEventListener('resize', () => this.cancel());
      this.doc.addEventListener('visibilitychange', () => { if (this.doc.visibilityState === 'hidden') this.cancel(); });
      grid.addEventListener('lostpointercapture', event => { if (this.drag?.pointerId === event.pointerId) this.cancel(); });
      grid.addEventListener('keydown', event => this.keyDown(event));
      this.doc.addEventListener('keydown', event => {
        if (event.key === 'Escape' && (this.pending || this.drag)) {
          event.preventDefault();
          event.stopPropagation();
          this.cancel();
        }
      });
      grid.addEventListener('contextmenu', event => { if (this.enabled) event.preventDefault(); });
      grid.addEventListener('dragstart', event => { if (this.enabled) event.preventDefault(); });
      this.applyOrder(order, false);
    }

    setEnabled(enabled) {
      if (!enabled) this.cancel();
      this.finishSettling();
      this.enabled = enabled;
      this.grid.classList.toggle('is-editing', enabled);
    }

    finishSettling() {
      if (!this.settling) return;
      this.settling.avatar.remove();
      this.cells.get(this.settling.id)?.slot.classList.remove('is-placeholder');
      this.settling = null;
    }

    clearPending() {
      if (!this.pending) return;
      this.win.clearTimeout(this.pending.timer);
      this.cells.get(this.pending.id)?.slot.classList.remove('is-pressing');
      this.pending = null;
    }

    pointerDown(event) {
      if (!this.enabled || this.drag || this.pending || event.button !== 0 || event.isPrimary === false) return;
      const button = event.target.closest('.cell-add');
      const slot = button?.closest('.cell-slot');
      if (!slot || !this.grid.contains(slot)) return;
      this.finishSettling();
      const id = slot.dataset.cellId;
      if (!this.cells.has(id)) return;
      this.pending = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        startX: event.clientX, startY: event.clientY, type: event.pointerType };
      slot.classList.add('is-pressing');
      this.pending.timer = this.win.setTimeout(() => this.startDrag(), event.pointerType === 'mouse' ? 200 : 300);
    }

    pointerMove(event) {
      const pointer = this.drag || this.pending;
      if (!pointer || event.pointerId !== pointer.pointerId) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (this.pending && Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 9) {
        // Dentro do editor, mover com o botão/dedo pressionado também arrasta.
        this.startDrag();
      }
      if (this.drag && event.cancelable) event.preventDefault();
    }

    startDrag() {
      if (!this.pending || !this.enabled) return;
      const pointer = { ...this.pending };
      this.clearPending();
      const cell = this.cells.get(pointer.id);
      const rect = cell.slot.getBoundingClientRect();
      const avatar = cell.tile.cloneNode(true);
      avatar.classList.add('drag-avatar');
      avatar.removeAttribute('data-last');
      avatar.setAttribute('aria-hidden', 'true');
      avatar.inert = true;
      avatar.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      avatar.querySelectorAll('button').forEach(button => { button.tabIndex = -1; });
      avatar.querySelectorAll('.count-delta').forEach(node => node.remove());
      const tileStyle = this.win.getComputedStyle(cell.tile);
      for (const property of ['--key-size', '--cell-band-width', '--cell-band-gap', '--cell-padding', '--cell-inset',
        '--cell-control-size', '--cell-count-size', '--cell-caption-display',
        '--cell-count-size-1', '--cell-count-size-2', '--cell-count-size-3', '--cell-count-size-4']) {
        avatar.style.setProperty(property, tileStyle.getPropertyValue(property));
      }
      Object.assign(avatar.style, { width: `${rect.width}px`, height: `${rect.height}px`, left: '0px', top: '0px' });
      for (const [selector, properties] of [
        ['.cell-add', ['padding', 'gap']], ['.cell-value', ['fontSize', 'lineHeight', 'paddingRight', 'marginTop', 'visibility']],
        ['.cell-name', ['fontSize', 'lineHeight']], ['.ery-note', ['fontSize', 'lineHeight', 'marginTop']],
        ['.cell-key-edit', ['top', 'right', 'bottom', 'height', 'width', 'minWidth']],
        ['.cell-delete', ['top', 'right', 'bottom', 'height', 'width']]
      ]) {
        const source = cell.tile.querySelector(selector);
        const target = avatar.querySelector(selector);
        if (!source || !target) continue;
        const style = this.win.getComputedStyle(source);
        for (const property of properties) if (style[property]) target.style[property] = style[property];
      }
      this.doc.body.append(avatar);
      this.drag = { ...pointer, avatar, original: [...this.order], offsetX: pointer.startX - rect.left,
        offsetY: pointer.startY - rect.top, width: rect.width, height: rect.height };
      cell.slot.classList.add('is-placeholder');
      this.grid.classList.add('is-dragging');
      this.doc.body.classList.add('dragging-cells');
      try { this.grid.setPointerCapture(pointer.pointerId); } catch (_) {}
      this.onStatus(`${cell.name} selecionado. Arraste até a posição desejada.`);
      this.tick();
    }

    rectangles() {
      const gridRect = this.grid.getBoundingClientRect();
      return this.order.map(id => {
        const slot = this.cells.get(id).slot;
        return { id, left: gridRect.left + slot.offsetLeft, top: gridRect.top + slot.offsetTop,
          width: slot.offsetWidth, height: slot.offsetHeight };
      });
    }

    tick() {
      if (!this.drag) return;
      const drag = this.drag;
      const x = drag.x - drag.offsetX;
      const y = drag.y - drag.offsetY;
      drag.avatar.style.transform = `translate3d(${x}px,${y}px,0) rotate(${this.reducedMotion.matches ? 0 : 1.5}deg) scale(1.045)`;
      const target = Layout.targetAt(this.rectangles(), drag.x, drag.y, drag.id);
      if (target >= 0) this.applyOrder(Layout.move(this.order, drag.id, target), true, drag.id);
      // Permite alcançar o fim da grade em telas de toque com rolagem.
      if (this.doc.documentElement.scrollHeight > this.win.innerHeight + 2) {
        const edge = 64;
        const speed = drag.y < edge ? -Math.min(12, (edge - drag.y) / 4)
          : drag.y > this.win.innerHeight - edge ? Math.min(12, (drag.y - this.win.innerHeight + edge) / 4) : 0;
        if (speed) this.win.scrollBy(0, speed);
      }
      this.frame = this.win.requestAnimationFrame(() => this.tick());
    }

    pointerUp(event) {
      if (this.pending?.pointerId === event.pointerId) this.clearPending();
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      this.drag.x = event.clientX;
      this.drag.y = event.clientY;
      const target = Layout.targetAt(this.rectangles(), event.clientX, event.clientY, this.drag.id);
      if (target >= 0) this.applyOrder(Layout.move(this.order, this.drag.id, target), true, this.drag.id);
      this.endDrag(true);
    }

    cancel() {
      this.clearPending();
      if (this.drag) this.endDrag(false);
    }

    endDrag(commit) {
      const drag = this.drag;
      if (!drag) return;
      this.drag = null;
      this.win.cancelAnimationFrame(this.frame);
      this.frame = null;
      this.grid.classList.remove('is-dragging');
      this.doc.body.classList.remove('dragging-cells');
      if (this.grid.hasPointerCapture(drag.pointerId)) this.grid.releasePointerCapture(drag.pointerId);
      if (!commit) this.applyOrder(drag.original, true, drag.id);
      const rect = this.cells.get(drag.id).slot.getBoundingClientRect();
      this.settling = { avatar: drag.avatar, id: drag.id };
      const end = `translate3d(${rect.left}px,${rect.top}px,0) rotate(0deg) scale(1)`;
      if (!this.reducedMotion.matches && typeof drag.avatar.animate === 'function') {
        const animation = drag.avatar.animate([{ transform: drag.avatar.style.transform }, { transform: end }],
          { duration: 170, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
        animation.finished.then(() => { if (this.settling?.avatar === drag.avatar) this.finishSettling(); }).catch(() => {});
      } else this.finishSettling();
      if (commit && this.order.join('|') !== drag.original.join('|')) this.onCommit([...this.order]);
      else this.onStatus(commit ? 'Posição mantida.' : 'Movimento cancelado.');
    }

    applyOrder(order, animate = true, excludedId = null) {
      const focused = this.doc.activeElement;
      const previous = new Map();
      for (const [id, cell] of this.cells) {
        previous.set(id, cell.slot.getBoundingClientRect());
        cell.slot.getAnimations().forEach(animation => animation.cancel());
      }
      this.order = [...order];
      for (const id of order) this.grid.append(this.cells.get(id).slot);
      const addSlot = this.grid.querySelector('.add-cell-slot');
      if (addSlot) this.grid.append(addSlot);
      if (focused && this.grid.contains(focused) && this.doc.activeElement !== focused) focused.focus({ preventScroll: true });
      if (!animate || this.reducedMotion.matches) return;
      for (const [id, cell] of this.cells) {
        if (id === excludedId) continue;
        const before = previous.get(id);
        const after = cell.slot.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if ((Math.abs(dx) > .5 || Math.abs(dy) > .5) && typeof cell.slot.animate === 'function') {
          cell.slot.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }],
            { duration: 190, easing: 'cubic-bezier(.2,.75,.25,1)' });
        }
      }
    }

    keyDown(event) {
      if (!this.enabled || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || this.drag) return;
      const button = event.target.closest('.cell-add');
      const slot = button?.closest('.cell-slot');
      if (!slot) return;
      const columns = this.win.getComputedStyle(this.grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
      if (!(event.key in offsets)) return;
      event.preventDefault();
      event.stopPropagation();
      const id = slot.dataset.cellId;
      const index = this.order.indexOf(id);
      const target = Math.max(0, Math.min(this.order.length - 1, index + offsets[event.key]));
      if (index === target) return;
      this.applyOrder(Layout.move(this.order, id, target));
      this.onCommit([...this.order]);
      button.focus({ preventScroll: true });
    }
  };
});
