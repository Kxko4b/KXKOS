/*
 * KXKOS window manager.
 *
 * Reusable window system: apps never touch window chrome, they just receive a `win` object and
 * fill `win.body`. Supports open, close, minimize, maximize/restore, dragging, resizing, focus
 * and bring-to-front. Emits "wm:changed" whenever the window list or focus changes.
 *
 * Optional hooks an app can set on its window:
 *   win.onBeforeClose = async () => boolean   // return false to cancel closing (e.g. unsaved changes)
 *   win.onClose       = () => void            // cleanup after the window is gone
 *   win.isDirty       = () => boolean         // true if closing the browser tab would lose work
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el, clamp } = KX;

  const GLYPHS = {
    min: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 9h8" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>',
    max: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>',
    restore:
      '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4 4V1.6h6.4V8H8M1.6 4h6.4v6.4H1.6z" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
    close: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>',
  };

  const windows = new Map();
  let nextId = 1;
  let zCounter = 10;
  let activeId = null;
  let cascade = 0;

  const emitChange = () => KX.emit('wm:changed');

  function hostSize() {
    const host = document.getElementById('kx-windows');
    return {
      w: (host && host.clientWidth) || window.innerWidth || 1024,
      h: (host && host.clientHeight) || window.innerHeight || 768,
    };
  }

  function applyRect(win) {
    const s = win.el.style;
    s.left = win.rect.x + 'px';
    s.top = win.rect.y + 'px';
    s.width = win.rect.w + 'px';
    s.height = win.rect.h + 'px';
  }

  /* ------------------------------------------------------------------ create */

  function create(opts) {
    opts = opts || {};
    const size = hostSize();
    if (windows.size === 0) cascade = 0;

    const minW = opts.minWidth || 240;
    const minH = opts.minHeight || 140;
    const w = clamp(opts.width || 480, minW, Math.max(minW, size.w - 16));
    const h = clamp(opts.height || 360, minH, Math.max(minH, size.h - 16));
    const offset = (cascade++ % 8) * 28;
    // Open to the right of the desktop icon column when there is room, so icons stay reachable.
    const baseX = size.w - w >= 260 ? 130 : 40;
    const x = clamp(baseX + offset, 0, Math.max(0, size.w - w));
    const y = clamp(24 + offset, 0, Math.max(0, size.h - h));

    const id = 'win' + nextId++;
    const titleText = opts.title || 'Window';

    const titleEl = el('span', { class: 'kx-title', text: titleText });
    const btnMin = el('button', { class: 'kx-ctl kx-ctl-min', type: 'button', title: 'Minimize', 'aria-label': 'Minimize', html: GLYPHS.min });
    const btnMax = el('button', { class: 'kx-ctl kx-ctl-max', type: 'button', title: 'Maximize', 'aria-label': 'Maximize', html: GLYPHS.max });
    const btnClose = el('button', { class: 'kx-ctl kx-ctl-close', type: 'button', title: 'Close', 'aria-label': 'Close', html: GLYPHS.close });

    const titlebar = el(
      'div',
      { class: 'kx-titlebar' },
      el('span', { class: 'kx-title-icon', html: KX.icon(opts.icon || 'file', 18) }),
      titleEl,
      el('div', { class: 'kx-controls' }, btnMin, btnMax, btnClose)
    );
    const body = el('div', { class: 'kx-win-body' });
    const grip = el('div', { class: 'kx-resize', 'aria-hidden': 'true' });
    const root = el(
      'section',
      { class: 'kx-window', tabindex: '-1', role: 'group', 'aria-label': titleText, dataset: { win: id } },
      titlebar,
      body,
      grip
    );

    const win = {
      id,
      appId: opts.appId || null,
      title: titleText,
      el: root,
      body,
      rect: { x, y, w, h },
      minW,
      minH,
      minimized: false,
      maximized: false,
      closing: false,
      onBeforeClose: null,
      onClose: null,
      isDirty: null,
      _btnMax: btnMax,
      setTitle(text) {
        win.title = String(text);
        titleEl.textContent = win.title;
        root.setAttribute('aria-label', win.title);
        emitChange();
      },
      focus: () => focus(win),
      minimize: () => minimize(win),
      toggleMaximize: () => setMaximized(win, !win.maximized),
      close: (force) => close(win, force),
    };

    applyRect(win);
    windows.set(id, win);
    document.getElementById('kx-windows').appendChild(root);

    // Focus on any press inside the window (capture so inner handlers can't swallow it).
    root.addEventListener('pointerdown', () => {
      if (activeId !== win.id) focus(win);
    }, true);

    btnMin.addEventListener('click', () => minimize(win));
    btnMax.addEventListener('click', () => setMaximized(win, !win.maximized));
    btnClose.addEventListener('click', () => close(win));
    titlebar.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.kx-controls')) setMaximized(win, !win.maximized);
    });

    enableDrag(win, titlebar);
    enableResize(win, grip);

    if (size.w < 640 && opts.maximizeOnSmall !== false) setMaximized(win, true, true);

    focus(win);
    return win;
  }

  /* ------------------------------------------------------------ drag / resize */

  function snapZone(ev) {
    const size = hostSize();
    if (ev.clientY <= 6) return 'top';
    if (ev.clientX <= 6) return 'left';
    if (ev.clientX >= size.w - 7) return 'right';
    return null;
  }

  function snapRect(zone) {
    const size = hostSize();
    if (zone === 'left') return { x: 0, y: 0, w: Math.floor(size.w / 2), h: size.h };
    if (zone === 'right') return { x: Math.floor(size.w / 2), y: 0, w: Math.ceil(size.w / 2), h: size.h };
    return { x: 0, y: 0, w: size.w, h: size.h };
  }

  function snapPreview() {
    let el = document.getElementById('kx-snap-preview');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kx-snap-preview';
      (document.getElementById('kx-windows') || document.body).appendChild(el);
    }
    return el;
  }

  function enableDrag(win, handle) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.kx-controls') || win.maximized) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { x: win.rect.x, y: win.rect.y };
      let zone = null;
      handle.setPointerCapture(e.pointerId);
      win.el.classList.add('dragging');

      const move = (ev) => {
        const size = hostSize();
        // A snapped window gets its old size back as soon as it is dragged away.
        if (win._preSnap && (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4)) {
          const pre = win._preSnap;
          win._preSnap = null;
          win.rect.w = pre.w; win.rect.h = pre.h;
          origin.x = ev.clientX - Math.round(pre.w / 2) - (startX - ev.clientX) * 0;
          origin.y = win.rect.y;
          win._dragShift = { x: ev.clientX, y: ev.clientY };
        }
        const sx = win._dragShift ? win._dragShift.x : startX;
        const sy = win._dragShift ? win._dragShift.y : startY;
        // Keep at least 60px of the titlebar reachable on screen.
        win.rect.x = clamp(origin.x + ev.clientX - sx, 60 - win.rect.w, size.w - 60);
        win.rect.y = clamp(origin.y + ev.clientY - sy, 0, size.h - 30);
        applyRect(win);
        zone = snapZone(ev);
        const prev = snapPreview();
        if (zone) {
          const r = snapRect(zone);
          prev.style.cssText = 'display:block;left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px';
        } else prev.style.display = 'none';
      };
      const end = () => {
        win.el.classList.remove('dragging');
        win._dragShift = null;
        const prev = document.getElementById('kx-snap-preview');
        if (prev) prev.style.display = 'none';
        if (zone) {
          win._preSnap = { w: win.rect.w, h: win.rect.h };
          Object.assign(win.rect, snapRect(zone));
          applyRect(win);
          emitChange();
        }
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }

  function enableResize(win, handle) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || win.maximized) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { w: win.rect.w, h: win.rect.h };
      handle.setPointerCapture(e.pointerId);
      win.el.classList.add('dragging');

      const move = (ev) => {
        const size = hostSize();
        win.rect.w = clamp(origin.w + ev.clientX - startX, win.minW, Math.max(win.minW, size.w - win.rect.x));
        win.rect.h = clamp(origin.h + ev.clientY - startY, win.minH, Math.max(win.minH, size.h - win.rect.y));
        applyRect(win);
      };
      const end = () => {
        win.el.classList.remove('dragging');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', end);
        handle.removeEventListener('pointercancel', end);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });
  }

  /* ------------------------------------------------------------------- state */

  function focus(win) {
    if (!windows.has(win.id)) return;
    if (win.minimized) {
      win.minimized = false;
      win.el.classList.remove('minimized');
    }
    win.el.style.zIndex = String(++zCounter);
    if (activeId !== win.id) {
      const previous = windows.get(activeId);
      if (previous) previous.el.classList.remove('focused');
      activeId = win.id;
      win.el.classList.add('focused');
    }
    // Move keyboard focus into the window so typing goes to the app.
    if (!win.el.contains(document.activeElement)) {
      const target = win.el.querySelector('[data-autofocus]') || win.el.querySelector('textarea, input:not([type="hidden"]), [tabindex="0"]');
      (target || win.el).focus({ preventScroll: true });
    }
    emitChange();
  }

  function focusTopmost() {
    let top = null;
    windows.forEach((w) => {
      if (!w.minimized && (!top || Number(w.el.style.zIndex) > Number(top.el.style.zIndex))) top = w;
    });
    if (top) focus(top);
    else {
      activeId = null;
      emitChange();
    }
  }

  function minimize(win) {
    if (!windows.has(win.id) || win.minimized) return;
    win.minimized = true;
    win.el.classList.add('minimized');
    win.el.classList.remove('focused');
    if (activeId === win.id) {
      activeId = null;
      focusTopmost();
    }
    emitChange();
  }

  function setMaximized(win, on, silent) {
    win.maximized = on;
    win.el.classList.toggle('maximized', on);
    win._btnMax.innerHTML = on ? GLYPHS.restore : GLYPHS.max;
    win._btnMax.title = on ? 'Restore' : 'Maximize';
    win._btnMax.setAttribute('aria-label', on ? 'Restore' : 'Maximize');
    if (!silent) emitChange();
  }

  async function close(win, force) {
    if (!windows.has(win.id) || win.closing) return false;
    win.closing = true;
    if (!force && typeof win.onBeforeClose === 'function') {
      let ok = true;
      try {
        ok = await win.onBeforeClose();
      } catch (err) {
        console.error('[KXKOS] onBeforeClose failed:', err);
      }
      if (ok === false) {
        win.closing = false;
        return false;
      }
    }
    if (typeof win.onClose === 'function') {
      try {
        win.onClose();
      } catch (err) {
        console.error('[KXKOS] onClose failed:', err);
      }
    }
    windows.delete(win.id);
    win.el.remove();
    if (activeId === win.id) {
      activeId = null;
      focusTopmost();
    }
    emitChange();
    return true;
  }

  /** Close every window in turn, stopping if one refuses (e.g. user cancels "save changes?"). */
  async function closeAll() {
    for (const win of Array.from(windows.values())) {
      if (typeof win.onBeforeClose === 'function') focus(win);
      if (!(await close(win))) return false;
    }
    return true;
  }

  /* --------------------------------------------------------------------- API */

  KX.wm = {
    create,
    focus,
    restoreAndFocus: focus,
    minimize,
    maximize: (win) => setMaximized(win, true),
    restore: (win) => setMaximized(win, false),
    toggleMaximize: (win) => setMaximized(win, !win.maximized),
    close,
    closeAll,
    list: () => Array.from(windows.values()),
    get: (id) => windows.get(id) || null,
    findByApp: (appId) => Array.from(windows.values()).find((w) => w.appId === appId) || null,
    getActiveId: () => activeId,
  };
})();
