---
id: gs-terrain-hazards
title: Falling rocks, pits and a trap field
status: done
spent: 153020
priority: should
type: feature
outline: false
milestone: gauntlets-stages
target:
from:
size: M
spike: false
verify: pnpm vitest run test/game/rocks-pits.test.ts && pnpm vitest run test/game/vault.test.ts test/gen/objective.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/game/rocks.ts
  - test/game/rocks-pits.test.ts
shared:
  - src/gen/stage/hazards.ts
  - src/gen/stage/field.ts
  - src/game/hazards.ts
  - src/game/game/walkups.ts
  - src/render/draw/hazards.ts
reserves: []
provides: []
depends_on:
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

# Falling rocks, pits and a trap field

## Goal

Open fields may hold a trap field: pressure plates that bring a rock down (a warned circle, damage, then rubble that blocks) and open pits bodies cannot enter, always with a way round. Traps hurt monsters as well as the party.

## Context

- Hazards (`HazardKind` in `src/gen/stage/hazards.ts`, `src/game/hazards.ts`) exist only in the Labyrinth and Vault today; `floor` drops on the party and leaves a pit.
- `src/sim/trap.ts` is the player's trap (Warden, Ranger); do not edit it.
- Generation changes on purpose here, so re-record `test/gen/stage-snapshot.test.ts` with `pnpm vitest run test/gen/stage-snapshot.test.ts -u` and say so in the outcome.
- Registration: a plate is a `WalkUp` appended to `WALK_UPS` in `src/game/game/walkups.ts`. A hazard look is an entry in `HAZARD_LOOKS` in `src/render/draw/hazards.ts`; the `pit` and `rubble` prop looks exist in `PROP_LOOKS`. The field build is `src/gen/stage/field.ts`.
- Source: `docs/design/11-stages.md#traps-and-hazards`.

## Acceptance

- [ ] A rock plate warns, then strikes only units in the circle, party and monsters; the rubble blocks and a way round remains.
- [ ] A pit blocks bodies and `navFor` sees it; the field never covers the entrance, exits or roads.
- [ ] Labyrinth and Vault tests are unchanged.
- [ ] Fast check passes.

## Sizing

Two hazard kinds and a POI. M.

## Notes for the worker

- Append to `HazardKind` and add a `TRAP_PERIOD` entry in `src/gen/stage/hazards.ts`; gs-labyrinth appends too.
- The trap field must not turn on Labyrinth bonuses such as Untouched.
- Hidden traps stay out of scope.
