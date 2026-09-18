import { chooseShot } from '../src/ai/huntTarget';
import { shipAt } from '../src/engine/board';
import { fire, newGame, toAIView, type Fleets } from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import { coordKey, type AIShot, type Coord, type GameState } from '../src/engine/types';

export type Playthrough = { state: GameState; shots: readonly AIShot[]; aiShotCount: number };

/**
 * Plays the AI against `fleets.human` until the AI wins. The human "passes" by firing at
 * water cells first, so the AI always gets its full game in.
 */
export const playAI = (seed: number, fleets?: Fleets, maxShots = 100): Playthrough => {
  const rng = makeRng(seed);
  let s: GameState = newGame(seed, fleets);
  const water: Coord[] = [];
  const ships: Coord[] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      (shipAt(s.ai, { row, col }) ? ships : water).push({ row, col });
    }
  }
  const humanQueue = [...water, ...ships];
  const seen = new Set<string>();
  let aiShotCount = 0;
  while (s.phase === 'playing') {
    const humanAt = humanQueue.shift();
    if (!humanAt) throw new Error('human ran out of cells');
    s = fire(s, 'human', humanAt).state;
    if (s.phase !== 'playing') throw new Error(`human won before the AI (seed ${seed})`);

    const at = chooseShot(toAIView(s), rng);
    if (seen.has(coordKey(at))) throw new Error(`AI repeated ${coordKey(at)} (seed ${seed})`);
    seen.add(coordKey(at));
    const r = fire(s, 'ai', at);
    if (r.result.kind === 'invalid') {
      throw new Error(`AI fired an invalid shot: ${r.result.reason} (seed ${seed})`);
    }
    s = r.state;
    if (++aiShotCount > maxShots)
      throw new Error(`AI did not finish in ${maxShots} (seed ${seed})`);
  }
  return { state: s, shots: s.aiShots, aiShotCount };
};
