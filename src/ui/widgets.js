/*
 * KXKOS shared UI widgets: modal dialogs (alert / confirm / prompt / choose), a file chooser, and a
 * menu bar. All return Promises (dialogs) or elements (menu bar) and are styled in kxkos.css.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el } = KX;
  const ui = KX.ui;

  const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /* ------------------------------------------------------------------ modals */

  /** Low-level modal. `build(body, finish)` fills the dialog; finish(value) closes and resolves. */
  function modal(opts, build) {
    return new Promise((resolve) => {
      const layer = document.getElementById('kx-modal-layer');
      const previous = document.activeElement;
      const overlay = el('div', { class: 'kx-modal' });
      const dialog = el('div', {
        class: 'kx-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': opts.title || 'KXKOS',
        style: { width: (opts.width || 340) + 'px' },
      });
      const body = el('div', { class: 'kx-dialog-body' });
      dialog.append(el('div', { class: 'kx-dialog-title', text: opts.title || 'KXKOS' }), body);
      overlay.appendChild(dialog);

      let done = false;
      function finish(value) {
        if (done) return;
        done = true;
        overlay.remove();
        if (!layer.children.length) layer.hidden = true;
        if (previous && previous.isConnected && previous.focus) previous.focus({ preventScroll: true });
        resolve(value);
      }

      overlay.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(opts.cancelValue);
        } else if (e.key === 'Tab') {
          const items = Array.from(dialog.querySelectorAll(FOCUSABLE));
          if (!items.length) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });

      layer.hidden = false;
      layer.appendChild(overlay);
      build(body, finish);
      const target = dialog.querySelector('[data-autofocus]') || dialog.querySelector(FOCUSABLE);
      if (target) target.focus({ preventScroll: true });
    });
  }

  /** Message with custom buttons: buttons = [{ label, value, primary, danger, autofocus }]. */
  ui.choose = function choose({ title, message, buttons, cancelValue }) {
    return modal({ title, cancelValue }, (body, finish) => {
      const row = el('div', { class: 'kx-dialog-buttons' });
      buttons.forEach((b) =>
        row.appendChild(
          el('button', {
            type: 'button',
            class: 'kx-btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''),
            text: b.label,
            'data-autofocus': b.autofocus ? '' : null,
            onclick: () => finish(b.value),
          })
        )
      );
      body.append(el('p', { class: 'kx-dialog-msg', text: message }), row);
    });
  };

  ui.alert = function alert({ title, message, okText }) {
    return ui.choose({
      title: title || 'KXKOS',
      message,
      cancelValue: undefined,
      buttons: [{ label: okText || 'OK', value: undefined, primary: true, autofocus: true }],
    });
  };

  /** Resolves true / false. With `danger`, the safe button (Cancel) gets the initial focus. */
  ui.confirm = function confirm({ title, message, okText, cancelText, danger }) {
    return ui.choose({
      title: title || 'Please confirm',
      message,
      cancelValue: false,
      buttons: [
        { label: cancelText || 'Cancel', value: false, autofocus: !!danger },
        { label: okText || 'OK', value: true, primary: !danger, danger: !!danger, autofocus: !danger },
      ],
    });
  };

  /** Resolves the entered string, or null if cancelled. `validate(text)` may return an error message. */
  ui.prompt = function prompt({ title, message, value, okText, validate }) {
    return modal({ title: title || 'KXKOS', cancelValue: null }, (body, finish) => {
      const input = el('input', { class: 'kx-input', type: 'text', value: value || '', spellcheck: 'false', autocomplete: 'off', 'data-autofocus': '' });
      const error = el('div', { class: 'kx-dialog-error', role: 'alert' });

      function submit() {
        const text = input.value;
        if (validate) {
          const problem = validate(text);
          if (problem) {
            error.textContent = problem;
            input.focus();
            return;
          }
        }
        finish(text);
      }
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submit();
        }
      });

      body.append(
        message ? el('p', { class: 'kx-dialog-msg', text: message }) : null,
        input,
        error,
        el(
          'div',
          { class: 'kx-dialog-buttons' },
          el('button', { type: 'button', class: 'kx-btn', text: 'Cancel', onclick: () => finish(null) }),
          el('button', { type: 'button', class: 'kx-btn primary', text: okText || 'OK', onclick: submit })
        )
      );
      Promise.resolve().then(() => input.select());
    });
  };

  /**
   * File chooser for the virtual filesystem. mode: 'open' | 'save'.
   * Resolves the chosen absolute path, or null if cancelled.
   */
  ui.fileDialog = function fileDialog({ mode, title, startPath, filename }) {
    const fs = KX.fs;
    const saving = mode === 'save';
    let cwd = startPath && fs.isDir(startPath) ? fs.normalize(startPath) : '/';
    let selected = null;

    return modal({ title: title || (saving ? 'Save as' : 'Open'), width: 420, cancelValue: null }, (body, finish) => {
      const pathLabel = el('div', { class: 'kx-fd-path' });
      const list = el('div', { class: 'kx-fd-list', role: 'listbox', 'aria-label': 'Files and folders' });
      const nameInput = el('input', { class: 'kx-input', type: 'text', value: filename || '', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'File name' });
      const error = el('div', { class: 'kx-dialog-error', role: 'alert' });

      function goTo(path) {
        cwd = path;
        selected = null;
        error.textContent = '';
        render();
      }

      function render() {
        pathLabel.textContent = cwd;
        list.textContent = '';
        const rows = [];
        if (cwd !== '/') rows.push({ name: '..', type: 'dir', up: true });
        fs.list(cwd).forEach((item) => rows.push(item));
        rows.forEach((item) => {
          const isSelected = item.name === selected;
          list.appendChild(
            el(
              'div',
              {
                class: 'kx-fd-row' + (isSelected ? ' selected' : ''),
                role: 'option',
                'aria-selected': String(isSelected),
                onclick: () => select(item),
                ondblclick: () => activate(item),
              },
              el('span', { class: 'kx-fd-icon', html: KX.icon(item.type === 'dir' ? 'folder' : 'file', 18) }),
              el('span', { text: item.up ? '.. (up one level)' : item.name })
            )
          );
        });
        if (!rows.length) list.appendChild(el('div', { class: 'kx-fd-empty', text: 'This folder is empty.' }));
      }

      function select(item) {
        selected = item.name;
        if (item.type === 'file') nameInput.value = item.name;
        error.textContent = '';
        render();
      }

      function activate(item) {
        if (item.up) return goTo(fs.dirname(cwd));
        if (item.type === 'dir') return goTo(fs.join(cwd, item.name));
        nameInput.value = item.name;
        return accept(item.name);
      }

      async function accept(rawName) {
        const name = (rawName || '').trim();
        if (!name) {
          error.textContent = 'Please enter a file name.';
          return;
        }
        if (!fs.validName(name)) {
          error.textContent = 'That name is not valid.';
          return;
        }
        const target = fs.join(cwd, name);
        if (fs.isDir(target)) return goTo(target);
        if (!saving) {
          if (!fs.exists(target)) {
            error.textContent = 'File not found.';
            return;
          }
        } else if (fs.isFile(target)) {
          const replace = await ui.confirm({ title: 'Replace file?', message: name + ' already exists. Replace it?', okText: 'Replace', danger: true });
          if (!replace) return;
        }
        finish(target);
      }

      function primary() {
        error.textContent = '';
        const typed = nameInput.value.trim();
        if (selected === '..') return goTo(fs.dirname(cwd));
        if (!typed && selected && fs.isDir(fs.join(cwd, selected))) return goTo(fs.join(cwd, selected));
        return accept(typed);
      }

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          primary();
        }
      });

      body.append(
        pathLabel,
        list,
        el('label', { class: 'kx-fd-name' }, el('span', { text: 'File name:' }), nameInput),
        error,
        el(
          'div',
          { class: 'kx-dialog-buttons' },
          el('button', { type: 'button', class: 'kx-btn', text: 'Cancel', onclick: () => finish(null) }),
          el('button', { type: 'button', class: 'kx-btn primary', text: saving ? 'Save' : 'Open', onclick: primary })
        )
      );
      render();
      nameInput.setAttribute('data-autofocus', '');
    });
  };

  /* ---------------------------------------------------------------- menu bar */

  /**
   * menus = [{ label, items: [{ label, action, shortcut, checked, disabled } | { separator: true }] }]
   * `checked` and `disabled` may be booleans or functions evaluated each time the menu opens.
   */
  ui.menuBar = function menuBar(menus) {
    const bar = el('div', { class: 'kx-menubar', role: 'menubar' });
    let open = null; // { button, panel }

    const evaluate = (value) => (typeof value === 'function' ? value() : !!value);

    function outsidePress(e) {
      if (!bar.contains(e.target)) closeMenu();
    }

    function closeMenu() {
      if (!open) return;
      open.panel.remove();
      open.button.classList.remove('open');
      open.button.setAttribute('aria-expanded', 'false');
      open = null;
      document.removeEventListener('pointerdown', outsidePress, true);
    }

    function openMenu(button, wrap, menu) {
      closeMenu();
      const panel = el('div', { class: 'kx-menu', role: 'menu' });
      menu.items.forEach((item) => {
        if (item.separator) {
          panel.appendChild(el('div', { class: 'kx-menu-sep', role: 'separator' }));
          return;
        }
        panel.appendChild(
          el(
            'button',
            {
              class: 'kx-menu-item',
              type: 'button',
              role: 'menuitem',
              disabled: evaluate(item.disabled),
              onclick: () => {
                closeMenu();
                if (item.action) item.action();
              },
            },
            el('span', { class: 'kx-menu-check', text: evaluate(item.checked) ? '✓' : '' }),
            el('span', { class: 'kx-menu-label', text: item.label }),
            el('span', { class: 'kx-menu-key', text: item.shortcut || '' })
          )
        );
      });
      wrap.appendChild(panel);
      button.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      open = { button, panel };
      document.addEventListener('pointerdown', outsidePress, true);
    }

    menus.forEach((menu) => {
      const wrap = el('div', { class: 'kx-menu-wrap' });
      const button = el('button', { class: 'kx-menu-top', type: 'button', text: menu.label, 'aria-haspopup': 'true', 'aria-expanded': 'false' });
      button.addEventListener('click', () => (open && open.button === button ? closeMenu() : openMenu(button, wrap, menu)));
      button.addEventListener('pointerenter', () => {
        if (open && open.button !== button) openMenu(button, wrap, menu);
      });
      wrap.appendChild(button);
      bar.appendChild(wrap);
    });

    bar.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
    // Close if the bar is removed (window closed) while a menu is open.
    bar.close = closeMenu;
    return bar;
  };
})();
