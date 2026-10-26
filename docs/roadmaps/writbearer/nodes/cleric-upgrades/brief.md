---
id: cleric-upgrades
title: Cleric: spell ranks to 10 and its 12 elite upgrades
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/cleric-upgrades.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/cleric/upgrades.ts
  - src/content/cleric.ts
  - test/sim/cleric-upgrades.test.ts
shared:
  - src/content/skills.ts
  - src/content/passives.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
---

# Cleric: spell ranks to 10 and its 12 elite upgrades

## Goal

Finish moving the Cleric to the build model. job-registry already gave it its 4 spells and innate passive from existing code. This node rescales the spells to ranks 1 to 10 (each rank half of today's gain, so rank 10 is about today's rank 5) and turns the rest of its old tree into 12 elite upgrades, as `docs/design/16-builds.md` draws them.

## Context

- Design: `docs/design/16-builds.md`, the Cleric section.
- Rules: `contracts/builds.md`. An upgrade is a patch over its spell, or a passive it starts.
- The skill code exists in `src/content/cleric.ts`, `src/content/skills.ts` and `src/content/passives.ts`; most upgrades reuse it.

## Acceptance

- [ ] All 12 upgrades have a patch or effect, and each has a test in `test/sim/cleric-upgrades.test.ts`.
- [ ] The Cleric cases job-registry moved into `test/sim/cleric-upgrades.test.ts` cover spells and upgrades, or are deleted when the skill is gone.
- [ ] Fast check passes.

## Sizing

Mostly reshaping code that exists. M.

## Notes for the worker

- Old saves refund this job's tree ranks as shards (build-rules does it); do not add a second path.

