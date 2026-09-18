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

Fix: Flagged to the owner rather than silently changing the spec (rule: "if the spec turns out
wrong, stop and tell me"). Owner's decision: keep the band wide, 46–65, to tolerate game variance;
spec §5.4 updated to match. Test uses N = 300 so seed noise is ≈ ±1.

### 10. `node:` imports in the isolation test broke typecheck (2026-09-18, PR 2, layer: build)

Symptom: `tsc -b` failed with `Cannot find module 'node:fs'` / `Cannot find name '__dirname'`
for `tests/ai-isolation.test.ts` — Vitest ran it fine, only typecheck failed.

Root cause: `tsconfig.app.json` had `types: ["vite/client", ...]` only; no `@types/node`, and
`__dirname` doesn't exist in ESM anyway.

Fix: Added `@types/node`, `"node"` to `types`, and `dirname(fileURLToPath(import.meta.url))`.
Also added `scripts/` to the tsconfig `include` so `selfplay.ts` is typechecked in CI.

### 11. Skill-file PR merged without running the repo's own lint (2026-09-18, GitHub #3 → fixed in PR 3 / #4, layer: process / build)

Symptom: After the browser-testing skill (`.agents/skills/**/SKILL.md`, GitHub #3) was merged, CI
on `main` went red: `prettier --check .` rejected the Markdown. The PR had no CI status attached
because it was created via the skill-suggestion flow, so nothing flagged it before merge and the
owner was asked "do I squash and merge this?" with no signal that it would break `main`.

Root cause: The "run lint, typecheck, and tests before opening it" rule was applied to code PRs
only; a docs-only PR generated by a different tool bypassed it. Prettier checks every file in the
repo, including Markdown.

Fix: Formatted the file in this PR. Lesson: the rule is _every_ PR, including tool-generated ones.

### 12. `newGame` vs `startGame`: two entry points, not one (2026-09-18, PR 3 / #4, layer: engine — design decision)

Making `newGame(seed)` start in `'placement'` (as the spec's API sketch implies) would have
changed the meaning of the constructor that every engine/AI test, the selfplay harness and the
shot-count band test rely on to produce a fireable game. Kept `newGame(seed, fleets?)` as the
"already playing" constructor and added `startGame(seed)` → `'placement'` with an empty human
board and a seeded random AI fleet. `fire` now also rejects shots when `phase !== 'playing'`
(`not-your-turn`), so §2's "no shots before the coin flip resolves" is enforced by the engine, not
just the UI. Test: `tests/engine-flow.test.ts` › "cannot fire before the coin flip".

### 13. Coin-flip reveal timer vs. AI timer (2026-09-18, PR 3 / #4, layer: ui/state)

Symptom (caught while writing the test, before playing): the engine's `flipCoin` sets
`phase='playing'` and `turn='ai'` immediately, so the existing AI effect would have fired the AI's
first shot ~250 ms into the 1 s coin animation — a hit on the player's board before the coin had
landed.

Root cause: The engine has no notion of the "reveal" pause (§F0's "result is shown for ~1 s") —
that is purely a UI concern — but the AI effect only looked at engine state.

Fix: `useGame` keeps a `flipping` flag; the AI effect is gated on `!flipping`, so its 250 ms clock
starts when the reveal ends. The same flag also hides the boards until the reveal so a fast
double-click on "Flip coin" hits a disabled button or, failing that, the engine's idempotent
`flipCoin`. Tests: `tests/app.test.tsx` › "the AI does not fire while the coin is still spinning",
"cannot be pressed twice and the result is definitive".

### 14. Hover preview must be derived, not stored (2026-09-18, PR 3 / #4, layer: ui — design note)

The preview is recomputed on every render from `(hoverCell, selectedShip, orientation)`. Storing
the preview cells in state on `mouseenter` would have left a stale horizontal ghost after pressing
**R** with the mouse still — the failure §8.1 predicts ("hover preview surviving rotation"). Also:
hovering a cell occupied by _another_ ship shows no preview, because a click there picks that ship
up instead of placing.

### 15. Rotate button changed width and nudged the board (2026-09-18, PR 3 live test → fixed PR 4, layer: ui)

Symptom (found by playing the deployed PR 3 build, not by any test): the label read
"Rotate (horizontal) — R" / "Rotate (vertical) — R", so pressing **R** changed the button width, the
controls row reflowed, and the placement board jumped ~1 rem sideways under the pointer.

Root cause: state text embedded inside the button label — layout depends on which word is longer.

Fix: the button label is the constant "Rotate (R)" and the orientation lives in a fixed-min-width
`aria-live` span next to it (`aria-describedby`), so screen readers still hear the orientation and
nothing moves. Test: `tests/app.test.tsx` asserts the accessible description flips to "Vertical".
A jsdom test cannot catch a layout shift; only the browser run did.

### 16. Ship and sunk cells had no glyph (2026-09-18, PR 4 / spec F7, layer: ui)

Symptom: own-ship cells were a grey square with no text and sunk cells reused the hit "✕", so
"ship vs water" and "hit vs sunk" were conveyed by colour alone — a direct §F7 / §10 violation that
shipped in three PRs because the aria-labels were correct and the tests read the labels, not the
glyphs.

Fix: a single `GLYPH` table in `Board.tsx` (`▮` ship, `•` miss, `✕` hit, `☒` sunk), glyph spans
`aria-hidden` so labels stay "B7, sunk". Also darkened the miss glyph (`#6b7c8c` → `#3d4c5a`) —
the old one measured ≈3.9:1 on its background, under WCAG AA's 4.5:1.

### 17. Fixed-size grid overflowed phones (2026-09-18, PR 4 / spec F6, layer: ui)

Symptom: cells were hard-coded to `2.2rem`, so a 10×10 board is 370 px wide before padding —
horizontal scroll on a 360 px phone even after the boards stacked.

Fix: `--cell: min(2.2rem, calc((100vw - 2rem - 18px) / 10))` and a `max-width: 720px` query that
stacks boards/placement columns and shrinks the modal. Not covered by jsdom; verified in the
browser at 375 px.

### 18. Mobile modal 0.5 rem wider than the viewport (2026-09-18, PR 4 / #6, layer: ui — caught by Devin Review)

Symptom: the `max-width: 720px` rule set `.modal { width: calc(100vw - 2rem); padding: 1.25rem }`
under the default `content-box` sizing, so the rendered dialog was `100vw + 0.5rem` and clipped at
both edges on phones.

Fix: `box-sizing: border-box` on the modal. First automated review finding on this repo; a jsdom
test cannot see it and my own "verified at 375 px" claim in #17 was written before the browser
check — a miss on top of the miss.

### 19. First "Randomize fleet" gave the player the enemy's exact layout (2026-09-18, shipped in PR 3, found in the PR 4 live test, layer: ui/state — the worst bug in the log)

Symptom: the tester noticed both fleets had identical coordinates after pressing Randomize once
and then winning. That is not a coincidence: it happened on **every** game where the first press
was Randomize (the most common path), so the player could read the enemy board off their own.

Root cause: `startGame(seed)` draws the AI fleet from `makeRng(seed)`; `useGame` created its own
stream for Randomize/coin with the _same_ `makeRng(seed)`. Two fresh copies of one deterministic
generator produce the same first `randomFleet`. The second press differed (the stream had
advanced), so the test "every press produces a different one" passed, and the live PR 3 tester
compared successive presses, never player-vs-enemy.

Fix: the UI stream is `uiRng(seed) = makeRng((seed ^ 0x9e3779b9) >>> 0)`, a different seed from
the engine's. Test: `tests/app.test.tsx` › "the first Randomize never hands the player a copy of
the enemy fleet" (fails on the old code for all five seeds tried).

What would have caught it earlier: an invariant test "human fleet ≠ AI fleet after Randomize", or
simply an eye on the reveal at game over. It is exactly the class of bug §8.1 warned about —
invisible during play, only obvious once you compare the two boards.

### 20. Game-over stats were useless to a player (2026-09-18, PR 3 → fixed after release, layer: ui — owner feedback)

Symptom: the modal read "The enemy sank your fleet in 54 shots. Your shots: 54 · Enemy shots: 54".
Total shots alone says nothing about how well either side played; the owner asked for hits.

Fix: a small table — Shots, Hits (out of 17 fleet cells), Accuracy — for both sides, built from
two new pure helpers `hitCount` and `fleetCellCount` in `engine/board.ts`. Test now checks the
winner's row reads `17 / 17`. Lesson: PR 3's modal test asserted on the presence of numbers, not
on whether they meant anything.

### 21. `favicon.ico` 404 on every page load (2026-09-18, seen in the PR 4 live test, layer: build/deploy)

Symptom: the browser console showed a 404 for `/favicon.ico` on the live site. `index.html` never
linked an icon, so browsers fell back to the default path; the Vite template's `favicon.svg` was
sitting unused in `public/`.

Fix: `<link rel="icon" href="/battleship-ai/favicon.svg">` (base-prefixed for Pages) and a
ship-shaped icon in place of the template logo. Cosmetic, but a red line in the console is noise
that hides real errors during testing.

### 22. Test harness assumed the AI always wins inside 100 shots (2026-09-18, PR 5 difficulty, layer: tests — first attempt wrong)

Symptom: the new Easy-vs-Hard shot-count test threw `human won before the AI (seed 18)`. The
shared `playAI` helper has the "human" fire at water first and ships last, so it wins on its own
100th shot — an invisible ceiling that was fine for Hard (worst case ≈95) but not for an AI that
hunts at random and can need the whole board.

Fix: the Easy tests measure shots-to-sink with a small standalone simulator driven only by
`AIView`, and `playAI` takes an optional chooser for the one turn-legality check. Lesson: a helper
built around one AI's strength encodes that strength as an assumption; the first weaker AI found it.

Also logged as a deliberate spec deviation: spec v0.2 says "no difficulty selector"; the owner
asked for Easy/Hard after release. The lock is enforced in the engine (`setDifficulty` is a no-op
outside placement), not just by hiding the radio buttons.

### 23. Changing difficulty reset the selected ship (2026-09-18, PR 5, layer: UI state — caught by Devin Review)

Symptom: pick a ship in the tray, then switch Easy/Hard: the tray jumps back to the next unplaced
ship, so the next board click places the wrong ship (or nothing, with a complete fleet).

Cause: the `difficulty` reducer case reused `withGame`, whose job is to recompute `selected` after
the _fleet_ changes. Difficulty does not touch the fleet, so the recompute was a side effect.

Fix: spread `game` directly and leave `selected` alone; RTL regression test (select Destroyer →
switch → place → 2 cells). Lesson: a "convenient" helper couples two unrelated pieces of state;
a reviewer reading the reducer top-to-bottom saw it, my tests only ever switched difficulty before
touching the tray.

### 24. Difficulty hints pushed the placement board under the tray on desktop (2026-09-18, PR 5 follow-up, layer: CSS — caught by browser test)

Symptom: after PR 5 the placement screen stacked the board below the ship tray even at 1600 px.
The tray had no width; the new one-line hint text ("Parity hunt, line targeting, remembers
touching ships.") made it as wide as the sentence, and `.placement`'s `flex-wrap` did the rest.

Fix: `.tray { flex: 0 1 20rem }` so the hints wrap inside a fixed column. Verified 1400 px
(side-by-side) and 375 px (stacked). Lesson: RTL tests cannot see layout; every PR that adds text to
a flex row needs the desktop screenshot, not only the phone one.

### 25. History hook: two lint-rejected drafts before the right shape (2026-09-18, PR 6, layer: React state — caught by `eslint-plugin-react-hooks`)

Miss, not a shipped bug. First draft of `useMatchHistory` kept `localStorage` in a ref written
during render (`react-hooks/refs`), second draft called `setMatches` inside the game-over effect and
mirrored to storage from a second effect (`react-hooks/set-state-in-effect`). Both "worked" in
Vitest; both are the exact patterns that double-fire under StrictMode and would have recorded a
match twice on a dev build.

Fix: a tiny external store (`createMatchStore`: load once, `add`/`clear`, notify) read through
`useSyncExternalStore`; the game-over effect only calls `store.add`, and dedupe by `seed` lives in
pure `appendMatch`. While writing the "persists across reload" test I also caught that a
module-level singleton store would have made that test vacuous (the list survives unmount without
touching storage), so the store is created per mount. Lesson: the React lint rules were right both
times; and when a persistence test can pass without the persistence layer, the test is the bug.

### 26. History dedupe keyed on the game seed; two tabs could clobber each other (2026-09-18, PR 6, layer: persistence — caught by Devin Review)

Two findings on the first push of PR 6, both valid.

1. `appendMatch` treated `seed` as the match identity. `newSeed()` is 32 random bits, so two
   different games can legitimately share one, and the second would silently never be saved.
   Fix: every record gets an `id` (`crypto.randomUUID()`), dedupe is by `id`, and the
   "record once" guard moved to the hook (it remembers the last `game` object it recorded).
   `seed` stays as metadata. Test: same seed, different id → two rows.
2. Each tab loaded the list once and rewrote the whole key on every save, so a match finished in
   tab B could erase the one tab A had just written. Fix: `add` re-reads storage before appending,
   and the store subscribes to the window `storage` event (attached on first subscriber, removed on
   last) so the other tab's list updates live. Test: two stores on one in-memory storage.

Lesson: "the seed identifies the game" was true inside one engine run and false the moment records
outlive it; and any localStorage read-modify-write needs the multi-tab question asked out loud.

Known limit, left open on purpose: two tabs finishing games in the same millisecond can still
race the read-modify-write (Web Storage has no atomic update). Closing that needs IndexedDB or a
Web Locks mutex; not worth it for a per-device match list. Worst case is one lost row.

### 27. Leaderboard: my own test encoded the wrong tie-break, and "leaderboard time" for a shot count (2026-09-18, PR 7, layer: persistence/UI — caught by the test suite and re-reading the modal copy)

Two small misses on the first pass, neither in shipped code.

1. The ranking rule is "fewest shots, then earliest win". My `addEntry` test inserted an entry
   with the same shots as #2 but an _earlier_ date and asserted it would land at #3; the code
   correctly put it at #2 and the test failed. The rule was right, my head-math was wrong — I
   fixed the fixture (later date) and left the rule alone. Lesson: when a fresh test fails, ask
   which side is wrong before touching the implementation.
2. The first modal callout said "That's a leaderboard time!" — the leaderboard is ranked by
   shots, not time. Changed to "17 shots makes the leaderboard!" so the number the player is
   being ranked on is the number on screen.

Design notes for the record: the leaderboard is its own key (`battleship-ai.leaderboard.v1`),
not derived from match history, so "Clear history" cannot erase names (tested), and a win only
prompts when it would actually place in the top 10 (tested with a full board of 17-shot wins).
The modal's focus trap now discovers focusables on each Tab press instead of pinning the one
button, since the name field appears and disappears. The localStorage mechanics from PR 6 moved
into a shared `createStoredList` so both lists get the same re-read-before-write and
cross-tab `storage` handling; the history tests were the regression check for that move.

### 28. Shared store lost unsaved writes after a quota failure; `submit` could report a save that was rejected (2026-09-18, PR 7, layer: persistence — caught by Devin Review)

Two valid findings on the first push of PR 7.

1. When `setItem` threw (quota, private mode), `set` kept the new list in memory — but the next
   `update` re-read storage first, so a stale persisted list replaced the unsaved one. Add Ada
   (write fails), add Grace → only Grace. Fix: a `dirty` flag set on a failed write; while dirty,
   updates apply to the in-memory list, and a successful write or a `storage` event clears it.
   Test: a storage whose `setItem` fails then recovers keeps both names and syncs all three.
2. `submit` computed `qualifying` from the hook's snapshot, but `add` re-reads storage before
   ranking. If another tab pushed the cutoff below the win in between, the entry was dropped and
   the modal still said "Saved". Fix: `add` returns whether the id is on the freshly ranked list;
   `submit` only marks the game saved when it is. Test: fill storage from "another tab", then add.

Also softened the store's doc comment — it claimed tabs "never clobber each other", while #26
already admits the same-window race. Lesson: the failure branch I wrote deliberately (keep the
in-memory list) was only half a design; the other half is what the _next_ operation does.

### 29. Spec change: AI reply delay 250 ms → 500 ms (2026-09-18, PR 8, layer: spec — user decision)

Spec v0.2 §F3 and PR 3 fixed the delay at 250 ms. While refining the Captain Devin theme the
user asked for 500 ms ("i think 500ms delay") so the enemy's reply reads as a deliberate move
under the new console styling. `AI_DELAY_MS` is the single source of truth, so the change is
one constant; the fake-timer tests advance by the constant rather than a literal, which is
why none of them needed touching. Logged as a spec deviation rather than a bug.

### 30. Theme bumped the root font size and the boards stopped fitting side by side (2026-09-18, PR 8, layer: UI/CSS — caught by looking at it)

VT323 is thin, so the theme raises the root font-size from 16 px to 20 px. `--cell` was
`min(2.2rem, …)`, so every cell grew from 35 px to 44 px, two boards no longer fit in the
960 px main column, and the enemy board wrapped underneath — on the first build, before any
test failed, because no test measures layout. Fix: pin the desktop cap in pixels
(`min(35px, …)`). Lesson (again, see #24): anything sized in `rem` moves when the theme
touches the root font size; a desktop-width screenshot is the only check that catches it.

### 31. Scanlines cut after the user tried the build (2026-09-18, PR 8, layer: UI — user feedback)

The brief offered scanlines as an option and the user said keep them; after playing the
preview they found the overlay made the boards less clear and asked for it to go. Removed the
`body::before` overlay; the phosphor palette, glow and VT323 carry the theme on their own.
Lesson: a decorative choice approved from a description is not approved until it has been
played with — ship the preview before asking for the yes.

### 32. Nothing told the player the fleet was done (2026-09-18, PR 9, layer: UI — user feedback on the live build)

After the fifth ship lands, the only change on screen was "Continue to coin flip" going from
dim to lit and a hint sentence updating — easy to miss on a monochrome console. The user
asked for the button to blink green/amber until pressed. Added an `attention` class that
`PlacementScreen` applies whenever `fleetComplete(board)`; CSS pulses it with `steps(1)` so
it reads as a console indicator, and reduced-motion users get a static amber button instead.
Tested: the class is absent with an empty board and present after Randomize. Lesson: a
disabled → enabled transition is not a call to action; it took a person playing the game to
say so.

### 33. The coin's landed face was never shown (2026-09-18, PR 10, layer: UI/state — found by the testing agent, confirmed by the user)

The theme PR drew an anchor (heads) and a crosshair (tails) on the coin, but the flip timer's
single `flipDone` both revealed the result and started play, and `App` unmounts `CoinFlip`
the moment `flipping` is false. A MutationObserver in the live test measured it: `heads
spinning` → coin removed at 1002.8 ms. The landed face existed only in the code; the player
read the outcome from the status line. The user's ask: "show the outcome of the toss for
longer." Fix: a second UI flag, `revealing`, set by `flipDone` and cleared by a
`COIN_REVEAL_MS` (1.5 s) timer; `App` and the AI-turn effect gate on `coinBusy = flipping ||
revealing`, so the board and the AI's 500 ms clock start only after the hold. The coin gets a
`landed` pop for feedback (static under reduced-motion).

Test miss on the first attempt: advancing fake timers by `COIN_FLIP_MS + COIN_REVEAL_MS` in one
`act` didn't finish the reveal — the reveal timer is armed by an effect that only runs after
React commits `revealing`, which happens when `act` returns, after the clock has already
moved. Split into two `act`s (`settleCoin()`); the new test also pins that the AI has not fired
while the landed coin is still on screen. Lesson: a UI element that the design says is
visible needs a test that it stays mounted, not just that its class is right.

### 34. One cell of a freshly placed ship looked different on a phone (2026-09-18, PR 11, layer: UI/CSS — user found it on an iPhone)

The user placed a ship on a phone and saw four filled cells and one that was "only a
border". Reproduced in an iPhone-14 Playwright profile: the tapped cell had `:hover`
stuck on it — touch browsers keep the last tapped element hovered — and the generic
`button:hover:not(:disabled)` rule (specificity 0,2,1) beat `.cell.ship` (0,2,0), painting
that one cell in the inverted button colours. Every check so far ran with a mouse or a
keyboard, where hover moves away as soon as you do; nobody had left a finger on a cell.
Fix: all hover rules moved under `@media (hover: hover)`; touch taps also clear the
placement preview so an illegal-spot outline does not stay under the finger (test added);
`touch-action: manipulation` on buttons so rapid taps on the grid do not zoom.

Same pass, same device: the placement board sat ~1100 px below the fold behind the ship
list, opponent picker and controls, and in play the enemy board you tap was a screen below
the status line that reports the result. Phone layout now puts the board you act on first
(placement board, enemy waters) and pins the status line to the top while scrolling; the
title fits one line at 390 px. Lesson: "responsive" was verified at 375 px with a mouse,
which checks that it fits, not that it is usable — a touch profile and the thumb-reach
question ("where is the thing I tap, and can I see the result?") are separate checks.

### 35. Two review findings on the mobile pass (2026-09-18, PR 11, layer: UI — Devin Review)

(a) The sticky mobile status had `z-index: 2` and the game-over backdrop had none, so on a
short viewport the status strip painted over the top of the modal. Backdrop now sits above
everything (`z-index: 10`). (b) The touch marker on a cell was only reset by the next
pointerdown, so a keyboard Enter on a cell that had once been tapped inherited the touch
cleanup and wiped its focus preview. The marker is now read and cleared on every click and dropped on `pointercancel`
(a touch that turned into a scroll never clicks); test extended. Both were consequences of the same instinct — fix the phone case in isolation without
asking what the other input modes now do.
