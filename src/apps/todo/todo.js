/* Todo: a simple task list, kept in localStorage. Check things off, clear done items. */
(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const KEY = 'kxkos.todo.items';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const save = (items) => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* ignore */ } };

  KX.registerApp({
    id: 'todo', title: 'Todo', icon: 'todo', width: 380, height: 460, minWidth: 260, minHeight: 240,
    desktop: true, order: 76,
    launch(win) {
      let items = load();
      let nextId = items.reduce((m, it) => Math.max(m, it.id), 0) + 1;

      const input = el('input', { type: 'text', class: 'kx-brief-input', placeholder: 'Add a task…' });
      const list = el('ul', { class: 'kx-todo-list' });
      const count = el('span', { class: 'kx-set-note', text: '' });

      function add() {
        const text = input.value.trim();
        if (!text) return;
        items.push({ id: nextId++, text, done: false });
        input.value = '';
        save(items);
        draw();
      }
      function toggle(it) { it.done = !it.done; save(items); draw(); }
      function remove(it) { items = items.filter((x) => x !== it); save(items); draw(); }
      function clearDone() { items = items.filter((x) => !x.done); save(items); draw(); }

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

      function draw() {
        list.textContent = '';
        items.forEach((it) => {
          const check = el('input', { type: 'checkbox', checked: it.done, onchange: () => toggle(it) });
          const label = el('span', { class: 'kx-todo-text' + (it.done ? ' kx-todo-done' : ''), text: it.text });
          const del = el('button', { type: 'button', class: 'kx-todo-del', 'aria-label': 'Delete task', text: '×', onclick: () => remove(it) });
          list.appendChild(el('li', { class: 'kx-todo-item' }, check, label, del));
        });
        const left = items.filter((x) => !x.done).length;
        count.textContent = items.length === 0 ? 'No tasks yet.' : left + ' of ' + items.length + ' left';
      }

      win.body.appendChild(
        el(
          'div',
          { class: 'kx-todo' },
          el('div', { class: 'kx-todo-bar' },
            input,
            el('button', { type: 'button', class: 'kx-btn primary', text: 'Add', onclick: add })),
          list,
          el('div', { class: 'kx-todo-foot' },
            count,
            el('button', { type: 'button', class: 'kx-btn', text: 'Clear done', onclick: clearDone }))
        )
      );
      draw();
      input.focus();
    },
  });
})();
