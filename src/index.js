/**
 * KXEARCH proxy: a Cloudflare Worker.
 *
 *   GET /?url=<encoded http(s) url>   fetch a public web page and return it
 *   GET /search?q=<query>             JSON search results
 *   GET /                             health text
 *
 * Design: instead of an allow-list of sites, this uses a DENY-list of anything
 * that is not a normal public website. Any public http(s) site works; anything
 * that could reach internal / private resources is refused.
 *
 * Optional Worker settings (Cloudflare dashboard > Settings > Variables):
 *   BRAVE_API_KEY    (secret)  better search results via Brave Search API
 *   ALLOWED_ORIGINS  (text)    comma separated origins allowed to call /search,
 *                              e.g. "https://kxko4b.github.io". Default: any.
 *
 * Never put secrets in the frontend. They live here.
 */

const MAX_REDIRECTS = 6;
const FETCH_TIMEOUT_MS = 15000;
const MAX_HTML_BYTES = 8 * 1024 * 1024;
const MAX_BODY_BYTES = 40 * 1024 * 1024;
const RATE_LIMIT = 900; // requests per IP per minute, per Worker isolate (best effort)

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 KXEARCH/1.0';

const BLOCKED_SUFFIXES = [
  '.local', '.localhost', '.internal', '.lan', '.home', '.corp',
  '.intranet', '.private', '.test', '.invalid', '.onion', '.arpa'
];

// Headers we copy from the upstream response. Everything else (Set-Cookie,
// CSP, X-Frame-Options, HSTS, ...) is dropped on purpose.
const PASS_HEADERS = [
  'content-type', 'cache-control', 'last-modified', 'etag',
  'content-language', 'accept-ranges', 'content-range'
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

class Refusal extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isPrivateIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = +m[1];
  const b = +m[2];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** Parse and check a target. Throws Refusal when it is not a public website. */
function validateTarget(raw, selfHost) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Refusal(400, 'Invalid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Refusal(400, 'Only http and https are supported.');
  }
  if (url.username || url.password) {
    throw new Refusal(400, 'URLs with credentials are not allowed.');
  }
  if (url.port && !['80', '443', '8080', '8443'].includes(url.port)) {
    throw new Refusal(403, 'Only common web ports are allowed.');
  }

  // The URL parser already normalises 2130706433, 0x7f.1, 017700000001 ...
  // into dotted IPv4, so the checks below see the real address.
  const host = url.hostname.toLowerCase().replace(/\.$/, '');

  if (!host || host.includes(':') || host.startsWith('[')) {
    throw new Refusal(403, 'IPv6 addresses are not allowed.');
  }
  if (isPrivateIPv4(host)) {
    throw new Refusal(403, 'Private and reserved addresses are not allowed.');
  }
  if (/^[\d.]+$/.test(host)) {
    // A bare public IPv4 is fine, anything else numeric is malformed.
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      throw new Refusal(400, 'Invalid address.');
    }
  } else {
    if (!host.includes('.') || host === 'localhost') {
      throw new Refusal(403, 'Internal hostnames are not allowed.');
    }
    if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
      throw new Refusal(403, 'Internal hostnames are not allowed.');
    }
  }
  if (host === selfHost) {
    throw new Refusal(403, 'The proxy cannot proxy itself.');
  }

  url.hash = '';
  return url;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const rateBuckets = new Map();

function rateLimited(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const minute = Math.floor(Date.now() / 60000);
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.minute !== minute) {
    if (rateBuckets.size > 5000) rateBuckets.clear();
    rateBuckets.set(ip, { minute, count: 1 });
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT;
}

function text(status, body, extra) {
  return new Response(body, {
    status,
    headers: Object.assign(
      {
        'content-type': 'text/plain; charset=utf-8',
        'access-control-allow-origin': '*',
        'x-content-type-options': 'nosniff'
      },
      extra || {}
    )
  });
}

function limitStream(body, maxBytes) {
  if (!body) return body;
  let seen = 0;
  return body.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > maxBytes) {
          controller.error(new Error('Response too large'));
          return;
        }
        controller.enqueue(chunk);
      }
    })
  );
}

function proxyHref(workerOrigin, base, value) {
  if (value == null) return value;
  const v = String(value).trim();
  if (!v || v.startsWith('#')) return value;
  if (/^(javascript|data|mailto|tel|blob|about|sms):/i.test(v)) return value;
  try {
    const abs = new URL(v, base);
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return value;
    abs.hash = '';
    return workerOrigin + '/?url=' + encodeURIComponent(abs.href);
  } catch {
    return value;
  }
}

// Plain GET forms drop the "?url=" of their action, so submit them via a tiny
// script that rebuilds the target URL and navigates through the proxy.
const FORM_SHIM = `
document.addEventListener('submit', function (e) {
  var f = e.target;
  if (!f || f.tagName !== 'FORM') return;
  var target = f.getAttribute('data-kx-action');
  if (!target) return;
  var method = (f.getAttribute('method') || 'get').toLowerCase();
  if (method !== 'get') return;
  e.preventDefault();
  try {
    var u = new URL(target);
    new FormData(f).forEach(function (v, k) {
      if (typeof v === 'string') u.searchParams.set(k, v);
    });
    location.href = '__WORKER__/?url=' + encodeURIComponent(u.href);
  } catch (err) {}
}, true);
`;

// Sign-in pages. Passwords must never travel through a third-party proxy, and
// these sites refuse embedded/proxied logins anyway (no cookies are kept), so
// show a clear notice with a button to open the real site instead.
const AUTH_HOSTS = [
  'accounts.google.com', 'accounts.youtube.com', 'login.live.com',
  'login.microsoftonline.com', 'appleid.apple.com', 'idmsa.apple.com',
  'id.twitch.tv', 'passport.twitch.tv', 'www.facebook.com/login'
];

function isAuthPage(url) {
  const host = url.hostname.toLowerCase();
  return AUTH_HOSTS.some((h) => !h.includes('/') && (host === h)) ||
    (host.endsWith('facebook.com') && /^\/(login|signup|recover)/.test(url.pathname));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function authNoticeResponse(url) {
  const html = '<!doctype html><meta charset="utf-8"><title>Sign-in</title>' +
    '<body style="font:16px system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 20px;color:#1b2a49">' +
    '<h2>Sign-in is not available inside KXEARCH</h2>' +
    '<p>For your safety, passwords are never sent through the KXEARCH proxy, and ' + escapeHtml(url.hostname) +
    ' does not allow logins inside embedded browsers.</p>' +
    '<p><a target="_blank" rel="noopener noreferrer" href="' + escapeHtml(url.href) +
    '" style="display:inline-block;padding:10px 16px;background:#3b8fe0;color:#fff;border:2px solid #1b2a49;text-decoration:none;font-weight:700">Open in a normal browser tab</a></p></body>';
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': 'sandbox allow-popups allow-popups-to-escape-sandbox',
      'x-content-type-options': 'nosniff'
    }
  });
}

// Runs inside proxied pages: sends the page's own fetch / XHR / dynamically
// created resources through the proxy so JS-heavy sites keep working.
function buildShim(workerOrigin, baseHref) {
  return '(' + function (W, B) {
    function prox(u) {
      try {
        if (u == null) return u;
        var s = String(u);
        if (/^(data|blob|javascript|about|mailto|tel):/i.test(s) || s.indexOf(W + '/') === 0) return u;
        var a = new URL(s, B);
        if (a.protocol !== 'http:' && a.protocol !== 'https:') return u;
        if (a.origin === W) return u;
        return W + '/?url=' + encodeURIComponent(a.href);
      } catch (e) { return u; }
    }
    var of = window.fetch;
    if (of) {
      window.fetch = function (input, init) {
        try {
          init = Object.assign({}, init || {}, { credentials: 'omit' });
          if (typeof input === 'string' || input instanceof URL) return of.call(this, prox(input), init);
          if (input && input.url) return of.call(this, new Request(prox(input.url), input), init);
        } catch (e) {}
        return of.call(this, input, init);
      };
    }
    var ox = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) {
      var rest = Array.prototype.slice.call(arguments, 2);
      return ox.apply(this, [m, prox(u)].concat(rest));
    };
    var osa = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) {
      var ln = String(n).toLowerCase();
      if ((ln === 'src' || ln === 'href' || ln === 'action') && this.tagName !== 'A' && this.tagName !== 'FORM') v = prox(v);
      return osa.call(this, n, v);
    };
    [[HTMLScriptElement, 'src'], [HTMLImageElement, 'src'], [HTMLIFrameElement, 'src'],
     [HTMLLinkElement, 'href'], [HTMLSourceElement, 'src'], [HTMLMediaElement, 'src']].forEach(function (p) {
      try {
        var d = Object.getOwnPropertyDescriptor(p[0].prototype, p[1]);
        if (d && d.set) Object.defineProperty(p[0].prototype, p[1], {
          configurable: true, enumerable: d.enumerable, get: d.get,
          set: function (v) { d.set.call(this, prox(v)); }
        });
      } catch (e) {}
    });
  }.toString() + ')(' + JSON.stringify(workerOrigin) + ',' + JSON.stringify(baseHref) + ');';
}

// ---------------------------------------------------------------------------
// Proxy
// ---------------------------------------------------------------------------

async function fetchFollowing(startUrl, request, selfHost) {
  let url = startUrl;
  const headers = new Headers({
    'user-agent': USER_AGENT,
    accept: request.headers.get('accept') || '*/*',
    'accept-language': request.headers.get('accept-language') || 'en-US,en;q=0.8'
  });
  const range = request.headers.get('range');
  if (range) headers.set('range', range);
  // Deliberately NOT forwarded: Cookie, Authorization, Referer, Origin.

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(url.href, {
        method: request.method,
        headers,
        redirect: 'manual',
        signal: controller.signal
      });
    } catch (err) {
      throw new Refusal(502, 'Could not reach the site.');
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      let next;
      try {
        next = new URL(res.headers.get('location'), url);
      } catch {
        throw new Refusal(502, 'Bad redirect from site.');
      }
      url = validateTarget(next.href, selfHost); // every hop is re-checked
      continue;
    }
    return { res, url };
  }
  throw new Refusal(508, 'Too many redirects.');
}

function buildHeaders(upstream, isHtml) {
  const h = new Headers();
  for (const name of PASS_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) h.set(name, v);
  }
  h.set('access-control-allow-origin', '*');
  h.set('referrer-policy', 'no-referrer');
  h.set('x-content-type-options', 'nosniff');
  // Even if the client forgets to sandbox the iframe, the page is sandboxed.
  h.set(
    'content-security-policy',
    'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads'
  );
  if (isHtml) h.set('cache-control', 'no-store');
  return h;
}

async function handleProxy(request, reqUrl) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return text(405, 'Only GET and HEAD are supported.', { allow: 'GET, HEAD' });
  }

  const target = reqUrl.searchParams.get('url');
  if (!target) {
    return text(200, 'KXEARCH Proxy is running.');
  }

  let url;
  try {
    url = validateTarget(target, reqUrl.hostname);
  } catch (err) {
    if (err instanceof Refusal) return text(err.status, 'Blocked: ' + err.message);
    throw err;
  }

  if (isAuthPage(url)) return authNoticeResponse(url);

  let result;
  try {
    result = await fetchFollowing(url, request, reqUrl.hostname);
  } catch (err) {
    if (err instanceof Refusal) return text(err.status, 'KXEARCH: ' + err.message);
    return text(502, 'KXEARCH: upstream error.');
  }

  const { res, url: finalUrl } = result;
  if (isAuthPage(finalUrl)) return authNoticeResponse(finalUrl);
  const type = res.headers.get('content-type') || '';
  const isHtml = /text\/html|application\/xhtml\+xml/i.test(type);

  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) {
    return text(413, 'KXEARCH: file too large.');
  }

  const headers = buildHeaders(res, isHtml);

  if (!isHtml || request.method === 'HEAD') {
    return new Response(limitStream(res.body, MAX_BODY_BYTES), {
      status: res.status,
      headers
    });
  }

  // HTML: rewrite links so navigation and subresources keep going through us.
  const workerOrigin = reqUrl.origin;
  const base = finalUrl.href;
  const rewriteAttr = (attr) => ({
    element(el) {
      const v = el.getAttribute(attr);
      if (v != null) el.setAttribute(attr, proxyHref(workerOrigin, base, v));
    }
  });
  const rewriteSrcset = {
    element(el) {
      const v = el.getAttribute('srcset');
      if (!v) return;
      el.setAttribute(
        'srcset',
        v
          .split(',')
          .map((part) => {
            const bits = part.trim().split(/\s+/);
            bits[0] = proxyHref(workerOrigin, base, bits[0]);
            return bits.join(' ');
          })
          .join(', ')
      );
    }
  };

  const rewritten = new HTMLRewriter()
    .on('base', { element(el) { el.remove(); } })
    .on('meta[http-equiv]', {
      element(el) {
        const he = (el.getAttribute('http-equiv') || '').toLowerCase();
        if (he === 'content-security-policy') el.remove();
        if (he === 'refresh') {
          const c = el.getAttribute('content') || '';
          const m = c.match(/^(\s*\d+\s*;\s*url=)(.+)$/i);
          if (m) el.setAttribute('content', m[1] + proxyHref(workerOrigin, base, m[2].trim().replace(/^['"]|['"]$/g, '')));
        }
      }
    })
    .on('[integrity]', { element(el) { el.removeAttribute('integrity'); } })
    .on('a[href]', {
      element(el) {
        el.setAttribute('href', proxyHref(workerOrigin, base, el.getAttribute('href')));
        // Open in the same frame unless the page asked for a new tab.
        if ((el.getAttribute('target') || '') === '_top') el.setAttribute('target', '_self');
      }
    })
    .on('area[href]', rewriteAttr('href'))
    .on('link[href]', rewriteAttr('href'))
    .on('img[src]', rewriteAttr('src'))
    .on('script[src]', rewriteAttr('src'))
    .on('video[src]', rewriteAttr('src'))
    .on('video[poster]', rewriteAttr('poster'))
    .on('audio[src]', rewriteAttr('src'))
    .on('source[src]', rewriteAttr('src'))
    .on('track[src]', rewriteAttr('src'))
    .on('iframe[src]', rewriteAttr('src'))
    .on('embed[src]', rewriteAttr('src'))
    .on('img[srcset], source[srcset]', rewriteSrcset)
    .on('form', {
      element(el) {
        const action = el.getAttribute('action');
        const abs = action ? new URL(action, base).href : base;
        el.setAttribute('data-kx-action', abs);
        el.setAttribute('action', proxyHref(workerOrigin, base, abs));
      }
    })
    .on('head', {
      element(el) {
        // Prepend so the shim runs before any page script.
        el.prepend(
          '<script>' + buildShim(workerOrigin, base).replace(/<\/script/gi, '<\\/script') + FORM_SHIM.replace('__WORKER__', workerOrigin) + '</script>',
          { html: true }
        );
      }
    })
    .transform(
      new Response(limitStream(res.body, MAX_HTML_BYTES), {
        status: res.status,
        headers
      })
    );

  return rewritten;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function publicHttpUrl(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

async function searchBrave(q, key) {
  const res = await fetch(
    'https://api.search.brave.com/res/v1/web/search?count=20&q=' + encodeURIComponent(q),
    { headers: { accept: 'application/json', 'x-subscription-token': key } }
  );
  if (!res.ok) throw new Error('brave ' + res.status);
  const data = await res.json();
  return ((data.web && data.web.results) || [])
    .map((r) => ({ title: stripTags(r.title), url: publicHttpUrl(r.url), description: stripTags(r.description) }))
    .filter((r) => r.url && r.title);
}

function parseDuckDuckGo(html) {
  const results = [];
  const linkRe = /<a\b[^>]*class="[^"]*result__a[^"]*"[^>]*>/g;
  const tags = [];
  let m;
  while ((m = linkRe.exec(html))) tags.push({ index: m.index, tag: m[0], end: linkRe.lastIndex });

  tags.forEach((t, i) => {
    const hrefMatch = t.tag.match(/href="([^"]+)"/);
    if (!hrefMatch) return;
    let href = decodeEntities(hrefMatch[1]);
    if (href.startsWith('//')) href = 'https:' + href;
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) {
      try { href = decodeURIComponent(uddg[1]); } catch { return; }
    }
    if (/duckduckgo\.com\/y\.js/.test(href)) return; // ads
    const url = publicHttpUrl(href);
    if (!url) return;

    const closeIdx = html.indexOf('</a>', t.end);
    if (closeIdx < 0) return;
    const title = stripTags(html.slice(t.end, closeIdx));

    const chunkEnd = i + 1 < tags.length ? tags[i + 1].index : html.length;
    const chunk = html.slice(closeIdx, chunkEnd);
    const sn = chunk.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/);
    results.push({ title, url, description: sn ? stripTags(sn[1]) : '' });
  });
  return results.filter((r) => r.title);
}

async function searchDuckDuckGo(q) {
  const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), {
    headers: { 'user-agent': USER_AGENT, 'accept-language': 'en-US,en;q=0.8' }
  });
  if (!res.ok) throw new Error('ddg ' + res.status);
  return parseDuckDuckGo(await res.text());
}

async function searchWikipedia(q) {
  const res = await fetch(
    'https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=10&search=' + encodeURIComponent(q),
    { headers: { 'user-agent': USER_AGENT } }
  );
  if (!res.ok) throw new Error('wiki ' + res.status);
  const [, titles, descs, urls] = await res.json();
  return (titles || []).map((title, i) => ({
    title: title + ' - Wikipedia',
    url: publicHttpUrl(urls[i]),
    description: descs[i] || ''
  })).filter((r) => r.url);
}


async function searchImagesBrave(q, key) {
  const res = await fetch(
    'https://api.search.brave.com/res/v1/images/search?count=40&q=' + encodeURIComponent(q),
    { headers: { accept: 'application/json', 'x-subscription-token': key } }
  );
  if (!res.ok) throw new Error('brave images ' + res.status);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: stripTags(r.title),
    image: publicHttpUrl((r.properties && r.properties.url) || (r.thumbnail && r.thumbnail.src)),
    thumb: publicHttpUrl(r.thumbnail && r.thumbnail.src),
    url: publicHttpUrl(r.url)
  })).filter((r) => r.image && r.thumb);
}

async function searchImagesDuckDuckGo(q) {
  const headers = { 'user-agent': USER_AGENT, 'accept-language': 'en-US,en;q=0.8' };
  const page = await fetch('https://duckduckgo.com/?q=' + encodeURIComponent(q) + '&iax=images&ia=images', { headers });
  const m = (await page.text()).match(/vqd=["']?([\d-]+)/);
  if (!m) throw new Error('no vqd');
  const res = await fetch(
    'https://duckduckgo.com/i.js?l=us-en&o=json&f=,,,,,&p=1&q=' + encodeURIComponent(q) + '&vqd=' + m[1],
    { headers: Object.assign({ referer: 'https://duckduckgo.com/' }, headers) }
  );
  if (!res.ok) throw new Error('ddg images ' + res.status);
  const data = await res.json();
  return (data.results || []).map((r) => ({
    title: stripTags(r.title),
    image: publicHttpUrl(r.image),
    thumb: publicHttpUrl(r.thumbnail),
    url: publicHttpUrl(r.url)
  })).filter((r) => r.image && r.thumb);
}

async function searchImagesCommons(q) {
  const res = await fetch(
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30' +
      '&prop=imageinfo&iiprop=url|mime&iiurlwidth=320&gsrsearch=' + encodeURIComponent(q),
    { headers: { 'user-agent': USER_AGENT } }
  );
  if (!res.ok) throw new Error('commons ' + res.status);
  const data = await res.json();
  const pages = Object.values((data.query && data.query.pages) || {});
  return pages.map((p) => {
    const info = p.imageinfo && p.imageinfo[0];
    if (!info || !/^image\//.test(info.mime || '')) return null;
    return {
      title: String(p.title || '').replace(/^File:/, '').replace(/\.\w+$/, ''),
      image: publicHttpUrl(info.url),
      thumb: publicHttpUrl(info.thumburl || info.url),
      url: publicHttpUrl(info.descriptionurl)
    };
  }).filter((r) => r && r.image && r.thumb);
}

async function handleSearch(request, reqUrl, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('origin');
  const cors = { 'access-control-allow-origin': '*' };
  if (allowed.length) {
    if (origin && !allowed.includes(origin)) {
      return text(403, 'Origin not allowed.');
    }
    cors['access-control-allow-origin'] = origin || allowed[0];
    cors.vary = 'Origin';
  }

  const q = (reqUrl.searchParams.get('q') || '').trim().slice(0, 300);
  if (!q) return json({ query: q, source: 'none', results: [] }, 200, cors);

  const attempts = [];
  if (reqUrl.searchParams.get('type') === 'images') {
    if (env.BRAVE_API_KEY) attempts.push(['brave', () => searchImagesBrave(q, env.BRAVE_API_KEY)]);
    attempts.push(['duckduckgo', () => searchImagesDuckDuckGo(q)]);
    attempts.push(['wikimedia', () => searchImagesCommons(q)]);
  } else if (env.BRAVE_API_KEY) attempts.push(['brave', () => searchBrave(q, env.BRAVE_API_KEY)]);
  if (reqUrl.searchParams.get('type') !== 'images') {
    attempts.push(['duckduckgo', () => searchDuckDuckGo(q)]);
    attempts.push(['wikipedia', () => searchWikipedia(q)]);
  }

  for (const [source, run] of attempts) {
    try {
      const results = (await run()).slice(0, 20);
      if (results.length) {
        return json({ query: q, source, results }, 200, Object.assign({ 'cache-control': 'public, max-age=300' }, cors));
      }
    } catch {
      // try the next provider
    }
  }
  return json({ query: q, source: 'none', results: [] }, 200, cors);
}

function json(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign(
      { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' },
      extra || {}
    )
  });
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const reqUrl = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, HEAD, OPTIONS',
          'access-control-allow-headers': '*',
          'access-control-max-age': '86400'
        }
      });
    }

    if (rateLimited(request)) {
      return text(429, 'Too many requests. Slow down.', { 'retry-after': '30' });
    }

    try {
      if (reqUrl.pathname === '/search') {
        return await handleSearch(request, reqUrl, env || {});
      }
      return await handleProxy(request, reqUrl);
    } catch (err) {
      return text(500, 'KXEARCH proxy error.');
    }
  }
};

// Exported for tests.
export { validateTarget, parseDuckDuckGo, buildShim, isAuthPage, Refusal };
