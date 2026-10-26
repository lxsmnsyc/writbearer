---
id: sellsword
title: Sellsword: the job and its Hired Blade branch
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
added:
owns:
  - src/content/jobs/sellsword/index.ts
  - src/content/jobs/sellsword/hired-blade.ts
  - src/render/looks/sellsword.ts
  - test/sim/sellsword.test.ts
shared:
  - src/content/skills.ts
  - src/sim/unit.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
---

# Sellsword: the job and its Hired Blade branch

## Goal

Make the Sellsword (striker) a real job: replace its placeholder template, starter gear and look, and build its Hired Blade branch with all five skills (Cleave, Second Wind, Rush, Weapon Habit, Veteran of Many Wars). It stays `hireable: false`; roster-balance opens it at the Guild House.

## Context

- Source: `docs/design/09-skill-trees.md#sellsword` (this node builds Hired Blade).
- Pattern: Vanguard's module after job-registry, and `src/content/vanguard.ts` for skill code.
- Look: one large signature shape, per the minimalist figure rule (`docs/design/02-tech-stack.md#unit-design`).

## Acceptance

- [ ] A headless fight with the Sellsword in the party plays out, in `test/sim/sellsword.test.ts`.
- [ ] Each of the five Hired Blade skills has a test, in the style of `test/sim/tree-skills.test.ts`.
- [ ] Fast check passes.

## Sizing

Job data, a look and five skills in its own files, plus small engine hooks. M.

## Notes for the worker

- Bonus skill ranks (Veteran of Many Wars here, Paid in Full in the Coin branch): a modifier that `rankOf` (`src/content/skills.ts`) adds, not a change to spent points.
- Weapon Habit reads the existing `ItemBase.weapon` (`WeaponKind` in `src/sim/item.ts`).
- Do not edit the registries, the other two branch files or `src/content/items.ts`.
