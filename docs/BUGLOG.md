# Bug & miss log

Running log, appended to in every PR. Bugs, near-misses, design holes, review corrections —
anything that was wrong on the first attempt. `docs/BUGS.md` is written from this at the end.

Entry format:

```
### <title>                      (date, PR, layer: engine | ai | ui/state | build/deploy | process | test)
Symptom:
First attempt:
Root cause:
Fix:
Test added:
Would have caught earlier:
```

---

### 1. Target mode can't know which cells belonged to the sunk ship (2026-09-18, pre-PR-1, layer: ai / design)

Symptom: Spec v0.1 §5 said the AI's target mode should "clear the stack of that ship's cells"
when a ship is reported sunk. Caught in review of the spec, before any code existed.

First attempt: The v0.1 wording assumed the shooter knows the geometry of the ship it just sank.
It does not — the only feedback is "sunk <kind>", i.e. a length. Because touching ships are
allowed, a Destroyer flush against a Cruiser means the sinking shot can be adjacent to an
unresolved hit on the _other_ ship, and naive stack-clearing would abandon a live target.

Root cause: Under-specified information model. The spec described the AI from the game's
point of view (which knows every ship's cells) instead of from the AI's point of view (which
only sees shot results).

Fix (spec v0.2 §5.1 + §5.3): (a) introduce `AIView` — the AI receives only its own shot log and
the list of ships it has sunk, never the board; (b) keep an `unresolvedHits` set and, on "sunk
of length L", attribute exactly L collinear hits through the sinking cell to that ship; any
hits left over keep the AI in target mode. Hunt mode resumes only when `unresolvedHits` is empty.

Test added: none yet — PR 2 must add three scenario tests (end-to-end touching, side-by-side
parallel, L-shaped corner sink) asserting the AI never abandons a live hit.

Would have caught earlier: Writing the AI's input type before writing the AI's algorithm. Any
strategy description that references data outside that type is a spec bug.

### 2. Vite template drifted from the spec'd stack (2026-09-18, PR 1, layer: build/deploy)

Symptom: `npm create vite@latest -- --template react-ts` produced React 19, TypeScript 6,
`oxlint` instead of ESLint, and no `strict` in `tsconfig`.

First attempt: Accepting the template as-is would have silently violated §7 (React 18, ESLint,
TS strict) — the spec owner asked that no spec change go unflagged.

Root cause: Template defaults move; the spec pins versions.

Fix: Pinned `react@18`, `typescript@~5.9`, replaced oxlint with ESLint 9 flat config +
typescript-eslint + react-hooks, enabled `strict` and `noUncheckedIndexedAccess`.

Test added: n/a (`npm run lint` / `npm run typecheck` in CI enforce it).

Would have caught earlier: Reading the generated `package.json` before installing anything else.

### 3. `Date.now()` called during render in `useGame` (2026-09-18, PR 1, layer: ui/state)

Symptom: `eslint-plugin-react-hooks` `purity` rule errored on
`useGame = (initialSeed = Date.now())`.

First attempt: A default parameter looked harmless because `useReducer`'s initializer only runs
once. But the default is re-evaluated on every render, and `useRef(makeRng(initialSeed))` was
also re-evaluated (result discarded) every render — wasted work and a latent seed mismatch if
anything ever read `initialSeed` after mount.

Root cause: Impure expression in render path.

Fix: Seed is generated inside the reducer's lazy initializer; the RNG ref is created lazily
from `game.seed` on first render and rebuilt explicitly on reset.

Test added: none (lint rule covers it).

Would have caught earlier: The lint rule did — this is a "lint paid for itself" entry.

### 4. React Testing Library did not unmount between tests (2026-09-18, PR 1, layer: test)

Symptom: Second `App` test failed with "Found multiple elements with role button and name
'A1, water'" — two `<App>`s were mounted.

First attempt: Assumed RTL auto-cleanup, as it does under Jest.

Root cause: RTL's auto-cleanup hooks into a global `afterEach`; Vitest only exposes that when
`globals: true`, which this config doesn't set.

Fix: `tests/setup.ts` registers `afterEach(cleanup)` explicitly.

Test added: n/a — every UI test now depends on it.

Would have caught earlier: Two trivial render tests in the scaffold PR (which is exactly how it
was caught).

### 5. `GameState` gained an `aiShots` log not in the spec's data model (2026-09-18, PR 1, layer: engine — flagged)

Symptom: Spec §4 says `toAIView(state)` is "derived only from the AI's shot results". Deriving
"sunk" from the final board is wrong: after a ship is sunk every one of its cells reads as a hit,
so you can't recover _which_ shot was the sinking one — and that is exactly what §5.3 needs.

Fix: `fire()` appends `{coord, result, sunkShip?}` to `state.aiShots` when the shooter is the
AI; `toAIView` returns that log. Additive change to `GameState`; flagged in the PR 1 description
for the spec owner.

Would have caught earlier: Same lesson as entry 1 — define the AI's input first.

### 6. Human's shot result was overwritten 250 ms later by the AI's (2026-09-18, PR 1, layer: ui/state, found by playing)

Symptom: Sank the enemy Cruiser; "You sank their Cruiser!" flashed and was replaced by
"Enemy missed." before it could be read. Only visible when actually playing — every unit test
passed.

First attempt: A single `status: string` in the reducer, overwritten by whichever shot was last.

Root cause: Two independent events (my result, their result) modelled as one field.

Fix: Reducer keeps `lastHuman` and `lastAi`; a human shot clears `lastAi`, an AI shot fills it.
Status line shows both: "You sank their Cruiser! Enemy missed."

Test added: `tests/app.test.tsx` › "keeps the human's shot result visible after the AI replies".

Would have caught earlier: Any test that advanced the AI timer and then asserted on the
_human's_ message. The first App test advanced the timer and only asserted on the turn indicator.

### 7. First deploy to main failed: Pages not enabled (2026-09-18, PR 1, layer: CI/infra, found on merge)

Symptom: `check` passed, `deploy` failed with `Failed to create deployment (404) ... Ensure GitHub
Pages has been enabled`. The PR's CI had been green because `deploy` is skipped on pull requests,
so the failure was invisible until merge.

Root cause: `actions/deploy-pages` requires the repo's Pages source to be set to "GitHub Actions";
a fresh repo defaults to disabled. The Devin GitHub App cannot change repo settings or re-run
workflows, so this needed a human (Settings → Pages → Source: GitHub Actions, then "Re-run failed
jobs").

Fix: Setting flipped manually; re-run succeeded; https://anastosj.github.io/battleship-ai/ verified
by playing in a browser.

Would have caught earlier: Checking Pages enablement (`gh api repos/:owner/:repo/pages`) before
merge, or listing the required one-time repo setting in the README/PR description as a checklist
item rather than a sentence at the bottom.

### 8. §5.3 tie-break resolved the wrong ship and the AI walked away from a live Battleship (2026-09-18, PR 2, layer: ai, found by fuzzing)

Symptom: All three spec'd touching-ship scenario tests passed on the first try. A wider fuzz
(5,000 random fleets, asserting "while a live hit exists, the next shot is adjacent to one")
found 1 game (seed 874) where the AI dropped back to Hunt with three Battleship hits on the board;
it took 40 more shots to stumble onto the fourth cell.

Root cause: Destroyer at (3,7)(3,8) touching a Battleship (4,6)–(4,9). Hits in order: (3,7),
(4,7), (4,8), then the sink at (3,8). Both axes through (3,8) show a run of exactly 2, so the
spec's tie-break ("follow the axis of the most recent prior hit") picked vertical and resolved
(3,8)+(4,8) — the wrong pair. (4,8) was wrongly marked dead; (3,7) was wrongly left alive but
boxed in by targeted cells. Target mode then had no candidate and returned to Hunt. The
inference in §5.3 is a heuristic and _can_ be wrong; the spec had no recovery path for that case.

Fix: When the normal target candidates are exhausted but unresolved hits remain, widen to the
connected component of hit cells and target untargeted cells that extend a line of hits, skipping
lines already as long as the largest ship afloat (`connectedFrontier` in `src/ai/huntTarget.ts`).
For seed 874 this fires (4,9) next.

First attempts at the fix: (a) flood-fill without ranking picked a cell next to the already-sunk
Carrier; (b) ranking by line length alone preferred the 5-long Carrier line. The "largest ship
afloat" cap was what made it work.

Test added: `tests/ai-touching.test.ts` › "recovers when the ambiguity tie-break attributes the
wrong axis (fuzz seed 874)".

Would have caught earlier: The scenario tests each ran one hand-picked shot order. The bug needed
a specific order of four hits; only a fuzz over random fleets with a ground-truth "never abandon a
live hit" oracle found it. The oracle still flags 1/5,000 games (seed 2765) where the AI targets
next to a cell it _believes_ is live but isn't — that one is information-limited, not a bug.

### 9. Spec's shot-count band (55–65) does not match the AI it specifies (2026-09-18, PR 2, layer: test / spec — flagged)

Symptom: §5.4 says "expected average shots-to-win ≈ 55–65". Measured over 300 random fleets with
the AI finishing every game: avg ≈ 50; over 1,000 self-play games the winner averages 45.6.

Root cause: The number in the spec was written before any code existed and was a guess. A
parity-Hunt + line-extending Target AI on a 10×10 board is well known to average around 50.

Fix: Test band set to 46–56 around the measured mean, with N = 300 so seed noise is ≈ ±1. Flagged
to the owner rather than silently changing the spec (rule: "if the spec turns out wrong, stop and
tell me").

### 10. `node:` imports in the isolation test broke typecheck (2026-09-18, PR 2, layer: build)

Symptom: `tsc -b` failed with `Cannot find module 'node:fs'` / `Cannot find name '__dirname'`
for `tests/ai-isolation.test.ts` — Vitest ran it fine, only typecheck failed.

Root cause: `tsconfig.app.json` had `types: ["vite/client", ...]` only; no `@types/node`, and
`__dirname` doesn't exist in ESM anyway.

Fix: Added `@types/node`, `"node"` to `types`, and `dirname(fileURLToPath(import.meta.url))`.
Also added `scripts/` to the tsconfig `include` so `selfplay.ts` is typechecked in CI.
