/* Beethoven: Sonatina in G major, Anh. 5 No. 1
 * Simplified practice arrangements for KXKOS Piano.
 * These are beginner-friendly sketches, not exact transcriptions.
 *
 * Notation:
 * C4 = middle C
 * q = quarter note (1 beat)
 * h = half note (2 beats)
 * w = whole note (4 beats)
 * e = eighth note (0.5 beats)
 * R = rest
 */
(function () {
  'use strict';

  window.KXKOS.pianoSongs = [
    {
      id: 'sonatina',
      title: 'Beethoven: Sonatina in G — Moderato (Easy)',
      bpm: 100,
      tracks: [
        // Right hand — simplified melody
        'G4:q B4:q D5:q B4:q | A4:q C5:q D5:h | ' +
        'G4:q B4:q E5:q D5:q | C5:q A4:q G4:h | ' +
        'B4:q D5:q G5:q D5:q | C5:q A4:q F#4:h | ' +
        'G4:q A4:q B4:q C5:q | G4:w',

        // Left hand — simple accompaniment
        'G3:h D4:h | D3:h A3:h | C3:h G3:h | D3:h A3:h | ' +
        'G3:h D4:h | D3:h A3:h | G3:h D4:h | G2:w'
      ]
    },

    {
      id: 'romanze',
      title: 'Beethoven: Sonatina in G — Romanze (Easy)',
      bpm: 86,
      tracks: [
        // Right hand — gentle, simplified melody
        'D5:q B4:q A4:q G4:q | A4:q B4:q D5:h | ' +
        'E5:q D5:q C5:q B4:q | A4:h G4:h | ' +
        'B4:q D5:q G5:h | F#5:q E5:q D5:h | ' +
        'C5:q B4:q A4:q F#4:q | G4:w',

        // Left hand — slow accompaniment
        'G3:h D4:h | D3:h A3:h | C3:h G3:h | G3:h D4:h | ' +
        'G3:h D4:h | D3:h A3:h | D3:h A3:h | G2:w'
      ]
    }
  ];
})();
