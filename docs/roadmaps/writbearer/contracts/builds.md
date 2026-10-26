---
name: builds
version: 1
status: draft
defined_by: build-rules
---

# Contract: builds

## Purpose

The rules of the build model in `docs/design/16-builds.md`: each job has 4 spells, 1 innate passive and 12 elite upgrades. Shards are the stackable regular upgrades: 1 per merc level, each raising one spell a rank. Each spell holds at most one elite upgrade for the run. Used by job-registry, mastery-offers and every job and upgrade node.

## Interface

A first shape. build-rules may change names while it builds, then writes the final shape into its outcome.

```ts
// src/sim/builds.ts
export interface Upgrade {
  id: string;
  spell: string; // id of the spell it changes; one of the job's 4
  name: string;
  describe: (rank: number) => string;
  patch?: Partial<Skill>; // the spell cast is { ...base, ...patch }
  effect?: Passive; // a passive the upgrade starts
}

export const MAX_RANK = 10;
export const rankCap = (level: number): number => Math.min(MAX_RANK, 1 + Math.floor(level / 2));

// The spell a unit casts, with its upgrade applied
export function spellOf(unit: Unit, base: Skill): Skill;
// Spends one shard on a spell. Returns why it failed, or null.
export function raise(unit: Unit, spell: string): string | null;
// Sets a spell's elite upgrade. Fails if the spell already holds one.
export function applyUpgrade(unit: Unit, upgrade: Upgrade): string | null;
// Up to n upgrades the unit could take: of spells with no upgrade yet
export function offerUpgrades(unit: Unit, pool: Upgrade[], rng: RNG, n: number): Upgrade[];

// on Unit (src/sim/unit.ts)
spells: Skill[]; // the job's 4, in cast priority order
shards: number;
upgrades: Map<string, string>; // spell id -> upgrade id
```

Ranks stay in `unit.skillRanks` and are read with `rankOf` (`src/content/skills.ts`), so skill code does not change how it reads its rank.

## Behavior

- A merc knows its 4 spells at rank 1 from level 1. A level gives 1 shard. A recruit arrives with `level − 1` shards, unspent.
- A spell's rank cannot pass `rankCap(level)`.
- The AI casts the first spell in `unit.spells` that its rule wants. Spell order is the job's priority.
- No Auto spend. The player spends shards by hand in the spell panel.
- Saves add optional `shards` and `upgrades`. A loaded merc that has tree ranks but a job with spells gets one shard per spent point. `SAVE_VERSION` stays 3.
- The Town trainer (mj-trainer-synergies) resets shards only. Upgrades stay.

## Stub

None usable before build-rules: nodes that need it start after it is frozen.

## Contract tests

- `test/sim/builds.test.ts`: rank cap by level; `raise` fails at the cap and with no shards; `applyUpgrade` fails on a spell that holds one; `spellOf` applies the patch; `offerUpgrades` skips spells that hold one and is deterministic for a seed; the save round trip keeps shards and upgrades; an old save refunds tree ranks.

## Changes

- v1: initial.
