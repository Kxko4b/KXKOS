/* Calendar: month view with a short note per day, kept in localStorage. Weeks start on Monday. */
(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const KEY = 'kxkos.calendar.notes';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } };
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);

  KX.registerApp({
    id: 'calendar', title: 'Calendar', icon: 'calendar', width: 560, height: 500, minWidth: 420, minHeight: 400,
    desktop: true, order: 75,
    launch(win) {
      const now = new Date();
      let y = now.getFullYear(), m = now.getMonth(), sel = ymd(y, m, now.getDate());
      let notes = load();
      const title = el('strong', { class: 'kx-cal-title' });
      const grid = el('div', { class: 'kx-cal-grid' });
      const area = el('textarea', { class: 'kx-brief-input kx-cal-note', placeholder: 'Note for this day…', rows: '4' });
      const selLabel = el('div', { class: 'kx-cal-sel' });
      area.addEventListener('input', () => { if (area.value.trim()) notes[sel] = area.value; else delete notes[sel]; save(notes); const c = grid.querySelector('[data-d="' + sel + '"]'); if (c) c.classList.toggle('kx-has', !!notes[sel]); });
      const go = (d) => { m += d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); };
      const btn = (t, fn) => el('button', { type: 'button', class: 'kx-btn', text: t, onclick: fn });
      win.body.appendChild(el('div', { class: 'kx-cal' },
        el('div', { class: 'kx-cal-bar' }, btn('‹', () => go(-1)), title, btn('›', () => go(1)),
          btn('Today', () => { const t = new Date(); y = t.getFullYear(); m = t.getMonth(); sel = ymd(y, m, t.getDate()); draw(); })),
        grid, selLabel, area));

      function draw() {
        title.textContent = new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        grid.textContent = '';
        ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach((d) => grid.appendChild(el('div', { class: 'kx-cal-dow', text: d })));
        const lead = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
        for (let i = 0; i < lead; i++) grid.appendChild(el('div'));
        const today = ymd(now.getFullYear(), now.getMonth(), now.getDate());
        for (let d = 1; d <= days; d++) {
          const k = ymd(y, m, d);
          const c = el('button', { type: 'button', class: 'kx-cal-day' + (k === today ? ' kx-today' : '') + (k === sel ? ' kx-sel' : '') + (notes[k] ? ' kx-has' : ''), text: String(d), onclick: () => { sel = k; draw(); } });
          c.dataset.d = k; grid.appendChild(c);
        }
        selLabel.textContent = new Date(sel + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        area.value = notes[sel] || '';
      }
      draw();
    }
  });
})();
