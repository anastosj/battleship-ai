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
- Observe the roughly 1000 ms Flipping interval separately from the roughly
  500 ms AI timer after Tails reveal. Double-click Flip with measured native
  inputs; the second press should be disabled.
- To test pending-Tails cancellation, issue native New game about 1100 ms
  after Flip, then measure reveal-to-reset. Count the attempt only if Tails
  occurred and reset preceded the opening AI shot.
- Play again should clear ships as well as shots, returning to placement.

## Local setup

- From the repository root, source `~/.nvm/nvm.sh` and use Node 24.
- With dependencies installed, run `npm run build`, then
  `npm run preview -- --port 4173` (reuse an existing preview if appropriate).
- Navigate to `http://localhost:4173/battleship-ai/`; the Vite base path matters.
- This version is client-side and requires no login or backend.

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
