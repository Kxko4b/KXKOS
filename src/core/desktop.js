/*
 * KXKOS desktop: wallpaper + accent colour, desktop icons, fullscreen, shut down.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el } = KX;

  /* ----------------------------------------------------------- look and feel */

  function applyWallpaper(id) {
    document.getElementById('kx-desktop').setAttribute('data-wallpaper', id);
  }

  function applyAccent(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const root = document.documentElement.style;
    root.setProperty('--kx-accent', hex);
    root.setProperty('--kx-accent-ink', luminance > 0.62 ? '#1b2a49' : '#ffffff');
  }

  /* ------------------------------------------------------------ desktop icons */

  function renderIcons() {
    const container = document.getElementById('kx-icons');
    container.textContent = '';

    KX.listApps()
      .filter((app) => app.desktop)
      .forEach((app) => {
        const button = el(
          'button',
          {
            class: 'kx-desktop-icon',
            type: 'button',
            title: app.title,
            onclick: (e) => {
              if (e.pointerType === 'touch') KX.openApp(app.id);
              else selectIcon(button);
            },
            ondblclick: () => KX.openApp(app.id),
            onkeydown: (e) => {
              if (e.key === 'Enter') KX.openApp(app.id);
            },
          },
          el('span', { html: KX.icon(app.icon, 44) }),
          el('span', { class: 'kx-desktop-icon-label', text: app.title })
        );
        container.appendChild(button);
      });
  }

  function selectIcon(button) {
    document.querySelectorAll('.kx-desktop-icon.selected').forEach((n) => n.classList.remove('selected'));
    if (button) button.classList.add('selected');
  }

  /* --------------------------------------------------------------- fullscreen */

  const root = document.documentElement;
  const requestFs = root.requestFullscreen || root.webkitRequestFullscreen;
  const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

  function toggleFullscreen() {
    if (!requestFs) return false;
    try {
      const result = fsElement() ? exitFs.call(document) : requestFs.call(root);
      if (result && result.catch) result.catch(() => {});
    } catch (err) {
      /* browsers may refuse without a user gesture */
    }
    return true;
  }

  function initFullscreen() {
    const button = document.getElementById('kx-fullscreen-button');
    if (!requestFs) {
      button.hidden = true; // e.g. iPhone Safari has no fullscreen API
      return;
    }
    button.addEventListener('click', toggleFullscreen);
    const sync = () => button.classList.toggle('active', !!fsElement());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
  }

  /* ----------------------------------------------------------------- shutdown */

  async function shutdown() {
    const closed = await KX.wm.closeAll();
    if (!closed) return false;
    const screen = document.getElementById('kx-shutdown');
    screen.hidden = false;
    screen.focus();
    const powerOn = () => {
      screen.hidden = true;
      screen.removeEventListener('click', powerOn);
      screen.removeEventListener('keydown', powerOn);
    };
    screen.addEventListener('click', powerOn);
    screen.addEventListener('keydown', powerOn);
    return true;
  }

  /* --------------------------------------------------------------------- init */

  KX.desktop = {
    init() {
      applyWallpaper(KX.settings.get('wallpaper'));
      applyAccent(KX.settings.get('accent'));
      renderIcons();
      KX.on('apps:changed', renderIcons);
      KX.on('settings:changed', (change) => {
        if (change.key === 'wallpaper') applyWallpaper(change.value);
        if (change.key === 'accent') applyAccent(change.value);
      });

      // Clicking the bare desktop clears the icon selection and dismisses the start menu.
      document.getElementById('kx-desktop').addEventListener('pointerdown', (e) => {
        if (e.target.id === 'kx-desktop' || e.target.id === 'kx-icons') selectIcon(null);
      });

      // Warn before the browser tab closes if an app has unsaved work.
      window.addEventListener('beforeunload', (e) => {
        if (KX.wm.list().some((w) => typeof w.isDirty === 'function' && w.isDirty())) {
          e.preventDefault();
          e.returnValue = '';
        }
      });

      initFullscreen();
    },
    toggleFullscreen,
    shutdown,
    applyWallpaper,
    applyAccent,
  };
})();
