/*
 * Calculator: basic arithmetic with + - × ÷, %, ±, backspace and full keyboard support.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el } = KX;

  const SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  /** Round away binary float noise (0.1 + 0.2 -> 0.3) and format for display. */
  function format(number) {
    if (!isFinite(number)) return 'Error';
    const rounded = Number(number.toPrecision(12));
    const abs = Math.abs(rounded);
    if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return rounded.toExponential(6).replace(/\.?0+e/, 'e');
    return String(rounded);
  }

  function apply(a, b, op) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      default: return b;
    }
  }

  KX.registerApp({
    id: 'calculator',
    title: 'Calculator',
    icon: 'calculator',
    width: 300,
    height: 420,
    minWidth: 260,
    minHeight: 360,
    desktop: true,
    order: 30,

    launch(win) {
      let current = '0'; // number being typed / shown
      let previous = null; // left operand once an operator is chosen
      let op = null;
      let fresh = true; // next digit starts a new number
      let overwrite = false; // next digit replaces the shown value (after %)
      let error = null; // error message, if any
      let expression = '';

      const exprEl = el('div', { class: 'kx-calc-expr' });
      const displayEl = el('div', { class: 'kx-calc-display', 'aria-live': 'polite' });

      function render() {
        exprEl.textContent = expression;
        displayEl.textContent = error || current;
      }

      function reset() {
        current = '0';
        previous = null;
        op = null;
        fresh = true;
        overwrite = false;
        error = null;
        expression = '';
      }

      function fail(message) {
        reset();
        error = message;
      }

      function digit(d) {
        if (error) reset();
        if (fresh || overwrite) {
          current = d;
          fresh = false;
          overwrite = false;
        } else if (current.replace(/[-.]/g, '').length < 15) {
          current = current === '0' ? d : current + d;
        }
      }

      function dot() {
        if (error) reset();
        if (fresh || overwrite) {
          current = '0.';
          fresh = false;
          overwrite = false;
        } else if (!current.includes('.')) {
          current += '.';
        }
      }

      function operator(next) {
        if (error) return;
        const value = parseFloat(current);
        if (op && !fresh) {
          const result = apply(previous, value, op);
          if (!isFinite(result)) return fail('Cannot divide by zero');
          previous = Number(result.toPrecision(12));
          current = format(previous);
        } else if (!op) {
          previous = value;
        }
        op = next;
        fresh = true;
        overwrite = false;
        expression = format(previous) + ' ' + SYMBOL[next];
      }

      function equals() {
        if (error || !op) return;
        const value = parseFloat(current);
        const result = apply(previous, value, op);
        const shown = format(previous) + ' ' + SYMBOL[op] + ' ' + format(value) + ' =';
        if (!isFinite(result)) return fail('Cannot divide by zero');
        current = format(result);
        expression = shown;
        previous = null;
        op = null;
        fresh = true;
        overwrite = false;
      }

      function negate() {
        if (error || current === '0') return;
        current = current.startsWith('-') ? current.slice(1) : '-' + current;
      }

      function percent() {
        if (error) return;
        const value = parseFloat(current);
        current = format(op ? (previous * value) / 100 : value / 100);
        fresh = false;
        overwrite = true;
      }

      function backspace() {
        if (error) return reset();
        if (fresh || overwrite) return;
        current = current.slice(0, -1);
        if (current === '' || current === '-') current = '0';
      }

      const ACTIONS = {
        C: reset,
        '⌫': backspace,
        '%': percent,
        '±': negate,
        '.': dot,
        '=': equals,
      };

      function press(key) {
        if (/^[0-9]$/.test(key)) digit(key);
        else if (SYMBOL[key]) operator(key);
        else if (ACTIONS[key]) ACTIONS[key]();
        render();
      }

      /* ----- keys ----- */

      const layout = [
        ['C', 'fn'], ['⌫', 'fn'], ['%', 'fn'], ['/', 'op'],
        ['7'], ['8'], ['9'], ['*', 'op'],
        ['4'], ['5'], ['6'], ['-', 'op'],
        ['1'], ['2'], ['3'], ['+', 'op'],
        ['±', 'fn'], ['0'], ['.'], ['=', 'eq'],
      ];
      const keys = el('div', { class: 'kx-calc-keys' });
      layout.forEach(([key, kind]) => {
        keys.appendChild(
          el('button', {
            class: 'kx-calc-key' + (kind ? ' ' + kind : ''),
            type: 'button',
            text: SYMBOL[key] || key,
            'aria-label': { '/': 'divide', '*': 'multiply', '-': 'minus', '+': 'plus', '=': 'equals', C: 'clear', '⌫': 'backspace', '%': 'percent', '±': 'plus or minus', '.': 'decimal point' }[key] || key,
            onclick: () => press(key),
          })
        );
      });

      const root = el('div', { class: 'kx-calc', tabindex: '0', 'data-autofocus': '' }, el('div', { class: 'kx-calc-screen' }, exprEl, displayEl), keys);

      // Keyboard works while the calculator has focus (but not when a button is focused and Enter/Space is used).
      root.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        let key = null;
        if (/^[0-9]$/.test(e.key)) key = e.key;
        else if (e.key === '.' || e.key === ',') key = '.';
        else if ('+-*/'.includes(e.key) && e.key.length === 1) key = e.key;
        else if (e.key === 'x' || e.key === 'X') key = '*';
        else if (e.key === '%') key = '%';
        else if (e.key === 'Enter' && e.target === root) key = '=';
        else if (e.key === '=') key = '=';
        else if (e.key === 'Backspace') key = '⌫';
        else if (e.key === 'Escape' || e.key === 'Delete') key = 'C';
        if (!key) return;
        e.preventDefault();
        press(key);
      });

      win.body.appendChild(root);
      render();
    },
  });
})();
