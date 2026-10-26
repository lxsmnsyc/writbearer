---
name: boss-def
version: 1
status: draft
defined_by: bp-roll
---

# Contract: boss-def

## Purpose

One module per boss, registered in one place, and a fixed pool of three per layer, so the boss pairs (bb-*) can be built in parallel without editing shared tables. Used by bp-ground, bb-reeve-siege, bb-bishop-usurper, bb-bridge-lantern, bb-choir-regent.

## Interface

```ts
// src/content/bosses/types.ts
export interface BossDef {
  id: string; // 'drownedReeve'; also the monster kind
  name: string; // 'The Drowned Reeve'
  layer: 0 | 1 | 2 | 3; // the pool it belongs to
  template: MonsterTemplate; // moved out of roster.ts
  spawn(sim: Sim, level: number, x: number, z: number): Unit;
  arena?: (stage: Stage, rng: RNG) => void; // field variant: bridge, islands
  field?: (sim: Sim, stage: Stage) => BossFieldRun | null; // see contract boss-field
  card: CardDef;
  bestiary: { who: string; how: string };
  view: { kind: Kind; size: number };
  icon: IconName;
}

// src/content/bosses/index.ts
export const BOSSES: ReadonlyMap<string, BossDef>;
export const POOLS: readonly (readonly string[])[]; // the designed three per layer, fixed
export function rollBoss(rng: RNG, depth: number, endless: boolean): string;
export function spawnBoss(sim: Sim, layer: number, level: number, x: number, z: number, id?: string): Unit; // no id: the layer's current boss
```

## Behavior

- The roll uses `streams.area(1, Stream.Map, BOSS_ROLL + depth)`; it never draws from the layer map's RNG.
- An id in a pool that is not built yet resolves to the first built id of that pool, so a seed keeps its meaning as bosses land.
- Endless rolls over all twelve; the field's biome still comes from the phase.
- `MapNode.boss` and `Stage.bossId` carry the id; old saves without it get the layer's current boss.

## Stub

The four current bosses registered as defs, unchanged.

## Contract tests

- `test/sim/boss-pool.test.ts`: determinism, no shift of other streams, fallback for unbuilt ids, endless reaches all twelve.

## Changes

- v1: initial.
