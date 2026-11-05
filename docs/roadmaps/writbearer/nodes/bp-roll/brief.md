---
id: bp-roll
title: Boss registry, pool roll and map label
status: active
priority: should
type: feature
outline: false
milestone: bestiary
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/boss-pool.test.ts && pnpm vitest run test/game/boss-roll.test.ts && pnpm vitest run test/sim/bosses.test.ts test/sim/boss.test.ts test/gen/graph.test.ts test/sim/save.test.ts
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
  - src/game/game/route.ts
  - src/gen/graph.ts
  - src/gen/stage/types.ts
  - src/gen/stage/arena.ts
  - src/game/stage.ts
  - src/ui/map.tsx
  - src/game/compendium.ts
  - src/content/monsters/spawn-steps.ts
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
  - on: split-game
    kind: hard
    why: moves game.ts features into modules under src/game/game/; this node edits the moved code
  - on: split-stage-gen
    kind: hard
    why: moves gen/stage.ts features into modules under src/gen/stage/; this node edits the moved code
  - on: split-roster
    kind: hard
    why: adds its monsters or template flag through src/content/monsters/ and the spawnMonster step list
---

# Boss registry, pool roll and map label

## Goal

Move the four bosses into `src/content/bosses/` as `BossDef` modules (the boss-def contract), with no behavior change. Roll each layer's boss from its designed pool of three, and from all twelve in endless, on a new map area stream. Show the boss's name on the layer map and carry its id on the stage.

## Context

- Today `spawnBoss` (`src/content/bosses.ts`) indexes a fixed four by layer; the Brood Mother lives in `brood.ts`; `MapNode` and `Stage` have no boss id; the map labels the node 'Boss' (`src/ui/map.tsx`).
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
- Pick the boss id in `buildStage` in `src/game/game/route.ts`. Its RNG draws go after the existing ones. Add `bossId` as an optional field of `Stage` in `src/gen/stage/types.ts`. The boss field is built in `src/gen/stage/arena.ts`.

## After the splits

- After split-roster: new monsters go in their faction module under `src/content/monsters/`, a template flag is one module plus one entry in `SPAWN_STEPS` (`src/content/monsters/spawn-steps.ts`, a step is `(unit, template, sim) => void`); `src/content/roster.ts` is a barrel and stays unchanged.
