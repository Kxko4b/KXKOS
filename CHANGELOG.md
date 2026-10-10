# Changelog

## Unreleased: Lime Street signal box (draft)
- Second signal box on the shared engine; engine now takes bell keys, title and image from the data file.

## Unreleased

- KXEARCH Twitch home: "Live now" grid from the worker route `/twitch/streams` (needs the `TWITCH_CLIENT_SECRET` worker secret; Client ID is built in).

- Percstown signal box game (first version): clickable diagram, lever frame with draft interlocking, track-circuit lights, block bell with Web Audio sounds, bell-code bot that talks to Riceville/Samthon/Bighton and trains that run on their own. See docs/signalbox.md.

- Paint: lasso (cut and move), text tool, custom colour picker, ruler (strokes snap along it), undo, and hold-still snapping of a stroke into an editable line or bezier curve with draggable handles.
- Window snapping: drag a window to the left/right edge for half screen, top edge to maximise; dragging it away restores its size.
- Desktop right-click menu (next wallpaper, settings, fullscreen, open apps); new wallpapers Sunset, Mint, Grid.
- Owner-only Notes (synced to Supabase table `kxkos_notes`, RLS limited to the owner) and Requests inbox (Leverframe requests, change status). Shared sign-in via `KX.owner`.

- New apps: Paint (brush, colours, eraser, save PNG), Snake (arrow keys/WASD, saved best score), Clock (time, stopwatch, timer).

- Leverframe app: embeds the custom Leverframe site (Reload, Home, Status, open in new tab).
- Briefing app (owner only, haleannson@gmail.com): email-link sign-in via Supabase Auth, tidy daily briefing cards (weather, school changes, homework, exams, calendar, requests). Backed by the read-only `briefing-view` Edge Function (supabase/functions/briefing-view), which checks the caller's email and sends no push.
- `wrangler.jsonc` so Cloudflare Workers Builds can auto-deploy the KXEARCH proxy on every push.

- KXEARCH: Videos tab (YouTube/Google video results with thumbnails, click to watch in the player); YouTube search now uses it; Twitch start page has quick channel tiles
- Worker: `/search?type=videos` (needs `SERPER_API_KEY`). Must be redeployed
- KXEARCH: Twitch chat panel (Chat button; Twitch's own login works inside it); hints on how YouTube/Twitch sign-in works with the embedded players
- Twitch start page (type a channel name, built-in player); Twitch directory/search paths no longer treated as channels
- Worker: fixed consent cookie for YouTube/Google so cookie banners stop looping; page cookie jar persists per site; navigating to the worker root from a frame recovers the site instead of showing "Proxy is running". Must be redeployed
- Worker: a page script navigating to a bare path (/foo) or a reloaded frame no longer shows "reloaded outside KXEARCH"; the worker recovers the real site (via window.name) and continues. Script-created external links are proxied too. Must be redeployed
- Worker: Serper (Google results, no credit card) as an optional search provider via `SERPER_API_KEY`, plus a one-day cache for search answers. Must be redeployed
- Fixed pages that failed with errors like GitHub's "What‽": proxied pages now get working per-site storage and a cookie jar instead of a locked-down sandbox; YouTube player bar gets a privacy-player option
- KXEARCH: YouTube/Twitch player bar with Via proxy / New tab fallbacks and a file:// warning
- Worker: POST support, site-as-referrer so hotlink-protected media loads
- KXEARCH: tabs, new-tab page with big search bar, bookmarks bar, image search with viewer, YouTube home/search page, sign-in notice instead of a blocked page
- Worker: injected script routes page fetch/XHR/dynamic resources through the proxy, ports 8080/8443 allowed, image search endpoint. Must be redeployed
- KXEARCH search: typing text in the address bar shows a results page (instant shortcuts for popular sites + web results), with back/forward support; iframes are sandboxed
- Proxy worker rewritten: any public website works (deny-list instead of allow-list), SSRF protections, redirect re-checks, no cookie/referer forwarding, size/time limits, `/search` endpoint. Must be redeployed in Cloudflare
- Added `docs/kxearch.md`
- Minesweeper is now a real KXKOS app (window, desktop icon, start menu entry): first click is always safe, right click or the flag toggle places flags
- Fixed the default wallpaper: the image path was wrong, so the desktop rendered black
- Fixed a stray `}` in `kxkos.css` that disabled the rules after it
- Fixed `index.html` script tags (stray `` `r`n `` text, Minesweeper script missing)
- Added `docs/development.md`

## 0.1.0

First working version.

- Desktop: sky + grass wallpaper (plus Dusk, Night, Teal), desktop icons, taskbar, start menu, clock, fullscreen button, shut down screen
- Window manager: drag, resize, focus, minimize, maximize/restore, close, taskbar buttons, unsaved-changes prompts
- Apps: Notepad, Calculator, Settings, Files, Terminal
- Virtual filesystem persisted in `localStorage`
- Settings (wallpaper, accent colour, 24-hour clock) persisted in `localStorage`
