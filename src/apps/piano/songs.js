/* Songs for the Piano app. Both pieces are public domain (Beethoven d. 1827, Saint-Saëns d. 1921).
 * These are simplified sketches typed in from memory, NOT checked against a score: edit freely.
 * Notation: Note+octave (C4, F#4, Bb3), then :duration (w=4 h=2 q=1 e=.5 s=.25 beats, a trailing . adds half). R = rest.
 * Each song has bpm and one or more tracks that start together (right hand, left hand). */
(function () {
  'use strict';
  window.KXKOS.pianoSongs = [
    {
      id: 'sonatina', title: 'Beethoven: Sonatina in G (sketch)', bpm: 108,
      tracks: [
        // right hand
        'D5:q G5:q. F#5:e G5:q B5:q | A5:q. G5:e F#5:q D5:q | E5:q C6:q. B5:e A5:e G5:e | A5:q F#5:q D5:h | ' +
        'D5:q G5:q. F#5:e G5:q B5:q | A5:q. G5:e F#5:q D5:q | E5:q C6:q. B5:e A5:e G5:e | G5:w',
        // left hand
        'G3:h D4:h | D3:h D4:h | C3:h C4:h | D3:h D4:h | G3:h D4:h | D3:h D4:h | C3:h D3:h | G2:w'
      ]
    },
    {
      id: 'danse', title: 'Saint-Saëns: Danse macabre, easy (sketch)', bpm: 96,
      tracks: [
        // midnight strikes twelve, the fiddle tunes its tritone, then a simple waltz-like tune in G minor
        'D5:q D5:q D5:q D5:q D5:q D5:q D5:q D5:q D5:q D5:q D5:q D5:q | A4:h Eb5:h A4:h Eb5:h | ' +
        'G4:q Bb4:q D5:q | G5:q.. F5:e D5:q | Eb5:q D5:q C5:q | D5:h R:q | ' +
        'G4:q Bb4:q D5:q | G5:q.. F5:e D5:q | Eb5:q C5:q A4:q | G4:h R:q',
        'R:12 | G3:w G3:w | G3:q D4:q D4:q | G3:q D4:q D4:q | C3:q G3:q G3:q | D3:q A3:q A3:q | G3:q D4:q D4:q | G3:q D4:q D4:q | C3:q G3:q G3:q | G2:h R:q'
      ]
    }
  ];
})();
