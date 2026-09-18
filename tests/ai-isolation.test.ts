import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { chooseShot } from '../src/ai/huntTarget';
import { fire, newGame, toAIView } from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import { type Coord, type GameState, type Ship } from '../src/engine/types';

const AI_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'ai');
const ALLOWED_FROM_TYPES = new Set([
  'AIView',
  'AIShot',
  'Coord',
  'ShipKind',
  'SHIP_SIZES',
  'RNG',
  'Difficulty',
]);
const ALLOWED_MODULES = new Set(['../engine/types', '../engine/rng']);

const importsOf = (src: string): { names: string[]; from: string }[] =>
  [...src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)].map((m) => ({
    names: (m[1] ?? '')
      .split(',')
      .map((n) => n.replace(/^\s*type\s+/, '').trim())
      .filter(Boolean),
    from: m[2] ?? '',
  }));

describe('§5.1 AI information boundary (static)', () => {
  const files = readdirSync(AI_DIR).filter((f) => f.endsWith('.ts'));

  it('has at least one AI source file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} imports nothing from engine/ except the AIView allow-list`, () => {
      const src = readFileSync(join(AI_DIR, file), 'utf8');
      expect(src).not.toMatch(/engine\/(board|game|fleet)/);
      expect(src).not.toMatch(/\bGameState\b|\bBoard\b|\bShip\b(?!Kind)/);
      for (const imp of importsOf(src)) {
        if (!imp.from.startsWith('../engine/')) continue;
        expect(ALLOWED_MODULES.has(imp.from), `${file} imports ${imp.from}`).toBe(true);
        if (imp.from === '../engine/types') {
          for (const n of imp.names) {
            expect(ALLOWED_FROM_TYPES.has(n) || n === 'coordKey', `${file} imports ${n}`).toBe(
              true,
            );
          }
        }
      }
    });
  }
});

describe('§5.1 AI information boundary (behavioural)', () => {
  it('makes identical moves against different hidden fleets when its own shot history is identical', () => {
    // Two human fleets that differ, but the first N AI shots hit water on both.
    const fleetA: Ship[] = [
      { kind: 'carrier', bow: { row: 0, col: 0 }, orientation: 'h' },
      { kind: 'battleship', bow: { row: 1, col: 0 }, orientation: 'h' },
      { kind: 'cruiser', bow: { row: 2, col: 0 }, orientation: 'h' },
      { kind: 'submarine', bow: { row: 3, col: 0 }, orientation: 'h' },
      { kind: 'destroyer', bow: { row: 4, col: 0 }, orientation: 'h' },
    ];
    const fleetB: Ship[] = fleetA.map((s) => ({ ...s, bow: { row: s.bow.row + 5, col: 5 } }));
    const ai = newGame(1).ai.ships;

    // Fire the same scripted AI shots (all water on both boards) and compare the next choice.
    const script: Coord[] = [
      { row: 9, col: 0 },
      { row: 9, col: 2 },
      { row: 0, col: 9 },
      { row: 2, col: 8 },
    ];
    const play = (human: Ship[]): Coord => {
      let s: GameState = newGame(7, { human, ai });
      for (const at of script) {
        s = fire(s, 'human', firstOpen(s)).state;
        const r = fire(s, 'ai', at);
        expect(r.result.kind).toBe('miss');
        s = r.state;
      }
      s = fire(s, 'human', firstOpen(s)).state;
      return chooseShot(toAIView(s), makeRng(99));
    };
    expect(play(fleetA)).toEqual(play(fleetB));
  });
});

const firstOpen = (s: GameState): Coord => {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      if (s.ai.shots[`${row},${col}`] === undefined) return { row, col };
    }
  }
  throw new Error('board exhausted');
};
