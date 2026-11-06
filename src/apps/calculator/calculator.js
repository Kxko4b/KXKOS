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
  function evaluate(source, vars, customFns = {}) {
    const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-zA-Z_][a-zA-Z_0-9]*|[()+\-*/^%,]/gi) || [];
    const compact = source.replace(/\s+/g, '');
    if (tokens.join('').toLowerCase() !== compact.toLowerCase()) throw new Error('Ungültiges Zeichen oder ungültiger Ausdruck');
    // Implizite Multiplikation: 2x, 3(x+1), (a+b)(c+d).
    const expanded = [];
    for (let j = 0; j < tokens.length; j++) {
      const prev = expanded[expanded.length - 1], cur = tokens[j];
      const prevEndsValue = prev && (/^(?:\d|\.)/.test(prev) || /^[a-z]/i.test(prev) || prev === ')');
      const curStartsValue = cur && (/^(?:\d|\.)/.test(cur) || /^[a-z]/i.test(cur) || cur === '(');
      const isKnownFunctionCall = /^[a-z]/i.test(prev || '') && cur === '(' && (FUNCTIONS[(prev || '').toLowerCase()] || customFns[(prev || '').toLowerCase()]);
      if (prevEndsValue && curStartsValue && !isKnownFunctionCall) expanded.push('*');
      expanded.push(cur);
    }
    tokens.splice(0, tokens.length, ...expanded);
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
        if (peek() === '(' && (FUNCTIONS[name] || customFns[name])) {
          take();
          const arg = sum();
          if (take() !== ')') throw new Error('Missing closing bracket');
          if (FUNCTIONS[name]) return FUNCTIONS[name](arg);\n          const fn = customFns[name];\n          return evaluate(fn.expression.replace(new RegExp('\\\\b' + fn.parameter + '\\\\b', 'g'), '(' + arg + ')'), vars, customFns);
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
    id: 'calculator', title: 'Taschenrechner', icon: 'calculator',
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
      const expr = el('input', { class: 'kx-calc-input', type: 'text', placeholder: 'Ausdruck eingeben, z. B. 2x + 3 oder (a+b)²', 'aria-label': 'Ausdruck' });
      const result = el('div', { class: 'kx-calc-result', 'aria-live': 'polite', text: '0' });
      const message = el('div', { class: 'kx-calc-message', text: 'Zum Beispiel: 2x + 3, x^2 oder sqrt(25)' });
      const screen = el('div', { class: 'kx-calc-pro-screen' }, el('div', { class: 'kx-calc-screen-label', text: 'RECHNUNG' }), expr, result, message);
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
          message.textContent = 'Berechnung erfolgreich';
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
        historyBox.replaceChildren(el('h3', { text: 'Verlauf' }));
        if (!history.length) historyBox.appendChild(el('p', { class: 'kx-calc-muted', text: 'Deine Rechnungen erscheinen hier.' }));
        history.forEach(item => {
          const b = button(item.expression + ' = ' + item.result, () => { expr.value = item.expression; calculate(); }, 'kx-calc-history-item');
          historyBox.appendChild(b);
        });
        historyBox.appendChild(button('Verlauf löschen', () => { history = []; renderHistory(); }, 'kx-calc-small'));
      }
      function renderVars() {
        varsBox.replaceChildren(el('h3', { text: 'Variablen' }));
        const form = el('div', { class: 'kx-calc-var-form' });
        const name = el('input', { class: 'kx-calc-input-small', placeholder: 'Name (z. B. a)', 'aria-label': 'Variablenname' });
        const value = el('input', { class: 'kx-calc-input-small', placeholder: 'Wert oder Ausdruck', 'aria-label': 'Variablenwert' });
        form.append(name, value, button('Speichern', () => {
          const key = name.value.trim().toLowerCase();
          if (!/^[a-z][a-z0-9_]*$/.test(key) || ['pi','e'].includes(key) || FUNCTIONS[key]) {
            message.textContent = 'Nutze einen Namen wie a, b oder hoehe.';
            message.classList.add('is-error'); return;
          }
          try {
            vars[key] = evaluate(value.value, vars);
            name.value = ''; value.value = ''; renderVars();
            message.textContent = 'Variable gespeichert'; message.classList.remove('is-error');
          } catch (e) { message.textContent = e.message; message.classList.add('is-error'); }
        }, 'kx-calc-small'));
        varsBox.appendChild(form);
        const keys = Object.keys(vars);
        if (!keys.length) varsBox.appendChild(el('p', { class: 'kx-calc-muted', text: 'Noch keine Variablen. Lege z. B. a = 5 und b = 12 an.' }));
        keys.forEach(key => {
          const row = el('div', { class: 'kx-calc-var-row' },
            el('button', { type: 'button', class: 'kx-calc-var-insert', text: key + ' = ' + format(vars[key]), onclick: () => insert(key) }),
            button('×', () => { delete vars[key]; renderVars(); }, 'kx-calc-small'));
          varsBox.appendChild(row);
        });
      }
      function pythagoras() {
        toolsBox.replaceChildren(el('h3', { text: 'Satz des Pythagoras · a² + b² = c²' }),
          el('p', { class: 'kx-calc-muted', text: 'Gib zwei Seiten ein. Die gesuchte Seite bleibt leer.' }));
        const fields = {};
        ['a','b','c'].forEach(k => {
          const label = el('label', { class: 'kx-calc-field-label', text: k + (k === 'c' ? ' · hypotenuse' : '') });
          const input = el('input', { class: 'kx-calc-input-small', type: 'number', min: '0', step: 'any', placeholder: k + ' (frei lassen, wenn gesucht)' });
          fields[k] = input; label.appendChild(input); toolsBox.appendChild(label);
        });
        const out = el('div', { class: 'kx-calc-pyth-result', text: 'Gib zwei bekannte Seiten ein.' });
        toolsBox.append(button('Fehlende Seite berechnen', () => {
          const vals = Object.fromEntries(['a','b','c'].map(k => [k, fields[k].value.trim() === '' ? null : Number(fields[k].value)]));
          const known = Object.keys(vals).filter(k => vals[k] !== null);
          if (known.length !== 2 || known.some(k => !Number.isFinite(vals[k]) || vals[k] <= 0)) {
            out.textContent = 'Gib genau zwei positive Seitenlängen ein.'; return;
          }
          let missing, n;
          if (vals.c === null) { missing = 'c'; n = Math.hypot(vals.a, vals.b); }
          else if (vals.a === null) { missing = 'a'; n = Math.sqrt(vals.c ** 2 - vals.b ** 2); }
          else { missing = 'b'; n = Math.sqrt(vals.c ** 2 - vals.a ** 2); }
          if (!Number.isFinite(n) || n <= 0) { out.textContent = 'Ungültiges Dreieck: c muss die längste Seite sein.'; return; }
          fields[missing].value = format(n);
          out.textContent = missing + ' = ' + format(n);
          expr.value = missing === 'c' ? 'sqrt(a^2 + b^2)' : 'sqrt(c^2 - ' + (missing === 'a' ? 'b' : 'a') + '^2)';
          vars.a = vals.a ?? (missing === 'a' ? n : vals.a);
          vars.b = vals.b ?? (missing === 'b' ? n : vals.b);
          vars.c = vals.c ?? (missing === 'c' ? n : vals.c);
          renderVars();
          result.textContent = format(n);
          message.textContent = 'Pythagoras-Berechnung abgeschlossen'; message.classList.remove('is-error');
        }, 'kx-calc-wide'));
      }
      const customFns = Object.create(null);\n      function equations() {
        toolsBox.replaceChildren(
          el('h3', { text: 'Funktionen & Gleichungen' }),
          el('p', { class: 'kx-calc-muted', text: 'Funktion definieren, z. B. f(x) = 2x + 3. Danach f(4) im Rechner eingeben.' })
        );
        const definition = el('input', { class: 'kx-calc-input-small', placeholder: 'f(x) = 2x + 3', 'aria-label': 'Funktionsdefinition' });
        const save = button('Funktion speichern', () => {
          const m = definition.value.match(/^([a-z][a-z0-9_]*)\s*\(\s*([a-z])\s*\)\s*=\s*(.+)$/i);
          if (!m) { message.textContent = 'Format: f(x) = 2x + 3'; message.classList.add('is-error'); return; }
          try {
            evaluate(m[3].replace(new RegExp('\\b' + m[2] + '\\b', 'g'), '2'), vars, customFns);
            customFns[m[1].toLowerCase()] = { parameter: m[2], expression: m[3] };
            message.textContent = 'Funktion ' + m[1] + '(' + m[2] + ') gespeichert'; message.classList.remove('is-error');
            renderFunctions();
          } catch (e) { message.textContent = e.message; message.classList.add('is-error'); }
        }, 'kx-calc-wide');
        toolsBox.append(definition, save);
        const equation = el('input', { class: 'kx-calc-input-small', placeholder: 'Gleichung, z. B. 2x + 3 = 11', 'aria-label': 'Gleichung' });
        const solve = button('Nach x auflösen', () => {
          const parts = equation.value.split('=');
          if (parts.length !== 2) { out.textContent = 'Bitte eine Gleichung mit genau einem = eingeben.'; return; }
          try {
            const diff = x => evaluate(parts[0], { ...vars, x }, customFns) - evaluate(parts[1], { ...vars, x }, customFns);
            const y0 = diff(0), y1 = diff(1), y2 = diff(2), slope = y1 - y0;
            if (Math.abs((y2 - y1) - slope) > 1e-8) { out.textContent = 'Diese Gleichung ist nicht linear. Aktuell kann ich lineare Gleichungen lösen.'; return; }
            if (Math.abs(slope) < 1e-10) { out.textContent = Math.abs(y0) < 1e-10 ? 'Unendlich viele Lösungen.' : 'Keine Lösung.'; return; }
            const x = -y0 / slope;
            vars.x = x;
            out.textContent = 'Lösung: x = ' + format(x);
            result.textContent = format(x);
            message.textContent = 'Gleichung gelöst'; message.classList.remove('is-error');
            renderVars();
          } catch (e) { out.textContent = e.message; }
        }, 'kx-calc-wide');
        const out = el('div', { class: 'kx-calc-pyth-result', text: 'Beispiel: 2x + 3 = 11  →  x = 4' });
        toolsBox.append(el('h3', { text: 'Gleichung lösen' }), equation, solve, out);
        const functionsBox = el('div', { class: 'kx-calc-function-list' });
        toolsBox.appendChild(functionsBox);
        function renderFunctions() {
          functionsBox.replaceChildren(el('h3', { text: 'Gespeicherte Funktionen' }));
          Object.entries(customFns).forEach(([name, fn]) => functionsBox.appendChild(el('p', { text: name + '(' + fn.parameter + ') = ' + fn.expression })));
        }
        renderFunctions();
      }
      function setMode(next) {
        mode = next;
        tabs.querySelectorAll('button').forEach(b => b.classList.toggle('kx-active', b.dataset.mode === mode));
        buttons.hidden = mode === 'pythagoras' || mode === 'equations';
        toolsBox.hidden = mode !== 'pythagoras' && mode !== 'equations';
        if (mode === 'pythagoras') pythagoras();
        if (mode === 'equations') equations();
      }
      [['Rechner','standard'],['Wissenschaftlich','scientific'],['Gleichungen','equations'],['Pythagoras','pythagoras']].forEach(([label, key]) => {
        const b = button(label, () => setMode(key), 'kx-calc-tab');
        b.dataset.mode = key; tabs.appendChild(b);
      });
      const keys = ['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','(',')','^','sqrt(','pi','⌫','+','−','*','/','%','abs(','sin(','cos(','tan(','log(','ln(','exp('];
      keys.forEach(k => buttons.appendChild(button(k, () => {
        if (k === '⌫') expr.value = expr.value.slice(0, -1);
        else insert(({ '÷':'/','×':'*','−':'-' })[k] || k);
      }, ['÷','×','−','+','^','⌫'].includes(k) ? 'op' : '')));
      const calcActions = el('div', { class: 'kx-calc-actions' },
        button('Berechnen  =', calculate, 'eq'),
        button('Leeren', () => { expr.value = ''; result.textContent = '0'; message.textContent = ''; }, 'kx-calc-small'));
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
      expr.value = '';
      result.textContent = '0';
    }
  });
})();
