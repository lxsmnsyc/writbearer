# Log: split-stage-gen

- Reset to main (634d4ea), branch refactor/split-stage-gen. src/gen/stage.ts was 2,251 lines; no src/gen/stage/ yet.
- Baseline fast check: pass (56 files, 436 tests).
- Added test/gen/stage-snapshot.test.ts: 171 seeded cases hashed (sha256 of the JSON), recorded on the untouched code. Each test runs under 0.6 s warm.
- Split with a script that copies line ranges of the original into src/gen/stage/*.ts, so moved code is byte for byte the same; then fixed imports and exports.
- Small changes beyond moving: the five identical `add` closures became `adder(stage, rng)` in props.ts; buildArea's open-field body became `generateField` (field.ts); the vault block became `layVault` (vault.ts), the collapse literal `collapseFor` (collapse.ts), the horn block `placeHorns` (objectives.ts). Same draws in the same order.
- Lint wanted default exports for one-export files: arena, ambush and tomb export default.
- Checked that every original code line appears in the new files (only the add closures, the collapse literal and import lines are gone). Snapshot passes unchanged.
- Fast check: pass (57 files, 441 tests). Build: pass (the chunk size warning is from before).
