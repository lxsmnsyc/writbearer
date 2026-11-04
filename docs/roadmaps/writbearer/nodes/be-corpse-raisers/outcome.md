# Outcome: be-corpse-raisers

## Built

- Corpse keeping already held in the sim: a dead monster leaves `sim.units` only when a stage is left (`src/game/stage.ts`, `objective.ts`). `src/render/draw/standing.ts` already draws the dead where they fell, lying by the rig's fall. No code change for either.
- `src/sim/raise.ts`: `raise(raiser, corpse, { make, share?, level? })` (consumes the body with `sim.units.delete`, no event; makes the unit through `make`, on the raiser's side, aware, at `share` of max health (default 0.4) and level less 2), `raisable`, `raisableNear(sim, at, reach)` (nearest first, uses `canRaise`), `raisedBy(raiser)`, `wasRaised(unit)`. A raised unit's own body cannot be raised again.
- `src/sim/ai/raiser.ts`: `markRaiser(unit, { make, cap? })` (adds the skill `RAISE_DEAD`, cap 3), `isRaiser`, default export `raiserStep`. The step walks to the nearest raisable body within 9 tiles, casts the 2.2 s `RAISE_DEAD` within 3.5 tiles and shows a ring through `warn`. With no body, or at the cap, it falls through to the usual steps (Support keeps it behind).
- `MONSTER_STEPS`: `raiserStep` inserted before `skillStep`.
- `test/sim/raisers.test.ts`: 12 tests (corpses kept, raise, torn, rested, guard, re-raise, explicit kind, walk-cast-raise with no death event, stun break, ring, cap, fight ends).

## Deviations

- No Template flag, no `SPAWN_STEPS` entry, no change in `roster.ts` or `monster-skills.ts`: `Template` is in `src/content/jobs/types.ts`, which no brief owns here. The skill sits in `raiser.ts` beside its logic. The monster that raises (be-monsters-deep, the Summoner) calls `markRaiser` from its own spawn step.
- No `src/render/draw/corpses.ts` and no `death.ts` change: nothing needed them (see Built).
- A raised unit is not in a Horde's `came` list nor `marked` for a Hunt, so those objectives do not wait for it. Raised units pay xp and drops on their own death, like any monster.

## Stubs left

- No monster raises yet. The Summoner and the Ossuary Priest/Bishop call `markRaiser` or `raise`.

## Gotchas

- `raise` removes the body with `sim.units.delete`, so anything that held the corpse (a `came` list) sees it as dead and gone.
- Raisers' `make` must add the unit to the sim (`spawnMonster` does).
- The ring is lifted on the raiser's next think after a stun, not at the stun.

## Proposed learnings

- Ask `raisable(body)` before raising a monster body | combines `canRaise` with the no-chain rule | src/sim | no

## Verification

- `pnpm vitest run test/sim/raisers.test.ts`: 12 pass.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (731 passed, 3 skipped).

## Size

- Estimated M, actual S: corpse keeping and drawing already held.
