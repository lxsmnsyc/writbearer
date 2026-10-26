---
id: gs-terrain-ledges
title: Ledges, ramps and the terraces plan
status: todo
priority: should
type: feature
outline: false
milestone: gauntlets-stages
target:
from:
size: M
spike: false
verify: pnpm vitest run test/gen/terraces.test.ts test/gen/fields.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/gen/terraces.ts
  - test/gen/terraces.test.ts
shared:
  - src/gen/fields.ts
  - src/gen/stage.ts
  - src/sim/ground.ts
reserves: []
provides: []
depends_on:
  - on: gs-terrain-kinds
    kind: contract
    via: terrain
---

# Ledges, ramps and the terraces plan

## Goal

The Rift Road gets a terraces plan: raised plateaus whose edges are cliffs that block bodies, not sight, with ramps as the only ways up. Melee monsters below go round by a ramp; ranged units on top shoot down. `sim.ground.heightAt` reports the level.

## Context

- There is no height in the sim or renderer today. The sim needs only cliff cells as holes plus a `heightAt` lookup; drawing is gs-terrain-height-view.
- Plans live in `src/gen/fields.ts` (`Plan` union at :21); keep the new plan in its own file.
- Source: `docs/design/11-stages.md#terrain`.

## Acceptance

- [ ] All places and exits are reachable across 40 seeds, with at least two ways across.
- [ ] Every plateau has a ramp; cliff cells block bodies and not sight.
- [ ] `heightAt` is 0 below, 1 on top, between on ramps; a melee path from below to a plateau goes by a ramp.
- [ ] Fast check passes.

## Sizing

One plan in a new file plus holes and a lookup. M.

## Notes for the worker

- Cliff bands are at least 2 tiles thick, or melee reach (1.0 to 1.8) hits across them.
- Keep the bridges (chasm) plan distinct.
- Test a Vanguard on Hold near a ramp so mercs do not stall.
