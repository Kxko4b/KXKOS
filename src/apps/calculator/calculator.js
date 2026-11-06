/*
 * KXKOS Scientific Calculator
 * Arithmetic, variables, powers, roots, scientific functions and Pythagoras.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el } = KX;
  const SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
  const FUNCTIONS = {
    sqrt: Math.sqrt, abs: Math.abs, sin: x => Math.sin(x * Math.PI / 180),
    cos: x => Math.cos(x * Math.PI / 180), tan: x => Math.tan(x * Math.PI / 180),
    log: Math.log10, ln: Math.log, exp: Math.exp
  };

  function format(n) {
    if (!Number.isFinite(n)) throw new Error('Result is not a real number');
    const v = Number(n.toPrecision(12));
    if (Math.abs(v) >= 1e15 || (v !== 0 && Math.abs(v) < 1e-9)) return v.toExponential(6);
    return String(v);
  }

  // Recursive-descent parser: never evaluates user input as JavaScript.
  function evaluate(source, vars) {
    const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-zA-Z_][a-zA-Z_0-9]*|[()+\-*/^%,]/gi) || [];
    const compact = source.replace(/\s+/g, '');
    if (tokens.join('').toLowerCase() !== compact.toLowerCase()) throw new Error('Invalid character or expression');
    let i = 0;
    const peek = () => tokens[i];
    const take = () => tokens[i++];
    function primary() {
      const t = take();
      if (t === undefined) throw new Error('Incomplete expression');
      if (t === '+') return unary();
      if (t === '-') return -unary();
      if (t === '(') {
        const v = sum();
        if (take() !== ')') throw new Error('Missing closing bracket');
        return v;
      }
      if (/^(?:\d|\.)/.test(t)) return Number(t);
      if (/^[a-z]/i.test(t)) {
        const name = t.toLowerCase();
        if (peek() === '(' && FUNCTIONS[name]) {
          take();
          const arg = sum();
          if (take() !== ')') throw new Error('Missing closing bracket');
          return FUNCTIONS[name](arg);
        }
        if (name === 'pi') return Math.PI;
        if (name === 'e') return Math.E;
        if (Object.prototype.hasOwnProperty.call(vars, name)) return vars[name];
        throw new Error('Unknown variable: ' + t);
      }
      throw new Error('Unexpected token: ' + t);
    }
    function power() {
      let v = primary();
      if (peek() === '^') { take(); v = Math.pow(v, unary()); }
      return v;
    }
    function unary() { return power(); }
    function product() {
      let v = unary();
      while (['*', '/', '%'].includes(peek())) {
        const op = take(), b = unary();
        if ((op === '/' || op === '%') && b === 0) throw new Error('Cannot divide by zero');
        v = op === '*' ? v * b : op === '/' ? v / b : v % b;
      }
      return v;
    }
    function sum() {
      let v = product();
      while (peek() === '+' || peek() === '-') {
        const op = take(), b = product();
        v = op === '+' ? v + b : v - b;
      }
      return v;
    }
    const result = sum();
    if (i !== tokens.length) throw new Error('Unexpected token: ' + peek());
    if (!Number.isFinite(result)) throw new Error('Result is not a real number');
    return result;
  }

  KX.registerApp({
    id: 'calculator', title: 'Calculator', icon: 'calculator',
    width: 590, height: 650, minWidth: 340, minHeight: 460, desktop: true, order: 30,
    launch(win) {
      const vars = Object.create(null);
      let history = [];
      let mode = 'standard';
      const root = el('div', { class: 'kx-calc kx-calc-pro', tabindex: '0', 'data-autofocus': '' });
      const tabs = el('div', { class: 'kx-calc-tabs' });
      const workspace = el('div', { class: 'kx-calc-workspace' });
      const main = el('div', { class: 'kx-calc-main' });
      const side = el('div', { class: 'kx-calc-side' });
      const expr = el('input', { class: 'kx-calc-input', type: 'text', placeholder: 'Enter an expression, e.g. (a + b)^2', 'aria-label': 'Expression' });
      const result = el('div', { class: 'kx-calc-result', 'aria-live': 'polite', text: '0' });
      const message = el('div', { class: 'kx-calc-message', text: 'Use variables, brackets, powers and functions.' });
      const screen = el('div', { class: 'kx-calc-pro-screen' }, el('div', { class: 'kx-calc-screen-label', text: 'EXPRESSION' }), expr, result, message);
      const buttons = el('div', { class: 'kx-calc-pro-keys' });
      const historyBox = el('div', { class: 'kx-calc-panel' });
      const varsBox = el('div', { class: 'kx-calc-panel' });
      const toolsBox = el('div', { class: 'kx-calc-panel' });

      function button(label, fn, cls) {
        const b = el('button', { type: 'button', class: 'kx-calc-key ' + (cls || ''), text: label });
        b.addEventListener('click', fn);
        return b;
      }
      function insert(s) {
        const start = expr.selectionStart ?? expr.value.length;
        const end = expr.selectionEnd ?? start;
        expr.value = expr.value.slice(0, start) + s + expr.value.slice(end);
        expr.focus(); expr.setSelectionRange(start + s.length, start + s.length);
      }
      function calculate() {
        try {
          const n = evaluate(expr.value, vars);
          result.textContent = format(n);
          message.textContent = 'Calculated successfully';
          message.classList.remove('is-error');
          history.unshift({ expression: expr.value, result: format(n) });
          history = history.slice(0, 30);
          renderHistory();
        } catch (e) {
          result.textContent = '—';
          message.textContent = e.message;
          message.classList.add('is-error');
        }
      }
      function renderHistory() {
        historyBox.replaceChildren(el('h3', { text: 'History' }));
        if (!history.length) historyBox.appendChild(el('p', { class: 'kx-calc-muted', text: 'Your calculations will appear here.' }));
        history.forEach(item => {
          const b = button(item.expression + ' = ' + item.result, () => { expr.value = item.expression; calculate(); }, 'kx-calc-history-item');
          historyBox.appendChild(b);
        });
        historyBox.appendChild(button('Clear history', () => { history = []; renderHistory(); }, 'kx-calc-small'));
      }
      function renderVars() {
        varsBox.replaceChildren(el('h3', { text: 'Variables' }));
        const form = el('div', { class: 'kx-calc-var-form' });
        const name = el('input', { class: 'kx-calc-input-small', placeholder: 'Name (e.g. a)', 'aria-label': 'Variable name' });
        const value = el('input', { class: 'kx-calc-input-small', placeholder: 'Value / expression', 'aria-label': 'Variable value' });
        form.append(name, value, button('Set', () => {
          const key = name.value.trim().toLowerCase();
          if (!/^[a-z][a-z0-9_]*$/.test(key) || ['pi','e'].includes(key) || FUNCTIONS[key]) {
            message.textContent = 'Use a variable name like a, b or height.';
            message.classList.add('is-error'); return;
          }
          try {
            vars[key] = evaluate(value.value, vars);
            name.value = ''; value.value = ''; renderVars();
            message.textContent = 'Variable saved'; message.classList.remove('is-error');
          } catch (e) { message.textContent = e.message; message.classList.add('is-error'); }
        }, 'kx-calc-small'));
        varsBox.appendChild(form);
        const keys = Object.keys(vars);
        if (!keys.length) varsBox.appendChild(el('p', { class: 'kx-calc-muted', text: 'No variables yet. Set a = 5, b = 12, etc.' }));
        keys.forEach(key => {
          const row = el('div', { class: 'kx-calc-var-row' },
            el('button', { type: 'button', class: 'kx-calc-var-insert', text: key + ' = ' + format(vars[key]), onclick: () => insert(key) }),
            button('×', () => { delete vars[key]; renderVars(); }, 'kx-calc-small'));
          varsBox.appendChild(row);
        });
      }
      function pythagoras() {
        toolsBox.replaceChildren(el('h3', { text: 'Pythagoras · a² + b² = c²' }),
          el('p', { class: 'kx-calc-muted', text: 'Enter any two sides. Leave the side you want to calculate empty.' }));
        const fields = {};
        ['a','b','c'].forEach(k => {
          const label = el('label', { class: 'kx-calc-field-label', text: k + (k === 'c' ? ' · hypotenuse' : '') });
          const input = el('input', { class: 'kx-calc-input-small', type: 'number', min: '0', step: 'any', placeholder: k + ' (optional)' });
          fields[k] = input; label.appendChild(input); toolsBox.appendChild(label);
        });
        const out = el('div', { class: 'kx-calc-pyth-result', text: 'Enter two known sides.' });
        toolsBox.append(button('Calculate missing side', () => {
          const vals = Object.fromEntries(['a','b','c'].map(k => [k, fields[k].value.trim() === '' ? null : Number(fields[k].value)]));
          const known = Object.keys(vals).filter(k => vals[k] !== null);
          if (known.length !== 2 || known.some(k => !Number.isFinite(vals[k]) || vals[k] <= 0)) {
            out.textContent = 'Enter exactly two positive side lengths.'; return;
          }
          let missing, n;
          if (vals.c === null) { missing = 'c'; n = Math.hypot(vals.a, vals.b); }
          else if (vals.a === null) { missing = 'a'; n = Math.sqrt(vals.c ** 2 - vals.b ** 2); }
          else { missing = 'b'; n = Math.sqrt(vals.c ** 2 - vals.a ** 2); }
          if (!Number.isFinite(n) || n <= 0) { out.textContent = 'Invalid triangle: the hypotenuse must be the longest side.'; return; }
          fields[missing].value = format(n);
          out.textContent = missing + ' = ' + format(n);
          expr.value = missing === 'c' ? 'sqrt(a^2 + b^2)' : 'sqrt(c^2 - ' + (missing === 'a' ? 'b' : 'a') + '^2)';
          vars.a = vals.a ?? (missing === 'a' ? n : vals.a);
          vars.b = vals.b ?? (missing === 'b' ? n : vals.b);
          vars.c = vals.c ?? (missing === 'c' ? n : vals.c);
          renderVars();
          result.textContent = format(n);
          message.textContent = 'Pythagoras calculation complete'; message.classList.remove('is-error');
        }, 'kx-calc-wide'));
      }
      function setMode(next) {
        mode = next;
        tabs.querySelectorAll('button').forEach(b => b.classList.toggle('kx-active', b.dataset.mode === mode));
        buttons.hidden = mode === 'pythagoras';
        toolsBox.hidden = mode !== 'pythagoras';
        if (mode === 'pythagoras') pythagoras();
      }
      [['Standard','standard'],['Scientific','scientific'],['Pythagoras','pythagoras']].forEach(([label, key]) => {
        const b = button(label, () => setMode(key), 'kx-calc-tab');
        b.dataset.mode = key; tabs.appendChild(b);
      });
      const keys = ['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','(',')','^','sqrt(','pi','⌫','+','−','*','/','%','abs(','sin(','cos(','tan(','log(','ln(','exp('];
      keys.forEach(k => buttons.appendChild(button(k, () => {
        if (k === '⌫') expr.value = expr.value.slice(0, -1);
        else insert(({ '÷':'/','×':'*','−':'-' })[k] || k);
      }, ['÷','×','−','+','^','⌫'].includes(k) ? 'op' : '')));
      const calcActions = el('div', { class: 'kx-calc-actions' },
        button('Calculate  =', calculate, 'eq'),
        button('Clear', () => { expr.value = ''; result.textContent = '0'; message.textContent = ''; }, 'kx-calc-small'));
      main.append(screen, calcActions, buttons);
      side.append(varsBox, toolsBox, historyBox);
      workspace.append(main, side);
      root.append(tabs, workspace);
      win.body.appendChild(root);
      expr.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); calculate(); } });
      root.addEventListener('keydown', e => {
        if (e.target === expr || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'Enter') { e.preventDefault(); calculate(); }
      });
      renderVars(); renderHistory(); setMode('standard');
      expr.value = 'sqrt(3^2 + 4^2)';
      calculate();
    }
  });
})();
