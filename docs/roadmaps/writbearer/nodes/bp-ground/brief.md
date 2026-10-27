---
id: bp-ground
title: Boss field changes: rising water and falling sections
status: todo
priority: should
type: feature
outline: false
milestone: bestiary
target:
from:
size: M
spike: false
verify: pnpm vitest run test/game/boss-field.test.ts && pnpm vitest run test/game/collapse.test.ts test/sim/boss.test.ts test/game/minibosses.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/game/boss-field.ts
  - test/game/boss-field.test.ts
shared:
  - src/game/footing.ts
  - src/gen/stage.ts
  - src/game/game.ts
  - src/render/renderer.ts
  - src/content/minibosses.ts
  - src/game/objective.ts
  - src/game/stage.ts
reserves: []
provides: [boss-field]
depends_on:
  - on: bp-roll
    kind: contract
    via: boss-def
---

# Boss field changes: rising water and falling sections

## Goal

A `BossField` driver armed when the boss wakes, with two building blocks: water that rises and joins, warned first, with dry islands; and floor sections that fall in order, warned first, and leave the floor. Share code with `Floods` (the Drowned Cantor) and the Collapse objective instead of copying it.

## Context

- Bases: `Floods` in `src/content/minibosses.ts:167`, the Collapse objective in `src/game/objective.ts:262`, `WADING` from `Footing`.
- Source: `docs/design/13-bestiary.md#what-the-engine-needs`.

## Acceptance

- [ ] Water: warnings, then patches that slow units; islands stay dry.
- [ ] Sections fall in order, warned first; units on one take the fall and are moved; the exit stays reachable.
- [ ] Collapse and Cantor tests pass unchanged.
- [ ] Fast check passes.

## Sizing

One driver and two blocks drawn from existing code. M.

## Notes for the worker

- Keep the Drowned Cantor's flood test passing; be-minibosses will move `Floods` onto your water helper afterwards.
- Do not call `sim.setWorld` every tick.
- The collapse step deletes monsters off the floor; never the boss.
- Mind stage against world coordinates after `placeStage` (see the collapse test 'turns with its area').
