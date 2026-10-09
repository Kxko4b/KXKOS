(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const COLORS = ['#1b2a49', '#e5484d', '#f5a524', '#f7d84a', '#46a758', '#2f6fdf', '#8e4ec6', '#ffffff'];
  const W = 1200, H = 800, HOLD_MS = 550, MAX_UNDO = 25;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // Cubic bezier through the first/last point passing near 1/3 and 2/3 of the stroke's length.
  function fitStroke(pts) {
    const p0 = pts[0], p3 = pts[pts.length - 1];
    const chord = dist(p0, p3);
    let maxDev = 0;
    for (const p of pts) {
      const dev = Math.abs((p3.x - p0.x) * (p0.y - p.y) - (p0.x - p.x) * (p3.y - p0.y)) / (chord || 1);
      if (dev > maxDev) maxDev = dev;
    }
    if (chord < 1 || maxDev / chord < 0.05) return { type: 'line', pts: [p0, p3] };
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i], pts[i - 1]));
    const at = (f) => {
      const target = cum[cum.length - 1] * f;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < target) i++;
      const seg = cum[i] - cum[i - 1] || 1, t = (target - cum[i - 1]) / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    };
    const A = at(1 / 3), B = at(2 / 3);
    const a = { x: A.x - (8 * p0.x + p3.x) / 27, y: A.y - (8 * p0.y + p3.y) / 27 };
    const b = { x: B.x - (p0.x + 8 * p3.x) / 27, y: B.y - (p0.y + 8 * p3.y) / 27 };
    const c1 = { x: 3 * a.x - 1.5 * b.x, y: 3 * a.y - 1.5 * b.y };
    const c2 = { x: (27 * b.x - 6 * c1.x) / 12, y: (27 * b.y - 6 * c1.y) / 12 };
    return { type: 'curve', pts: [p0, c1, c2, p3] };
  }

  KX.registerApp({
    id: 'paint', title: 'Paint', icon: 'paint', width: 760, height: 560, minWidth: 460, minHeight: 360,
    desktop: true, order: 70,
    launch(win) {
      let color = COLORS[0], size = 4, tool = 'brush';
      const base = el('canvas', { class: 'kx-paint-layer' });
      const over = el('canvas', { class: 'kx-paint-layer kx-paint-over' });
      base.width = over.width = W; base.height = over.height = H;
      const bx = base.getContext('2d', { willReadFrequently: true });
      const ox = over.getContext('2d');
      const stack = el('div', { class: 'kx-paint-stack' }, base, over);
      const wrap = el('div', { class: 'kx-paint-wrap' }, stack);

      let undo = [];
      const pushUndo = () => { undo.push(bx.getImageData(0, 0, W, H)); if (undo.length > MAX_UNDO) undo.shift(); };
      const clearBase = () => { bx.fillStyle = '#ffffff'; bx.fillRect(0, 0, W, H); };
      clearBase();

      // live objects (not yet burned into the bitmap)
      let shape = null;        // {type, pts, color, size}
      let floating = null;     // {canvas, x, y}
      let ruler = null;        // {x, y, angle, len}
      let lassoPath = null;
      let drag = null;         // current pointer interaction
      let holdTimer = null;

      const scale = () => W / base.getBoundingClientRect().width;
      const pos = (e) => {
        const r = base.getBoundingClientRect();
        return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
      };

      function strokeShape(ctx, s) {
        ctx.strokeStyle = s.color; ctx.lineWidth = s.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(s.pts[0].x, s.pts[0].y);
        if (s.type === 'line') ctx.lineTo(s.pts[1].x, s.pts[1].y);
        else ctx.bezierCurveTo(s.pts[1].x, s.pts[1].y, s.pts[2].x, s.pts[2].y, s.pts[3].x, s.pts[3].y);
        ctx.stroke();
      }
      function commitShape() {
        if (!shape) return;
        pushUndo(); strokeShape(bx, shape); shape = null; redraw();
      }
      function commitFloating() {
        if (!floating) return;
        pushUndo(); bx.drawImage(floating.canvas, floating.x, floating.y); floating = null; redraw();
      }
      const commitAll = () => { commitShape(); commitFloating(); };

      const handleR = () => 9 * scale();
      function rulerEnds() {
        const dx = Math.cos(ruler.angle) * ruler.len / 2, dy = Math.sin(ruler.angle) * ruler.len / 2;
        return [{ x: ruler.x - dx, y: ruler.y - dy }, { x: ruler.x + dx, y: ruler.y + dy }];
      }

      function redraw() {
        ox.clearRect(0, 0, W, H);
        const k = scale();
        if (floating) {
          ox.drawImage(floating.canvas, floating.x, floating.y);
          ox.save(); ox.setLineDash([6 * k, 4 * k]); ox.lineWidth = k; ox.strokeStyle = '#1b2a49';
          ox.strokeRect(floating.x, floating.y, floating.canvas.width, floating.canvas.height); ox.restore();
        }
        if (shape) {
          strokeShape(ox, shape);
          ox.save(); ox.lineWidth = k; ox.strokeStyle = '#2f6fdf'; ox.setLineDash([4 * k, 4 * k]);
          if (shape.type === 'curve') {
            ox.beginPath(); ox.moveTo(shape.pts[0].x, shape.pts[0].y); ox.lineTo(shape.pts[1].x, shape.pts[1].y);
            ox.moveTo(shape.pts[3].x, shape.pts[3].y); ox.lineTo(shape.pts[2].x, shape.pts[2].y); ox.stroke();
          }
          ox.restore();
          shape.pts.forEach((p, i) => {
            const end = shape.type === 'line' || i === 0 || i === 3;
            ox.beginPath();
            if (end) ox.arc(p.x, p.y, handleR(), 0, Math.PI * 2); else ox.rect(p.x - handleR() * 0.8, p.y - handleR() * 0.8, handleR() * 1.6, handleR() * 1.6);
            ox.fillStyle = end ? '#2f6fdf' : '#ffffff'; ox.fill();
            ox.lineWidth = 2 * k; ox.strokeStyle = '#1b2a49'; ox.stroke();
          });
        }
        if (lassoPath && lassoPath.length > 1) {
          ox.save(); ox.setLineDash([6 * k, 4 * k]); ox.lineWidth = 1.5 * k; ox.strokeStyle = '#1b2a49';
          ox.beginPath(); ox.moveTo(lassoPath[0].x, lassoPath[0].y); lassoPath.forEach((p) => ox.lineTo(p.x, p.y)); ox.stroke(); ox.restore();
        }
        if (ruler) {
          const [a, b] = rulerEnds();
          ox.save(); ox.translate(ruler.x, ruler.y); ox.rotate(ruler.angle);
          const hh = 14 * k;
          ox.fillStyle = 'rgba(247,216,74,.55)'; ox.strokeStyle = '#1b2a49'; ox.lineWidth = k * 1.5;
          ox.fillRect(-ruler.len / 2, -hh, ruler.len, hh * 2); ox.strokeRect(-ruler.len / 2, -hh, ruler.len, hh * 2);
          ox.beginPath();
          for (let d = -ruler.len / 2, i = 0; d <= ruler.len / 2; d += 10 * k, i++) {
            ox.moveTo(d, -hh); ox.lineTo(d, -hh + (i % 5 === 0 ? 10 : 5) * k);
          }
          ox.stroke(); ox.restore();
          ox.beginPath(); ox.arc(b.x, b.y, handleR(), 0, Math.PI * 2); ox.fillStyle = '#e5484d'; ox.fill();
          ox.lineWidth = 2 * k; ox.strokeStyle = '#1b2a49'; ox.stroke();
          void a;
        }
      }

      function nearRuler(p) {
        if (!ruler) return false;
        const dx = Math.cos(ruler.angle), dy = Math.sin(ruler.angle);
        const rx = p.x - ruler.x, ry = p.y - ruler.y;
        const along = rx * dx + ry * dy, perp = -rx * dy + ry * dx;
        return Math.abs(along) <= ruler.len / 2 && Math.abs(perp) <= 14 * scale() + 14 * scale();
      }
      function projectRuler(p) {
        const dx = Math.cos(ruler.angle), dy = Math.sin(ruler.angle);
        const along = (p.x - ruler.x) * dx + (p.y - ruler.y) * dy;
        const perp0 = drag.perpSide;
        return { x: ruler.x + dx * along + (-dy) * perp0, y: ruler.y + dy * along + dx * perp0 };
      }

      function brushSeg(a, b, erase) {
        bx.strokeStyle = erase ? '#ffffff' : color; bx.lineWidth = erase ? size * 3 : size;
        bx.lineCap = 'round'; bx.lineJoin = 'round';
        bx.beginPath(); bx.moveTo(a.x, a.y); bx.lineTo(b.x, b.y); bx.stroke();
      }

      function startText(p) {
        const px = Math.max(10, size * 4 + 10);
        const r = base.getBoundingClientRect(), wr = stack.getBoundingClientRect();
        const input = el('input', { type: 'text', class: 'kx-paint-text', placeholder: 'Type, Enter to place' });
        input.style.left = (r.left - wr.left + p.x / scale()) + 'px';
        input.style.top = (r.top - wr.top + p.y / scale() - px / scale() / 2) + 'px';
        input.style.font = 'bold ' + (px / scale()) + 'px sans-serif';
        input.style.color = color;
        let done = false;
        const finish = (ok) => {
          if (done) return; done = true;
          const t = input.value;
          input.remove();
          if (ok && t.trim()) {
            pushUndo(); bx.fillStyle = color; bx.font = 'bold ' + px + 'px sans-serif'; bx.textBaseline = 'middle'; bx.fillText(t, p.x, p.y);
          }
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); e.stopPropagation(); });
        input.addEventListener('blur', () => finish(true));
        stack.appendChild(input);
        setTimeout(() => input.focus(), 0);
      }

      over.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const p = pos(e);
        over.setPointerCapture(e.pointerId);
        const hr = handleR() * 1.4;

        // 1. handles of the live curve/line
        if (shape) {
          const i = shape.pts.findIndex((q) => dist(q, p) <= hr);
          if (i >= 0) { drag = { kind: 'handle', i }; return; }
          commitShape();
        }
        // 2. ruler rotate / move
        if (ruler) {
          const [, b] = rulerEnds();
          if (dist(b, p) <= hr) { drag = { kind: 'ruler-rot' }; return; }
          if (tool === 'ruler') { drag = { kind: 'ruler-move', dx: p.x - ruler.x, dy: p.y - ruler.y }; return; }
        }
        // 3. floating selection
        if (floating) {
          const inside = p.x >= floating.x && p.y >= floating.y && p.x <= floating.x + floating.canvas.width && p.y <= floating.y + floating.canvas.height;
          if (inside) { drag = { kind: 'float', dx: p.x - floating.x, dy: p.y - floating.y, moved: false }; return; }
          commitFloating();
        }

        if (tool === 'text') { startText(p); return; }
        if (tool === 'lasso') { lassoPath = [p]; drag = { kind: 'lasso' }; return; }
        if (tool === 'brush' || tool === 'eraser') {
          pushUndo();
          const erase = tool === 'eraser';
          drag = { kind: 'draw', erase, pts: [p], last: p, snapshot: undo[undo.length - 1] };
          if (!erase && nearRuler(p)) {
            const dx = Math.cos(ruler.angle), dy = Math.sin(ruler.angle);
            drag.perpSide = -(p.x - ruler.x) * dy + (p.y - ruler.y) * dx;
            drag.ruler = true;
          }
          brushSeg(p, p, erase);
        }
      });

      over.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const p = pos(e);
        if (drag.kind === 'handle') { shape.pts[drag.i] = p; redraw(); return; }
        if (drag.kind === 'ruler-rot') { ruler.angle = Math.atan2(p.y - ruler.y, p.x - ruler.x); redraw(); return; }
        if (drag.kind === 'ruler-move') { ruler.x = p.x - drag.dx; ruler.y = p.y - drag.dy; redraw(); return; }
        if (drag.kind === 'float') { floating.x = p.x - drag.dx; floating.y = p.y - drag.dy; drag.moved = true; redraw(); return; }
        if (drag.kind === 'lasso') { lassoPath.push(p); redraw(); return; }
        if (drag.kind === 'draw') {
          const q = drag.ruler ? projectRuler(p) : p;
          if (dist(q, drag.last) < 0.5) return;
          brushSeg(drag.last, q, drag.erase);
          drag.last = q; drag.pts.push(q);
          clearTimeout(holdTimer);
          if (!drag.erase && !drag.ruler) {
            holdTimer = setTimeout(() => snapStroke(), HOLD_MS);
          }
        }
      });

      function snapStroke() {
        if (!drag || drag.kind !== 'draw' || drag.pts.length < 6) return;
        if (dist(drag.pts[0], drag.pts[drag.pts.length - 1]) < 20 * scale()) return;
        bx.putImageData(drag.snapshot, 0, 0);
        undo.pop();
        shape = Object.assign(fitStroke(drag.pts), { color, size });
        const last = shape.pts.length - 1;
        drag = { kind: 'handle', i: last }; // keep dragging moves the far endpoint
        redraw();
      }

      const end = () => {
        clearTimeout(holdTimer);
        if (!drag) return;
        if (drag.kind === 'lasso') finishLasso();
        drag = null;
      };
      over.addEventListener('pointerup', end);
      over.addEventListener('pointercancel', end);

      function finishLasso() {
        const path = lassoPath; lassoPath = null;
        if (!path || path.length < 4) { redraw(); return; }
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        path.forEach((p) => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
        x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
        x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
        const w = x1 - x0, h = y1 - y0;
        if (w < 3 || h < 3) { redraw(); return; }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const cx = c.getContext('2d');
        cx.beginPath(); path.forEach((p, i) => (i ? cx.lineTo(p.x - x0, p.y - y0) : cx.moveTo(p.x - x0, p.y - y0))); cx.closePath();
        cx.save(); cx.clip(); cx.drawImage(base, -x0, -y0); cx.restore();
        pushUndo();
        bx.save(); bx.beginPath(); path.forEach((p, i) => (i ? bx.lineTo(p.x, p.y) : bx.moveTo(p.x, p.y))); bx.closePath();
        bx.fillStyle = '#ffffff'; bx.fill(); bx.restore();
        floating = { canvas: c, x: x0, y: y0 };
        redraw();
      }

      // ---- toolbar ----
      const btn = (t, fn, title) => el('button', { type: 'button', class: 'kx-btn', text: t, title: title || t, onclick: fn });
      const toolBtns = {};
      function setTool(t) {
        if (t !== 'ruler') { /* ruler stays visible when other tools are used */ }
        commitAll();
        tool = t;
        Object.keys(toolBtns).forEach((k) => toolBtns[k].classList.toggle('kx-paint-active', k === t));
        over.style.cursor = t === 'text' ? 'text' : 'crosshair';
      }
      const addTool = (id, label, title) => { toolBtns[id] = btn(label, () => setTool(id), title); return toolBtns[id]; };

      const sw = COLORS.map((c) => el('button', { type: 'button', class: 'kx-paint-sw', title: c, style: 'background:' + c,
        onclick: () => { color = c; picker.value = c; if (tool === 'eraser') setTool('brush'); } }));
      const picker = el('input', { type: 'color', class: 'kx-paint-picker', title: 'Custom colour', value: color });
      picker.addEventListener('input', () => { color = picker.value; if (tool === 'eraser') setTool('brush'); });
      const range = el('input', { type: 'range', min: '1', max: '40', value: String(size), title: 'Brush size' });
      range.addEventListener('input', () => { size = Number(range.value); if (shape) { shape.size = size; redraw(); } });

      const rulerBtn = btn('Ruler', () => {
        if (ruler) { ruler = null; rulerBtn.classList.remove('kx-paint-active'); if (tool === 'ruler') setTool('brush'); }
        else { ruler = { x: W / 2, y: H / 2, angle: 0, len: 600 }; rulerBtn.classList.add('kx-paint-active'); setTool('ruler'); }
        redraw();
      }, 'Ruler: drag to move, red dot rotates. Draw along it to get straight lines.');

      const bar1 = el('div', { class: 'kx-embed-bar' },
        addTool('brush', 'Brush', 'Draw. Hold still at the end to snap to a line or curve.'),
        addTool('eraser', 'Eraser'), addTool('text', 'Text'), addTool('lasso', 'Lasso', 'Select freehand, then drag to move'),
        rulerBtn,
        el('span', { class: 'kx-embed-spacer' }),
        btn('Undo', () => {
          if (shape) { shape = null; redraw(); return; }
          if (floating) { floating = null; const s = undo.pop(); if (s) bx.putImageData(s, 0, 0); redraw(); return; }
          const s = undo.pop(); if (s) bx.putImageData(s, 0, 0);
        }),
        btn('Clear', () => { commitAll(); pushUndo(); clearBase(); }),
        btn('Save PNG', () => {
          commitAll();
          const a = document.createElement('a');
          a.download = 'kxkos-paint.png'; a.href = base.toDataURL('image/png'); a.click();
        }));
      const bar2 = el('div', { class: 'kx-embed-bar kx-paint-bar2' }, ...sw, picker, range,
        el('span', { class: 'kx-paint-hint', text: 'Hold still after a stroke to turn it into an editable line or curve.' }));

      const fit = () => {
        const w = wrap.clientWidth - 8, h = wrap.clientHeight - 8;
        if (w <= 0 || h <= 0) return;
        const pw = Math.min(w, h * W / H);
        stack.style.width = pw + 'px'; stack.style.height = (pw * H / W) + 'px';
        redraw();
      };
      if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap);
      setTimeout(fit, 0);
      win.body.classList.add('kx-embed-body');
      win.body.append(bar1, bar2, wrap);
      document.addEventListener('keydown', onKey);
      function onKey(e) {
        if (!win.body.isConnected) { document.removeEventListener('keydown', onKey); return; }
        if (!win.body.contains(document.activeElement) && document.activeElement !== document.body) return;
        if (e.key === 'Enter') commitAll();
        if (e.key === 'Escape') { shape = null; redraw(); }
      }
      setTool('brush');
    }
  });
})();
