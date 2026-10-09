(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el } = KX;

  const SB = 'https://ggewdpazpeoielbqrcgm.supabase.co';
  // Public publishable key (safe in the browser, it only identifies the project).
  const KEY = 'sb_publishable_RZYBKLqjC9UYLNdqlOKZCA_IFX-5Gvm';
  const OWNER = 'haleannson@gmail.com';
  const STORE = 'kxkos.briefing.session';

  /* ---- session (Supabase Auth over plain fetch) ---- */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; }
  }
  function save(s) {
    try {
      if (s) localStorage.setItem(STORE, JSON.stringify(s)); else localStorage.removeItem(STORE);
    } catch { /* storage unavailable */ }
  }
  function jwtEmail(token) {
    try {
      const p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return String(JSON.parse(atob(p)).email || '').toLowerCase();
    } catch { return ''; }
  }
  function fromHash() {
    const h = location.hash.replace(/^#/, '');
    if (!h.includes('access_token=') && !h.includes('error_description=')) return null;
    const q = new URLSearchParams(h);
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
    if (q.get('error_description')) return { error: q.get('error_description').replace(/\+/g, ' ') };
    const access = q.get('access_token');
    if (!access) return null;
    return {
      session: {
        access_token: access,
        refresh_token: q.get('refresh_token'),
        expires_at: Date.now() + (Number(q.get('expires_in')) || 3600) * 1000,
        email: jwtEmail(access)
      }
    };
  }

  let session = load();
  let hashError = '';
  const incoming = fromHash();
  if (incoming && incoming.session) { session = incoming.session; save(session); }
  if (incoming && incoming.error) hashError = incoming.error;

  const isOwner = () => !!session && session.email === OWNER;

  function syncVisibility() {
    const app = KX.apps.briefing;
    if (!app) return;
    const show = isOwner();
    if (app.desktop !== show || app.startMenu !== show) {
      app.desktop = show;
      app.startMenu = show;
      KX.emit('apps:changed', app);
    }
  }

  async function refresh() {
    if (!session || !session.refresh_token) return false;
    try {
      const r = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (!r.ok) return false;
      const d = await r.json();
      session = {
        access_token: d.access_token,
        refresh_token: d.refresh_token || session.refresh_token,
        expires_at: Date.now() + (d.expires_in || 3600) * 1000,
        email: jwtEmail(d.access_token)
      };
      save(session);
      return true;
    } catch { return false; }
  }

  async function sendLink(email) {
    const redirect = location.origin + location.pathname;
    const r = await fetch(SB + '/auth/v1/otp?redirect_to=' + encodeURIComponent(redirect), {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, create_user: false })
    });
    if (!r.ok) {
      let msg = 'Could not send the link (HTTP ' + r.status + ').';
      try { const d = await r.json(); msg = d.msg || d.error_description || msg; } catch { /* keep */ }
      throw new Error(msg);
    }
  }

  async function fetchBriefing(date) {
    if (!session) throw new Error('Not signed in.');
    if (session.expires_at - Date.now() < 60000) await refresh();
    const call = () => fetch(SB + '/functions/v1/briefing-view?date=' + date, {
      headers: { apikey: KEY, Authorization: 'Bearer ' + session.access_token }
    });
    let r = await call();
    if (r.status === 401 && (await refresh())) r = await call();
    if (r.status === 401 || r.status === 403) throw new Error('This account is not allowed to see the briefing.');
    if (!r.ok) throw new Error('Briefing failed (HTTP ' + r.status + ').');
    return r.json();
  }

  /* ---- dates ---- */
  const pad = (n) => String(n).padStart(2, '0');
  function today() {
    const d = new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }
  function shift(text, days) {
    const d = new Date(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8)) + days);
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  /* ---- UI ---- */
  KX.registerApp({
    id: 'briefing',
    title: 'Briefing',
    icon: 'briefing',
    width: 560,
    height: 640,
    minWidth: 360,
    minHeight: 320,
    singleton: true,
    desktop: false,
    startMenu: false,
    order: 46,

    launch(win) {
      const root = el('div', { class: 'kx-brief' });
      win.body.appendChild(root);
      let date = today();
      let token = 0;

      const btn = (label, fn, title) => el('button', { type: 'button', class: 'kx-btn', text: label, title: title || label, onclick: fn });
      const clear = () => { while (root.firstChild) root.removeChild(root.firstChild); };
      const card = (title, ...kids) => el('section', { class: 'kx-brief-card' }, el('h3', { text: title }), ...kids);
      const empty = (t) => el('p', { class: 'kx-brief-empty', text: t });
      const row = (main, sub, tag) => el('li', { class: 'kx-brief-row' },
        el('span', { class: 'kx-brief-main', text: main }),
        sub ? el('span', { class: 'kx-brief-sub', text: sub }) : null,
        tag ? el('span', { class: 'kx-brief-tag', text: tag }) : null);

      function showLogin(message) {
        clear();
        const input = el('input', { type: 'email', class: 'kx-brief-input', placeholder: 'Email address', value: OWNER });
        const note = el('p', { class: 'kx-brief-note', text: message || 'Sign in with an email link. Only the owner account can see the briefing.' });
        const send = btn('Send sign-in link', async () => {
          send.disabled = true;
          note.textContent = 'Sending…';
          try {
            await sendLink(input.value.trim().toLowerCase());
            note.textContent = 'Check your inbox and open the link. It brings you back here.';
          } catch (e) {
            note.textContent = e.message;
          }
          send.disabled = false;
        });
        root.appendChild(el('div', { class: 'kx-brief-login' }, el('h2', { text: 'Daily Briefing' }), input, send, note));
      }

      async function showBriefing() {
        clear();
        const my = ++token;
        const head = el('div', { class: 'kx-brief-head' },
          btn('◀', () => { date = shift(date, -1); showBriefing(); }, 'Previous day'),
          el('strong', { class: 'kx-brief-title', text: 'Loading…' }),
          btn('▶', () => { date = shift(date, 1); showBriefing(); }, 'Next day'),
          btn('Today', () => { date = today(); showBriefing(); }),
          btn('Refresh', () => showBriefing()),
          btn('Sign out', () => { session = null; save(null); syncVisibility(); showLogin(); })
        );
        const content = el('div', { class: 'kx-brief-body' }, empty('Loading…'));
        root.appendChild(head);
        root.appendChild(content);

        let d;
        try {
          d = await fetchBriefing(date);
        } catch (e) {
          if (my !== token) return;
          content.textContent = '';
          content.appendChild(empty(e.message));
          return;
        }
        if (my !== token) return;
        head.querySelector('.kx-brief-title').textContent = d.dateLabel;
        content.textContent = '';

        const w = d.weather;
        content.appendChild(card('Weather', w
          ? el('p', { text: w.text + ' · ' + Math.round(w.low) + '–' + Math.round(w.high) + ' °C · rain ' + w.rainChance + '% · wind ' + Math.round(w.wind) + ' km/h' + (w.rainPeriods.length ? ' · rain at ' + w.rainPeriods.join(', ') : '') })
          : empty('Unavailable.')));

        content.appendChild(card('School changes', d.changes.length
          ? el('ul', {}, ...d.changes.map((c) => row(c.time + '  ' + c.subject, [c.teacher, c.room].filter(Boolean).join(' · '), c.cancelled ? 'Cancelled' : 'Changed')))
          : empty('No changes.')));

        content.appendChild(card('Homework', d.homework.length
          ? el('ul', {}, ...d.homework.map((h) => row(h.subject || 'Homework', h.text)))
          : empty('None.')));

        content.appendChild(card('Exams', d.exams.length
          ? el('ul', {}, ...d.exams.map((x) => row(x.time + '  ' + x.title, [x.location, x.description].filter(Boolean).join(' · '))))
          : empty('No exams.')));

        content.appendChild(card('Calendar', d.calendar.length
          ? el('ul', {}, ...d.calendar.map((x) => row(x.time + '  ' + x.title, x.location)))
          : empty('Nothing scheduled.')));

        if (d.requests) {
          content.appendChild(card('Requests', el('p', { text: d.requests.pending + ' pending · ' + d.requests.inProgress + ' in progress' })));
        }
        const errs = Object.keys(d.errors || {});
        if (errs.length) {
          content.appendChild(card('Problems', el('ul', {}, ...errs.map((k) => row(k, d.errors[k])))));
        }
      }

      if (!session) showLogin(hashError);
      else if (!isOwner()) { session = null; save(null); showLogin('That account is not allowed to see the briefing.'); }
      else showBriefing();
    }
  });

  syncVisibility();
})();
