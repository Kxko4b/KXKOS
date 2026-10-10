/* Lime Street signal box: DRAFT layout, locking table and bell codes.
 * Simplified from the diagram: four approach lines (Down Slow, Down Fast, Up Fast, Up Slow) run through the throat to
 * platforms 9, 8, 5 and 4. Positions are estimates in a 2000 x 613 space matching assets/limestreet.png.
 * Everything is data, so corrections are edits to this file. */
(function () {
  'use strict';
  const KX = window.KXKOS;

  const SIGNALS = { 1: [330, 280], 3: [330, 345], 5: [330, 383], 6: [330, 447], 12: [1330, 306], 56: [1330, 341], 62: [1330, 409], 64: [1330, 443] };
  const POINTS = { 7: [850, 310], 8: [1000, 344], 11: [1150, 378], 14: [1250, 412] };
  const POINT_TC = { 7: 'A2', 8: 'B3', 11: 'C3', 14: 'D3' };
  const TCS = {
    A1: [300, 292], A2: [700, 292], A3: [1100, 292], B1: [300, 327], B2: [700, 327], B3: [1100, 327],
    C1: [300, 395], C2: [700, 395], C3: [1100, 395], D1: [300, 429], D2: [700, 429], D3: [1100, 429],
    P9: [1650, 250], P8: [1650, 300], P5: [1650, 395], P4: [1650, 440]
  };
  const ROUTES = {
    1: { name: 'Down Slow to Platform 9', dir: 'down', pts: { 7: 'N' }, tcs: ['A1', 'A2', 'A3', 'P9'] },
    3: { name: 'Down Fast to Platform 8', dir: 'down', pts: { 8: 'N' }, tcs: ['B1', 'B2', 'B3', 'P8'] },
    5: { name: 'Up Fast road to Platform 5', dir: 'down', pts: { 11: 'N' }, tcs: ['C1', 'C2', 'C3', 'P5'] },
    6: { name: 'Up Slow road to Platform 4', dir: 'down', pts: { 14: 'N' }, tcs: ['D1', 'D2', 'D3', 'P4'] },
    12: { name: 'Platform 9 to Edge Hill', dir: 'up', pts: { 7: 'N' }, tcs: ['A3', 'A2', 'A1'], exit: 'edgehill' },
    56: { name: 'Platform 8 to Edge Hill', dir: 'up', pts: { 8: 'N' }, tcs: ['B3', 'B2', 'B1'], exit: 'edgehill' },
    62: { name: 'Platform 5 to Edge Hill', dir: 'up', pts: { 11: 'N' }, tcs: ['C3', 'C2', 'C1'], exit: 'edgehill' },
    64: { name: 'Platform 4 to Edge Hill', dir: 'up', pts: { 14: 'N' }, tcs: ['D3', 'D2', 'D1'], exit: 'edgehill' }
  };
  const SPARE = [];
  const JOURNEYS = {
    A: { from: 'edgehill', approach: 'A1', legs: [1, { dwell: 45 }, 12], label: 'Platform 9, returns to Edge Hill' },
    B: { from: 'edgehill', approach: 'B1', legs: [3, { dwell: 45 }, 56], label: 'Platform 8, returns to Edge Hill' },
    C: { from: 'edgehill', approach: 'C1', legs: [5, { dwell: 45 }, 62], label: 'Platform 5, returns to Edge Hill' },
    D: { from: 'edgehill', approach: 'D1', legs: [6, { dwell: 45 }, 64], label: 'Platform 4, returns to Edge Hill' }
  };
  const NEIGHBOURS = { edgehill: 'Edge Hill' };
  const CLASSES = {
    express: { name: 'Express passenger', code: '4' },
    ordinary: { name: 'Ordinary passenger', code: '3-1' },
    ecs: { name: 'Empty coaching stock', code: '2-2-1' },
    light: { name: 'Light engine', code: '4-1' }
  };
  const CODES = {
    '1': 'Call attention', '2': 'Train entering section', '2-1': 'Train out of section', '3-5': 'Cancel',
    '6': 'Obstruction danger', '7': 'Stop and examine train', '5-5': 'Train divided', '16': 'Testing block instruments and bell'
  };
  Object.keys(CLASSES).forEach((k) => { CODES[CLASSES[k].code] = 'Is line clear for ' + CLASSES[k].name + '?'; });
  const BELLS = { edgehill: { f: 880, style: 'gong' } };
  const KEYS = { edgehill: 'E' };
  const FPL = [7, 8, 11, 14];

  KX.registerSignalBox({
    id: 'signalbox-limestreet', title: 'Lime Street Signal Box', image: 'assets/limestreet.png', order: 32,
    data: { SIGNALS, POINTS, POINT_TC, TCS, ROUTES, SPARE, JOURNEYS, NEIGHBOURS, CLASSES, CODES, BELLS, KEYS, FPL, MOVE_SECONDS: 9, W: 2000, H: 613 }
  });
})();
