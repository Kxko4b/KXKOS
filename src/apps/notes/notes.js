(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;

  KX.registerApp({
    id: 'notes', title: 'Notes', icon: 'notes', width: 680, height: 460, minWidth: 420, minHeight: 300,
    desktop: false, startMenu: true, order: 47,
    launch(win) {
      const root = el('div', { class: 'kx-notes' });
      win.body.appendChild(root);
      if (!KX.owner || !KX.owner.isOwner()) {
        root.appendChild(el('p', { class: 'kx-brief-note', style: 'padding:16px', text: 'Notes sync to your private database. Sign in with the Briefing app first (owner only), then reopen Notes.' }));
        return;
      }
      let notes = [], current = null, timer = null, status = '';
      const list = el('ul', { class: 'kx-notes-list' });
      const title = el('input', { type: 'text', class: 'kx-brief-input', placeholder: 'Title' });
      const body = el('textarea', { class: 'kx-notes-body', placeholder: 'Write here. Saves automatically.' });
      const info = el('span', { class: 'kx-paint-hint', text: '' });
      const btn = (t, fn) => el('button', { type: 'button', class: 'kx-btn', text: t, onclick: fn });

      const setInfo = (t) => { info.textContent = t; };
      function drawList() {
        list.textContent = '';
        notes.forEach((n) => {
          const li = el('li', { class: 'kx-notes-item' + (current && current.id === n.id ? ' kx-paint-active' : ''), text: n.title || '(untitled)', onclick: () => select(n) });
          list.appendChild(li);
        });
      }
      function select(n) {
        flush();
        current = n; title.value = n ? n.title : ''; body.value = n ? n.body : '';
        title.disabled = body.disabled = !n;
        drawList();
      }
      async function load() {
        setInfo('Loading…');
        try {
          notes = await KX.owner.api('/rest/v1/kxkos_notes?select=*&order=updated_at.desc');
          setInfo('');
          drawList();
          if (notes.length) select(notes[0]); else select(null);
        } catch (e) { setInfo(e.message); }
      }
      async function create() {
        try {
          const r = await KX.owner.api('/rest/v1/kxkos_notes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ title: 'New note', body: '' }) });
          notes.unshift(r[0]); select(r[0]);
        } catch (e) { setInfo(e.message); }
      }
      async function remove() {
        if (!current) return;
        const ok = await KX.ui.confirm({ title: 'Delete note', message: 'Delete "' + (current.title || 'untitled') + '"?' });
        if (!ok) return;
        const id = current.id;
        try {
          await KX.owner.api('/rest/v1/kxkos_notes?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
          notes = notes.filter((n) => n.id !== id); current = null; select(notes[0] || null);
        } catch (e) { setInfo(e.message); }
      }
      let pending = null;
      function flush() {
        clearTimeout(timer);
        if (!pending) return Promise.resolve();
        const n = pending; pending = null;
        setInfo('Saving…');
        return KX.owner.api('/rest/v1/kxkos_notes?id=eq.' + encodeURIComponent(n.id), {
          method: 'PATCH', body: JSON.stringify({ title: n.title, body: n.body, updated_at: new Date().toISOString() })
        }).then(() => setInfo('Saved'), (e) => setInfo(e.message));
      }
      function changed() {
        if (!current) return;
        current.title = title.value; current.body = body.value;
        pending = current; drawList();
        clearTimeout(timer); timer = setTimeout(flush, 800);
      }
      title.addEventListener('input', changed);
      body.addEventListener('input', changed);
      win.onClose = () => { flush(); };

      root.append(
        el('div', { class: 'kx-embed-bar' }, btn('New', create), btn('Delete', remove), el('span', { class: 'kx-embed-spacer' }), info),
        el('div', { class: 'kx-notes-main' }, list, el('div', { class: 'kx-notes-edit' }, title, body)));
      load();
    }
  });
  if (KX.owner) KX.owner.watch('notes');
})();
