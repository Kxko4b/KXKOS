/* Tic-tac-toe: play a friend, or the computer (unbeatable, via minimax). */
(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  function winner(b) {
    for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    return b.every((x) => x) ? 'draw' : null;
  }

  function bestMove(b, me, opp) {
    function score(board, depth, turn) {
      const w = winner(board);
      if (w === me) return 10 - depth;
      if (w === opp) return depth - 10;
      if (w === 'draw') return 0;
      const vals = board.map((v, i) => {
        if (v) return null;
        board[i] = turn;
        const s = score(board, depth + 1, turn === me ? opp : me);
        board[i] = null;
        return s;
      }).filter((v) => v !== null);
      return turn === me ? Math.max(...vals) : Math.min(...vals);
    }
    let best = -Infinity, move = null;
    b.forEach((v, i) => {
      if (v) return;
      b[i] = me;
      const s = score(b, 0, opp);
      b[i] = null;
      if (s > best) { best = s; move = i; }
    });
    return move;
  }

  KX.registerApp({
    id: 'tictactoe', title: 'Tic-tac-toe', icon: 'ttt', width: 340, height: 420, minWidth: 280, minHeight: 360,
    desktop: true, order: 77,
    launch(win) {
      let board = Array(9).fill(null), turn = 'X', vsComputer = true, over = false;
      const cells = Array.from({ length: 9 }, (_, i) => el('button', { type: 'button', class: 'kx-ttt-cell', onclick: () => play(i) }));
      const status = el('div', { class: 'kx-ttt-status' });
      const modeSel = el('select', { class: 'kx-set-select', onchange: () => { vsComputer = modeSel.value === 'computer'; reset(); } },
        el('option', { value: 'computer', text: 'Vs computer' }),
        el('option', { value: 'two', text: 'Two players' }));

      function setStatus() {
        const w = winner(board);
        if (w === 'draw') status.textContent = "It's a draw.";
        else if (w) status.textContent = (w === 'X' ? 'X' : 'O') + ' wins!';
        else status.textContent = (turn === 'X' ? "X's" : "O's") + ' turn' + (vsComputer && turn === 'O' ? ' (computer)' : '');
      }

      function render() {
        cells.forEach((c, i) => {
          c.textContent = board[i] || '';
          c.classList.toggle('kx-ttt-x', board[i] === 'X');
          c.classList.toggle('kx-ttt-o', board[i] === 'O');
          c.disabled = !!board[i] || over;
        });
        setStatus();
      }

      function computerTurn() {
        const i = bestMove(board, 'O', 'X');
        if (i !== null) { board[i] = 'O'; afterMove(); }
      }

      function afterMove() {
        const w = winner(board);
        if (w) { over = true; render(); return; }
        turn = turn === 'X' ? 'O' : 'X';
        render();
        if (vsComputer && turn === 'O' && !over) setTimeout(computerTurn, 250);
      }

      function play(i) {
        if (over || board[i]) return;
        board[i] = turn;
        afterMove();
      }

      function reset() { board = Array(9).fill(null); turn = 'X'; over = false; render(); }

      win.body.appendChild(
        el(
          'div',
          { class: 'kx-ttt' },
          el('div', { class: 'kx-ttt-bar' }, modeSel, el('button', { type: 'button', class: 'kx-btn', text: 'New game', onclick: reset })),
          el('div', { class: 'kx-ttt-board' }, cells),
          status
        )
      );
      render();
    },
  });
})();
