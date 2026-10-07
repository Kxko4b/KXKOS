/*
 * KXKOS taskbar: start button + start menu, one button per open window, fullscreen toggle, clock.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el } = KX;

  const taskButtons = new Map(); // window id -> button element

  /* ------------------------------------------------------------- task buttons */

  function onTaskClick(win) {
    if (win.minimized) KX.wm.focus(win);
    else if (KX.wm.getActiveId() === win.id) KX.wm.minimize(win);
    else KX.wm.focus(win);
  }

  function renderTasks() {
    const container = document.getElementById('kx-task-buttons');
    const activeId = KX.wm.getActiveId();
    const seen = new Set();

    KX.wm.list().forEach((win) => {
      seen.add(win.id);
      let button = taskButtons.get(win.id);
      if (!button) {
        const app = KX.apps[win.appId];
        button = el(
          'button',
          { class: 'kx-task', type: 'button', onclick: () => onTaskClick(win) },
          el('span', { class: 'kx-task-icon', html: KX.icon(app ? app.icon : 'file', 18) }),
          el('span', { class: 'kx-task-label' })
        );
        taskButtons.set(win.id, button);
        container.appendChild(button);
      }
      button.querySelector('.kx-task-label').textContent = win.title;
      button.title = win.title;
      button.classList.toggle('active', win.id === activeId && !win.minimized);
      button.classList.toggle('minimized', win.minimized);
    });

    taskButtons.forEach((button, id) => {
      if (!seen.has(id)) {
        button.remove();
        taskButtons.delete(id);
      }
    });
  }

  /* --------------------------------------------------------------- start menu */

  function buildStartMenu() {
    const list = document.getElementById('kx-start-list');
    list.textContent = '';

    const item = (iconHtml, label, action) =>
      el(
        'li',
        null,
        el(
          'button',
          {
            class: 'kx-start-item',
            type: 'button',
            onclick: () => {
              setStartMenu(false);
              action();
            },
          },
          el('span', { class: 'kx-start-icon', html: iconHtml }),
          el('span', { text: label })
        )
      );

    KX.listApps()
      .filter((app) => app.startMenu)
      .forEach((app) => list.appendChild(item(KX.icon(app.icon, 26), app.title, () => KX.openApp(app.id))));

    list.appendChild(el('li', { class: 'kx-start-sep', role: 'separator' }));
    list.appendChild(
      item('<span class="kx-start-glyph">⛶</span>', 'Fullscreen', () => KX.desktop.toggleFullscreen())
    );
    list.appendChild(item('<span class="kx-start-glyph">⏻</span>', 'Shut down…', () => KX.desktop.shutdown()));
  }

  function setStartMenu(open) {
    const menu = document.getElementById('kx-start-menu');
    const button = document.getElementById('kx-start-button');
    menu.hidden = !open;
    button.classList.toggle('active', open);
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      const first = menu.querySelector('.kx-start-item');
      if (first) first.focus({ preventScroll: true });
    }
  }

  function initStartMenu() {
    const menu = document.getElementById('kx-start-menu');
    const button = document.getElementById('kx-start-button');

    buildStartMenu();
    KX.on('apps:changed', buildStartMenu);

    button.addEventListener('click', () => setStartMenu(menu.hidden));
    document.addEventListener('pointerdown', (e) => {
      if (!menu.hidden && !menu.contains(e.target) && !button.contains(e.target)) setStartMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) {
        setStartMenu(false);
        button.focus();
      }
    });
    menu.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = Array.from(menu.querySelectorAll('.kx-start-item'));
      const index = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next].focus();
      e.preventDefault();
    });
  }

  /* -------------------------------------------------------------------- clock */

  function initClock() {
    const clock = document.getElementById('kx-clock');
    let last = '';

    function tick() {
      const now = new Date();
      const text = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !KX.settings.get('clock24') });
      if (text !== last) {
        clock.textContent = text;
        clock.title = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        last = text;
      }
    }

    tick();
    setInterval(tick, 1000);
    KX.on('settings:changed', (change) => {
      if (change.key === 'clock24') {
        last = '';
        tick();
      }
    });
  }

  /* --------------------------------------------------------------------- init */

  KX.taskbar = {
    init() {
      KX.on('wm:changed', renderTasks);
      initStartMenu();
      initClock();
      renderTasks();
    },
    closeStartMenu: () => setStartMenu(false),
  };
})();
