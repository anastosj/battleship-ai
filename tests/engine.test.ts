import { describe, expect, it } from 'vitest';
import { allSunk, canPlace, emptyBoard, placeShip, shipCells } from '../src/engine/board';
import { FIXED_AI_FLEET, FIXED_HUMAN_FLEET } from '../src/engine/fleet';
import { fire, newGame, toAIView } from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import { SHIP_SIZES, type Coord, type GameState, type Ship } from '../src/engine/types';

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
};

const sinkFleet = (state: GameState, shooter: 'human' | 'ai'): GameState => {
  const target = shooter === 'human' ? state.ai : state.human;
  let s = state;
  const cells = target.ships.flatMap(shipCells);
  for (const c of cells) {
    if (s.phase === 'gameover') break;
    let r = fire(s, shooter, c);
    if (r.result.kind === 'invalid' && r.result.reason === 'not-your-turn') {
      // let the other side waste a shot on a guaranteed miss
      const other = shooter === 'human' ? 'ai' : 'human';
      const missAt = firstMiss(s, other);
      s = fire(s, other, missAt).state;
      r = fire(s, shooter, c);
    }
    expect(r.result.kind).not.toBe('invalid');
    s = r.state;
  }
  return s;
};

const firstMiss = (state: GameState, shooter: 'human' | 'ai'): Coord => {
  const board = shooter === 'human' ? state.ai : state.human;
  const occupied = new Set(board.ships.flatMap(shipCells).map((c) => `${c.row},${c.col}`));
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const k = `${row},${col}`;
      if (!occupied.has(k) && board.shots[k] === undefined) return { row, col };
    }
  }
  throw new Error('no miss cell available');
};

describe('placement', () => {
  it('rejects off-board ships in both orientations', () => {
    const b = emptyBoard();
    expect(canPlace(b, { kind: 'carrier', bow: { row: 0, col: 6 }, orientation: 'h' })).toBe(false);
    expect(canPlace(b, { kind: 'carrier', bow: { row: 6, col: 0 }, orientation: 'v' })).toBe(false);
    expect(canPlace(b, { kind: 'carrier', bow: { row: 0, col: 5 }, orientation: 'h' })).toBe(true);
    expect(canPlace(b, { kind: 'destroyer', bow: { row: -1, col: 0 }, orientation: 'v' })).toBe(
      false,
    );
  });

  it('rejects overlap but allows touching', () => {
    const b = placeShip(emptyBoard(), {
      kind: 'cruiser',
      bow: { row: 0, col: 0 },
      orientation: 'h',
    });
    expect(canPlace(b, { kind: 'destroyer', bow: { row: 0, col: 2 }, orientation: 'v' })).toBe(
      false,
    );
    expect(canPlace(b, { kind: 'destroyer', bow: { row: 1, col: 0 }, orientation: 'h' })).toBe(
      true,
    );
    expect(canPlace(b, { kind: 'destroyer', bow: { row: 0, col: 3 }, orientation: 'h' })).toBe(
      true,
    );
  });

  it('placeShip throws on illegal placement and does not mutate', () => {
    const b = deepFreeze(emptyBoard());
    expect(() =>
      placeShip(b, { kind: 'carrier', bow: { row: 9, col: 9 }, orientation: 'h' }),
    ).toThrow();
    expect(b.ships).toHaveLength(0);
  });

  it('fixed fleets are legal and complete', () => {
    for (const fleet of [FIXED_HUMAN_FLEET, FIXED_AI_FLEET]) {
      const b = fleet.reduce((acc, s) => placeShip(acc, s), emptyBoard());
      expect(b.ships).toHaveLength(5);
      const total = b.ships.reduce((n, s: Ship) => n + SHIP_SIZES[s.kind], 0);
      expect(total).toBe(17);
    }
  });
});

describe('fire', () => {
  const game = deepFreeze(newGame(1));

  it('reports miss and switches turn without mutating input', () => {
    const { state, result } = fire(game, 'human', { row: 9, col: 9 });
    expect(result).toEqual({ kind: 'miss' });
    expect(state.turn).toBe('ai');
    expect(state.ai.shots['9,9']).toBe('miss');
    expect(game.ai.shots['9,9']).toBeUndefined();
    expect(game.turn).toBe('human');
  });

  it('reports hit then sunk on the last cell', () => {
    // AI destroyer is at (3,2)-(4,2)
    const a = fire(game, 'human', { row: 3, col: 2 });
    expect(a.result).toEqual({ kind: 'hit' });
    const b = fire(a.state, 'ai', firstMiss(a.state, 'ai'));
    const c = fire(b.state, 'human', { row: 4, col: 2 });
    expect(c.result).toEqual({ kind: 'sunk', ship: 'destroyer' });
  });

  it('rejects repeat, out-of-turn and out-of-bounds shots without consuming the turn', () => {
    const a = fire(game, 'human', { row: 9, col: 9 });
    expect(fire(a.state, 'human', { row: 0, col: 0 }).result).toEqual({
      kind: 'invalid',
      reason: 'not-your-turn',
    });
    expect(fire(game, 'human', { row: 10, col: 0 }).result).toEqual({
      kind: 'invalid',
      reason: 'out-of-bounds',
    });
    const b = fire(a.state, 'ai', { row: 5, col: 5 });
    const repeat = fire(b.state, 'human', { row: 9, col: 9 });
    expect(repeat.result).toEqual({ kind: 'invalid', reason: 'repeat' });
    expect(repeat.state).toBe(b.state);
  });

  it('ends the game at exactly 17 hits and rejects further shots', () => {
    const end = sinkFleet(game, 'human');
    expect(end.phase).toBe('gameover');
    expect(end.winner).toBe('human');
    expect(allSunk(end.ai)).toBe(true);
    expect(Object.values(end.ai.shots).filter((m) => m === 'hit')).toHaveLength(17);
    expect(fire(end, 'ai', { row: 9, col: 9 }).result).toEqual({
      kind: 'invalid',
      reason: 'game-over',
    });
  });

  it('AI can win too', () => {
    const end = sinkFleet(game, 'ai');
    expect(end.winner).toBe('ai');
  });
});

describe('AIView', () => {
  it('contains only the AI shot log, never the human fleet', () => {
    const a = fire(newGame(1), 'human', { row: 9, col: 9 });
    const b = fire(a.state, 'ai', { row: 0, col: 0 }); // human carrier bow → hit
    const view = toAIView(b.state);
    expect(view.shots).toEqual([{ coord: { row: 0, col: 0 }, result: 'hit' }]);
    expect(view.sunkShips).toEqual([]);
    expect(Object.keys(view).sort()).toEqual(['boardSize', 'shots', 'sunkShips']);
  });
});

describe('rng', () => {
  it('is deterministic per seed and in [0,1)', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
