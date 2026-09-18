---
name: battleship-browser-testing
description: Play Battleship AI locally or on its live deployment, including AI strategy and timed turn-lock checks.
---

# Battleship browser testing

## Live deployment
- When asked to test deployment, browse
  `https://anastosj.github.io/battleship-ai/` directly; do not substitute a local
  build. This public client-side app requires no credentials or local services.

## Local setup
- From the repository root, source `~/.nvm/nvm.sh` and use Node 24.
- With dependencies installed, run `npm run build`, then
  `npm run preview -- --port 4173` (reuse an existing preview if appropriate).
- Navigate to `http://localhost:4173/battleship-ai/`; the Vite base path matters.
- This version is client-side and requires no login or backend.

## Gameplay observation
- Scope cell buttons to the grids labeled `Your fleet` or `Enemy waters`.
  Buttons have coordinate/state accessible labels such as `F2, water`.
- Read the current fleets from `src/engine/fleet.ts` rather than assuming
  placement is unchanged. Track every own-board hit/miss after each AI reply:
  the number of distinct marks must increase by one per completed nonfinal turn.
- Capture the status after the delayed AI response, not just immediately after
  firing, to catch human hit/sunk messages being overwritten.
- A human win cannot establish that unhit enemy ships are revealed on loss.
  Report this coverage limitation if the losing path is excluded.
- To exercise an AI win, fire at water cells from the inspected enemy layout.
  First sink one enemy ship if human hit/sunk messaging also needs coverage.
- For Hunt/Target AI, record each new own-board mark and classify hunt versus
  target using previously hit, unsunk ships. Hunt shots should share parity;
  target shots should probe orthogonal neighbours and extend aligned hits.
  Capture the transition back to hunting after sinking a ship.
- Compare the final winner's shot count against distinct board marks, not clicks.
  One game does not establish average AI performance.
- Check whether the current fixed ships touch before claiming adjacent-ship
  attribution coverage; separated fleets cannot exercise that case.

## Timing-sensitive UI tests
- The walking skeleton schedules AI replies after 250 ms. General computer-tool
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
