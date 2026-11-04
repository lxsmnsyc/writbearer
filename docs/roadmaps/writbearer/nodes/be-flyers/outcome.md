# Outcome: be-flyers

## Built

- `src/sim/flight.ts`: flight state per unit in a WeakMap (not saved, not a `Unit` field). `makeFlyer(u, style)`, `flies`, `flightStyle`, `isAloft`, `ground(u, seconds)` (never shortens, no-op on a walker), `land(u)`, `takeOff(u)`, `flightTurn`, constants `LAND_TIME` (3 s) and `ALOFT_MAX` (8 s), and `setupFlight` (default export), wired from `src/sim/mechanics/index.ts`. A `CheckTarget` listener at `ValuePriority.Post` forbids an aloft unit to any source whose `job.range` is `Range.Melee`. Aloft is time based: a flyer is aloft when `sim.time >= until`, so it takes off by itself and there is no tick hook. No new event.
- Styles: `'dive'` lands when a foe is in reach; `'hover'` strikes from the air. Both land for `LAND_TIME` after `ALOFT_MAX` seconds aloft, so a melee-only party always gets a turn.
- `src/sim/ai/flyer.ts`: `flyerStep`, inserted in `MONSTER_STEPS` after `thiefStep`. It only decides to land and returns false, so the usual steps move and strike.
- Template flag `flies?: 'dive' | 'hover'` on `Template`; `flyerFlag` in `SPAWN_STEPS` calls `makeFlyer`. A monster def sets only `flies`.
- Pin Down grounds the target for `pinTime` along with the root. Eagle Eye releases its arrow with `DamageFlags.Sure` against a flyer (grounded or not). Both describe texts updated.
- `src/render/draw/flight.ts`: `drawLifted`, `liftOf`, `lifted`: a ground shadow and the figure raised 14 px with a small bob, easing up and down. `standing.ts` calls it around `drawFigure`.
- `test/sim/flyers.test.ts`: 9 tests (melee cannot pick aloft and can when landed, ranged can, Pin Down on flyer and walker, Eagle Eye over 20 seeds, 200 s melee-only fight ends, hover perch, takeOff, spawn step). The flyer is `makeFlyer` on a hollowSoldier; no test template is in the roster.

## Deviations

- Edited outside owned and shared paths: `src/content/jobs/types.ts` (the `Template` type lives here; `roster.ts` is a barrel), `src/sim/mechanics/index.ts` (one line, as concealment does), `src/render/draw/standing.ts` (one call wrapping `drawFigure`; `figures.ts` was not needed).
- New state is a WeakMap in `flight.ts`, not a field in `unit.ts`, as split-unit asks.
- Eagle Eye is "never misses" (`Sure`) as its text already said, not a numeric accuracy bonus.
- Killshot: doc 09 (line 193) gives no flyer clause, so it is unchanged.

## Stubs left

- No monster has `flies` set. be-monsters-upper adds the Carrion Moth and Rift Vulture, and the Crown-Moth and Lantern-Eater nodes use it. Their signature shapes are theirs to draw.

## Gotchas

- The melee rule uses the attacker's job range, because `CheckTarget` carries no skill. A melee-job merc's spell is also refused an aloft target.
- Area damage is not filtered by `CheckTarget`, so area skills (melee-tagged too) still hit an aloft flyer. Decision: left so, as the contract says area damage is not filtered.
- Content skills that pick their own victims (known gap in the contract) can pick an aloft flyer unless moved onto `hostiles()`.
- A flyer that is stunned or unaware does not run its step, but landing is time based so a hit-and-run is not possible by stalling.
- The lifted figure carries its own shadow, so a flyer shows two shadows.

## Proposed learnings

- Time-based unit state (`until` sim time) needs no tick listener | avoids ordering with other tick work | src/sim | no

## Verification

- `pnpm vitest run test/sim/flyers.test.ts`: 9 pass.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (73 files, 711 passed, 3 skipped). No existing test changed.

## Size

- Estimated M, actual M.
