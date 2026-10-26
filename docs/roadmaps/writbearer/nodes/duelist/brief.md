---
id: duelist
title: Duelist: the job and its Blade branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/duelist.test.ts test/content/jobs.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/duelist/index.ts
  - src/content/jobs/duelist/blade.ts
  - src/render/looks/duelist.ts
  - test/sim/duelist.test.ts
shared:
  - src/sim/mechanics/hit.ts
  - src/sim/mechanics/damage.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
---

# Duelist: the job and its Blade branch

## Goal

Make the Duelist (striker) a real job: replace its placeholder template, starter gear and look, and build its Blade branch with all five skills (Lunge, Riposte, Flurry, Bleed Out, Thousand Cuts). It stays `hireable: false`; roster-balance opens it at the Guild House.

## Context

- Source: `docs/design/09-skill-trees.md#duelist` (this node builds Blade).
- Pattern: Vanguard's module after job-registry, and `src/content/vanguard.ts` for skill code.
- Look: one large signature shape, per the minimalist figure rule (`docs/design/02-tech-stack.md#unit-design`).

## Acceptance

- [ ] A headless fight with the Duelist in the party plays out, in `test/sim/duelist.test.ts`.
- [ ] Each of the five Blade skills has a test, in the style of `test/sim/tree-skills.test.ts`.
- [ ] Fast check passes.

## Sizing

Job data, a look and five skills in its own files, plus small engine hooks. M.

## Notes for the worker

- Riposte parries melee hits: cancel the hit in CheckHit or the damage Pre step and answer with a free counter that cannot be parried back.
- Flurry is four hits, each through the full damage pipeline.
- Bleed already exists (`src/sim/statuses.ts`); Bleed Out applies it on crit.
- Daggers and the Duelist's gear already exist in `src/content/items.ts`; pick starter gear from them.
- Do not edit the registries, the other two branch files or `src/content/items.ts`.
