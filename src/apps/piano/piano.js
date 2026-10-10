/* Piano: on-screen keyboard (mouse, touch or computer keys), 4 sounds, sustain, and record / play back. Web Audio only. */
(function () {
  'use strict';
  const KX = window.KXKOS;
  const { el } = KX;
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const MIN_BASE = 12, MAX_BASE = 84;    // lowest visible key can be C0 .. C6
  const COUNT = 37;                      // three octaves + C
  // Computer keyboard: bottom row is the lower octave, top row the upper one.
  const LOW = 'zsxdcvgbhnjm,l.;/', HIGH = 'q2w3er5t6y7ui9o0p[=]';
  const KEYMAP = {};                     // computer key -> semitones above the lowest visible key
  LOW.split('').forEach((k, i) => { KEYMAP[k] = 12 + i; });
  HIGH.split('').forEach((k, i) => { KEYMAP[k] = 24 + i; });
  const KEYCHAR = {};                    // offset -> label
  Object.keys(KEYMAP).forEach((k) => { KEYCHAR[KEYMAP[k]] = k.toUpperCase(); });
  const isBlack = (m) => NAMES[m % 12].length === 2;
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  KX.registerApp({
    id: 'piano', title: 'Piano', icon: 'piano', width: 820, height: 380, minWidth: 560, minHeight: 300,
    desktop: true, order: 72,
    launch(win) {
      let ac = null, master = null, sustain = false, sound = 'piano', base = 48;
      const heldKeys = {};               // computer key -> midi it started, so octave changes never leave notes stuck
      const live = {};                   // midi -> {osc nodes, gain}
      const held = new Set();            // notes whose key is still down while sustain is on
      let rec = null, recStart = 0, tape = [], playTimers = [];

      function audio() {
        if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); }
        if (ac.state === 'suspended') ac.resume();
        return ac;
      }
      function on(m, fromTape) {
        const a = audio();
        if (live[m]) off(m, true);
        const g = a.createGain(), t = a.currentTime, f = freq(m);
        const parts = sound === 'organ' ? [[1, 'sine', 0.5], [2, 'sine', 0.3], [3, 'sine', 0.2]]
          : sound === 'square' ? [[1, 'square', 0.25]]
          : sound === 'bell' ? [[1, 'sine', 0.5], [2.76, 'sine', 0.25], [5.4, 'sine', 0.12]]
          : [[1, 'triangle', 0.55], [2, 'sine', 0.2], [3, 'sine', 0.08]];
        const oscs = parts.map(([r, type, amp]) => { const o = a.createOscillator(), og = a.createGain(); o.type = type; o.frequency.value = f * r; og.gain.value = amp; o.connect(og); og.connect(g); o.start(t); return o; });
        const decays = sound === 'organ' || sound === 'square';
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.7, t + 0.01);
        if (!decays) g.gain.exponentialRampToValueAtTime(0.25, t + (sound === 'bell' ? 1.2 : 0.8));
        g.connect(master);
        live[m] = { oscs, g };
        mark(m, true);
        if (rec && !fromTape) tape.push({ t: performance.now() - recStart, m, down: true });
      }
      function off(m, quiet, fromTape) {
        const n = live[m]; if (!n) return;
        const a = ac, t = a.currentTime;
        n.g.gain.cancelScheduledValues(t); n.g.gain.setValueAtTime(Math.max(n.g.gain.value, 0.0001), t); n.g.gain.exponentialRampToValueAtTime(0.0001, t + (quiet ? 0.04 : 0.35));
        n.oscs.forEach((o) => o.stop(t + 0.4));
        delete live[m]; mark(m, false);
        if (rec && !quiet && !fromTape) tape.push({ t: performance.now() - recStart, m, down: false });
      }
      const down = new Set();
      function press(m, fromTape) { down.add(m); held.delete(m); on(m, fromTape); }
      function release(m, fromTape) { down.delete(m); if (sustain) held.add(m); else off(m, false, fromTape); }
      function setSustain(v) {
        sustain = v; sus.classList.toggle('kx-active', v);
        if (!v) { held.forEach((m) => { if (!down.has(m)) off(m); }); held.clear(); }
      }

      // ---- UI
      const keysEl = el('div', { class: 'kx-piano-keys' });
      let keyEls = {};
      function build() {
        keysEl.textContent = '';
        keyEls = {};
        const whites = [];
        for (let m = base; m < base + COUNT; m++) if (!isBlack(m)) whites.push(m);
        const ww = 100 / whites.length;
        const label = (k, m) => {
          const c = KEYCHAR[m - base];
          if (m % 12 === 0) k.appendChild(el('span', { class: 'kx-piano-oct', text: 'C' + (Math.floor(m / 12) - 1) }));
          if (c) k.appendChild(el('span', { class: 'kx-piano-cap', text: c }));
        };
        whites.forEach((m, i) => {
          const k = el('div', { class: 'kx-piano-key', style: 'left:' + (i * ww) + '%;width:' + ww + '%', title: NAMES[m % 12] + (Math.floor(m / 12) - 1) });
          label(k, m); keyEls[m] = k; keysEl.appendChild(k);
        });
        for (let m = base; m < base + COUNT; m++) if (isBlack(m)) {
          const idx = whites.indexOf(m - 1);
          const k = el('div', { class: 'kx-piano-key kx-black', style: 'left:' + ((idx + 1) * ww - ww * 0.3) + '%;width:' + (ww * 0.6) + '%', title: NAMES[m % 12] + (Math.floor(m / 12) - 1) });
          label(k, m); keyEls[m] = k; keysEl.appendChild(k);
        }
        Object.keys(live).forEach((m) => mark(+m, true));
      }
      function shift(d) {
        const nb = Math.max(MIN_BASE, Math.min(MAX_BASE, base + d * 12));
        if (nb === base) return;
        base = nb; build(); octLabel.textContent = 'Octave: C' + (Math.floor(base / 12) - 1) + ' to C' + (Math.floor(base / 12) + 2);
      }
      function mark(m, v) { if (keyEls[m]) keyEls[m].classList.toggle('kx-down', v); }

      let pointer = null;
      const noteAt = (e) => { const t = document.elementFromPoint(e.clientX, e.clientY); const m = Object.keys(keyEls).find((k) => keyEls[k] === t); return m === undefined ? null : +m; };
      keysEl.addEventListener('pointerdown', (e) => { const m = noteAt(e); if (m === null) return; e.preventDefault(); keysEl.setPointerCapture(e.pointerId); pointer = m; press(m); });
      keysEl.addEventListener('pointermove', (e) => { if (pointer === null) return; const m = noteAt(e); if (m !== null && m !== pointer) { release(pointer); pointer = m; press(m); } });
      const up = () => { if (pointer !== null) { release(pointer); pointer = null; } };
      keysEl.addEventListener('pointerup', up); keysEl.addEventListener('pointercancel', up);

      const soundSel = el('select', { class: 'kx-brief-input', onchange: () => { sound = soundSel.value; keysEl.focus(); } },
        ...[['piano', 'Piano'], ['organ', 'Organ'], ['bell', 'Bell'], ['square', 'Chiptune']].map(([v, t]) => el('option', { value: v, text: t })));
      const vol = el('input', { type: 'range', min: '0', max: '100', value: '50', oninput: () => { audio(); master.gain.value = vol.value / 100; } });
      const sus = el('button', { type: 'button', class: 'kx-btn', text: 'Sustain (Space)', onclick: () => setSustain(!sustain) });
      const octLabel = el('span', { class: 'kx-piano-status', text: 'Octave: C3 to C6' });
      const octDown = el('button', { type: 'button', class: 'kx-btn', text: 'Octave −', title: 'Arrow Down or Page Down', onclick: () => shift(-1) });
      const octUp = el('button', { type: 'button', class: 'kx-btn', text: 'Octave +', title: 'Arrow Up or Page Up', onclick: () => shift(1) });
      const status = el('span', { class: 'kx-piano-status', text: 'Play with the mouse or the lettered keys. Arrow Up / Down move the octave.' });
      const recBtn = el('button', { type: 'button', class: 'kx-btn', text: 'Record', onclick: toggleRec });
      const playBtn = el('button', { type: 'button', class: 'kx-btn', text: 'Play', onclick: playTape });

      function toggleRec() {
        if (rec) { rec = null; recBtn.textContent = 'Record'; status.textContent = tape.length ? 'Recorded ' + tape.filter((x) => x.down).length + ' notes.' : 'Nothing recorded.'; return; }
        stopPlay(); tape = []; rec = true; recStart = performance.now(); recBtn.textContent = 'Stop recording'; status.textContent = 'Recording…';
      }
      function stopPlay() { playTimers.forEach(clearTimeout); playTimers = []; Object.keys(live).forEach((m) => off(+m)); }
      function playTape() {
        if (rec) toggleRec();
        if (!tape.length) { status.textContent = 'Record something first.'; return; }
        stopPlay(); status.textContent = 'Playing…';
        tape.forEach((ev) => playTimers.push(setTimeout(() => { if (ev.down) on(ev.m, true); else off(ev.m, false, true); }, ev.t)));
        playTimers.push(setTimeout(() => { status.textContent = 'Done.'; }, tape[tape.length - 1].t + 400));
      }

      build();
      keysEl.tabIndex = 0; keysEl.style.outline = 'none';
      win.body.appendChild(el('div', { class: 'kx-piano' },
        el('div', { class: 'kx-piano-bar' }, soundSel, el('label', { class: 'kx-piano-vol' }, 'Volume', vol), sus, octDown, octUp, octLabel, recBtn, playBtn, status),
        keysEl));

      const alive = () => win.body.isConnected;
      setTimeout(() => keysEl.focus(), 50);
      function kd(e) {
        if (!alive()) { document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (!win.body.contains(document.activeElement) && document.activeElement !== document.body) return;
        if (e.target.matches && e.target.matches('input,select,textarea')) return;
        if (e.key === ' ') { e.preventDefault(); if (!e.repeat) setSustain(true); return; }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); if (!e.repeat) shift(1); return; }
        if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); if (!e.repeat) shift(-1); return; }
        const k = e.key.toLowerCase(), o = KEYMAP[k];
        if (o !== undefined && !e.repeat && heldKeys[k] === undefined) { heldKeys[k] = base + o; press(base + o); }
      }
      function ku(e) {
        if (e.key === ' ') { e.preventDefault(); setSustain(false); return; }
        const k = e.key.toLowerCase();
        if (heldKeys[k] !== undefined) { release(heldKeys[k]); delete heldKeys[k]; }
      }
      document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
      win.onClose = () => { stopPlay(); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); if (ac) ac.close(); };
    }
  });
})();
