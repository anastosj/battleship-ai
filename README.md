# Battleship: Captain Devin

Play: **https://anastosj.github.io/battleship-ai/**

Single-player Battleship in the browser against an AI. Pure TypeScript rules engine, React UI,
no backend, deployed to GitHub Pages on every push to `main`.

## Status

Playable end to end: manual placement (click, **R** to rotate, pick ships back up) or
"Randomize fleet" (repeatable), one-shot coin flip for first move (heads = you, tails = AI),
Hunt/Target AI with a 500 ms reply, fleet panels, game-over modal with "Play again". Boards
stack on narrow screens, every cell is a labelled `<button>` with a state glyph (never colour
alone), and a React error boundary turns a crash into a message with a reload button.

## How to play

1. **Place your fleet** — pick a ship from the tray and click your board. **R** (or the Rotate
   button) toggles orientation; green preview = legal, red = not. Click a placed ship to pick it
   up again, or press **Randomize fleet** as often as you like.
2. **Flip the coin** — once. Heads: you fire first. Tails: the AI opens.
3. **Fire** by clicking a cell in Enemy waters. Miss `•`, hit `✕`, sunk `☒`. The AI answers
   500 ms later. First to sink all five ships wins; the enemy's surviving ships are revealed at
   the end.

## The AI

Two opponents, chosen on the placement screen and locked once you continue to the coin flip.
Both see only their own shots and their results (`AIView`) — never the board — and a test
enforces that `src/ai/**` cannot import the board types.

**Easy** (`src/ai/easy.ts`) hunts uniformly at random and, after a hit, fires at the open
neighbours of its latest hit. When anything sinks it forgets every outstanding hit — the naive
behaviour BUGLOG #1 warns about — so it averages ≈70 shots to clear a board.

**Hard** (`src/ai/huntTarget.ts`, the default, ≈50 shots) is the full Hunt/Target AI. Hunt: checkerboard parity filtered by whether the smallest surviving ship still fits. Target:
extend lines through unresolved hits; when a ship sinks, infer which hits belonged to it from the
reported length so a touching ship is not abandoned (see `docs/BUGLOG.md` #1, #8). A self-play test
checks the average shots-to-win over random fleets stays within 46–65.

See `docs/BUGS.md` for the bug write-up and `docs/BUGLOG.md` for the running log of bugs and
first-attempt misses.

## Develop

```
npm ci
npm run dev          # http://localhost:5173/battleship-ai/
npm run lint         # eslint + prettier --check
npm run typecheck    # tsc -b
npm test             # vitest
npm run build        # dist/
npm run selfplay -- 1000   # AI vs AI fuzz: invariants + shot-count stats
```

## Layout

- `src/engine/` — pure game rules. Never mutates input; every function returns new state.
- `src/ai/` — the opponent. May import only `AIView`-related types; never the board.
- `src/ui/` — React components and the `useGame` reducer hook.
- `tests/` — Vitest.
- `docs/BUGS.md` — the bug write-up; `docs/BUGLOG.md` — running log of bugs and misses.

MIT.
