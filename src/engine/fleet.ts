import { canPlace, emptyBoard, placeShip } from './board';
import { randomInt } from './rng';
import { BOARD_SIZE, SHIP_SIZES, type RNG, type Ship, type ShipKind } from './types';

/** Fixed fleets for the walking skeleton. Placement UI replaces these later. */
export const FIXED_HUMAN_FLEET: readonly Ship[] = [
  { kind: 'carrier', bow: { row: 0, col: 0 }, orientation: 'h' },
  { kind: 'battleship', bow: { row: 2, col: 1 }, orientation: 'v' },
  { kind: 'cruiser', bow: { row: 7, col: 4 }, orientation: 'h' },
  { kind: 'submarine', bow: { row: 3, col: 7 }, orientation: 'v' },
  { kind: 'destroyer', bow: { row: 9, col: 8 }, orientation: 'h' },
];

export const FIXED_AI_FLEET: readonly Ship[] = [
  { kind: 'carrier', bow: { row: 1, col: 5 }, orientation: 'v' },
  { kind: 'battleship', bow: { row: 8, col: 0 }, orientation: 'h' },
  { kind: 'cruiser', bow: { row: 0, col: 1 }, orientation: 'h' },
  { kind: 'submarine', bow: { row: 5, col: 8 }, orientation: 'v' },
  { kind: 'destroyer', bow: { row: 3, col: 2 }, orientation: 'v' },
];

export const SHIP_KINDS: readonly ShipKind[] = [
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
];

/** Uniformly random legal fleet (touching allowed). Pure given the RNG. */
export const randomFleet = (rng: RNG): Ship[] => {
  let board = emptyBoard();
  for (const kind of SHIP_KINDS) {
    const size = SHIP_SIZES[kind];
    const options: Ship[] = [];
    for (const orientation of ['h', 'v'] as const) {
      const rows = orientation === 'v' ? BOARD_SIZE - size + 1 : BOARD_SIZE;
      const cols = orientation === 'h' ? BOARD_SIZE - size + 1 : BOARD_SIZE;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ship: Ship = { kind, bow: { row, col }, orientation };
          if (canPlace(board, ship)) options.push(ship);
        }
      }
    }
    const pick = options[randomInt(rng, options.length)];
    if (!pick) throw new Error(`No legal placement for ${kind}`);
    board = placeShip(board, pick);
  }
  return [...board.ships];
};
