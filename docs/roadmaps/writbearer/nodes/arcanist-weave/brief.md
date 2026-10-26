---
id: arcanist-weave
title: Arcanist: the Weave branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/arcanist-weave.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/arcanist/weave.ts
  - test/sim/arcanist-weave.test.ts
shared:
  - src/sim/ai.ts
  - src/ui/merc-panel.tsx
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: arcanist
    kind: hard
    why: Controlled Burn reads the friendlyFire field the arcanist node adds
  - on: targeting-rules
    kind: hard
    why: adds a target priority to pick in ai.ts, the function targeting-rules rewrites
---

# Arcanist: the Weave branch

## Goal

Build the Arcanist's Weave branch: Mana Flow, Overchannel, Elemental Sense, Echo, Controlled Burn. Replace the placeholder branch in `src/content/jobs/arcanist/weave.ts`.

## Context

- Source: `docs/design/09-skill-trees.md#arcanist`, the Weave list.
- The Arcanist is registered as a placeholder job by job-registry, so tests can spawn it before the `arcanist` node lands.

## Acceptance

- [ ] Every node of the branch has a skill or effect, and each has a test.
- [ ] Fast check passes.

## Sizing

Five skills in one file plus small engine hooks. M.

## Notes for the worker

- Add the 'Weak to my element' target priority to the toggles (`Priority` and `pick` in `src/sim/ai.ts`, `src/ui/merc-panel.tsx`); Elemental Sense makes it pick Fire or Frost per target.
- Overchannel uses the existing CheckSkillCost hook.
- Controlled Burn reads effective Discipline (`src/sim/morale.ts`) and spares the party from friendly fire skills at 60 or more.
