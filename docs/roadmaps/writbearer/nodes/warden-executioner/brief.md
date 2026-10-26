---
id: warden-executioner
title: Warden: the Executioner branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/warden-executioner.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/warden/executioner.ts
  - test/sim/warden-executioner.test.ts
shared:
  - src/sim/statuses.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
---

# Warden: the Executioner branch

## Goal

Build the Warden's Executioner branch: Marked for Death, Pursue, Debt Collector, Execute, Blood Debt. Replace the placeholder branch in `src/content/jobs/warden/executioner.ts`.

## Context

- Source: `docs/design/09-skill-trees.md#warden`, the Executioner list.
- The Warden is registered as a placeholder job by job-registry, so tests can spawn it before the `warden` node lands.

## Acceptance

- [ ] Every node of the branch has a skill or effect, and each has a test.
- [ ] Fast check passes.

## Sizing

Five skills in one file plus small engine hooks. M.

## Notes for the worker

- Add a Marked status (6 seconds) applied when an enemy damages the bearer; other skills read it.
- Execute kills a marked non-boss below 20% health; bosses and mini-bosses are immune.
