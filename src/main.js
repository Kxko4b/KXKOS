/*
 * KXKOS boot: runs after every module and app has registered itself.
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  KX.desktop.init();
  KX.taskbar.init();
  console.info('KXKOS ' + KX.version + ' booted with apps: ' + Object.keys(KX.apps).join(', '));
})();
