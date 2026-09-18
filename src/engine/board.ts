import {
  SHIP_SIZES,
  coordKey,
  inBounds,
  type Board,
  type CellMark,
  type Coord,
  type Ship,
} from './types';

export const emptyBoard = (): Board => ({ ships: [], shots: {} });

export const shipCells = (ship: Ship): Coord[] => {
  const size = SHIP_SIZES[ship.kind];
  const cells: Coord[] = [];
  for (let i = 0; i < size; i++) {
    cells.push(
      ship.orientation === 'h'
        ? { row: ship.bow.row, col: ship.bow.col + i }
        : { row: ship.bow.row + i, col: ship.bow.col },
    );
  }
  return cells;
};

export const canPlace = (board: Board, ship: Ship): boolean => {
  const occupied = new Set(board.ships.flatMap((s) => shipCells(s).map(coordKey)));
  return shipCells(ship).every((c) => inBounds(c) && !occupied.has(coordKey(c)));
};

export const placeShip = (board: Board, ship: Ship): Board => {
  if (!canPlace(board, ship)) {
    throw new Error(`Illegal placement for ${ship.kind}`);
  }
  return { ...board, ships: [...board.ships, ship] };
};

export const removeShip = (board: Board, kind: Ship['kind']): Board => ({
  ...board,
  ships: board.ships.filter((s) => s.kind !== kind),
});

export const shipAt = (board: Board, c: Coord): Ship | undefined =>
  board.ships.find((s) => shipCells(s).some((sc) => sc.row === c.row && sc.col === c.col));

export const markAt = (board: Board, c: Coord): CellMark | undefined => board.shots[coordKey(c)];

export const isSunk = (board: Board, ship: Ship): boolean =>
  shipCells(ship).every((c) => board.shots[coordKey(c)] === 'hit');

export const allSunk = (board: Board): boolean =>
  board.ships.length > 0 && board.ships.every((s) => isSunk(board, s));

export const shotCount = (board: Board): number => Object.keys(board.shots).length;
