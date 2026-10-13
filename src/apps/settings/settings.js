/*
 * Settings: wallpaper, accent colour, clock format, and reset options for KXKOS itself.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const { el, ui } = KX;

  const ACCENTS = [
    { name: 'Sky', hex: '#3b8fe0' },
    { name: 'Grass', hex: '#3f9d46' },
    { name: 'Sunset', hex: '#e8743b' },
    { name: 'Plum', hex: '#8e5bd1' },
    { name: 'Rose', hex: '#d9507a' },
    { name: 'Slate', hex: '#4b5d7a' },
  ];

  KX.registerApp({
    id: 'settings',
    title: 'Settings',
    icon: 'settings',
    width: 480,
    height: 520,
    minWidth: 320,
    minHeight: 280,
    singleton: true,
    desktop: true,
    order: 40,

    launch(win) {
      /* ----- wallpaper ----- */

      const wallpaperButtons = KX.wallpapers.map((wp) => {
        const button = el(
          'button',
          { class: 'kx-wp-choice', type: 'button', 'aria-pressed': 'false', onclick: () => KX.settings.set('wallpaper', wp.id) },
          // The preview is the real wallpaper rendered at full size, then scaled down (see CSS).
          el('div', { class: 'kx-wp-thumb' }, el('div', { class: 'kx-wp-inner', dataset: { wallpaper: wp.id } })),
          el('span', { text: wp.name })
        );
        button.dataset.id = wp.id;
        return button;
      });

      /* ----- accent ----- */

      const swatchButtons = ACCENTS.map((accent) => {
        const button = el('button', {
          class: 'kx-swatch',
          type: 'button',
          title: accent.name,
          'aria-label': accent.name,
          'aria-pressed': 'false',
          style: { background: accent.hex },
          onclick: () => KX.settings.set('accent', accent.hex),
        });
        button.dataset.hex = accent.hex;
        return button;
      });
      const colorInput = el('input', { type: 'color', 'aria-label': 'Custom accent colour', value: KX.settings.get('accent') });
      colorInput.addEventListener('input', () => KX.settings.set('accent', colorInput.value));

      /* ----- clock ----- */

      const clockInput = el('input', { type: 'checkbox', checked: KX.settings.get('clock24') });
      clockInput.addEventListener('change', () => KX.settings.set('clock24', clockInput.checked));

      /* ----- sound ----- */

      const soundInput = el('input', { type: 'checkbox', checked: KX.settings.get('soundEnabled') });
      soundInput.addEventListener('change', () => KX.settings.set('soundEnabled', soundInput.checked));

      /* ----- motion ----- */

      const motionInput = el('input', { type: 'checkbox', checked: KX.settings.get('reduceMotion') });
      motionInput.addEventListener('change', () => KX.settings.set('reduceMotion', motionInput.checked));

      /* ----- desktop icons ----- */

      const iconSizeSel = el(
        'select',
        { class: 'kx-set-select', onchange: () => KX.settings.set('iconSize', iconSizeSel.value) },
        ...KX.iconSizes.map((s) => el('option', { value: s, text: s[0].toUpperCase() + s.slice(1) }))
      );

      /* ----- screensaver ----- */

      const saverInput = el('input', { type: 'checkbox', checked: KX.settings.get('screensaverEnabled') });
      saverInput.addEventListener('change', () => KX.settings.set('screensaverEnabled', saverInput.checked));
      const saverMinutes = el('input', {
        type: 'number', min: '1', max: '30', style: 'width:3.5em',
        value: String(KX.settings.get('screensaverMinutes')),
      });
      saverMinutes.addEventListener('change', () => KX.settings.set('screensaverMinutes', +saverMinutes.value));

      /* ----- taskbar ----- */

      const taskbarSel = el(
        'select',
        { class: 'kx-set-select', onchange: () => KX.settings.set('taskbarPosition', taskbarSel.value) },
        el('option', { value: 'bottom', text: 'Bottom' }),
        el('option', { value: 'top', text: 'Top' })
      );

      /* ----- sync UI with the settings store ----- */

      function sync() {
        const wallpaper = KX.settings.get('wallpaper');
        const accent = KX.settings.get('accent');
        wallpaperButtons.forEach((b) => {
          const on = b.dataset.id === wallpaper;
          b.classList.toggle('selected', on);
          b.setAttribute('aria-pressed', String(on));
        });
        swatchButtons.forEach((b) => {
          const on = b.dataset.hex === accent;
          b.classList.toggle('selected', on);
          b.setAttribute('aria-pressed', String(on));
        });
        if (colorInput.value !== accent) colorInput.value = accent;
        clockInput.checked = KX.settings.get('clock24');
        soundInput.checked = KX.settings.get('soundEnabled');
        motionInput.checked = KX.settings.get('reduceMotion');
        iconSizeSel.value = KX.settings.get('iconSize');
        saverInput.checked = KX.settings.get('screensaverEnabled');
        saverMinutes.value = String(KX.settings.get('screensaverMinutes'));
        saverMinutes.disabled = !saverInput.checked;
        taskbarSel.value = KX.settings.get('taskbarPosition');
      }
      const unsubscribe = KX.on('settings:changed', sync);
      win.onClose = unsubscribe;

      /* ----- reset ----- */

      async function resetSettings() {
        const ok = await ui.confirm({
          title: 'Reset appearance',
          message: 'Restore the default wallpaper, accent colour and clock format?',
          okText: 'Reset',
        });
        if (ok) KX.settings.reset();
      }

      async function resetFiles() {
        const ok = await ui.confirm({
          title: 'Reset files',
          message: 'This deletes everything in the KXKOS virtual filesystem and restores the default folders.\nYour real computer is not affected.',
          okText: 'Delete everything',
          danger: true,
        });
        if (ok) KX.fs.reset();
      }

      const section = (title, ...children) =>
        el('section', { class: 'kx-set-section' }, el('h2', { class: 'kx-set-title', text: title }), ...children);

      win.body.appendChild(
        el(
          'div',
          { class: 'kx-settings' },
          section('Wallpaper', el('div', { class: 'kx-wp-grid' }, wallpaperButtons)),
          section(
            'Accent colour',
            el('div', { class: 'kx-swatches' }, swatchButtons, colorInput),
            el('p', { class: 'kx-set-note', text: 'Used for window titles, buttons and highlights.' })
          ),
          section('Clock', el('div', { class: 'kx-set-row' }, el('label', null, clockInput, '24-hour clock'))),
          section(
            'Sound and motion',
            el('div', { class: 'kx-set-row' }, el('label', null, soundInput, 'Enable sound (signal boxes, piano)')),
            el('div', { class: 'kx-set-row' }, el('label', null, motionInput, 'Reduce motion and animations'))
          ),
          section(
            'Desktop icons',
            el('div', { class: 'kx-set-row' }, el('label', null, 'Icon size ', iconSizeSel))
          ),
          section(
            'Taskbar',
            el('div', { class: 'kx-set-row' }, el('label', null, 'Position ', taskbarSel))
          ),
          section(
            'Screensaver',
            el('div', { class: 'kx-set-row' }, el('label', null, saverInput, 'Enable screensaver when idle')),
            el('div', { class: 'kx-set-row' }, el('label', null, 'Idle time (minutes) ', saverMinutes)),
            el('p', { class: 'kx-set-note', text: 'A night skyline with a passing train. Any key, click or the Konami code (↑↑↓↓←→←→BA) also shows it.' })
          ),
          section(
            'System',
            el(
              'div',
              { class: 'kx-set-row' },
              el('button', { class: 'kx-btn', type: 'button', text: 'Reset appearance', onclick: resetSettings }),
              el('button', { class: 'kx-btn danger', type: 'button', text: 'Reset files…', onclick: resetFiles })
            ),
            el('p', { class: 'kx-set-note', text: 'Settings and files are stored in this browser only.' })
          ),
          section(
            'About',
            el('p', { class: 'kx-dialog-msg', text: 'KXKOS ' + KX.version + '\nA web-based retro desktop. Not a real operating system.' })
          )
        )
      );
      sync();
    },
  });
})();
