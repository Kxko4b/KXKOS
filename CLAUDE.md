# CLAUDE.md: KXKOS

## What this is

- KXKOS is a **web-based OS simulation**. It is **not a real OS**.
- It runs in the browser and is meant to be used **fullscreen**.
- Look: retro classic desktop, chunky navy outlines, cream panels, hard shadows. Its own identity, **not a Windows clone**. Use KXKOS branding everywhere.
- Default wallpaper: **blue sky + green grass** (CSS gradients, `[data-wallpaper="meadow"]`).
- **KXEARCH** is the planned built-in browser/search app ("Chrome, but not Chrome"). Not built yet.
- Apps run inside KXKOS windows (draggable, resizable, minimizable, maximizable, closable).

## Architecture rules

- Vanilla HTML/CSS/JS only. No frameworks, no bundler, no new dependencies unless clearly necessary.
- Plain `<script>` tags, not ES modules, so `index.html` works from `file://`. Everything hangs off the global `KXKOS`.
- Script order lives in `index.html`. New files must be added there.
- An app is registered with `KXKOS.registerApp({ id, title, icon, launch(win, args) })` and builds its UI inside `win.body`. It never touches window chrome. Use `win.onBeforeClose`, `win.onClose`, `win.isDirty` for hooks.
- Shared helpers: `KXKOS.el` (DOM builder), `KXKOS.ui` (alert/confirm/prompt/choose/fileDialog/menuBar), `KXKOS.fs` (virtual filesystem), `KXKOS.settings`, `KXKOS.on/emit` (events; `on` returns an unsubscribe function).
- Never use `innerHTML` with user-provided or file-provided text. Use `text` / `textContent`.
- Colours come from CSS variables in `src/ui/kxkos.css` (`--kx-accent` etc.). Don't hard-code accent colours.

## KXEARCH constraints (when you build it)

- Many sites block iframes (`X-Frame-Options`, CSP `frame-ancestors`). Never pretend arbitrary sites can be iframed. Combine allowed embeds, search results, opening externally, and a backend proxy where legal.
- **Never put secret API keys in frontend JS.** If a backend is needed, the owner prefers **Supabase** (Edge Functions keep secrets server-side).
- **KXAI** (AI via a server API) is future work. Do not start it before the basic OS is done.

## Working agreement

- Preserve existing functionality. Don't rewrite unrelated code.
- Keep it simple; don't over-engineer.
- Make each stage actually work before starting the next (see ROADMAP.md).
- Test your changes (see docs/development.md). Update docs and CHANGELOG.md when adding major features.
- The owner prefers full working implementations over snippets, and real features over fake UI.
