# KXEARCH

Built-in browser with tabs (+ button, middle-click closes), a bookmarks bar (☆ in the address bar, × on hover removes; stored in `localStorage`),
and a new-tab page with a big search bar and bookmark tiles. Search results have **All** and **Images** tabs; click an image to open a larger view.
Type in the address bar or the big search bar:

- a web address (`https://x.com`, `example.com`) opens the page through the proxy
- anything else (`youtube`, `best pizza near me`) shows a results page; click a result to open it
- YouTube and Twitch links use their official embed players; Netflix cannot be embedded

Back / forward / refresh work for pages and for search result pages.

## Proxy worker (`src/index.js`)

A Cloudflare Worker, deployed separately (Cloudflare dashboard > Workers > edit code, paste the file, Deploy).
The URL is set as `PROXY` in `src/apps/kxearch/kxearch.js`.

| Route | Purpose |
| --- | --- |
| `/?url=<encoded url>` | fetch a public page and return it with links rewritten |
| `/search?q=<query>` | JSON `{query, source, results:[{title,url,description}]}` |
| `/search?type=images&q=<query>` | JSON image results `{title,image,thumb,url}` (Brave, DuckDuckGo, Wikimedia Commons) |

### Safety model (deny-list, not allow-list)

Any public website works. Refused: non-http(s) schemes, credentials in URLs, ports other than 80/443, IPv6 literals,
private/loopback/link-local/reserved IPv4 (including `2130706433`, `0x7f.1` style tricks), single-label and
internal hostnames (`.local`, `.internal`, ...), and the proxy itself. Every redirect hop is re-checked.
Cookies, `Authorization`, `Referer` and `Origin` are never forwarded; `Set-Cookie` and upstream CSP/X-Frame-Options are dropped.
Only GET/HEAD, 15 s timeout, size limits (8 MB HTML, 40 MB other), best-effort rate limit per IP.
Responses carry `Content-Security-Policy: sandbox ...` and the iframe is sandboxed without `allow-same-origin`,
so proxied sites cannot read each other's storage.

### Cookies and sign-in

The proxy keeps no cookies on purpose: a proxy that stores logins would hold everyone's sessions and passwords.
So sign-in does not work inside KXEARCH. Known sign-in hosts (Google, Microsoft, Apple, Twitch) show a notice with an
"open in a normal tab" button. YouTube works for browsing and watching (search, then the built-in player), not for logging in.
Pages' own `fetch`/XHR/dynamic resources are routed through the proxy by an injected script, so JS-heavy sites work better.

### Limits

- Scripts that call `fetch`/`XMLHttpRequest` with relative URLs go to the proxy origin and usually fail; sites that need logins, DRM or heavy JS apps may not work.
- Sandboxed pages have no localStorage/cookies, so some sites show consent or login walls.
- Rate limiting is per Worker instance, not global. For real abuse protection add a Cloudflare rate-limiting rule.

### Search providers

Tried in order: Brave Search API (only if the secret `BRAVE_API_KEY` is set on the Worker), DuckDuckGo HTML, Wikipedia.
DuckDuckGo may block Cloudflare IPs at times; add a Brave key for reliable results (free tier available).
Set `ALLOWED_ORIGINS` (e.g. `https://kxko4b.github.io`) to restrict who can call `/search`.
Never put keys in frontend code.

## Testing

Worker logic: mock `fetch` and call `worker.fetch(...)` in Node (validation, redirects, header stripping, search parsing).
HTML link rewriting needs the Workers runtime (`HTMLRewriter`); check it after deploying by opening a page.
UI: open KXEARCH, search `youtube`, open a result, use back/forward.
