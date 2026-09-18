# Bugs found and how they were fixed

Battleship vs. a Hunt/Target AI — https://anastosj.github.io/battleship-ai/

This is the short version. The full running log, kept from the first session and appended to in
every PR (misses and corrections included), is [`BUGLOG.md`](./BUGLOG.md); numbers below refer to
its entries. The game was built by Devin in four thin vertical slices (PR 1 skeleton → PR 2 AI →
PR 3 placement/coin flip → PR 4 polish), each one deployed and played in a real browser before the
next began. Twenty entries were logged; the ones worth reading are the ones the type system and
the fuzzer did not catch.

## How bugs were found

| Method                                            | Entries           | What it was good at                                            |
| ------------------------------------------------- | ----------------- | -------------------------------------------------------------- |
| Reading the spec before writing code              | 1, 5              | Information-model holes (what the AI is allowed to know)       |
| Lint / typecheck / CI                             | 2, 3, 10, 11      | Impure render code, stack drift, tool-generated files          |
| Unit tests written first                          | 4, 12, 13         | State-machine ordering (coin reveal vs. AI timer)              |
| Fuzzing with a ground-truth oracle (5,000 fleets) | 8, 9              | One-in-thousands AI logic errors; a wrong number in the spec   |
| Actually playing the deployed build (recorded)    | **6, 15, 17, 19** | Everything the UI/state layer got wrong; jsdom sees none of it |
| Owner playing the released game                   | 20                | Data that was technically correct but useless to a player      |
| Automated code review (Devin Review)              | 18                | CSS box-model math a human eye skipped                         |

## The five that matter

### 1. The player was handed the enemy's fleet (#19 — the worst one)

**Symptom.** Press "Randomize fleet" once as your first placement action (the most common path)
and your fleet was an exact copy of the AI's. Play on, and you could read the enemy board off your
own. Shipped in PR 3, survived its live test, and was only noticed in the PR 4 run when the
tester's win looked suspiciously symmetric.

**Cause.** `startGame(seed)` draws the AI's fleet from `makeRng(seed)`. The UI hook then made its
_own_ `makeRng(seed)` for Randomize and the coin. Two fresh copies of the same deterministic
generator produce the same first fleet. The second press differed (the stream had advanced), so
the existing test "every press produces a different fleet" passed, and the PR 3 browser tester
compared successive presses — never player vs. enemy.

**Fix.** The UI stream is seeded differently (`uiRng(seed) = makeRng(seed ^ 0x9e3779b9)`), plus a
regression test that renders five seeds, presses Randomize once and asserts human ≠ AI. It fails on
the old code for all five. **What would have caught it earlier:** a one-line invariant test, or
looking at the game-over reveal in PR 3's recording instead of only checking the modal counts.

### 2. Sunk-ship attribution when ships touch (#1 pre-code, #8 in fuzzing)

**Design hole caught before coding.** The v0.1 spec said target mode should "clear the stack of
that ship's cells" when a ship sinks. The shooter cannot know which cells those were — it only
learns "sunk, length L". With touching ships allowed, the sinking shot can sit next to an unresolved
hit on a _different_ ship and naive clearing abandons a live target. Resolved in the spec: infer
the sunk cells as the L collinear hits through the sinking cell, keep the rest as unresolved.

**Then the fuzzer found the inference can be wrong.** All three hand-written touching scenarios
passed first time. A 5,000-fleet fuzz with the oracle "while a live hit exists, the next shot is
adjacent to one" found seed 874: a Destroyer flush against a Battleship, hit order such that both
axes through the sinking cell showed a run of exactly 2. The tie-break picked the wrong pair,
marked a live cell dead, boxed in the real one, and the AI wandered back to Hunt for 40 shots with
three Battleship hits on the board. **Fix:** a recovery path — when target candidates run out but
unresolved hits remain, widen to the connected component of hits and extend any line shorter than
the largest ship afloat. Two earlier attempts at the fix picked cells next to the already-sunk
Carrier; the "largest ship afloat" cap is what made it work.

### 3. Human's shot result overwritten 250 ms later (#6 — found by playing)

Sink the enemy Cruiser and "You sank their Cruiser!" flashed, then was replaced by "Enemy missed."
before it could be read. One `status` string held two independent events. Every unit test passed
because the only test that advanced the AI timer asserted on the turn indicator, not the message.
Fixed by keeping `lastHuman` and `lastAi` separately; test added that advances the timer and then
asserts on the _human's_ text.

### 4. The AI would have fired during the coin animation (#13 — caught writing the test)

The engine's `flipCoin` sets `turn='ai'` immediately; the UI shows the coin for one second. The
existing AI effect only looked at engine state, so on tails the AI's first shot would have landed
~250 ms into the animation. The engine has no notion of a "reveal" — that is a UI concern — so the
hook gained a `flipping` flag that gates the AI timer (and disables the boards, so a double-click on
"Flip coin" cannot flip twice).

### 5. Layout and accessibility only the browser could see (#15, #16, #17, #18)

- **Rotate button changed width** ("Rotate (horizontal)" vs "(vertical)") and nudged the placement
  board a rem sideways under the pointer. Label made constant; orientation moved to a fixed-width
  `aria-live` span.
- **Ship and sunk cells had no glyph** — state conveyed by colour alone for three PRs because the
  aria-labels were right and the tests read labels, not glyphs. Added `▮ • ✕ ☒`; miss glyph
  darkened from a measured 3.9:1 to pass WCAG AA.
- **Fixed 2.2 rem cells overflowed a 360 px phone.** Cell size is now `min(2.2rem, (100vw − …)/10)`
  and boards stack under 720 px.
- **Mobile modal 0.5 rem wider than the viewport** — `width: calc(100vw − 2rem)` plus padding under
  `content-box`. Caught by Devin Review, not by me; my "verified at 375 px" note in #17 had been
  written before the browser check. Fix: `box-sizing: border-box`.

## Misses that were not bugs in the game

- **The spec's shot-count band was a guess** (#9). §5.4 said "≈55–65 shots to win"; the AI it
  describes measures ≈50 (winner average 45.6 over 1,000 self-play games). Flagged to the owner
  rather than silently edited; the band is now 46–65 by their decision.
- **Two entry points instead of one** (#12). Making `newGame` start in placement would have broken
  every engine/AI test and the self-play harness that rely on it producing a fireable game. Added
  `startGame` instead and made `fire` reject shots before the coin flip in the engine, not just the UI.
- **The scaffold drifted** (#2): the Vite template produced React 19 / TS 6 / oxlint against a spec
  pinning React 18 / TS strict / ESLint. Caught by reading `package.json` before installing anything.
- **A docs-only PR broke `main`** (#11): a skill file merged without running Prettier because it was
  created by a different tool than the code PRs. The rule is every PR, including generated ones.
- **First deploy failed** (#7): GitHub Pages was not enabled and the deploy job is skipped on PRs,
  so the failure was invisible until merge and needed a human to flip a repo setting.

- **Game-over stats meant nothing** (#20). "Your shots: 54 · Enemy shots: 54" is correct and
  useless; the owner asked for hits. The modal now shows Shots, Hits (of 17) and Accuracy per side.
  PR 3's test only asserted that numbers were present.

## What the AI is allowed to see

Not a bug, but the easiest one to ship accidentally: pass `GameState` into the AI and it can read
`state.human.ships`. The AI receives only `AIView` — its own shot log and the list of ships it has
sunk. `tests/ai-isolation.test.ts` fails if `src/ai/**` imports `engine/board`, `engine/game` or
`engine/fleet`, and `GameState` records the AI's shots as a log precisely so `AIView` can be derived
without looking at the board (#5).

## Verification

`npm run lint && npm run typecheck && npm test && npm run build` — 54 tests across 6 files, plus
`npm run selfplay` (1,000 games) and a recorded browser run of every deployed slice.
