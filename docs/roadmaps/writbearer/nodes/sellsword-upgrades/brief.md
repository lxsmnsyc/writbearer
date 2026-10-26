---
id: sellsword-upgrades
title: Sellsword: its 12 elite upgrades
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: L
spike: false
verify: pnpm vitest run test/sim/sellsword-upgrades.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/sellsword/upgrades.ts
  - test/sim/sellsword-upgrades.test.ts
shared:
  - src/content/skills.ts
  - src/sim/unit.ts
  - src/game/wages.ts
  - src/game/town.ts
  - src/gen/loot.ts
  - src/sim/sim.ts
  - src/game/game.ts
  - src/sim/statuses.ts
  - src/sim/mechanics/hit.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: sellsword
    kind: hard
    why: each upgrade patches one of the spells that node builds
  - on: targeting-rules
    kind: hard
    why: Play Dead adds a CheckTarget listener, which needs the event
---

# Sellsword: its 12 elite upgrades

## Goal

Build the Sellsword's 12 elite upgrades (3 per spell) as `builds-design` drew them in `docs/design/16-builds.md`. Each one changes how its spell works, not only its numbers. Replace the placeholder upgrades in `src/content/jobs/sellsword/upgrades.ts`.

## Context

- Design: `docs/design/16-builds.md`, the Sellsword section. Source skills: `docs/design/09-skill-trees.md#sellsword` (Hired Blade, Coin and Dirty Tricks).
- Rules: `contracts/builds.md`. An upgrade is a patch over its spell, or a passive it starts.
- Read the outcome of `sellsword` for the spells' code.

## Acceptance

- [ ] All 12 upgrades have a patch or effect, and each has a test in `test/sim/sellsword-upgrades.test.ts`.
- [ ] Every upgrade names one of the job's 4 spells, 3 per spell (the job-def contract test checks it).
- [ ] Fast check passes.

## Sizing

12 upgrades in one file, several with engine hooks (listed below). L.

## Notes for the worker

- Engine notes by source skill. Use the notes for the skills doc 16 makes upgrades.
- Bonus skill ranks (Veteran of Many Wars here, Paid in Full in the Coin branch): a modifier that `rankOf` (`src/content/skills.ts`) adds, not a change to spent points.
- Weapon Habit reads the existing `ItemBase.weapon` (`WeaponKind` in `src/sim/item.ts`).
- Hazard Pay and Paid in Full read how much was paid over the wage at a Waystation (`src/game/wages.ts`). Add a hook there; do not change wage rules.
- Bribe makes a non-elite Human enemy leave the fight: it walks off the field and is removed, dropping nothing.
- Haggler lowers Town prices in `src/game/town.ts` while the Sellsword is in the party.
- Add a Blind status with buildup: blinded units miss more (a CheckHit listener). Lamplighter and monsters will reuse it.
- Play Dead uses the targeting contract: while it lies still, monsters may not target it.
- Cutpurse steals one timed buff: mark which statuses are buffs with a flag on the status, not a list.
- Do not edit the registries, `index.ts` or `src/content/items.ts`.
