# Battleship vs. AI — Specification & Build Plan

> **Historical document.** This is spec v0.2 exactly as agreed before the first line of code was
> written; `docs/BUGLOG.md` and `docs/BUGS.md` cite its section numbers. It is kept unedited so the
> log's "the spec said X, reality was Y" entries stay readable. Where the shipped game deviates,
> the deviation was an explicit owner decision recorded in the log:
>
> | Spec v0.2 said                    | Shipped                                                        | Decided in           |
> | --------------------------------- | -------------------------------------------------------------- | -------------------- |
> | §5.4 average shots-to-win ≈ 55–65 | band widened to 46–65 (measured ≈50)                           | BUGLOG #9            |
> | §12 no difficulty selector        | Easy / Hard, locked once the fleet is confirmed                | PR 5 (owner request) |
> | §F3 AI reply after 250 ms         | 500 ms                                                         | BUGLOG #29           |
> | §3 nice-to-have: history / theme  | match history, top-10 leaderboard, Captain Devin console theme | PRs 6–8              |
> | §11 three parallel child sessions | built as twelve sequential slices, one PR each                 | see README           |

**Version:** 0.2 (revised per review)
**Repo:** `anastosj/battleship-ai` (public from day one) **Hosting:** GitHub Pages
**Deliverables required by the brief:**

1. A public URL where anyone can play Battleship against an AI.
2. A short "Bugs Found & Fixed" document (in-repo `docs/BUGS.md` **and** a Notion page).
3. A public GitHub repo containing the code.

### Changes from v0.1

- Removed difficulty levels → one solid Hunt/Target AI.
- Added **coin flip** to decide first mover.
- Manual placement is required; Randomize always available and re-randomizes on every press.
- AI delay 500 ms → **250 ms**.
- New §5.1 **AI information boundary** (`AIView`) + a test that the AI never imports the full board.
- Fixed the **touching-ships / stack-clearing** hole in target mode (§5.3).
- New §8.1 **running bug log** as the primary source of BUGS.md; fuzzing demoted to secondary.
- New §9 **developer/agent loop**: commands, Knowledge entry, Playbook.
- §11 plan re-cut into a frozen-interface step followed by **parallel sessions**, one PR each, Devin Review on all.

---

## 1. Goals & Non-Goals

### Goals

- Single-player, browser-based Battleship against a competent AI.
- Zero sign-up, zero install: open link → play.
- Simple, debuggable, fully testable game logic (pure, unit-tested rules engine).
- Free static hosting with a stable public link.

### Non-Goals (v1)

- Multiplayer, accounts, leaderboards, server-side persistence.
- Multiple AI difficulty levels.
- Native mobile apps (responsive web only).
- Heavy animation/sound.

---

## 2. Game Rules (Classic variant)

| Item        | Rule                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------- |
| Board       | 10 × 10 per player, columns A–J, rows 1–10                                                        |
| Fleet       | Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2) — 17 cells                 |
| Placement   | Straight lines, horizontal or vertical, fully on-board, non-overlapping. **Touching is allowed.** |
| First mover | Decided by a **coin flip** (§3, F0)                                                               |
| Turn        | One shot per turn; alternate regardless of result. Cannot fire at an already-targeted cell.       |
| Feedback    | **Miss**, **Hit**, or **Hit & Sunk \<ship name\>**                                                |
| Win         | First to sink all 5 enemy ships. Game ends immediately.                                           |

### Explicitly resolved edge cases

- Firing at an already-fired cell is rejected by the engine (`invalid`, turn not consumed) and prevented in the UI.
- Random placement never yields overlap or off-board ships (validated; retry with new RNG draws).
- No shots accepted after a win; no shots accepted before the coin flip resolves.
- Sunk = every cell of that ship has been hit (unique cells, not hit count).
- Coin flip happens exactly once per game and cannot be re-rolled; "New game" starts a fresh flip.

---

## 3. Features (v1, all required)

- **F0 Coin flip.** After placement, a "Flip coin" button. User must press it. Heads → user fires first; tails → AI fires first. Result is shown for ~1 s with a short flip animation, then play begins (if tails the AI fires after the 250 ms delay). The button is disabled after one press; the result is stored in state and is definitive.
- **F1 Ship placement.**
  - Tray of 5 ships; click to select, **R** key or "Rotate" button toggles orientation.
  - Hover preview on own board: green if legal, red if not. Click to place. Click a placed ship to pick it back up.
  - **"Randomize fleet"** button always visible during placement; every press discards current placement and generates a fresh random valid fleet.
  - "Continue to coin flip" enabled only when all 5 ships are placed.
- **F2 Play.**
  - Two boards side by side: _Your fleet_ (own ships + enemy shots) and _Enemy waters_ (your shots; ships hidden).
  - Click a cell in Enemy waters to fire. Result shown immediately; AI replies after **250 ms**.
  - Status line: "Hit!", "Miss.", "You sank their Cruiser!", "Enemy hit your Battleship", "Enemy sank your Destroyer!".
  - Fleet panels for both sides (afloat/sunk per ship); shot counters.
- **F3 AI opponent** — single Hunt/Target AI (§5).
- **F4 Game over** modal: win/lose, shot counts, "Play again" (returns to placement).
- **F5 Reveal**: on game over, enemy's remaining ships are revealed on the Enemy waters board.
- **F6 Responsive** — boards stack vertically under ~720 px.
- **F7 Accessibility basics** — cells are `<button>`s with aria-labels ("B7, miss"), visible focus, state conveyed by glyph + color, not color alone.

### Nice-to-have (only after v1 ships)

- `localStorage` resume of in-progress game; local win/loss tally; AI target-stack debug overlay.

---

## 4. Architecture

**Pure client-side SPA.** No backend: no server cost, no auth, no latency, fewer failure modes; deploy is a static upload to GitHub Pages.

```
battleship-ai/
├─ src/
│  ├─ engine/               # framework-free, pure, 100% unit-tested
│  │  ├─ types.ts           # Coord, Ship, Board, ShotResult, GameState, AIView  ← FROZEN INTERFACE
│  │  ├─ board.ts           # canPlace, placeShip, removeShip, randomFleet
│  │  ├─ game.ts            # newGame, flipCoin, fire, toAIView
│  │  └─ rng.ts             # seedable PRNG (mulberry32)
│  ├─ ai/
│  │  └─ huntTarget.ts      # chooseShot(view: AIView, rng): Coord   ← only sees AIView
│  ├─ ui/                   # React
│  │  ├─ App.tsx, PlacementScreen.tsx, CoinFlip.tsx, Board.tsx, Cell.tsx,
│  │  ├─ ShipTray.tsx, FleetStatus.tsx, StatusBar.tsx, GameOverModal.tsx
│  │  └─ useGame.ts         # useReducer over engine; schedules AI turn (250 ms)
│  └─ main.tsx
├─ tests/                   # Vitest: engine, ai, reducer, ai-isolation
├─ e2e/                     # Playwright smoke test
├─ scripts/selfplay.ts      # AI-vs-AI fuzz harness (secondary bug source)
├─ docs/
│  ├─ BUGS.md               # deliverable #2 (written from docs/BUGLOG.md)
│  └─ BUGLOG.md             # running scratch log, kept from session one (§8.1)
├─ .agents/skills/          # repo skill(s) for the dev loop
├─ .github/workflows/ci.yml # lint → typecheck → test → build → deploy Pages
├─ README.md, LICENSE (MIT)
```

**Design rule (Knowledge entry, §9.2):** the engine is _pure functions over immutable state_. `fire()` never mutates; it returns `{ state, result }`. Every bug is reproducible from `(seed, moves[])`.

### Core data model (TypeScript, strict)

```ts
type Coord = { row: number; col: number };                 // 0–9
type ShipKind = 'carrier'|'battleship'|'cruiser'|'submarine'|'destroyer';
const SHIP_SIZES: Record<ShipKind, number> = { carrier:5, battleship:4, cruiser:3, submarine:3, destroyer:2 };
type Orientation = 'h' | 'v';
type Ship = { kind: ShipKind; bow: Coord; orientation: Orientation };   // cells derived, never stored twice
type CellMark = 'miss' | 'hit';
type Board = { ships: Ship[]; shots: Record<string, CellMark> };       // key `${row},${col}`
type ShotResult =
  | { kind: 'miss' } | { kind: 'hit' } | { kind: 'sunk'; ship: ShipKind }
  | { kind: 'invalid'; reason: 'repeat' | 'out-of-bounds' | 'not-your-turn' | 'game-over' };
type Player = 'human' | 'ai';
type Phase = 'placement' | 'coinflip' | 'playing' | 'gameover';
type GameState = {
  phase: Phase; turn: Player; human: Board; ai: Board;
  coin?: 'heads' | 'tails'; winner?: Player; seed: number;
};

// What the AI is allowed to know — nothing else. (§5.1)
type AIShot = { coord: Coord; result: 'miss' | 'hit' | 'sunk'; sunkShip?: ShipKind };
type AIView = { shots: AIShot[]; sunkShips: ShipKind[]; boardSize: 10 };

// Engine API (frozen after Step 1)
newGame(seed: number): GameState
canPlace(board: Board, ship: Ship): boolean
placeShip / removeShip(board: Board, ship): Board
randomFleet(rng: RNG): Ship[]
flipCoin(state: GameState): GameState                                  // sets coin, turn, phase='playing'
fire(state: GameState, shooter: Player, at: Coord): { state: GameState; result: ShotResult }
toAIView(state: GameState): AIView                                     // derived ONLY from state.human.shots-by-ai results
// AI API (frozen after Step 1)
chooseShot(view: AIView, rng: RNG): Coord
```

---

## 5. AI Specification — Hunt/Target

### 5.1 Information boundary (anti-cheat)

- `chooseShot` receives **only** an `AIView`: the AI's own shot history with results, and the list of ships it has sunk. It never receives `GameState`, `Board`, or `Ship[]`.
- **Static test:** `tests/ai-isolation.test.ts` reads every file under `src/ai/` and asserts it imports nothing from `engine/` except the `AIView`, `AIShot`, `Coord`, `ShipKind`, `SHIP_SIZES` and `RNG` types/consts (allow-list). ESLint `no-restricted-imports` enforces the same in CI.
- **Behavioral test:** for a fixed seed and identical `AIView`, `chooseShot` returns the same coord regardless of what the hidden human board contains (two games with different fleets but identical shot histories yield identical AI moves).

### 5.2 Hunt mode

- Fire at a random untargeted cell on **checkerboard parity** (`(row+col) % 2 === parity`, parity chosen per game); every ship (min length 2) must cover a parity cell. Fall back to any untargeted cell if parity cells are exhausted.
- Skip cells where no remaining ship could fit (run of untargeted cells in both axes shorter than the smallest remaining ship).

### 5.3 Target mode & the touching-ships problem

The shooter does **not** know which cells belonged to a sunk ship, so "clear the sunk ship's cells from the stack" is not implementable as written. Resolution:

- Maintain `unresolvedHits: Coord[]` — hit cells not yet attributed to a sunk ship.
- On **hit**: add to `unresolvedHits`. Candidate targets = untargeted orthogonal neighbours of unresolved hits. If two or more unresolved hits are collinear and contiguous, prioritize the two cells extending that line; otherwise take the four neighbours of the most recent hit.
- On **sunk `ship` of length L**: the sinking shot belongs to the sunk ship. Find the maximal contiguous run of unresolved hits through the sinking cell, horizontally and vertically.
  - If exactly one axis has a run of length ≥ L containing the sinking cell, attribute the L-cell segment ending at the sinking cell (the segment must include it; if multiple L-windows contain it, choose the one whose other end is the earliest hit in the run) and remove those cells from `unresolvedHits`.
  - If both axes qualify (ambiguous), attribute along the axis whose run length equals L exactly; if still ambiguous, attribute the most recent L hits along the axis of the most recent prior hit.
  - Any hits **left over** in `unresolvedHits` (e.g. a Destroyer flush against a Cruiser) keep the AI in target mode — it does not fall back to hunt while `unresolvedHits` is non-empty.
- Return to **hunt** only when `unresolvedHits` is empty.
- Test cases: Destroyer touching Cruiser end-to-end; ships side-by-side in parallel; an "L" of two touching ships where the sink happens at the corner. In each, assert the AI never abandons a live hit and finishes the game.

### 5.4 Performance & determinism

- `chooseShot` < 5 ms; deterministic for a given seed; never repeats a cell (asserted over 1,000 self-play games).
- Expected average shots-to-win ≈ 55–65 (statistical test with a tolerance band; catches AI regressions).

---

## 6. UI / UX

- **Flow:** Placement → Coin flip → Play → Game over → Play again.
- **Cell visuals:** unknown = water blue; miss = pale + "•"; hit = red + "✕"; sunk ship cells = dark red; own ship = grey. Hover preview only when interactive.
- **Turn indicator:** "Your turn — fire!" / "Enemy is thinking…"; enemy board non-interactive during AI turn and after game over.
- **Coin flip screen:** big "Flip coin" button, short flip animation, result text "Heads — you fire first" / "Tails — enemy fires first".
- Colors meet WCAG AA; all state also conveyed with a glyph.
- Initial load < 200 KB gzipped.

---

## 7. Tech Stack

| Concern     | Choice                                                                             |
| ----------- | ---------------------------------------------------------------------------------- |
| Language    | TypeScript (strict, `noUncheckedIndexedAccess`)                                    |
| UI          | React 18 + Vite                                                                    |
| Styling     | CSS modules                                                                        |
| Unit tests  | Vitest                                                                             |
| E2E         | Playwright (one smoke test)                                                        |
| Lint/format | ESLint (incl. `no-restricted-imports` for `src/ai/**`) + Prettier                  |
| CI/CD       | GitHub Actions: lint → typecheck → test → build → deploy to GitHub Pages on `main` |
| Hosting     | GitHub Pages: `https://anastosj.github.io/battleship-ai/`                          |

---

## 8. Testing & Debugging

### 8.1 Running bug log (PRIMARY source of BUGS.md)

`docs/BUGLOG.md` is created in Step 1 and appended to in **every** session and PR. Each entry:

```
### <short title>            (date, PR #, layer: engine | ai | ui/state | build/deploy | process)
Symptom:      what was observed (and how — manual play, review, test, fuzz)
First attempt: what was tried first and why it was wrong
Root cause:
Fix:
Test added:   file / test name, or "none — why"
Would have caught earlier: the test/type/check that should have existed
```

Rules:

- Log **misses**, not only bugs: places where the first implementation was wrong, what the reviewer/user had to say, design holes caught before code (e.g. the §5.3 touching-ships issue is entry #1).
- UI/state-layer bugs found by actually playing (stale closures, double AI turns from re-renders, timers firing after "Play again", coin-flip re-press, hover preview surviving rotation, mobile tap targets) are expected to be the majority and the most interesting.
- Devin Review comments that were valid go in the log.
- `docs/BUGS.md` (deliverable #2) is written _from_ this log at the end: a curated, human-readable narrative, not a fuzzer dump. Same content published to a Notion page.

### 8.2 Automated tests

- **Engine:** placement legality (off-board, overlap, both orientations, touching allowed); `randomFleet` valid for 10,000 seeds; fire → miss/hit/sunk; repeat shot, out-of-turn, post-gameover rejected; win at exactly 17 hits; `flipCoin` is idempotent (second call is a no-op).
- **AI:** §5.1 isolation tests; §5.3 touching scenarios; never repeats; always finishes; shot-count band.
- **Reducer/UI state:** turn alternation; AI turn scheduled exactly once per human shot; timer cancelled on "Play again"; Randomize replaces fleet each press; coin flip once only.
- **E2E (Playwright):** randomize → continue → flip → play with a seeded game until game-over modal.

### 8.3 Fuzzing (secondary)

`scripts/selfplay.ts` runs N AI-vs-AI games; any thrown error or invariant violation (hits > 17, repeated shot, turn skipped, shot after gameover) logs its seed. Findings go into the bug log like anything else, tagged "fuzz".

### 8.4 Manual play checklist (each UI PR)

Desktop Chrome + 390 px mobile width: full game start-to-finish twice (once heads, once tails); rotate during hover; re-randomize 5×; pick up and re-place a ship; try clicking during AI's turn; "Play again" mid-AI-turn; keyboard-only game.

---

## 9. Developer / Agent Loop

### 9.1 Commands (in README and repo skill)

```
npm ci                 # install
npm run dev            # Vite dev server, http://localhost:5173
npm run lint           # eslint + prettier --check
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run test:e2e       # playwright test (needs `npm run build` first)
npm run selfplay -- 1000   # fuzz harness
npm run build          # production build to dist/
```

Definition of "done" for any PR: all six checks green locally **and** in CI, BUGLOG.md updated (even if "nothing found"), Devin Review comments addressed.

### 9.2 Knowledge entry (to create in Devin, repo-scoped `anastosj/battleship-ai`)

> **Engine purity rule.** `src/engine/**` is pure: no mutation of inputs, no `Date`/`Math.random`/DOM/React. Every function takes state and returns new state (`{ ...state }` / new arrays). The AI (`src/ai/**`) may import only `AIView`-related types from the engine — never `GameState`, `Board`, or `Ship`. If a fix seems to need mutation or full-state access, it is the wrong fix.

### 9.3 Playbook (to create in Devin: "battleship-ai: add feature + test")

1. Read `docs/BUGLOG.md` and §4 interfaces; do not change `types.ts` without a note in the PR.
2. Write the failing test first (engine/ai: Vitest; ui: reducer test or Playwright).
3. Implement; run `npm run lint && npm run typecheck && npm test`.
4. Play the game manually per §8.4 if UI/state was touched.
5. Append to `docs/BUGLOG.md`: anything wrong on the first attempt, anything the user/reviewer corrected.
6. Open PR (one feature per PR), wait for Devin Review, address comments, re-log valid ones.

### 9.4 Repo skill

`.agents/skills/dev-loop/SKILL.md` mirroring §9.1 + §9.3 so any future session finds it in-repo.

---

## 10. Deliverables & Definition of Done

| #   | Deliverable                                 | Done when                                                                                                               |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| D1  | `https://anastosj.github.io/battleship-ai/` | Full game playable desktop + mobile, both coin outcomes, no console errors                                              |
| D2  | `docs/BUGS.md` + Notion page                | Narrative of every logged bug/miss: symptom → first attempt → root cause → fix → test; fuzz findings as a minor section |
| D3  | `github.com/anastosj/battleship-ai`         | README (play/run/test), MIT, green CI, link to live site, Knowledge + Playbook created                                  |

---

## 11. Build Plan

Estimate: **1 parent session + 3 parallel child sessions**, then one wrap-up. Wall-clock ≈ one long session.

| Step | Mode                   | Work                                                                                                                                                                                                                                                                                                                                                                    | PR     |
| ---- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1    | Parent, sequential     | Scaffold (Vite/React/TS/Vitest/ESLint/Prettier/Playwright), CI + Pages deploy, MIT, README skeleton, `docs/BUGLOG.md` with entry #1 (§5.3), repo skill. **Write and freeze `src/engine/types.ts` and the API signatures in §4 with stub implementations that throw `NotImplemented`**, so children compile against a fixed contract. Create Knowledge entry + Playbook. | PR #1  |
| 2    | **Child A (parallel)** | Engine implementation (`board.ts`, `game.ts`, `rng.ts`) + full unit tests + `selfplay.ts` harness using a placeholder random AI.                                                                                                                                                                                                                                        | PR #2  |
| 3    | **Child B (parallel)** | Hunt/Target AI against the frozen `AIView` contract; isolation tests; §5.3 scenario tests (uses a tiny in-test board simulator, not the real engine, so it doesn't wait on Child A).                                                                                                                                                                                    | PR #3  |
| 4    | **Child C (parallel)** | UI + `useGame` reducer against the frozen engine API, developed with a mocked engine (`vi.mock`/fixture states) until #2 merges; placement, randomize, coin flip, play, game over, responsive, a11y.                                                                                                                                                                    | PR #4  |
| 5    | Parent, sequential     | Integrate (#2 → #3 → #4 merge order), run selfplay + statistical AI test, full manual play (§8.4) on the deployed site, fix integration bugs (each logged).                                                                                                                                                                                                             | PR #5+ |
| 6    | Parent                 | Write `docs/BUGS.md` from BUGLOG, publish Notion page, final README, verify live URL.                                                                                                                                                                                                                                                                                   | PR #N  |

Every PR: Devin Review enabled, one topic per PR, BUGLOG.md touched. The three children are independent because the only shared artifact is `types.ts` + the signatures frozen in Step 1; any child that needs a contract change stops and reports rather than editing `types.ts`.

---

## 12. Decisions recorded

- Repo `anastosj/battleship-ai`, public. GitHub Pages hosting.
- Manual placement required; Randomize always available and re-rolls each press.
- Single Hunt/Target AI, no difficulty selector.
- Coin flip, user-pressed, once, definitive: heads = user first, tails = AI first.
- AI delay 250 ms.
- Bugs documented in `docs/BUGS.md` and a Notion page.
