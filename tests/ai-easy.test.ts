import { describe, expect, it } from 'vitest';
import { chooseShot as easy } from '../src/ai/easy';
import { chooseShotFor } from '../src/ai';
import { chooseShot as hard } from '../src/ai/huntTarget';
import { shipCells } from '../src/engine/board';
import { randomFleet } from '../src/engine/fleet';
import { makeRng } from '../src/engine/rng';
import { BOARD_SIZE, coordKey, type AIShot, type AIView, type Ship } from '../src/engine/types';
import { playAI, type Chooser } from './helpers';

const view = (shots: AIView['shots']): AIView => ({
  shots,
  sunkShips: shots.flatMap((s) => (s.sunkShip ? [s.sunkShip] : [])),
  boardSize: BOARD_SIZE,
});

/** Shots the chooser needs to sink `fleet` outright (no opponent turns, so it may take all 100). */
const shotsToSink = (choose: Chooser, fleet: readonly Ship[], seed: number): number => {
  const owner = new Map<string, Ship>();
  for (const s of fleet) for (const c of shipCells(s)) owner.set(coordKey(c), s);
  const rng = makeRng(seed);
  let shots: AIShot[] = [];
  let remaining = owner.size;
  while (remaining > 0) {
    const at = choose(view(shots), rng);
    if (shots.some((s) => coordKey(s.coord) === coordKey(at))) throw new Error('repeat');
    const ship = owner.get(coordKey(at));
    if (!ship) {
      shots = [...shots, { coord: at, result: 'miss' }];
      continue;
    }
    remaining--;
    const hit = new Set(shots.map((s) => coordKey(s.coord)));
    hit.add(coordKey(at));
    const sunk = shipCells(ship).every((c) => hit.has(coordKey(c)));
    shots = [
      ...shots,
      sunk ? { coord: at, result: 'sunk', sunkShip: ship.kind } : { coord: at, result: 'hit' },
    ];
  }
  return shots.length;
};

const avgShots = (choose: Chooser, N: number): number => {
  let total = 0;
  for (let seed = 1; seed <= N; seed++) {
    total += shotsToSink(choose, randomFleet(makeRng(1_000_000 + seed)), seed);
  }
  return total / N;
};

describe('Easy AI', () => {
  it('is deterministic for a given view and seed', () => {
    const v = view([{ coord: { row: 3, col: 3 }, result: 'miss' }]);
    expect(easy(v, makeRng(7))).toEqual(easy(v, makeRng(7)));
  });

  it('follows up a hit with an untargeted orthogonal neighbour', () => {
    const v = view([
      { coord: { row: 5, col: 5 }, result: 'hit' },
      { coord: { row: 5, col: 6 }, result: 'miss' },
    ]);
    for (let seed = 1; seed <= 20; seed++) {
      const c = easy(v, makeRng(seed));
      expect([
        { row: 5, col: 4 },
        { row: 4, col: 5 },
        { row: 6, col: 5 },
      ]).toContainEqual(c);
    }
  });

  it('forgets outstanding hits once any ship is sunk (naive stack clearing)', () => {
    const v = view([
      { coord: { row: 0, col: 0 }, result: 'hit' },
      { coord: { row: 9, col: 9 }, result: 'hit' },
      { coord: { row: 9, col: 8 }, result: 'sunk', sunkShip: 'destroyer' },
    ]);
    const around = new Set(['0,1', '1,0']);
    let followedUp = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = easy(v, makeRng(seed));
      if (around.has(`${c.row},${c.col}`)) followedUp++;
    }
    // Random hunt over 97 cells: hitting one of the two neighbours 40/40 times is impossible.
    expect(followedUp).toBeLessThan(40);
  });

  it('never repeats a cell and always sinks the fleet within 100 shots', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const n = shotsToSink(easy, randomFleet(makeRng(seed)), seed);
      expect(n).toBeGreaterThanOrEqual(17);
      expect(n).toBeLessThanOrEqual(100);
    }
  });

  it('plays a full engine game legally (turns, no invalid shots)', () => {
    const { state } = playAI(1, undefined, 100, easy);
    expect(state.phase).toBe('gameover');
  });

  it('needs clearly more shots than Hard on the same fleets', () => {
    const N = 150;
    const easyAvg = avgShots(easy, N);
    const hardAvg = avgShots(hard, N);
    expect(easyAvg).toBeGreaterThan(hardAvg + 10);
    expect(easyAvg).toBeLessThanOrEqual(95);
  });

  it('chooseShotFor dispatches on difficulty', () => {
    const v = view([]);
    expect(chooseShotFor('easy', v, makeRng(3))).toEqual(easy(v, makeRng(3)));
    expect(chooseShotFor('hard', v, makeRng(3))).toEqual(hard(v, makeRng(3)));
  });
});
