# Roadmap

Finish each phase properly before starting the next.

## Phase 1: Desktop foundation: done
- [x] Fullscreen-capable desktop, sky + grass wallpaper, KXKOS branding
- [x] Desktop icons, taskbar, start button, start menu, clock, tray

## Phase 2: Window manager: done
- [x] Drag, resize, focus / bring to front, minimize, maximize, restore, close
- [x] Taskbar buttons per window, reusable by any app

## Phase 3: Basic apps
- [x] Notepad (open/save to virtual filesystem)
- [x] Calculator
- [x] Settings (wallpaper, accent colour, clock format)
- [x] Files (virtual filesystem: browse, create, rename, delete)
- [x] Terminal (`help clear about open settings kxearch` and more)

## Phase 4: KXEARCH
- [x] Browser chrome: address/search bar, back, forward, refresh, page area
- [x] Tabs, bookmarks bar, new-tab page with big search bar
- [x] Search results page + image search
- [x] Shortcuts such as `youtube`, `twitch`, or a pasted URL
- [x] Handle iframe-blocking sites honestly (proxy worker, player fallbacks, open externally)
- [x] Cloudflare Worker proxy (no Supabase needed so far); no secret keys in the frontend
- [ ] Sign-in on proxied sites (not planned: the proxy keeps no cookies on purpose)

## Phase 5: Polish
- [ ] Boot screen, startup/shutdown and UI sounds
- [ ] Animations, right-click menus, wallpaper customization
- [ ] Better icons, more apps, easter eggs
- [ ] Better fullscreen behaviour, more realistic desktop interactions

## Later: KXAI
- [ ] KXKOS frontend → KXAI API → model on a server; safe commands only (open apps, change wallpaper, search files)
- Not started on purpose: the basic OS comes first.
