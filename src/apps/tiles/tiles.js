/* Tiles: slide and merge numbered tiles on a 4x4 board. Arrow keys / WASD or swipe. Best score is kept in localStorage. */
(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const N = 4;
  const SHADE = { 2: '#fff6dc', 4: '#ffe9a8', 8: '#ffc772', 16: '#ff9f5a', 32: '#ff7a5a', 64: '#ee5a5a', 128: '#8fd6a5', 256: '#5fc08a', 512: '#4aa3c9', 1024: '#3b7ddd', 2048: '#1b2a49' };

  KX.registerApp({
    id: 'tiles', title: 'Tiles', icon: 'tiles', width: 380, height: 520, minWidth: 320, minHeight: 440,
    desktop: true, order: 74,
    launch(win) {
      let b, score = 0, best = 0, over = false, won = false;
      try { best = +localStorage.getItem('kxkos.tiles.best') || 0; } catch (e) { /* ignore */ }
      const sc = el('span', { class: 'kx-tiles-score' }), bs = el('span', { class: 'kx-tiles-score' });
      const msg = el('div', { class: 'kx-tiles-msg' });
      const board = el('div', { class: 'kx-tiles-board', tabindex: '0' });
      win.body.appendChild(el('div', { class: 'kx-tiles' },
        el('div', { class: 'kx-tiles-bar' }, el('span', { text: 'Score ' }, sc), el('span', { text: 'Best ' }, bs),
          el('button', { type: 'button', class: 'kx-btn', text: 'New game', onclick: reset })),
        msg, board, el('div', { class: 'kx-tiles-hint', text: 'Arrow keys, WASD or swipe. Merge equal tiles to reach 2048.' })));

      function spawn() {
        const free = []; b.forEach((v, i) => { if (!v) free.push(i); });
        if (free.length) b[free[(Math.random() * free.length) | 0]] = Math.random() < 0.9 ? 2 : 4;
      }
      function reset() { b = Array(N * N).fill(0); score = 0; over = false; won = false; spawn(); spawn(); draw(); board.focus(); }
      function slide(line) {            // returns [newLine, gained]
        const t = line.filter(Boolean), out = []; let gain = 0;
        for (let i = 0; i < t.length; i++) { if (t[i] === t[i + 1]) { out.push(t[i] * 2); gain += t[i] * 2; i++; } else out.push(t[i]); }
        while (out.length < N) out.push(0);
        return [out, gain];
      }
      function move(d) {                // 0 left, 1 up, 2 right, 3 down
        if (over) return;
        let moved = false, gained = 0;
        for (let k = 0; k < N; k++) {
          const idx = [];
          for (let j = 0; j < N; j++) idx.push(d === 0 ? k * N + j : d === 2 ? k * N + (N - 1 - j) : d === 1 ? j * N + k : (N - 1 - j) * N + k);
          const [out, g] = slide(idx.map((i) => b[i])); gained += g;
          idx.forEach((i, j) => { if (b[i] !== out[j]) moved = true; b[i] = out[j]; });
        }
        if (!moved) return;
        score += gained; spawn();
        if (score > best) { best = score; try { localStorage.setItem('kxkos.tiles.best', String(best)); } catch (e) { /* ignore */ } }
        if (!won && b.includes(2048)) { won = true; msg.textContent = 'You made 2048! Keep going.'; }
        else if (!canMove()) { over = true; msg.textContent = 'No moves left. Press New game.'; }
        draw();
      }
      function canMove() {
        if (b.includes(0)) return true;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = b[y * N + x]; if ((x < N - 1 && v === b[y * N + x + 1]) || (y < N - 1 && v === b[(y + 1) * N + x])) return true; }
        return false;
      }
      function draw() {
        sc.textContent = score; bs.textContent = best;
        if (!over && !won) msg.textContent = '';
        board.textContent = '';
        b.forEach((v) => {
          const c = el('div', { class: 'kx-tiles-cell', text: v ? String(v) : '' });
          if (v) { c.style.background = SHADE[v] || '#1b2a49'; c.style.color = v >= 128 ? '#fff' : '#1b2a49'; if (v >= 1024) c.style.fontSize = '20px'; }
          board.appendChild(c);
        });
      }
      const keys = { ArrowLeft: 0, a: 0, ArrowUp: 1, w: 1, ArrowRight: 2, d: 2, ArrowDown: 3, s: 3 };
      function onKey(e) {
        if (!win.body.isConnected) { document.removeEventListener('keydown', onKey); return; }
        if (!win.body.contains(document.activeElement) && document.activeElement !== document.body) return;
        const d = keys[e.key]; if (d === undefined) return; e.preventDefault(); move(d);
      }
      document.addEventListener('keydown', onKey);
      let sx = 0, sy = 0;
      board.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
      board.addEventListener('pointerup', (e) => {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        move(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 2) : (dy < 0 ? 1 : 3));
      });
      win.onClose = () => document.removeEventListener('keydown', onKey);
      reset();
    }
  });
})();
