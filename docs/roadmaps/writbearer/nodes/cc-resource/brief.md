---
id: cc-resource
title: A second resource beside mana
status: done
priority: should
type: feature
outline: false
milestone: combat-core
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/resource.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent: 164680
owns:
  - src/sim/resource.ts
  - test/sim/resource.test.ts
shared:
  - src/sim/skill.ts
  - src/sim/unit/casting.ts
  - src/ui/merc-panel.tsx
reserves: []
provides: []
depends_on:
  - on: split-unit
    kind: hard
    why: edits a feature module under src/sim/unit/ instead of the Unit class
---

# A second resource beside mana

## Goal

A job-defined resource a unit can hold next to mana, for the Monk's spirit spheres and later jobs (Berserker rage if designed that way). A resource has a name, a cap, a starting amount, an optional decay and what it does at an area change. Skills can cost it, gain it, or both. The merc panel shows it.

## Context

- Mana is a field of `Unit` (`mana`, `derived.maxMana`) and the only cost: `Skill.cost`, `Unit.skillCost`, `Unit.canCast` (`src/sim/unit.ts`), with `CheckSkillCost` as the hook for changes.
- Doc 12 names the Monk's spheres as the reason. The Monk node designs how many it holds; this node only provides the mechanism.
- Source: `docs/design/12-new-jobs.md#what-the-engine-needs`, `#monk`.

## Steps

- [ ] `src/sim/resource.ts`: `ResourceDef { id, name, max, start, decayPerSecond?, keepAcrossAreas? }`, `grant(unit, def)` registers it, `gain(unit, id, n)`, `spend(unit, id, n): boolean`, `amountOf(unit, id)`, `resourcesOf(unit)` for the UI. Values live in a module `WeakMap<Unit, Map<string, number>>`, since a skill rank raise reruns passive setup and must not reset it.
- [ ] Reset by area: values not marked `keepAcrossAreas` return to `start` when `sim.area` changes (key on `sim.area`; the party carries over in one Sim via `carryParty`). Decay runs from a `SimEvents` tick listener or `Sim.tick` hook, one place.
- [ ] `Skill.spends?: { resource: string; cost: number }` (append to the `Skill` interface in `src/sim/skill.ts`); `Unit.canCast` also requires `amountOf >= cost`, and the windup start spends it next to the mana. A `CheckSkillCost`-style value event for the resource cost is not needed yet.
- [ ] Merc panel shows pips or a bar for each resource the merc has (`src/ui/merc-panel.tsx`), only when it has one.
- [ ] Tests: gain caps at max; spend fails when short and leaves the value; decay; reset on area change; a skill with `spends` is uncastable without it and spends it on cast; a rank raise keeps the amount; a unit with no resources is unchanged.

## Acceptance

- [ ] A test skill that costs 2 of a resource is not castable at 1, castable at 2, leaves 0 after cast, and gaining the resource later makes it castable.
- [ ] The amount survives `raise` (passive setup rerun) and resets on the next area unless `keepAcrossAreas`.
- [ ] The merc panel renders a resource only for units that have one.
- [ ] `pnpm vitest run test/sim/resource.test.ts` passes.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

New module plus three small appends (skill field, `canCast`, panel row). M.

## Notes for the worker

- Passive state that must survive a rank raise lives in the module WeakMap, not in the passive's closure.
- Do not widen `Unit` with a resource map; the WeakMap keeps `unit.ts` to a one-line `canCast` change.
- Saved runs from before must still load (`src/game/save.ts`). Resources are not saved mid-fight; if a save is taken at a Waystation they start fresh on load.
- Sim stays DOM-free; only `merc-panel.tsx` touches the UI.
- Check the unit test in `test/sim/skills.test.ts` for how skills are cast in tests.

## After the splits

- After split-unit: the Unit logic lives in `src/sim/unit/` (movement, casting, statuses, gear, combat, kit). Edit the module listed under `shared:`, keep new per-unit state in a WeakMap in your own module, and leave `src/sim/unit.ts` alone.
