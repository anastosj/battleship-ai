import { describe, expect, it } from 'vitest';
import { shipAt } from '../src/engine/board';
import { fire, newGame } from '../src/engine/game';
import type { Coord, GameState } from '../src/engine/types';
import {
  LEADERBOARD_KEY,
  MAX_ENTRIES,
  MAX_NAME_LENGTH,
  addEntry,
  entryFor,
  isLeaderboardEntry,
  loadEntries,
  normalizeName,
  parseEntries,
  qualifies,
  rankEntries,
  rankOf,
  saveEntries,
  type LeaderboardEntry,
} from '../src/history/leaderboard';
import type { MatchStorage } from '../src/history/matches';
import { createLeaderboardStore } from '../src/ui/useLeaderboard';

const memoryStorage = (): MatchStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

const entry = (
  id: string,
  shots: number,
  playedAt = '2026-09-18T00:00:00.000Z',
): LeaderboardEntry => ({
  id,
  name: `Player ${id}`,
  shots,
  difficulty: 'hard',
  playedAt,
});

/** The human sinks every enemy ship without missing: a 17-shot win. */
const perfectWin = (seed: number): GameState => {
  let s = newGame(seed);
  const ships: Coord[] = [];
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) if (shipAt(s.ai, { row, col })) ships.push({ row, col });
  }
  for (const at of ships) {
    s = fire(s, 'human', at).state;
    if (s.phase === 'playing') s = { ...s, turn: 'human' };
  }
  return s;
};

describe('leaderboard entries', () => {
  it('entryFor records a human win and refuses anything else', () => {
    const won = perfectWin(5);
    expect(won.winner).toBe('human');
    const e = entryFor(won, 'e1', '  Ada   Lovelace ', '2026-09-18T01:00:00.000Z');
    expect(e).toEqual({
      id: 'e1',
      name: 'Ada Lovelace',
      shots: 17,
      difficulty: 'hard',
      playedAt: '2026-09-18T01:00:00.000Z',
    });
    expect(isLeaderboardEntry(e)).toBe(true);
    expect(() => entryFor(newGame(1), 'x', 'Ada', e.playedAt)).toThrow(/not won/);
  });

  it('normalizeName trims, collapses whitespace and clamps length', () => {
    expect(normalizeName('   ')).toBe('');
    expect(normalizeName(' a \n b ')).toBe('a b');
    expect(normalizeName('x'.repeat(MAX_NAME_LENGTH + 5))).toHaveLength(MAX_NAME_LENGTH);
  });

  it('ranks by fewest shots, then earliest win, then id; caps at MAX_ENTRIES', () => {
    const ranked = rankEntries([
      entry('c', 40, '2026-01-03T00:00:00.000Z'),
      entry('a', 40, '2026-01-01T00:00:00.000Z'),
      entry('z', 30),
      entry('b', 40, '2026-01-01T00:00:00.000Z'),
    ]);
    expect(ranked.map((e) => e.id)).toEqual(['z', 'a', 'b', 'c']);

    const many = Array.from({ length: MAX_ENTRIES + 3 }, (_, i) => entry(`e${i}`, 20 + i));
    expect(rankEntries(many)).toHaveLength(MAX_ENTRIES);
    expect(rankEntries(many).at(-1)?.shots).toBe(20 + MAX_ENTRIES - 1);
  });

  it('qualifies while the board has room, then only with strictly fewer shots than last place', () => {
    expect(qualifies([], 99)).toBe(true);
    const full = Array.from({ length: MAX_ENTRIES }, (_, i) => entry(`e${i}`, 30 + i));
    const last = 30 + MAX_ENTRIES - 1;
    expect(qualifies(full, last)).toBe(false);
    expect(qualifies(full, last - 1)).toBe(true);
  });

  it('addEntry inserts in rank order, drops the displaced last place, and dedupes by id', () => {
    const full = Array.from({ length: MAX_ENTRIES }, (_, i) => entry(`e${i}`, 30 + i));
    // Same shots as e1 but a later win, so it slots in behind e1.
    const next = addEntry(full, entry('new', 31, '2026-12-01T00:00:00.000Z'));
    expect(next).toHaveLength(MAX_ENTRIES);
    expect(rankOf(next, 'new')).toBe(3);
    expect(next.some((e) => e.id === `e${MAX_ENTRIES - 1}`)).toBe(false);
    expect(addEntry(next, entry('new', 31))).toBe(next);
    expect(rankOf(next, 'nope')).toBeUndefined();
  });

  it('parseEntries tolerates missing, corrupt and foreign data and drops bad entries', () => {
    expect(parseEntries(null)).toEqual([]);
    expect(parseEntries('{nope')).toEqual([]);
    expect(parseEntries('{"a":1}')).toEqual([]);
    const bad = [
      { ...entry('ok', 40) },
      { ...entry('noname', 40), name: '' },
      { ...entry('long', 40), name: 'x'.repeat(MAX_NAME_LENGTH + 1) },
      { ...entry('zero', 0) },
      { ...entry('float', 40.5) },
      { ...entry('diff', 40), difficulty: 'brutal' },
      { ...entry('date', 40), playedAt: 'yesterday' },
      'junk',
    ];
    expect(parseEntries(JSON.stringify(bad)).map((e) => e.id)).toEqual(['ok']);
  });

  it('save/load round-trips and an empty board removes the key', () => {
    const storage = memoryStorage();
    const list = [entry('a', 30), entry('b', 40)];
    saveEntries(storage, list);
    expect(loadEntries(storage)).toEqual(list);
    saveEntries(storage, []);
    expect(storage.data.has(LEADERBOARD_KEY)).toBe(false);
  });
});

describe('leaderboard store', () => {
  it('two stores over one storage see each other’s entries and clears', () => {
    const storage = memoryStorage();
    const a = createLeaderboardStore(storage, undefined);
    const b = createLeaderboardStore(storage, undefined);
    a.add(entry('a', 30));
    b.add(entry('b', 20));
    expect(loadEntries(storage).map((e) => e.id)).toEqual(['b', 'a']);
    expect(b.get().map((e) => e.id)).toEqual(['b', 'a']);
    b.clear();
    expect(storage.data.has(LEADERBOARD_KEY)).toBe(false);
  });

  it('add reports false when another tab filled the board with better scores first', () => {
    const storage = memoryStorage();
    const store = createLeaderboardStore(storage, undefined);
    expect(store.add(entry('mine', 30))).toBe(true);
    saveEntries(
      storage,
      Array.from({ length: MAX_ENTRIES }, (_, i) => entry(`other${i}`, 20)),
    );
    expect(store.add(entry('late', 30))).toBe(false);
    expect(store.get().some((e) => e.id === 'late')).toBe(false);
  });

  it('keeps unsaved in-memory writes when storage rejects them, then syncs once it works', () => {
    const storage = memoryStorage();
    let quotaFull = true;
    const flaky: MatchStorage = {
      getItem: storage.getItem,
      removeItem: storage.removeItem,
      setItem: (k, v) => {
        if (quotaFull) throw new Error('QuotaExceededError');
        storage.setItem(k, v);
      },
    };
    const store = createLeaderboardStore(flaky, undefined);
    store.add(entry('ada', 30));
    store.add(entry('grace', 25));
    expect(store.get().map((e) => e.id)).toEqual(['grace', 'ada']);
    expect(storage.data.has(LEADERBOARD_KEY)).toBe(false);
    quotaFull = false;
    store.add(entry('linus', 20));
    expect(loadEntries(storage).map((e) => e.id)).toEqual(['linus', 'grace', 'ada']);
  });

  it('a throwing storage degrades to an in-memory board', () => {
    const broken: MatchStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createLeaderboardStore(broken, undefined);
    store.add(entry('a', 30));
    expect(store.get()).toHaveLength(1);
  });
});
