(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (ms) => { const s = Math.floor(ms / 1000); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) + '.' + String(Math.floor(ms % 1000 / 100)); };

  KX.registerApp({
    id: 'clock', title: 'Clock', icon: 'clock', width: 360, height: 360, minWidth: 320, minHeight: 300,
    desktop: true, order: 71,
    launch(win) {
      const btn = (t, fn) => el('button', { type: 'button', class: 'kx-btn', text: t, onclick: fn });
      const time = el('div', { class: 'kx-clock-big' });
      const date = el('div', { class: 'kx-clock-sub' });
      const sw = el('div', { class: 'kx-clock-big', text: fmt(0) });
      const tm = el('div', { class: 'kx-clock-big', text: '00:05:00.0' });
      let swStart = 0, swAcc = 0, swRun = false;
      let tmLeft = 300000, tmEnd = 0, tmRun = false;
      const mins = el('input', { type: 'number', min: '1', max: '999', value: '5', class: 'kx-brief-input', style: 'width:70px' });

      const swBtns = el('div', { class: 'kx-clock-row' },
        btn('Start / Stop', () => { if (swRun) { swAcc += Date.now() - swStart; swRun = false; } else { swStart = Date.now(); swRun = true; } }),
        btn('Reset', () => { swAcc = 0; swRun = false; sw.textContent = fmt(0); }));
      const tmBtns = el('div', { class: 'kx-clock-row' }, mins,
        btn('Start / Pause', () => {
          if (tmRun) { tmLeft = Math.max(0, tmEnd - Date.now()); tmRun = false; }
          else { if (tmLeft <= 0) tmLeft = Math.max(1, Number(mins.value) || 1) * 60000; tmEnd = Date.now() + tmLeft; tmRun = true; }
        }),
        btn('Set', () => { tmRun = false; tmLeft = Math.max(1, Number(mins.value) || 1) * 60000; tm.textContent = fmt(tmLeft); }));

      win.body.appendChild(el('div', { class: 'kx-clock' },
        el('h3', { text: 'Time' }), time, date,
        el('h3', { text: 'Stopwatch' }), sw, swBtns,
        el('h3', { text: 'Timer' }), tm, tmBtns));

      const iv = setInterval(() => {
        if (!win.body.isConnected) { clearInterval(iv); return; }
        const n = new Date();
        time.textContent = pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds());
        date.textContent = n.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (swRun) sw.textContent = fmt(swAcc + Date.now() - swStart);
        if (tmRun) {
          const left = Math.max(0, tmEnd - Date.now());
          tm.textContent = fmt(left);
          if (left === 0) { tmRun = false; tmLeft = 0; KX.ui.alert({ title: 'Clock', message: 'Timer finished.' }); }
        }
      }, 100);
      win.onClose = () => clearInterval(iv);
    }
  });
})();
