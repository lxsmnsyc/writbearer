---
id: be-affixes
title: Storm Enchanted, Mana Burn, Teleport and heralds that run for a horn
status: todo
priority: should
type: feature
outline: false
milestone: bestiary
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/affixes-late.test.ts && pnpm vitest run test/sim/affixes.test.ts test/game/alarms.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/affixes.ts
  - test/sim/affixes.test.ts
  - test/sim/affixes-late.test.ts
shared:
  - src/game/alarms.ts
  - test/game/alarms.test.ts
  - src/content/minibosses.ts
reserves: []
provides: []
depends_on: []
---

# Storm Enchanted, Mana Burn, Teleport and heralds that run for a horn

## Goal

Build the three elite affixes of `docs/design/13-bestiary.md#elite-affixes` that are not in the game: Storm Enchanted, Mana Burn and Teleport. Make a Herald elite run for a horn post as the design says, instead of only waking packs. Make the Horn of the Road Teleport instead of Swift.

## Context

- Affixes: `src/content/affixes.ts`. The header comment lists what is built; `AFFIXES`, `AFFIX_NAME` and `SHARED` list the affixes; `Affixes.update` runs auras, wards and heralds (`HERALD_EVERY`, `wakeNext`).
- Horn posts: `src/game/alarms.ts`. Today only `hornBearer` units run for a post (`Alarms.update`); `this.again` lets the Horn of the Road blow again. Mercs already have a Heralds target priority (`Priority.Heralds` in `src/sim/ai.ts`).
- Horn of the Road: `src/content/minibosses.ts`, `hornOfTheRoad`. The design gives it Herald and Teleport. The code gives it Swift, because Teleport did not exist.
- Mana: `Unit.mana` and `derived.maxMana` in `src/sim/unit.ts`.
- Source items: `COVERAGE.md` lines with target `be-affixes`.

## Steps

- [ ] Storm Enchanted: each hit on the elite throws a spark of Storm damage at the nearest merc within 4 tiles. At most one spark every 0.5 s.
- [ ] Mana Burn: each of its hits drains mana from the target, a share of the damage dealt.
- [ ] Teleport: every few seconds while aware, the elite blinks to an open tile next to the bearer, shown on the ground a moment first.
- [ ] Herald: once its pack wakes, a Herald elite runs for the nearest standing horn post and blows it as a Horn-Bearer does. Where no post stands, it keeps waking the next pack every 10 s as today.
- [ ] Horn of the Road: Teleport instead of Swift. It blinks from post to post.
- [ ] Update the header comment of `affixes.ts`, and the "In the game so far" list of doc 13.

## Acceptance

- [ ] Each new affix and the herald's run for a post have a test in `test/sim/affixes-late.test.ts`. The existing affix and alarm tests still pass.
- [ ] A seed still gives the same elites: the new affixes roll from the `layout` stream like the others.
- [ ] Fast check passes.

## Sizing

Three affixes in one file plus a change to the alarm runner and one mini-boss. M.

## Notes for the worker

- Numbers are first guesses. Keep each one a named constant next to the others in `affixes.ts`.
- Decide whether each new affix is in `SHARED` (pack at half strength). Storm Enchanted and Mana Burn work on whoever has them. Teleport stays the elite's.
- bp-link edits `affixes.ts` after you, so keep the changes inside the existing sections.
