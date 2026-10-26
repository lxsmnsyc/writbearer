---
id: arcanist-cryomancy
title: Arcanist: the Cryomancy branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/arcanist-cryomancy.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/arcanist/cryomancy.ts
  - test/sim/arcanist-cryomancy.test.ts
shared:
  - src/sim/nav.ts
  - src/sim/zone.ts
  - src/render/zones.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
---

# Arcanist: the Cryomancy branch

## Goal

Build the Arcanist's Cryomancy branch: Frost Shard, Chill, Frost Nova, Glacial Wall, Shatterpoint. Replace the placeholder branch in `src/content/jobs/arcanist/cryomancy.ts`.

## Context

- Source: `docs/design/09-skill-trees.md#arcanist`, the Cryomancy list.
- The Arcanist is registered as a placeholder job by job-registry, so tests can spawn it before the `arcanist` node lands.

## Acceptance

- [ ] Every node of the branch has a skill or effect, and each has a test.
- [ ] Fast check passes.

## Sizing

Five skills in one file plus small engine hooks. M.

## Notes for the worker

- Glacial Wall blocks a path for a few seconds: temporary blocked tiles in `src/sim/nav.ts`, removed when it melts.
- Shatterpoint: an enemy killed while Frozen leaves no corpse and deals Frost damage around it. Reuse the `torn` body state if it fits.
