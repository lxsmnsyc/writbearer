---
name: job-hooks
version: 1
status: draft
defined_by: job-hooks
---

# Contract: job-hooks

## Purpose

The engine hooks the four new jobs and their upgrades need, added once before they fan out. A job's spells, passives and statuses then live in its own module (`src/content/jobs/<kind>/`) and attach to the engine with `sim.on` listeners. The eight job and upgrade nodes then do not take turns editing `src/sim/statuses.ts`, `mechanics/hit.ts`, `mechanics/damage.ts`, `ai.ts` and `sim.ts`. Used by arcanist, duelist, sellsword, warden and their `-upgrades` nodes.

## Interface

A first shape. job-hooks may change names while it builds, then writes the final shape into its outcome.

```ts
// src/sim/skill.ts
interface Skill {
  friendlyFire?: boolean; // area hits carry DamageFlags.FriendlyFire and hurt the party (Inferno)
}

// src/sim/status.ts
interface StatusDef {
  buff?: boolean; // a timed buff that can be stolen (Cutpurse)
}

// src/sim/statuses.ts
export const BLIND: StatusDef; // with buildup; blinded units miss more, through a CheckHit listener

// src/sim/events.ts
SimEvents.CheckChase;      // value event: how far from the bearer a merc may chase, in tiles (Tether)
SimEvents.CheckProjectile; // a projectile is about to hit a unit; cancel to block it (Cover)

// src/sim/nav.ts
nav.block(tiles: [number, number][], seconds: number): void; // tiles blocked for a while (Glacial Wall)

// src/sim/ai.ts
Priority.WeakToElement; // pick the target weakest to the merc's attack element (Elemental Sense)

// src/content/skills.ts
// rankOf adds a bonus from a CheckSkillRank value event, not from spent shards (Veteran of Many Wars)
```

## Behavior

- A job's own statuses (Warden's Marked, for example) are `StatusDef` consts in its module, as `src/content/bosses.ts` does. Only statuses other jobs or monsters reuse go in `src/sim/statuses.ts`.
- Changes to hits and damage are listeners on CheckHit, UnitMiss and UnitDamage at the existing priorities (`DamagePriority.Pre` for Interpose, `Block` for Feint). A job node does not edit `src/sim/mechanics/`.
- Who may be targeted goes through CheckTarget (targeting contract), not through this contract.
- Hooks added here have no effect until a listener uses them: `pnpm test` is unchanged.

## Stub

None needed: the hooks are small and land before the job nodes start.

## Contract tests

- `test/sim/job-hooks.test.ts`: one test per hook, with a listener made in the test.

## Changes

- v1: initial.
