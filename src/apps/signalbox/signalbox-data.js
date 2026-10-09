/* Percstown signal box: layout, locking table and bell codes.
 * DRAFT interlocking, worked out from the diagram. Everything here is data, so corrections are edits to this file.
 * Coordinates are in a 2000 x 443 space matching assets/percstown.png. */
(function () {
  'use strict';
  const KX = window.KXKOS;

  const SIGNALS = {
    1: [255, 327], 2: [575, 334], 3: [1325, 317], 4: [1590, 315], 5: [575, 317], 6: [1372, 224], 7: [575, 350],
    8: [1370, 143], 9: [545, 274], 25: [957, 157], 26: [956, 244], 29: [1292, 352], 33: [373, 240], 34: [915, 341],
    35: [921, 243], 36: [1454, 242], 37: [1745, 233], 38: [952, 200], 39: [1503, 144], 40: [951, 174], 41: [1503, 128]
  };

  const POINTS = {
    10: [738, 292], 11: [724, 292], 12: [756, 292], 13: [768, 292], 15: [802, 316], 16: [812, 316], 17: [534, 218],
    18: [711, 243], 19: [698, 243], 20: [895, 157], 21: [910, 153], 23: [738, 241], 24: [800, 272],
    27: [1527, 168], 28: [1537, 164], 30: [1347, 356], 31: [1437, 342], 32: [1475, 383]
  };
  // Track circuit a point lies in (a point cannot move while that circuit is occupied).
  const POINT_TC = {
    10: 'AB', 11: 'AB', 12: 'AB', 13: 'AB', 15: 'AC', 16: 'AC', 17: 'FA', 18: 'FB', 19: 'FB', 20: 'CD', 21: 'CD',
    23: 'CD', 24: 'BC', 27: 'CA', 28: 'CA', 30: 'EB', 31: 'EB', 32: 'GA'
  };

  const TCS = {
    AA: [395, 303], AB: [630, 303], AC: [1108, 303], EA: [1108, 340], AD: [1465, 303], AE: [1645, 303],
    BF: [318, 254], BE: [504, 254], BD: [573, 254], BC: [850, 254], BB: [1106, 254], BA: [1580, 254],
    CC: [1152, 160], CB: [1445, 160], CA: [1578, 148], CD: [845, 213], DA: [1155, 213],
    FA: [471, 207], FB: [713, 200], EB: [1535, 340], GA: [1533, 372]
  };

  // A route is what a signal lever, once pulled, sets up. dir: 'up' (towards Samthon/Bighton) or 'down'.
  const ROUTES = {
    2: { name: 'Up Main', dir: 'up', pts: { 10: 'N', 11: 'N', 15: 'N', 16: 'N' }, tcs: ['AB', 'AC'] },
    3: { name: 'Up Main, through the platforms', dir: 'up', pts: {}, tcs: ['AD'] },
    4: { name: 'Up Main to Samthon', dir: 'up', pts: {}, tcs: ['AE'], exit: 'samthon' },
    5: { name: 'Up Main to Platform 1', dir: 'up', pts: { 15: 'R', 16: 'R' }, tcs: ['AB', 'EA'] },
    7: { name: 'Crossover to Down Main', dir: 'up', pts: { 10: 'R', 11: 'R' }, tcs: ['AB', 'BD'] },
    36: { name: 'Down Main from Samthon', dir: 'down', pts: {}, tcs: ['BB'] },
    35: { name: 'Down Main through the station', dir: 'down', pts: { 10: 'N', 11: 'N', 24: 'N' }, tcs: ['BC', 'BD', 'BE'] },
    33: { name: 'Down Main to Riceville', dir: 'down', pts: {}, tcs: ['BF'], exit: 'riceville' },
    41: { name: 'Branch to Platform 5', dir: 'down', pts: { 27: 'N', 28: 'N' }, tcs: ['CB', 'CC'] },
    39: { name: 'Branch to Platform 4', dir: 'down', pts: { 27: 'R', 28: 'R' }, tcs: ['DA'] },
    8: { name: 'Platform 5 to Bighton', dir: 'up', pts: { 27: 'N', 28: 'N' }, tcs: ['CB', 'CA'], exit: 'bighton' },
    6: { name: 'Platform 4 to Bighton', dir: 'up', pts: { 27: 'R', 28: 'R' }, tcs: ['CA'], exit: 'bighton' }
  };

  const SPARE = [14, 22];

  // Train journeys. A leg is a signal to clear; 'dwell' pauses the train (seconds).
  const JOURNEYS = {
    A: { from: 'riceville', approach: 'AA', legs: [2, 3, 4], label: 'Up Main to Samthon' },
    B: { from: 'samthon', approach: 'BA', legs: [36, 35, 33], label: 'Down Main to Riceville' },
    C: { from: 'bighton', approach: 'CA', legs: [41, { dwell: 15 }, 8], label: 'Platform 5, reverses to Bighton' },
    D: { from: 'bighton', approach: 'CA', legs: [39, { dwell: 15 }, 6], label: 'Platform 4, reverses to Bighton' }
  };

  const NEIGHBOURS = { riceville: 'Riceville', samthon: 'Samthon', bighton: 'Bighton Jn' };

  // Train classes and their "Is line clear for ...?" codes (editable).
  const CLASSES = {
    express: { name: 'Express passenger', code: '4' },
    ordinary: { name: 'Ordinary passenger', code: '3-1' },
    ecs: { name: 'Empty coaching stock', code: '2-2-1' },
    goods: { name: 'Goods', code: '3-2' },
    light: { name: 'Light engine', code: '4-1' }
  };

  // Everything else the bot understands. Used when you ring something that is not a class code.
  const CODES = {
    '1': 'Call attention',
    '2': 'Train entering section',
    '2-1': 'Train out of section',
    '3-5': 'Cancel',
    '6': 'Obstruction danger',
    '7': 'Stop and examine train',
    '5-5': 'Train divided',
    '2-5-5': 'Train running away',
    '5-5-5': 'Opening signal box',
    '7-5-5': 'Closing signal box',
    '16': 'Testing block instruments and bell'
  };
  Object.keys(CLASSES).forEach((k) => { CODES[CLASSES[k].code] = 'Is line clear for ' + CLASSES[k].name + '?'; });

  KX.signalboxData = { SIGNALS, POINTS, POINT_TC, TCS, ROUTES, SPARE, JOURNEYS, NEIGHBOURS, CLASSES, CODES, W: 2000, H: 443 };
})();
