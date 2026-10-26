---
id: gs-terrain-deep
title: Deep water and Frost ice
status: todo
priority: should
type: feature
outline: false
milestone: gauntlets-stages
target:
from:
size: M
spike: false
verify: pnpm vitest run test/game/deep-water.test.ts test/gen/fields.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/game/ice.ts
  - test/game/deep-water.test.ts
shared:
  - src/gen/fields.ts
  - src/gen/stage.ts
  - src/render/floor.ts
  - src/sim/nav.ts
reserves: []
provides: []
depends_on:
  - on: gs-terrain-kinds
    kind: contract
    via: terrain
  - on: arcanist-cryomancy
    kind: hard
    why: uses the temporary nav block API and the Frost hit that node adds
---

# Deep water and Frost ice

## Goal

Flooded caverns in the Undercroft and some lower fields hold deep water that blocks bodies but not sight. A Frost hit on it freezes a patch into walkable ice for the rest of the stage. A ford of shallow water always joins every exit, so ice is a shortcut, never a gate.

## Context

- Deep cells are holes: add unfrozen deep water to `holesOf` (`src/gen/stage.ts:1446`) so `ensureReachable` sees it.
- Runtime changes edit `sim.holes` and call `sim.setWorld(sim.floor)`, as pits do (`src/game/game.ts:1217`).
- Source: `docs/design/11-stages.md#terrain`.

## Acceptance

- [ ] Every exit is reachable with deep water unfrozen, over many seeds.
- [ ] Units cannot enter deep cells; sight crosses them.
- [ ] Frost damage on a deep cell opens a walkable disc that stays for the stage and is saved in the patch.
- [ ] Fast check passes.

## Sizing

A plan variant, holes, a freeze listener and paint. M.

## Notes for the worker

- Ice is permanent for the stage (decided at refinement; change it only with the user).
- Rebuilding nav costs the whole grid: batch freezes per tick.
- Use arcanist-cryomancy's nav API; if it only blocks, add the inverse in a small commit and say so in the outcome.
