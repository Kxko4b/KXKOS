# AGENTS.md

General instructions for coding agents working on KXKOS. The project rules are in [CLAUDE.md](CLAUDE.md); they apply to every agent, not just Claude.

## Quick start

1. Read `CLAUDE.md` and `ROADMAP.md`.
2. Run the project: open `index.html`, or `python3 -m http.server 8000`.
3. Find the code: core in `src/core/`, shared UI in `src/ui/`, each app in `src/apps/<app>/`.

## Adding an app

1. Create `src/apps/<name>/<name>.js` that calls `KXKOS.registerApp({...})`.
2. Add an icon to `src/ui/icons.js`.
3. Add a `<script>` tag for it in `index.html` before `src/main.js`.
4. Set `desktop: true` for a desktop icon; it appears in the start menu automatically.
5. Document it in `docs/apps.md` and `CHANGELOG.md`.

## Before you finish

- Syntax-check every JS file (`node --check`).
- Open the page and try what you changed. Check the browser console for errors.
- Keep changes focused; don't reformat unrelated code.
