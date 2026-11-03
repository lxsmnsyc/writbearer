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
verify: pnpm vitest run test/game/braziers.test.ts && pnpm vitest run test/gen/stage.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/game/braziers.ts
  - test/game/braziers.test.ts
shared:
  - src/gen/stage/field.ts
  - src/gen/stage/props.ts
  - src/game/game/walkups.ts
  - src/render/draw/props/fires.ts
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
  - on: split-game
    kind: hard
    why: moves game.ts features into modules under src/game/game/; this node edits the moved code
  - on: split-renderer
    kind: hard
    why: moves renderer.ts features into modules under src/render/draw/; this node edits the moved code
  - on: split-stage-gen
    kind: hard
    why: moves gen/stage.ts features into modules under src/gen/stage/; this node edits the moved code
---

# Brazier circles

## Goal

A fight field may hold a ring of unlit braziers. The bearer walks up to light it: it lights a wide area for the rest of the stage and fixes it in the fog, but monsters that see the light notice the party from their full range.

## Context

- Braziers and torches are decor props today (`PropKind` in `src/gen/stage/props.ts`; exit torches and braziers come from `placeExits` in `src/gen/stage/exits.ts`, the boss stair from `src/gen/stage/arena.ts`); levers show the walk-up interaction pattern (`workWalkUps` in `src/game/game/walkups.ts`).
- gs-horde-kinds will reuse lit braziers for 'hold the light': expose `Prop.lit` and `litAt`.
- Registration: append a `WalkUp` to `WALK_UPS` in `src/game/game/walkups.ts`. Draw and light come from the `brazier` entry of `PROP_LOOKS` in `src/render/draw/props/fires.ts`. Place the ring in `generateField` in `src/gen/stage/field.ts`, after the existing rolls.
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
