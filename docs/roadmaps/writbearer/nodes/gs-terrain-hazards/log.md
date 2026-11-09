# Log: gs-terrain-hazards

- Plate is a new HazardKind, pit stays a prop. Plates run as a WalkUp (`src/game/rocks.ts`), no per-area state.
- Trap field rolls on a forked stream at the end of `generateField`; stage snapshot re-recorded.
- Fast check passed: typecheck, lint, 93 test files.
