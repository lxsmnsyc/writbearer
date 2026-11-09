# Outcome: gs-terrain-hazards

## Built

Open fight fields (not Vaults) hold a trap field 45% of the time: 2 to 3 rock plates and 3 to 5 open pits spread round a middle point.

- Generation: `layTrapField` in `src/gen/stage/hazards.ts`, called at the end of `generateField` (`field.ts`). It rolls on a fork of the stage stream (`rng.state ^ FIELD_STREAM`), so it draws nothing from the stage's own stream. It keeps 3 tiles off every road and clear of the entrance, exits and every `keep` place. It then checks that the entrance still reaches every exit, the site, the lair, the cache, the reward and the rites with all pits open and rubble on every plate. If not, the whole field is dropped.
- Pits are the existing `pit` prop (solid radius 1 in `SOLID`), so `navFor`, the sim obstacles and the `pit` look already handle them.
- Plates: new `HazardKind` `'plate'` (`TRAP_PERIOD.plate = 0`), `Hazard.spent?` flag, `RUBBLE_R = 0.9`.
- Game: `src/game/rocks.ts` (default export `dropRocks`) is a `WalkUp` appended to `WALK_UPS`. Any living unit within 0.8 of a plate, party or monster, starts a warning circle (r 2.2, windup 1.2 s) that hits every unit inside for 30% of max health (true damage). When it lands, the plate is removed from `stage.hazards` and a `rubble` prop (r 0.9) plus a sim obstacle take its place. A plate drops once.
- `src/game/hazards.ts` skips `plate` (no beat). `src/render/draw/hazards.ts` has a `plate` look.
- Untouched is not switched on: the field sets no objective and no gates. A rock that hurts the bearer fails an Untouched bonus the same way any hit does.

## Deviations

- The brief says "two hazard kinds"; the pit is a prop (already solid and drawn), so only `plate` is a new `HazardKind`.
- Plates are worked by a WalkUp (reading `g.stage` and `g.sim`), so no file for per-area state changed. `dropRocks` takes `Pick<GameState, 'stage' | 'sim'>` so the test needs no canvas.
- `test/gen/stage-snapshot.test.ts` snapshot was re-recorded (3 snapshots updated) on purpose: fields now hold trap fields, which changes `props` and `hazards`. Stages that roll no field are unchanged. Vault and Labyrinth tests are unchanged.
- Changeset `.changeset/gs-terrain-hazards.md` (minor).

## Stubs left

- None. Hidden traps stay out of scope.

## Gotchas

- The fork `new RNG(rng.state ^ FIELD_STREAM)` means a field's layout depends on the stream state at the end of the stage build.
- Rubble lands on units still in the circle; the sim's obstacle push-out moves them.

## Verification

- `pnpm vitest run test/game/rocks-pits.test.ts` (5 tests: field keeps off entrance, exits and roads; pits block in `navFor` with a way round; no field in a Vault; plate warns, strikes only the circle, party and monster, leaves rubble; a monster triggers it, once), `test/game/vault.test.ts` and `test/gen/objective.test.ts` pass.
- `pnpm typecheck && rtk proxy pnpm lint && pnpm test`: see the final run in the worker report. e2e not run.

## Size

- Estimated M, actual M.

Landed as bbad10e on batch/writbearer.
