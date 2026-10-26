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
  - src/sim/mechanics/damage.ts
  - src/sim/sim.ts
  - src/sim/ai.ts
  - src/render/zones.ts
  - src/ui/map.tsx
  - src/game/mutators.ts
  - src/sim/trap.ts
  - src/render/light.ts
  - src/sim/statuses.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: warden
    kind: hard
    why: each upgrade patches one of the spells that node builds
  - on: targeting-rules
    kind: hard
    why: Tether changes chase logic in thinkMerc, the function targeting-rules rewrites
  - on: hidden-units
    kind: behavior
    via: concealment
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
- Interpose redirects hits aimed at the bearer at the Pre step of the damage pipeline (`src/sim/mechanics/damage.ts`), as in `docs/design/03-combat-engine.md#example-interpose`. Mark the hit with the existing `Redirected` flag so it is not redirected twice.
- Tether caps chase distance from the bearer at 3 tiles, through the merc's toggles if possible.
- Cover stops projectiles from the front reaching the bearer for 3 seconds (projectile flight is in `src/sim/sim.ts`); Rampart in `src/content/vanguard.ts` is the closest pattern.
- Sentry and Read the Room call `reveal` from the concealment contract; test with a hidden monster made in the test until hidden-units lands.
- Tripwire is a trap (`src/sim/trap.ts`) that marks and slows.
- Night Eyes removes the Darkness mutator's sight penalty for the party (`src/game/mutators.ts`) and widens the lantern (`src/render/light.ts`).
- Never Surprised shows Ambush nodes on the map (`src/ui/map.tsx`) and stuns ambushers for 1 second at the start.
- Add a Marked status (6 seconds) applied when an enemy damages the bearer; other skills read it.
- Execute kills a marked non-boss below 20% health; bosses and mini-bosses are immune.
- Do not edit the registries, `index.ts` or `src/content/items.ts`.
