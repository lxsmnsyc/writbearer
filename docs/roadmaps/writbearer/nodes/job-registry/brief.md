---
id: job-registry
title: One module per job, with a registry
status: todo
priority: must
type: refactor
outline: false
milestone: starting-jobs
target:
from:
size: L
spike: false
verify: pnpm vitest run test/content/jobs.test.ts && pnpm test
exclusive: []
fulfilled_by:
gate: true
added:
owns:
  - src/content/jobs/**
  - src/render/looks/**
  - src/render/zones.ts
  - src/content/roster.ts
  - src/content/trees.ts
  - src/ui/skill-tree.tsx
  - test/sim/tree-skills.test.ts
  - test/sim/vanguard-upgrades.test.ts
  - test/sim/ranger-upgrades.test.ts
  - test/sim/cleric-upgrades.test.ts
  - src/content/recruits.ts
  - src/content/items.ts
  - src/ui/icons.ts
  - src/ui/offer.tsx
  - src/render/effects.ts
  - src/render/rig.ts
  - src/render/sprites.ts
  - src/render/renderer.ts
  - test/content/jobs.test.ts
  - test/sim/recruits.test.ts
  - e2e/recruit.spec.ts
shared: []
reserves: []
provides: [job-def]
depends_on:
  - on: build-rules
    kind: hard
    why: moves every job onto the spells, shards and upgrades that node adds, then removes the old tree path it kept
  - on: builds-design
    kind: hard
    why: the placeholder and moved jobs get the spells and innate passives drawn there
---

# One module per job, with a registry

## Goal

Move everything that defines a job out of the shared content, UI and render files into one module per job plus registries, as described in the job-def contract. Vanguard, Ranger and Cleric move onto the build model of `docs/design/16-builds.md`: their 4 spells and innate passive from existing skill code, at today's numbers, with their 12 elite upgrades left as summary-only placeholders for the `<kind>-upgrades` nodes. Sellsword, Warden, Duelist and Arcanist are registered as placeholders (hireable false, summary-only spells and upgrades), so the later job and upgrade nodes only fill in their own files. Then the old tree path goes: `TREES`, `src/ui/skill-tree.tsx`, skill points. The Guild House draw stays the same.

## Context

- Today a job is spread over roster.ts (MERCS, DISCIPLINE), trees.ts (TREES and its imports), recruits.ts (HIREABLE, FIGHTERS), items.ts (job name lists, STARTER_GEAR, STARTER_BELT), icons.ts, offer.tsx (blurb), rig.ts (Kind, KINDS, HIT_FRACTION, KIND_SIZE, paperColor) and sprites.ts (attachments).
- Skill code can stay where it is (`src/content/vanguard.ts`, `ranger.ts`, `cleric.ts`, `skills.ts`, `passives.ts`); only the tree assembly and job data move. Moving skill files is optional and should not grow the diff.
- Also hardcoded: `paperColor` (rig.ts ~410), `isSprited` (sprites.ts ~577), a cleric test in sprites.ts ~625 and a vanguard test in effects.ts ~274. `Template` in roster.ts is not exported yet.
- Item bases stay in items.ts, which already has Arcanist and Duelist gear and `WeaponKind` with dagger and staff. Keep imports one way: jobs import items, never the reverse.
- Zone drawing for skill zones (`banner`, `lightningRod`, `bait`, `rampart`, `spikeField` in `renderer.ts` near line 1209) moves behind a `ZONE_LOOKS` registry so later skills add a file, not a branch.
- Source: `contracts/job-def.md`; the 'Split hot files by feature first' rule.

## Steps

- [ ] Add `src/content/jobs/types.ts` and `src/content/jobs/index.ts`.
- [ ] Move Vanguard, Ranger and Cleric into `src/content/jobs/<kind>/index.ts` with their spells and innate, and placeholder `upgrades.ts`.
- [ ] Add placeholder `index.ts`, `upgrades.ts`, looks and icons for Sellsword, Warden, Duelist and Arcanist, with hireable false.
- [ ] Remove `TREES`, `src/ui/skill-tree.tsx` and the skill point path; tree skills that are now upgrades stay in code for the upgrade nodes. Split `test/sim/tree-skills.test.ts` by job into `test/sim/<kind>-upgrades.test.ts` (vanguard, ranger, cleric), skipping cases of skills that are now upgrade placeholders, and delete it.
- [ ] Add Sellsword and Warden to the `jobs` lists of fitting bases; add any base a new job needs as starter gear.
- [ ] Derive MercKind, MERCS entries for mercs, DISCIPLINE, HIREABLE, FIGHTERS, STARTER_GEAR and STARTER_BELT from JOBS.
- [ ] Add `src/render/looks/` with a LOOKS registry; derive the rig's merc kinds, sizes, hit fractions, paper color and sprite attachments from it.
- [ ] Add `ZONE_LOOKS` and move the four skill zone drawings into it.
- [ ] Write `test/content/jobs.test.ts`; make the recruit tests read HIREABLE.
- [ ] Freeze the contract: write the final shape into your outcome so the orchestrator can copy it into `contracts/job-def.md`.

## Acceptance

- [ ] `pnpm test` passes. Tests change only where they listed hireable jobs by hand, or tested a tree rule or a skill that is now an upgrade placeholder.
- [ ] Each of the four placeholder jobs can be spawned with `spawnMerc` and fights in a headless fight; none is offered at the Guild House.
- [ ] Fast check passes.

## Sizing

Blast radius high (core registries, removing the tree path); size large (many files, mostly moves and placeholder data); uncertainty low. L.

## Notes for the worker

- This node moves code and removes the tree path. Do not add any new job, skill or upgrade.
- The three built jobs lose the skills that become upgrades until their `<kind>-upgrades` node lands. Say which in the outcome.
- Keep `src/game/save.ts` loading old saves; it reads kinds through HIREABLE.
- Type the registry so `MercKind` stays a literal union; `keyof typeof MERCS` is used widely.
