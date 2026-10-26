---
id: sellsword-tricks
title: Sellsword: the Dirty Tricks branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/sellsword-tricks.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/sellsword/tricks.ts
  - test/sim/sellsword-tricks.test.ts
shared:
  - src/sim/statuses.ts
  - src/sim/mechanics/hit.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: targeting-rules
    kind: hard
    why: Play Dead adds a CheckTarget listener, which needs the event
---

# Sellsword: the Dirty Tricks branch

## Goal

Build the Sellsword's Dirty Tricks branch: Pocket Sand, Hamstring, Low Blow, Play Dead, Cutpurse. Replace the placeholder branch in `src/content/jobs/sellsword/tricks.ts`.

## Context

- Source: `docs/design/09-skill-trees.md#sellsword`, the Dirty Tricks list.
- The Sellsword is registered as a placeholder job by job-registry, so tests can spawn it before the `sellsword` node lands.

## Acceptance

- [ ] Every node of the branch has a skill or effect, and each has a test.
- [ ] Fast check passes.

## Sizing

Five skills in one file plus small engine hooks. M.

## Notes for the worker

- Add a Blind status with buildup: blinded units miss more (a CheckHit listener). Lamplighter and monsters will reuse it.
- Play Dead uses the targeting contract: while it lies still, monsters may not target it.
- Cutpurse steals one timed buff: mark which statuses are buffs with a flag on the status, not a list.
