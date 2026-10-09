(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];

  KX.registerApp({
    id: 'requests', title: 'Requests', icon: 'inbox', width: 720, height: 520, minWidth: 420, minHeight: 320,
    desktop: false, startMenu: true, order: 48,
    launch(win) {
      const root = el('div', { class: 'kx-brief' });
      win.body.appendChild(root);
      if (!KX.owner || !KX.owner.isOwner()) {
        root.appendChild(el('p', { class: 'kx-brief-note', style: 'padding:16px', text: 'Leverframe requests are private. Sign in with the Briefing app first (owner only), then reopen Requests.' }));
        return;
      }
      let rows = [], filter = 'Open';
      const content = el('div', { class: 'kx-brief-body' });
      const filterSel = el('select', { class: 'kx-brief-input' }, ...['Open', 'All', ...STATUSES].map((s) => el('option', { value: s, text: s })));
      filterSel.addEventListener('change', () => { filter = filterSel.value; draw(); });
      const btn = (t, fn) => el('button', { type: 'button', class: 'kx-btn', text: t, onclick: fn });
      root.append(el('div', { class: 'kx-brief-head' }, el('strong', { class: 'kx-brief-title', text: 'Requests' }), filterSel, btn('Refresh', load)), content);

      function draw() {
        content.textContent = '';
        const shown = rows.filter((r) => filter === 'All' ? true : filter === 'Open' ? (r.status === 'Pending' || r.status === 'In Progress') : r.status === filter);
        if (!shown.length) { content.appendChild(el('p', { class: 'kx-brief-empty', text: 'Nothing here.' })); return; }
        shown.forEach((r) => {
          const sel = el('select', { class: 'kx-brief-input' }, ...STATUSES.map((s) => el('option', { value: s, text: s })));
          sel.value = STATUSES.includes(r.status) ? r.status : STATUSES[0];
          sel.addEventListener('change', async () => {
            try {
              await KX.owner.api('/rest/v1/requests?id=eq.' + encodeURIComponent(r.id), { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
              r.status = sel.value; draw();
            } catch (e) { KX.ui.alert({ title: 'Requests', message: e.message }); }
          });
          content.appendChild(el('section', { class: 'kx-brief-card' },
            el('h3', { text: (r.request_code || '#' + r.id) + ' · ' + (r.name || 'Unknown') }),
            el('p', { class: 'kx-brief-sub', text: [r.type, r.size, r.discord, r.email].filter(Boolean).join(' · ') }),
            el('p', { text: r.description || '' }),
            el('p', { class: 'kx-brief-sub', text: r.created_at ? new Date(r.created_at).toLocaleString() : '' }),
            el('div', { class: 'kx-clock-row' }, sel,
              r.file_url && /^https:\/\//.test(r.file_url) ? el('a', { href: r.file_url, target: '_blank', rel: 'noopener noreferrer', text: 'Attachment' }) : null)));
        });
      }
      async function load() {
        content.textContent = '';
        content.appendChild(el('p', { class: 'kx-brief-empty', text: 'Loading…' }));
        try { rows = await KX.owner.api('/rest/v1/requests?select=*&order=created_at.desc&limit=200'); draw(); }
        catch (e) { content.textContent = ''; content.appendChild(el('p', { class: 'kx-brief-empty', text: e.message })); }
      }
      load();
    }
  });
  if (KX.owner) KX.owner.watch('requests');
})();
