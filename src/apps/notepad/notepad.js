/*
 * Notepad: a plain-text editor that saves to the KXKOS virtual filesystem.
 * Launch args: { path } to open an existing file.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el, ui } = KX;
  const fs = KX.fs;

  KX.registerApp({
    id: 'notepad',
    title: 'Notepad',
    icon: 'notepad',
    width: 540,
    height: 400,
    minWidth: 300,
    minHeight: 200,
    desktop: true,
    order: 10,

    launch(win, args) {
      let path = null;
      let savedText = '';
      let dirty = false;

      const area = el('textarea', { class: 'kx-np-area', spellcheck: 'false', 'aria-label': 'Text editor', 'data-autofocus': '' });
      const statusPos = el('span', { text: 'Ln 1, Col 1' });
      const statusLen = el('span', { text: '0 characters' });

      /* ----- state helpers ----- */

      function refreshTitle() {
        const name = path ? fs.basename(path) : 'Untitled';
        win.setTitle((dirty ? '*' : '') + name + ' — Notepad');
      }

      function refreshStatus() {
        const before = area.value.slice(0, area.selectionStart);
        const lines = before.split('\n');
        statusPos.textContent = 'Ln ' + lines.length + ', Col ' + (lines[lines.length - 1].length + 1);
        statusLen.textContent = area.value.length + ' character' + (area.value.length === 1 ? '' : 's');
      }

      function setDocument(newPath, text) {
        path = newPath;
        savedText = text;
        area.value = text;
        dirty = false;
        refreshTitle();
        refreshStatus();
      }

      /* ----- file actions ----- */

      async function writeTo(target) {
        try {
          fs.write(target, area.value);
        } catch (err) {
          await ui.alert({ title: 'Notepad', message: 'Could not save the file.\n' + err.message });
          return false;
        }
        path = target;
        savedText = area.value;
        dirty = false;
        refreshTitle();
        return true;
      }

      async function saveAs() {
        const chosen = await ui.fileDialog({
          mode: 'save',
          title: 'Save as',
          startPath: path ? fs.dirname(path) : '/Documents',
          filename: path ? fs.basename(path) : 'untitled.txt',
        });
        if (!chosen) return false;
        // Give extension-less names a .txt so they open nicely elsewhere.
        const target = fs.basename(chosen).includes('.') ? chosen : chosen + '.txt';
        if (target !== chosen && fs.isFile(target)) {
          const replace = await ui.confirm({ title: 'Replace file?', message: fs.basename(target) + ' already exists. Replace it?', okText: 'Replace', danger: true });
          if (!replace) return false;
        }
        return writeTo(target);
      }

      async function save() {
        return path ? writeTo(path) : saveAs();
      }

      /** If there are unsaved changes, ask what to do. Resolves false if the user cancels. */
      async function confirmDiscard() {
        if (!dirty) return true;
        const choice = await ui.choose({
          title: 'Notepad',
          message: 'Save changes to ' + (path ? fs.basename(path) : 'Untitled') + '?',
          cancelValue: 'cancel',
          buttons: [
            { label: 'Cancel', value: 'cancel' },
            { label: "Don't save", value: 'discard', danger: true },
            { label: 'Save', value: 'save', primary: true, autofocus: true },
          ],
        });
        if (choice === 'save') return save();
        return choice === 'discard';
      }

      async function newDocument() {
        if (await confirmDiscard()) setDocument(null, '');
      }

      async function openDocument(target) {
        if (!(await confirmDiscard())) return;
        let chosen = target;
        if (!chosen) {
          chosen = await ui.fileDialog({ mode: 'open', title: 'Open', startPath: path ? fs.dirname(path) : '/Documents' });
          if (!chosen) return;
        }
        try {
          setDocument(chosen, fs.read(chosen));
        } catch (err) {
          await ui.alert({ title: 'Notepad', message: 'Could not open the file.\n' + err.message });
        }
      }

      /* ----- UI ----- */

      const menu = ui.menuBar([
        {
          label: 'File',
          items: [
            { label: 'New', action: newDocument },
            { label: 'Open…', shortcut: 'Ctrl+O', action: () => openDocument() },
            { label: 'Save', shortcut: 'Ctrl+S', action: save },
            { label: 'Save As…', action: saveAs },
            { separator: true },
            { label: 'Close', action: () => win.close() },
          ],
        },
        {
          label: 'Format',
          items: [
            {
              label: 'Word Wrap',
              checked: () => !area.classList.contains('nowrap'),
              action: () => area.classList.toggle('nowrap'),
            },
          ],
        },
      ]);

      area.addEventListener('input', () => {
        const nowDirty = area.value !== savedText;
        if (nowDirty !== dirty) {
          dirty = nowDirty;
          refreshTitle();
        }
        refreshStatus();
      });
      ['keyup', 'click', 'select', 'focus'].forEach((evt) => area.addEventListener(evt, refreshStatus));
      area.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const key = e.key.toLowerCase();
        if (key === 's') {
          e.preventDefault();
          save();
        } else if (key === 'o') {
          e.preventDefault();
          openDocument();
        }
      });

      win.onBeforeClose = confirmDiscard;
      win.onClose = () => menu.close();
      win.isDirty = () => dirty;

      win.body.appendChild(
        el('div', { class: 'kx-np' }, menu, area, el('div', { class: 'kx-statusbar' }, statusPos, statusLen))
      );

      // Start with an empty document, or open the requested file.
      setDocument(null, '');
      if (args.path) {
        if (fs.isFile(args.path)) {
          setDocument(args.path, fs.read(args.path));
        } else {
          ui.alert({ title: 'Notepad', message: 'Could not find ' + args.path });
        }
      }
    },
  });
})();
