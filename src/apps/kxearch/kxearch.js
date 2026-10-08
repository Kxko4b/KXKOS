(function () {
  'use strict';

  const KX = window.KXKOS;

  const PROXY = 'https://kxearch-proxy.haleannson.workers.dev/';
  const START_PAGE = '';

  const SEARCH_PREFIX = 'kxsearch:';

  // Instant results for well known names, shown above the web results (and
  // still shown if the search service cannot be reached).
  const KNOWN_SITES = [
    ['youtube', 'YouTube', 'https://www.youtube.com/', 'Videos, music and live streams'],
    ['twitch', 'Twitch', 'https://www.twitch.tv/', 'Live streaming for gamers'],
    ['netflix', 'Netflix', 'https://www.netflix.com/', 'Movies and series'],
    ['wikipedia', 'Wikipedia', 'https://www.wikipedia.org/', 'The free encyclopedia'],
    ['github', 'GitHub', 'https://github.com/', 'Code hosting and collaboration'],
    ['reddit', 'Reddit', 'https://www.reddit.com/', 'Communities and discussions'],
    ['google', 'Google', 'https://www.google.com/', 'Search the web'],
    ['bing', 'Bing', 'https://www.bing.com/', 'Search the web'],
    ['duckduckgo', 'DuckDuckGo', 'https://duckduckgo.com/', 'Privacy-friendly search'],
    ['roblox', 'Roblox', 'https://www.roblox.com/', 'Games and experiences'],
    ['discord', 'Discord', 'https://discord.com/', 'Chat for communities'],
    ['steam', 'Steam', 'https://store.steampowered.com/', 'PC games store'],
    ['stackoverflow', 'Stack Overflow', 'https://stackoverflow.com/', 'Programming questions and answers'],
    ['mdn', 'MDN Web Docs', 'https://developer.mozilla.org/', 'Web development documentation'],
    ['imdb', 'IMDb', 'https://www.imdb.com/', 'Movies, series and cast info'],
    ['archive', 'Internet Archive', 'https://archive.org/', 'Free books, movies and the Wayback Machine'],
    ['supabase', 'Supabase', 'https://supabase.com/', 'Open source backend platform']
  ];

  function knownMatches(query) {
    const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (q.length < 3) return [];
    return KNOWN_SITES.filter(
      (s) => s[0].startsWith(q) || q.startsWith(s[0])
    ).map((s) => ({ title: s[1], url: s[2], description: s[3] }));
  }

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
  const frame = KX.el('iframe', {
    class: 'kx-kxearch-frame',
    title: 'Netflix',
    src: url,
    allow:
      'autoplay; encrypted-media; fullscreen; picture-in-picture',
    allowfullscreen: true,
    referrerpolicy: 'strict-origin-when-cross-origin'
  });

  setViewport(frame);
  status.textContent = 'Netflix';
  return;
}

        // ---------------------------------------------------------------
        // Everything else -> KXEARCH proxy
        // ---------------------------------------------------------------

        const frame = KX.el('iframe', {
          class: 'kx-kxearch-frame',
          title: 'KXEARCH web view',
          referrerpolicy: 'no-referrer',
          // Opaque origin: proxied pages cannot share storage with each other.
          sandbox:
            'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads'
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

      // -----------------------------------------------------------------
      // Search results page
      // -----------------------------------------------------------------

      let searchToken = 0;

      function pushHistory(entry) {
        history = history.slice(0, historyIndex + 1);
        history.push(entry);
        historyIndex = history.length - 1;
      }

      function resultButton(result) {
        const button = KX.el('button', {
          class: 'kx-kxearch-result',
          type: 'button',
          title: result.url
        });

        button.append(
          KX.el('div', { class: 'kx-kxearch-result-title', text: result.title }),
          KX.el('div', { class: 'kx-kxearch-result-url', text: result.url }),
          KX.el('div', {
            class: 'kx-kxearch-result-description',
            text: result.description || ''
          })
        );

        button.addEventListener('click', () => show(result.url));
        return button;
      }

      function renderSearch(query, results, note) {
        const container = KX.el('div', { class: 'kx-kxearch-search-container' });
        const page = KX.el('div', { class: 'kx-kxearch-search-page' });

        const hero = KX.el('div', { class: 'kx-kxearch-search-hero' });
        hero.append(
          KX.el('div', { class: 'kx-kxearch-search-logo', text: 'KXEARCH' }),
          KX.el('div', { class: 'kx-kxearch-search-hint', text: note })
        );

        const list = KX.el('div', { class: 'kx-kxearch-results' });

        if (results.length) {
          results.forEach((r) => list.appendChild(resultButton(r)));
        } else {
          list.appendChild(
            KX.el('div', {
              class: 'kx-kxearch-empty',
              text: 'No results for “' + query + '”. Try different words or enter a web address.'
            })
          );
        }

        page.append(hero, list);
        container.appendChild(page);
        setViewport(container);
      }

      async function showSearch(query, addHistory = true) {
        const entry = SEARCH_PREFIX + query;
        const token = ++searchToken;

        current = entry;
        input.value = query;

        if (addHistory) {
          pushHistory(entry);
        }

        const known = knownMatches(query);

        renderSearch(query, known, 'Searching…');
        status.textContent = 'Searching for “' + query + '”…';

        let results = [];
        let failed = false;

        try {
          const res = await fetch(PROXY + 'search?q=' + encodeURIComponent(query));

          if (!res.ok) {
            throw new Error('HTTP ' + res.status);
          }

          const data = await res.json();
          results = Array.isArray(data.results) ? data.results : [];
        } catch {
          failed = true;
        }

        if (token !== searchToken || current !== entry) {
          return; // the user moved on
        }

        const seen = new Set(known.map((k) => k.url));
        const merged = known.concat(
          results.filter((r) => r && isHttpUrl(r.url) && !seen.has(r.url))
        );

        renderSearch(
          query,
          merged,
          failed
            ? 'The search service could not be reached. Showing shortcuts only.'
            : 'Results for “' + query + '”'
        );

        status.textContent = failed
          ? 'Search unavailable.'
          : merged.length + ' result' + (merged.length === 1 ? '' : 's');
      }

      function load(entry) {
        if (entry.startsWith(SEARCH_PREFIX)) {
          showSearch(entry.slice(SEARCH_PREFIX.length), false);
        } else {
          show(entry, false);
        }
      }

      function navigate() {
        const raw = input.value.trim();

        if (!raw) {
          return;
        }

        if (isHttpUrl(raw)) {
          show(raw);
          return;
        }

        // "example.com" or "example.com/path" (no spaces, a dot, a letter TLD)
        if (/^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(raw)) {
          show('https://' + raw);
          return;
        }

        showSearch(raw);
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
          load(history[historyIndex]);
        }
      });

      forward.addEventListener('click', () => {
        if (historyIndex + 1 < history.length) {
          historyIndex++;
          load(history[historyIndex]);
        }
      });

      refresh.addEventListener('click', () => {
        if (!current) {
          return;
        }

        load(current);
      });

      root.append(
        toolbar,
        viewport,
        status
      );

      win.body.appendChild(root);

      if (args && args.url) {
  show(args.url);
} else {
  input.focus();
  status.textContent = 'Ready — search or enter a web address.';
}
    }
  });
})();