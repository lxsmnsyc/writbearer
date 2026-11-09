---
id: cc-sight-still
title: Light radius as a stat and a standing-still timer
status: active
priority: should
type: feature
outline: false
milestone: combat-core
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/light.test.ts && pnpm vitest run test/sim/sight.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/light.ts
  - src/sim/still.ts
  - test/sim/light.test.ts
shared:
  - src/sim/ai/merc.ts
  - src/sim/ai/monster.ts
  - src/render/fog.ts
reserves: []
provides: []
depends_on:
  - on: split-ai
    kind: hard
    why: the light stat replaces the reads of kit.sight and kit.notice in ai.ts, which split-ai moves into src/sim/ai/
---

# Light radius as a stat and a standing-still timer

## Goal

Two per-unit values that jobs change. First, light radius: how far a unit sees and how far monsters notice its lantern, as modifiable values (percent and flat) that skills and statuses can change, replacing the fixed `kit.sight` and `kit.notice` reads. Second, a standing-still timer: how long a unit has stayed at its spot, readable by skills and passives (the Arbalist's damage grows the longer it stands).

## Context

- `Unit.kit.sight` (bearer 7, mercs 4.5) and `kit.notice` are plain numbers in `src/sim/unit.ts`. They are read in `src/sim/ai.ts` (target pick, helper notice at lines ~291, 333, 479) and the fog drawn by `src/render/fog.ts`. A skill cannot change them today.
- `Sim.sees` is line of sight only; it has no range.
- Wide Light (Lamplighter): the bearer's light reaches further, and monsters also notice the lantern sooner. Both effects come from one change, so the stat moves sight and notice together for the bearer.
- Source: `docs/design/12-new-jobs.md#lamplighter`, `#arbalist`, `#what-the-engine-needs`.

## Steps

- [ ] `src/sim/light.ts`: `lightOf(unit)` and `noticeOf(unit)` return the kit value after a `CheckLight` value event (append the event to `src/sim/events.ts` only if the contract allows; otherwise keep an internal per-unit bonus list through `setBonus`-style API in this module with a WeakMap). Jobs add through `addLight(unit, key, { add?, percent? })` / `removeLight`.
- [ ] Switch the AI reads and the fog radius to `lightOf`/`noticeOf`. Behavior with no bonus is identical (seeded fights record the same).
- [ ] `src/sim/still.ts`: `stillFor(unit)` returns seconds since the unit last moved more than a small epsilon or was pushed; updated from one `Sim` tick listener over living units. Casting in place does not reset it; walking, a knockback and a dash do.
- [ ] Tests: a bonus widens the distance at which a merc picks up an enemy and a monster notices the bearer; removing it restores them; the timer grows while idle, resets on movement and does not tick while the unit is dead; a non-moving unit pushed by a knockback resets.

## Acceptance

- [ ] `addLight(bearer, ...)` makes monsters notice the lantern from further (test in `test/sim/light.test.ts`) and the fog radius follows.
- [ ] With no bonus, `test/sim/sight.test.ts` and the fight records are unchanged.
- [ ] `stillFor` is 0 after movement, grows by dt while idle, and keeps counting while the unit casts.
- [ ] `pnpm vitest run test/sim/light.test.ts` passes.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

Two small modules plus a handful of one-line read swaps across AI and fog. M.

## Notes for the worker

- Lamplighter also depends on the gs-terrain-lantern value; do not edit lantern code, only read through the new functions.
- Bonuses keyed by source (`key`) so removal is exact; passive-owned bonuses live in a module WeakMap so a rank raise re-adds, not doubles.
- Hidden units (concealment contract) keep their own reveal logic; light does not change it.
- Sim stays DOM-free; `fog.ts` takes the radius as a number from the view model, not from sim internals.
