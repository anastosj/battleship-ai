import { allSunk, isSunk, placeShip, emptyBoard, shipAt } from './board';
import { FIXED_AI_FLEET, FIXED_HUMAN_FLEET } from './fleet';
import {
  BOARD_SIZE,
  coordKey,
  inBounds,
  type AIShot,
  type AIView,
  type Board,
  type Coord,
  type GameState,
  type Player,
  type Ship,
  type ShotResult,
} from './types';

const boardWith = (ships: readonly Ship[]): Board =>
  ships.reduce((b, s) => placeShip(b, s), emptyBoard());

export const newGame = (seed: number): GameState => ({
  phase: 'playing',
  turn: 'human',
  human: boardWith(FIXED_HUMAN_FLEET),
  ai: boardWith(FIXED_AI_FLEET),
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
