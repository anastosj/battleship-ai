import { randomInt } from '../engine/rng';
import { coordKey, type AIShot, type AIView, type Coord, type RNG } from '../engine/types';

/**
 * Easy opponent. Hunts uniformly at random (no parity, no fit check) and, after a hit, fires
 * at the open neighbours of its most recent hit. It does the naive thing §5.3 warns against:
 * a "sunk" result clears every outstanding hit, so a touching ship it has already hit is
 * forgotten until the random hunt stumbles on it again. Same information boundary as Hard.
 */
const neighbours = (c: Coord): Coord[] => [
  { row: c.row, col: c.col - 1 },
  { row: c.row, col: c.col + 1 },
  { row: c.row - 1, col: c.col },
  { row: c.row + 1, col: c.col },
];

const replay = (shots: readonly AIShot[]): { pending: Coord[]; targeted: Set<string> } => {
  let pending: Coord[] = [];
  const targeted = new Set<string>();
  for (const shot of shots) {
    targeted.add(coordKey(shot.coord));
    if (shot.result === 'hit') pending = [...pending, shot.coord];
    else if (shot.result === 'sunk') pending = [];
  }
  return { pending, targeted };
};

export const chooseShot = (view: AIView, rng: RNG): Coord => {
  const size = view.boardSize;
  const { pending, targeted } = replay(view.shots);
  const open = (c: Coord) =>
    c.row >= 0 && c.col >= 0 && c.row < size && c.col < size && !targeted.has(coordKey(c));

  for (const hit of [...pending].reverse()) {
    const around = neighbours(hit).filter(open);
    if (around.length > 0) return around[randomInt(rng, around.length)]!;
  }

  const untargeted: Coord[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!targeted.has(coordKey({ row, col }))) untargeted.push({ row, col });
    }
  }
  const shot = untargeted[randomInt(rng, untargeted.length)];
  if (!shot) throw new Error('No cells left to fire at');
  return shot;
};
