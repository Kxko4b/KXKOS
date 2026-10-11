/*
 * Minesweeper: three levels, stopwatch and best times.
 * Left click reveals, right click (or the "Flag" toggle, for touch screens) places a flag.
 * The first click is never a mine. The stopwatch starts on the first click.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el } = KX;

  const LEVELS = {
    easy: { name: 'Easy', cols: 9, rows: 9, mines: 10, cell: 32 },
    medium: { name: 'Medium', cols: 16, rows: 16, mines: 40, cell: 28 },
    hard: { name: 'Hard', cols: 30, rows: 16, mines: 99, cell: 26 },
  };
  const BEST_KEY = 'kxkos.minesweeper.best';
  const loadBest = () => { try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch (e) { return {}; } };
  const saveBest = (o) => { try { localStorage.setItem(BEST_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } };
  const clock = (s) => String(Math.min(999, s)).padStart(3, '0');

  KX.registerApp({
    id: 'minesweeper',
    title: 'Minesweeper',
    icon: 'mine',
    width: 350,
    height: 520,
    minWidth: 330,
    minHeight: 440,
    desktop: true,
    order: 60,

    launch(win) {
      let level = 'easy';
      let cols = 9, rows = 9, mines = 10;
      let cells = [];
      let started = false; // mines are placed on the first click
      let over = false;
      let flagsLeft = mines;
      let revealedCount = 0;
      let flagMode = false;
      let t0 = 0;
      let timer = 0;
      let best = loadBest();

      const counter = el('div', { class: 'kx-ms-lcd' });
      const stopwatch = el('div', { class: 'kx-ms-lcd', title: 'Time in seconds', text: '000' });
      const face = el('button', { class: 'kx-btn kx-ms-face', type: 'button', 'aria-label': 'New game', title: 'New game', text: '🙂' });
      const levelSelect = el('select', { class: 'kx-ms-level', 'aria-label': 'Difficulty' },
        ...Object.keys(LEVELS).map((k) => el('option', { value: k, text: LEVELS[k].name + ' (' + LEVELS[k].cols + '×' + LEVELS[k].rows + ', ' + LEVELS[k].mines + ' mines)' })));
      const flagButton = el('button', { class: 'kx-btn', type: 'button', text: '🚩 Flag', 'aria-pressed': 'false', title: 'Flag mode (for touch screens)' });
      const bestLabel = el('div', { class: 'kx-ms-best' });
      const status = el('div', { class: 'kx-ms-status', 'aria-live': 'polite' });
      const board = el('div', { class: 'kx-ms-board', role: 'grid', 'aria-label': 'Board' });

      const index = (r, c) => r * cols + c;

      function neighbors(r, c) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if ((dr || dc) && nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(cells[index(nr, nc)]);
          }
        }
        return out;
      }

      function render(cell) {
        const e = cell.element;
        e.className = 'kx-ms-cell';
        e.textContent = '';
        if (cell.revealed) {
          e.classList.add('revealed');
          if (cell.mine) {
            e.classList.add('mine');
            e.textContent = '💣';
          } else if (cell.count > 0) {
            e.textContent = String(cell.count);
            e.classList.add('n' + cell.count);
          }
        } else if (cell.flagged) {
          e.textContent = '🚩';
        }
      }

      function updateHeader() {
        counter.textContent = String(Math.max(-99, flagsLeft)).padStart(3, '0');
        bestLabel.textContent = best[level] ? 'Best time: ' + best[level] + ' s' : 'No best time yet';
      }

      function tick() {
        if (!win.body.isConnected) { clearInterval(timer); return; }
        stopwatch.textContent = clock(Math.floor((Date.now() - t0) / 1000));
      }
      function stopClock() { clearInterval(timer); timer = 0; }

      function placeMines(safe) {
        // Keep the first click and its neighbours clear so the first move always opens something.
        const blocked = new Set([safe, ...neighbors(safe.row, safe.col)]);
        const candidates = cells.filter((cell) => !blocked.has(cell));
        for (let i = 0; i < mines; i++) {
          const pick = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
          pick.mine = true;
        }
        cells.forEach((cell) => {
          cell.count = neighbors(cell.row, cell.col).filter((n) => n.mine).length;
        });
        started = true;
        t0 = Date.now();
        timer = setInterval(tick, 250);
      }

      function endGame(won) {
        over = true;
        stopClock();
        const secs = Math.floor((Date.now() - t0) / 1000);
        stopwatch.textContent = clock(secs);
        face.textContent = won ? '😎' : '😵';
        status.textContent = won ? 'You won in ' + secs + ' s!' : 'Game over!';
        cells.forEach((cell) => {
          if (cell.mine && (!won || !cell.flagged)) {
            if (won) cell.flagged = true;
            else cell.revealed = true;
          }
          render(cell);
        });
        if (won) {
          flagsLeft = 0;
          if (!best[level] || secs < best[level]) {
            best[level] = secs;
            saveBest(best);
            status.textContent += ' New best time!';
          }
          updateHeader();
        }
      }

      function reveal(cell) {
        if (over || cell.revealed || cell.flagged) return;
        if (!started) placeMines(cell);
        if (cell.mine) {
          cell.revealed = true;
          endGame(false);
          cell.element.classList.add('exploded');
          return;
        }
        // Flood-fill outwards from empty cells.
        const stack = [cell];
        while (stack.length) {
          const current = stack.pop();
          if (current.revealed || current.flagged) continue;
          current.revealed = true;
          revealedCount++;
          render(current);
          if (current.count === 0) neighbors(current.row, current.col).forEach((n) => stack.push(n));
        }
        if (revealedCount === cols * rows - mines) endGame(true);
      }

      function toggleFlag(cell) {
        if (over || cell.revealed) return;
        if (!cell.flagged && flagsLeft === 0) return;
        cell.flagged = !cell.flagged;
        flagsLeft += cell.flagged ? -1 : 1;
        render(cell);
        updateHeader();
      }

      function fitWindow() {
        // Make the window big enough for the board (only grows it, never shrinks what the user chose).
        const L = LEVELS[level];
        const w = L.cols * (L.cell + 2) + 70;
        const h = L.rows * (L.cell + 2) + 230;
        if (!win.el.classList.contains('maximized')) {
          win.el.style.width = Math.max(win.el.offsetWidth, w) + 'px';
          win.el.style.height = Math.max(win.el.offsetHeight, h) + 'px';
        }
      }

      function newGame() {
        const L = LEVELS[level];
        cols = L.cols; rows = L.rows; mines = L.mines;
        stopClock();
        cells = [];
        started = false;
        over = false;
        flagsLeft = mines;
        revealedCount = 0;
        face.textContent = '🙂';
        stopwatch.textContent = '000';
        status.textContent = 'Playing';
        board.textContent = '';
        board.style.gridTemplateColumns = 'repeat(' + cols + ', ' + L.cell + 'px)';
        board.style.gridAutoRows = L.cell + 'px';

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cell = { row: r, col: c, mine: false, revealed: false, flagged: false, count: 0, element: null };
            cell.element = el('div', { class: 'kx-ms-cell', role: 'gridcell' });
            cell.element.addEventListener('click', () => (flagMode ? toggleFlag(cell) : reveal(cell)));
            cell.element.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              toggleFlag(cell);
            });
            cells.push(cell);
            board.appendChild(cell.element);
          }
        }
        updateHeader();
      }

      face.addEventListener('click', newGame);
      levelSelect.addEventListener('change', () => { level = levelSelect.value; newGame(); fitWindow(); levelSelect.blur(); });
      flagButton.addEventListener('click', () => {
        flagMode = !flagMode;
        flagButton.classList.toggle('primary', flagMode);
        flagButton.setAttribute('aria-pressed', String(flagMode));
      });
      win.onClose = () => stopClock();

      win.body.appendChild(
        el('div', { class: 'kx-ms' },
          el('div', { class: 'kx-ms-header' }, counter, face, stopwatch),
          el('div', { class: 'kx-ms-toolbar' }, levelSelect, flagButton),
          el('div', { class: 'kx-ms-boardwrap' }, board),
          bestLabel, status)
      );
      newGame();
    },
  });
})();
