import { describe, expect, it } from 'vitest';
import { chooseShot, replay } from '../src/ai/huntTarget';
import { makeRng } from '../src/engine/rng';
import { isSunk, shipAt, shipCells } from '../src/engine/board';
import { FIXED_AI_FLEET } from '../src/engine/fleet';
import { coordKey, type AIShot, type Board, type Coord, type Ship } from '../src/engine/types';
import { playAI } from './helpers';

const adjacent = (a: Coord, b: Coord): boolean =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

/**
 * Ground-truth check (the test may look at the board; the AI may not): whenever the AI has
 * hit a ship that is not yet sunk, its next shot must be adjacent to one of those live hits.
 */
const assertNeverAbandonsLiveHit = (shots: readonly AIShot[], human: Board, seed: number) => {
  let board: Board = { ...human, shots: {} };
  shots.forEach((shot, i) => {
    const liveHits = board.ships
      .filter((s) => !isSunk(board, s))
      .flatMap((s) => shipCells(s).filter((c) => board.shots[coordKey(c)] === 'hit'));
    if (liveHits.length > 0) {
      expect(
        liveHits.some((h) => adjacent(h, shot.coord)),
        `seed ${seed}: shot #${i} ${coordKey(shot.coord)} abandoned live hit(s) ${liveHits
          .map(coordKey)
          .join(' ')}`,
      ).toBe(true);
    }
    board = {
      ...board,
      shots: { ...board.shots, [coordKey(shot.coord)]: shipAt(board, shot.coord) ? 'hit' : 'miss' },
    };
  });
};

const FAR_CARRIER: Ship = { kind: 'carrier', bow: { row: 9, col: 0 }, orientation: 'h' };
const FAR_BATTLESHIP: Ship = { kind: 'battleship', bow: { row: 0, col: 6 }, orientation: 'h' };

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

describe('§5.3 touching ships — the AI never abandons a live hit and always finishes', () => {
  it('Destroyer flush against the Cruiser, end to end', () => {
    const human: Ship[] = [
      { kind: 'cruiser', bow: { row: 5, col: 2 }, orientation: 'h' },
      { kind: 'destroyer', bow: { row: 5, col: 5 }, orientation: 'h' },
      { kind: 'submarine', bow: { row: 1, col: 0 }, orientation: 'v' },
      FAR_CARRIER,
      FAR_BATTLESHIP,
    ];
    for (const seed of SEEDS) {
      const { state, shots } = playAI(seed, { human, ai: FIXED_AI_FLEET });
      expect(state.winner).toBe('ai');
      assertNeverAbandonsLiveHit(shots, state.human, seed);
    }
  });

  it('Battleship and Cruiser side by side in parallel', () => {
    const human: Ship[] = [
      { kind: 'battleship', bow: { row: 4, col: 3 }, orientation: 'h' },
      { kind: 'cruiser', bow: { row: 5, col: 3 }, orientation: 'h' },
      { kind: 'submarine', bow: { row: 1, col: 0 }, orientation: 'v' },
      { kind: 'destroyer', bow: { row: 8, col: 8 }, orientation: 'v' },
      FAR_CARRIER,
    ];
    for (const seed of SEEDS) {
      const { state, shots } = playAI(seed, { human, ai: FIXED_AI_FLEET });
      expect(state.winner).toBe('ai');
      assertNeverAbandonsLiveHit(shots, state.human, seed);
    }
  });

  it('an "L" of Submarine and Destroyer, sink at the corner (scripted)', () => {
    // Submarine vertical C3–C5 (col 3, rows 2–4); Destroyer horizontal row 4, cols 4–5.
    // The corner cell (4,3) is the Submarine's; the AI sinks it last.
    const log: AIShot[] = [
      { coord: { row: 2, col: 3 }, result: 'hit' },
      { coord: { row: 3, col: 3 }, result: 'hit' },
      { coord: { row: 4, col: 4 }, result: 'hit' }, // destroyer, found while probing
      { coord: { row: 4, col: 3 }, result: 'sunk', sunkShip: 'submarine' },
    ];
    const mem = replay(log);
    expect(mem.unresolved.map((h) => coordKey(h.coord))).toEqual(['4,4']);
  });

  it('an "L" of Submarine and Destroyer, full games', () => {
    const human: Ship[] = [
      { kind: 'submarine', bow: { row: 2, col: 3 }, orientation: 'v' },
      { kind: 'destroyer', bow: { row: 4, col: 4 }, orientation: 'h' },
      { kind: 'cruiser', bow: { row: 7, col: 0 }, orientation: 'h' },
      FAR_CARRIER,
      FAR_BATTLESHIP,
    ];
    for (const seed of SEEDS) {
      const { state, shots } = playAI(seed, { human, ai: FIXED_AI_FLEET });
      expect(state.winner).toBe('ai');
      assertNeverAbandonsLiveHit(shots, state.human, seed);
    }
  });
});

describe('§5.3 attribution unit cases', () => {
  it('recovers when the ambiguity tie-break attributes the wrong axis (fuzz seed 874)', () => {
    // Destroyer at (3,7)(3,8) touching a Battleship at (4,6)–(4,9). The AI hits (3,7), (4,7),
    // (4,8), then sinks the Destroyer at (3,8). Both axes show a 2-run; the "most recent prior
    // hit" rule picks vertical and wrongly resolves (4,8). With (3,7) boxed in, the AI must
    // still work its way to the Battleship's last cell (4,9) instead of going back to hunting.
    const log: AIShot[] = [
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
    ];
    const view = { shots: log, sunkShips: ['destroyer' as const], boardSize: 10 };
    for (let seed = 1; seed <= 20; seed++) {
      expect(chooseShot(view, makeRng(seed))).toEqual({ row: 4, col: 9 });
    }
  });

  it('attributes exactly L cells along the single qualifying axis', () => {
    const log: AIShot[] = [
      { coord: { row: 5, col: 5 }, result: 'hit' }, // destroyer
      { coord: { row: 5, col: 4 }, result: 'hit' }, // cruiser
      { coord: { row: 5, col: 3 }, result: 'hit' },
      { coord: { row: 5, col: 2 }, result: 'sunk', sunkShip: 'cruiser' },
    ];
    expect(replay(log).unresolved.map((h) => coordKey(h.coord))).toEqual(['5,5']);
  });

  it('when both axes qualify, prefers the axis whose run is exactly L', () => {
    // Destroyer (2) sunk at (5,5): horizontal run (5,4)-(5,5) is exactly 2; vertical run is 3.
    const log: AIShot[] = [
      { coord: { row: 3, col: 5 }, result: 'hit' },
      { coord: { row: 4, col: 5 }, result: 'hit' },
      { coord: { row: 5, col: 4 }, result: 'hit' },
      { coord: { row: 5, col: 5 }, result: 'sunk', sunkShip: 'destroyer' },
    ];
    expect(
      replay(log)
        .unresolved.map((h) => coordKey(h.coord))
        .sort(),
    ).toEqual(['3,5', '4,5']);
  });

  it('keeps hunting when a hit is left over rather than falling back', () => {
    const log: AIShot[] = [
      { coord: { row: 0, col: 0 }, result: 'hit' },
      { coord: { row: 0, col: 1 }, result: 'sunk', sunkShip: 'destroyer' },
      { coord: { row: 9, col: 9 }, result: 'hit' },
    ];
    expect(replay(log).unresolved.map((h) => coordKey(h.coord))).toEqual(['9,9']);
  });
});
