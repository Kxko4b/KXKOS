// --- HTML Layout & Styling ---
const appContainer = document.createElement('div');
appContainer.id = 'minesweeper-app';
appContainer.innerHTML = `
  <style>
    #minesweeper-app {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 400px;
      margin: 20px auto;
      padding: 20px;
      border-radius: 12px;
      background: #f0f0f0;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      text-align: center;
      user-select: none;
    }
    #minesweeper-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding: 10px;
      background: #e0e0e0;
      border-radius: 8px;
    }
    .status-btn {
      font-size: 24px;
      padding: 5px 15px;
      cursor: pointer;
      border: 1px solid #999;
      background: #fff;
      border-radius: 4px;
    }
    #minesweeper-grid {
      display: grid;
      grid-template-columns: repeat(9, 35px);
      grid-template-rows: repeat(9, 35px);
      gap: 2px;
      justify-content: center;
      background: #bbbbbb;
      padding: 5px;
      border-radius: 6px;
    }
    .cell {
      width: 35px;
      height: 35px;
      background: #ccc;
      border: 3px solid;
      border-color: #fff #777 #777 #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 16px;
      cursor: pointer;
      box-sizing: border-box;
    }
    .cell.revealed {
      background: #ddd;
      border: 1px solid #aaa;
    }
    .cell.mine { background: #ff4d4d; }
    /* Farbcodierung für Zahlen */
    .c-1 { color: blue; }
    .c-2 { color: green; }
    .c-3 { color: red; }
    .c-4 { color: darkblue; }
    .c-5 { color: maroon; }
  </style>

  <div id="minesweeper-header">
    <div id="mines-count">Minen: 10</div>
    <button id="reset-btn" class="status-btn">🙂</button>
    <div id="game-status">Spiel läuft</div>
  </div>
  <div id="minesweeper-grid"></div>
`;

document.body.appendChild(appContainer);

// --- Spiellogik ---
const BOARD_SIZE = 9;
const MINE_COUNT = 10;
let grid = [];
let gameOver = false;
let minesLeft = MINE_COUNT;

const gridEl = document.getElementById('minesweeper-grid');
const resetBtn = document.getElementById('reset-btn');
const statusEl = document.getElementById('game-status');
const countEl = document.getElementById('mines-count');

// Spiel initialisieren
function initGame() {
  gridEl.innerHTML = '';
  grid = [];
  gameOver = false;
  minesLeft = MINE_COUNT;
  resetBtn.textContent = '🙂';
  statusEl.textContent = 'Spiel läuft';
  countEl.textContent = `Minen: ${minesLeft}`;

  // 1. Leeres Grid erstellen
  for (let r = 0; r < BOARD_SIZE; r++) {
    grid[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      grid[r][c] = {
        row: r,
        col: c,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0,
        element: null
      };
    }
  }

  // 2. Minen zufällig platzieren
  let minesPlaced = 0;
  while (minesPlaced < MINE_COUNT) {
    const r = Math.floor(Math.random() * BOARD_SIZE);
    const c = Math.floor(Math.random() * BOARD_SIZE);
    if (!grid[r][c].isMine) {
      grid[r][c].isMine = true;
      minesPlaced++;
    }
  }

  // 3. Nachbarmine-Zahlen berechnen
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (grid[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            if (grid[nr][nc].isMine) count++;
          }
        }
      }
      grid[r][c].neighborMines = count;
    }
  }

  // 4. DOM-Elemente erzeugen
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = grid[r][c];
      const cellEl = document.createElement('div');
      cellEl.classList.add('cell');
      cell.element = cellEl;

      // Klick-Events
      cellEl.addEventListener('click', () => revealCell(r, c));
      cellEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleFlag(r, c);
      });

      gridEl.appendChild(cellEl);
    }
  }
}

// Zelle aufdecken (Linksklick)
function revealCell(r, c) {
  if (gameOver) return;
  const cell = grid[r][c];
  if (cell.isRevealed || cell.isFlagged) return;

  cell.isRevealed = true;
  cell.element.classList.add('revealed');
  cell.element.style.border = '1px solid #aaa';

  if (cell.isMine) {
    endGame(false);
    return;
  }

  if (cell.neighborMines > 0) {
    cell.element.textContent = cell.neighborMines;
    cell.element.classList.add(`c-${cell.neighborMines}`);
  } else {
    // Leeres Feld -> Nachbarfelder rekursiv aufdecken
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          revealCell(nr, nc);
        }
      }
    }
  }

  checkWin();
}

// Flagge setzen/entfernen (Rechtsklick)
function toggleFlag(r, c) {
  if (gameOver) return;
  const cell = grid[r][c];
  if (cell.isRevealed) return;

  if (!cell.isFlagged) {
    cell.isFlagged = true;
    cell.element.textContent = '🚩';
    minesLeft--;
  } else {
    cell.isFlagged = false;
    cell.element.textContent = '';
    minesLeft++;
  }
  countEl.textContent = `Minen: ${minesLeft}`;
}

// Prüfen, ob alle Nicht-Minen aufgedeckt wurden
function checkWin() {
  let win = true;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!grid[r][c].isMine && !grid[r][c].isRevealed) {
        win = false;
      }
    }
  }
  if (win) endGame(true);
}

// Spiel beenden
function endGame(isWin) {
  gameOver = true;
  if (isWin) {
    resetBtn.textContent = '😎';
    statusEl.textContent = 'Gewonnen!';
  } else {
    resetBtn.textContent = '😵';
    statusEl.textContent = 'Verloren!';
    // Alle Minen aufdecken
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (grid[r][c].isMine) {
          grid[r][c].element.classList.add('mine');
          grid[r][c].element.textContent = '💣';
        }
      }
    }
  }
}

resetBtn.addEventListener('click', initGame);

// Erstmaliger Start
initGame();
