---
name: battleship-browser-testing
description: Play Battleship AI locally or on its live deployment, including AI strategy and timed turn-lock checks.
---

# Battleship browser testing

## Live deployment

- When asked to test deployment, browse
  `https://anastosj.github.io/battleship-ai/` directly; do not substitute a local
  build. This public client-side app requires no credentials or local services.
- Hard-refresh and verify the requested deployed bundle and initial phase.
  Current flow starts with an empty placement screen, not fixed fleets.

## Placement and coin flow

- Carrier starts selected; legal placement auto-advances through five ships.
  Continue enables only after all five ships (17 cells) are placed.
- Hover a cell and press R to rotate the preview. Use an empty bow overlapping
  an existing ship to test rejection: clicking an occupied cell intentionally
  picks that ship up instead.
- Randomize generates a complete fleet. Compare occupied coordinates between
  presses and count 17 cells; do not assume ships are separated.
- The live coin is random. A seed prop exists in code, not in the URL. Retry
  New game to observe both outcomes rather than changing RNG/state.
- Read the current `COIN_FLIP_MS`, `COIN_REVEAL_MS`, and `AI_DELAY_MS` before
  timing tests. The coin currently spins for 1000 ms, holds the landed face
  for 1500 ms, then (for Tails) waits another 500 ms for the opening AI shot.
  A read-only MutationObserver on coin classes and board appearance gives
  distinct timestamps for these stages.
- To test pending-Tails cancellation, click New game during the landed-face
  hold or before the opening AI timer completes. Count the attempt only if
  Tails occurred and reset preceded the opening AI shot.
- Play again should clear ships as well as shots, returning to placement.

## Local setup

- From the repository root, source `~/.nvm/nvm.sh` and use Node 24.
- With dependencies installed, run `npm run build`, then
  `npm run preview -- --port 4173` (reuse an existing preview if appropriate).
- Navigate to `http://localhost:4173/battleship-ai/`; the Vite base path matters.
- This version is client-side and requires no login or backend.
- For working-tree testing with HMR, use `npm run dev -- --host 0.0.0.0`
  and `http://localhost:5173/battleship-ai/`. Hard-reload after a handoff
  that changed code; do not mix pre-change and post-change evidence.

## Gameplay observation

- Scope cell buttons to the grids labeled `Your fleet` or `Enemy waters`.
  Buttons have coordinate/state accessible labels such as `F2, water`.
- Check the current fleet-generation/placement code rather than assuming
  fixed layouts. Track every own-board hit/miss after each AI reply:
  the number of distinct marks must increase by one per completed nonfinal turn.
- Capture the status after the delayed AI response, not just immediately after
  firing, to catch human hit/sunk messages being overwritten.
- A human win cannot establish that unhit enemy ships are revealed on loss.
  Report this coverage limitation if the losing path is excluded.
- With random hidden enemy ships, hunt and target using visible board feedback;
  do not inspect hidden state. Sink one enemy ship if sunk styling and fleet
  panel transitions need coverage, then finish to either modal outcome.
- For Hunt/Target AI, record each new own-board mark and classify hunt versus
  target using previously hit, unsunk ships. Hunt shots should share parity;
  target shots should probe orthogonal neighbours and extend aligned hits.
  Capture the transition back to hunting after sinking a ship.
- Compare the final winner's shot count against distinct board marks, not clicks.
  One game does not establish average AI performance.
- Check whether the currently placed ships touch before claiming adjacent-ship
  attribution coverage; separated fleets cannot exercise that case.

## Density heatmap checks

- The threat checkbox appears during combat and gameover. Enable it before
  observing density; unfired own cells include `, threat N%` in their labels.
  Fired cells must lose both that suffix and their amber background.
- Compare the newly fired AI coordinate with its **previous** heat, not the
  recomputed heat after the shot. A maximum-density chooser should select a
  prior maximum; ties are legitimate.
- Observe both boards when measuring turn lock: the enemy board disables
  before the delayed mutation on Your fleet. An observer attached only to
  Your fleet may miss the lock transition.
- After aligned hits, expect legal line extensions rather than requiring all
  four orthogonal neighbours to remain maximal regardless of prior misses.
- Test gameover controls using normal pointer input. A rendered checkbox
  behind a modal is not evidence that the control is usable.
- Leave heat enabled before New game and Play again, then start combat again
  to verify reset. Absence of the checkbox during placement alone does not
  establish that its state was reset.

## Timing-sensitive UI tests

- The walking skeleton schedules AI replies after 500 ms. General computer-tool
  click batching may exceed this window, so measure actual pointer timestamps.
- For native timed inputs on Linux, query `xrandr --current`, scale screenshot
  coordinates to the actual display, and use xdotool mousedown/mouseup sequences
  with an explicit 50 ms gap.
- A read-only DOM MutationObserver and pointerdown log can expose timestamps,
  disabled counts, and shot counts in a clearly labeled test-only panel.
  Do not modify game state or its timers.
- Test both a second cell click during thinking and New game during thinking;
  wait beyond the AI delay to rule out leaked shots.

## Devin Secrets Needed

None for local or public live browser gameplay.

## Phone-size live smoke

- Use a 390x844 viewport with mobile metrics and touch enabled; viewport
  resizing alone does not prove touch behavior. Verify `(hover: hover)` is
  false, and dispatch actual touch input for placement and firing.
- During placement, Your fleet comes before the ship tray; during combat,
  Enemy waters comes before Your fleet. Compare element rectangles and
  capture screenshots rather than relying on DOM order.
- After tapping to place, pick up, and re-place a ship, verify no
  `.preview-ok` or `.preview-bad` cells remain. Do not confuse a brief browser
  tap highlight with a persistent application hover state.
- Before checking pinned status, verify scrolling actually occurred and
  `.status` top is zero. Synthetic CDP scroll gestures may not move the
  document; native wheel input over the phone viewport can establish the
  scroll precondition while subsequent gameplay remains touch-based.
- Across thinking and response states, compare status height, board document
  coordinates, and document scrollWidth against viewport width. Keep error
  collection attached across desktop and phone reloads.
