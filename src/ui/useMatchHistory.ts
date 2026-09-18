import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  STORAGE_KEY,
  appendMatch,
  loadMatches,
  parseMatches,
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

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Cross-tab change notifications; `undefined` outside a browser. */
type StorageEvents = {
  addEventListener(type: 'storage', listener: (e: StorageEvent) => void): void;
  removeEventListener(type: 'storage', listener: (e: StorageEvent) => void): void;
};
const defaultEvents = (): StorageEvents | undefined =>
  typeof window === 'undefined' ? undefined : window;

/**
 * Tiny external store over one storage key. Every write re-reads storage first, and
 * other tabs' writes arrive via the `storage` event, so two tabs never clobber each other.
 */
export const createMatchStore = (
  storage: MatchStorage | undefined = defaultStorage(),
  events: StorageEvents | undefined = defaultEvents(),
) => {
  const read = (): readonly MatchRecord[] | undefined => {
    try {
      return storage ? loadMatches(storage) : undefined;
    } catch {
      return undefined;
    }
  };
  let matches: readonly MatchRecord[] = read() ?? [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const set = (next: readonly MatchRecord[]) => {
    if (next === matches) return;
    matches = next;
    try {
      if (storage) saveMatches(storage, next);
    } catch {
      /* storage full or blocked: keep the in-memory list */
    }
    notify();
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return;
    if (e.storageArea && e.storageArea !== storage) return;
    matches = parseMatches(e.newValue);
    notify();
  };

  return {
    get: () => matches,
    subscribe: (l: () => void) => {
      if (listeners.size === 0) events?.addEventListener('storage', onStorage);
      listeners.add(l);
      return () => {
        listeners.delete(l);
        if (listeners.size === 0) events?.removeEventListener('storage', onStorage);
      };
    },
    add: (record: MatchRecord) => set(appendMatch(read() ?? matches, record)),
    clear: () => set([]),
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
