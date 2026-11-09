# Outcome: cc-sight-still

## Built

- `src/sim/light.ts`: `addLight(unit, key, { add?, percent? })`, `removeLight(unit, key)`, `lightOf(unit)` (kit.sight after bonuses), `lightFrom(unit, base)` (any base after bonuses), `noticeOf(unit, seen?, share = 1)` (unit's kit.notice after its bonuses times share, plus the light gain of `seen`). Bonuses live in a WeakMap keyed by unit then source key; the same key replaces, so a rank raise does not double. Formula: (base + sum add) * (1 + sum percent), floored at 0.
- `src/sim/still.ts`: `stillFor(unit)` seconds since the unit last moved more than 0.001 tiles (walk, knockback, dash, any displacement); 0 for the dead. Casting does not reset it. Updated by one Post-priority Tick listener installed by `setupStill(sim)`.
- AI reads swapped: `ai/merc.ts` uses `lightOf(u)`; `ai/monster.ts` notice check uses `noticeOf(u, p, UNLIT or 1)`. `render/draw/light.ts` fog radii use `lightFrom`, with the old 7 / 4.5 constants as bases.
- Tests: `test/sim/light.test.ts` (8 tests). Changeset `.changeset/cc-sight-still.md` (minor).
- Use by jobs: Wide Light is `addLight(bearer, 'wide-light', { add: n })` (moves sight and notice together). Arbalist reads `stillFor(unit)`.

## Deviations

- One line added in `src/sim/sim.ts` (import and `setupStill(this)` in the constructor) so the timer runs in every Sim.
- `src/render/draw/light.ts` edited instead of `src/render/fog.ts` (fog.ts takes a radius number already; the radii are chosen in light.ts).
- The brief says mercs' kit.sight is 4.5; the code default is 7 and only the fog draws mercs at 4.5. Both kept as they were.

## Stubs left

- None. No job uses `addLight` or `stillFor` yet.

## Gotchas

- `noticeOf` applies a seen unit's gain as flat tiles, so a percent bonus on the bearer grows the monster's notice by `kit.sight * percent`.
- The still timer starts at the first tick a unit is seen, with no history before that.
- Hidden units are untouched.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/light.test.ts test/sim/sight.test.ts` pass. `pnpm typecheck`, `pnpm exec oxlint src test e2e` clean. `pnpm test`: 834 passed, 3 skipped. e2e not run.

## Size

- Estimated M, actual S to M.
