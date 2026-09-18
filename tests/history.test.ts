import { describe, expect, it } from 'vitest';
import {
  MAX_MATCHES,
  STORAGE_KEY,
  appendMatch,
  isMatchRecord,
  loadMatches,
  parseMatches,
  recordFor,
  saveMatches,
  type MatchRecord,
  type MatchStorage,
} from '../src/history/matches';
import { newGame } from '../src/engine/game';
import { playAI } from './helpers';

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
};

const memoryStorage = (): MatchStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

const sample = (seed: number, winner: MatchRecord['winner'] = 'human'): MatchRecord => ({
  playedAt: '2026-09-18T00:00:00.000Z',
  seed,
  difficulty: 'hard',
  winner,
  you: { shots: 50, hits: 17, fleetCells: 17 },
  enemy: { shots: 49, hits: 12, fleetCells: 17 },
});

describe('match records', () => {
  it('recordFor derives stats from a finished game and refuses an unfinished one', () => {
    const { state } = playAI(3);
    const rec = recordFor(deepFreeze(state), '2026-09-18T01:02:03.000Z');
    expect(rec.seed).toBe(state.seed);
    expect(rec.winner).toBe(state.winner);
    expect(rec.difficulty).toBe('hard');
    const winnerSide = rec.winner === 'human' ? rec.you : rec.enemy;
    expect(winnerSide.hits).toBe(17);
    expect(winnerSide.fleetCells).toBe(17);
    expect(rec.you.shots + rec.enemy.shots).toBeGreaterThan(17);
    expect(isMatchRecord(rec)).toBe(true);
    expect(() => recordFor(newGame(1), rec.playedAt)).toThrow(/not over/);
  });

  it('appendMatch is newest-first, ignores a repeated seed, and caps the list', () => {
    const one = appendMatch([], sample(1));
    const two = appendMatch(one, sample(2));
    expect(two.map((m) => m.seed)).toEqual([2, 1]);
    expect(appendMatch(two, sample(2))).toBe(two);

    let many: readonly MatchRecord[] = [];
    for (let s = 1; s <= MAX_MATCHES + 5; s++) many = appendMatch(many, sample(s));
    expect(many).toHaveLength(MAX_MATCHES);
    expect(many[0]?.seed).toBe(MAX_MATCHES + 5);
  });

  it('parseMatches survives garbage and drops foreign entries', () => {
    expect(parseMatches(null)).toEqual([]);
    expect(parseMatches('not json')).toEqual([]);
    expect(parseMatches('{"a":1}')).toEqual([]);
    const mixed = JSON.stringify([
      sample(1),
      { ...sample(2), winner: 'cat' },
      { ...sample(3), you: { shots: -1, hits: 0, fleetCells: 17 } },
      { ...sample(4), difficulty: 'brutal' },
      { ...sample(5), playedAt: 'yesterday' },
      'nope',
    ]);
    expect(parseMatches(mixed).map((m) => m.seed)).toEqual([1]);
  });

  it('save/load round-trips and an empty list removes the key', () => {
    const storage = memoryStorage();
    const list = [sample(2, 'ai'), sample(1)];
    saveMatches(storage, list);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
    expect(loadMatches(storage)).toEqual(list);
    saveMatches(storage, []);
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
    expect(loadMatches(storage)).toEqual([]);
  });
});
