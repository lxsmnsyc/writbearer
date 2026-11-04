---
name: boss-field
version: 1
status: draft
defined_by: bp-ground
---

# Contract: boss-field

## Purpose

Changes to the boss field over a fight, armed when the boss wakes. Used by bb-reeve-siege (rising water), bb-bridge-lantern (falling sections) and bb-choir-regent (islands).

## Interface

```ts
// src/game/boss-field.ts
export interface BossFieldRun {
  update(sim: Sim, dt: number, stage: Stage): void;
}
export class BossField {
  start(boss: Unit, run: BossFieldRun): void; // armed when the boss wakes
  update(sim: Sim, dt: number, stage: Stage): void; // game.ts calls once per tick
}
export function risingWater(opts: { warn: number; every: number; islands: Spot[] }): BossFieldRun;
export function fallingSections(opts: { sections: Rect[]; warn: number; every: number }): BossFieldRun;
```

## Behavior

- Every change is warned on the ground first (`warn()` in `src/sim/warning.ts`).
- The exit and the boss's spot stay reachable; units on a falling section take the fall and are moved, as in the Collapse objective.
- The field stops when the boss dies.

## Stub

`BossField` with a run whose `update` does nothing; boss nodes can test their spawn and moves against it.

## Contract tests

- `test/game/boss-field.test.ts`.

## Changes

- v1: initial.
