# Outcome: be-strippers

## Built

- `src/sim/strip.ts`: `strip(u, slot)`, `restore(u, slot)`, `restoreAll(sim)`, `stripped(u)`, `isStripped`, `workingItems(u)`, `claim(sim, u)` (once per merc per area). State is a WeakMap keyed by sim, never saved.
- `src/sim/ai/stripper.ts`: `markStripper(unit)` makes a unit a stripper; `pickSlot(target)` takes the first worn, working slot in `EQUIP_SLOTS` order (weapon, offhand, head, body, cloak, boots, accessories). A landed basic attack on a party unit strips it and says a line through `sim.pocket.say`. It listens to `UnitDamage` at Post, so there is no step in `monster.ts`.
- `src/sim/unit/gear.ts`: the equipment recalc source, the weapon pick and the card/unique effects skip stripped items (stripped weapon means the unit's own weapon). `equip` and `unequip` clear the strip of that slot, so the normal hand-over (pack and back) restores the item.
- `src/game/game/areas.ts`: `restoreAll(g.sim)` after `g.sim.area++`.
- `src/content/sets.ts`: `piecesOn` counts working items only, so a stripped piece does not count toward a set.
- `test/sim/strippers.test.ts`: 6 tests (weapon first, armor untouched; once per merc per area and restore on area change; spells ignored; hand-back; save and load; sets).
- Test gap: the area-change test calls `sim.area++; restoreAll(sim)` itself. `cross()` in `areas.ts` is private and needs a full GameState, so the one-line hook call is not exercised.
- Changeset `.changeset/be-strippers.md` (minor).

## Deviations

- Edited `src/content/sets.ts` (one line, not owned or shared) so stripped pieces do not count toward sets, as the brief's notes asked.
- No `src/ui/log.ts` edit (file does not exist); the log line uses `sim.pocket.say`.
- No template flag or `SPAWN_STEPS` entry: the brief says the Confessor is added by `be-monsters-deep`, which can call `markStripper` from a spawn step.
- `monster.ts` and `spawn-steps.ts` untouched.

## Stubs left

- No monster is a stripper yet. `be-monsters-deep` adds a flag and calls `markStripper`.

## Gotchas

- Set bonuses update only when `applySets` runs (on revive and death). A strip does not call it, so the party-wide set bonus lags until the next call; the count itself is correct. A later node may call `applySets` after a strip (the sim cannot import content).
- Equipping into a stripped slot, even the same item, clears the strip.
- Sell and vault paths only read items, so nothing is duplicated; `unequip` clears the strip.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/strippers.test.ts`: 6 passed.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (708 passed, 3 skipped).

## Size

- Estimated M, actual M.
