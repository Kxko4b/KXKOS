# Changelog

## Unreleased

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
