import { useState, useSyncExternalStore } from 'react';
import { shotCount } from '../engine/board';
import type { GameState } from '../engine/types';
import {
  LEADERBOARD_KEY,
  addEntry,
  entryFor,
  normalizeName,
  parseEntries,
  qualifies,
  rankOf,
  type LeaderboardEntry,
} from '../history/leaderboard';
import type { MatchStorage } from '../history/matches';
import {
  createStoredList,
  defaultEvents,
  defaultStorage,
  newId,
  type StorageEvents,
} from './storedList';

export const createLeaderboardStore = (
  storage: MatchStorage | undefined = defaultStorage(),
  events: StorageEvents | undefined = defaultEvents(),
) => {
  const list = createStoredList<LeaderboardEntry>({
    key: LEADERBOARD_KEY,
    parse: parseEntries,
    storage,
    events,
  });
  return {
    get: list.get,
    subscribe: list.subscribe,
    /** Returns false if the entry no longer makes the board once storage is re-read. */
    add: (entry: LeaderboardEntry): boolean =>
      list.update((current) => addEntry(current, entry)).some((e) => e.id === entry.id),
    clear: list.clear,
  };
};

type Saved = { game: GameState; id: string };

/**
 * Browser-local top-10 of human wins by fewest shots. `submit` is only meaningful while
 * `qualifying` is true; each won game can be saved once (tracked by the `game` object).
 */
export const useLeaderboard = (game: GameState) => {
  const [store] = useState(() => createLeaderboardStore());
  const entries = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [saved, setSaved] = useState<Saved | undefined>(undefined);

  const won = game.phase === 'gameover' && game.winner === 'human';
  const savedHere = saved?.game === game ? saved : undefined;
  const qualifying = won && savedHere === undefined && qualifies(entries, shotCount(game.ai));
  const rank = savedHere === undefined ? undefined : rankOf(entries, savedHere.id);

  const submit = (name: string): boolean => {
    if (!qualifying || normalizeName(name) === '') return false;
    const id = newId();
    const placed = store.add(entryFor(game, id, name, new Date().toISOString()));
    if (placed) setSaved({ game, id });
    return placed;
  };

  const latest = entries.reduce<LeaderboardEntry | undefined>(
    (best, e) => (best === undefined || e.playedAt > best.playedAt ? e : best),
    undefined,
  );

  return {
    entries,
    qualifying,
    saved: savedHere !== undefined,
    rank,
    /** Name from the most recent entry, to prefill the prompt. */
    lastName: latest?.name ?? '',
    submit,
    clear: store.clear,
  };
};
