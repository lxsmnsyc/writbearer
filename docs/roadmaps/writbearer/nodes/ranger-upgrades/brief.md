---
id: ranger-upgrades
title: Ranger: spell ranks to 10 and its 12 elite upgrades
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/ranger-upgrades.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/ranger/upgrades.ts
  - src/content/ranger.ts
  - test/sim/ranger-upgrades.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: split-job-skills
    kind: hard
    why: moves the job skill code this node edits out of skills.ts and passives.ts into the job modules
---

# Ranger: spell ranks to 10 and its 12 elite upgrades

## Goal

Finish moving the Ranger to the build model. job-registry already gave it its 4 spells and innate passive from existing code. This node rescales the spells to ranks 1 to 10 (each rank half of today's gain, so rank 10 is about today's rank 5) and turns the rest of its old tree into 12 elite upgrades, as `docs/design/16-builds.md` draws them.

## Context

- Design: `docs/design/16-builds.md`, the Ranger section.
- Rules: `contracts/builds.md`. An upgrade is a patch over its spell, or a passive it starts.
- The skill code exists in `src/content/ranger.ts` (split-job-skills moved it there); most upgrades reuse it. `skills.ts` keeps only shared helpers such as `rankOf` and `inLine`.

## Acceptance

- [ ] All 12 upgrades have a patch or effect, and each has a test in `test/sim/ranger-upgrades.test.ts`.
- [ ] The Ranger cases job-registry moved into `test/sim/ranger-upgrades.test.ts` cover spells and upgrades, or are deleted when the skill is gone.
- [ ] Fast check passes.

## Sizing

Mostly reshaping code that exists. M.

## Notes for the worker

- Old saves refund this job's tree ranks as shards (build-rules does it); do not add a second path.
- Do not add job code back to `skills.ts` or `passives.ts`.
