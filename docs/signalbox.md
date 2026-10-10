# Percstown signal box

App id `signalbox` (desktop icon "Percstown Signal Box"). Diagram: `assets/percstown.png` (made by Hale / Kokosnuss).

## How to play
- Click a lever (bottom row) or a signal on the diagram to pull/restore it. Refusals are explained in the message bar.
- Neighbours (Riceville, Samthon, Bighton Jn) ring you on the block bell. Reply with the same beats to accept.
  Keys R / S / B (or the Bell buttons) tap the bell to each neighbour. Pause about a second between groups: `3-1` = three beats, pause, one beat.
- Incoming train: neighbour rings `1`, you answer `1`, it rings the class code, you repeat it, it rings `2` (entering section) and the train appears as a lit track circuit.
- Outgoing train: ring `1`, then the class code of your train, wait for LINE CLEAR, clear the exit signal, ring `2` when it has gone.
- Send `2-1` back to the box a train came from once it has passed your first signal.
- Trains are never drawn, only track-circuit lights. A signal returns to danger by itself when the train passes it, but the lever has to be put back by hand before points can move.

## Where things live (all data, in `src/apps/signalbox/signalbox-data.js`)
- `SIGNALS`, `POINTS`, `TCS`: positions on the diagram (2000 x 443 space).
- `ROUTES`: for each signal the points it needs, the track circuits it covers, direction and exit neighbour. Locking is derived from this:
  points must be in position and not locked by another signal, circuits must be free, opposing or conflicting routes lock each other, exit signals need the line clear from the next box.
- `JOURNEYS`: the trains that run. `CLASSES` / `CODES`: bell codes (editable).

## Status
The locking table is a DRAFT worked out from the picture. Signals without a route (1, 9, 25, 26, 29, 34, 37, 38, 40) move freely and are not interlocked yet.

## Update: instruments, FPL, pacing
- Each neighbour has its own bell sound (Riceville ding, Samthon deep gong, Bighton two-tone).
- Block instruments (BI): two dials per neighbour. "From X" is yours: press LINE CLEAR after accepting a train on the bell; press LINE BLOCKED after ringing 2-1. "To X": the other box gives LINE CLEAR; press TRAIN ON LINE when your train has gone (after ringing 2).
- Trains are slow: after the neighbour rings 2 the train takes 55-80 s to reach your approach circuit, then about 9 s per track circuit.
- FPL: every point in `FPL` has an FPL button under its lever. Apply it after moving the points; a signal will not clear without it, and points cannot move while it is applied.
- A box is registered with `KX.registerSignalBox(...)`; Percstown is the first (`signalbox-data.js`).
