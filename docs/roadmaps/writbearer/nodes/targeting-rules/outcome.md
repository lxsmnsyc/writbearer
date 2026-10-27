# Outcome: targeting-rules

## Built

- `SimEvents.CheckTarget` and `CheckTargetEvent` in `src/sim/events.ts`, on `ValuePriority`.
- `src/sim/targeting.ts`: `canTarget(source, target)`, `hostiles(source)`, and an extra helper `allowed(source, units)` that filters a list.
- `src/sim/ai.ts`: `thinkMerc` (enemy pool, Focus shout), `useSkill` (an aimed hostile target that is forbidden is skipped; allies are not asked), `thinkMonster` (seen pool, `blocker`, lure bait via `lureFor`, taunt ignored when the taunter is forbidden, skill target), and `think` (a forbidden current target is dropped).
- `src/sim/sim.ts`: volley extras and straight projectile hits go through `allowed` / `canTarget`.
- `test/sim/targeting.test.ts`: 7 tests covering all four acceptance criteria.
- No listener forbids anything yet, so play is unchanged. No changeset (no behavior change).

## Deviations

- Added the helper `allowed(source, units)` beyond the contract's two functions; it is additive.
- Skills in `src/content` are untouched. Skills that gather targets themselves (`sim.living(Side.Monster)` inside `aim` or `release`) are not filtered; only the target the AI passes in or `aim` returns is checked.

## Stubs left

- None.

## Gotchas

- A homing first arrow is not re-checked at release, only at the pick. A listener that forbids a unit mid-windup leaves that one shot.
- A forbidden taunter keeps the TAUNTED status; the monster behaves as if it was not taunted.
- `canTarget` emits an event per call; for straight shots it runs only once a unit is inside the hit radius.
- Format with `pnpm exec oxfmt <files>`, not prettier.

## Proposed learnings

- Every new hostile target choice goes through `canTarget` or `allowed`, never `sim.foes` alone | one rule for Duel, Play Dead, hidden units | src/sim | no

## Verification

- `pnpm vitest run test/sim/targeting.test.ts`: 7 passed.
- `pnpm typecheck && pnpm lint && pnpm test`: all pass (52 files, 431 tests), no existing test changed. The spawn and flow timeouts did not occur.

## Size

- Estimated M, actual M.

## Final interface (for freezing)

```ts
// src/sim/events.ts
SimEvents.CheckTarget = 'CheckTarget'
interface CheckTargetEvent extends BaseEvent { source: Unit; target: Unit; allowed: boolean }
// SimEventMap: [SimEvents.CheckTarget]: [CheckTargetEvent, ValuePriority]
// src/sim/targeting.ts
canTarget(source: Unit, target: Unit): boolean   // alive, in sim.foes(source.side), then emits CheckTarget
hostiles(source: Unit): Unit[]
allowed(source: Unit, units: Unit[]): Unit[]     // addition
```
