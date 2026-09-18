import type { Coord } from '../engine/types';

const COLS = 'ABCDEFGHIJ';

export const cellLabel = (c: Coord): string => `${COLS[c.col]}${c.row + 1}`;
