# Battleship vs. AI

Play: **https://anastosj.github.io/battleship-ai/**

Single-player Battleship in the browser against an AI. Pure TypeScript rules engine, React UI,
no backend, deployed to GitHub Pages on every push to `main`.

## Status

Playable end to end: manual placement (click, **R** to rotate, pick ships back up) or
"Randomize fleet" (repeatable), one-shot coin flip for first move (heads = you, tails = AI),
Hunt/Target AI with a 250 ms reply, fleet panels, game-over modal with "Play again".
Responsive/accessibility polish and an error boundary follow in PR 4 — see `docs/BUGLOG.md` for
the running bug/miss log.

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
- `docs/BUGLOG.md` — running log of bugs and misses.

MIT.
