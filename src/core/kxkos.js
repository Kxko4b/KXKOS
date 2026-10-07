/*
 * KXKOS core: global namespace, event bus, DOM helper, storage, settings and the app registry.
 *
 * KXKOS uses plain <script> tags (no bundler, no ES modules) so index.html also works when it is
 * opened straight from disk. Every module attaches itself to the global `KXKOS` object.
 */
(function () {
  'use strict';

  const KX = (window.KXKOS = window.KXKOS || {});

  KX.version = '0.1.0';
  KX.apps = {};
  KX.ui = {};

  /* ------------------------------------------------------------------ helpers */

  const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'readOnly']);

  KX.clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi);

  function appendAll(node, children) {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      if (Array.isArray(child)) appendAll(node, child);
      else if (child instanceof Node) node.appendChild(child);
      else node.appendChild(document.createTextNode(String(child)));
    }
  }

  /**
   * Tiny DOM builder: el('div', { class: 'x', onclick: fn, text: 'hi' }, child, child...)
   * `html` is for trusted built-in markup (icons) only. Use `text` for anything user-provided.
   */
  KX.el = function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'style') {
          if (typeof value === 'string') node.style.cssText = value;
          else Object.assign(node.style, value);
        } else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (PROPS.has(key)) node[key] = value;
        else node.setAttribute(key, value === true ? '' : String(value));
      }
    }
    appendAll(node, children);
    return node;
  };

  KX.formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  KX.formatDate = (ms) => {
    const d = new Date(ms);
    return (
      d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  /* ---------------------------------------------------------------- event bus */

  const listeners = {};

  /** Subscribe to an event. Returns an unsubscribe function. */
  KX.on = function on(name, fn) {
    (listeners[name] = listeners[name] || []).push(fn);
    return () => {
      listeners[name] = (listeners[name] || []).filter((f) => f !== fn);
    };
  };

  KX.emit = function emit(name, data) {
    (listeners[name] || []).slice().forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error('[KXKOS] handler for "' + name + '" failed:', err);
      }
    });
  };

  /* ------------------------------------------------------------------ storage */

  KX.storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('kxkos.' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem('kxkos.' + key, JSON.stringify(value));
        return true;
      } catch (err) {
        console.warn('[KXKOS] could not save "' + key + '":', err);
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem('kxkos.' + key);
      } catch (err) {
        /* ignore */
      }
    },
  };

  /* ----------------------------------------------------------------- settings */

  KX.wallpapers = [
    { id: 'bliss', name: 'Bliss' },
    { id: 'dusk', name: 'Dusk' },
    { id: 'night', name: 'Night' },
    { id: 'teal', name: 'Teal' },
  ];

  const DEFAULTS = { wallpaper: 'bliss', accent: '#3b8fe0', clock24: true };

  function sanitize(input) {
    const out = Object.assign({}, DEFAULTS, input && typeof input === 'object' ? input : {});
    if (!KX.wallpapers.some((w) => w.id === out.wallpaper)) out.wallpaper = DEFAULTS.wallpaper;
    if (typeof out.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(out.accent)) out.accent = DEFAULTS.accent;
    out.accent = out.accent.toLowerCase();
    out.clock24 = !!out.clock24;
    return { wallpaper: out.wallpaper, accent: out.accent, clock24: out.clock24 };
  }

  const settings = sanitize(KX.storage.get('settings', {}));

  KX.settings = {
    defaults: DEFAULTS,
    get(key) {
      return settings[key];
    },
    set(key, value) {
      if (!(key in DEFAULTS)) return false;
      const next = sanitize(Object.assign({}, settings, { [key]: value }));
      if (next[key] === settings[key]) return true;
      settings[key] = next[key];
      KX.storage.set('settings', settings);
      KX.emit('settings:changed', { key, value: settings[key] });
      return true;
    },
    reset() {
      Object.keys(DEFAULTS).forEach((key) => KX.settings.set(key, DEFAULTS[key]));
    },
  };

  /* ------------------------------------------------------------- app registry */

  /**
   * An app is: {
   *   id, title, icon (key of KXKOS.icons), width, height, minWidth, minHeight,
   *   singleton (only one window), desktop (show a desktop icon), startMenu (default true),
   *   order (sort position), launch(win, args)  // builds the UI inside win.body
   * }
   */
  KX.registerApp = function registerApp(app) {
    if (!app || !app.id || typeof app.launch !== 'function') {
      throw new Error('registerApp needs at least { id, launch }');
    }
    KX.apps[app.id] = Object.assign(
      { title: app.id, icon: 'file', width: 480, height: 360, singleton: false, desktop: false, startMenu: true, order: 100 },
      app
    );
    KX.emit('apps:changed', KX.apps[app.id]);
  };

  KX.listApps = () => Object.values(KX.apps).sort((a, b) => a.order - b.order);

  KX.openApp = function openApp(id, args) {
    const app = KX.apps[id];
    if (!app) return null;
    if (app.singleton) {
      const existing = KX.wm.findByApp(id);
      if (existing) {
        KX.wm.focus(existing);
        return existing;
      }
    }
    const win = KX.wm.create({
      appId: app.id,
      title: app.title,
      icon: app.icon,
      width: app.width,
      height: app.height,
      minWidth: app.minWidth,
      minHeight: app.minHeight,
    });
    try {
      app.launch(win, args || {});
    } catch (err) {
      console.error('[KXKOS] app "' + id + '" failed to launch:', err);
      win.body.textContent = 'Sorry, ' + app.title + ' crashed while starting: ' + err.message;
    }
    return win;
  };

  /** Open a virtual-filesystem file in whichever app handles it (Notepad for now). */
  KX.openFile = (path) => KX.openApp('notepad', { path });
})();


