import { fleetCellCount, hitCount, shotCount } from '../engine/board';
import { DIFFICULTIES, type Difficulty, type GameState, type Player } from '../engine/types';

export type SideStats = { shots: number; hits: number; fleetCells: number };

export type MatchRecord = {
  /** Unique per match; the dedupe key. */
  id: string;
  /** ISO-8601 timestamp of game over. */
  playedAt: string;
  /** Game seed (gameplay metadata; not unique — 32 random bits). */
  seed: number;
  difficulty: Difficulty;
  winner: Player;
  you: SideStats;
  enemy: SideStats;
};

export const STORAGE_KEY = 'battleship-ai.matches.v1';
export const MAX_MATCHES = 100;

/** Pure: derives the record from a finished game. Throws if the game is not over. */
export const recordFor = (game: GameState, id: string, playedAt: string): MatchRecord => {
  if (game.phase !== 'gameover' || game.winner === undefined) {
    throw new Error('recordFor: game is not over');
  }
  return {
    id,
    playedAt,
    seed: game.seed,
    difficulty: game.difficulty,
    winner: game.winner,
    you: {
      shots: shotCount(game.ai),
      hits: hitCount(game.ai),
      fleetCells: fleetCellCount(game.ai),
    },
    enemy: {
      shots: shotCount(game.human),
      hits: hitCount(game.human),
      fleetCells: fleetCellCount(game.human),
    },
  };
};

/** Newest first, deduplicated by `id`, capped at `MAX_MATCHES`. */
export const appendMatch = (
  matches: readonly MatchRecord[],
  match: MatchRecord,
): readonly MatchRecord[] =>
  matches.some((m) => m.id === match.id) ? matches : [match, ...matches].slice(0, MAX_MATCHES);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isSide = (v: unknown): v is SideStats =>
  isRecord(v) && isCount(v.shots) && isCount(v.hits) && isCount(v.fleetCells);
const isDifficulty = (v: unknown): v is Difficulty =>
  typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);

export const isMatchRecord = (v: unknown): v is MatchRecord =>
  isRecord(v) &&
  typeof v.id === 'string' &&
  v.id.length > 0 &&
  typeof v.playedAt === 'string' &&
  !Number.isNaN(Date.parse(v.playedAt)) &&
  isCount(v.seed) &&
  isDifficulty(v.difficulty) &&
  (v.winner === 'human' || v.winner === 'ai') &&
  isSide(v.you) &&
  isSide(v.enemy);

/**
 * Anything unreadable (missing key, corrupt JSON, foreign shape) yields an empty history.
 * Capped at `MAX_MATCHES` so an oversized stored list is bounded on read as well as write.
 */
export const parseMatches = (raw: string | null): readonly MatchRecord[] => {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMatchRecord).slice(0, MAX_MATCHES) : [];
  } catch {
    return [];
  }
};

/** Minimal slice of the Web Storage API so tests can pass a plain object. */
export type MatchStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const loadMatches = (storage: MatchStorage): readonly MatchRecord[] =>
  parseMatches(storage.getItem(STORAGE_KEY));

export const saveMatches = (storage: MatchStorage, matches: readonly MatchRecord[]): void => {
  if (matches.length === 0) storage.removeItem(STORAGE_KEY);
  else storage.setItem(STORAGE_KEY, JSON.stringify(matches));
};
