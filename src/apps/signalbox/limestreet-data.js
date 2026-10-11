/* Lime Street signal box: DRAFT layout, locking table and bell codes.
 * Generated pattern: every train can use every platform. Positions are estimates in a 2000 x 613 space matching assets/limestreet.png.
 * Everything is data, so corrections are edits to this file. */
(function () {
  'use strict';
  const KX = window.KXKOS;

  // Edge Hill has four tracks and two block sections, each with its own bell and block instruments:
  //   Edge Hill Fast (top two tracks): Down Fast to Lime Street, Up Fast back to Edge Hill
  //   Edge Hill Slow (bottom two tracks): Down Slow to Lime Street, Up Slow back to Edge Hill
  // In each pair the upper track carries trains TO Lime Street and the lower one carries trains FROM it.
  // Every train can use every platform (1 to 9), so the layout is generated from one pattern:
  //   Down Fast enters the platform ladder at the platform 9 end, Down Slow at the platform 1 end.
  //   Each platform p has its own points (50 + p) that must be reverse to run into it; the ladder
  //   segment before it must be normal. Route levers (these are working numbers, rename them as you like):
  //     10 + p  Down Fast to platform p      20 + p  platform p to Up Fast
  //     30 + p  Down Slow to platform p      40 + p  platform p to Up Slow
  const PY = { 9: 171, 8: 205, 7: 250, 6: 307, 5: 361, 4: 394, 3: 456, 2: 494, 1: 540 };   // platform line heights on the picture
  const SIGNALS = {}, POINTS = {}, POINT_TC = {}, ROUTES = {}, JOURNEYS = {};
  const TCS = {
    A1: [222, 291], A2: [345, 291], A3: [475, 291], B1: [240, 327], B2: [340, 327], B3: [475, 327],
    C1: [222, 394], C2: [346, 394], C3: [526, 394], D1: [255, 430], D2: [477, 430], D3: [576, 430]
  };
  for (let p = 1; p <= 9; p++) {
    const y = PY[p];
    TCS['L' + p] = [1300, y]; TCS['P' + p] = [1700, y];
    POINTS[50 + p] = [1380, y]; POINT_TC[50 + p] = 'L' + p;
    SIGNALS[10 + p] = [1470, y - 9]; SIGNALS[30 + p] = [1495, y + 9];
    SIGNALS[20 + p] = [1840, y - 9]; SIGNALS[40 + p] = [1865, y + 9];
    // arrivals
    const tF = ['A1', 'A2', 'A3'], tS = ['C1', 'C2', 'C3'];
    const ptsF = {}, ptsS = {};
    for (let k = 9; k > p; k--) { ptsF[50 + k] = 'N'; tF.push('L' + k); } ptsF[50 + p] = 'R'; tF.push('L' + p, 'P' + p);
    for (let k = 1; k < p; k++) { ptsS[50 + k] = 'N'; tS.push('L' + k); } ptsS[50 + p] = 'R'; tS.push('L' + p, 'P' + p);
    ROUTES[10 + p] = { name: 'Down Fast to Platform ' + p, dir: 'down', pts: ptsF, tcs: tF };
    ROUTES[30 + p] = { name: 'Down Slow to Platform ' + p, dir: 'down', pts: ptsS, tcs: tS };
    // departures
    const uF = { }, uS = { }, tuF = ['L' + p], tuS = ['L' + p];
    uF[50 + p] = 'R'; for (let k = p + 1; k <= 9; k++) { uF[50 + k] = 'N'; tuF.push('L' + k); } tuF.push('B3', 'B2', 'B1');
    uS[50 + p] = 'R'; for (let k = p - 1; k >= 1; k--) { uS[50 + k] = 'N'; tuS.push('L' + k); } tuS.push('D3', 'D2', 'D1');
    ROUTES[20 + p] = { name: 'Platform ' + p + ' to Up Fast (Edge Hill Fast)', dir: 'up', pts: uF, tcs: tuF, exit: 'edgefast' };
    ROUTES[40 + p] = { name: 'Platform ' + p + ' to Up Slow (Edge Hill Slow)', dir: 'up', pts: uS, tcs: tuS, exit: 'edgeslow' };
    // journeys: arrive from either section, leave on either Up line
    [['F', 'edgefast', 'A1', 10], ['S', 'edgeslow', 'C1', 30]].forEach(([c, nb, ap, base]) => {
      [['F', 20], ['S', 40]].forEach(([d, dbase]) => {
        JOURNEYS[c + p + d] = { from: nb, approach: ap, legs: [base + p, { dwell: 45 }, dbase + p], label: 'Platform ' + p + ', leaves on the Up ' + (d === 'F' ? 'Fast' : 'Slow') };
      });
    });
  }
  const SPARE = [];
  const NEIGHBOURS = { edgefast: 'Edge Hill Fast', edgeslow: 'Edge Hill Slow' };
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
  const BELLS = { edgefast: { f: 880, style: 'gong' }, edgeslow: { f: 1175, style: 'ding' } };
  const KEYS = { edgefast: 'F', edgeslow: 'S' };
  const FPL = []; // Westinghouse power frame: points are power-worked, no facing point locks

  KX.registerSignalBox({
    id: 'signalbox-limestreet', title: 'Lime Street Signal Box', image: 'assets/limestreet.png', order: 32,
    data: { SIGNALS, POINTS, POINT_TC, TCS, ROUTES, SPARE, JOURNEYS, NEIGHBOURS, CLASSES, CODES, BELLS, KEYS, FPL, MOVE_SECONDS: 9, W: 2000, H: 613 }
  });
})();
