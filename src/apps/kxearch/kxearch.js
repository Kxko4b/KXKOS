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

  function youtubeId(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();

      if (host === 'youtu.be') {
        return u.pathname.slice(1).split('/')[0] || null;
      }

      if (host.endsWith('youtube.com')) {
        if (u.pathname === '/watch') {
          return u.searchParams.get('v');
        }

        const parts = u.pathname.split('/').filter(Boolean);

        if (parts[0] === 'shorts' || parts[0] === 'embed') {
          return parts[1] || null;
        }
      }
    } catch {}

    return null;
  }

  function twitchInfo(url) {
    try {
      const u = new URL(url);

      if (!u.hostname.toLowerCase().endsWith('twitch.tv')) {
        return null;
      }

      const parts = u.pathname.split('/').filter(Boolean);

      if (!parts.length) {
        return null;
      }

      if (parts[0] === 'videos' && parts[1]) {
        return {
          type: 'video',
          id: parts[1]
        };
      }

      if (parts[0] === 'clip' && parts[1]) {
        return {
          type: 'clip',
          id: parts[1]
        };
      }

      return {
        type: 'channel',
        name: parts[0]
      };
    } catch {
      return null;
    }
  }

  function isNetflix(url) {
    try {
      return new URL(url).hostname.toLowerCase().endsWith('netflix.com');
    } catch {
      return false;
    }
  }

  function mediaFrame(src, title) {
    return KX.el('iframe', {
      class: 'kx-kxearch-frame',
      title,
      src,
      allow:
        'autoplay; encrypted-media; fullscreen; picture-in-picture; web-share',
      allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin'
    });
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

      const viewport = KX.el('div', {
        class: 'kx-kxearch-viewport'
      });

      const status = KX.el('div', {
        class: 'kx-kxearch-status',
        text: 'Ready.'
      });

      let current = '';
      let history = [];
      let historyIndex = -1;
      let currentFrame = null;

      function setViewport(node) {
        viewport.replaceChildren(node);
        currentFrame =
          node.tagName === 'IFRAME'
            ? node
            : null;
      }

      function showNetflix(url) {
        const page = KX.el('div', {
          class: 'kx-kxearch-special-page'
        });

        const title = KX.el('div', {
          class: 'kx-kxearch-special-title',
          text: 'NETFLIX'
        });

        const text = KX.el('p', {
          class: 'kx-kxearch-special-text',
          text:
            'Netflix does not provide a general embeddable web player. KXEARCH cannot reliably embed the Netflix application itself.'
        });

        const open = KX.el('button', {
          class: 'kx-btn primary',
          text: 'Open Netflix'
        });

        open.addEventListener('click', () => {
          window.open(url, '_blank', 'noopener,noreferrer');
        });

        page.append(title, text, open);
        setViewport(page);
      }

      function show(url, addHistory = true) {
        if (!isHttpUrl(url)) {
          return;
        }

        current = url;
        input.value = url;

        if (addHistory) {
          history = history.slice(0, historyIndex + 1);
          history.push(url);
          historyIndex = history.length - 1;
        }

        // ---------------------------------------------------------------
        // YouTube
        // ---------------------------------------------------------------

        const yt = youtubeId(url);

        if (yt) {
          const frame = mediaFrame(
            'https://www.youtube.com/embed/' +
              encodeURIComponent(yt) +
              '?playsinline=1',
            'YouTube'
          );

          setViewport(frame);
          status.textContent = 'YouTube video';
          return;
        }

        // ---------------------------------------------------------------
        // Twitch
        // ---------------------------------------------------------------

        const twitch = twitchInfo(url);

        if (twitch) {
          const parent =
            location.hostname ||
            'localhost';

          let src =
            'https://player.twitch.tv/?parent=' +
            encodeURIComponent(parent) +
            '&autoplay=false';

          if (twitch.type === 'channel') {
            src +=
              '&channel=' +
              encodeURIComponent(twitch.name);
          }

          if (twitch.type === 'video') {
            src +=
              '&video=' +
              encodeURIComponent(twitch.id);
          }

          if (twitch.type === 'clip') {
            src =
              'https://clips.twitch.tv/embed?clip=' +
              encodeURIComponent(twitch.id) +
              '&parent=' +
              encodeURIComponent(parent) +
              '&autoplay=false';
          }

          const frame = mediaFrame(src, 'Twitch');

          setViewport(frame);
          status.textContent = 'Twitch';
          return;
        }

        // ---------------------------------------------------------------
        // Netflix
        // ---------------------------------------------------------------

        if (isNetflix(url)) {
          showNetflix(url);
          status.textContent = 'Netflix';
          return;
        }

        // ---------------------------------------------------------------
        // Everything else -> KXEARCH proxy
        // ---------------------------------------------------------------

        const frame = KX.el('iframe', {
          class: 'kx-kxearch-frame',
          title: 'KXEARCH web view',
          referrerpolicy: 'no-referrer'
        });

        frame.src = proxyUrl(url);

        setViewport(frame);

        status.textContent = 'Loading ' + url;

        frame.addEventListener('load', () => {
          if (current === url) {
            status.textContent = 'Loaded: ' + url;
          }
        });
      }

      function navigate() {
        const raw = input.value.trim();

        if (!raw) {
          return;
        }

        let url = raw;

        if (!isHttpUrl(raw)) {
          if (
            raw.includes('.') &&
            !raw.includes(' ')
          ) {
            url = 'https://' + raw;
          } else {
            status.textContent =
              'KXEARCH search coming soon.';
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
        if (!current) {
          return;
        }

        show(current, false);
      });

      root.append(
        toolbar,
        viewport,
        status
      );

      win.body.appendChild(root);

      show(
        args && args.url
          ? args.url
          : START_PAGE
      );
    }
  });
})();