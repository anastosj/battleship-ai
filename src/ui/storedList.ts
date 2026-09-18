import type { MatchStorage } from '../history/matches';

/** `window.localStorage` can throw (disabled, private mode); treat that as "no storage". */
export const defaultStorage = (): MatchStorage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Cross-tab change notifications; `undefined` outside a browser. */
export type StorageEvents = {
  addEventListener(type: 'storage', listener: (e: StorageEvent) => void): void;
  removeEventListener(type: 'storage', listener: (e: StorageEvent) => void): void;
};
export const defaultEvents = (): StorageEvents | undefined =>
  typeof window === 'undefined' ? undefined : window;

type Options<T> = {
  key: string;
  parse: (raw: string | null) => readonly T[];
  storage?: MatchStorage | undefined;
  events?: StorageEvents | undefined;
};

/**
 * Tiny external store over one storage key holding a list. Every write re-reads storage
 * first, and other tabs' writes arrive via the `storage` event, so two tabs never clobber
 * each other. Storage that throws degrades to an in-memory list.
 */
export const createStoredList = <T>({
  key,
  parse,
  storage = defaultStorage(),
  events = defaultEvents(),
}: Options<T>) => {
  const read = (): readonly T[] | undefined => {
    try {
      return storage ? parse(storage.getItem(key)) : undefined;
    } catch {
      return undefined;
    }
  };
  let items: readonly T[] = read() ?? [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const set = (next: readonly T[]) => {
    if (next === items) return;
    items = next;
    try {
      if (storage) {
        if (next.length === 0) storage.removeItem(key);
        else storage.setItem(key, JSON.stringify(next));
      }
    } catch {
      /* storage full or blocked: keep the in-memory list */
    }
    notify();
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== key && e.key !== null) return;
    if (e.storageArea && e.storageArea !== storage) return;
    items = parse(e.newValue);
    notify();
  };

  return {
    get: () => items,
    subscribe: (l: () => void) => {
      if (listeners.size === 0) events?.addEventListener('storage', onStorage);
      listeners.add(l);
      return () => {
        listeners.delete(l);
        if (listeners.size === 0) events?.removeEventListener('storage', onStorage);
      };
    },
    /** Applies `fn` to the freshest list available (storage first, memory as fallback). */
    update: (fn: (current: readonly T[]) => readonly T[]) => set(fn(read() ?? items)),
    clear: () => set([]),
  };
};
