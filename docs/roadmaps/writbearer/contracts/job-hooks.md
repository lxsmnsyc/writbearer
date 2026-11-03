---
name: job-hooks
version: 2
status: frozen
defined_by: job-hooks
---

# Contract: job-hooks

## Purpose

The engine hooks the four new jobs and their upgrades need, added once before they fan out. A job's spells, passives and statuses then live in its own module (`src/content/jobs/<kind>/`) and attach to the engine with `sim.on` listeners. The eight job and upgrade nodes then do not take turns editing `src/sim/statuses.ts`, `mechanics/hit.ts`, `mechanics/damage.ts`, `ai.ts` and `sim.ts`. Used by arcanist, duelist, sellsword, warden and their `-upgrades` nodes.

## Interface

As built by job-hooks. Details, payloads and gotchas are in `nodes/job-hooks/outcome.md`.

```ts
// src/sim/skill.ts (Arcanist Inferno)
interface Skill {
  friendlyFire?: boolean | ((unit: Unit) => boolean);
}
// Foes the source may target (CheckTarget) with flags AoE, plus, when the skill has
// friendly fire for this source, its own side except itself with AoE | FriendlyFire.
function areaVictims(source: Unit, skill: Skill, at: { x: number; z: number }, radius: number):
  { target: Unit; flags: number }[];

// src/sim/status.ts (Sellsword Cutpurse)
interface StatusDef {
  buff?: boolean; // stealable; set on Mending, Refreshing, Renewed, Shield Wall, SANCTIFIED
}
function buffsOf(unit: Unit): ActiveStatus[];
// Adds to the thief first, keeps stacks, removes from `from` only if the add took.
function stealBuff(thief: Unit, from: Unit): ActiveStatus | null;

// src/sim/statuses.ts (Sellsword Pocket Sand, Salt the Wound; Lamplighter, monsters)
export const BLIND: StatusDef; // id 'blind', 4 s, immunity 3 s, DEX threshold;
                               // -30 hit chance on physical hits (CheckHit, Additive)

// src/sim/events.ts
SimEvents.CheckChase;          // { source; value } ValuePriority. From thinkMerc: how far from
                               // the bearer enemies are picked, in tiles (Warden Tether)
SimEvents.CheckProjectile;     // { source /* shooter */; target; projectile } EventPriority.
                               // Before a projectile strikes a unit; disabled = true blocks it
                               // and ends the projectile (Warden Cover). Fires for enemy shots too.
SimEvents.CheckAttackElements; // { source; elements: Element[] } ValuePriority. Starts as
                               // [source.attackElement] (Arcanist Elemental Sense)
SimEvents.CheckSkillRank;      // { source; skill; value } ValuePriority. From rankOf; value starts
                               // at max(1, u.skillRank(id)) (Sellsword Veteran of Many Wars)

// src/sim/nav.ts (Arcanist Glacial Wall)
nav.block(tiles: readonly (readonly [number, number])[], seconds: number): void; // [x, z] tiles
nav.shut(x: number, z: number): boolean;
nav.advance(dt: number): void; // Sim.tick calls it
// Paths, walkable, clear, roomy, free, A* goals, separate() and Unit.walkTo treat a blocked
// tile as closed. A body inside one only steps toward open ground. Projectiles pass.

// src/sim/ai.ts (Arcanist Elemental Sense)
Priority.WeakToElement; // = 6: enemies taking over 100% from the merc's attack elements, nearest
```

## Behavior

- A job's own statuses (Warden's Marked, for example) are `StatusDef` consts in its module, as `src/content/bosses.ts` does. Only statuses other jobs or monsters reuse go in `src/sim/statuses.ts`.
- Changes to hits and damage are listeners on CheckHit, UnitMiss and UnitDamage at the existing priorities (`DamagePriority.Pre` for Interpose, `Block` for Feint). A job node does not edit `src/sim/mechanics/`.
- Who may be targeted goes through CheckTarget (targeting contract), not through this contract.
- Area skills take their victims from `areaVictims`, or from `allowed()` for foes only, never from `sim.foes`.
- Monster buff statuses added later set `buff: true`, or `stealBuff` cannot take them.
- The hooks have no effect until a listener uses them: a seeded fight record matches the code before job-hooks.
- Not covered here, game-layer work for the Sellsword nodes: gold on a kill (Pocket Change), spending gold (Bribe), the phase count (Veteran of Many Wars, in `src/game/game/fight.ts`), and a per-run use count by weapon type (Weapon Habit, probably a save field).

## Stub

None: the hooks are built.

## Contract tests

- `test/sim/job-hooks.test.ts`: 25 tests, each with a listener made in the test, including a crowd of 10 monsters held by a blocked wall on every tick.

## Changes

- v1: initial draft.
- v2 (2026-11-03, frozen): as built. Added `areaVictims`, `buffsOf`, `stealBuff`, `CheckAttackElements`, `nav.shut` and `nav.advance`. `friendlyFire` may be a function of the caster. SANCTIFIED is a buff.
