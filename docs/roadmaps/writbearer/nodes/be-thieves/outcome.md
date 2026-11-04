# Outcome: be-thieves

## Built

- `src/sim/leave.ts`: `leaveMap(u)` (default export), the shared non-death exit. Bribe is unchanged.
- `src/sim/theft.ts`: `Loot` (`{ item } | { gold }`), the `Pocket` port (`pick()`, `take`, `give`, optional `exits()` and `say()`), `markThief(u, pick?)` (the `pick` argument is the overridable `PickLoot` for sb-regalia), `steal`, `dropLoot`, `carried`, `wantsLoot`, `keepLoot`. Thief state is in a `WeakMap`; `unit.ts` is unchanged. `markThief` hangs one `UnitDies` listener on the sim that calls `dropLoot`.
- `src/sim/sim.ts`: field `pocket: Pocket | null` (append).
- `src/sim/ai/thief.ts` and one step `thiefStep` in `MONSTER_STEPS`, after `lureStep`: goes for the bearer, steals by touch, runs to the nearest open exit (`sim.pocket.exits()`), else the farthest floor corner, then `leaveMap`. A taunt before the theft makes it act as a normal monster. Stun stops the run (units with `disabled` do not think); root and slow work through `travel`. With nothing to take it is marked spent and fights normally.
- `src/game/game/theft.ts`: `watchTheft(g)` sets `g.sim.pocket`, called from `watchSim` in `listeners.ts`. Picks a random spare pack item (worn gear is on the mercs and belts are the mercs', so the pack holds only spare items); gold (25%, at least 1, never all) only if the pack has no item. Drops go to `g.ground`; lines go to `g.say`. The draw uses `g.streams.area(1, Stream.Combat, 7000 + stageIndex)`.
- `Template.thief?: boolean` (`src/content/jobs/types.ts`) and `thiefFlag` in `SPAWN_STEPS`. No monster uses it yet.
- `test/sim/thieves.test.ts`: 6 tests (one item taken and the thief leaves with no `UnitDies`; kill drops it and the pack takes it back; stun stops the run; gold share; empty pack; save round trip through `saveItem`/`loadItem` after a theft and after a recovery).

## Deviations

- `Pocket.pick()` takes no `rng` (the brief had `pick(rng)`): the game side owns its seeded area stream.
- Edited `src/content/jobs/types.ts` to add `Template.thief` (not an owned or shared path); one appended field.
- No `src/ui/log.ts` exists; the log line goes through `g.say`. `src/game/inventory.ts` is unchanged.
- The acceptance item "a Hunt or Horde that counted it completes" is covered only by the `alive` false and removed-from-`sim.units` checks; the objectives test `alive`. No `ObjectiveRun` test.
- The pack-screen mid-drag check was not done.

## Stubs left

- None. No monster carries `thief: true`; `be-monsters-deep` adds the Tithe-Taker.

## Gotchas

- A theft takes a whole pack stack (a potion stack goes in one).
- The once-per-area limit is one theft per thief unit, not per `sim.area`.
- `test/sim/concealment.test.ts` can time out under load; passes alone.
- Ground items clear at an area change, so an item still on a dead thief's spot when the party leaves is lost, never duplicated.

## Proposed learnings

- A unit that leaves without dying uses `leaveMap` | one exit path | src/sim | no

## Verification

- `pnpm typecheck`, `rtk proxy pnpm lint`: pass. `pnpm vitest run test/sim/thieves.test.ts`: 6 passed. `pnpm test`: all passed except one `concealment` timeout under load (passes alone).

## Size

- Estimated M, actual M.
