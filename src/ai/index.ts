import { chooseShot as easy } from './easy';
import { chooseShot as hard } from './huntTarget';
import type { AIView, Coord, Difficulty, RNG } from '../engine/types';

export const DIFFICULTY_NAMES: Record<Difficulty, string> = { easy: 'Easy', hard: 'Hard' };

export const chooseShotFor = (difficulty: Difficulty, view: AIView, rng: RNG): Coord =>
  difficulty === 'easy' ? easy(view, rng) : hard(view, rng);
