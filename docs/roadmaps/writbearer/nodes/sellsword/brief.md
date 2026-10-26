---
id: sellsword
title: Sellsword: the job, its 4 spells and innate passive
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/sellsword.test.ts test/content/jobs.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/sellsword/index.ts
  - src/render/looks/sellsword.ts
  - test/sim/sellsword.test.ts
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
  - on: builds-design
    kind: hard
    why: the job's 4 spells, innate passive and 12 upgrades are drawn there
---

# Sellsword: the job, its 4 spells and innate passive

## Goal

Make the Sellsword (striker) a real job under the build model of `docs/design/16-builds.md`: replace its placeholder template, starter gear and look, and build its 4 spells (ranks 1 to 10) and its innate passive, as `builds-design` drew them. It stays `hireable: false`; roster-balance opens it at the Guild House. Its 12 elite upgrades are the `sellsword-upgrades` node.

## Context

- Design: `docs/design/16-builds.md`, the Sellsword section (spells, innate, upgrades and numbers). Source skills: `docs/design/09-skill-trees.md#sellsword` (Hired Blade, Coin and Dirty Tricks).
- Rules: `contracts/builds.md` (spells, ranks, shards, elite upgrades) and `contracts/job-def.md`.
- Pattern: the Vanguard's module after job-registry.
- Look: one large signature shape, per the minimalist figure rule (`docs/design/02-tech-stack.md#unit-design`).

## Acceptance

- [ ] A headless fight with the Sellsword in the party plays out, in `test/sim/sellsword.test.ts`.
- [ ] Each of the 4 spells and the innate passive has a test, in the style of `test/sim/tree-skills.test.ts`.
- [ ] Fast check passes.

## Sizing

Job data, a look, 4 spells and a passive in its own files, plus small engine hooks. M.

## Notes for the worker

- Engine notes by source skill. Doc 16 decides which skills are spells, the innate or upgrades; use the notes for the ones this node builds.
- Bonus skill ranks (Veteran of Many Wars here, Paid in Full in the Coin branch): a modifier that `rankOf` (`src/content/skills.ts`) adds, not a change to spent points.
- Weapon Habit reads the existing `ItemBase.weapon` (`WeaponKind` in `src/sim/item.ts`).
- Hazard Pay and Paid in Full read how much was paid over the wage at a Waystation (`src/game/wages.ts`). Add a hook there; do not change wage rules.
- Bribe makes a non-elite Human enemy leave the fight: it walks off the field and is removed, dropping nothing.
- Haggler lowers Town prices in `src/game/town.ts` while the Sellsword is in the party.
- Add a Blind status with buildup: blinded units miss more (a CheckHit listener). Lamplighter and monsters will reuse it.
- Play Dead uses the targeting contract: while it lies still, monsters may not target it.
- Cutpurse steals one timed buff: mark which statuses are buffs with a flag on the status, not a list.
- Do not edit the registries, `upgrades.ts` or `src/content/items.ts`.
