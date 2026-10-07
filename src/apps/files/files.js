/*
 * Files: file manager for the KXKOS virtual filesystem (never the user's real files).
 * Launch args: { path } to start in a given folder.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el, ui } = KX;
  const fs = KX.fs;

  KX.registerApp({
    id: 'files',
    title: 'Files',
    icon: 'folder',
    width: 680,
    height: 420,
    minWidth: 320,
    minHeight: 240,
    desktop: true,
    order: 20,

    launch(win, args) {
      let cwd = args.path && fs.isDir(args.path) ? fs.normalize(args.path) : '/';
      let selected = null; // name of the selected item
      const backStack = [];

      const pathInput = el('input', { class: 'kx-files-path', type: 'text', value: cwd, spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Current folder' });
      const list = el('div', { class: 'kx-files-list', role: 'listbox', tabindex: '0', 'aria-label': 'Files and folders' });
      const statusCount = el('span');
      const statusSelection = el('span');

      const btn = (text, onclick, extra) => el('button', Object.assign({ class: 'kx-btn', type: 'button', text, onclick }, extra));
      const backButton = btn('◀ Back', goBack, { title: 'Back' });
      const upButton = btn('▲ Up', () => navigate(fs.dirname(cwd)), { title: 'Up one folder' });
      const renameButton = btn('Rename', renameSelected);
      const deleteButton = btn('Delete', deleteSelected);

      /* ----- navigation ----- */

      function navigate(path, isBack) {
        const target = fs.normalize(path);
        if (!fs.isDir(target)) return false;
        if (!isBack && target !== cwd) backStack.push(cwd);
        cwd = target;
        selected = null;
        render();
        return true;
      }

      function goBack() {
        while (backStack.length) {
          if (navigate(backStack.pop(), true)) return;
        }
      }

      function openItem(item) {
        if (item.type === 'dir') navigate(item.path);
        else KX.openFile(item.path);
      }

      /* ----- actions ----- */

      async function showError(err) {
        await ui.alert({ title: 'Files', message: err.message });
      }

      const nameValidator = (text) => (fs.validName(text.trim()) ? '' : 'Please enter a valid name (no slashes).');

      async function createItem(kind) {
        const isFolder = kind === 'folder';
        const name = await ui.prompt({
          title: isFolder ? 'New folder' : 'New file',
          message: 'Name:',
          value: isFolder ? 'New folder' : 'New file.txt',
          okText: 'Create',
          validate: nameValidator,
        });
        if (name === null) return;
        const target = fs.join(cwd, name.trim());
        try {
          if (fs.exists(target)) throw new Error('Already exists: ' + target);
          if (isFolder) fs.mkdir(target);
          else fs.write(target, '');
          selected = name.trim();
          render();
        } catch (err) {
          showError(err);
        }
      }

      async function renameSelected() {
        if (!selected) return;
        const name = await ui.prompt({ title: 'Rename', message: 'New name for "' + selected + '":', value: selected, okText: 'Rename', validate: nameValidator });
        if (name === null || name.trim() === selected) return;
        try {
          fs.rename(fs.join(cwd, selected), name.trim());
          selected = name.trim();
          render();
        } catch (err) {
          showError(err);
        }
      }

      async function deleteSelected() {
        if (!selected) return;
        const target = fs.join(cwd, selected);
        const isDir = fs.isDir(target);
        const ok = await ui.confirm({
          title: 'Delete',
          message: 'Delete "' + selected + '"' + (isDir ? ' and everything inside it' : '') + '?\nThis cannot be undone.',
          okText: 'Delete',
          danger: true,
        });
        if (!ok) return;
        try {
          fs.remove(target);
          selected = null;
          render();
        } catch (err) {
          showError(err);
        }
      }

      /* ----- rendering ----- */

      function render() {
        let items;
        try {
          items = fs.list(cwd);
        } catch (err) {
          items = [];
        }
        pathInput.value = cwd;
        backButton.disabled = backStack.length === 0;
        upButton.disabled = cwd === '/';
        win.setTitle(cwd === '/' ? 'Files' : fs.basename(cwd) + ' — Files');

        list.textContent = '';
        items.forEach((item) => {
          const isSelected = item.name === selected;
          list.appendChild(
            el(
              'div',
              {
                class: 'kx-files-row' + (isSelected ? ' selected' : ''),
                role: 'option',
                'aria-selected': String(isSelected),
                onclick: (e) => {
                  const wasSelected = selected === item.name;
                  selected = item.name;
                  if (e.pointerType === 'touch' && wasSelected) openItem(item);
                  else render();
                },
                ondblclick: () => openItem(item),
              },
              el('span', { class: 'kx-files-name' }, el('span', { html: KX.icon(item.type === 'dir' ? 'folder' : 'file', 20) }), el('span', { text: item.name })),
              el('span', { text: item.type === 'dir' ? item.size + (item.size === 1 ? ' item' : ' items') : KX.formatSize(item.size) }),
              el('span', { text: KX.formatDate(item.mtime) })
            )
          );
        });
        if (!items.length) list.appendChild(el('div', { class: 'kx-files-empty', text: 'This folder is empty.' }));

        statusCount.textContent = items.length + (items.length === 1 ? ' item' : ' items');
        statusSelection.textContent = selected ? 'Selected: ' + selected : '';
        renameButton.disabled = deleteButton.disabled = !selected;
      }

      /* ----- events ----- */

      pathInput.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        if (!navigate(fs.normalize(pathInput.value, cwd))) {
          ui.alert({ title: 'Files', message: 'Could not find that folder.' }).then(() => (pathInput.value = cwd));
        }
      });

      list.addEventListener('keydown', (e) => {
        const items = fs.list(cwd);
        const index = items.findIndex((i) => i.name === selected);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (!items.length) return;
          const next = e.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0);
          selected = items[next].name;
          render();
          const row = list.children[next];
          if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && index >= 0) {
          openItem(items[index]);
        } else if (e.key === 'Delete') {
          deleteSelected();
        } else if (e.key === 'F2') {
          e.preventDefault();
          renameSelected();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          navigate(fs.dirname(cwd));
        }
      });

      // Keep the view in sync when other apps change files (e.g. Notepad saves).
      const unsubscribe = KX.on('fs:changed', () => {
        if (!fs.isDir(cwd)) {
          let path = cwd;
          while (!fs.isDir(path)) path = fs.dirname(path);
          cwd = path;
        }
        if (selected && !fs.exists(fs.join(cwd, selected))) selected = null;
        render();
      });
      win.onClose = unsubscribe;

      win.body.appendChild(
        el(
          'div',
          { class: 'kx-files' },
          el('div', { class: 'kx-toolbar' }, backButton, upButton, pathInput, btn('＋ Folder', () => createItem('folder')), btn('＋ File', () => createItem('file')), renameButton, deleteButton),
          el('div', { class: 'kx-files-head' }, el('span', { text: 'Name' }), el('span', { text: 'Size' }), el('span', { text: 'Modified' })),
          list,
          el('div', { class: 'kx-statusbar' }, statusCount, statusSelection)
        )
      );
      list.setAttribute('data-autofocus', '');
      render();
    },
  });
})();
