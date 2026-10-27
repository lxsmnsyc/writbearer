---
id: arcanist
title: Arcanist: the job, its 4 spells and innate passive
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/arcanist.test.ts && pnpm vitest run test/content/jobs.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/arcanist/index.ts
  - src/render/looks/arcanist.ts
  - test/sim/arcanist.test.ts
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
  - on: builds-design
    kind: hard
    why: the job's 4 spells, innate passive and 12 upgrades are drawn there
  - on: job-hooks
    kind: contract
    via: job-hooks
---

# Arcanist: the job, its 4 spells and innate passive

## Goal

Make the Arcanist (striker) a real job under the build model of `docs/design/16-builds.md`: replace its placeholder template, starter gear and look, and build its 4 spells (ranks 1 to 10) and its innate passive, as `builds-design` drew them. It stays `hireable: false`; roster-balance opens it at the Guild House. Its 12 elite upgrades are the `arcanist-upgrades` node.

## Context

- Design: `docs/design/16-builds.md`, the Arcanist section (spells, innate, upgrades and numbers). Source skills: `docs/design/09-skill-trees.md#arcanist` (Pyromancy, Cryomancy and Weave).
- Rules: `contracts/builds.md` (spells, ranks, shards, elite upgrades) and `contracts/job-def.md`.
- Pattern: the Vanguard's module after job-registry.
- Look: one large signature shape, per the minimalist figure rule (`docs/design/02-tech-stack.md#unit-design`).

## Acceptance

- [ ] A headless fight with the Arcanist in the party plays out, in `test/sim/arcanist.test.ts`.
- [ ] Each of the 4 spells and the innate passive has a test, in the style of `test/sim/tree-skills.test.ts`.
- [ ] Fast check passes.

## Sizing

Job data, a look, 4 spells and a passive in its own files, plus small engine hooks. M.

## Notes for the worker

- Engine notes by source skill. Doc 16 decides which skills are spells, the innate or upgrades; use the notes for the ones this node builds.
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
- Do not edit the registries, `upgrades.ts` or `src/content/items.ts`.
