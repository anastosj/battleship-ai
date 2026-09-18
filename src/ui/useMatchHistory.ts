import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  appendMatch,
  loadMatches,
  recordFor,
  saveMatches,
  type MatchRecord,
  type MatchStorage,
} from '../history/matches';
import type { GameState } from '../engine/types';

/** `window.localStorage` can throw (disabled, private mode); treat that as "no storage". */
const defaultStorage = (): MatchStorage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

/** Tiny external store: one list of matches, mirrored to storage on every change. */
export const createMatchStore = (storage: MatchStorage | undefined = defaultStorage()) => {
  let matches: readonly MatchRecord[] = [];
  try {
    if (storage) matches = loadMatches(storage);
  } catch {
    /* unreadable storage: start empty */
  }
  const listeners = new Set<() => void>();

  const set = (next: readonly MatchRecord[]) => {
    if (next === matches) return;
    matches = next;
    try {
      if (storage) saveMatches(storage, next);
    } catch {
      /* storage full or blocked: keep the in-memory list */
    }
    listeners.forEach((l) => l());
  };

  return {
    get: () => matches,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    add: (record: MatchRecord) => set(appendMatch(matches, record)),
    clear: () => set([]),
  };
};

export type MatchStore = ReturnType<typeof createMatchStore>;

/**
 * Browser-local match history, loaded from storage on mount. Records `game` once when
 * it reaches `gameover` (deduplicated by seed, so re-renders and Play again cannot double-count).
 */
export const useMatchHistory = (game: GameState) => {
  const [store] = useState(() => createMatchStore());
  const matches = useSyncExternalStore(store.subscribe, store.get, store.get);

  useEffect(() => {
    if (game.phase === 'gameover') store.add(recordFor(game, new Date().toISOString()));
  }, [game, store]);

  return { matches, clear: store.clear };
};
