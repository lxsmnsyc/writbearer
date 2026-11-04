---
id: split-unit
title: Split src/sim/unit.ts by feature
status: active
priority: should
type: refactor
outline: false
milestone: combat-core
target:
from:
size: M
spike: false
verify: pnpm typecheck && pnpm lint && pnpm test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns:
  - src/sim/unit.ts
  - src/sim/unit/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Split src/sim/unit.ts by feature

## Goal

Move the logic of the `Unit` class in `src/sim/unit.ts` (832 lines) into one module per feature under `src/sim/unit/`, with no change in behavior, so the combat, item and monster-type nodes each edit their own module instead of one class. `Unit` keeps every public field, getter and method; its methods become short delegates to the feature modules, so the 117 importers do not change.

## Context

- Open nodes that edit `src/sim/unit.ts` today: be-affixes, be-flyers, be-strippers, cc-buffs, cc-corpses, cc-el-defense, cc-el-skill-amp, cc-knockback, cc-resource, gs-terrain-lantern, gs-terrain-patrols, ie-item-bonuses, ie-item-carry, ie-item-model.
- Maintainer decision (2026-11-05): split unit.ts, events.ts and roster.ts, replacing the earlier "append only, merge in order" rule in `GOAL.md`.
- Model: split-ai (`src/sim/ai.ts` stays a barrel over `src/sim/ai/`).

## Steps

- [ ] `src/sim/unit/movement.ts`: `walkTo`, `travel`, the route constants (`ROUTE_DRIFT`, `ROUTE_AGE`), `face`, `isFlankedBy`, the `speed` calculation.
- [ ] `src/sim/unit/casting.ts`: `startAttack`, `skillCost`, `canCast`, `startCast`, `skillRank`.
- [ ] `src/sim/unit/statuses.ts`: `addStatus`, `removeStatus`, `buildUp`, `tickStatuses`, `clearStatuses`, `BUILDUP_HOLD`, `BUILDUP_DECAY`.
- [ ] `src/sim/unit/gear.ts`: `equip`, `unequip`, `setBonus`, `refreshCards`, `recalc`, `raiseStat`, `drink`, `beltPotion`, `BELT_SLOTS`, `POTION_COOLDOWN`.
- [ ] `src/sim/unit/combat.ts`: `hit`, `heal`, `revive`, `die`, `HitOptions`.
- [ ] `src/sim/unit/kit.ts`: `Kit`, `DEFAULT_KIT`, `UnitSpec`. `unit.ts` re-exports every name it exports today.
- [ ] Registration point in `recalc`: the modifiers it sums come from an ordered list of named sources (equipment, set bonuses, cards, ...), run in today's order. A node that adds or filters a source (stripped items, item bonuses) adds one module and one list entry.
- [ ] Each feature function takes the unit as its first argument. Modules under `src/sim/unit/` import `type Unit from '../unit'` only as a type.

## Acceptance

- [ ] Every existing test passes unchanged (`test/` has no diff), including `test/gen/stage-snapshot.test.ts` and the seed-sensitive boss tests.
- [ ] No importer outside `src/sim/unit.ts` and `src/sim/unit/` changes.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

M: one class moved into six modules plus a source list; no behavior change, the existing tests prove it.

## Notes for the worker

- Nothing else goes into this change, so the review only checks that code moved.
- Keep the order of every side effect inside `recalc`, `hit` and `addStatus`; float sums are order-sensitive and the boss tests catch a change.
- Watch `import/no-cycle`. If a runtime cycle with `../unit` appears, pass values in instead of importing the class.
- New per-unit state from later nodes goes in a WeakMap in the node's own module (as cc-resource plans), not as a new `Unit` field. Write that rule in a nested `src/sim/unit/CLAUDE.md`.
