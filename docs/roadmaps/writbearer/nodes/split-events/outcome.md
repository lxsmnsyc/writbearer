# Outcome: split-events

## Built

- `src/sim/events.ts` keeps the `SimEvents` const enum and `interface SimEventMap extends EventMap, HitEventMap, SkillEventMap, StatusEventMap, LifeEventMap {}`. It re-exports every payload type with `export type * from './events/<module>'`. No importer changed.
- `src/sim/events/hits.ts`: CheckHit, CheckTarget, UnitMiss, UnitDamage, Buildup, CheckAttackElements; `HitEventMap`.
- `src/sim/events/skills.ts`: CheckSkillCost, UnitSkillWindup, UnitSkillRelease, CheckSkillRank, CheckProjectile; `SkillEventMap`.
- `src/sim/events/statuses.ts`: CheckBuildup, CheckStatusDuration, StatusEvent (Applied, Removed); `StatusEventMap`.
- `src/sim/events/life.ts`: UnitHeal, UnitDies, UnitRevived, UnitRevealed, Tick, CheckChase; `LifeEventMap`.
- `src/sim/events/CLAUDE.md`: the rule below.

Add an event:
1. Add one line to `SimEvents` in `src/sim/events.ts`.
2. Add the payload interface and a `[SimEvents.Name]: [PayloadEvent, Priority]` entry in a module under `src/sim/events/` (its `<Group>EventMap`). Make a new module for a new feature.
3. For a new module, add `export type * from './events/<module>'` and the map import to `events.ts`, and append the map name to the `extends` list.
4. Group modules use `import type { SimEvents } from '../events'`.

## Deviations

- None. Only `src/sim/events.ts`, `src/sim/events/**` and this folder changed.

## Stubs left

- None.

## Gotchas

- `export *` fails lint (`consistent-type-exports`); use `export type *`.
- The enum cannot move out of `events.ts` (const enum); group modules import it as a type-only cycle, which lint and tsc accept.
- `test/sim/concealment.test.ts` ("lands about one Escort in four") times out at 5 s here, also on unmodified base. Not caused by this node.

## Proposed learnings

- Add new events as their own module under `src/sim/events/` | keeps event nodes from editing the same lists | src/sim/events | no

## Verification

- `pnpm typecheck` and `pnpm lint`: pass. `pnpm test`: 686 pass, 1 fail (the concealment timeout above, same on base).

## Size

- Estimated S, actual S.
