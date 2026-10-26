---
id: warden
title: Warden: the job and its Shadow branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/warden.test.ts test/content/jobs.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/warden/index.ts
  - src/content/jobs/warden/shadow.ts
  - src/render/looks/warden.ts
  - test/sim/warden.test.ts
shared:
  - src/sim/mechanics/damage.ts
  - src/sim/sim.ts
  - src/sim/ai.ts
  - src/render/zones.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: targeting-rules
    kind: hard
    why: Tether changes chase logic in thinkMerc, the function targeting-rules rewrites
---

# Warden: the job and its Shadow branch

## Goal

Make the Warden (guard) a real job: replace its placeholder template, starter gear and look, and build its Shadow branch with all five skills (Interpose, Tether, Retaliate, Cover, Living Shield). It stays `hireable: false`; roster-balance opens it at the Guild House.

## Context

- Source: `docs/design/09-skill-trees.md#warden` (this node builds Shadow).
- Pattern: Vanguard's module after job-registry, and `src/content/vanguard.ts` for skill code.
- Look: one large signature shape, per the minimalist figure rule (`docs/design/02-tech-stack.md#unit-design`).

## Acceptance

- [ ] A headless fight with the Warden in the party plays out, in `test/sim/warden.test.ts`.
- [ ] Each of the five Shadow skills has a test, in the style of `test/sim/tree-skills.test.ts`.
- [ ] Fast check passes.

## Sizing

Job data, a look and five skills in its own files, plus small engine hooks. M.

## Notes for the worker

- Interpose redirects hits aimed at the bearer at the Pre step of the damage pipeline (`src/sim/mechanics/damage.ts`), as in `docs/design/03-combat-engine.md#example-interpose`. Mark the hit with the existing `Redirected` flag so it is not redirected twice.
- Tether caps chase distance from the bearer at 3 tiles, through the merc's toggles if possible.
- Cover stops projectiles from the front reaching the bearer for 3 seconds (projectile flight is in `src/sim/sim.ts`); Rampart in `src/content/vanguard.ts` is the closest pattern.
- Do not edit the registries, the other two branch files or `src/content/items.ts`.
