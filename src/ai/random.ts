import { randomInt } from '../engine/rng';
import { coordKey, type AIView, type Coord, type RNG } from '../engine/types';

/** Uniform random among untargeted cells. Placeholder until the Hunt/Target AI lands. */
export const chooseShot = (view: AIView, rng: RNG): Coord => {
  const taken = new Set(view.shots.map((s) => coordKey(s.coord)));
  const open: Coord[] = [];
  for (let row = 0; row < view.boardSize; row++) {
    for (let col = 0; col < view.boardSize; col++) {
      if (!taken.has(coordKey({ row, col }))) open.push({ row, col });
    }
  }
  const pick = open[randomInt(rng, open.length)];
  if (!pick) throw new Error('No cells left to fire at');
  return pick;
};
