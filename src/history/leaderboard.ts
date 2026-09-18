import { shotCount } from '../engine/board';
import { DIFFICULTIES, type Difficulty, type GameState } from '../engine/types';
import type { MatchStorage } from './matches';

/** One human win, ranked by fewest shots. Independent of match history (survives "Clear history"). */
export type LeaderboardEntry = {
  /** Unique per entry; the dedupe key. */
  id: string;
  name: string;
  shots: number;
  difficulty: Difficulty;
  /** ISO-8601 timestamp of the win. */
  playedAt: string;
};

export const LEADERBOARD_KEY = 'battleship-ai.leaderboard.v1';
export const MAX_ENTRIES = 10;
export const MAX_NAME_LENGTH = 20;

/** Trim, collapse inner whitespace, clamp length. Empty result means "no name given". */
export const normalizeName = (raw: string): string =>
  raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();

/** Fewest shots first; ties go to the earlier win; then by id so the order is total. */
export const compareEntries = (a: LeaderboardEntry, b: LeaderboardEntry): number =>
  a.shots - b.shots || a.playedAt.localeCompare(b.playedAt) || a.id.localeCompare(b.id);

export const rankEntries = (entries: readonly LeaderboardEntry[]): readonly LeaderboardEntry[] =>
  [...entries].sort(compareEntries).slice(0, MAX_ENTRIES);

/** Would a win in `shots` shots make the board? Ties with the last place do not displace it. */
export const qualifies = (entries: readonly LeaderboardEntry[], shots: number): boolean => {
  const ranked = rankEntries(entries);
  return ranked.length < MAX_ENTRIES || shots < ranked[ranked.length - 1]!.shots;
};

/** 1-based position `entry` holds in `entries`, or `undefined` if it is not on the board. */
export const rankOf = (entries: readonly LeaderboardEntry[], id: string): number | undefined => {
  const i = rankEntries(entries).findIndex((e) => e.id === id);
  return i === -1 ? undefined : i + 1;
};

export const addEntry = (
  entries: readonly LeaderboardEntry[],
  entry: LeaderboardEntry,
): readonly LeaderboardEntry[] =>
  entries.some((e) => e.id === entry.id) ? entries : rankEntries([...entries, entry]);

/** Pure: the entry for a game the human has just won. Throws otherwise. */
export const entryFor = (
  game: GameState,
  id: string,
  name: string,
  playedAt: string,
): LeaderboardEntry => {
  if (game.phase !== 'gameover' || game.winner !== 'human') {
    throw new Error('entryFor: the human has not won this game');
  }
  return {
    id,
    name: normalizeName(name),
    shots: shotCount(game.ai),
    difficulty: game.difficulty,
    playedAt,
  };
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export const isLeaderboardEntry = (v: unknown): v is LeaderboardEntry =>
  isRecord(v) &&
  typeof v.id === 'string' &&
  v.id.length > 0 &&
  typeof v.name === 'string' &&
  v.name.length > 0 &&
  v.name.length <= MAX_NAME_LENGTH &&
  typeof v.shots === 'number' &&
  Number.isInteger(v.shots) &&
  v.shots > 0 &&
  typeof v.difficulty === 'string' &&
  (DIFFICULTIES as readonly string[]).includes(v.difficulty) &&
  typeof v.playedAt === 'string' &&
  !Number.isNaN(Date.parse(v.playedAt));

/** Anything unreadable yields an empty board; readable entries are re-ranked. */
export const parseEntries = (raw: string | null): readonly LeaderboardEntry[] => {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? rankEntries(parsed.filter(isLeaderboardEntry)) : [];
  } catch {
    return [];
  }
};

export const loadEntries = (storage: MatchStorage): readonly LeaderboardEntry[] =>
  parseEntries(storage.getItem(LEADERBOARD_KEY));

export const saveEntries = (storage: MatchStorage, entries: readonly LeaderboardEntry[]): void => {
  if (entries.length === 0) storage.removeItem(LEADERBOARD_KEY);
  else storage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
};
