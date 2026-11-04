# Outcome: cc-corpses

## Built

- `src/sim/corpse.ts`: `isCorpse(unit)` (dead and still in `sim.units`), `canRaise(unit)` (corpse, not torn, not rested, no guard), `layToRest(unit, by?)` (idempotent, emits `UnitLaidToRest` once, returns whether it acted), `isRested(unit)`, `markRested(unit)` (no event, for loading saves), `corpsesNear(sim, side, at, radius)`, `addRestGuard(sim, fn)` returning a `Lifecycle` (`start` adds the guard, `stop` removes it).
- `src/sim/events/cc-corpses.ts`: `UnitLaidToRestEvent` and `CorpseEventMap`; `SimEvents.UnitLaidToRest` and the map name appended in `src/sim/events.ts`.
- `revive` (`src/sim/unit/combat.ts`) returns false unless `canRaise`; `reveal` (`src/content/creditor.ts`) filters with `canRaise`.
- Saves: `MercSave.rested?: boolean`, written only when true, read with a default of false, so older saves load. Rested bodies stay rested across areas (same unit, WeakSet) and across save and load.
- `src/game/town.ts` `raise` refuses a rested merc before taking gold.
- `test/sim/corpse.test.ts`: plain raise, torn, rested (event once, idempotent), guard and its removal, unit that left without dying, `corpsesNear`, `reveal` leaving a rested merc dead.

## Deviations

- `addRestGuard` takes the sim first: `addRestGuard(sim, fn)`. Guards are kept per sim, so a guard in one test or sim cannot affect another.
- `isCorpse` needs `sim.units.has(unit)`. A Bribed unit (removed from the sim) and the bearer at the reveal are not corpses.
- Touched outside the owned paths: `src/game/save.ts` (optional field) and `src/game/town.ts` (one check). The brief asked to check saves; the town check stops the Temple taking gold for a raise that would fail.

## Stubs left

- None. Consecrate (registers a guard) and Last Rites (calls `layToRest`) belong to later nodes.

## Gotchas

- Other raisers still filter `!alive && !torn` themselves (Cleric `fallen`, Martyr, Choir in `sets.ts`, mutators). They stay safe because `revive` refuses, but they may pick a rested body as target and waste a cast. Move them to `canRaise` when those nodes next change.
- `isCorpse` depends on `sim.units` membership: code that deletes a dead unit from the sim makes it unraisable.
- `test/sim/concealment.test.ts` ("lands about one Escort in four") times out at 5 s under load, also on base.

## Proposed learnings

- Ask `canRaise(unit)` from `src/sim/corpse.ts` before raising a body, not `!alive && !torn` | one rule for torn, rested and guarded | src | no

## Verification

- `pnpm vitest run test/sim/corpse.test.ts test/sim/creditor.test.ts`: pass (12 tests).
- `pnpm typecheck`: pass. `pnpm lint` (via `rtk proxy`): pass. `pnpm test`: 694 pass, 1 fail (the concealment timeout above).

## Size

- Estimated M, actual M.
