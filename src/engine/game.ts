import { allSunk, canPlace, isSunk, placeShip, emptyBoard, removeShip, shipAt } from './board';
import { FIXED_AI_FLEET, FIXED_HUMAN_FLEET, randomFleet } from './fleet';
import { makeRng } from './rng';
import {
  BOARD_SIZE,
  SHIP_KINDS,
  coordKey,
  inBounds,
  type AIShot,
  type AIView,
  type Board,
  type Coin,
  type Coord,
  type GameState,
  type Player,
  type RNG,
  type Ship,
  type ShotResult,
} from './types';

const boardWith = (ships: readonly Ship[]): Board =>
  ships.reduce((b, s) => placeShip(b, s), emptyBoard());

export type Fleets = { human: readonly Ship[]; ai: readonly Ship[] };

/** Fresh game in the placement phase: empty human board, AI fleet drawn from the seed. */
export const startGame = (seed: number): GameState => ({
  phase: 'placement',
  turn: 'human',
  human: emptyBoard(),
  ai: boardWith(randomFleet(makeRng(seed))),
  aiShots: [],
  seed,
});

const withHuman = (state: GameState, human: Board): GameState => ({ ...state, human });

/** Place (or move) one of the human's ships; illegal placements return the state unchanged. */
export const placeHumanShip = (state: GameState, ship: Ship): GameState => {
  if (state.phase !== 'placement') return state;
  const without = removeShip(state.human, ship.kind);
  return canPlace(without, ship) ? withHuman(state, placeShip(without, ship)) : state;
};

export const removeHumanShip = (state: GameState, kind: Ship['kind']): GameState =>
  state.phase === 'placement' ? withHuman(state, removeShip(state.human, kind)) : state;

export const setHumanFleet = (state: GameState, ships: readonly Ship[]): GameState =>
  state.phase === 'placement' ? withHuman(state, boardWith(ships)) : state;

export const fleetComplete = (board: Board): boolean =>
  SHIP_KINDS.every((k) => board.ships.some((s) => s.kind === k));

/** placement → coinflip; a no-op unless all five ships are down. */
export const confirmFleet = (state: GameState): GameState =>
  state.phase === 'placement' && fleetComplete(state.human)
    ? { ...state, phase: 'coinflip' }
    : state;

/** Flip once: heads → human first, tails → AI first. Idempotent — a second call is a no-op. */
export const flipCoin = (state: GameState, rng: RNG): GameState => {
  if (state.phase !== 'coinflip') return state;
  const coin: Coin = rng() < 0.5 ? 'heads' : 'tails';
  return { ...state, coin, turn: coin === 'heads' ? 'human' : 'ai', phase: 'playing' };
};

/** Start directly in the playing phase with the given fleets (tests, selfplay). Human fires first. */
export const newGame = (
  seed: number,
  fleets: Fleets = { human: FIXED_HUMAN_FLEET, ai: FIXED_AI_FLEET },
): GameState => ({
  phase: 'playing',
  turn: 'human',
  human: boardWith(fleets.human),
  ai: boardWith(fleets.ai),
  aiShots: [],
  seed,
});

const other = (p: Player): Player => (p === 'human' ? 'ai' : 'human');

export const fire = (
  state: GameState,
  shooter: Player,
  at: Coord,
): { state: GameState; result: ShotResult } => {
  if (state.phase === 'gameover') {
    return { state, result: { kind: 'invalid', reason: 'game-over' } };
  }
  if (state.phase !== 'playing') {
    return { state, result: { kind: 'invalid', reason: 'not-your-turn' } };
  }
  if (state.turn !== shooter) {
    return { state, result: { kind: 'invalid', reason: 'not-your-turn' } };
  }
  if (!inBounds(at)) {
    return { state, result: { kind: 'invalid', reason: 'out-of-bounds' } };
  }
  const target = other(shooter);
  const board = state[target];
  const key = coordKey(at);
  if (board.shots[key] !== undefined) {
    return { state, result: { kind: 'invalid', reason: 'repeat' } };
  }

  const ship = shipAt(board, at);
  const nextBoard: Board = { ...board, shots: { ...board.shots, [key]: ship ? 'hit' : 'miss' } };

  let result: ShotResult;
  if (!ship) {
    result = { kind: 'miss' };
  } else if (isSunk(nextBoard, ship)) {
    result = { kind: 'sunk', ship: ship.kind };
  } else {
    result = { kind: 'hit' };
  }

  const won = allSunk(nextBoard);
  const aiShots = shooter === 'ai' ? [...state.aiShots, toAIShot(at, result)] : state.aiShots;

  const next: GameState = {
    ...state,
    [target]: nextBoard,
    aiShots,
    turn: won ? state.turn : target,
    phase: won ? 'gameover' : 'playing',
    ...(won ? { winner: shooter } : {}),
  };
  return { state: next, result };
};

const toAIShot = (coord: Coord, result: ShotResult): AIShot => {
  switch (result.kind) {
    case 'miss':
      return { coord, result: 'miss' };
    case 'hit':
      return { coord, result: 'hit' };
    case 'sunk':
      return { coord, result: 'sunk', sunkShip: result.ship };
    case 'invalid':
      throw new Error('invalid shots are never recorded');
  }
};

/** The only thing the AI ever receives. Built from the AI's own shot log, never from the human board. */
export const toAIView = (state: GameState): AIView => ({
  shots: state.aiShots,
  sunkShips: state.aiShots.flatMap((s) => (s.sunkShip ? [s.sunkShip] : [])),
  boardSize: BOARD_SIZE,
});
