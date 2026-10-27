---
id: gs-terrain-grass
title: Tall grass and fungus cover
status: todo
priority: should
type: feature
outline: false
milestone: gauntlets-stages
target:
from:
size: M
spike: false
verify: pnpm vitest run test/game/cover.test.ts && pnpm vitest run test/gen/fields.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/game/cover.ts
  - test/game/cover.test.ts
shared:
  - src/gen/stage.ts
  - src/sim/ai.ts
  - src/render/floor.ts
  - src/render/renderer.ts
  - src/sim/ground.ts
reserves: []
provides: []
depends_on:
  - on: gs-terrain-kinds
    kind: contract
    via: terrain
  - on: hidden-units
    kind: hard
    why: both edit the monster notice check in thinkMonster; build on its version
---

# Tall grass and fungus cover

## Goal

Open fields hold patches of tall grass (surface layers) and fungus (the two lower layers). A unit in one is noticed by monsters only from a share of their range, and the grass is drawn over the party's feet so it reads as cover. `sim.ground.coverAt` reports it.

## Context

- Notice check: `thinkMonster` in `src/sim/ai.ts` (~423) uses `kit.notice` and `sim.sees`.
- Dead-grass tufts in `src/render/floor.ts:241` are decoration only today.
- Source: `docs/design/11-stages.md#terrain`.

## Acceptance

- [ ] A bearer in grass at a distance where it is noticed outside is not noticed; leaving the grass restores it; mercs too.
- [ ] Grass never lies on the entrance, exits, roads or the choke, over several seeds per layer.
- [ ] Fast check passes.

## Sizing

Gen rows, one notice hook, floor paint and an overlay. M.

## Notes for the worker

- Never set `unit.hidden`: that is the concealment contract's, and sb-bearer-kit's Hide uses it on top of `coverAt`.
- `sim.sees` stays geometric; apply the share only in the monster notice check.
