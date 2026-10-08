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
| `/search?type=videos&q=<query>` | JSON video results `{title,url,thumb,channel,duration,date}` (needs `SERPER_API_KEY`) |
| `/search?type=images&q=<query>` | JSON image results `{title,image,thumb,url}` (Brave, DuckDuckGo, Wikimedia Commons) |

### Safety model (deny-list, not allow-list)

Any public website works. Refused: non-http(s) schemes, credentials in URLs, ports other than 80/443, IPv6 literals,
private/loopback/link-local/reserved IPv4 (including `2130706433`, `0x7f.1` style tricks), single-label and
internal hostnames (`.local`, `.internal`, ...), and the proxy itself. Every redirect hop is re-checked.
Cookies, `Authorization`, `Referer` and `Origin` are never forwarded; `Set-Cookie` and upstream CSP/X-Frame-Options are dropped.
GET/HEAD/POST (POST bodies up to 1 MB; the site sees itself as referrer, never your address or cookies), 15 s timeout, size limits (8 MB HTML, 40 MB other), best-effort rate limit per IP.
Responses carry `Content-Security-Policy: sandbox ...` and the iframe is sandboxed (no top navigation, no access to KXKOS).
Proxied pages share the proxy's origin, so an injected script gives every site its own private `localStorage`/`sessionStorage` namespace and an in-page cookie jar; sites cannot read each other's data.

### Cookies and sign-in

The proxy keeps no cookies on purpose: a proxy that stores logins would hold everyone's sessions and passwords.
So sign-in does not work inside KXEARCH. Known sign-in hosts (Google, Microsoft, Apple, Twitch) show a notice with an
"open in a normal tab" button. YouTube works for browsing and watching (search, then the built-in player), not for logging in.
Pages' own `fetch`/XHR/dynamic resources are routed through the proxy by an injected script, so JS-heavy sites work better.

### YouTube / Twitch not playing

The players refuse to run when KXKOS is opened as a file (`file://`). Host it (GitHub Pages: repo Settings > Pages, then open
`https://<user>.github.io/<repo>/`) or run `python3 -m http.server` and open `http://localhost:8000`.
The player bar above each video also offers "Via proxy" and "New tab" as fallbacks.

YouTube/Google cookie banners: the proxy sends one fixed, non-personal consent cookie (`SOCS=CAI`) to those sites so the banner does not
reappear in a loop. Nothing from the user's browser is ever forwarded as a cookie.

### Limits

- Scripts that call `fetch`/`XMLHttpRequest` with relative URLs go to the proxy origin and usually fail; sites that need logins, DRM or heavy JS apps may not work.
- Pages see the proxy's address as `location`, not the real one (the path is mirrored for single-page apps). Big web apps such as GitHub's logged-in pages, YouTube's full site and Google products may still break; public pages usually work.
- Rate limiting is per Worker instance, not global. For real abuse protection add a Cloudflare rate-limiting rule.

### Search providers

Tried in order: Serper (Google results, only if the secret `SERPER_API_KEY` is set), Brave (only if `BRAVE_API_KEY` is set),
DuckDuckGo HTML, then Wikipedia. DuckDuckGo usually blocks Cloudflare's servers for web results, so without a key web search
mostly falls back to Wikipedia (image search via DuckDuckGo does work). Good answers are cached for a day to save quota.

**No credit card option:** sign up at serper.dev (2,500 free searches, no card required as of Oct 2026, one-time credit), copy the API key, then in Cloudflare:
Workers & Pages > `kxearch-proxy` > Settings > Variables and Secrets > Add > type **Secret**, name `SERPER_API_KEY`, paste the key, Deploy.
Check `https://<your-worker>/search?q=youtube`: the JSON should say `"source":"serper"`.

Set `ALLOWED_ORIGINS` (e.g. `https://kxko4b.github.io`) to restrict who can call `/search`.
Never put keys in frontend code or in the repo.

## Testing

Worker logic: mock `fetch` and call `worker.fetch(...)` in Node (validation, redirects, header stripping, search parsing).
HTML link rewriting needs the Workers runtime (`HTMLRewriter`); check it after deploying by opening a page.
UI: open KXEARCH, search `youtube`, open a result, use back/forward.
