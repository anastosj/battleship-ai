import { randomInt } from '../engine/rng';
import { replay } from './huntTarget';
import {
  SHIP_SIZES,
  coordKey,
  type AIView,
  type Coord,
  type RNG,
  type ShipKind,
} from '../engine/types';

const ALL_KINDS: readonly ShipKind[] = [
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
];

/** Row-major `boardSize²` weights; 0 for cells already fired at. */
export type Density = readonly number[];

const index = (c: Coord, size: number): number => c.row * size + c.col;

type Knowledge = {
  size: number;
  sizes: readonly number[];
  blocked: ReadonlySet<string>;
  unresolved: ReadonlySet<string>;
  targeted: ReadonlySet<string>;
};

const count = (k: Knowledge, targeting: boolean): number[] => {
  const map = new Array<number>(k.size * k.size).fill(0);
  for (const L of k.sizes) {
    for (let row = 0; row < k.size; row++) {
      for (let col = 0; col < k.size; col++) {
        for (const axis of ['h', 'v'] as const) {
          const cells: Coord[] = [];
          let covered = 0;
          let legal = true;
          for (let d = 0; d < L; d++) {
            const c = axis === 'h' ? { row, col: col + d } : { row: row + d, col };
            if (c.row >= k.size || c.col >= k.size || k.blocked.has(coordKey(c))) {
              legal = false;
              break;
            }
            if (k.unresolved.has(coordKey(c))) covered++;
            cells.push(c);
          }
          if (!legal || (targeting && covered === 0)) continue;
          const weight = targeting ? 10 ** covered : 1;
          for (const c of cells) {
            if (!k.targeted.has(coordKey(c))) map[index(c, k.size)]! += weight;
          }
        }
      }
    }
  }
  return map;
};

/**
 * Probability-density map. For every surviving ship, enumerate every position it could still
 * legally occupy — not over a miss, not over a cell attributed to a sunk ship — and count how
 * many of those placements cover each untargeted cell. While unresolved hits exist only
 * placements that cover at least one of them count, weighted by how many they cover, so the
 * map collapses onto the cells that complete a wounded ship. If attribution has boxed a hit
 * in so that no placement can cover it, the map falls back to the plain hunt count.
 */
export const densityMap = (view: AIView): Density => {
  const mem = replay(view.shots);
  const blocked = new Set<string>();
  for (const s of view.shots) if (s.result === 'miss') blocked.add(coordKey(s.coord));
  const unresolved = new Set(mem.unresolved.map((h) => coordKey(h.coord)));
  for (const h of mem.hits) if (!unresolved.has(h)) blocked.add(h);
  const k: Knowledge = {
    size: view.boardSize,
    sizes: ALL_KINDS.filter((s) => !view.sunkShips.includes(s)).map((s) => SHIP_SIZES[s]),
    blocked,
    unresolved,
    targeted: mem.targeted,
  };
  if (unresolved.size > 0) {
    const targeted = count(k, true);
    if (targeted.some((v) => v > 0)) return targeted;
  }
  return count(k, false);
};

/** `densityMap` scaled so the hottest cell is 1, for display. */
export const normalizedDensity = (view: AIView): Density => {
  const map = densityMap(view);
  const max = Math.max(0, ...map);
  return max === 0 ? map : map.map((v) => v / max);
};

/** Expert AI: fires at the most probable cell of the density map, breaking ties with the RNG. */
export const chooseShot = (view: AIView, rng: RNG): Coord => {
  const size = view.boardSize;
  const map = densityMap(view);
  const best = Math.max(0, ...map);
  const cellAt = (i: number): Coord => ({ row: Math.floor(i / size), col: i % size });
  if (best > 0) {
    const top = map.flatMap((v, i) => (v === best ? [i] : []));
    return cellAt(top[randomInt(rng, top.length)]!);
  }
  // Every legal placement is exhausted (only possible after a mis-attribution): any open cell.
  const fired = new Set(view.shots.map((s) => coordKey(s.coord)));
  const open: Coord[] = [];
  for (let i = 0; i < size * size; i++) if (!fired.has(coordKey(cellAt(i)))) open.push(cellAt(i));
  if (open.length === 0) throw new Error('No cells left to fire at');
  return open[randomInt(rng, open.length)]!;
};
