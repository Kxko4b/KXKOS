(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el } = KX;
  const BASE = 'https://kxko4b.github.io/custom-leverframe-diagrams/';

  KX.registerApp({
    id: 'leverframe',
    title: 'Leverframe',
    icon: 'frame',
    width: 960,
    height: 640,
    minWidth: 420,
    minHeight: 320,
    desktop: true,
    order: 45,

    launch(win) {
      const frame = el('iframe', {
        class: 'kx-embed-frame',
        title: 'Custom Leverframe',
        src: BASE
      });
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads');
      frame.setAttribute('referrerpolicy', 'no-referrer');

      const go = (url) => { frame.src = url; };
      const btn = (label, title, fn) => el('button', { type: 'button', class: 'kx-btn', text: label, title, onclick: fn });

      const bar = el('div', { class: 'kx-embed-bar' },
        btn('Reload', 'Reload', () => go(frame.src)),
        btn('Home', 'Leverframe home', () => go(BASE)),
        btn('Status', 'Status page', () => go(BASE + 'status/')),
        el('span', { class: 'kx-embed-spacer' }),
        btn('Open in new tab', 'Open in a normal browser tab', () => window.open(BASE, '_blank', 'noopener'))
      );

      win.body.classList.add('kx-embed-body');
      win.body.appendChild(bar);
      win.body.appendChild(frame);
    }
  });
})();
