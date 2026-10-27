---
id: arcanist-upgrades
title: Arcanist: its 12 elite upgrades
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: L
spike: false
verify: pnpm vitest run test/sim/arcanist-upgrades.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/arcanist/upgrades.ts
  - test/sim/arcanist-upgrades.test.ts
shared:
  - src/sim/zone.ts
  - src/sim/mechanics/zones.ts
  - src/render/zones.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: arcanist
    kind: hard
    why: each upgrade patches one of the spells that node builds
  - on: job-hooks
    kind: contract
    via: job-hooks
---

# Arcanist: its 12 elite upgrades

## Goal

Build the Arcanist's 12 elite upgrades (3 per spell) as `builds-design` drew them in `docs/design/16-builds.md`. Each one changes how its spell works, not only its numbers. Replace the placeholder upgrades in `src/content/jobs/arcanist/upgrades.ts`.

## Context

- Design: `docs/design/16-builds.md`, the Arcanist section. Source skills: `docs/design/09-skill-trees.md#arcanist` (Pyromancy, Cryomancy and Weave).
- Rules: `contracts/builds.md`. An upgrade is a patch over its spell, or a passive it starts.
- Read the outcome of `arcanist` for the spells' code.

## Acceptance

- [ ] All 12 upgrades have a patch or effect, and each has a test in `test/sim/arcanist-upgrades.test.ts`.
- [ ] Every upgrade names one of the job's 4 spells, 3 per spell (the job-def contract test checks it).
- [ ] Fast check passes.

## Sizing

12 upgrades in one file, several with engine hooks (listed below). L.

## Notes for the worker

- Engine notes by source skill. Use the notes for the skills doc 16 makes upgrades.
- Inferno sets `friendlyFire` on its skill (job-hooks), so its area hits hurt the party. Fireball does not.
- Volcano is a zone that raises the Fire damage of allies inside, based on rAthena's Volcano. Its drawing goes in ZONE_LOOKS.
- Staffs and the Arcanist's gear already exist in `src/content/items.ts`.
- Glacial Wall blocks a path for a few seconds with `nav.block` (job-hooks).
- Shatterpoint: an enemy killed while Frozen leaves no corpse and deals Frost damage around it. Reuse the `torn` body state if it fits.
- Elemental Sense uses `Priority.WeakToElement` (job-hooks) and picks Fire or Frost per target.
- Overchannel uses the existing CheckSkillCost hook.
- Controlled Burn reads effective Discipline (`src/sim/morale.ts`) and spares the party from friendly fire skills at 60 or more.
- Spells, passives and job statuses live in the job's module and attach with `sim.on` listeners (job-hooks contract). Do not edit `src/sim/statuses.ts`, `src/sim/mechanics/`, `src/sim/ai.ts` or `src/sim/skill.ts`; if a hook is missing, write `contracts/job-hooks.change-request.md`.
- If choosing a bolt by element (Elemental Sense) does not work cleanly with the damage calculation (`src/sim/elements.ts`, `src/sim/mechanics/damage.ts`), stop and write it in your outcome. The maintainer's fallbacks: split Fire and Frost into separate jobs, or rework the elemental damage calculation. Do not invent a third way.
- Do not edit the registries, `index.ts` or `src/content/items.ts`.
