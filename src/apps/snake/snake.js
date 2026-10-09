(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const N = 20, CELL = 20, BEST = 'kxkos.snake.best';

  KX.registerApp({
    id: 'snake', title: 'Snake', icon: 'snake', width: 440, height: 520, minWidth: 420, minHeight: 500,
    desktop: true, order: 61,
    launch(win) {
      const canvas = el('canvas', { class: 'kx-snake-canvas', tabindex: '0' });
      canvas.width = N * CELL; canvas.height = N * CELL;
      const ctx = canvas.getContext('2d');
      const info = el('div', { class: 'kx-embed-bar' });
      const score = el('strong', { text: 'Score 0' });
      const bestEl = el('span', { text: '' });
      const restart = el('button', { type: 'button', class: 'kx-btn', text: 'New game', onclick: () => start() });
      info.append(score, bestEl, el('span', { class: 'kx-embed-spacer' }), restart);
      let best = 0;
      try { best = Number(localStorage.getItem(BEST)) || 0; } catch { /* ignore */ }
      let snake, dir, next, food, timer, points, over;

      function place() {
        do { food = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; }
        while (snake.some((s) => s.x === food.x && s.y === food.y));
      }
      function start() {
        clearInterval(timer);
        snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
        dir = next = { x: 1, y: 0 }; points = 0; over = false;
        place(); draw(); updateInfo();
        timer = setInterval(tick, 110);
        canvas.focus();
      }
      function updateInfo() {
        score.textContent = 'Score ' + points;
        bestEl.textContent = ' · Best ' + best + (over ? ' · Game over' : '');
      }
      function tick() {
        if (!win.body.isConnected) { clearInterval(timer); return; }
        dir = next;
        const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || snake.some((s) => s.x === h.x && s.y === h.y)) {
          over = true; clearInterval(timer);
          if (points > best) { best = points; try { localStorage.setItem(BEST, String(best)); } catch { /* ignore */ } }
          updateInfo(); draw(); return;
        }
        snake.unshift(h);
        if (h.x === food.x && h.y === food.y) { points++; place(); updateInfo(); } else snake.pop();
        draw();
      }
      function draw() {
        ctx.fillStyle = '#cfeec0'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e5484d'; ctx.fillRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4);
        snake.forEach((s, i) => { ctx.fillStyle = i ? '#2f6f3a' : '#1b2a49'; ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2); });
        if (over) { ctx.fillStyle = 'rgba(27,42,73,.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#fff'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Game over', canvas.width / 2, canvas.height / 2); }
      }
      const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      canvas.addEventListener('keydown', (e) => {
        const d = DIRS[e.key];
        if (!d) return;
        e.preventDefault();
        if (d[0] !== -dir.x || d[1] !== -dir.y) next = { x: d[0], y: d[1] };
      });
      win.onClose = () => clearInterval(timer);
      win.body.classList.add('kx-embed-body');
      win.body.appendChild(info);
      win.body.appendChild(el('div', { class: 'kx-paint-wrap' }, canvas));
      start();
    }
  });
})();
