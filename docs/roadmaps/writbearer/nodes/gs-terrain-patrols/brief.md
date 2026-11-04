---
id: gs-terrain-patrols
title: Patrolling packs
status: todo
priority: should
type: feature
outline: false
milestone: gauntlets-stages
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/patrol.test.ts && pnpm vitest run test/gen/stage.test.ts test/gen/balance.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/sim/patrol.ts
  - test/sim/patrol.test.ts
shared:
  - src/gen/stage/packs.ts
  - src/sim/ai/monster.ts
  - src/sim/unit/movement.ts
  - src/game/stage.ts
reserves: []
provides: []
depends_on:
  - on: targeting-rules
    kind: hard
    why: adds a branch to thinkMonster, the function that node rewrites
  - on: split-stage-gen
    kind: hard
    why: moves gen/stage.ts features into modules under src/gen/stage/; this node edits the moved code
  - on: split-ai
    kind: hard
    why: split-ai moves src/sim/ai.ts into modules under src/sim/ai/; this node edits the moved code
  - on: split-unit
    kind: hard
    why: edits a feature module under src/sim/unit/ instead of the Unit class
---

# Patrolling packs

## Goal

Some idle packs walk a route between points of interest, the leader first and the pack keeping close, and notice the party as any idle pack does. A pack that notices wakes as before.

## Context

- A pack is one point (`Pack` in `src/gen/stage/packs.ts`); idle monsters return early in `thinkMonster` and never move; `wakePack` wakes only within 3 tiles (`ai.ts:385`).
- Source: `docs/design/11-stages.md#packs`.
- `placePacks` is in `src/gen/stage/packs.ts`. The site pack is `packs[0]`, the lair `packs[1]`, the watch `packs[2]`; the roaming packs follow, then packs `dealBosses` adds. Re-record `test/gen/stage-snapshot.test.ts` with `-u` if generation changes on purpose, and say so in the outcome.

## Acceptance

- [ ] An unaware patrol moves along its route and loops; it wakes when it sees the bearer.
- [ ] Followers stay within 3 tiles of the leader; route cells are walkable; nothing patrols within 13 tiles of the entrance.
- [ ] The balance test still passes.
- [ ] Fast check passes.

## Sizing

A route on packs, one AI call, a new module. M.

## Notes for the worker

- Only placed packs patrol: never the site pack, the lair, a key-bearer pack, Hunt or Escort mobs, or director spawns.
- Keep the `ai.ts` edit to one call.

## After the splits

- After split-unit: the Unit logic lives in `src/sim/unit/` (movement, casting, statuses, gear, combat, kit). Edit the module listed under `shared:`, keep new per-unit state in a WeakMap in your own module, and leave `src/sim/unit.ts` alone.
