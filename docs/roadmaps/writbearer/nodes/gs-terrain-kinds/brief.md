---
id: gs-terrain-kinds
title: Terrain contract and ground kind tables
status: todo
priority: should
type: refactor
outline: false
milestone: gauntlets-stages
target:
from:
size: S
spike: false
verify: pnpm vitest run test/sim/ground.test.ts && pnpm vitest run test/game/footing.test.ts test/gen/fields.test.ts test/gen/stage.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/sim/ground.ts
  - test/sim/ground.test.ts
shared:
  - src/gen/stage.ts
  - src/game/footing.ts
  - src/render/floor.ts
  - src/sim/sim.ts
  - src/game/stage.ts
reserves: []
provides: [terrain]
depends_on: []
---

# Terrain contract and ground kind tables

## Goal

Reserve the new ground kinds and a `Ground` query object on the sim, as in the terrain contract, and move the two existing kinds (water, embers) out of the switch statements in `layGround`, `Footing.update` and `buildFloor` into one table per concern, keyed by kind. No behavior change.

## Context

- Ground today is circles (`Patch` in `src/gen/stage.ts:61`) plus chasm cells; there is no tile grid. `sim.holes` blocks bodies, not sight; `sim.obstacles` blocks both.
- Research: the scratchpad report is summarized in `contracts/terrain.md`.
- Source: `docs/design/11-stages.md#terrain`.

## Acceptance

- [ ] The same seed generates the same patches and props as before.
- [ ] `sim.ground` stubs return no cover, height 0, not lit.
- [ ] Fast check passes.

## Sizing

Thin types, a stub and a move of two switch statements into tables. S.

## Notes for the worker

- Do not change RNG order in `buildArea`; new rolls in later nodes go last or on a forked stream.
- Every new `Stage` field is optional: saves store the whole stage (`src/game/save.ts:77`).
