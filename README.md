# Battleship vs. AI

Play: **https://anastosj.github.io/battleship-ai/**

Single-player Battleship in the browser against an AI. Pure TypeScript rules engine, React UI,
no backend, deployed to GitHub Pages on every push to `main`.

## Status

Walking skeleton (PR 1): fixed fleets, human fires first, AI fires at random. Placement,
coin flip and the Hunt/Target AI follow in later PRs — see `docs/BUGLOG.md` for the running
bug/miss log.

## Develop

```
npm ci
npm run dev          # http://localhost:5173/battleship-ai/
npm run lint         # eslint + prettier --check
npm run typecheck    # tsc -b
npm test             # vitest
npm run build        # dist/
```

## Layout

- `src/engine/` — pure game rules. Never mutates input; every function returns new state.
- `src/ai/` — the opponent. May import only `AIView`-related types; never the board.
- `src/ui/` — React components and the `useGame` reducer hook.
- `tests/` — Vitest.
- `docs/BUGLOG.md` — running log of bugs and misses.

MIT.
