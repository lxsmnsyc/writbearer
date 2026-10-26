---
id: arcanist
title: Arcanist: the job and its Pyromancy branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/arcanist.test.ts test/content/jobs.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/arcanist/index.ts
  - src/content/jobs/arcanist/pyromancy.ts
  - src/render/looks/arcanist.ts
  - test/sim/arcanist.test.ts
shared:
  - src/sim/skill.ts
  - src/sim/zone.ts
  - src/sim/mechanics/zones.ts
  - src/render/zones.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
---

# Arcanist: the job and its Pyromancy branch

## Goal

Make the Arcanist (striker) a real job: replace its placeholder template, starter gear and look, and build its Pyromancy branch with all five skills (Firebolt, Ignite, Fireball, Volcano, Inferno). It stays `hireable: false`; roster-balance opens it at the Guild House.

## Context

- Source: `docs/design/09-skill-trees.md#arcanist` (this node builds Pyromancy).
- Pattern: Vanguard's module after job-registry, and `src/content/vanguard.ts` for skill code.
- Look: one large signature shape, per the minimalist figure rule (`docs/design/02-tech-stack.md#unit-design`).

## Acceptance

- [ ] A headless fight with the Arcanist in the party plays out, in `test/sim/arcanist.test.ts`.
- [ ] Each of the five Pyromancy skills has a test, in the style of `test/sim/tree-skills.test.ts`.
- [ ] Fast check passes.

## Sizing

Job data, a look and five skills in its own files, plus small engine hooks. M.

## Notes for the worker

- Add an optional `friendlyFire` field to `Skill` (`src/sim/skill.ts`); area hits of such skills carry the existing `DamageFlags.FriendlyFire` and hurt the party. Inferno uses it; Fireball does not.
- Volcano is a zone that raises the Fire damage of allies inside, based on rAthena's Volcano. Its drawing goes in ZONE_LOOKS.
- Staffs and the Arcanist's gear already exist in `src/content/items.ts`.
- Do not edit the registries, the other two branch files or `src/content/items.ts`.
