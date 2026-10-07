(function () {
  'use strict';

  const KX = window.KXKOS;

  const PROXY = 'https://kxearch-proxy.haleannson.workers.dev/';
  const START_PAGE = 'https://kxko4b.github.io/custom-leverframe-diagrams/';

  const SEARCH_INDEX = [
    {
      title: 'Kxko Custom Lever Frame Diagrams',
      url: START_PAGE,
      description: 'Custom railway signalling and lever frame diagrams by Kxko.',
      keywords: ['kxko', 'lever frame', 'leverframe', 'railway', 'signalling', 'signal', 'diagrams', 'dovedale']
    },
    {
      title: 'Wikipedia',
      url: 'https://www.wikipedia.org/',
      description: 'The free online encyclopedia.',
      keywords: ['wiki', 'wikipedia', 'encyclopedia', 'articles', 'information']
    },
    {
      title: 'YouTube',
      url: 'https://www.youtube.com/',
      description: 'Watch videos and music.',
      keywords: ['youtube', 'video', 'videos', 'music']
    },
    {
      title: 'Twitch',
      url: 'https://www.twitch.tv/',
      description: 'Live streams and gaming.',
      keywords: ['twitch', 'stream', 'streaming', 'livestream', 'gaming']
    },
    {
      title: 'Netflix',
      url: 'https://www.netflix.com/',
      description: 'Movies and series.',
      keywords: ['netflix', 'movies', 'films', 'series', 'shows']
    }
  ];

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

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;

    if (a.length > b.length) [a, b] = [b, a];

    let previous = Array.from(
      { length: a.length + 1 },
      (_, i) => i
    );

    for (let j = 1; j <= b.length; j++) {
      const current = [j];

      for (let i = 1; i <= a.length; i++) {
        current[i] = Math.min(
          current[i - 1] + 1,
          previous[i] + 1,
          previous[i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }

      previous = current;
    }

    return previous[a.length];
  }

  function similarity(query, text) {
    const q = normalize(query);
    const words = normalize(text).split(/\s+/).filter(Boolean);

    if (!q || !words.length) return 0;

    let best = 0;

    for (const word of words) {
      if (word === q) return 1;

      if (word.startsWith(q) || q.startsWith(word)) {
        best = Math.max(best, 0.92);
        continue;
      }

      const distance = levenshtein(q, word);
      const longest = Math.max(q.length, word.length);
      const score = 1 - distance / longest;

      if (q.length >= 4 || word.length >= 4) {
        best = Math.max(best, score);
      }
    }

    if (normalize(text).includes(q)) {
      best = Math.max(best, 0.88);
    }

    return best;
  }

  function search(query) {
    const q = normalize(query);

    if (!q) return SEARCH_INDEX;

    return SEARCH_INDEX
      .map((item) => {
        const fields = [
          item.title,
          item.description,
          item.keywords.join(' '),
          item.url
        ];

        const score = Math.max(
          ...fields.map((field) => similarity(q, field))
        );

        const tokenScore = Math.max(
          ...q.split(/\s+/).map((token) =>
            similarity(token, fields.join(' '))
          )
        );

        return {
          item,
          score: Math.max(score, tokenScore * 0.92)
        };
      })
      .filter(({ score }) =>
        score >= (q.length <= 3 ? 0.72 : 0.48)
      )
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }

  function getHost(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  function isYouTube(url) {
    const host = getHost(url);
    return host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'youtu.be';
  }

  function isTwitch(url) {
    const host = getHost(url);
    return host === 'twitch.tv' ||
      host === 'www.twitch.tv';
  }

  function isNetflix(url) {
    const host = getHost(url);
    return host === 'netflix.com' ||
      host === 'www.netflix.com';
  }

  function youtubeEmbed(url) {
    try {
      const parsed = new URL(url);

      let videoId = '';

      if (parsed.hostname === 'youtu.be') {
        videoId = parsed.pathname.slice(1);
      }

      if (parsed.pathname === '/watch') {
        videoId = parsed.searchParams.get('v') || '';
      }

      const match = parsed.pathname.match(
        /^\/(?:shorts|embed)\/([^/?]+)/
      );

      if (match) {
        videoId = match[1];
      }

      if (!videoId) return null;

      return 'https://www.youtube.com/embed/' +
        encodeURIComponent(videoId) +
        '?playsinline=1';
    } catch {
      return null;
    }
  }

  function twitchEmbed(url) {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname
        .split('/')
        .filter(Boolean);

      if (!parts.length) return null;

      const channel = parts[0];

      const parent =
        location.hostname ||
        'localhost';

      return 'https://player.twitch.tv/?channel=' +
        encodeURIComponent(channel) +
        '&parent=' +
        encodeURIComponent(parent) +
        '&autoplay=false';
    } catch {
      return null;
    }
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

      const content = KX.el('div', {
        class: 'kx-kxearch-search-container'
      });

      const status = KX.el('div', {
        class: 'kx-kxearch-status',
        text: 'Ready.'
      });

      let current = '';
      let history = [];
      let historyIndex = -1;
      let showingSearch = true;
      let currentQuery = '';

      function pushHistory(entry) {
        history = history.slice(0, historyIndex + 1);
        history.push(entry);
        historyIndex = history.length - 1;
      }

      function showMessage(title, text, buttons = []) {
        const page = KX.el('div', {
          class: 'kx-kxearch-special-page'
        });

        page.append(
          KX.el('div', {
            class: 'kx-kxearch-special-title',
            text: title
          }),
          KX.el('div', {
            class: 'kx-kxearch-special-text',
            text
          })
        );

        const actions = KX.el('div', {
          class: 'kx-kxearch-special-actions'
        });

        buttons.forEach(({ text, url }) => {
          const button = KX.el('button', {
            class: 'kx-btn primary',
            text
          });

          button.addEventListener('click', () => {
            window.open(url, '_blank', 'noopener');
          });

          actions.appendChild(button);
        });

        page.appendChild(actions);
        content.replaceChildren(page);
      }

      function showYouTube(url, addHistory = true) {
        const embed = youtubeEmbed(url);

        if (!embed) {
          showMessage(
            'YouTube',
            'Open a YouTube video URL to play it inside KXEARCH.',
            [
              {
                text: 'Open YouTube',
                url: 'https://www.youtube.com/'
              }
            ]
          );
          return;
        }

        current = url;
        showingSearch = false;
        input.value = url;

        if (addHistory) {
          pushHistory({
            type: 'url',
            value: url
          });
        }

        const frame = KX.el('iframe', {
          class: 'kx-kxearch-media-frame',
          title: 'YouTube video',
          src: embed,
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
          allowfullscreen: 'true'
        });

        content.replaceChildren(frame);
        status.textContent = 'YouTube';
      }

      function showTwitch(url, addHistory = true) {
        const embed = twitchEmbed(url);

        if (!embed) {
          showMessage(
            'Twitch',
            'Open a Twitch channel URL to load its live player.',
            [
              {
                text: 'Open Twitch',
                url: 'https://www.twitch.tv/'
              }
            ]
          );
          return;
        }

        current = url;
        showingSearch = false;
        input.value = url;

        if (addHistory) {
          pushHistory({
            type: 'url',
            value: url
          });
        }

        const frame = KX.el('iframe', {
          class: 'kx-kxearch-media-frame',
          title: 'Twitch player',
          src: embed,
          allow: 'autoplay; fullscreen',
          allowfullscreen: 'true'
        });

        content.replaceChildren(frame);
        status.textContent = 'Twitch';
      }

      function showNetflix(addHistory = true) {
        const url = 'https://www.netflix.com/';

        current = url;
        showingSearch = false;
        input.value = url;

        if (addHistory) {
          pushHistory({
            type: 'special',
            value: 'netflix'
          });
        }

        showMessage(
          'Netflix',
          'Netflix does not provide a normal embeddable homepage. Open it directly in a browser tab.',
          [
            {
              text: 'Open Netflix',
              url
            }
          ]
        );

        status.textContent = 'Netflix';
      }

      function showUrl(url, addHistory = true) {
        if (!isHttpUrl(url)) return;

        if (isNetflix(url)) {
          showNetflix(addHistory);
          return;
        }

        if (isYouTube(url)) {
          showYouTube(url, addHistory);
          return;
        }

        if (isTwitch(url)) {
          showTwitch(url, addHistory);
          return;
        }

        current = url;
        showingSearch = false;
        input.value = url;

        if (addHistory) {
          pushHistory({
            type: 'url',
            value: url
          });
        }

        const frame = KX.el('iframe', {
          class: 'kx-kxearch-frame',
          title: 'KXEARCH web view',
          referrerpolicy: 'no-referrer'
        });

        frame.addEventListener('load', () => {
          status.textContent = 'Loaded: ' + current;
        });

        content.replaceChildren(frame);

        frame.src = proxyUrl(url);
        status.textContent = 'Loading ' + url;
      }

      function showSearch(query = '', addHistory = true) {
        current = '';
        showingSearch = true;
        currentQuery = query;
        input.value = query;

        if (addHistory) {
          pushHistory({
            type: 'search',
            value: query
          });
        }

        const page = KX.el('div', {
          class: 'kx-kxearch-search-page'
        });

        const hero = KX.el('div', {
          class: 'kx-kxearch-search-hero'
        });

        hero.appendChild(
          KX.el('div', {
            class: 'kx-kxearch-search-logo',
            text: 'KXEARCH'
          })
        );

        const form = KX.el('form', {
          class: 'kx-kxearch-search-form'
        });

        const searchInput = KX.el('input', {
          class: 'kx-kxearch-search-input',
          type: 'search',
          value: query,
          placeholder: 'Search the KXEARCH web…',
          autocomplete: 'off',
          spellcheck: 'false'
        });

        const searchButton = KX.el('button', {
          class: 'kx-btn primary kx-kxearch-search-button',
          type: 'submit',
          text: 'Search'
        });

        form.append(searchInput, searchButton);

        form.addEventListener('submit', (event) => {
          event.preventDefault();
          showSearch(searchInput.value.trim());
          searchInput.focus();
          searchInput.select();
        });

        hero.append(
          form,
          KX.el('div', {
            class: 'kx-kxearch-search-hint',
            text: 'Typos are okay — KXEARCH will try to find what you meant.'
          })
        );

        page.appendChild(hero);

        const results = KX.el('div', {
          class: 'kx-kxearch-results'
        });

        const found = search(query);

        if (!found.length && query) {
          results.appendChild(
            KX.el('div', {
              class: 'kx-kxearch-empty',
              text: 'No close matches. Try another spelling or enter a full web address above.'
            })
          );
        } else {
          found.forEach((item) => {
            const result = KX.el('button', {
              class: 'kx-kxearch-result',
              type: 'button'
            });

            result.append(
              KX.el('div', {
                class: 'kx-kxearch-result-title',
                text: item.title
              }),
              KX.el('div', {
                class: 'kx-kxearch-result-url',
                text: item.url
              }),
              KX.el('div', {
                class: 'kx-kxearch-result-description',
                text: item.description
              })
            );

            result.addEventListener('click', () => {
              showUrl(item.url);
            });

            results.appendChild(result);
          });
        }

        page.appendChild(results);
        content.replaceChildren(page);

        status.textContent = query
          ? 'Search results for "' + query + '".'
          : 'Ready to search.';
      }

      function navigate() {
        const raw = input.value.trim();

        if (!raw) {
          showSearch('');
          return;
        }

        if (isHttpUrl(raw)) {
          showUrl(raw);
          return;
        }

        if (raw.includes('.') && !raw.includes(' ')) {
          showUrl('https://' + raw);
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
        if (historyIndex <= 0) return;

        historyIndex--;

        const entry = history[historyIndex];

        if (entry.type === 'search') {
          showSearch(entry.value, false);
        } else if (entry.type === 'special' && entry.value === 'netflix') {
          showNetflix(false);
        } else {
          showUrl(entry.value, false);
        }
      });

      forward.addEventListener('click', () => {
        if (historyIndex + 1 >= history.length) return;

        historyIndex++;

        const entry = history[historyIndex];

        if (entry.type === 'search') {
          showSearch(entry.value, false);
        } else if (entry.type === 'special' && entry.value === 'netflix') {
          showNetflix(false);
        } else {
          showUrl(entry.value, false);
        }
      });

      refresh.addEventListener('click', () => {
        if (showingSearch) {
          showSearch(currentQuery, false);
        } else if (isNetflix(current)) {
          showNetflix(false);
        } else if (isYouTube(current)) {
          showYouTube(current, false);
        } else if (isTwitch(current)) {
          showTwitch(current, false);
        } else {
          showUrl(current, false);
        }
      });

      root.append(toolbar, content, status);
      win.body.appendChild(root);

      if (args && args.url) {
        showUrl(args.url);
      } else {
        showSearch('');
      }
    }
  });
})();