/*
 * Minesweeper: classic 9x9 board with 10 mines.
 * Left click reveals, right click (or the "Flagge" toggle, for touch screens) places a flag.
 * The first click is never a mine.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el } = KX;

  const SIZE = 9;
  const MINES = 10;

  KX.registerApp({
    id: 'minesweeper',
    title: 'Minesweeper',
    icon: 'mine',
    width: 350,
    height: 470,
    minWidth: 330,
    minHeight: 440,
    desktop: true,
    order: 60,

    launch(win) {
      let cells = [];
      let started = false; // mines are placed on the first click
      let over = false;
      let flagsLeft = MINES;
      let revealedCount = 0;
      let flagMode = false;

      const counter = el('div', { class: 'kx-ms-counter' });
      const face = el('button', { class: 'kx-btn kx-ms-face', type: 'button', 'aria-label': 'Neues Spiel', title: 'Neues Spiel', text: '🙂' });
      const flagButton = el('button', { class: 'kx-btn', type: 'button', text: '🚩 Flagge', 'aria-pressed': 'false', title: 'Flaggenmodus (für Touch-Geräte)' });
      const status = el('div', { class: 'kx-ms-status', 'aria-live': 'polite' });
      const board = el('div', { class: 'kx-ms-board', role: 'grid', 'aria-label': 'Spielfeld' });

      const index = (r, c) => r * SIZE + c;

      function neighbors(r, c) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if ((dr || dc) && nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) out.push(cells[index(nr, nc)]);
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
        counter.textContent = 'Minen: ' + flagsLeft;
      }

      function placeMines(safe) {
        // Keep the first click and its neighbours clear so the first move always opens something.
        const blocked = new Set([safe, ...neighbors(safe.row, safe.col)]);
        const candidates = cells.filter((cell) => !blocked.has(cell));
        for (let i = 0; i < MINES; i++) {
          const pick = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
          pick.mine = true;
        }
        cells.forEach((cell) => {
          cell.count = neighbors(cell.row, cell.col).filter((n) => n.mine).length;
        });
        started = true;
      }

      function endGame(won) {
        over = true;
        face.textContent = won ? '😎' : '😵';
        status.textContent = won ? 'Gewonnen!' : 'Verloren!';
        cells.forEach((cell) => {
          if (cell.mine && (!won || !cell.flagged)) {
            if (won) cell.flagged = true;
            else cell.revealed = true;
          }
          render(cell);
        });
        if (won) {
          flagsLeft = 0;
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
        if (revealedCount === SIZE * SIZE - MINES) endGame(true);
      }

      function toggleFlag(cell) {
        if (over || cell.revealed) return;
        if (!cell.flagged && flagsLeft === 0) return;
        cell.flagged = !cell.flagged;
        flagsLeft += cell.flagged ? -1 : 1;
        render(cell);
        updateHeader();
      }

      function newGame() {
        cells = [];
        started = false;
        over = false;
        flagsLeft = MINES;
        revealedCount = 0;
        face.textContent = '🙂';
        status.textContent = 'Spiel läuft';
        board.textContent = '';

        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
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
      flagButton.addEventListener('click', () => {
        flagMode = !flagMode;
        flagButton.classList.toggle('primary', flagMode);
        flagButton.setAttribute('aria-pressed', String(flagMode));
      });

      win.body.appendChild(
        el('div', { class: 'kx-ms' }, el('div', { class: 'kx-ms-header' }, counter, face, flagButton), board, status)
      );
      newGame();
    },
  });
})();
