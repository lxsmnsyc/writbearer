---
id: duelist-showmanship
title: Duelist: the Showmanship branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/duelist-showmanship.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/duelist/showmanship.ts
  - test/sim/duelist-showmanship.test.ts
shared:
  - src/sim/statuses.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: targeting-rules
    kind: hard
    why: Duel adds CheckTarget listeners, which need the event
---

# Duelist: the Showmanship branch

## Goal

Build the Duelist's Showmanship branch: Flourish, Taunt the Proud, Duel, Crowd Pleaser, Grand Duel. Replace the placeholder branch in `src/content/jobs/duelist/showmanship.ts`.

## Context

- Source: `docs/design/09-skill-trees.md#duelist`, the Showmanship list.
- The Duelist is registered as a placeholder job by job-registry, so tests can spawn it before the `duelist` node lands.

## Acceptance

- [ ] Every node of the branch has a skill or effect, and each has a test.
- [ ] Fast check passes.

## Sizing

Five skills in one file plus small engine hooks. M.

## Notes for the worker

- Duel binds the Duelist and one enemy: through the targeting contract, neither may target or be targeted by anyone else. Area hits still land.
- Flourish and Crowd Pleaser raise morale through `src/sim/morale.ts`'s event table.
