import type { Ship } from './types';

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
