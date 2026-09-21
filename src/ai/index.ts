import { chooseShot as expert } from './density';
import { chooseShot as easy } from './easy';
import { chooseShot as hard } from './huntTarget';
import type { AIView, Coord, Difficulty, RNG } from '../engine/types';

export { normalizedDensity, type Density } from './density';

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  easy: 'Easy',
  hard: 'Medium',
  expert: 'No Pacing the Frontier',
};

const CHOOSERS: Record<Difficulty, (view: AIView, rng: RNG) => Coord> = {
  easy,
  hard,
  expert,
};

export const chooseShotFor = (difficulty: Difficulty, view: AIView, rng: RNG): Coord =>
  CHOOSERS[difficulty](view, rng);
