---
id: warden-upgrades
title: Warden: its 12 elite upgrades
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: L
spike: false
verify: pnpm vitest run test/sim/warden-upgrades.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/content/jobs/warden/upgrades.ts
  - test/sim/warden-upgrades.test.ts
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
  - on: warden
    kind: hard
    why: each upgrade patches one of the spells that node builds
  - on: hidden-units
    kind: behavior
    via: concealment
  - on: job-hooks
    kind: contract
    via: job-hooks
---

# Warden: its 12 elite upgrades

## Goal

Build the Warden's 12 elite upgrades (3 per spell) as `builds-design` drew them in `docs/design/16-builds.md`. Each one changes how its spell works, not only its numbers. Replace the placeholder upgrades in `src/content/jobs/warden/upgrades.ts`.

## Context

- Design: `docs/design/16-builds.md`, the Warden section. Source skills: `docs/design/09-skill-trees.md#warden` (Shadow, Watchman and Executioner).
- Rules: `contracts/builds.md`. An upgrade is a patch over its spell, or a passive it starts.
- Read the outcome of `warden` for the spells' code.

## Acceptance

- [ ] All 12 upgrades have a patch or effect, and each has a test in `test/sim/warden-upgrades.test.ts`.
- [ ] Every upgrade names one of the job's 4 spells, 3 per spell (the job-def contract test checks it).
- [ ] Fast check passes.

## Sizing

12 upgrades in one file, several with engine hooks (listed below). L.

## Notes for the worker

- Engine notes by source skill. Use the notes for the skills doc 16 makes upgrades.
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
- Do not edit the registries, `index.ts` or `src/content/items.ts`.
