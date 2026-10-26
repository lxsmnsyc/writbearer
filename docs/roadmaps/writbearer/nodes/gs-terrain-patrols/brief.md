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
verify: pnpm vitest run test/sim/patrol.test.ts test/gen/stage.test.ts test/gen/balance.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/sim/patrol.ts
  - test/sim/patrol.test.ts
shared:
  - src/gen/stage.ts
  - src/sim/ai.ts
  - src/sim/unit.ts
  - src/game/stage.ts
reserves: []
provides: []
depends_on:
  - on: targeting-rules
    kind: hard
    why: adds a branch to thinkMonster, the function that node rewrites
---

# Patrolling packs

## Goal

Some idle packs walk a route between points of interest, the leader first and the pack keeping close, and notice the party as any idle pack does. A pack that notices wakes as before.

## Context

- A pack is one point (`Pack` in `src/gen/stage.ts:67`); idle monsters return early in `thinkMonster` and never move; `wakePack` wakes only within 3 tiles (`ai.ts:385`).
- Source: `docs/design/11-stages.md#packs`.

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
