# Battleship: Captain Devin

Play: **https://anastosj.github.io/battleship-ai/**

Single-player Battleship in the browser against an AI. Pure TypeScript rules engine, React UI,
no backend, deployed to GitHub Pages on every push to `main`.

## Status

Complete and deployed. Manual placement (click, **R** to rotate, pick ships back up) or
"Randomize fleet" (repeatable); **Easy / Medium / No Pacing the Frontier** opponent, locked once
you confirm your fleet; an optional **AI threat map** over your own board;
one-shot coin flip for first move (heads = you, tails = AI) with the landed face held for 1.5 s;
Hunt/Target AI replying after 500 ms; fleet panels; game-over modal with shots / hits / accuracy
for both sides and "Play again". Finished games are saved to a **match history** (last 100, on
this device) and a win that places in the **top-10 leaderboard** (fewest shots) prompts for a
callsign. Both live in `localStorage`, sync across tabs, and can be cleared from the placement
screen. "Captain Devin" phosphor-console theme (VT323). Phone layout puts the board you act on
first with a fixed-height sticky status line; every cell is a labelled `<button>` with a state
glyph (never colour alone); a React error boundary turns a crash into a message with a reload
button.

Spec: [`docs/SPEC.md`](./docs/SPEC.md) (v0.2, frozen before coding; deviations table at the top).
Bugs: [`docs/BUGS.md`](./docs/BUGS.md) (short write-up) and [`docs/BUGLOG.md`](./docs/BUGLOG.md)
(all 39 entries).

## How to play

1. **Place your fleet** — pick a ship from the tray and click your board. **R** (or the Rotate
   button) toggles orientation; green preview = legal, red = not. Click a placed ship to pick it
   up again, or press **Randomize fleet** as often as you like.
2. **Flip the coin** — once. Heads: you fire first. Tails: the AI opens.
3. **Fire** by clicking a cell in Enemy waters. Miss `•`, hit `✕`, sunk `☒`. The AI answers
   500 ms later. First to sink all five ships wins; the enemy's surviving ships are revealed at
   the end.

## The AI

Three opponents, chosen on the placement screen and locked once you continue to the coin flip.
All see only their own shots and their results (`AIView`) — never the board — and a test
enforces that `src/ai/**` cannot import the board types.

**Easy** (`src/ai/easy.ts`) hunts uniformly at random and, after a hit, fires at the open
neighbours of its latest hit. When anything sinks it forgets every outstanding hit — the naive
behaviour BUGLOG #1 warns about — so it averages ≈70 shots to clear a board.

**Medium** (`src/ai/huntTarget.ts`, the default, ≈50 shots) is the full Hunt/Target AI. Hunt: checkerboard parity filtered by whether the smallest surviving ship still fits. Target:
extend lines through unresolved hits; when a ship sinks, infer which hits belonged to it from the
reported length so a touching ship is not abandoned (see `docs/BUGLOG.md` #1, #8). A self-play test
checks the average shots-to-win over random fleets stays within 46–65.

**No Pacing the Frontier** (`src/ai/density.ts`, ≈42 shots) is a probability-density AI. Each
turn it enumerates every position each surviving ship could still legally occupy — not across
a miss, not across a cell attributed to a sunk ship — and counts how many of those placements
cover each unfired cell; it fires at the maximum. While it has unresolved hits only placements
that cover one of them count (weighted by how many they cover), so the map collapses onto the
cells that finish a wounded ship. Sunk attribution is shared with Medium (`replay`). Its band
test is 38–48. Head-to-head over 1,000 self-play games the winner needed 39.7 shots on average
versus Medium's 45.6 (`npm run selfplay -- 1000 1 expert`).

**AI threat map.** During any game the "Show AI threat map" toggle (on by default) under your own board shades
each unfired cell by that same density (brightest = the cell No Pacing the Frontier would fire
at next) and appends `threat N%` to the cell's label, so the visual is never colour-only.

See `docs/BUGS.md` for the bug write-up and `docs/BUGLOG.md` for the running log of bugs and
first-attempt misses.

## How it was built

The project was a test of directing an AI software agent (Devin) end to end. The owner wrote
the brief, reviewed and revised the spec (v0.1 → v0.2 — the `AIView` information boundary and
the touching-ships rule in §5.3 were both spec-review catches), then approved and played every
slice. Devin wrote the code, tests and log entries.

- **Twelve thin vertical slices, one PR each.** Skeleton → AI → placement/coin flip → polish →
  difficulty → history → leaderboard → theme → four feedback/mobile passes. Each was deployed to
  Pages and played in a real browser (recorded) before the next started. The spec planned three
  parallel child sessions; sequential slices were chosen instead so each PR could be played
  before the next one built on it.
- **Every PR:** `lint`, `typecheck`, `test`, `build` in CI; Devin Review on the diff (five of
  the 37 log entries came from review); a BUGLOG entry for anything wrong on the first attempt,
  including misses that never shipped.
- **Ground truth over unit tests.** The AI was fuzzed over 5,000 random fleets with a "never
  abandon a live hit" oracle (found #8, a 1-in-5,000 error). Layout and touch bugs (#15, #17,
  #24, #30, #34, #36) were all found by playing, never by jsdom.
- **Owner decisions, not agent decisions.** Where the spec turned out wrong the rule was "stop
  and ask": the shot-count band (#9), the AI reply delay (#29), adding Easy/Hard after release (PR 5), cutting the
  scanlines after playing the preview (#31), the blinking Continue button (#32). Each is logged
  as a deviation with who decided.
- **Security scan at the end** found one Medium (#37: a size cap enforced on write but not on
  read); fixed in PR #21 with unit and browser tests.

## Known limits

- **No backend.** History and leaderboard are per-device `localStorage`; nothing syncs between
  devices, and clearing site data clears them. `localStorage` is also the app's only trust
  boundary — the read paths validate every record and cap list sizes (#37), but anything
  same-origin can still edit your own scores.
- **Two tabs finishing games at nearly the same time** can lose one row: each tab re-reads
  storage just before writing, but Web Storage has no atomic read-modify-write, so two writes
  whose read-then-write windows overlap keep only the later one (#26). Ordinary cross-tab use is
  handled via the `storage` event.
- **The Hard AI's sunk-ship inference is a heuristic.** With touching ships and an unlucky hit
  order it can attribute the wrong cells; a recovery path (#8) keeps it from abandoning a live
  hit, but roughly 1 in 5,000 games still costs it a few extra shots.
- **Not implemented:** two-player, salvo variant, sound, undo, persistent settings.

## Develop

```
npm ci
npm run dev          # http://localhost:5173/battleship-ai/
npm run lint         # eslint + prettier --check
npm run typecheck    # tsc -b
npm test             # vitest
npm run build        # dist/
npm run selfplay -- 1000          # AI vs AI fuzz: invariants + shot-count stats (Medium)
npm run selfplay -- 1000 1 expert # same for No Pacing the Frontier (easy | hard | expert)
```

## Layout

- `src/engine/` — pure game rules. Never mutates input; every function returns new state.
- `src/ai/` — the opponent. May import only `AIView`-related types; never the board.
- `src/ui/` — React components and the `useGame` reducer hook.
- `tests/` — Vitest.
- `src/history/` — pure match-history and leaderboard records (parse, validate, rank, cap).
- `docs/SPEC.md` — the frozen v0.2 spec; `docs/BUGS.md` — the bug write-up; `docs/BUGLOG.md` —
  running log of bugs and misses.

MIT.
