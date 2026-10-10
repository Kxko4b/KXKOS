/* Mines: a minesweeper-style game. Left click / tap opens, right click / long press / flag mode flags. First click is always safe. */
(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const LEVELS = { easy: [9, 9, 10], medium: [16, 16, 40], hard: [24, 16, 70] };   // cols, rows, mines
  const COLS = ['', '#2f5fa8', '#2e8b57', '#c0392b', '#1b2a49', '#7a1f1f', '#168a8a', '#222', '#777'];

  KX.registerApp({
    id: 'mines', title: 'Mines', icon: 'mines', width: 360, height: 470, minWidth: 300, minHeight: 360,
    desktop: true, order: 73,
    launch(win) {
      let level = 'easy', W, H, N, cells, over, started, flags, opened, t0, timer = 0, flagMode = false;
      const face = el('button', { type: 'button', class: 'kx-btn kx-mines-face', text: '🙂', title: 'New game', onclick: () => reset() });
      const left = el('span', { class: 'kx-mines-lcd' }), time = el('span', { class: 'kx-mines-lcd', text: '000' });
      const sel = el('select', { class: 'kx-brief-input', onchange: () => { level = sel.value; reset(); } },
        ...Object.keys(LEVELS).map((k) => el('option', { value: k, text: k[0].toUpperCase() + k.slice(1) })));
      const flagBtn = el('button', { type: 'button', class: 'kx-btn', text: 'Flag mode', title: 'Tap to flag (for touch)', onclick: () => { flagMode = !flagMode; flagBtn.classList.toggle('kx-active', flagMode); } });
      const grid = el('div', { class: 'kx-mines-grid' });
      win.body.appendChild(el('div', { class: 'kx-mines' }, el('div', { class: 'kx-mines-bar' }, left, face, time), el('div', { class: 'kx-mines-bar' }, sel, flagBtn), el('div', { class: 'kx-mines-wrap' }, grid)));
      win.onClose = () => clearInterval(timer);

      const idx = (x, y) => y * W + x;
      function nbrs(i) { const x = i % W, y = (i / W) | 0, r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) r.push(idx(nx, ny)); } return r; }

      function reset() {
        clearInterval(timer); [W, H, N] = LEVELS[level];
        cells = Array.from({ length: W * H }, () => ({ mine: false, open: false, flag: false, n: 0 }));
        over = false; started = false; flags = 0; opened = 0; face.textContent = '🙂'; time.textContent = '000';
        grid.textContent = ''; grid.style.gridTemplateColumns = 'repeat(' + W + ', 1fr)'; grid.style.aspectRatio = W + '/' + H;
        cells.forEach((c, i) => {
          c.el = el('button', { type: 'button', class: 'kx-mines-cell' });
          let hold = 0, held = false;
          c.el.addEventListener('click', () => { if (held) { held = false; return; } flagMode ? toggle(i) : open(i); });
          c.el.addEventListener('contextmenu', (e) => { e.preventDefault(); toggle(i); });
          c.el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { hold = setTimeout(() => { held = true; toggle(i); }, 450); } });
          ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => c.el.addEventListener(ev, () => clearTimeout(hold)));
          grid.appendChild(c.el);
        });
        draw();
      }
      function place(safe) {
        const bad = new Set([safe, ...nbrs(safe)]);
        let k = 0; while (k < N) { const i = (Math.random() * W * H) | 0; if (!cells[i].mine && !bad.has(i)) { cells[i].mine = true; k++; } }
        cells.forEach((c, i) => { c.n = nbrs(i).filter((j) => cells[j].mine).length; });
      }
      function open(i) {
        const c = cells[i]; if (over || c.open || c.flag) return;
        if (!started) { started = true; place(i); t0 = Date.now(); timer = setInterval(() => { time.textContent = String(Math.min(999, ((Date.now() - t0) / 1000) | 0)).padStart(3, '0'); }, 500); }
        if (c.mine) return lose(i);
        const stack = [i];
        while (stack.length) {
          const j = stack.pop(), d = cells[j]; if (d.open || d.flag) continue;
          d.open = true; opened++;
          if (!d.n) nbrs(j).forEach((k) => { if (!cells[k].open) stack.push(k); });
        }
        draw(); if (opened === W * H - N) win_();
      }
      function toggle(i) { const c = cells[i]; if (over || c.open) return; c.flag = !c.flag; flags += c.flag ? 1 : -1; draw(); }
      function lose(i) { over = true; clearInterval(timer); face.textContent = '😵'; cells.forEach((c) => { if (c.mine) c.open = true; }); draw(); cells[i].el.classList.add('kx-boom'); }
      function win_() { over = true; clearInterval(timer); face.textContent = '😎'; cells.forEach((c) => { if (c.mine) c.flag = true; }); flags = N; draw(); }
      function draw() {
        left.textContent = String(Math.max(-99, N - flags)).padStart(3, '0');
        cells.forEach((c) => {
          const e = c.el; e.className = 'kx-mines-cell' + (c.open ? ' kx-open' : '');
          e.textContent = c.open ? (c.mine ? '✹' : c.n ? String(c.n) : '') : c.flag ? '⚑' : '';
          e.style.color = c.open && c.n && !c.mine ? COLS[c.n] : c.flag ? '#c0392b' : '';
        });
      }
      reset();
    }
  });
})();
