import { randomInt } from '../engine/rng';
import {
  SHIP_SIZES,
  coordKey,
  type AIShot,
  type AIView,
  type Coord,
  type RNG,
  type ShipKind,
} from '../engine/types';

type Axis = 'h' | 'v';

/** An unresolved hit: a hit cell not yet attributed to a sunk ship. `index` = position in the shot log. */
type Hit = { coord: Coord; index: number };

export type Memory = {
  unresolved: readonly Hit[];
  targeted: ReadonlySet<string>;
  hits: ReadonlySet<string>;
};

const ALL_KINDS: readonly ShipKind[] = [
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
];

const same = (a: Coord, b: Coord): boolean => a.row === b.row && a.col === b.col;
const step = (c: Coord, axis: Axis, d: number): Coord =>
  axis === 'h' ? { row: c.row, col: c.col + d } : { row: c.row + d, col: c.col };

/**
 * Replays the AI's own shot log to rebuild its target-mode memory. Doing this from the
 * view (rather than keeping hidden state) keeps `chooseShot` a pure function of `AIView`.
 */
export const replay = (shots: readonly AIShot[]): Memory => {
  let unresolved: Hit[] = [];
  const targeted = new Set<string>();
  const hits = new Set<string>();
  shots.forEach((shot, index) => {
    targeted.add(coordKey(shot.coord));
    if (shot.result === 'miss') return;
    hits.add(coordKey(shot.coord));
    unresolved = [...unresolved, { coord: shot.coord, index }];
    if (shot.result === 'sunk' && shot.sunkShip) {
      unresolved = attributeSunk(unresolved, shot.coord, SHIP_SIZES[shot.sunkShip]);
    }
  });
  return { unresolved, targeted, hits };
};

/** Maximal contiguous run of unresolved hits through `at` along `axis`, ordered low→high. */
const runThrough = (unresolved: readonly Hit[], at: Coord, axis: Axis): Hit[] => {
  const find = (c: Coord) => unresolved.find((h) => same(h.coord, c));
  const run: Hit[] = [];
  for (let d = -1; ; d--) {
    const h = find(step(at, axis, d));
    if (!h) break;
    run.unshift(h);
  }
  const self = find(at);
  if (self) run.push(self);
  for (let d = 1; ; d++) {
    const h = find(step(at, axis, d));
    if (!h) break;
    run.push(h);
  }
  return run;
};

/** All length-L windows of `run` that contain `at`. */
const windows = (run: Hit[], at: Coord, L: number): Hit[][] => {
  const out: Hit[][] = [];
  for (let start = 0; start + L <= run.length; start++) {
    const w = run.slice(start, start + L);
    if (w.some((h) => same(h.coord, at))) out.push(w);
  }
  return out;
};

const minIndexExcluding = (w: Hit[], at: Coord): number =>
  Math.min(...w.filter((h) => !same(h.coord, at)).map((h) => h.index));

/**
 * §5.3 sunk attribution. The sinking shot belongs to the sunk ship; we infer the rest of the
 * ship from the collinear run(s) of unresolved hits through it. Anything left over stays
 * unresolved so a touching ship is never abandoned.
 */
export const attributeSunk = (unresolved: readonly Hit[], at: Coord, L: number): Hit[] => {
  const runs: Record<Axis, Hit[]> = {
    h: runThrough(unresolved, at, 'h'),
    v: runThrough(unresolved, at, 'v'),
  };
  const qualifies = (a: Axis) => runs[a].length >= L;

  let chosen: Hit[] | undefined;
  if (qualifies('h') !== qualifies('v')) {
    const axis: Axis = qualifies('h') ? 'h' : 'v';
    // If several windows contain the sinking cell, take the one whose other end is the earliest hit.
    chosen = windows(runs[axis], at, L).sort(
      (a, b) => minIndexExcluding(a, at) - minIndexExcluding(b, at),
    )[0];
  } else if (qualifies('h') && qualifies('v')) {
    const exact = (['h', 'v'] as const).filter((a) => runs[a].length === L);
    let axis: Axis;
    if (exact.length === 1) {
      axis = exact[0] ?? 'h';
    } else {
      // Still ambiguous: follow the axis of the most recent prior hit.
      const prior = unresolved
        .filter((h) => !same(h.coord, at))
        .reduce<Hit | undefined>(
          (best, h) => (!best || h.index > best.index ? h : best),
          undefined,
        );
      axis = prior && prior.coord.row === at.row ? 'h' : 'v';
    }
    // Most recent L hits along that axis.
    chosen = windows(runs[axis], at, L).sort(
      (a, b) => minIndexExcluding(b, at) - minIndexExcluding(a, at),
    )[0];
  }

  // No collinear run long enough (an earlier mis-attribution): we can only be sure about `at`.
  const remove = chosen ?? [{ coord: at, index: -1 }];
  return unresolved.filter((h) => !remove.some((r) => same(r.coord, h.coord)));
};

const inBounds = (c: Coord, size: number): boolean =>
  c.row >= 0 && c.col >= 0 && c.row < size && c.col < size;

const pick = <T>(items: readonly T[], rng: RNG): T | undefined =>
  items[randomInt(rng, items.length)];

const neighbours = (c: Coord): Coord[] => [
  step(c, 'h', -1),
  step(c, 'h', 1),
  step(c, 'v', -1),
  step(c, 'v', 1),
];

/**
 * Attribution is an inference and can be wrong (e.g. a Destroyer sunk where both axes show a
 * 2-run). When that leaves an unresolved hit boxed in by already-targeted cells, widen the
 * search to untargeted cells bordering any hit connected to it — the mis-attributed cells of
 * the still-live ship are in that component.
 */
const connectedFrontier = (mem: Memory, size: number, largestRemaining: number): Coord[] => {
  const open = (c: Coord) => inBounds(c, size) && !mem.targeted.has(coordKey(c));
  const seen = new Set<string>();
  const queue: Coord[] = mem.unresolved.map((h) => h.coord);
  // frontier cell -> length of the line of hits it would extend
  const frontier = new Map<string, { cell: Coord; behind: number }>();
  for (let c = queue.pop(); c !== undefined; c = queue.pop()) {
    if (seen.has(coordKey(c))) continue;
    seen.add(coordKey(c));
    for (const axis of ['h', 'v'] as const) {
      for (const d of [-1, 1]) {
        const n = step(c, axis, d);
        if (mem.hits.has(coordKey(n))) {
          queue.push(n);
        } else if (open(n)) {
          let behind = 0;
          while (mem.hits.has(coordKey(step(n, axis, -d * (behind + 1))))) behind++;
          // A line already as long as the biggest ship afloat cannot be a live ship's.
          if (behind >= largestRemaining) continue;
          const prev = frontier.get(coordKey(n));
          if (!prev || prev.behind < behind) frontier.set(coordKey(n), { cell: n, behind });
        }
      }
    }
  }
  const best = Math.max(0, ...[...frontier.values()].map((f) => f.behind));
  return [...frontier.values()].filter((f) => f.behind === best).map((f) => f.cell);
};

/** Target-mode candidates: cells extending a collinear run, else neighbours of the newest hit. */
const targetCandidates = (mem: Memory, size: number, largestRemaining: number): Coord[] => {
  const open = (c: Coord) => inBounds(c, size) && !mem.targeted.has(coordKey(c));
  const lineExtensions: { cells: Coord[]; length: number }[] = [];
  for (const h of mem.unresolved) {
    for (const axis of ['h', 'v'] as const) {
      const run = runThrough(mem.unresolved, h.coord, axis);
      if (run.length < 2 || !same(run[0]!.coord, h.coord)) continue;
      const ends = [step(run[0]!.coord, axis, -1), step(run[run.length - 1]!.coord, axis, 1)];
      lineExtensions.push({ cells: ends.filter(open), length: run.length });
    }
  }
  const longest = Math.max(0, ...lineExtensions.map((l) => l.length));
  const extending = lineExtensions.filter((l) => l.length === longest).flatMap((l) => l.cells);
  if (extending.length > 0) return extending;

  const byRecency = [...mem.unresolved].sort((a, b) => b.index - a.index);
  for (const h of byRecency) {
    const around = neighbours(h.coord).filter(open);
    if (around.length > 0) return around;
  }
  return connectedFrontier(mem, size, largestRemaining);
};

/** Longest run of untargeted cells through `c` along `axis`. */
const openRun = (c: Coord, axis: Axis, targeted: ReadonlySet<string>, size: number): number => {
  let n = 1;
  for (const d of [-1, 1]) {
    for (let k = 1; ; k++) {
      const next = step(c, axis, d * k);
      if (!inBounds(next, size) || targeted.has(coordKey(next))) break;
      n++;
    }
  }
  return n;
};

const remainingSizes = (view: AIView): number[] =>
  ALL_KINDS.filter((k) => !view.sunkShips.includes(k)).map((k) => SHIP_SIZES[k]);

/** Hunt-mode candidates: parity cells where the smallest remaining ship could still fit. */
const huntCandidates = (view: AIView, mem: Memory, parity: number): Coord[] => {
  const size = view.boardSize;
  const smallest = Math.min(...remainingSizes(view));
  const all: Coord[] = [];
  const onParity: Coord[] = [];
  const fitting: Coord[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const c = { row, col };
      if (mem.targeted.has(coordKey(c))) continue;
      all.push(c);
      if ((row + col) % 2 !== parity) continue;
      onParity.push(c);
      const fits =
        openRun(c, 'h', mem.targeted, size) >= smallest ||
        openRun(c, 'v', mem.targeted, size) >= smallest;
      if (fits) fitting.push(c);
    }
  }
  if (fitting.length > 0) return fitting;
  if (onParity.length > 0) return onParity;
  return all;
};

/**
 * Hunt/Target AI. Pure function of the AI's own view and a seeded RNG — it never sees the
 * opponent's board. Parity is fixed per game by the very first shot, so it is stable across
 * turns without hidden state.
 */
export const chooseShot = (view: AIView, rng: RNG): Coord => {
  const mem = replay(view.shots);
  const first = view.shots[0];
  const parity = first ? (first.coord.row + first.coord.col) % 2 : randomInt(rng, 2);

  if (mem.unresolved.length > 0) {
    const largest = Math.max(0, ...remainingSizes(view));
    const target = pick(targetCandidates(mem, view.boardSize, largest), rng);
    if (target) return target;
  }
  const shot = pick(huntCandidates(view, mem, parity), rng);
  if (!shot) throw new Error('No cells left to fire at');
  return shot;
};
