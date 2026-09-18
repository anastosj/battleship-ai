import { describe, expect, it } from 'vitest';
import { chooseShot } from '../src/ai/random';
import { fire, newGame, toAIView } from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import { coordKey, type GameState } from '../src/engine/types';

describe('random AI', () => {
  it('never repeats a cell and always finishes a game', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = makeRng(seed);
      let s: GameState = newGame(seed);
      const seen = new Set<string>();
      let guard = 0;
      while (s.phase === 'playing' && guard++ < 300) {
        // human passes by shooting the first open cell
        const humanAt = firstOpen(s);
        s = fire(s, 'human', humanAt).state;
        if (s.phase !== 'playing') break;
        const at = chooseShot(toAIView(s), rng);
        expect(seen.has(coordKey(at))).toBe(false);
        seen.add(coordKey(at));
        const r = fire(s, 'ai', at);
        expect(r.result.kind).not.toBe('invalid');
        s = r.state;
      }
      expect(s.phase).toBe('gameover');
    }
  });
});

const firstOpen = (s: GameState) => {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      if (s.ai.shots[coordKey({ row, col })] === undefined) return { row, col };
    }
  }
  throw new Error('board exhausted');
};
