---
id: duelist-upgrades
title: Duelist: its 12 elite upgrades
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: L
spike: false
verify: pnpm vitest run test/sim/duelist-upgrades.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/duelist/upgrades.ts
  - test/sim/duelist-upgrades.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: duelist
    kind: hard
    why: each upgrade patches one of the spells that node builds
  - on: targeting-rules
    kind: contract
    via: targeting
  - on: job-hooks
    kind: contract
    via: job-hooks
---

# Duelist: its 12 elite upgrades

## Goal

Build the Duelist's 12 elite upgrades (3 per spell) as `builds-design` drew them in `docs/design/16-builds.md`. Each one changes how its spell works, not only its numbers. Replace the placeholder upgrades in `src/content/jobs/duelist/upgrades.ts`.

## Context

- Design: `docs/design/16-builds.md`, the Duelist section. Source skills: `docs/design/09-skill-trees.md#duelist` (Blade, Showmanship and Footwork).
- Rules: `contracts/builds.md`. An upgrade is a patch over its spell, or a passive it starts.
- Read the outcome of `duelist` for the spells' code.

## Acceptance

- [ ] All 12 upgrades have a patch or effect, and each has a test in `test/sim/duelist-upgrades.test.ts`.
- [ ] Every upgrade names one of the job's 4 spells, 3 per spell (the job-def contract test checks it).
- [ ] Fast check passes.

## Sizing

12 upgrades in one file, several with engine hooks (listed below). L.

## Notes for the worker

- Engine notes by source skill. Use the notes for the skills doc 16 makes upgrades.
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
- Do not edit the registries, `index.ts` or `src/content/items.ts`.
