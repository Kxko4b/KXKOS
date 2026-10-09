(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const COLORS = ['#1b2a49', '#e5484d', '#f5a524', '#f7d84a', '#46a758', '#2f6fdf', '#8e4ec6', '#ffffff'];

  KX.registerApp({
    id: 'paint', title: 'Paint', icon: 'paint', width: 640, height: 500, minWidth: 360, minHeight: 320,
    desktop: true, order: 70,
    launch(win) {
      let color = COLORS[0], size = 4, erase = false, drawing = false, last = null;
      const canvas = el('canvas', { class: 'kx-paint-canvas' });
      canvas.width = 1200; canvas.height = 800;
      const ctx = canvas.getContext('2d');
      const fill = () => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); };
      fill();
      const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
      };
      canvas.addEventListener('pointerdown', (e) => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); stroke(last, last); });
      canvas.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e); stroke(last, p); last = p; });
      const stop = () => { drawing = false; };
      canvas.addEventListener('pointerup', stop);
      canvas.addEventListener('pointercancel', stop);
      function stroke(a, b) {
        ctx.strokeStyle = erase ? '#ffffff' : color;
        ctx.lineWidth = erase ? size * 3 : size;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      const sw = COLORS.map((c) => el('button', { type: 'button', class: 'kx-paint-sw', title: c, style: 'background:' + c,
        onclick: () => { color = c; erase = false; } }));
      const range = el('input', { type: 'range', min: '1', max: '30', value: String(size), title: 'Brush size' });
      range.addEventListener('input', () => { size = Number(range.value); });
      const btn = (t, fn) => el('button', { type: 'button', class: 'kx-btn', text: t, onclick: fn });
      const bar = el('div', { class: 'kx-embed-bar' }, ...sw, range,
        btn('Eraser', () => { erase = true; }),
        btn('Clear', () => fill()),
        btn('Save PNG', () => {
          const a = document.createElement('a');
          a.download = 'kxkos-paint.png'; a.href = canvas.toDataURL('image/png'); a.click();
        }));
      win.body.classList.add('kx-embed-body');
      win.body.appendChild(bar);
      win.body.appendChild(el('div', { class: 'kx-paint-wrap' }, canvas));
    }
  });
})();
