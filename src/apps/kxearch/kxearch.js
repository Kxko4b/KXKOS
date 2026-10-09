(function () {
  'use strict';

  const KX = window.KXKOS;

  const PROXY = 'https://kxearch-proxy.haleannson.workers.dev/';
  const START_PAGE = '';

  const SEARCH_PREFIX = 'kxsearch:';
  const IMAGES_PREFIX = 'kximages:';
  const VIDEOS_PREFIX = 'kxvideos:';
  const NEWTAB = 'kxnew:';
  const YOUTUBE_HOME = 'kxyoutube:';
  const BM_KEY = 'kxkos.kxearch.bookmarks';

  const DEFAULT_BOOKMARKS = [
    { title: 'YouTube', url: 'https://www.youtube.com/' },
    { title: 'Wikipedia', url: 'https://www.wikipedia.org/' },
    { title: 'GitHub', url: 'https://github.com/' },
    { title: 'Twitch', url: 'https://www.twitch.tv/' },
    { title: 'Reddit', url: 'https://www.reddit.com/' }
  ];

  const AUTH_HOSTS = [
    'accounts.google.com', 'accounts.youtube.com', 'login.live.com',
    'login.microsoftonline.com', 'appleid.apple.com', 'id.twitch.tv'
  ];

  function isAuthUrl(url) {
    try {
      return AUTH_HOSTS.includes(new URL(url).hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  function isYouTubeHome(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      return (
        (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') &&
        (u.pathname === '/' || u.pathname === '')
      );
    } catch {
      return false;
    }
  }

  function youtubeSearchQuery(url) {
    try {
      const u = new URL(url);
      if (u.hostname.toLowerCase().endsWith('youtube.com') && u.pathname === '/results') {
        return u.searchParams.get('search_query');
      }
    } catch {}
    return null;
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  function loadBookmarks() {
    try {
      const raw = JSON.parse(localStorage.getItem(BM_KEY));
      if (Array.isArray(raw)) {
        return raw.filter((b) => b && typeof b.title === 'string' && isHttpUrl(b.url));
      }
    } catch {}
    return DEFAULT_BOOKMARKS.slice();
  }

  function saveBookmarks(list) {
    try {
      localStorage.setItem(BM_KEY, JSON.stringify(list));
    } catch {}
  }

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

  const TWITCH_RESERVED = new Set([
    'directory', 'search', 'downloads', 'jobs', 'p', 'settings', 'login', 'signup', 'turbo',
    'store', 'prime', 'friends', 'subscriptions', 'wallet', 'drops', 'inventory', 'u', 'user',
    'moderator', 'dashboard', 'popout', 'embed', 'team', 'broadcast', 'messages', 'payments'
  ]);

  function isTwitchHost(url) {
    try {
      const h = new URL(url).hostname.toLowerCase();
      return h === 'twitch.tv' || h.endsWith('.twitch.tv');
    } catch {
      return false;
    }
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

      if (TWITCH_RESERVED.has(parts[0].toLowerCase())) {
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
    width: 960,
    height: 640,
    minWidth: 560,
    minHeight: 380,
    singleton: true,
    desktop: true,
    startMenu: true,
    order: 5,

    launch(win, args) {
      const root = KX.el('div', { class: 'kx-kxearch' });

      // ---- tab strip ----------------------------------------------------
      const tabStrip = KX.el('div', { class: 'kx-kxearch-tabs' });
      const addTab = KX.el('button', {
        class: 'kx-kxearch-tab-add', type: 'button', text: '+', title: 'New tab'
      });

      // ---- toolbar ------------------------------------------------------
      const toolbar = KX.el('div', { class: 'kx-kxearch-toolbar' });
      const back = KX.el('button', { class: 'kx-kxearch-nav', text: '‹', title: 'Back' });
      const forward = KX.el('button', { class: 'kx-kxearch-nav', text: '›', title: 'Forward' });
      const refresh = KX.el('button', { class: 'kx-kxearch-nav', text: '↻', title: 'Refresh' });
      const input = KX.el('input', {
        class: 'kx-kxearch-address',
        type: 'text',
        placeholder: 'Search KXEARCH or enter a web address…',
        autocomplete: 'off',
        spellcheck: 'false'
      });
      const star = KX.el('button', { class: 'kx-kxearch-nav kx-kxearch-star', text: '☆', title: 'Bookmark this page' });
      const goBtn = KX.el('button', { class: 'kx-btn primary kx-kxearch-go', text: 'Go' });
      toolbar.append(back, forward, refresh, input, star, goBtn);

      const bar = KX.el('div', { class: 'kx-kxearch-bookmarks' });
      const viewport = KX.el('div', { class: 'kx-kxearch-viewport' });
      const status = KX.el('div', { class: 'kx-kxearch-status', text: 'Ready.' });

      // ---- state --------------------------------------------------------
      let bookmarks = loadBookmarks();
      const tabs = [];
      let active = null;
      let nextId = 1;

      function setStatus(tab, text) {
        tab.status = text;
        if (tab === active) status.textContent = text;
      }

      function displayOf(entry) {
        if (entry.startsWith(SEARCH_PREFIX)) return entry.slice(SEARCH_PREFIX.length);
        if (entry.startsWith(IMAGES_PREFIX)) return entry.slice(IMAGES_PREFIX.length);
        if (entry.startsWith(VIDEOS_PREFIX)) return entry.slice(VIDEOS_PREFIX.length);
        if (entry === NEWTAB) return '';
        if (entry === YOUTUBE_HOME) return 'https://www.youtube.com/';
        return entry;
      }

      function bookmarkUrl(entry) {
        if (entry === YOUTUBE_HOME) return 'https://www.youtube.com/';
        return isHttpUrl(entry) ? entry : null;
      }

      function isBookmarked(url) {
        return bookmarks.some((b) => b.url === url);
      }

      function setTitle(tab, title) {
        tab.title = title;
        tab.label.textContent = title.length > 22 ? title.slice(0, 21) + '…' : title;
        tab.el.title = title;
      }

      function syncUI() {
        if (!active) return;
        input.value = displayOf(active.current);
        back.disabled = active.index <= 0;
        forward.disabled = active.index + 1 >= active.history.length;
        const url = bookmarkUrl(active.current);
        star.textContent = url && isBookmarked(url) ? '★' : '☆';
        star.disabled = !url;
        status.textContent = active.status || '';
      }

      function renderBookmarks() {
        bar.replaceChildren();
        if (!bookmarks.length) {
          bar.appendChild(KX.el('span', { class: 'kx-kxearch-bookmarks-empty', text: 'No bookmarks yet. Click ☆ to add one.' }));
        }
        bookmarks.forEach((b) => {
          const item = KX.el('span', { class: 'kx-kxearch-bookmark' });
          const open = KX.el('button', { class: 'kx-kxearch-bookmark-open', type: 'button', text: b.title, title: b.url });
          const del = KX.el('button', { class: 'kx-kxearch-bookmark-del', type: 'button', text: '×', title: 'Remove bookmark' });
          open.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) newTab(b.url);
            else go(active, b.url);
          });
          open.addEventListener('auxclick', (e) => {
            if (e.button === 1) newTab(b.url);
          });
          del.addEventListener('click', () => {
            bookmarks = bookmarks.filter((x) => x !== b);
            saveBookmarks(bookmarks);
            renderBookmarks();
            refreshNewTabs();
            syncUI();
          });
          item.append(open, del);
          bar.appendChild(item);
        });
      }

      function refreshNewTabs() {
        tabs.forEach((t) => {
          if (t.current === NEWTAB) render(t, NEWTAB);
        });
      }

      // ---- pane helpers ---------------------------------------------------
      function setPane(tab, node) {
        tab.pane.replaceChildren(node);
        tab.frame = node.tagName === 'IFRAME' ? node : null;
      }

      function specialPage(title, message, buttons) {
        const page = KX.el('div', { class: 'kx-kxearch-special-page' });
        page.append(
          KX.el('div', { class: 'kx-kxearch-special-title', text: title }),
          KX.el('p', { class: 'kx-kxearch-special-text', text: message })
        );
        (buttons || []).forEach((b) => page.appendChild(b));
        return page;
      }

      // Player with a fallback bar: YouTube/Twitch sometimes refuse to play
      // (for example when KXKOS is opened from a file), so offer alternatives.
      function embedView(tab, src, title, pageUrl) {
        const wrap = KX.el('div', { class: 'kx-kxearch-embed' });
        const barEl = KX.el('div', { class: 'kx-kxearch-embed-bar' });
        const frame = mediaFrame(src, title);
        const note = KX.el('span', {
          class: 'kx-kxearch-embed-note',
          text: location.protocol === 'file:'
            ? 'KXKOS is opened from a file (file://). ' + title + ' refuses to play there. Host KXKOS (GitHub Pages) or run python3 -m http.server.'
            : 'Stuck on loading? Try the other options:'
        });
        const mk = (label, fn) => {
          const b = KX.el('button', { class: 'kx-btn', type: 'button', text: label });
          b.addEventListener('click', fn);
          return b;
        };
        const player = mk('Player', () => { frame.src = src; });
        const viaProxy = mk('Via proxy', () => {
          frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads');
          frame.src = proxyUrl(pageUrl);
        });
        const nocookie = pageUrl && youtubeId(pageUrl)
          ? mk('Privacy player', () => { frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(youtubeId(pageUrl)) + '?playsinline=1'; })
          : null;
        const out = mk('New tab', () => window.open(pageUrl, '_blank', 'noopener,noreferrer'));
        const row = KX.el('div', { class: 'kx-kxearch-embed-row' });
        const tw = twitchInfo(pageUrl);
        let chat = null;
        const chatBtn = tw && tw.type === 'channel'
          ? mk('Chat', () => {
              if (chat) {
                chat.remove();
                chat = null;
                return;
              }
              chat = KX.el('iframe', {
                class: 'kx-kxearch-embed-chat',
                title: 'Twitch chat',
                src: 'https://www.twitch.tv/embed/' + encodeURIComponent(tw.name) + '/chat?parent=' + encodeURIComponent(location.hostname || 'localhost') + '&darkpopout',
                referrerpolicy: 'strict-origin-when-cross-origin'
              });
              row.appendChild(chat);
            })
          : null;
        barEl.append(note, player);
        if (chatBtn) barEl.appendChild(chatBtn);
        if (nocookie) barEl.appendChild(nocookie);
        barEl.append(viaProxy, out);
        row.appendChild(frame);
        wrap.append(barEl, row);
        return wrap;
      }

      function externalButton(url, label) {
        const b = KX.el('button', { class: 'kx-btn primary', type: 'button', text: label });
        b.addEventListener('click', () => window.open(url, '_blank', 'noopener,noreferrer'));
        return b;
      }

      function searchForm(tab, initial, big, placeholder) {
        const form = KX.el('form', { class: 'kx-kxearch-searchform' + (big ? ' big' : '') });
        const field = KX.el('input', {
          class: 'kx-kxearch-bigsearch',
          type: 'text',
          value: initial || '',
          placeholder: placeholder || 'Search the web',
          autocomplete: 'off',
          spellcheck: 'false'
        });
        const btn = KX.el('button', { class: 'kx-btn primary', type: 'submit', text: 'Search' });
        form.append(field, btn);
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          submit(tab, field.value);
        });
        return { form, field };
      }

      // ---- pages: new tab, YouTube home, search, images ------------------
      function renderNewTab(tab) {
        const container = KX.el('div', { class: 'kx-kxearch-search-container' });
        const hero = KX.el('div', { class: 'kx-kxearch-newtab' });
        const { form, field } = searchForm(tab, '', true, 'Search KXEARCH or type a web address');
        hero.append(KX.el('div', { class: 'kx-kxearch-search-logo', text: 'KXEARCH' }), form);

        const tiles = KX.el('div', { class: 'kx-kxearch-tiles' });
        bookmarks.slice(0, 10).forEach((b) => {
          const tile = KX.el('button', { class: 'kx-kxearch-tile', type: 'button', title: b.url });
          tile.append(
            KX.el('span', { class: 'kx-kxearch-tile-icon', text: (b.title[0] || '?').toUpperCase() }),
            KX.el('span', { class: 'kx-kxearch-tile-name', text: b.title })
          );
          tile.addEventListener('click', () => go(tab, b.url));
          tiles.appendChild(tile);
        });
        hero.appendChild(tiles);
        container.appendChild(hero);
        setPane(tab, container);
        setTitle(tab, 'New Tab');
        setStatus(tab, 'Ready — search or enter a web address.');
        if (tab === active) setTimeout(() => field.focus(), 0);
      }

      function renderYouTube(tab) {
        const container = KX.el('div', { class: 'kx-kxearch-search-container' });
        const hero = KX.el('div', { class: 'kx-kxearch-newtab' });
        const { form } = searchForm(tab, '', true, 'Search YouTube videos');
        // Replace default submit with a YouTube-scoped search.
        const fresh = form.cloneNode(true);
        const field = fresh.querySelector('input');
        fresh.addEventListener('submit', (e) => {
          e.preventDefault();
          const q = field.value.trim();
          if (q) go(tab, VIDEOS_PREFIX + q);
        });
        hero.append(
          KX.el('div', { class: 'kx-kxearch-search-logo', text: 'YouTube' }),
          fresh,
          KX.el('p', {
            class: 'kx-kxearch-search-hint',
            text:
              'Search for videos, then click one to watch it in the built-in player. KXEARCH cannot sign in for you, but the player uses your normal browser\'s YouTube login if you are signed in to youtube.com in another tab.'
          }),
          externalButton('https://www.youtube.com/', 'Open youtube.com in a normal tab')
        );
        container.appendChild(hero);
        setPane(tab, container);
        setTitle(tab, 'YouTube');
        setStatus(tab, 'YouTube');
      }

      async function loadLive(tab, box, q) {
        try {
          const res = await fetch(PROXY + 'twitch/streams' + (q ? '?q=' + encodeURIComponent(q) : ''));
          const data = await res.json();
          if (!data.configured || !data.streams || !data.streams.length) return;
          box.appendChild(KX.el('h3', { class: 'kx-kxearch-live-title', text: 'Live now' }));
          const grid = KX.el('div', { class: 'kx-kxearch-live-grid' });
          data.streams.forEach((s) => {
            const card = KX.el('button', { class: 'kx-kxearch-live-card', type: 'button', title: s.title || '' });
            if (s.thumb && /^https:\/\//.test(s.thumb)) card.appendChild(KX.el('img', { src: s.thumb, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }));
            card.appendChild(KX.el('span', { class: 'kx-kxearch-live-name', text: s.name + (s.viewers != null ? ' · ' + s.viewers : '') }));
            card.appendChild(KX.el('span', { class: 'kx-kxearch-live-game', text: s.game || '' }));
            card.addEventListener('click', () => go(tab, 'https://www.twitch.tv/' + s.login));
            grid.appendChild(card);
          });
          box.appendChild(grid);
        } catch { /* worker offline: the quick tiles still work */ }
      }

      function renderTwitchHome(tab) {
        const container = KX.el('div', { class: 'kx-kxearch-search-container' });
        const hero = KX.el('div', { class: 'kx-kxearch-newtab' });
        const { form } = searchForm(tab, '', true, 'Channel name, e.g. shroud');
        const fresh = form.cloneNode(true);
        const field = fresh.querySelector('input');
        fresh.querySelector('button').textContent = 'Watch';
        fresh.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = field.value.trim().replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
          if (name) go(tab, 'https://www.twitch.tv/' + name);
        });
        hero.append(
          KX.el('div', { class: 'kx-kxearch-search-logo', text: 'Twitch' }),
          fresh,
          KX.el('p', {
            class: 'kx-kxearch-search-hint',
            text: 'Type a channel name to watch the stream in the built-in player. Browsing Twitch is not possible inside KXEARCH. To log in, open a channel and use Chat: its login runs on twitch.tv itself.'
          }),
          externalButton('https://www.twitch.tv/', 'Open twitch.tv in a normal tab')
        );
        const tiles = KX.el('div', { class: 'kx-kxearch-tiles' });
        ['kaicenat', 'xqc', 'pokimane', 'shroud', 'summit1g', 'ninja', 'tfue', 'asmongold'].forEach((name) => {
          const tile = KX.el('button', { class: 'kx-kxearch-tile', type: 'button', title: 'twitch.tv/' + name });
          tile.append(
            KX.el('span', { class: 'kx-kxearch-tile-icon', text: name[0].toUpperCase() }),
            KX.el('span', { class: 'kx-kxearch-tile-name', text: name })
          );
          tile.addEventListener('click', () => go(tab, 'https://www.twitch.tv/' + name));
          tiles.appendChild(tile);
        });
        hero.appendChild(tiles);
        const live = KX.el('div', { class: 'kx-kxearch-live' });
        hero.appendChild(live);
        loadLive(tab, live, '');
        container.appendChild(hero);
        setPane(tab, container);
        setTitle(tab, 'Twitch');
        setStatus(tab, 'Twitch');
      }

      function resultTabs(tab, query, type) {
        const row = KX.el('div', { class: 'kx-kxearch-result-tabs' });
        [['all', 'All', SEARCH_PREFIX], ['videos', 'Videos', VIDEOS_PREFIX], ['images', 'Images', IMAGES_PREFIX]].forEach(([id, label, prefix]) => {
          const b = KX.el('button', {
            class: 'kx-kxearch-result-tab' + (id === type ? ' active' : ''),
            type: 'button',
            text: label
          });
          b.addEventListener('click', () => {
            if (id !== type) go(tab, prefix + query);
          });
          row.appendChild(b);
        });
        return row;
      }

      function resultsShell(tab, query, type, note) {
        const container = KX.el('div', { class: 'kx-kxearch-search-container' });
        const page = KX.el('div', { class: 'kx-kxearch-search-page' });
        const hero = KX.el('div', { class: 'kx-kxearch-search-hero compact' });
        const { form } = searchForm(tab, query, false);
        hero.append(
          KX.el('div', { class: 'kx-kxearch-search-logo small', text: 'KXEARCH' }),
          form,
          resultTabs(tab, query, type),
          KX.el('div', { class: 'kx-kxearch-search-hint', text: note })
        );
        page.appendChild(hero);
        container.appendChild(page);
        return { container, page };
      }

      function resultButton(tab, result) {
        const button = KX.el('button', { class: 'kx-kxearch-result', type: 'button', title: result.url });
        button.append(
          KX.el('div', { class: 'kx-kxearch-result-title', text: result.title }),
          KX.el('div', { class: 'kx-kxearch-result-url', text: result.url }),
          KX.el('div', { class: 'kx-kxearch-result-description', text: result.description || '' })
        );
        button.addEventListener('click', () => go(tab, result.url));
        return button;
      }

      function drawResults(tab, query, results, note) {
        const { container, page } = resultsShell(tab, query, 'all', note);
        const list = KX.el('div', { class: 'kx-kxearch-results' });
        if (results.length) {
          results.forEach((r) => list.appendChild(resultButton(tab, r)));
        } else {
          list.appendChild(KX.el('div', {
            class: 'kx-kxearch-empty',
            text: 'No results for “' + query + '”. Try different words or enter a web address.'
          }));
        }
        page.appendChild(list);
        setPane(tab, container);
      }

      async function doSearch(tab, query) {
        const token = (tab.token = (tab.token || 0) + 1);
        const known = knownMatches(query);
        setTitle(tab, query);
        drawResults(tab, query, known, 'Searching…');
        setStatus(tab, 'Searching for “' + query + '”…');

        let results = [];
        let failed = false;
        try {
          const res = await fetch(PROXY + 'search?q=' + encodeURIComponent(query));
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          results = Array.isArray(data.results) ? data.results : [];
        } catch {
          failed = true;
        }
        if (tab.token !== token) return;

        const seen = new Set(known.map((k) => k.url));
        const merged = known.concat(results.filter((r) => r && isHttpUrl(r.url) && !seen.has(r.url)));
        drawResults(
          tab, query, merged,
          failed ? 'The search service could not be reached. Showing shortcuts only.' : 'Results for “' + query + '”'
        );
        setStatus(tab, failed ? 'Search unavailable.' : merged.length + ' result' + (merged.length === 1 ? '' : 's'));
      }

      function proxied(url) {
        return proxyUrl(url);
      }

      function lightbox(tab, pane, item) {
        const box = KX.el('div', { class: 'kx-kxearch-lightbox' });
        const img = KX.el('img', { class: 'kx-kxearch-lightbox-img', alt: item.title || '' });
        img.src = proxied(item.image);
        img.addEventListener('error', () => {
          if (item.thumb && img.dataset.fell !== '1') {
            img.dataset.fell = '1';
            img.src = proxied(item.thumb);
          }
        });
        const caption = KX.el('div', { class: 'kx-kxearch-lightbox-caption', text: item.title || '' });
        const actions = KX.el('div', { class: 'kx-kxearch-lightbox-actions' });
        const close = KX.el('button', { class: 'kx-btn', type: 'button', text: 'Close' });
        close.addEventListener('click', () => box.remove());
        actions.appendChild(close);
        if (item.url) {
          const visit = KX.el('button', { class: 'kx-btn primary', type: 'button', text: 'Visit page' });
          visit.addEventListener('click', () => go(tab, item.url));
          actions.appendChild(visit);
        }
        box.append(img, caption, actions);
        box.addEventListener('click', (e) => {
          if (e.target === box) box.remove();
        });
        pane.appendChild(box);
      }

      function drawImages(tab, query, items, note) {
        const { container, page } = resultsShell(tab, query, 'images', note);
        if (items.length) {
          const grid = KX.el('div', { class: 'kx-kxearch-image-grid' });
          items.forEach((item) => {
            const cell = KX.el('button', { class: 'kx-kxearch-image-cell', type: 'button', title: item.title || '' });
            const img = KX.el('img', { alt: item.title || '', loading: 'lazy' });
            img.src = proxied(item.thumb);
            cell.appendChild(img);
            cell.addEventListener('click', () => lightbox(tab, tab.pane, item));
            grid.appendChild(cell);
          });
          page.appendChild(grid);
        } else {
          const box = KX.el('div', { class: 'kx-kxearch-results' });
          box.appendChild(KX.el('div', {
            class: 'kx-kxearch-empty',
            text: 'No images found for “' + query + '”.'
          }));
          page.appendChild(box);
        }
        setPane(tab, container);
      }

      function drawVideos(tab, query, items, note) {
        const { container, page } = resultsShell(tab, query, 'videos', note);
        if (items.length) {
          const grid = KX.el('div', { class: 'kx-kxearch-video-grid' });
          items.forEach((v) => {
            const card = KX.el('button', { class: 'kx-kxearch-video-card', type: 'button', title: v.title });
            const thumb = KX.el('div', { class: 'kx-kxearch-video-thumb' });
            if (v.thumb) {
              const img = KX.el('img', { alt: '', loading: 'lazy' });
              img.src = proxyUrl(v.thumb);
              thumb.appendChild(img);
            }
            if (v.duration) thumb.appendChild(KX.el('span', { class: 'kx-kxearch-video-time', text: v.duration }));
            card.append(
              thumb,
              KX.el('div', { class: 'kx-kxearch-video-title', text: v.title }),
              KX.el('div', { class: 'kx-kxearch-video-meta', text: [v.channel, v.date].filter(Boolean).join(' · ') })
            );
            card.addEventListener('click', () => go(tab, v.url));
            grid.appendChild(card);
          });
          page.appendChild(grid);
        } else {
          const box = KX.el('div', { class: 'kx-kxearch-results' });
          box.appendChild(KX.el('div', { class: 'kx-kxearch-empty', text: note || 'No videos found.' }));
          page.appendChild(box);
        }
        setPane(tab, container);
      }

      async function doVideos(tab, query) {
        const token = (tab.token = (tab.token || 0) + 1);
        setTitle(tab, query + ' – Videos');
        drawVideos(tab, query, [], 'Searching videos…');
        setStatus(tab, 'Searching videos for “' + query + '”…');
        let items = [];
        let note = '';
        try {
          const res = await fetch(PROXY + 'search?type=videos&q=' + encodeURIComponent(query));
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          items = (Array.isArray(data.results) ? data.results : []).filter((r) => r && isHttpUrl(r.url));
          note = data.note || '';
        } catch {
          note = 'The video search could not be reached.';
        }
        if (tab.token !== token) return;
        drawVideos(tab, query, items, items.length ? 'Videos for “' + query + '”' : note || 'No videos found.');
        setStatus(tab, items.length + ' videos');
      }

      async function doImages(tab, query) {
        const token = (tab.token = (tab.token || 0) + 1);
        setTitle(tab, query + ' – Images');
        drawImages(tab, query, [], 'Searching images…');
        setStatus(tab, 'Searching images for “' + query + '”…');
        let items = [];
        let failed = false;
        try {
          const res = await fetch(PROXY + 'search?type=images&q=' + encodeURIComponent(query));
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          items = (Array.isArray(data.results) ? data.results : []).filter(
            (r) => r && isHttpUrl(r.image) && isHttpUrl(r.thumb)
          );
        } catch {
          failed = true;
        }
        if (tab.token !== token) return;
        drawImages(
          tab, query, items,
          failed ? 'The image search could not be reached.' : 'Images for “' + query + '”'
        );
        setStatus(tab, failed ? 'Image search unavailable.' : items.length + ' images');
      }

      // ---- showing a website ---------------------------------------------
      function show(tab, url) {
        tab.token = (tab.token || 0) + 1;
        setTitle(tab, hostOf(url));

        const ytq = youtubeSearchQuery(url);
        if (ytq) {
          doVideos(tab, ytq);
          return;
        }

        if (isYouTubeHome(url)) {
          tab.current = YOUTUBE_HOME;
          renderYouTube(tab);
          return;
        }

        const yt = youtubeId(url);
        if (yt) {
          setPane(tab, embedView(tab, 'https://www.youtube.com/embed/' + encodeURIComponent(yt) + '?playsinline=1&rel=0', 'YouTube', url));
          setTitle(tab, 'YouTube video');
          setStatus(tab, 'YouTube video');
          return;
        }

        const twitch = twitchInfo(url);
        if (twitch) {
          const parent = location.hostname || 'localhost';
          let src = 'https://player.twitch.tv/?parent=' + encodeURIComponent(parent) + '&autoplay=false';
          if (twitch.type === 'channel') src += '&channel=' + encodeURIComponent(twitch.name);
          if (twitch.type === 'video') src += '&video=' + encodeURIComponent(twitch.id);
          if (twitch.type === 'clip') {
            src = 'https://clips.twitch.tv/embed?clip=' + encodeURIComponent(twitch.id) +
              '&parent=' + encodeURIComponent(parent) + '&autoplay=false';
          }
          setPane(tab, embedView(tab, src, 'Twitch', url));
          setStatus(tab, 'Twitch');
          return;
        }

        if (isTwitchHost(url) && !twitch) {
          renderTwitchHome(tab);
          return;
        }

        if (isNetflix(url)) {
          setPane(tab, specialPage(
            'NETFLIX',
            'Netflix does not allow being shown inside other apps, and sign-in is not possible in KXEARCH.',
            [externalButton(url, 'Open Netflix')]
          ));
          setStatus(tab, 'Netflix');
          return;
        }

        if (isAuthUrl(url)) {
          setPane(tab, specialPage(
            'Sign-in is not available here',
            'Passwords are never sent through the KXEARCH proxy, and ' + hostOf(url) +
              ' does not allow logins inside embedded browsers. Open it in a normal browser tab instead.',
            [externalButton(url, 'Open in a normal tab')]
          ));
          setStatus(tab, 'Sign-in pages open outside KXEARCH.');
          return;
        }

        const frame = KX.el('iframe', {
          class: 'kx-kxearch-frame',
          title: 'KXEARCH web view',
          referrerpolicy: 'no-referrer',
          sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads'
        });
        frame.src = proxyUrl(url);
        setPane(tab, frame);
        setStatus(tab, 'Loading ' + url);
        frame.addEventListener('load', () => {
          if (tab.current === url) setStatus(tab, 'Loaded: ' + url);
        });
      }

      function render(tab, entry) {
        if (entry === NEWTAB) {
          tab.token = (tab.token || 0) + 1;
          renderNewTab(tab);
        } else if (entry === YOUTUBE_HOME) {
          tab.token = (tab.token || 0) + 1;
          renderYouTube(tab);
        } else if (entry.startsWith(SEARCH_PREFIX)) {
          doSearch(tab, entry.slice(SEARCH_PREFIX.length));
        } else if (entry.startsWith(IMAGES_PREFIX)) {
          doImages(tab, entry.slice(IMAGES_PREFIX.length));
        } else if (entry.startsWith(VIDEOS_PREFIX)) {
          doVideos(tab, entry.slice(VIDEOS_PREFIX.length));
        } else {
          show(tab, entry);
        }
      }

      function go(tab, entry, addHistory = true) {
        if (addHistory) {
          tab.history = tab.history.slice(0, tab.index + 1);
          tab.history.push(entry);
          tab.index = tab.history.length - 1;
        }
        tab.current = entry;
        render(tab, entry);
        syncUI();
      }

      function toEntry(raw) {
        if (isHttpUrl(raw)) return raw;
        if (/^[^\s/]+\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(raw)) return 'https://' + raw;
        return SEARCH_PREFIX + raw;
      }

      function submit(tab, raw) {
        const value = (raw || '').trim();
        if (!value) return;
        go(tab, toEntry(value));
      }

      // ---- tabs -----------------------------------------------------------
      function activate(tab) {
        active = tab;
        tabs.forEach((t) => {
          const on = t === tab;
          t.pane.hidden = !on;
          t.el.classList.toggle('active', on);
        });
        syncUI();
      }

      function closeTab(tab) {
        const i = tabs.indexOf(tab);
        if (i < 0) return;
        tabs.splice(i, 1);
        tab.pane.remove();
        tab.el.remove();
        if (!tabs.length) {
          newTab(NEWTAB);
        } else if (active === tab) {
          activate(tabs[Math.min(i, tabs.length - 1)]);
        }
      }

      function newTab(entry) {
        const tab = {
          id: nextId++,
          history: [],
          index: -1,
          current: '',
          title: 'New Tab',
          status: '',
          token: 0,
          frame: null,
          pane: KX.el('div', { class: 'kx-kxearch-pane' })
        };
        tab.label = KX.el('span', { class: 'kx-kxearch-tab-label', text: 'New Tab' });
        const close = KX.el('span', { class: 'kx-kxearch-tab-close', text: '×', title: 'Close tab' });
        tab.el = KX.el('button', { class: 'kx-kxearch-tab', type: 'button' });
        tab.el.append(tab.label, close);
        tab.el.addEventListener('click', () => activate(tab));
        tab.el.addEventListener('auxclick', (e) => {
          if (e.button === 1) closeTab(tab);
        });
        close.addEventListener('click', (e) => {
          e.stopPropagation();
          closeTab(tab);
        });

        tabs.push(tab);
        tabStrip.insertBefore(tab.el, addTab);
        viewport.appendChild(tab.pane);
        activate(tab);
        go(tab, entry);
        return tab;
      }

      // ---- toolbar wiring -------------------------------------------------
      addTab.addEventListener('click', () => newTab(NEWTAB));

      function navigateFromBar() {
        if (active) submit(active, input.value);
      }

      goBtn.addEventListener('click', navigateFromBar);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigateFromBar();
      });
      input.addEventListener('focus', () => input.select());

      back.addEventListener('click', () => {
        if (active && active.index > 0) {
          active.index--;
          active.current = active.history[active.index];
          render(active, active.current);
          syncUI();
        }
      });
      forward.addEventListener('click', () => {
        if (active && active.index + 1 < active.history.length) {
          active.index++;
          active.current = active.history[active.index];
          render(active, active.current);
          syncUI();
        }
      });
      refresh.addEventListener('click', () => {
        if (active && active.current) {
          render(active, active.current);
          syncUI();
        }
      });

      star.addEventListener('click', () => {
        if (!active) return;
        const url = bookmarkUrl(active.current);
        if (!url) return;
        if (isBookmarked(url)) {
          bookmarks = bookmarks.filter((b) => b.url !== url);
        } else {
          bookmarks.push({ title: active.title && active.title !== 'New Tab' ? active.title : hostOf(url), url });
        }
        saveBookmarks(bookmarks);
        renderBookmarks();
        refreshNewTabs();
        syncUI();
      });

      tabStrip.appendChild(addTab);
      root.append(tabStrip, toolbar, bar, viewport, status);
      win.body.appendChild(root);
      renderBookmarks();

      newTab(args && args.url ? args.url : NEWTAB);
    }
  });
})();
