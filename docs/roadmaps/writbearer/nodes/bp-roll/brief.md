---
id: bp-roll
title: Boss registry, pool roll and map label
status: todo
priority: should
type: feature
outline: false
milestone: bestiary
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/boss-pool.test.ts test/game/boss-roll.test.ts test/sim/bosses.test.ts test/sim/boss.test.ts test/gen/graph.test.ts test/sim/save.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/content/bosses/**
  - src/content/bosses.ts
  - src/content/brood.ts
  - src/content/boss-moves.ts
  - test/sim/boss-pool.test.ts
  - test/game/boss-roll.test.ts
shared:
  - src/game/game.ts
  - src/gen/graph.ts
  - src/gen/stage.ts
  - src/game/stage.ts
  - src/ui/map.tsx
  - src/game/compendium.ts
  - src/content/roster.ts
  - src/content/cards.ts
  - src/content/bestiary.ts
  - src/render/view.ts
  - src/ui/icons.ts
reserves: []
provides: [boss-def]
depends_on:
  - on: roster-balance
    kind: hard
    why: edits roster.ts, icons.ts, view.ts and map.tsx, which the starting-jobs nodes change; start after they merge
---

# Boss registry, pool roll and map label

## Goal

Move the four bosses into `src/content/bosses/` as `BossDef` modules (the boss-def contract), with no behavior change. Roll each layer's boss from its designed pool of three, and from all twelve in endless, on a new map area stream. Show the boss's name on the layer map and carry its id on the stage.

## Context

- Today `spawnBoss` (`src/content/bosses.ts:208`) indexes a fixed four by layer; the Brood Mother lives in `brood.ts`; `MapNode` and `Stage` have no boss id; the map labels the node 'Boss' (`src/ui/map.tsx`).
- `streams.area(...)` makes a fresh RNG per key, is never saved and shifts nothing: roll on `area(1, Stream.Map, BOSS_ROLL + depth)`.
- Source: `docs/design/13-bestiary.md#bosses`.

## Acceptance

- [ ] The roll is deterministic per seed and changes neither `RunStreams.save()` nor the layer map's nodes.
- [ ] Over many seeds all three of a pool appear; an unbuilt id resolves to the first built one in its pool; endless reaches all twelve.
- [ ] The boss node shows the boss's name; an old save without `stage.bossId` loads with the layer's current boss.
- [ ] Fast check passes.

## Sizing

Many files, mostly moves and thin hooks. M.

## Notes for the worker

- Pools are fixed at the designed three per layer, so seeds do not change meaning as bosses land.
- Keep `spawnBoss(sim, layer, ...)` working without an id; `test/sim/bosses.test.ts` is not yours to change.
- New boss kinds must reach `MONSTER_ORDER` in the compendium.
