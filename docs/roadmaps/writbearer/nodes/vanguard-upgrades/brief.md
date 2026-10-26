---
id: vanguard-upgrades
title: Vanguard: spell ranks to 10 and its 12 elite upgrades
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/vanguard-upgrades.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/vanguard/upgrades.ts
  - src/content/vanguard.ts
  - test/sim/vanguard-upgrades.test.ts
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

# Vanguard: spell ranks to 10 and its 12 elite upgrades

## Goal

Finish moving the Vanguard to the build model. job-registry already gave it its 4 spells and innate passive from existing code. This node rescales the spells to ranks 1 to 10 (each rank half of today's gain, so rank 10 is about today's rank 5) and turns the rest of its old tree into 12 elite upgrades, as `docs/design/16-builds.md` draws them.

## Context

- Design: `docs/design/16-builds.md`, the Vanguard section (the doc's worked example).
- Rules: `contracts/builds.md`. An upgrade is a patch over its spell, or a passive it starts.
- The skill code exists in `src/content/vanguard.ts`, `src/content/skills.ts` and `src/content/passives.ts`; most upgrades reuse it.

## Acceptance

- [ ] All 12 upgrades have a patch or effect, and each has a test in `test/sim/vanguard-upgrades.test.ts`.
- [ ] The Vanguard cases job-registry moved into `test/sim/vanguard-upgrades.test.ts` cover spells and upgrades, or are deleted when the skill is gone.
- [ ] Fast check passes.

## Sizing

Mostly reshaping code that exists. M.

## Notes for the worker

- Old saves refund this job's tree ranks as shards (build-rules does it); do not add a second path.
- Charge needs knockback, which is not built (cc-job-systems). Build it without the push and note it in the outcome.
