# Development

## Run

No build step. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000   # http://localhost:8000
```

## Check before you commit

1. Syntax-check every script: `for f in $(git ls-files 'src/*.js' 'src/**/*.js'); do node --check "$f"; done`
2. Open the page with the browser console open. It must load with **no errors** and no failed requests.
3. Open every app from the desktop icons, then try what you changed.
4. Window manager sanity check: drag, resize, minimize/restore from the taskbar, maximize, close.
5. Reload the page: wallpaper, accent colour and saved files should persist.

## Common mistakes that have broken the page before

- **Pasting a whole file into the middle of another file.** One stray `}` in `kxkos.css` silently disables every rule after it. One misplaced `(function () {` in a script stops that whole script from loading.
- **Script path typos in `index.html`.** A missing script fails quietly. Check the Network tab for 404s.
- **Asset paths in CSS are relative to the CSS file**, not to `index.html`. From `src/ui/kxkos.css` the repo root is `../../`. Never use a leading `/`.
- **Editing scripts from PowerShell** with backtick escapes can leave literal `` `r`n `` text in the file.
- Every script in `src/` expects the others to be the same version. Replace whole files from one commit rather than mixing versions.

## Adding an app

See `AGENTS.md`. In short: `src/apps/<name>/<name>.js` calls `KXKOS.registerApp({...})`, add an icon in `src/ui/icons.js`, add a `<script>` tag before `src/main.js`.
