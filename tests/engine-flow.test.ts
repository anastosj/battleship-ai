import { describe, expect, it } from 'vitest';
import { shipCells } from '../src/engine/board';
import { FIXED_HUMAN_FLEET, randomFleet } from '../src/engine/fleet';
import {
  confirmFleet,
  fire,
  fleetComplete,
  flipCoin,
  placeHumanShip,
  removeHumanShip,
  setDifficulty,
  setHumanFleet,
  startGame,
} from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import { SHIP_KINDS, type GameState } from '../src/engine/types';

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
};

const placed = (): GameState => deepFreeze(setHumanFleet(startGame(7), FIXED_HUMAN_FLEET));

describe('placement phase', () => {
  it('startGame is in placement with an empty human board and a full, legal AI fleet', () => {
    const s = startGame(42);
    expect(s.phase).toBe('placement');
    expect(s.human.ships).toHaveLength(0);
    expect(fleetComplete(s.ai)).toBe(true);
    expect(s.ai.ships.flatMap(shipCells)).toHaveLength(17);
    expect(startGame(42)).toEqual(s);
  });

  it('difficulty defaults to hard, can change during placement, and is locked afterwards', () => {
    const s0 = deepFreeze(startGame(3));
    expect(s0.difficulty).toBe('hard');
    expect(startGame(3, 'easy').difficulty).toBe('easy');
    const easy = setDifficulty(s0, 'easy');
    expect(easy.difficulty).toBe('easy');
    expect(s0.difficulty).toBe('hard');
    expect(setDifficulty(easy, 'easy')).toBe(easy);

    const confirmed = confirmFleet(setHumanFleet(easy, randomFleet(makeRng(9))));
    expect(confirmed.phase).toBe('coinflip');
    expect(setDifficulty(confirmed, 'hard')).toBe(confirmed);
    const playing = flipCoin(confirmed, () => 0);
    expect(setDifficulty(playing, 'hard')).toBe(playing);
    expect(playing.difficulty).toBe('easy');
  });

  it('placeHumanShip adds a legal ship, rejects illegal ones, and moves an existing ship', () => {
    const s0 = deepFreeze(startGame(1));
    const s1 = placeHumanShip(s0, { kind: 'carrier', bow: { row: 0, col: 0 }, orientation: 'h' });
    expect(s1.human.ships).toHaveLength(1);
    expect(s0.human.ships).toHaveLength(0);

    const offBoard = placeHumanShip(s1, {
      kind: 'destroyer',
      bow: { row: 9, col: 9 },
      orientation: 'h',
    });
    expect(offBoard).toBe(s1);
    const overlap = placeHumanShip(s1, {
      kind: 'destroyer',
      bow: { row: 0, col: 3 },
      orientation: 'v',
    });
    expect(overlap).toBe(s1);

    const moved = placeHumanShip(s1, {
      kind: 'carrier',
      bow: { row: 5, col: 0 },
      orientation: 'v',
    });
    expect(moved.human.ships).toHaveLength(1);
    expect(moved.human.ships[0]?.bow).toEqual({ row: 5, col: 0 });
  });

  it('moving a ship may reuse the cells it currently occupies', () => {
    const s = placeHumanShip(startGame(1), {
      kind: 'cruiser',
      bow: { row: 2, col: 2 },
      orientation: 'h',
    });
    const rotated = placeHumanShip(s, {
      kind: 'cruiser',
      bow: { row: 2, col: 2 },
      orientation: 'v',
    });
    expect(rotated.human.ships[0]?.orientation).toBe('v');
  });

  it('removeHumanShip picks a ship back up', () => {
    const s = removeHumanShip(placed(), 'submarine');
    expect(s.human.ships.map((x) => x.kind)).not.toContain('submarine');
    expect(fleetComplete(s.human)).toBe(false);
  });

  it('setHumanFleet replaces the whole fleet (randomize)', () => {
    const a = setHumanFleet(startGame(3), randomFleet(makeRng(1)));
    const b = setHumanFleet(a, randomFleet(makeRng(2)));
    expect(fleetComplete(a.human)).toBe(true);
    expect(fleetComplete(b.human)).toBe(true);
    expect(b.human.ships).not.toEqual(a.human.ships);
  });

  it('confirmFleet only advances when all five ships are placed', () => {
    const partial = removeHumanShip(placed(), 'destroyer');
    expect(confirmFleet(partial).phase).toBe('placement');
    expect(confirmFleet(placed()).phase).toBe('coinflip');
  });

  it('placement functions are no-ops outside the placement phase', () => {
    const s = confirmFleet(placed());
    expect(placeHumanShip(s, { kind: 'carrier', bow: { row: 0, col: 0 }, orientation: 'h' })).toBe(
      s,
    );
    expect(removeHumanShip(s, 'carrier')).toBe(s);
    expect(setHumanFleet(s, [])).toBe(s);
  });

  it('cannot fire before the coin flip', () => {
    for (const s of [placed(), confirmFleet(placed())]) {
      const r = fire(s, 'human', { row: 0, col: 0 });
      expect(r.result).toEqual({ kind: 'invalid', reason: 'not-your-turn' });
      expect(r.state).toBe(s);
    }
  });
});

describe('coin flip', () => {
  const ready = () => deepFreeze(confirmFleet(placed()));

  it('heads → human first, tails → AI first, phase becomes playing', () => {
    const heads = flipCoin(ready(), () => 0.1);
    expect(heads).toMatchObject({ coin: 'heads', turn: 'human', phase: 'playing' });
    const tails = flipCoin(ready(), () => 0.9);
    expect(tails).toMatchObject({ coin: 'tails', turn: 'ai', phase: 'playing' });
  });

  it('is idempotent: a second flip is a no-op even with a different RNG', () => {
    const once = flipCoin(ready(), () => 0.9);
    const twice = flipCoin(once, () => 0.1);
    expect(twice).toBe(once);
    expect(twice.coin).toBe('tails');
  });

  it('does nothing before the fleet is confirmed', () => {
    const s = placed();
    expect(flipCoin(s, () => 0.1)).toBe(s);
  });

  it('after tails the human is rejected until the AI has fired', () => {
    const s = flipCoin(ready(), () => 0.9);
    expect(fire(s, 'human', { row: 0, col: 0 }).result.kind).toBe('invalid');
    const afterAi = fire(s, 'ai', { row: 9, col: 9 }).state;
    expect(afterAi.turn).toBe('human');
    expect(fire(afterAi, 'human', { row: 0, col: 0 }).result.kind).not.toBe('invalid');
  });

  it('all five kinds are exactly the SHIP_KINDS list', () => {
    expect([...SHIP_KINDS].sort()).toEqual(
      ['battleship', 'carrier', 'cruiser', 'destroyer', 'submarine'].sort(),
    );
  });
});
