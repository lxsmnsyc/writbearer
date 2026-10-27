---
id: warden
title: Warden: the job, its 4 spells and innate passive
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/warden.test.ts && pnpm vitest run test/content/jobs.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/warden/index.ts
  - src/render/looks/warden.ts
  - test/sim/warden.test.ts
shared:
  - src/render/zones.ts
  - src/ui/map.tsx
  - src/sim/trap.ts
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

# Warden: the job, its 4 spells and innate passive

## Goal

Make the Warden (guard) a real job under the build model of `docs/design/16-builds.md`: replace its placeholder template, starter gear and look, and build its 4 spells (ranks 1 to 10) and its innate passive, as `builds-design` drew them. It stays `hireable: false`; roster-balance opens it at the Guild House. Its 12 elite upgrades are the `warden-upgrades` node.

## Context

- Design: `docs/design/16-builds.md`, the Warden section (spells, innate, upgrades and numbers). Source skills: `docs/design/09-skill-trees.md#warden` (Shadow, Watchman and Executioner).
- Rules: `contracts/builds.md` (spells, ranks, shards, elite upgrades) and `contracts/job-def.md`.
- Pattern: the Vanguard's module after job-registry.
- Look: one large signature shape, per the minimalist figure rule (`docs/design/02-tech-stack.md#unit-design`).

## Acceptance

- [ ] A headless fight with the Warden in the party plays out, in `test/sim/warden.test.ts`.
- [ ] Each of the 4 spells and the innate passive has a test, in the style of `test/sim/tree-skills.test.ts`.
- [ ] Fast check passes.

## Sizing

Job data, a look, 4 spells and a passive in its own files, plus small engine hooks. M.

## Notes for the worker

- Engine notes by source skill. Doc 16 decides which skills are spells, the innate or upgrades; use the notes for the ones this node builds.
- Interpose redirects hits aimed at the bearer with a UnitDamage listener at `DamagePriority.Pre`, as in `docs/design/03-combat-engine.md#example-interpose`. Mark the hit with the existing `Redirected` flag so it is not redirected twice.
- Tether caps chase distance from the bearer at 3 tiles, through a CheckChase listener (job-hooks).
- Cover stops projectiles from the front reaching the bearer for 3 seconds, by cancelling CheckProjectile (job-hooks); Rampart in `src/content/vanguard.ts` is the closest pattern.
- Sentry and Read the Room call `reveal` from the concealment contract; test with a hidden monster made in the test until hidden-units lands.
- Tripwire is a trap (`src/sim/trap.ts`) that marks and slows.
- Trap Field turns Tripwire into a 2.5-tile field: every enemy that enters is marked and slowed. Night Eyes was dropped for it (doc 16).
- Never Surprised shows Ambush nodes on the map (`src/ui/map.tsx`) and stuns ambushers for 1 second at the start.
- Add a Marked status (6 seconds) in the Warden's module, applied when an enemy damages the bearer; other skills read it.
- Execute kills a marked non-boss below 20% health; bosses and mini-bosses are immune.
- Spells, passives and job statuses live in the job's module and attach with `sim.on` listeners (job-hooks contract). Do not edit `src/sim/statuses.ts`, `src/sim/mechanics/`, `src/sim/ai.ts` or `src/sim/skill.ts`; if a hook is missing, write `contracts/job-hooks.change-request.md`.
- Do not edit the registries, `upgrades.ts` or `src/content/items.ts`.
