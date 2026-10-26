---
id: duelist-footwork
title: Duelist: the Footwork branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/duelist-footwork.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/duelist/footwork.ts
  - test/sim/duelist-footwork.test.ts
shared:
  - src/sim/mechanics/damage.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
---

# Duelist: the Footwork branch

## Goal

Build the Duelist's Footwork branch: Sidestep, Feint, Backstab, Shadowstep, Untouchable. Replace the placeholder branch in `src/content/jobs/duelist/footwork.ts`.

## Context

- Source: `docs/design/09-skill-trees.md#duelist`, the Footwork list.
- The Duelist is registered as a placeholder job by job-registry, so tests can spawn it before the `duelist` node lands.

## Acceptance

- [ ] Every node of the branch has a skill or effect, and each has a test.
- [ ] Fast check passes.

## Sizing

Five skills in one file plus small engine hooks. M.

## Notes for the worker

- Backstab uses facing: the Flank flag and the behind check in `src/sim/unit.ts` already exist.
- Feint sets a flag that skips the Block step for the next attack.
- Untouchable listens to UnitMiss on the Duelist.
