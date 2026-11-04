# Outcome: split-unit

## Built

`src/sim/unit.ts` keeps the `Unit` class: every field, getter (`derived`, `disabled`, `fear`, `speed`, `busy`) and method, with the same signatures. Feature methods are one-line delegates `method(...)` -> `fn(this, ...)`. `unit.ts` re-exports `BELT_SLOTS`, `Kit`, `UnitSpec` and `HitOptions`, so no importer changed. `distanceTo` and `derived` stay in `unit.ts`.

Modules in `src/sim/unit/` (each function takes the unit first):

- `movement.ts`: `face`, `isFlankedBy`, `speedOf` (the `speed` getter), `walkTo`, `travel`, `ROUTE_DRIFT`, `ROUTE_AGE`.
- `casting.ts`: `startAttack`, `skillCost`, `canCast`, `startCast`, `skillRank`.
- `statuses.ts`: `addStatus`, `removeStatus`, `buildUp`, `tickStatuses`, `clearStatuses`, `BUILDUP_HOLD`, `BUILDUP_DECAY`.
- `gear.ts`: `equip`, `unequip`, `setBonus`, `refreshCards`, `recalc`, `raiseStat`, `drink`, `beltPotion`, `BELT_SLOTS`, `POTION_COOLDOWN`, `RecalcSource`, `RECALC_SOURCES`.
- `combat.ts`: `hit`, `heal`, `revive`, `die`, `HitOptions`.
- `kit.ts`: `Kit`, `DEFAULT_KIT`, `UnitSpec`.
- `CLAUDE.md`: rules for the folder (WeakMap for new state, recalc sources, type-only Unit import).

Recalc source list: `RECALC_SOURCES` in `src/sim/unit/gear.ts`, an ordered array of `{ id, modifiers(unit) }`: `own` (unit.modifiers), `equipment` (itemModifiers of worn items), `statuses` (status def modifiers), `bonuses` (passives and auras). `recalc` concatenates them in that order. A node that adds or filters a source adds a module with one `RecalcSource` and one entry in the array.

## Deviations

- `route`, `cardEffects` and `buildupAt` were `private` on `Unit`; they are now public (with a comment naming the module that uses them) because the feature modules need them.
- `recalc` and `refreshCards` use for-of loops in place of `flatMap` and `forEach`; the modifier order is unchanged.

## Stubs left

- None.

## Gotchas

- The `Unit` methods call each other through `this` (e.g. `unit.recalc()`, `unit.walkTo`), so a test that spies on a `Unit` method still sees internal calls.
- One `pnpm test` run failed once on a hit-rate test under load and passed on re-run (687 pass); not caused by this change.

## Proposed learnings

- New per-unit state goes in a WeakMap in the node's own module, not a `Unit` field | keeps the class stable for parallel nodes | src/sim/unit | no
- New recalc inputs are a `RecalcSource` entry in `RECALC_SOURCES` | sums stay ordered | src/sim/unit | no

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: pass (69 files, 687 tests, 3 skipped). `test/` has no diff.

## Size

- Estimated M, actual M.
