(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const pct = (v, total) => (v / total * 100) + '%';

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function conflict(a, b) {
    if (a.dir !== b.dir && a.tcs.some((t) => b.tcs.includes(t))) return true;
    for (const p of Object.keys(a.pts)) {
      if (!(p in b.pts)) continue;
      if (a.pts[p] !== b.pts[p]) return true;
      if (a.dir !== b.dir && a.pts[p] === 'R') return true;
    }
    return false;
  }

  KX.registerSignalBox = function registerSignalBox(cfg) {
  const D = cfg.data;
  const IMG = cfg.image;
  const routeOf = (sig) => D.ROUTES[sig];
  KX.registerApp({
    id: cfg.id, title: cfg.title, icon: cfg.icon || 'signal', width: 1120, height: 780, minWidth: 640, minHeight: 480,
    singleton: true, desktop: true, order: cfg.order || 31,

    launch(win) {
      /* ------------------------------------------------------------ state */
      const lever = {};
      Object.keys(D.SIGNALS).concat(Object.keys(D.POINTS), D.SPARE).forEach((k) => { lever[k] = 0; });
      const fpl = {};                 // facing point lock applied
      const cleared = {};             // signal id -> aspect is clear
      const occ = {};                 // track circuit -> train id
      const block = {};
      Object.keys(D.NEIGHBOURS).forEach((n) => { block[n] = { in: 'idle', out: 'idle', offer: null, attn: 0, biIn: 'blocked', biOut: 'blocked', rang21: false }; });
      const MOVE = Math.max(1, Math.round((D.MOVE_SECONDS || 9) * (window.__sbFast ? 0.12 : 1)));   // seconds per track circuit
      let trains = [], nextId = 1, muted = false;
      const timers = new Set();
      const SP = window.__sbFast ? 0.08 : 1;   // test hook only
      const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive()) fn(); }, ms); timers.add(t); return t; };
      const slow = (fn, ms) => later(fn, ms * SP);
      const alive = () => win.body.isConnected;

      /* ------------------------------------------------------------ sound */
      let ac = null;
      function ctx() {
        if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } }
        if (ac && ac.state === 'suspended') ac.resume();
        return ac;
      }
      function tone(freq, dur, gain, type, when) {
        const a = ctx(); if (!a || muted) return;
        const t0 = a.currentTime + (when || 0);
        const o = a.createOscillator(), g = a.createGain();
        o.type = type || 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
      }
      function noise(dur, gain, when, lowpass) {
        const a = ctx(); if (!a || muted) return;
        const t0 = a.currentTime + (when || 0);
        const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = a.createBufferSource(); s.buffer = buf;
        const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass || 2500;
        const g = a.createGain(); g.gain.value = gain;
        s.connect(f); f.connect(g); g.connect(a.destination); s.start(t0);
      }
      // Each neighbour has its own bell, so you can tell who is calling without looking.
      function sBell(when, nb) {
        const b = (D.BELLS && D.BELLS[nb]) || { f: 1245, style: 'ding' };
        if (b.style === 'gong') { tone(b.f, 1.3, 0.38, 'sine', when); tone(b.f * 1.5, 0.9, 0.16, 'triangle', when); tone(b.f * 2.01, 0.5, 0.08, 'sine', when); }
        else if (b.style === 'dingdong') { tone(b.f, 0.5, 0.33, 'sine', when); tone(b.f * 0.75, 0.7, 0.33, 'sine', when + 0.11); tone(b.f * 2, 0.3, 0.06, 'sine', when); }
        else if (b.style === 'buzz') { tone(b.f, 0.35, 0.18, 'square', when); tone(b.f * 2, 0.2, 0.05, 'square', when); }
        else { tone(b.f, 0.9, 0.35, 'sine', when); tone(b.f * 2, 0.5, 0.12, 'sine', when); tone(b.f * 2.5, 0.25, 0.05, 'sine', when); }
      }
      const sLever = () => { noise(0.07, 0.5, 0, 1800); tone(95, 0.12, 0.5, 'triangle'); noise(0.05, 0.3, 0.16, 3000); };
      const sBI = () => { tone(1800, 0.03, 0.2, 'square'); tone(1500, 0.03, 0.2, 'square', 0.07); };
      const sKey = () => { noise(0.03, 0.4, 0, 4000); tone(700, 0.04, 0.15, 'square'); };
      const sNeedle = () => { noise(0.05, 0.3, 0, 1500); tone(260, 0.1, 0.25, 'triangle'); noise(0.04, 0.3, 0.14, 2500); };
      const sRefuse = () => { tone(140, 0.2, 0.4, 'sawtooth'); };

      /* ------------------------------------------------------------ log */
      const logBox = el('div', { class: 'kx-sb-log' });
      function log(text, who) {
        const t = new Date();
        const line = el('div', { class: 'kx-sb-line' + (who ? ' kx-sb-' + who : '') },
          el('span', { class: 'kx-sb-time', text: t.toTimeString().slice(0, 8) + ' ' }), document.createTextNode(text));
        logBox.appendChild(line);
        while (logBox.childNodes.length > 80) logBox.removeChild(logBox.firstChild);
        logBox.scrollTop = logBox.scrollHeight;
      }
      const meaning = (code) => D.CODES[code] ? ' (' + D.CODES[code] + ')' : ' (not a code I know)';

      /* ---------------------------------------------------- interlocking */
      function signalRefusal(sig) {
        const r = routeOf(sig);
        if (!r) return null;
        for (const p of Object.keys(r.pts)) {
          const want = r.pts[p] === 'R' ? 1 : 0;
          if (lever[p] !== want) return 'Signal ' + sig + ' locked: points ' + p + ' must be ' + (want ? 'reverse' : 'normal') + '.';
        }
        for (const p of Object.keys(r.pts)) {
          if ((D.FPL || []).includes(+p) && !fpl[p]) return 'Signal ' + sig + ' locked: FPL on points ' + p + ' not applied.';
        }
        for (const t of r.tcs) if (occ[t]) return 'Signal ' + sig + ' locked: track circuit ' + t + ' is occupied.';
        for (const s of Object.keys(D.ROUTES)) {
          if (+s !== +sig && lever[s] && conflict(r, D.ROUTES[s])) return 'Signal ' + sig + ' locked by signal ' + s + '.';
        }
        if (r.exit && block[r.exit].out !== 'accepted') return 'Signal ' + sig + ' locked: line not clear to ' + D.NEIGHBOURS[r.exit] + '.';
        return null;
      }
      function pointRefusal(p) {
        if (fpl[p]) return 'Points ' + p + ' locked by their FPL.';
        for (const s of Object.keys(D.ROUTES)) {
          if (lever[s] && p in D.ROUTES[s].pts) return 'Points ' + p + ' locked by signal ' + s + '.';
        }
        const tc = D.POINT_TC[p];
        if (tc && occ[tc]) return 'Points ' + p + ' locked: track circuit ' + tc + ' is occupied.';
        return null;
      }
      function pullFpl(p) {
        ctx();
        if (fpl[p]) {
          const held = Object.keys(D.ROUTES).find((s) => lever[s] && p in D.ROUTES[s].pts);
          const tc = D.POINT_TC[p];
          const why = held ? 'FPL ' + p + ' locked by signal ' + held + '.' : tc && occ[tc] ? 'FPL ' + p + ' locked: track circuit ' + tc + ' is occupied.' : null;
          if (why) { sRefuse(); msg(why, true); return; }
          fpl[p] = 0;
        } else {
          const tc = D.POINT_TC[p];
          if (tc && occ[tc]) { sRefuse(); msg('FPL ' + p + ' cannot be applied: track circuit ' + tc + ' is occupied.', true); return; }
          fpl[p] = 1;
        }
        sLever(); msg('', false); render();
      }
      function pull(id) {
        ctx();
        const isSig = id in D.SIGNALS, isPt = id in D.POINTS;
        let why = null;
        if (lever[id]) {
          if (isPt) why = pointRefusal(id);                 // restoring a signal is always allowed
        } else if (isSig) why = signalRefusal(id);
        else if (isPt) why = pointRefusal(id);
        if (why) { sRefuse(); msg(why, true); return; }
        lever[id] = lever[id] ? 0 : 1;
        sLever();
        if (isSig) {
          cleared[id] = !!lever[id] && !!routeOf(id);
          if (lever[id] && !routeOf(id)) msg('Signal ' + id + ' has no locking yet (draft).', false);
          else msg('', false);
        } else msg('', false);
        render();
      }

      /* ------------------------------------------------------------ bell */
      function ringSeq(code, who, nb) {
        const groups = code.split('-').map(Number);
        let t = 0;
        groups.forEach((n, gi) => {
          for (let i = 0; i < n; i++) { sBell(t, nb); t += 0.42; }
          t += gi < groups.length - 1 ? 0.55 : 0;
        });
        log(D.NEIGHBOURS[nb] + ' rings ' + code + meaning(code), who || 'bot');
      }
      const botRing = (nb, code, delay) => later(() => ringSeq(code, 'bot', nb), (delay || 0) * 1000);
      // The adjacent box first calls attention (1). Once you answer 1 it rings the message; you repeat it to acknowledge and it does not ring it again.
      function botSend(nb, code, then) {
        const n = block[nb];
        n.q = { code, then };
        const attempt = (k) => {
          if (!n.q || n.q.code !== code) return;
          if (k === 0) { n.q = null; ringSeq(code, 'bot', nb); n.ack = code; later(() => { if (n.ack === code) n.ack = null; }, 30000); then(); return; }
          ringSeq('1', 'bot', nb);
          later(() => attempt(k - 1), 20000);
        };
        attempt(3);
      }

      const beats = {};
      Object.keys(D.NEIGHBOURS).forEach((n) => { beats[n] = { groups: [], last: 0, timer: null }; });
      function beat(nb) {
        ctx(); sKey(); sBell(0, nb);
        const b = beats[nb], now = performance.now();
        if (!b.groups.length || now - b.last > 800) b.groups.push(1); else b.groups[b.groups.length - 1]++;
        b.last = now;
        clearTimeout(b.timer);
        b.timer = setTimeout(() => {
          const code = b.groups.join('-'); b.groups = [];
          log('You ring ' + code + ' to ' + D.NEIGHBOURS[nb] + meaning(code), 'me');
          botHears(nb, code);
        }, 2200);
        timers.add(b.timer);
        render();
      }

      function trainWaitingFor(nb) {
        return trains.find((t) => !t.gone && t.exitTo === nb && !t.exitOk);
      }
      function botHears(nb, code) {
        const n = block[nb];
        if (n.ack === code) { n.ack = null; log(D.NEIGHBOURS[nb] + ' has your acknowledgement.', 'bot'); return; }
        if (code === '1' && n.q) {
          const q = n.q; n.q = null;
          later(() => { ringSeq(q.code, 'bot', nb); n.ack = q.code; later(() => { if (n.ack === q.code) n.ack = null; }, 30000); q.then(); }, 1500);
          return;
        }
        if (code === '1') {
          if (n.in === 'calling') { n.in = 'attn'; later(() => offerCode(nb), 2000); return; }
          n.attn = Date.now(); botRing(nb, '1', 1.5); return;
        }
        if (n.in === 'offered' && n.offer && code === D.CLASSES[n.offer.cls].code) {
          n.in = 'accepted'; log(D.NEIGHBOURS[nb] + ': waiting for you to give LINE CLEAR on the instrument.', 'bot'); sBI(); render();
          return;
        }
        if (n.in === 'offered' && n.offer && D.CODES[code] && D.CODES[code].indexOf('Is line clear') === 0) {
          log(D.NEIGHBOURS[nb] + ': that is not the train I described. Repeat my code.', 'bot'); botRing(nb, D.CLASSES[n.offer.cls].code, 2); return;
        }
        if (D.CODES[code] && D.CODES[code].indexOf('Is line clear') === 0) {
          const t = trainWaitingFor(nb);
          if (!t) { log(D.NEIGHBOURS[nb] + ': I have no train for you to send.', 'bot'); return; }
          if (code !== D.CLASSES[t.cls].code) { log(D.NEIGHBOURS[nb] + ': that is not the right class for your train (' + D.CLASSES[t.cls].name + ').', 'bot'); return; }
          if (n.out !== 'idle') { log(D.NEIGHBOURS[nb] + ': the line is not clear for you yet.', 'bot'); return; }
          if (Math.random() < 0.2 && !window.__sbNoRefuse) { log(D.NEIGHBOURS[nb] + ' is not answering. Try again in a moment.', 'bot'); return; }
          botRing(nb, code, 2.5);
          later(() => { n.out = 'accepted'; n.biOut = 'clear'; t.exitOk = true; sNeedle(); log(D.NEIGHBOURS[nb] + ' gave LINE CLEAR.', 'bot'); render(); }, 2.5 * 1000 + 4500);
          return;
        }
        if (code === '2' && (n.out === 'accepted' || n.out === 'section')) {
          botRing(nb, '2', 1.5); return;
        }
        if (code === '2-1' && n.in === 'await21') { n.rang21 = true; botRing(nb, '2-1', 1.5); log('Now set the instrument to LINE BLOCKED.', 'info'); return; }
        if (code === '3-5') { n.out = 'idle'; botRing(nb, '3-5', 1.5); return; }
        if (D.CODES[code]) botRing(nb, code, 1.5); else log(D.NEIGHBOURS[nb] + ' does not understand that.', 'bot');
      }

      /* ------------------------------------------------------ instruments */
      function giveClear(nb) {
        ctx(); const n = block[nb];
        if (n.in !== 'accepted') { sRefuse(); msg('Nothing to give LINE CLEAR to: accept a train on the bell first.', true); return; }
        n.biIn = 'clear'; sNeedle(); msg('', false); render();
        later(() => botSend(nb, '2', () => { n.in = 'section'; n.biIn = 'train'; sNeedle(); log(D.NEIGHBOURS[nb] + ': train entering section. It will take a while to reach you.', 'bot'); spawn(nb, rand(55, 80) * 1000 * SP); render(); }), rand(8, 12) * 1000 * SP);
      }
      function setBlocked(nb) {
        ctx(); const n = block[nb];
        if (n.in === 'await21' && n.rang21) { n.in = 'idle'; n.biIn = 'blocked'; n.rang21 = false; sNeedle(); msg('', false); render(); return; }
        sRefuse(); msg(n.in === 'await21' ? 'Send 2-1 first, then LINE BLOCKED.' : 'The section is not ready to be blocked.', true);
      }
      function trainOnLine(nb) {
        ctx(); const n = block[nb];
        if (n.out !== 'accepted') { sRefuse(); msg('You have no line clear to ' + D.NEIGHBOURS[nb] + '.', true); return; }
        n.out = 'section'; n.biOut = 'train'; sNeedle(); msg('', false); render();
        later(() => botSend(nb, '2-1', () => { n.out = 'idle'; n.biOut = 'blocked'; sNeedle(); log(D.NEIGHBOURS[nb] + ' gave TRAIN OUT OF SECTION.', 'bot'); render(); }), rand(50, 70) * 1000 * SP);
      }

      /* ---------------------------------------------------------- traffic */
      function offerCode(nb) {
        const n = block[nb];
        if (!n.offer) return;
        n.in = 'offered';
        botRing(nb, D.CLASSES[n.offer.cls].code, 0);
        n.offerTimer = later(() => {
          if (n.in === 'offered') { botRing(nb, '3-5', 0); n.in = 'idle'; n.offer = null; log(D.NEIGHBOURS[nb] + ' cancelled the offer.', 'bot'); render(); }
        }, 60000);
      }
      function startOffer() {
        if (!alive()) return;
        const active = trains.filter((t) => !t.gone).length + Object.values(block).filter((b) => b.in !== 'idle').length;
        if (active < 3) {
          const j = pick(Object.keys(D.JOURNEYS)), jd = D.JOURNEYS[j], n = block[jd.from];
          const free = n.in === 'idle' && !occ[jd.approach];
          if (free) {
            const cls = j === 'A' || j === 'B' ? pick(['express', 'ordinary', 'goods', 'ecs']) : pick(['ordinary', 'light', 'ecs']);
            n.offer = { journey: j, cls }; n.in = 'calling';
            botRing(jd.from, '1', 0);
            const again = (k) => later(() => { if (n.in === 'calling') { if (k > 0) { botRing(jd.from, '1', 0); again(k - 1); } else { n.in = 'idle'; n.offer = null; render(); } } }, 25000);
            again(2);
          }
        }
        later(startOffer, rand(40, 80) * 1000);
      }
      function spawn(nb, delay) {
        const n = block[nb], j = n.offer.journey, jd = D.JOURNEYS[j];
        const t = { id: nextId++, journey: j, cls: n.offer.cls, from: nb, leg: 0, state: 'approach', cur: jd.approach, gone: false, wait: 0, exitTo: null, exitOk: false };
        const tryPlace = () => {
          if (occ[jd.approach]) { later(tryPlace, 3000); return; }
          occ[jd.approach] = t.id; trains.push(t); n.offer = null; setExit(t); render();
        };
        later(tryPlace, delay || 0);
      }
      function setExit(t) {
        const jd = D.JOURNEYS[t.journey];
        const last = jd.legs[jd.legs.length - 1];
        t.exitTo = typeof last === 'number' && D.ROUTES[last].exit ? D.ROUTES[last].exit : null;
      }
      function release(tc, id) { if (occ[tc] === id) delete occ[tc]; }

      function tick() {
        if (!alive()) return;
        trains.forEach((t) => {
          if (t.gone) return;
          const jd = D.JOURNEYS[t.journey];
          if (t.state === 'moving') {
            if (--t.wait > 0) return;
            const r = D.ROUTES[t.sig];
            if (t.pi >= r.tcs.length) {
              t.leg++; t.state = 'approach';
              if (t.leg >= jd.legs.length) { t.gone = true; later(() => { release(t.cur, t.id); render(); }, (MOVE + 1) * 1000); finish(t, r); }
              render(); return;
            }
            const next = r.tcs[t.pi];
            if (occ[next] && occ[next] !== t.id) { return; }
            if (t.pi === 0) { cleared[t.sig] = false; if (t.leg === 0) leftApproach(t); }
            occ[next] = t.id;
            const old = t.cur; t.cur = next; t.pi++; t.wait = MOVE;
            later(() => { release(old, t.id); render(); }, (MOVE + 1) * 1000);
            render(); return;
          }
          if (t.state === 'dwell') { if (--t.wait <= 0) { t.leg++; t.state = 'approach'; } render(); return; }
          const leg = jd.legs[t.leg];
          if (leg === undefined) return;
          if (typeof leg === 'object') { t.state = 'dwell'; t.wait = Math.max(1, Math.round(leg.dwell * (window.__sbFast ? 0.1 : 1))); return; }
          if (cleared[leg] && lever[leg]) { t.state = 'moving'; t.sig = leg; t.pi = 0; t.wait = 5; }
        });
        trains = trains.filter((t) => !t.gone || Object.values(occ).includes(t.id));
        render();
      }
      function leftApproach(t) {
        const n = block[t.from];
        n.in = 'await21';
        log('Train #' + t.id + ' is in the platform area. Send 2-1 to ' + D.NEIGHBOURS[t.from] + ' when it has passed your first signal.', 'info');
      }
      function finish(t) {
        if (t.exitTo) {
          log('Train #' + t.id + ' has left towards ' + D.NEIGHBOURS[t.exitTo] + '. Send 2 (train entering section).', 'info');
        }
      }

      /* ------------------------------------------------------------- UI */
      const diagram = el('div', { class: 'kx-sb-diagram', style: 'aspect-ratio:' + D.W + '/' + D.H });
      diagram.appendChild(el('img', { class: 'kx-sb-img', src: IMG, alt: cfg.title, draggable: 'false' }));
      const sigEls = {}, ptEls = {}, tcEls = {};
      Object.keys(D.TCS).forEach((k) => {
        const [x, y] = D.TCS[k];
        const e = el('div', { class: 'kx-sb-tc', title: 'Track circuit ' + k, style: 'left:' + pct(x, D.W) + ';top:' + pct(y, D.H) });
        tcEls[k] = e; diagram.appendChild(e);
      });
      Object.keys(D.POINTS).forEach((k) => {
        const [x, y] = D.POINTS[k];
        const e = el('div', { class: 'kx-sb-pt', title: 'Points ' + k, style: 'left:' + pct(x, D.W) + ';top:' + pct(y, D.H) });
        ptEls[k] = e; diagram.appendChild(e);
      });
      Object.keys(D.SIGNALS).forEach((k) => {
        const [x, y] = D.SIGNALS[k];
        const e = el('div', { class: 'kx-sb-sig', title: 'Signal ' + k, style: 'left:' + pct(x, D.W) + ';top:' + pct(y, D.H), onclick: () => pull(+k) });
        sigEls[k] = e; diagram.appendChild(e);
      });

      const msgBar = el('div', { class: 'kx-sb-msg', text: '' });
      function msg(t, bad) { msgBar.textContent = t; msgBar.classList.toggle('kx-sb-bad', !!bad); }

      const frame = el('div', { class: 'kx-sb-frame' });
      const levBtn = {};
      const ids = Object.keys(D.SIGNALS).concat(Object.keys(D.POINTS), D.SPARE).map(Number).sort((a, b) => a - b);
      const fplBtn = {};
      ids.forEach((id) => {
        const kind = id in D.SIGNALS ? 'sig' : id in D.POINTS ? 'pt' : 'spare';
        const bt = el('button', { type: 'button', class: 'kx-sb-lever kx-sb-l' + kind, text: String(id), title: (kind === 'sig' ? 'Signal ' : kind === 'pt' ? 'Points ' : 'Spare lever ') + id });
        if (kind !== 'spare') bt.addEventListener('click', () => pull(id)); else bt.disabled = true;
        levBtn[id] = bt;
        const cell = el('div', { class: 'kx-sb-cell' }, bt);
        if (kind === 'pt' && (D.FPL || []).includes(id)) {
          const f = el('button', { type: 'button', class: 'kx-sb-fpl', text: 'FPL', title: 'Facing point lock for points ' + id, onclick: () => pullFpl(id) });
          fplBtn[id] = f; cell.appendChild(f);
        }
        frame.appendChild(cell);
      });

      const blockPanel = el('div', { class: 'kx-sb-block' });
      const blockRows = {};
      const NEEDLE = { clear: -52, blocked: 0, train: 52 };
      const LABEL = { clear: 'LINE CLEAR', blocked: 'LINE BLOCKED', train: 'TRAIN ON LINE' };
      function dial(title) {
        const needle = el('div', { class: 'kx-sb-needle' });
        const lab = el('div', { class: 'kx-sb-dial-label' });
        const face = el('div', { class: 'kx-sb-dial' }, el('div', { class: 'kx-sb-zone kx-sb-z-clear' }), el('div', { class: 'kx-sb-zone kx-sb-z-blocked' }), el('div', { class: 'kx-sb-zone kx-sb-z-train' }), needle, el('div', { class: 'kx-sb-hub' }));
        return { root: el('div', { class: 'kx-sb-bi' }, el('div', { class: 'kx-sb-bi-title', text: title }), face, lab), needle, lab };
      }
      Object.keys(D.NEIGHBOURS).forEach((nb) => {
        const nm = D.NEIGHBOURS[nb];
        const status = el('span', { class: 'kx-sb-status' });
        const key = el('button', { type: 'button', class: 'kx-btn kx-sb-key', text: 'Bell ' + nm, title: 'Tap the beats. Pause between groups. Key: ' + (D.KEYS ? D.KEYS[nb] : ''), onclick: () => beat(nb) });
        const pend = el('span', { class: 'kx-sb-pend' });
        const dIn = dial('From ' + nm), dOut = dial('To ' + nm);
        const bClear = el('button', { type: 'button', class: 'kx-btn', text: 'Line clear', onclick: () => giveClear(nb) });
        const bBlocked = el('button', { type: 'button', class: 'kx-btn', text: 'Line blocked', onclick: () => setBlocked(nb) });
        const bTrain = el('button', { type: 'button', class: 'kx-btn', text: 'Train on line', onclick: () => trainOnLine(nb) });
        blockRows[nb] = { status, pend, dIn, dOut };
        blockPanel.appendChild(el('div', { class: 'kx-sb-brow' },
          el('div', { class: 'kx-sb-bcol' }, el('strong', { text: nm }), status, el('div', { class: 'kx-sb-bbtns' }, key, pend)),
          el('div', { class: 'kx-sb-bcol' }, dIn.root, el('div', { class: 'kx-sb-bbtns' }, bClear, bBlocked)),
          el('div', { class: 'kx-sb-bcol' }, dOut.root, el('div', { class: 'kx-sb-bbtns' }, bTrain))));
      });
      const trainList = el('div', { class: 'kx-sb-trains' });
      const mute = el('button', { type: 'button', class: 'kx-btn', text: 'Sound on', onclick: () => { muted = !muted; mute.textContent = muted ? 'Sound off' : 'Sound on'; } });
      const codesBtn = el('button', { type: 'button', class: 'kx-btn', text: 'Codes', onclick: showCodes });
      function showCodes() {
        const rows = Object.keys(D.CODES).map((c) => c + '  ' + D.CODES[c]).join('\n');
        KX.ui.alert({ title: 'Bell codes', message: rows });
      }

      function render() {
        Object.keys(sigEls).forEach((k) => {
          const e = sigEls[k];
          e.classList.toggle('kx-sb-clear', !!cleared[k]);
          e.classList.toggle('kx-sb-held', !!lever[k] && !cleared[k]);
          levBtn[k].classList.toggle('kx-sb-pulled', !!lever[k]);
        });
        Object.keys(ptEls).forEach((k) => { ptEls[k].classList.toggle('kx-sb-rev', !!lever[k]); levBtn[k].classList.toggle('kx-sb-pulled', !!lever[k]); });
        Object.keys(tcEls).forEach((k) => tcEls[k].classList.toggle('kx-sb-occ', !!occ[k]));
        Object.keys(fplBtn).forEach((k) => { fplBtn[k].classList.toggle('kx-sb-on', !!fpl[k]); });
        Object.keys(ptEls).forEach((k) => ptEls[k].classList.toggle('kx-sb-fpl-on', !!fpl[k]));
        Object.keys(block).forEach((nb) => {
          const b = block[nb], r = blockRows[nb];
          const names = { idle: 'idle', calling: 'calling you', attn: 'attention', offered: 'offering a train', accepted: 'accepted: give LINE CLEAR', section: 'train on its way', await21: 'train arrived: send 2-1' };
          r.status.textContent = names[b.in];
          r.status.classList.toggle('kx-sb-hot', b.in === 'calling' || b.in === 'offered' || b.in === 'accepted');
          r.pend.textContent = beats[nb].groups.length ? beats[nb].groups.join('-') + '…' : '';
          [[r.dIn, b.biIn], [r.dOut, b.biOut]].forEach(([d, state]) => {
            d.needle.style.transform = 'rotate(' + NEEDLE[state] + 'deg)';
            d.lab.textContent = LABEL[state];
          });
        });
        trainList.textContent = '';
        const live = trains.filter((t) => !t.gone);
        if (!live.length) trainList.appendChild(el('div', { class: 'kx-brief-empty', text: 'No trains in the area.' }));
        live.forEach((t) => {
          const jd = D.JOURNEYS[t.journey], leg = jd.legs[t.leg];
          const what = t.state === 'moving' ? 'moving' : t.state === 'dwell' ? 'standing in the platform' : typeof leg === 'number' ? 'waiting at signal ' + leg : '';
          trainList.appendChild(el('div', { class: 'kx-sb-trainrow', text: '#' + t.id + ' ' + D.CLASSES[t.cls].name + ' (' + D.CLASSES[t.cls].code + ') · ' + jd.label + ' · ' + what }));
        });
      }

      const top = el('div', { class: 'kx-embed-bar' }, el('strong', { text: cfg.title.replace(' Signal Box', '') }), el('span', { class: 'kx-embed-spacer' }), codesBtn, mute);
      const lower = el('div', { class: 'kx-sb-lower' },
        el('div', { class: 'kx-sb-col' }, blockPanel, trainList),
        el('div', { class: 'kx-sb-col' }, logBox));
      win.body.classList.add('kx-sb-body');
      win.body.append(top, diagram, msgBar, frame, lower);
      win.onClose = () => { timers.forEach(clearTimeout); timers.clear(); };

      document.addEventListener('keydown', onKey);
      function onKey(e) {
        if (!alive()) { document.removeEventListener('keydown', onKey); return; }
        if (!win.body.contains(document.activeElement) && document.activeElement !== document.body) return;
        const nb = Object.keys(D.KEYS || {}).find((k) => D.KEYS[k].toLowerCase() === e.key.toLowerCase());
        if (!e.repeat && nb) beat(nb);
      }

      log(cfg.title + '. Bell keys: ' + Object.keys(D.KEYS).map((k) => D.KEYS[k] + ' = ' + D.NEIGHBOURS[k]).join(', ') + '. A train will be offered shortly.', 'info');
      render();
      const iv = setInterval(() => { if (!alive()) { clearInterval(iv); return; } tick(); }, 1000);
      later(startOffer, 6000);
    }
  });
  };
})();
