# Outcome: gs-terrain-kinds

## Built

- `src/sim/ground.ts`: class `Ground` (`coverAt` null, `heightAt` 0, `litAt` false) and type `Cover`. `Sim.ground` is a `Ground` (`src/sim/sim.ts`).
- Ground kinds moved into tables keyed by `Patch['kind']`; a new kind adds a row to each and a member of `Patch['kind']`:
  - `KINDS` in `src/gen/stage/ground.ts`: radius range and road margin (`null` = may cross a road). `layGround` lays kinds in the order water, embers; a new kind adds one `lay(...)` call, placed last to keep RNG order. `GROUND` (counts per layer) is unchanged.
  - `EFFECTS` in `src/game/footing.ts`: `status` put on the unit, or `burns`.
  - `PAINT` in `src/render/floor.ts`: `fill` colour and a `mark` function for the shore, glints or cracks.
- Reserved as in the contract: `Patch['kind']` now has `'deep' | 'grass'`, `Patch.frozen?`, and `Stage.ledges?: Ledge[]` (`Ledge` in `src/gen/stage/types.ts`: `rect`, `level`, `ramps`). `KINDS`, `EFFECTS` and `PAINT` hold neutral rows for `deep` and `grass` (no effect, plain paint). `layGround` has no `lay` call for them, so no stage changes. A later node replaces its row and adds its `lay` call last.
- `test/sim/ground.test.ts`: stub answers, and the kinds table keys.

## Deviations

- Touched `src/sim/sim.ts` (two lines, shared). No changeset: no behavior change.
- `src/game/stage.ts` and `src/gen/stage/types.ts` unchanged; no new `Stage` fields needed.

## Stubs left

- `Ground` answers are neutral; the terrain nodes fill them in.

## Gotchas

- The `Ground` stub disables `class-methods-use-this` in its file. Remove it when the methods read state.

## Verification

- `pnpm typecheck`, `pnpm test` (87 files, 828 passed), oxlint on changed files: pass. Stage snapshot unchanged. e2e not run.

## Size

- Estimated S, actual S.

Landed as efdac1c on batch/writbearer.
