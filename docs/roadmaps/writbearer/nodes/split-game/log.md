# split-game log

- 2026-11-03: reset to main (634d4ea), branch refactor/split-game. src/game/game/ did not exist. game.ts 2,652 lines.
- Baseline fast check: typecheck and lint pass. First `pnpm test` run: 7 files failed (fight-heavy tests under load from the other worktrees); second run: 56 files, 436 passed, 24 skipped. The failures look like timeouts under load, not code.
- No unit test builds a `Game` (it needs a canvas); only e2e does. So private fields are free to move, but no fast test covers the moved code: move it line for line.
- Plan: all run state moves to a `GameState` class (`src/game/game/state.ts`) with public fields. `Game` holds one as `private readonly s` and keeps every public method as a delegation. Feature modules export functions that take the state.
- Moved every feature into src/game/game/ (19 modules). The lint caught two import cycles: `scatter` moved onto GameState, and snapshot, persist and endRun went to saving.ts. Two single-export modules became default exports.
- Registration points: `REWARDS` (rewards.ts), `WALK_UPS` (walkups.ts). Per-tick order is in tick.ts `step`.
- game.ts: 402 lines. typecheck, lint, test (436 passed) and build pass. A line-by-line comparison with the old file found only the expected changes.
