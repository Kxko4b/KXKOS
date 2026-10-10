/* Screensaver: after a few idle minutes (or the Konami code) a night train crosses a lit skyline. Any input dismisses it. */
(function () {
  'use strict';
  const IDLE_MS = 3 * 60 * 1000;
  let cv = null, raf = 0, idleTimer = 0, konami = 0, startedAt = 0;
  const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

  function start() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999;cursor:none;background:#050a1a';
    document.body.appendChild(cv);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = Math.floor(innerWidth * dpr), H = cv.height = Math.floor(innerHeight * dpr);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const w = innerWidth, h = innerHeight, ground = h * 0.78;
    // stars, buildings (fixed seed so it does not flicker)
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const stars = Array.from({ length: 120 }, () => ({ x: rnd() * w, y: rnd() * ground * 0.7, p: rnd() * 6 }));
    const blds = []; for (let x = 0; x < w + 60;) { const bw = 30 + rnd() * 60, bh = 40 + rnd() * h * 0.28; blds.push({ x, bw, bh, win: Math.floor(rnd() * 1e6) }); x += bw + 4; }
    startedAt = performance.now();
    const trainLen = Math.min(w * 0.7, 640), speed = 140;
    function frame(now) {
      const t = (now - startedAt) / 1000;
      const sky = g.createLinearGradient(0, 0, 0, ground); sky.addColorStop(0, '#050a1a'); sky.addColorStop(1, '#1d2b5a');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      stars.forEach((s) => { g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + s.p)); g.fillStyle = '#fff6dc'; g.fillRect(s.x, s.y, 2, 2); });
      g.globalAlpha = 1;
      g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(w * 0.82, h * 0.18, 26, 0, 7); g.fill();
      g.fillStyle = '#0b1230';
      blds.forEach((b) => {
        g.fillRect(b.x, ground - b.bh, b.bw, b.bh);
        for (let wy = ground - b.bh + 8, i = 0; wy < ground - 10; wy += 14, i++) for (let wx = b.x + 6, j = 0; wx < b.x + b.bw - 8; wx += 12, j++) {
          const on = ((b.win >> ((i * 3 + j) % 20)) & 1) && Math.sin(t * 0.3 + i * 7 + j * 3 + b.x) > -0.6;
          if (on) { g.fillStyle = '#ffd36b'; g.fillRect(wx, wy, 6, 8); g.fillStyle = '#0b1230'; }
        }
      });
      g.fillStyle = '#10163a'; g.fillRect(0, ground, w, h - ground);
      g.fillStyle = '#6b6f8a'; g.fillRect(0, ground + 14, w, 3); g.fillRect(0, ground + 26, w, 3);
      for (let x = -((t * speed) % 24); x < w; x += 24) { g.fillStyle = '#2a2f55'; g.fillRect(x, ground + 18, 6, 10); }
      // signal that turns red as the train passes
      const loop = w + trainLen + 200;
      const tx = ((t * speed) % loop) - trainLen;
      const sx = w * 0.62;
      g.fillStyle = '#6b6f8a'; g.fillRect(sx, ground - 70, 3, 70);
      g.fillStyle = '#000'; g.fillRect(sx - 6, ground - 90, 15, 24);
      const danger = tx + trainLen > sx - 60 && tx < sx + 20;
      g.fillStyle = danger ? '#ff4040' : '#40ff70'; g.beginPath(); g.arc(sx + 1.5, ground - 78, 5, 0, 7); g.fill();
      // train: locomotive on the right, coaches behind
      const y = ground - 34, cars = Math.max(2, Math.floor(trainLen / 90));
      for (let i = 0; i < cars; i++) {
        const cx = tx + i * 90;
        g.fillStyle = i === cars - 1 ? '#c0392b' : '#2f5fa8'; g.fillRect(cx, y, 86, 34);
        g.fillStyle = '#1b2a49'; g.fillRect(cx, y + 28, 86, 6);
        for (let k = 0; k < 4; k++) { g.fillStyle = '#ffe9a8'; g.fillRect(cx + 8 + k * 20, y + 7, 12, 10); }
        g.fillStyle = '#10163a'; g.beginPath(); g.arc(cx + 14, y + 36, 5, 0, 7); g.arc(cx + 72, y + 36, 5, 0, 7); g.fill();
      }
      const hx = tx + (cars - 1) * 90 + 86;
      const beam = g.createLinearGradient(hx, 0, hx + 220, 0); beam.addColorStop(0, 'rgba(255,240,170,.55)'); beam.addColorStop(1, 'rgba(255,240,170,0)');
      g.fillStyle = beam; g.beginPath(); g.moveTo(hx, y + 16); g.lineTo(hx + 220, y - 6); g.lineTo(hx + 220, y + 40); g.closePath(); g.fill();
      // steam/smoke puffs
      for (let i = 0; i < 6; i++) { const p = (t * 0.8 + i / 6) % 1; g.fillStyle = 'rgba(220,225,255,' + (0.35 * (1 - p)) + ')'; g.beginPath(); g.arc(tx + (cars - 1) * 90 + 20 - p * 70, y - 6 - p * 50, 5 + p * 14, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,246,220,.55)'; g.font = '14px monospace'; g.fillText('KXKOS  ·  move the mouse to wake up', 20, h - 20);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (!cv) return; cancelAnimationFrame(raf); cv.remove(); cv = null; }
  function arm() { clearTimeout(idleTimer); idleTimer = setTimeout(start, IDLE_MS); }
  function activity(e) {
    if (cv) { if (performance.now() - startedAt > 600) { stop(); } arm(); return; }
    if (e && e.type === 'keydown') {
      konami = (e.key.toLowerCase() === SEQ[konami].toLowerCase()) ? konami + 1 : (e.key === SEQ[0] ? 1 : 0);
      if (konami === SEQ.length) { konami = 0; start(); return; }
    }
    arm();
  }
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'].forEach((ev) => window.addEventListener(ev, activity, { passive: true }));
  arm();
  window.KXKOS = window.KXKOS || {};
  window.KXKOS.screensaver = { start, stop };
})();
