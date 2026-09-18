/**
 * AI-vs-AI fuzz harness (spec §8.3). Usage: `npm run selfplay -- [games] [startSeed]`.
 * Both sides use the Hunt/Target AI on random fleets. Any thrown error or invariant violation
 * prints the offending seed and exits non-zero.
 */
import { chooseShot } from '../src/ai/huntTarget';
import { randomFleet } from '../src/engine/fleet';
import { fire, newGame, toAIView } from '../src/engine/game';
import { makeRng } from '../src/engine/rng';
import {
  BOARD_SIZE,
  coordKey,
  type AIShot,
  type AIView,
  type GameState,
  type Player,
  type ShotResult,
} from '../src/engine/types';

const games = Number(process.argv[2] ?? 1000);
const startSeed = Number(process.argv[3] ?? 1);

const toShot = (coord: AIShot['coord'], r: ShotResult): AIShot => {
  if (r.kind === 'invalid') throw new Error('invalid shot recorded');
  return r.kind === 'sunk'
    ? { coord, result: 'sunk', sunkShip: r.ship }
    : { coord, result: r.kind };
};

const viewFrom = (shots: readonly AIShot[]): AIView => ({
  shots,
  sunkShips: shots.flatMap((s) => (s.sunkShip ? [s.sunkShip] : [])),
  boardSize: BOARD_SIZE,
});

const invariant = (cond: boolean, msg: string, seed: number) => {
  if (!cond) throw new Error(`[seed ${seed}] invariant violated: ${msg}`);
};

const playOne = (seed: number): { winner: Player; shots: Record<Player, number> } => {
  const rng = makeRng(seed);
  let s: GameState = newGame(seed, {
    human: randomFleet(makeRng(seed * 7 + 1)),
    ai: randomFleet(makeRng(seed * 7 + 2)),
  });
  // The engine keeps the AI's own log; the "human" side here is a second AI so we log it ourselves.
  let humanLog: AIShot[] = [];
  const fired: Record<Player, Set<string>> = { human: new Set(), ai: new Set() };
  const hits: Record<Player, number> = { human: 0, ai: 0 };
  let turns = 0;

  while (s.phase === 'playing') {
    const shooter = s.turn;
    const view = shooter === 'ai' ? toAIView(s) : viewFrom(humanLog);
    const at = chooseShot(view, rng);
    const key = coordKey(at);
    invariant(!fired[shooter].has(key), `${shooter} repeated ${key}`, seed);
    fired[shooter].add(key);

    const { state, result } = fire(s, shooter, at);
    invariant(result.kind !== 'invalid', `${shooter} invalid shot ${key}`, seed);
    if (result.kind !== 'miss') hits[shooter]++;
    invariant(hits[shooter] <= 17, `${shooter} has ${hits[shooter]} hits`, seed);
    invariant(
      state.phase === 'gameover' || state.turn !== shooter,
      `turn did not pass after ${shooter}'s shot`,
      seed,
    );
    if (shooter === 'human') humanLog = [...humanLog, toShot(at, result)];
    s = state;
    invariant(++turns <= 200, 'game did not finish in 200 turns', seed);
  }

  const after = fire(s, s.turn, { row: 0, col: 0 });
  invariant(
    after.result.kind === 'invalid' && after.result.reason === 'game-over',
    'shot accepted after gameover',
    seed,
  );
  const winner = s.winner;
  if (winner === undefined) throw new Error(`[seed ${seed}] game over without a winner`);
  invariant(hits[winner] === 17, 'winner without 17 hits', seed);

  return { winner, shots: { human: fired.human.size, ai: fired.ai.size } };
};

let failures = 0;
const counts: number[] = [];
const wins: Record<Player, number> = { human: 0, ai: 0 };
const t0 = performance.now();
for (let seed = startSeed; seed < startSeed + games; seed++) {
  try {
    const r = playOne(seed);
    wins[r.winner]++;
    counts.push(r.shots[r.winner]);
  } catch (e) {
    failures++;
    console.error(e instanceof Error ? e.message : String(e));
  }
}
counts.sort((a, b) => a - b);
const avg = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length);
console.log(
  `${games} games in ${Math.round(performance.now() - t0)} ms — winner shots: avg ${avg.toFixed(1)}, ` +
    `min ${counts[0]}, p50 ${counts[Math.floor(counts.length / 2)]}, max ${counts[counts.length - 1]}; ` +
    `first mover won ${wins.human}/${games}; failures ${failures}`,
);
if (failures > 0) process.exit(1);
