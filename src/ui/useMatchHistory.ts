import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  STORAGE_KEY,
  appendMatch,
  parseMatches,
  recordFor,
  type MatchRecord,
  type MatchStorage,
} from '../history/matches';
import type { GameState } from '../engine/types';
import {
  createStoredList,
  defaultEvents,
  defaultStorage,
  newId,
  type StorageEvents,
} from './storedList';

export const createMatchStore = (
  storage: MatchStorage | undefined = defaultStorage(),
  events: StorageEvents | undefined = defaultEvents(),
) => {
  const list = createStoredList<MatchRecord>({
    key: STORAGE_KEY,
    parse: parseMatches,
    storage,
    events,
  });
  return {
    get: list.get,
    subscribe: list.subscribe,
    add: (record: MatchRecord) => list.update((current) => appendMatch(current, record)),
    clear: list.clear,
  };
};

export type MatchStore = ReturnType<typeof createMatchStore>;

/**
 * Browser-local match history, loaded from storage on mount. Each finished game is
 * recorded exactly once: the effect remembers the last `game` object it recorded.
 */
export const useMatchHistory = (game: GameState) => {
  const [store] = useState(() => createMatchStore());
  const matches = useSyncExternalStore(store.subscribe, store.get, store.get);
  const recorded = useRef<GameState | undefined>(undefined);

  useEffect(() => {
    if (game.phase !== 'gameover' || recorded.current === game) return;
    recorded.current = game;
    store.add(recordFor(game, newId(), new Date().toISOString()));
  }, [game, store]);

  return { matches, clear: store.clear };
};
