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

## Phase 4: KXEARCH (next)
- [ ] Browser chrome: address/search bar, back, forward, refresh, page area
- [ ] Search results page
- [ ] Shortcuts such as `youtube`, `twitch`, or a pasted URL
- [ ] Handle iframe-blocking sites honestly (open externally / allowed embeds / proxy)
- [ ] Backend (Supabase) only if needed; no secret keys in the frontend

## Phase 5: Polish
- [ ] Boot screen, startup/shutdown and UI sounds
- [ ] Animations, right-click menus, wallpaper customization
- [ ] Better icons, more apps, easter eggs
- [ ] Better fullscreen behaviour, more realistic desktop interactions

## Later: KXAI
- [ ] KXKOS frontend → KXAI API → model on a server; safe commands only (open apps, change wallpaper, search files)
- Not started on purpose: the basic OS comes first.
