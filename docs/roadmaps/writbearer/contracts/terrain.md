---
name: terrain
version: 1
status: draft
defined_by: gs-terrain-kinds
---

# Contract: terrain

## Purpose

Ground kinds and the queries other systems ask of the ground, so the terrain nodes (grass, deep water, ledges, lantern, braziers) run in parallel and later work (Hide, night, rain, the Lamplighter, dark bosses) reads one place. Used by every `gs-terrain-*` node, sb-bearer-kit, gs-phase-modifiers and bb-bridge-lantern.

## Interface

```ts
// src/gen/stage.ts (types)
Patch.kind: 'water' | 'embers' | 'deep' | 'grass'; // grass is fungus on the two lower layers
Patch.frozen?: boolean; // deep water turned to ice
Stage.ledges?: Ledge[]; // { rect, level, ramps: Rect[] }; absent in old saves

// src/sim/ground.ts
export class Ground {
  coverAt(x: number, z: number): 'grass' | null;
  heightAt(x: number, z: number): number; // 0 below, 1 on a plateau, between on a ramp
  litAt(x: number, z: number): boolean; // inside any light source
}
// Sim.ground: Ground. Stub: no cover, height 0, not lit.
```

## Behavior

- `sim.obstacles` blocks bodies and sight; `sim.holes` blocks bodies only (chasm, deep water, cliffs). A runtime change edits them and calls `sim.setWorld(sim.floor)`.
- Per-kind code lives in one table per concern (gen counts and radii, game effects, floor paint), keyed by kind. A node adds rows; it does not add branches to shared switch statements.
- New generation rolls come after existing ones, or from a forked stream, so existing seeds keep their fields.
- Every new `Stage` or `Patch` field is optional; saves store the whole stage.
- Cover never sets `unit.hidden` (that is the concealment contract). It only lowers how far monsters notice.

## Stub

gs-terrain-kinds ships `Ground` with the neutral answers above and the two existing kinds moved into tables.

## Contract tests

- `test/sim/ground.test.ts`: the stub answers; a seed generates the same patches and props as before the tables.

## Changes

- v1: initial.
