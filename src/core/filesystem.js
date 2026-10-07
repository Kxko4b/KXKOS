/*
 * KXKOS virtual filesystem.
 *
 * A simulated, in-browser filesystem persisted to localStorage. It never touches the user's real
 * files. Paths are POSIX-style and absolute ("/Documents/welcome.txt"). Methods throw Error with a
 * human-readable message, which the Terminal and Files app show directly.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const STORE_KEY = 'fs';
  const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

  // Children live in null-prototype objects so names like "constructor" or "__proto__" are safe.
  const newDir = () => ({ type: 'dir', children: Object.create(null), mtime: Date.now() });
  const newFile = (content) => ({ type: 'file', content: String(content || ''), mtime: Date.now() });

  function defaultTree() {
    const root = newDir();
    ['Documents', 'Pictures', 'Desktop', 'System'].forEach((name) => (root.children[name] = newDir()));
    root.children.Documents.children['welcome.txt'] = newFile(
      'Welcome to KXKOS!\n\n' +
        'This is a little desktop that runs entirely inside your browser.\n' +
        'Files you save here live in a virtual filesystem stored in this browser only.\n\n' +
        'Try the Terminal (type "help"), change the wallpaper in Settings, or press the\n' +
        'fullscreen button next to the clock to make KXKOS your whole screen.\n'
    );
    root.children.System.children['about.txt'] = newFile(
      'KXKOS ' + KX.version + '\nA web-based retro desktop. Not a real operating system.\n'
    );
    return root;
  }

  // Rebuild a tree loaded from JSON, validating its shape.
  function revive(node, depth) {
    if (!node || typeof node !== 'object' || depth > 50) return null;
    if (node.type === 'file') return { type: 'file', content: String(node.content || ''), mtime: Number(node.mtime) || Date.now() };
    if (node.type === 'dir') {
      const dir = newDir();
      dir.mtime = Number(node.mtime) || Date.now();
      for (const [name, child] of Object.entries(node.children || {})) {
        const revived = revive(child, depth + 1);
        if (revived && validName(name)) dir.children[name] = revived;
      }
      return dir;
    }
    return null;
  }

  function load() {
    const stored = revive(KX.storage.get(STORE_KEY, null), 0);
    return stored && stored.type === 'dir' ? stored : defaultTree();
  }

  let root = load();

  function save(path) {
    KX.storage.set(STORE_KEY, root);
    KX.emit('fs:changed', { path: path || '/' });
  }

  /* ------------------------------------------------------------------ paths */

  function validName(name) {
    return (
      typeof name === 'string' &&
      name.length > 0 &&
      name.length <= 100 &&
      name !== '.' &&
      name !== '..' &&
      !name.includes('/') &&
      !/[\u0000-\u001f]/.test(name) &&
      name.trim() === name
    );
  }

  /** Resolve `path` (absolute, or relative to `cwd`) into a clean absolute path. */
  function normalize(path, cwd) {
    let raw = String(path === undefined || path === null ? '' : path);
    if (!raw.startsWith('/')) raw = (cwd || '/') + '/' + raw;
    const out = [];
    for (const part of raw.split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') out.pop();
      else out.push(part);
    }
    return '/' + out.join('/');
  }

  const split = (path) => normalize(path).split('/').filter(Boolean);
  const basename = (path) => split(path).pop() || '/';
  const dirname = (path) => '/' + split(path).slice(0, -1).join('/');
  const join = (dir, name) => normalize(name, dir);

  /* ------------------------------------------------------------------ nodes */

  function getNode(path) {
    let node = root;
    for (const part of split(path)) {
      if (node.type !== 'dir') return null;
      node = node.children[part];
      if (!node) return null;
    }
    return node;
  }

  function mustGet(path) {
    const node = getNode(path);
    if (!node) throw new Error('No such file or directory: ' + normalize(path));
    return node;
  }

  function mustGetDir(path) {
    const node = mustGet(path);
    if (node.type !== 'dir') throw new Error('Not a directory: ' + normalize(path));
    return node;
  }

  function sizeOf(node) {
    if (node.type === 'dir') return Object.keys(node.children).length;
    return encoder ? encoder.encode(node.content).length : node.content.length;
  }

  function describe(name, node, parent) {
    return { name, type: node.type, size: sizeOf(node), mtime: node.mtime, path: join(parent, name) };
  }

  /* -------------------------------------------------------------------- API */

  KX.fs = {
    normalize,
    basename,
    dirname,
    join,
    validName,

    exists: (path) => !!getNode(path),
    isDir: (path) => { const n = getNode(path); return !!n && n.type === 'dir'; },
    isFile: (path) => { const n = getNode(path); return !!n && n.type === 'file'; },

    stat(path) {
      const node = getNode(path);
      if (!node) return null;
      const p = normalize(path);
      return describe(basename(p), node, dirname(p));
    },

    /** List a directory: folders first, then files, each sorted by name. */
    list(path) {
      const dir = mustGetDir(path);
      const base = normalize(path);
      return Object.keys(dir.children)
        .map((name) => describe(name, dir.children[name], base))
        .sort((a, b) =>
          a.type === b.type ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : a.type === 'dir' ? -1 : 1
        );
    },

    read(path) {
      const node = mustGet(path);
      if (node.type !== 'file') throw new Error('Is a directory: ' + normalize(path));
      return node.content;
    },

    /** Create or overwrite a file. The parent folder must already exist. */
    write(path, content) {
      const p = normalize(path);
      if (p === '/') throw new Error('Cannot write to the root folder');
      const name = basename(p);
      if (!validName(name)) throw new Error('Invalid file name: ' + name);
      const parent = mustGetDir(dirname(p));
      const existing = parent.children[name];
      if (existing && existing.type === 'dir') throw new Error('Is a directory: ' + p);
      if (existing) {
        existing.content = String(content);
        existing.mtime = Date.now();
      } else {
        parent.children[name] = newFile(content);
      }
      parent.mtime = Date.now();
      save(p);
    },

    mkdir(path) {
      const p = normalize(path);
      if (p === '/') throw new Error('Already exists: /');
      const name = basename(p);
      if (!validName(name)) throw new Error('Invalid folder name: ' + name);
      const parent = mustGetDir(dirname(p));
      if (parent.children[name]) throw new Error('Already exists: ' + p);
      parent.children[name] = newDir();
      parent.mtime = Date.now();
      save(p);
    },

    /** Delete a file or a folder (with everything inside it). */
    remove(path) {
      const p = normalize(path);
      if (p === '/') throw new Error('Cannot delete the root folder');
      mustGet(p);
      const parent = mustGetDir(dirname(p));
      delete parent.children[basename(p)];
      parent.mtime = Date.now();
      save(p);
    },

    /** Rename an item inside its current folder. */
    rename(path, newName) {
      const p = normalize(path);
      if (p === '/') throw new Error('Cannot rename the root folder');
      mustGet(p);
      if (!validName(newName)) throw new Error('Invalid name: ' + newName);
      const parent = mustGetDir(dirname(p));
      const oldName = basename(p);
      if (newName === oldName) return p;
      if (parent.children[newName]) throw new Error('Already exists: ' + join(dirname(p), newName));
      parent.children[newName] = parent.children[oldName];
      delete parent.children[oldName];
      parent.mtime = Date.now();
      save(p);
      return join(dirname(p), newName);
    },

    /** Restore the default folders and files. */
    reset() {
      root = defaultTree();
      save('/');
    },
  };
})();
