# Outcome: targeting-rules

## Built

- `SimEvents.CheckTarget` and `CheckTargetEvent` in `src/sim/events.ts`, on `ValuePriority`.
- `src/sim/targeting.ts`: `canTarget(source, target)`, `hostiles(source)`, and an extra helper `allowed(source, units)` that filters a list.
- `src/sim/ai.ts`: `support` (Hunt.Support gets the filtered list), `thinkMerc` (enemy pool, Focus shout), `useSkill` (an aimed hostile target that is forbidden is skipped; allies are not asked), `thinkMonster` (seen pool, `blocker`, lure bait via `lureFor`, taunt ignored when the taunter is forbidden, skill target), and `think` (a forbidden current target is dropped).
- `src/sim/sim.ts`: release-time checks with `forbids`: melee hit frame, the first arrow of a volley, homing impact, and the release of a `Targeting.Enemy` cast (the cast is cancelled). Volley extras and straight hits go through `allowed` / `canTarget`; a straight shot asks about a refused unit once.
- `forbids(source, target)` in `src/sim/targeting.ts`: true only for a living foe a listener refuses. Dead units, allies and non-foes are never forbidden, so a dead taunter or bait owner behaves as before.
- `test/sim/targeting.test.ts`: 18 tests; 13 fail without the change in ai.ts and sim.ts.
- No listener forbids anything yet, so play is unchanged. No changeset (no behavior change).

## Deviations

- Added the helper `allowed(source, units)` beyond the contract's two functions; it is additive.
- `useSkill` keeps its forbidden check: it is not dead code, because `aim` of the Cleric's Wall of Faith and Veil returns hostile units. Only the AI's own pick was already filtered.
- Skills in `src/content` are untouched. Skills that gather targets themselves (`sim.living(Side.Monster)` inside `aim` or `release`) are not filtered; only the target the AI passes in or `aim` returns is checked.

## Stubs left

- Known gap for the Duel (duelist-showmanship) and Play Dead (sellsword-tricks) nodes: content skills that gather their own victims do not ask CheckTarget. They should use `hostiles(source)` or `allowed(source, units)` from `src/sim/targeting.ts`: `challenged` in `src/content/skills.ts` (~25, ~54, ~196), `inLine` (~320), `around` in `src/content/ranger.ts` (~20), and `after` in `src/content/cleric.ts` (~28). Traps (`springTraps`) and zones are also unfiltered, as area effects.

## Gotchas

- A forbidden taunter keeps the TAUNTED status; the monster behaves as if it was not taunted. A taunt whose source died is removed by `tickStatuses` before the AI runs, so that path cannot be reached in a tick.
- A cast of a `Targeting.Enemy` skill is cancelled at release when its target is forbidden, area skills included.
- `canTarget` emits an event per call; for straight shots it runs only once a unit is inside the hit radius.
- Format with `pnpm exec oxfmt <files>`, not prettier.

## Proposed learnings

- Every new hostile target choice goes through `canTarget` or `allowed`, never `sim.foes` alone | one rule for Duel, Play Dead, hidden units | src/sim | no

## Verification

- `pnpm vitest run test/sim/targeting.test.ts`: 7 passed.
- `pnpm typecheck && pnpm lint && pnpm test`: all pass (52 files, 442 tests), no existing test changed. The spawn and flow timeouts did not occur.

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
allowed(source: Unit, units: Unit[]): Unit[]     // addition to the contract: add it when freezing
forbids(source: Unit, target: Unit): boolean     // addition: living foe that a listener refuses; for release checks
```
