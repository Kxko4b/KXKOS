/* Lime Street signal box: DRAFT layout, locking table and bell codes.
 * Simplified from the diagram: Edge Hill is two double-track pairs, each with its own bell and block instruments. Positions are estimates in a 2000 x 613 space matching assets/limestreet.png.
 * Everything is data, so corrections are edits to this file. */
(function () {
  'use strict';
  const KX = window.KXKOS;

  // Edge Hill has two double-track pairs, each with its own bell and block instrument pair:
  //   Edge Hill 1: Down Slow (signal 1, trains come TO Lime Street) and the Up line beside it (exit signal 47)
  //   Edge Hill 2: Down Slow (signal 3) and the Up Slow line (exit signal 69)
  const SIGNALS = { 1: [224, 284], 3: [223, 382], 5: [399, 282], 6: [399, 384], 47: [417, 336], 55: [1330, 306], 56: [1330, 341], 63: [1330, 409], 64: [1330, 443], 69: [645, 441] };
  const POINTS = { 7: [610, 300], 8: [742, 331], 11: [900, 380], 14: [766, 305] };
  const POINT_TC = { 7: 'A3', 8: 'B3', 11: 'C3', 14: 'D3' };
  const TCS = {
    A1: [222, 291], A2: [345, 291], A3: [475, 291], B1: [240, 327], B2: [340, 327], B3: [475, 327],
    C1: [222, 394], C2: [346, 394], C3: [526, 394], D1: [255, 430], D2: [477, 430], D3: [576, 430],
    P9: [1650, 250], P8: [1650, 300], P5: [1650, 395], P4: [1650, 440]
  };
  // dir 'down' = towards the platforms (from Edge Hill), 'up' = away to Edge Hill.
  const ROUTES = {
    1: { name: 'Down Slow (Edge Hill 1) to Platform 9', dir: 'down', pts: { 7: 'N' }, tcs: ['A1', 'A2', 'A3', 'P9'] },
    5: { name: 'Down Slow (Edge Hill 1) to Platform 8, over 7 reverse', dir: 'down', pts: { 7: 'R' }, tcs: ['A1', 'A2', 'B3', 'P8'] },
    3: { name: 'Down Slow (Edge Hill 2) to Platform 5', dir: 'down', pts: { 11: 'N' }, tcs: ['C1', 'C2', 'C3', 'P5'] },
    6: { name: 'Down Slow (Edge Hill 2) to Platform 4, over 14 reverse', dir: 'down', pts: { 14: 'R' }, tcs: ['C1', 'C2', 'D3', 'P4'] },
    55: { name: 'Platform 9 to Edge Hill 1 (Up line)', dir: 'up', pts: { 8: 'N' }, tcs: ['B3', 'B2', 'B1'], exit: 'edgehill1' },
    56: { name: 'Platform 8 to Edge Hill 1 (Up line)', dir: 'up', pts: { 8: 'N' }, tcs: ['B3', 'B2', 'B1'], exit: 'edgehill1' },
    63: { name: 'Platform 5 to Edge Hill 2 (Up Slow)', dir: 'up', pts: { 14: 'N' }, tcs: ['D3', 'D2', 'D1'], exit: 'edgehill2' },
    64: { name: 'Platform 4 to Edge Hill 2 (Up Slow)', dir: 'up', pts: { 14: 'N' }, tcs: ['D3', 'D2', 'D1'], exit: 'edgehill2' }
  };
  const SPARE = [];
  const JOURNEYS = {
    A: { from: 'edgehill1', approach: 'A1', legs: [1, { dwell: 45 }, 55], label: 'Platform 9, returns on the Edge Hill 1 Up line' },
    B: { from: 'edgehill1', approach: 'A1', legs: [5, { dwell: 45 }, 56], label: 'Platform 8, returns on the Edge Hill 1 Up line' },
    C: { from: 'edgehill2', approach: 'C1', legs: [3, { dwell: 45 }, 63], label: 'Platform 5, returns on the Edge Hill 2 Up Slow' },
    D: { from: 'edgehill2', approach: 'C1', legs: [6, { dwell: 45 }, 64], label: 'Platform 4, returns on the Edge Hill 2 Up Slow' }
  };
  const NEIGHBOURS = { edgehill1: 'Edge Hill 1', edgehill2: 'Edge Hill 2' };
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
  const BELLS = { edgehill1: { f: 880, style: 'gong' }, edgehill2: { f: 1175, style: 'ding' } };
  const KEYS = { edgehill1: 'E', edgehill2: 'W' };
  const FPL = []; // Westinghouse power frame: points are power-worked, no facing point locks

  KX.registerSignalBox({
    id: 'signalbox-limestreet', title: 'Lime Street Signal Box', image: 'assets/limestreet.png', order: 32,
    data: { SIGNALS, POINTS, POINT_TC, TCS, ROUTES, SPARE, JOURNEYS, NEIGHBOURS, CLASSES, CODES, BELLS, KEYS, FPL, MOVE_SECONDS: 9, W: 2000, H: 613 }
  });
})();
