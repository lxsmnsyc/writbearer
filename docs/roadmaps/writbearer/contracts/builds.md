---
name: builds
version: 2
status: frozen
defined_by: build-rules
---

# Contract: builds

## Purpose

The rules of the build model in `docs/design/16-builds.md`: each job has 4 spells, 1 innate passive and 12 elite upgrades. Shards are the stackable regular upgrades: 1 per merc level, each raising one spell a rank. Each spell holds at most one elite upgrade for the run. Used by job-registry, mastery-offers and every job and upgrade node.

## Interface

Built in `src/sim/builds.ts`.

```ts
// src/sim/builds.ts
export interface Upgrade {
  id: string;
  spell: string; // id of the spell it changes; one of the job's 4
  name: string;
  describe: (rank: number) => string; // at the spell's rank
  patch?: Partial<Skill>; // the spell cast is { ...base, ...patch, id: base.id }
  effect?: Passive; // set up at the spell's rank, again on each raise
}
export interface Build { spells: Skill[]; upgrades: Upgrade[] } // spells in cast order

export const MAX_RANK = 10;
export const rankCap = (level: number): number; // min(10, 1 + floor(level / 2))

// TEMPORARY registry, until job-registry: buildFor and upgradeById must read
// from JOBS, and registerBuild / unregisterBuild are deleted.
export function registerBuild(kind: string, build: Build): void; // by merc kind, replaces any before
export function unregisterBuild(kind: string): void; // for tests; removes its upgrades too
export const buildFor: (kind: string) => Build | undefined; // stays, reads JOBS later
export const upgradeById: (id: string) => Upgrade | undefined; // stays, reads JOBS later
export const isBuilt: (u: Upgrade) => boolean; // has patch or effect

export function giveSpells(unit: Unit, spells: readonly Skill[]): void;
export function spellOf(unit: Unit, base: Skill): Skill;
export function cannotRaise(unit: Unit, spell: string): string | null;
export function raise(unit: Unit, spell: string): string | null;
export function cannotUpgrade(unit: Unit, upgrade: Upgrade): string | null;
export function applyUpgrade(unit: Unit, upgrade: Upgrade): string | null;
export function offerUpgrades(unit: Unit, pool: readonly Upgrade[], rng: RNG, n: number): Upgrade[];
export function upgradeOf(unit: Unit, spell: string): Upgrade | undefined;

// on Unit (src/sim/unit.ts)
spells: Skill[]; // base spells in cast order; [] for a job on its tree
shards: number;
readonly upgrades: Map<string, string>; // spell id -> upgrade id
```

Ranks stay in `unit.skillRanks` and are read with `rankOf` (`src/content/skills.ts`), so skill code does not change how it reads its rank.

The registry is temporary. job-registry makes `buildFor(kind)` and `upgradeById(id)` read from JOBS, deletes `registerBuild` and `unregisterBuild`, and calls `giveSpells(unit, def.spells)` in `spawnMerc` after `skillPoints` is set.

## Behavior

- A merc knows its 4 spells at rank 1 from level 1. A level gives 1 shard. A recruit arrives with `level − 1` shards, unspent.
- A spell's rank cannot pass `rankCap(level)`.
- The AI casts the first spell in `unit.spells` that its rule wants. Spell order is the job's priority.
- No Auto spend. The player spends shards by hand in the spell panel.
- Saves add optional `shards` and `upgrades`. A loaded merc that has tree ranks but a job with spells gets one shard per spent point. `SAVE_VERSION` stays 3.
- `unit.skills` stays the list the AI casts from. `giveSpells` and `applyUpgrade` keep it equal to `unit.spells` in order, with upgrades applied.
- A saved upgrade id that no build resolves stays in `unit.upgrades`. The spell still counts as upgraded, and the next save writes the id back.
- The Town trainer (mj-trainer-synergies) resets shards only. Upgrades stay.

## Stub

None usable before build-rules: nodes that need it start after it is frozen.

## Contract tests

- `test/sim/builds.test.ts`: rank cap by level; `raise` fails at the cap and with no shards; `applyUpgrade` fails on a spell that holds one; `spellOf` applies the patch; `offerUpgrades` skips spells that hold one and is deterministic for a seed; the save round trip keeps shards and upgrades; an old save refunds tree ranks.

## Changes

- v1: initial.
- v2 (2026-10-27, frozen by build-rules): the final shape, with the temporary build registry and the helpers `giveSpells`, `cannotRaise`, `cannotUpgrade`, `upgradeOf` and `isBuilt`.
