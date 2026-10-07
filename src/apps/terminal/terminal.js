/*
 * Terminal: a simulated KXKOS shell with its own commands. Works on the virtual filesystem only.
 *
 * Extending: other modules can add commands with
 *   KXKOS.terminal.register('name', { help: 'what it does', run(ctx, args) { ctx.print('hi'); } })
 * where ctx = { print(text, kind), cwd, setCwd(path), win, clear() } and kind is 'err' | 'dim' | 'ok'.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el } = KX;
  const fs = KX.fs;

  const commands = Object.create(null);
  const aliases = { cls: 'clear', dir: 'ls', ver: 'about', type: 'cat', del: 'rm', md: 'mkdir', '?': 'help' };

  function register(name, spec) {
    commands[name] = spec;
  }

  function openAppByName(name) {
    const key = name.toLowerCase();
    const app = KX.apps[key] || KX.listApps().find((a) => a.title.toLowerCase() === key);
    if (!app) return null;
    KX.openApp(app.id);
    return app;
  }

  /* ---------------------------------------------------------------- commands */

  register('help', {
    help: 'List available commands',
    run(ctx) {
      ctx.print('KXKOS terminal commands:');
      Object.keys(commands)
        .sort()
        .forEach((name) => ctx.print('  ' + name.padEnd(11) + commands[name].help));
      ctx.print('Tip: use Up/Down for history, Ctrl+L to clear.', 'dim');
    },
  });

  register('clear', { help: 'Clear the screen', run: (ctx) => ctx.clear() });

  register('about', {
    help: 'About KXKOS',
    run(ctx) {
      ctx.print('KXKOS ' + KX.version);
      ctx.print('A web-based retro desktop. Not a real operating system.', 'dim');
    },
  });

  register('echo', { help: 'Print text', run: (ctx, args) => ctx.print(args.join(' ')) });
  register('date', { help: 'Show the current date and time', run: (ctx) => ctx.print(new Date().toLocaleString()) });
  register('whoami', { help: 'Show the current user', run: (ctx) => ctx.print('guest') });
  register('pwd', { help: 'Print the current folder', run: (ctx) => ctx.print(ctx.cwd) });

  register('ls', {
    help: 'List a folder (ls [path])',
    run(ctx, args) {
      const target = fs.normalize(args[0] || '.', ctx.cwd);
      if (fs.isFile(target)) return ctx.print(fs.basename(target));
      const items = fs.list(target);
      if (!items.length) return ctx.print('(empty)', 'dim');
      ctx.print(items.map((i) => (i.type === 'dir' ? i.name + '/' : i.name)).join('   '));
    },
  });

  register('cd', {
    help: 'Change folder (cd [path])',
    run(ctx, args) {
      const target = fs.normalize(args[0] || '/', ctx.cwd);
      if (!fs.exists(target)) throw new Error('No such folder: ' + target);
      if (!fs.isDir(target)) throw new Error('Not a folder: ' + target);
      ctx.setCwd(target);
    },
  });

  register('cat', {
    help: 'Show a file (cat <file>)',
    run(ctx, args) {
      if (!args[0]) throw new Error('Usage: cat <file>');
      ctx.print(fs.read(fs.normalize(args[0], ctx.cwd)));
    },
  });

  register('mkdir', {
    help: 'Create a folder (mkdir <path>)',
    run(ctx, args) {
      if (!args[0]) throw new Error('Usage: mkdir <path>');
      fs.mkdir(fs.normalize(args[0], ctx.cwd));
    },
  });

  register('touch', {
    help: 'Create an empty file (touch <file>)',
    run(ctx, args) {
      if (!args[0]) throw new Error('Usage: touch <file>');
      const target = fs.normalize(args[0], ctx.cwd);
      if (!fs.exists(target)) fs.write(target, '');
    },
  });

  register('rm', {
    help: 'Delete a file or folder (rm <path>)',
    run(ctx, args) {
      if (!args[0]) throw new Error('Usage: rm <path>');
      const target = fs.normalize(args[0], ctx.cwd);
      fs.remove(target);
      if (!fs.isDir(ctx.cwd)) ctx.setCwd(fs.isDir(fs.dirname(target)) ? fs.dirname(target) : '/');
    },
  });

  register('apps', {
    help: 'List apps you can open',
    run: (ctx) => KX.listApps().forEach((app) => ctx.print('  ' + app.id.padEnd(11) + app.title)),
  });

  register('open', {
    help: 'Open an app or file (open <app|path>)',
    run(ctx, args) {
      if (!args[0]) throw new Error('Usage: open <app|path>   (try "apps")');
      if (openAppByName(args[0])) return ctx.print('Opening ' + args[0] + '…', 'ok');
      const target = fs.normalize(args[0], ctx.cwd);
      if (fs.isDir(target)) {
        KX.openApp('files', { path: target });
        return ctx.print('Opening ' + target + ' in Files…', 'ok');
      }
      if (fs.isFile(target)) {
        KX.openFile(target);
        return ctx.print('Opening ' + target + '…', 'ok');
      }
      throw new Error('No app or file named "' + args[0] + '"');
    },
  });

  register('settings', {
    help: 'Open Settings',
    run: (ctx) => {
      KX.openApp('settings');
      ctx.print('Opening Settings…', 'ok');
    },
  });

   register('minesweeper', {
    help: 'Open minesweeper, the KXKOS game',
    run(ctx) {
      if (KX.apps.minesweeper) {
        KX.openApp('minesweeper');
        ctx.print('Opening minesweeper…', 'ok');
      } else {
        ctx.print('minesweeper is not installed yet. It is planned for a later KXKOS release.', 'dim');
      }
    },
  });

  register('kxearch', {
    help: 'Open KXEARCH, the KXKOS browser',
    run(ctx) {
      if (KX.apps.kxearch) {
        KX.openApp('kxearch');
        ctx.print('Opening KXEARCH…', 'ok');
      } else {
        ctx.print('KXEARCH is not installed yet. It is planned for a later KXKOS release.', 'dim');
      }
    },
  });

  register('fullscreen', {
    help: 'Toggle fullscreen',
    run(ctx) {
      if (!KX.desktop.toggleFullscreen()) ctx.print('Fullscreen is not supported in this browser.', 'err');
    },
  });

  register('exit', { help: 'Close this terminal', run: (ctx) => ctx.win.close() });

  /* ------------------------------------------------------------------- shell */

  function parse(line) {
    const out = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let match;
    while ((match = re.exec(line))) out.push(match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3]);
    return out;
  }

  KX.terminal = { register, commands };

  KX.registerApp({
    id: 'terminal',
    title: 'Terminal',
    icon: 'terminal',
    width: 580,
    height: 380,
    minWidth: 300,
    minHeight: 180,
    desktop: true,
    order: 50,

    launch(win) {
      const MAX_ROWS = 500;
      let cwd = '/';
      const history = [];
      let historyIndex = 0;

      const out = el('div', { class: 'kx-term-out' });
      const prompt = el('span', { class: 'kx-term-prompt' });
      const input = el('input', { class: 'kx-term-input', type: 'text', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Terminal input', 'data-autofocus': '' });
      const root = el('div', { class: 'kx-term' }, out, el('div', { class: 'kx-term-line' }, prompt, input));

      function print(text, kind) {
        // textContent only: whatever the user types or a file contains is never treated as HTML.
        out.appendChild(el('div', { class: 'kx-term-row' + (kind ? ' ' + kind : ''), text: String(text) }));
        while (out.children.length > MAX_ROWS) out.firstChild.remove();
        root.scrollTop = root.scrollHeight;
      }

      function setCwd(path) {
        cwd = path;
        prompt.textContent = 'kx:' + cwd + '>';
      }

      const ctx = {
        print,
        win,
        clear: () => (out.textContent = ''),
        setCwd,
        get cwd() {
          return cwd;
        },
      };

      function run(line) {
        print(prompt.textContent + ' ' + line, 'dim');
        const words = parse(line);
        if (!words.length) return;
        const name = words[0].toLowerCase();
        const command = commands[aliases[name] || name];
        if (!command) return print('"' + words[0] + '" is not a KXKOS command. Type "help" for a list.', 'err');
        try {
          command.run(ctx, words.slice(1));
        } catch (err) {
          print(err.message, 'err');
        }
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const line = input.value;
          input.value = '';
          if (line.trim() && history[history.length - 1] !== line) history.push(line);
          historyIndex = history.length;
          run(line);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (historyIndex > 0) input.value = history[--historyIndex];
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          historyIndex = Math.min(historyIndex + 1, history.length);
          input.value = history[historyIndex] || '';
        } else if (e.key === 'l' && e.ctrlKey) {
          e.preventDefault();
          ctx.clear();
        }
      });

      // Click anywhere in the terminal to type, unless the user is selecting text.
      root.addEventListener('click', () => {
        const selection = window.getSelection && window.getSelection().toString();
        if (!selection) input.focus();
      });

      win.body.appendChild(root);
      setCwd('/');
      print('KXKOS ' + KX.version + ' terminal. Type "help" for a list of commands.', 'ok');
    },
  });
})();
