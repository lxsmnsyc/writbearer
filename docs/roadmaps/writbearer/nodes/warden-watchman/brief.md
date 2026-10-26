---
id: warden-watchman
title: Warden: the Watchman branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/warden-watchman.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/warden/watchman.ts
  - test/sim/warden-watchman.test.ts
shared:
  - src/ui/map.tsx
  - src/game/mutators.ts
  - src/sim/trap.ts
  - src/sim/sim.ts
  - src/render/light.ts
  - src/render/zones.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: hidden-units
    kind: behavior
    via: concealment
---

# Warden: the Watchman branch

## Goal

Build the Warden's Watchman branch: Sentry, Tripwire, Read the Room, Night Eyes, Never Surprised. Replace the placeholder branch in `src/content/jobs/warden/watchman.ts`.

## Context

- Source: `docs/design/09-skill-trees.md#warden`, the Watchman list.
- The Warden is registered as a placeholder job by job-registry, so tests can spawn it before the `warden` node lands.

## Acceptance

- [ ] Every node of the branch has a skill or effect, and each has a test.
- [ ] Fast check passes.

## Sizing

Five skills in one file plus small engine hooks. M.

## Notes for the worker

- Sentry and Read the Room call `reveal` from the concealment contract; test with a hidden monster made in the test until hidden-units lands.
- Tripwire is a trap (`src/sim/trap.ts`) that marks and slows.
- Night Eyes removes the Darkness mutator's sight penalty for the party (`src/game/mutators.ts`) and widens the lantern (`src/render/light.ts`).
- Never Surprised shows Ambush nodes on the map (`src/ui/map.tsx`) and stuns ambushers for 1 second at the start.
