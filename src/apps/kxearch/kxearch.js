(function () {
  'use strict';

  const KX = window.KXKOS;

  const PROXY = 'https://kxearch-proxy.haleannson.workers.dev/';
  const START_PAGE = 'https://kxko4b.github.io/custom-leverframe-diagrams/';

  function isHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function proxyUrl(url) {
    return PROXY + '?url=' + encodeURIComponent(url);
  }

  KX.registerApp({
    id: 'kxearch',
    title: 'KXEARCH',
    icon: 'search',
    width: 900,
    height: 600,
    minWidth: 560,
    minHeight: 380,
    singleton: true,
    desktop: true,
    startMenu: true,
    order: 5,

    launch(win, args) {
      const root = KX.el('div', {
        class: 'kx-kxearch'
      });

      const toolbar = KX.el('div', {
        class: 'kx-kxearch-toolbar'
      });

      const back = KX.el('button', {
        class: 'kx-kxearch-nav',
        text: '‹',
        title: 'Back'
      });

      const forward = KX.el('button', {
        class: 'kx-kxearch-nav',
        text: '›',
        title: 'Forward'
      });

      const refresh = KX.el('button', {
        class: 'kx-kxearch-nav',
        text: '↻',
        title: 'Refresh'
      });

      const input = KX.el('input', {
        class: 'kx-kxearch-address',
        type: 'text',
        placeholder: 'Search KXEARCH or enter a web address…',
        autocomplete: 'off',
        spellcheck: 'false'
      });

      const go = KX.el('button', {
        class: 'kx-btn primary kx-kxearch-go',
        text: 'Go'
      });

      toolbar.append(back, forward, refresh, input, go);

      const frame = KX.el('iframe', {
        class: 'kx-kxearch-frame',
        title: 'KXEARCH web view',
        referrerpolicy: 'no-referrer'
      });

      const status = KX.el('div', {
        class: 'kx-kxearch-status',
        text: 'Ready.'
      });

      let current = '';
      let history = [];
      let historyIndex = -1;

      function show(url, addHistory = true) {
        if (!isHttpUrl(url)) return;

        current = url;
        input.value = url;

        if (addHistory) {
          history = history.slice(0, historyIndex + 1);
          history.push(url);
          historyIndex = history.length - 1;
        }

        frame.src = proxyUrl(url);
        status.textContent = 'Loading ' + url;
      }

      function navigate() {
        const raw = input.value.trim();

        if (!raw) return;

        let url = raw;

        if (!isHttpUrl(raw)) {
          if (
            raw.includes('.') &&
            !raw.includes(' ')
          ) {
            url = 'https://' + raw;
          } else {
            status.textContent = 'KXEARCH search coming soon.';
            return;
          }
        }

        show(url);
      }

      go.addEventListener('click', navigate);

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          navigate();
        }
      });

      back.addEventListener('click', () => {
        if (historyIndex > 0) {
          historyIndex--;
          show(history[historyIndex], false);
        }
      });

      forward.addEventListener('click', () => {
        if (historyIndex + 1 < history.length) {
          historyIndex++;
          show(history[historyIndex], false);
        }
      });

      refresh.addEventListener('click', () => {
        if (current) {
          frame.src = proxyUrl(current);
          status.textContent = 'Refreshing…';
        }
      });

      frame.addEventListener('load', () => {
        status.textContent = current
          ? 'Loaded: ' + current
          : 'Ready.';
      });

      root.append(toolbar, frame, status);
      win.body.appendChild(root);

      show(
        args && args.url
          ? args.url
          : START_PAGE
      );
    }
  });
})();
