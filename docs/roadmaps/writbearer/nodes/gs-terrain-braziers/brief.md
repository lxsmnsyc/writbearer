---
id: gs-terrain-braziers
title: Brazier circles
status: todo
priority: should
type: feature
outline: false
milestone: gauntlets-stages
target:
from:
size: M
spike: false
verify: pnpm vitest run test/game/braziers.test.ts test/gen/stage.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/game/braziers.ts
  - test/game/braziers.test.ts
shared:
  - src/gen/stage.ts
  - src/game/game.ts
  - src/render/renderer.ts
  - src/sim/ground.ts
reserves: []
provides: []
depends_on:
  - on: gs-terrain-kinds
    kind: contract
    via: terrain
  - on: gs-terrain-lantern
    kind: hard
    why: shares the sim light list and the notice rule that node adds
---

# Brazier circles

## Goal

A fight field may hold a ring of unlit braziers. The bearer walks up to light it: it lights a wide area for the rest of the stage and fixes it in the fog, but monsters that see the light notice the party from their full range.

## Context

- Braziers and torches are decor props today (`src/gen/stage.ts:24`, exits at :424, boss stair at :1376); levers show the walk-up interaction pattern (`game.ts` `workMaze`).
- gs-horde-kinds will reuse lit braziers for 'hold the light': expose `Prop.lit` and `litAt`.
- Source: `docs/design/11-stages.md#points-of-interest`.

## Acceptance

- [ ] A ring stands on open ground and is reachable; walking up lights it once.
- [ ] `litAt` is true inside its radius; a unit lit by it is noticed from full range even with the lantern shaded; the lit area stays known in the fog.
- [ ] Fast check passes.

## Sizing

A POI, an interaction and render rows. M.

## Notes for the worker

- Decor braziers at exits and on the stair stay unlit and inert.
- Keep the ring out of the Labyrinth; roll placement after existing RNG use.
