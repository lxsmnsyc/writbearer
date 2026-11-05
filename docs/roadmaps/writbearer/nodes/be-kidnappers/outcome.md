# Outcome: be-kidnappers

## Built

- `src/sim/grab.ts`: `grab(captor, victim)`, `release(captor)`, `heldBy(captor)`, `isHeld(victim)`, `drag(captor)` (moves the victim to the captor), and the `HELD` status (disables the victim). The pair is in two `WeakMap`s. One sim listener releases on the captor's death, the victim's death, and a stun, fear or root on the captor. The status tick lets go if the captor is gone or `sim.area` changed, so no hold survives an area change.
- `src/sim/ai/kidnapper.ts`: `kidnapperStep` (inserted in `MONSTER_STEPS` after `lureStep`), `markKidnapper(u)`, `isKidnapper(u)`. It goes for the nearest ward (`hostiles` filtered to `Side.Ward`), grabs by touch, drags to the nearest `sim.pocket.exits()` exit (else the farthest floor corner), then `leaveMap` on both. A foe within reach and within 1.2 tiles of its line to the goal is fought, not walked through. With no ward, or when taunted, it falls through to the plain monster steps.
- `Template.kidnapper?: boolean` (`src/content/jobs/types.ts`) and `kidnapperFlag` appended to `SPAWN_STEPS`. No monster uses it yet.
- `test/sim/kidnappers.test.ts`: 7 tests (drag to exit and Escort fails below the need, Escort survives with enough wards, stun drops the ward, kill drops it with health and position, a rooted merc in the line is fought and not passed, no ward means plain melee, area change lets go).
- `src/game/objective.ts`: unchanged. A removed ward reads `alive = false`, so `stillWard` already counts it lost.

## Deviations

- Edited `src/content/jobs/types.ts` (not owned or shared) to append `Template.kidnapper`, as be-thieves did for `thief`.
- The brief says "Guard stance merc"; the AI does not read the victim's stance. Any foe in the lane is fought. The test uses a Guard-stance merc held in place by a root.
- No edit to `objective.ts` was needed.

## Stubs left

- None. No monster carries `kidnapper: true`; `be-monsters-deep` adds the Chain Warden on `grab.ts`.

## Gotchas

- Exits come from `sim.pocket.exits()`, set by `watchTheft` in the game. A sim without a pocket drags to the farthest corner.
- The bearer next to a ward is also a blocker in the lane, so the kidnapper fights it first.
- `MONSTER_STEPS` and `SPAWN_STEPS` are edited by be-corpse-raisers too: expect a trivial merge conflict on the `SPAWN_STEPS` array line and the import lines.
- Code that reacts to ward death must check `alive`: a dragged-off ward emits no `UnitDies`.

## Proposed learnings

- A unit held by another gets the `HELD` status, not a check in `think` | keeps `think.ts` unchanged | src/sim | no

## Verification

- `pnpm typecheck`, `pnpm lint`: pass. `pnpm test`: 726 passed, 3 skipped (run before the final test-helper edit). `pnpm vitest run test/sim/kidnappers.test.ts`: 7 passed.

## Size

- Estimated M, actual M.
