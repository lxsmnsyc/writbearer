---
name: targeting
version: 2
status: frozen
defined_by: targeting-rules
---

# Contract: targeting

## Purpose

One rule for "may this unit pick that hostile unit as a target", asked wherever a hostile target is chosen. Today `src/sim/ai.ts` picks inline (`pick`, `thinkMerc`, `thinkMonster` with its taunt, hunt, `blocker` and `lureFor` bait paths) and `src/sim/sim.ts` picks for volleys and straight shots through `Sim.foes`. Used by duelist-showmanship (Duel), sellsword-tricks (Play Dead), hidden-units, and later threat, Possess and flyers.

## Interface

Built in `src/sim/events.ts` and `src/sim/targeting.ts`.

```ts
// src/sim/events.ts
SimEvents.CheckTarget = 'CheckTarget'

export interface CheckTargetEvent extends BaseEvent {
  source: Unit; // the unit choosing
  target: Unit; // the hostile candidate
  allowed: boolean; // listeners set false to forbid
}
// in SimEventMap: [SimEvents.CheckTarget]: [CheckTargetEvent, ValuePriority]

// src/sim/targeting.ts
export function canTarget(source: Unit, target: Unit): boolean; // alive, in sim.foes(source.side), then emits CheckTarget
export function hostiles(source: Unit): Unit[]; // Sim.foes(source.side) filtered by canTarget
export function allowed(source: Unit, units: Unit[]): Unit[]; // filters a list the caller already has
export function forbids(source: Unit, target: Unit): boolean; // true only for a living foe a listener refuses
```

## Behavior

- Built-in rule: the target is alive and is one of `sim.foes(source.side)`, so the existing `Side.Ward` rules do not change. Listeners decide the rest.
- Only hostile choices go through it: merc pick, monster pick including taunt, `blocker` and bait, hostile targeted skills, volleys and straight shots at release. Choosing an ally to heal or buff is not filtered.
- Area damage is not filtered: a Duel does not stop a Fireball.
- When a unit's current target becomes forbidden, it drops it on its next think.
- A taunt from a forbidden unit is ignored.
- At release, a melee swing, a targeted skill, the first arrow of a volley and a homing arrow whose target became forbidden are cancelled (`forbids`). An area skill aimed at a unit that became forbidden during its windup is cancelled too.
- A straight shot asks once per unit and remembers a refusal.
- With no listener, play does not change. Dead taunters and dead bait owners behave as before, because those paths use `forbids`, not `canTarget`.
- Known gap: content skills that choose their own victims (`challenged` and `inLine` in `src/content/skills.ts`, `around` in `ranger.ts`, `after` in `cleric.ts`) are not filtered. A node whose listener must hold against them (Duel, Play Dead) moves them onto `hostiles()` or `allowed()`.

## Stub

None usable: listeners need the event. Nodes that add listeners depend on targeting-rules with a `hard` edge.

## Contract tests

- `test/sim/targeting.test.ts`: a listener that forbids one monster makes mercs and skills pick another; a forbidden current target is dropped; area hits still land; heals still reach allies.

## Changes

- v1: initial.
- v2 (2026-10-27, frozen by targeting-rules): adds `allowed` and `forbids`, release-time cancels, and the content-skill gap.
