---
id: duelist
title: Duelist: the job, its 4 spells and innate passive
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/duelist.test.ts && pnpm vitest run test/content/jobs.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/duelist/index.ts
  - src/render/looks/duelist.ts
  - test/sim/duelist.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: builds-design
    kind: hard
    why: the job's 4 spells, innate passive and 12 upgrades are drawn there
  - on: job-hooks
    kind: contract
    via: job-hooks
---

# Duelist: the job, its 4 spells and innate passive

## Goal

Make the Duelist (striker) a real job under the build model of `docs/design/16-builds.md`: replace its placeholder template, starter gear and look, and build its 4 spells (ranks 1 to 10) and its innate passive, as `builds-design` drew them. It stays `hireable: false`; roster-balance opens it at the Guild House. Its 12 elite upgrades are the `duelist-upgrades` node.

## Context

- Design: `docs/design/16-builds.md`, the Duelist section (spells, innate, upgrades and numbers). Source skills: `docs/design/09-skill-trees.md#duelist` (Blade, Showmanship and Footwork).
- Rules: `contracts/builds.md` (spells, ranks, shards, elite upgrades) and `contracts/job-def.md`.
- Pattern: the Vanguard's module after job-registry.
- Look: one large signature shape, per the minimalist figure rule (`docs/design/02-tech-stack.md#unit-design`).

## Acceptance

- [ ] A headless fight with the Duelist in the party plays out, in `test/sim/duelist.test.ts`.
- [ ] Each of the 4 spells and the innate passive has a test, in the style of `test/sim/tree-skills.test.ts`.
- [ ] Fast check passes.

## Sizing

Job data, a look, 4 spells and a passive in its own files, plus small engine hooks. M.

## Notes for the worker

- Engine notes by source skill. Doc 16 decides which skills are spells, the innate or upgrades; use the notes for the ones this node builds.
- Riposte parries melee hits: cancel the hit in CheckHit or the damage Pre step and answer with a free counter that cannot be parried back.
- Flurry is four hits, each through the full damage pipeline.
- Bleed already exists (`src/sim/statuses.ts`); Bleed Out applies it on crit from a listener.
- Daggers and the Duelist's gear already exist in `src/content/items.ts`; pick starter gear from them.
- Duel binds the Duelist and one enemy: through the targeting contract, neither may target or be targeted by anyone else. Area hits still land.
- Flourish and Crowd Pleaser raise morale through `src/sim/morale.ts`'s event table.
- Backstab uses facing: the Flank flag and the behind check in `src/sim/unit.ts` already exist.
- Feint skips the Block step for the next attack, with a UnitDamage listener at `DamagePriority.Block`.
- Untouchable listens to UnitMiss on the Duelist.
- Spells, passives and job statuses live in the job's module and attach with `sim.on` listeners (job-hooks contract). Do not edit `src/sim/statuses.ts`, `src/sim/mechanics/`, `src/sim/ai.ts` or `src/sim/skill.ts`; if a hook is missing, write `contracts/job-hooks.change-request.md`.
- Do not edit the registries, `upgrades.ts` or `src/content/items.ts`.
