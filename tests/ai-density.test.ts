import { describe, expect, it } from 'vitest';
import { chooseShot, densityMap, normalizedDensity } from '../src/ai/density';
import { randomFleet } from '../src/engine/fleet';
import { makeRng } from '../src/engine/rng';
import { coordKey, type AIView } from '../src/engine/types';
import { playAI } from './helpers';

const view = (shots: AIView['shots'] = []): AIView => ({
  shots,
  sunkShips: shots.flatMap((s) => (s.sunkShip ? [s.sunkShip] : [])),
  boardSize: 10,
});

const at = (map: readonly number[], row: number, col: number) => map[row * 10 + col]!;

describe('densityMap', () => {
  it('on an empty board is symmetric and hottest in the centre', () => {
    const map = densityMap(view());
    expect(at(map, 0, 0)).toBeLessThan(at(map, 4, 4));
    expect(at(map, 0, 0)).toBe(at(map, 9, 9));
    expect(at(map, 4, 4)).toBe(at(map, 5, 5));
    expect(at(map, 0, 0)).toBe(5 * 2); // one placement per ship per axis
  });

  it('is 0 on fired cells and reduced next to a miss', () => {
    const map = densityMap(view([{ coord: { row: 4, col: 4 }, result: 'miss' }]));
    expect(at(map, 4, 4)).toBe(0);
    expect(at(map, 4, 5)).toBeLessThan(at(densityMap(view()), 4, 5));
  });

  it('after a lone hit, only its row and column are hot and the four neighbours hottest', () => {
    const map = densityMap(view([{ coord: { row: 4, col: 4 }, result: 'hit' }]));
    map.forEach((v, i) => {
      const row = Math.floor(i / 10);
      const col = i % 10;
      if (row !== 4 && col !== 4) expect(v).toBe(0);
    });
    const max = Math.max(...map);
    for (const [r, c] of [
      [3, 4],
      [5, 4],
      [4, 3],
      [4, 5],
    ] as const) {
      expect(at(map, r, c)).toBe(max);
    }
    expect(at(map, 4, 6)).toBeLessThan(max);
    expect(at(map, 4, 4)).toBe(0);
  });

  it('after two collinear hits, the line ends outweigh the sides', () => {
    const map = densityMap(
      view([
        { coord: { row: 4, col: 4 }, result: 'hit' },
        { coord: { row: 4, col: 5 }, result: 'hit' },
      ]),
    );
    expect(at(map, 4, 3)).toBeGreaterThan(at(map, 3, 4));
    expect(at(map, 4, 6)).toBeGreaterThan(at(map, 5, 5));
  });

  it('treats a sunk ship as solid: nothing can lie across it', () => {
    const map = densityMap(
      view([
        { coord: { row: 0, col: 0 }, result: 'hit' },
        { coord: { row: 0, col: 1 }, result: 'sunk', sunkShip: 'destroyer' },
      ]),
    );
    // No unresolved hits: back in hunt mode, and (0,2) lost every horizontal placement crossing (0,1).
    expect(at(map, 0, 2)).toBeLessThan(at(densityMap(view()), 0, 2));
    expect(map.some((v) => v > 0)).toBe(true);
  });

  it('recovers from a wrong sunk attribution (fuzz seed 874 from the Hunt/Target suite)', () => {
    // Destroyer at (3,7)(3,8) touching a Battleship at (4,6)–(4,9). Attribution wrongly resolves
    // (4,8) as the Destroyer's, boxing in the live hits. The map must still reach (4,9).
    const v: AIView = {
      boardSize: 10,
      sunkShips: ['destroyer'],
      shots: [
        { coord: { row: 3, col: 7 }, result: 'hit' },
        { coord: { row: 3, col: 6 }, result: 'miss' },
        { coord: { row: 2, col: 7 }, result: 'miss' },
        { coord: { row: 4, col: 7 }, result: 'hit' },
        { coord: { row: 5, col: 7 }, result: 'miss' },
        { coord: { row: 4, col: 8 }, result: 'hit' },
        { coord: { row: 3, col: 8 }, result: 'sunk', sunkShip: 'destroyer' },
        { coord: { row: 4, col: 6 }, result: 'hit' },
        { coord: { row: 5, col: 6 }, result: 'miss' },
        { coord: { row: 4, col: 5 }, result: 'miss' },
      ],
    };
    const map = densityMap(v);
    expect(at(map, 4, 9)).toBe(Math.max(...map));
    // The sinking shot (3,8) is certain: nothing may lie across it, so (3,9) stays cold.
    expect(at(map, 3, 9)).toBe(0);
    for (let seed = 1; seed <= 20; seed++) {
      expect(chooseShot(v, makeRng(seed))).toEqual({ row: 4, col: 9 });
    }
  });

  it('normalizedDensity peaks at exactly 1', () => {
    expect(Math.max(...normalizedDensity(view()))).toBe(1);
    expect(normalizedDensity(view()).every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});

describe('Expert AI', () => {
  it('is deterministic for a given seed and view', () => {
    expect(chooseShot(view(), makeRng(42))).toEqual(chooseShot(view(), makeRng(42)));
    const a = playAI(3, undefined, 100, chooseShot).shots.map((s) => s.coord);
    const b = playAI(3, undefined, 100, chooseShot).shots.map((s) => s.coord);
    expect(a).toEqual(b);
  });

  it('fires at a hottest cell', () => {
    const v = view([{ coord: { row: 4, col: 4 }, result: 'hit' }]);
    const map = densityMap(v);
    const shot = chooseShot(v, makeRng(1));
    expect(at(map, shot.row, shot.col)).toBe(Math.max(...map));
  });

  it('never repeats a cell, never fires an invalid shot, and finishes every game', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { state } = playAI(seed, undefined, 100, chooseShot);
      expect(state.phase).toBe('gameover');
      expect(state.winner).toBe('ai');
    }
  });

  it('never abandons a live hit: every hit cell ends up on a sunk ship', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { shots } = playAI(seed, undefined, 100, chooseShot);
      const hits = new Set(shots.filter((s) => s.result !== 'miss').map((s) => coordKey(s.coord)));
      expect(hits.size).toBe(17);
    }
  });

  it('shot-count band: average shots-to-win over random fleets is within 38–48', () => {
    const N = 300;
    let total = 0;
    for (let seed = 1; seed <= N; seed++) {
      const human = randomFleet(makeRng(1_000_000 + seed));
      const ai = randomFleet(makeRng(2_000_000 + seed));
      total += playAI(seed, { human, ai }, 100, chooseShot).aiShotCount;
    }
    const avg = total / N;
    expect(avg).toBeGreaterThanOrEqual(38);
    expect(avg).toBeLessThanOrEqual(48);
  });
});
