# KXKOS

A retro desktop that runs entirely inside your browser. **Not a real operating system**: it is a web page that behaves like one.

Open the page, press the fullscreen button next to the clock, and you're inside KXKOS.

## Run it

No build step. Either open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## What works today (v0.1.0)

- Desktop with sky-and-grass wallpaper, icons, taskbar, start menu, clock, fullscreen button
- Window manager: drag, resize, focus, minimize, maximize/restore, taskbar buttons
- Apps: **Notepad** (saves files), **Calculator**, **Settings** (wallpaper, accent colour, clock), **Files** (virtual filesystem), **Terminal** (`help` lists commands)
- Files live in a virtual filesystem stored in your browser (`localStorage`). Your real files are never touched.

Coming next: **KXEARCH** (the built-in browser), then polish. See [ROADMAP.md](ROADMAP.md).

## Layout

```
index.html            page skeleton + script order
src/core/             kxkos.js (registry, settings), window-manager.js, taskbar.js, desktop.js, filesystem.js
src/ui/               kxkos.css, icons.js, widgets.js (dialogs, file chooser, menu bar)
src/apps/<app>/       one folder per app
assets/icons/         KXKOS logo
```

Working on this with an AI agent? Read [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) first.
