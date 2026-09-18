export const BOARD_SIZE = 10;

export type Coord = { row: number; col: number };

export type ShipKind = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export const SHIP_KINDS: readonly ShipKind[] = [
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
];

export const SHIP_SIZES: Record<ShipKind, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

export const SHIP_NAMES: Record<ShipKind, string> = {
  carrier: 'Carrier',
  battleship: 'Battleship',
  cruiser: 'Cruiser',
  submarine: 'Submarine',
  destroyer: 'Destroyer',
};

export type Orientation = 'h' | 'v';

export type Ship = { kind: ShipKind; bow: Coord; orientation: Orientation };

export type CellMark = 'miss' | 'hit';

/** Key is `${row},${col}`. */
export type Board = { ships: readonly Ship[]; shots: Readonly<Record<string, CellMark>> };

export type ShotResult =
  | { kind: 'miss' }
  | { kind: 'hit' }
  | { kind: 'sunk'; ship: ShipKind }
  | { kind: 'invalid'; reason: 'repeat' | 'out-of-bounds' | 'not-your-turn' | 'game-over' };

export type Player = 'human' | 'ai';

export type Phase = 'placement' | 'coinflip' | 'playing' | 'gameover';

export type Coin = 'heads' | 'tails';

export type GameState = {
  phase: Phase;
  /** Meaningful only once `phase === 'playing'`; before the coin flip it is a placeholder. */
  turn: Player;
  coin?: Coin;
  human: Board;
  ai: Board;
  /** Log of the AI's own shots and their results; the sole source of AIView. */
  aiShots: readonly AIShot[];
  winner?: Player;
  seed: number;
};

/** Everything the AI is allowed to know. Nothing else. */
export type AIShot = { coord: Coord; result: 'miss' | 'hit' | 'sunk'; sunkShip?: ShipKind };
export type AIView = {
  shots: readonly AIShot[];
  sunkShips: readonly ShipKind[];
  boardSize: number;
};

export type RNG = () => number;

export const coordKey = (c: Coord): string => `${c.row},${c.col}`;

export const inBounds = (c: Coord): boolean =>
  Number.isInteger(c.row) &&
  Number.isInteger(c.col) &&
  c.row >= 0 &&
  c.row < BOARD_SIZE &&
  c.col >= 0 &&
  c.col < BOARD_SIZE;
