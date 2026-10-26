---
name: targeting
version: 1
status: draft
defined_by: targeting-rules
---

# Contract: targeting

## Purpose

One rule for "may this unit pick that hostile unit as a target", asked wherever a hostile target is chosen. Today `src/sim/ai.ts` picks inline (`pick`, `thinkMerc`, `thinkMonster` with its taunt, hunt, `blocker` and `lureFor` bait paths) and `src/sim/sim.ts` picks for volleys and straight shots through `Sim.foes`. Used by duelist-showmanship (Duel), sellsword-tricks (Play Dead), hidden-units, and later threat, Possess and flyers.

## Interface

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
export function canTarget(source: Unit, target: Unit): boolean; // emits CheckTarget
export function hostiles(source: Unit): Unit[]; // Sim.foes(source.side) filtered by canTarget
```

## Behavior

- Built-in rule: the target is alive and is one of `sim.foes(source.side)`, so the existing `Side.Ward` rules do not change. Listeners decide the rest.
- Only hostile choices go through it: merc pick, monster pick including taunt, `blocker` and bait, hostile targeted skills, volleys and straight shots at release. Choosing an ally to heal or buff is not filtered.
- Area damage is not filtered: a Duel does not stop a Fireball.
- When a unit's current target becomes forbidden, it drops it on its next think.
- A taunt from a forbidden unit is ignored.

## Stub

None usable: listeners need the event. Nodes that add listeners depend on targeting-rules with a `hard` edge.

## Contract tests

- `test/sim/targeting.test.ts`: a listener that forbids one monster makes mercs and skills pick another; a forbidden current target is dropped; area hits still land; heals still reach allies.

## Changes

- v1: initial.
