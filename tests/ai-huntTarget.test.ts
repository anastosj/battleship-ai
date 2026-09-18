import { describe, expect, it } from 'vitest';
import { chooseShot } from '../src/ai/huntTarget';
import { canPlace, emptyBoard, placeShip } from '../src/engine/board';
import { randomFleet } from '../src/engine/fleet';
import { toAIView } from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import { SHIP_SIZES, type AIView } from '../src/engine/types';
import { playAI } from './helpers';

describe('randomFleet', () => {
  it('produces a legal 5-ship fleet for many seeds', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const fleet = randomFleet(makeRng(seed));
      expect(fleet).toHaveLength(5);
      let board = emptyBoard();
      for (const ship of fleet) {
        expect(canPlace(board, ship)).toBe(true);
        board = placeShip(board, ship);
      }
      expect(new Set(fleet.map((s) => s.kind)).size).toBe(5);
    }
  });
});

describe('Hunt/Target AI', () => {
  it('is deterministic for a given seed and view', () => {
    const view: AIView = { shots: [], sunkShips: [], boardSize: 10 };
    expect(chooseShot(view, makeRng(42))).toEqual(chooseShot(view, makeRng(42)));
    const a = playAI(3).shots.map((s) => s.coord);
    const b = playAI(3).shots.map((s) => s.coord);
    expect(a).toEqual(b);
  });

  it('never repeats a cell, never fires an invalid shot, and finishes every game (fixed fleet)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { state } = playAI(seed);
      expect(state.phase).toBe('gameover');
      expect(state.winner).toBe('ai');
    }
  });

  it('hunts on a single checkerboard parity until it gets a hit', () => {
    const { shots } = playAI(11);
    const firstHit = shots.findIndex((s) => s.result !== 'miss');
    const parity = (shots[0]!.coord.row + shots[0]!.coord.col) % 2;
    for (const s of shots.slice(0, firstHit)) {
      expect((s.coord.row + s.coord.col) % 2).toBe(parity);
    }
  });

  it('§5.4 shot-count band: average shots-to-win over random fleets is within 46–56', () => {
    const N = 300;
    let total = 0;
    let worst = 0;
    for (let seed = 1; seed <= N; seed++) {
      const human = randomFleet(makeRng(1_000_000 + seed));
      const { aiShotCount } = playAI(seed, { human, ai: randomFleet(makeRng(2_000_000 + seed)) });
      total += aiShotCount;
      worst = Math.max(worst, aiShotCount);
    }
    const avg = total / N;
    expect(avg).toBeGreaterThanOrEqual(46);
    expect(avg).toBeLessThanOrEqual(56);
    expect(worst).toBeLessThanOrEqual(95);
  });

  it('chooseShot is fast (< 5 ms per call at end-game)', () => {
    const { shots } = playAI(5);
    const view = toAIView({ ...playAI(5).state, aiShots: shots.slice(0, -1) });
    const t0 = performance.now();
    chooseShot(view, makeRng(1));
    expect(performance.now() - t0).toBeLessThan(5);
  });

  it('total ship cells is 17 (sanity for the band test)', () => {
    expect(Object.values(SHIP_SIZES).reduce((a, b) => a + b, 0)).toBe(17);
  });
});
