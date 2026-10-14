/*
 * KXKOS icons: small chunky SVGs on a 32x32 grid, drawn in the KXKOS palette.
 * KXKOS.icon(name, size) returns SVG markup (trusted, built-in) for use with el({ html }).
 */
(function () {
  'use strict';

  const KX = window.KXKOS;
  const INK = '#1b2a49';

  KX.icons = {
    notepad:
      '<rect x="6" y="4" width="20" height="25" rx="2" fill="#fff6c9" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="6" y="4" width="20" height="6" rx="2" fill="#e8743b" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M10 15h12M10 19h12M10 23h8" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>',

    calculator:
      '<rect x="6" y="3" width="20" height="26" rx="3" fill="#c9d3e6" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="9" y="6" width="14" height="6" fill="#8fe39a" stroke="' + INK + '" stroke-width="1.5"/>' +
      '<g fill="' + INK + '">' +
      '<rect x="9" y="15" width="4" height="3"/><rect x="14" y="15" width="4" height="3"/><rect x="19" y="15" width="4" height="3"/>' +
      '<rect x="9" y="20" width="4" height="3"/><rect x="14" y="20" width="4" height="3"/><rect x="19" y="20" width="4" height="3"/>' +
      '<rect x="9" y="25" width="4" height="2"/><rect x="14" y="25" width="4" height="2"/><rect x="19" y="25" width="4" height="2"/>' +
      '</g>',

    settings:
      '<path d="M16 2l2.6 3.2 3.9-1.3 1.3 3.9 4 .9-.9 4 3.2 2.6-3.2 2.6.9 4-4 .9-1.3 3.9-3.9-1.3L16 30l-2.6-3.2-3.9 1.3-1.3-3.9-4-.9.9-4L2 16l3.2-2.6-.9-4 4-.9 1.3-3.9 3.9 1.3z"' +
      ' fill="#9aa8c4" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="16" cy="16" r="5.5" fill="#f4efe0" stroke="' + INK + '" stroke-width="2"/>',

    terminal:
      '<rect x="3" y="6" width="26" height="20" rx="2" fill="#0f1a2e" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M8 13l5 3-5 3" fill="none" stroke="#7cfc8a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M16 20h7" stroke="#7cfc8a" stroke-width="2.2" stroke-linecap="round"/>',

    folder:
      '<path d="M3 9a2 2 0 0 1 2-2h7l3 3h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#ffd45e" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M3 14h26" stroke="' + INK + '" stroke-width="2"/>',

    file:
      '<path d="M8 3h11l6 6v20H8z" fill="#ffffff" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M19 3v6h6" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M11 15h11M11 19h11M11 23h7" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"/>',

    search:
      '<circle cx="13.5" cy="13.5" r="8.5" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<circle cx="10.5" cy="10.5" r="2.6" fill="#fff" opacity=".8"/>' +
      '<path d="M19.5 19.5l7.5 7.5" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>',

    mine:
      '<path d="M16 3v6M16 23v6M3 16h6M23 16h6M7 7l4 4M21 21l4 4M25 7l-4 4M11 21l-4 4" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle cx="16" cy="16" r="8" fill="#2a3a5c" stroke="' + INK + '" stroke-width="2"/>' +
      '<circle cx="13" cy="13" r="2.2" fill="#ffffff"/>',

    frame:
      '<rect x="4" y="5" width="24" height="22" rx="2" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M8 22l5-7 4 4 3-5 4 8z" fill="#7bc96f" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>',

    briefing:
      '<rect x="6" y="3" width="20" height="26" rx="2" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M10 10h12M10 15h12M10 20h7" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/>',

    paint:
      '<path d="M16 4C8 4 4 10 4 16c0 7 5 12 11 12 3 0 3-3 1-5-2-3 0-5 3-5h5c3 0 4-2 4-4 0-6-5-10-12-10z" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<circle cx="10" cy="14" r="2" fill="#e5484d"/><circle cx="15" cy="9" r="2" fill="#f7d84a"/><circle cx="21" cy="11" r="2" fill="#2f6fdf"/>',

    snake:
      '<path d="M6 24h14a4 4 0 0 0 0-8H12a4 4 0 0 1 0-8h14" fill="none" stroke="#2f6f3a" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M6 24h14a4 4 0 0 0 0-8H12a4 4 0 0 1 0-8h14" fill="none" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="1 7"/>',

    piano:
      '<rect x="3" y="7" width="26" height="18" rx="2" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M10 7v18M16 7v18M22 7v18" stroke="' + INK + '" stroke-width="2"/>' +
      '<rect x="8" y="7" width="4" height="10" fill="' + INK + '"/><rect x="14" y="7" width="4" height="10" fill="' + INK + '"/><rect x="20" y="7" width="4" height="10" fill="' + INK + '"/>',
    tiles:
      '<rect x="3" y="3" width="26" height="26" rx="3" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<rect x="7" y="7" width="8" height="8" fill="#ffc772"/><rect x="17" y="7" width="8" height="8" fill="#ff7a5a"/><rect x="7" y="17" width="8" height="8" fill="#8fd6a5"/><rect x="17" y="17" width="8" height="8" fill="#4aa3c9"/>',
    calendar:
      '<rect x="3" y="6" width="26" height="23" rx="3" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/><rect x="3" y="6" width="26" height="7" fill="#c0392b" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M10 3v6M22 3v6" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round"/><path d="M9 19h4M15 19h4M9 24h4M15 24h4M21 19h2" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>',
    clock:
      '<circle cx="16" cy="16" r="12" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M16 8v8l5 3" fill="none" stroke="' + INK + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',

    notes:
      '<rect x="7" y="4" width="18" height="24" rx="2" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M11 11h10M11 16h10M11 21h6" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="4" r="2" fill="#e5484d"/>',

    inbox:
      '<path d="M4 18l4-12h16l4 12v8H4z" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<path d="M4 18h7l2 3h6l2-3h7" fill="none" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>',

    signal:
      '<rect x="14" y="12" width="4" height="18" fill="' + INK + '"/><rect x="9" y="3" width="14" height="12" rx="2" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<circle cx="16" cy="9" r="3" fill="#e5484d"/>',

    todo:
      '<rect x="5" y="4" width="22" height="24" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<rect x="9" y="9" width="5" height="5" fill="#8fe39a" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M10 11.5l1.4 1.4 2.2-2.6" fill="none" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M17 11.5h7" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>' +
      '<rect x="9" y="18" width="5" height="5" fill="none" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M17 20.5h7" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>',

    ttt:
      '<rect x="4" y="4" width="24" height="24" fill="#fff6dc" stroke="' + INK + '" stroke-width="2.5"/>' +
      '<path d="M12 5v22M20 5v22M5 12h22M5 20h22" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M7.5 9.5l5 5m0-5l-5 5" stroke="#e5484d" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle cx="24" cy="16" r="3.4" fill="none" stroke="#2f6fd6" stroke-width="2.4"/>' +
      '<path d="M7.5 25l5-5m0 5l-5-5" stroke="#e5484d" stroke-width="2.4" stroke-linecap="round"/>',
  };

  /** SVG markup for a named icon at the given pixel size (default 32). */
  KX.icon = function icon(name, size) {
    const inner = KX.icons[name];
    if (!inner) return '';
    const px = size || 32;
    return (
      '<svg class="kx-icon" viewBox="0 0 32 32" width="' + px + '" height="' + px +
      '" aria-hidden="true" focusable="false">' + inner + '</svg>'
    );
  };
})();

