---
id: be-strippers
title: Strippers: disable an item for the stage
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: bestiary
target:
ship: auto
size: M
spike: false
verify: pnpm vitest run test/sim/strippers.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/strip.ts
  - src/sim/ai/stripper.ts
  - test/sim/strippers.test.ts
shared:
  - src/sim/ai/monster.ts
  - src/sim/unit/gear.ts
  - src/content/monsters/spawn-steps.ts
  - src/game/game/areas.ts
  - src/ui/log.ts
reserves: []
provides: []
depends_on:
  - on: split-ai
    kind: hard
    why: the stripper's behavior is a module under src/sim/ai/ plus one inserted step in monster.ts
  - on: split-unit
    kind: hard
    why: edits a feature module under src/sim/unit/ instead of the Unit class
  - on: split-roster
    kind: hard
    why: adds its monsters or template flag through src/content/monsters/ and the spawnMonster step list
---

# Strippers: disable an item for the stage

## Goal

A stripper monster strikes a merc (or the bearer) and disables one equipped item until the stage ends or the bearer hands it back. The item stays in its slot and keeps its place in the pack screen, but gives no bonus. A stripped weapon means the merc fights bare-handed. This is the Confessor's engine.

## Context

- Source: `docs/design/06-items-inventory.md` (line 480: "A stripped item stops working until the stage ends or the citizen hands it back"), `07-citizen-npcs-enemies.md#enemies` (Stripper row), `13-bestiary.md` (Confessor row).
- Items: `../../COVERAGE.md`, entries with target `be-strippers`.
- Equipment bonuses are collected in `src/sim/unit.ts` (`equipment` map at line 130; the loop over `this.equipment.values()` around line 694 and `itemModifiers` around line 725). A stripped item must be skipped there.
- A bare-handed weapon: the weapon slot's `weaponOf` in `src/sim/item.ts`; unarmed already exists for the Bearer (`weapon: { min: 0, max: 0, matk: 0 }` in `src/content/roster.ts`).
- Handing an item to a merc in a fight is gated by `HAND_REACH` in `src/game/inventory.ts`.

## Steps

- [ ] `src/sim/strip.ts`: `strip(u, slot)`, `restore(u, slot)`, `stripped(u)` over a per-sim `Map<Unit, Set<EquipSlot>>`; `restoreAll(sim)` runs when the area changes (hook `sim.area` in `areas.ts` where it is incremented, one call).
- [ ] `unit.ts`: skip stripped items when summing modifiers and when picking the weapon. One small edit in the recalculation, and the recalculation must run when strip or restore happens. (Only strip with an item that is equipped; an empty slot is never chosen.)
- [ ] `src/sim/ai/stripper.ts`: on a successful strike, pick the target's best item by a fixed rule (weapon first, then armor, then others), skip an already stripped one, strip it, log a line. A stripper strips once per merc per area. Insert one step in `monster.ts` only if it needs a pre-strike action; if it only reacts to a hit, use a `UnitDamage` listener set up in `strip.ts` instead and add no AI step.
- [ ] Hand-back: the existing hand-over input returns the item to working, no new UI. Killing the stripper does not restore the item; it only stops further strips.
- [ ] Draw: a small chain mark on the stripped slot in the merc's panel is optional; a log line is enough for the first version.

## Acceptance

- [ ] A test stripper (test-only template) hits a merc wearing a sword and armor: the sword's attack bonus is gone, `derived` stats drop by that item's modifiers, and the armor is untouched.
- [ ] The merc's weapon being stripped means its basic attack uses the unarmed weapon, and it still attacks.
- [ ] A second hit strips nothing more from the same merc during the same area; a different merc may be stripped.
- [ ] Handing the item back (the same code path as a normal hand-over) restores the bonus.
- [ ] Changing area restores every stripped item.
- [ ] A save taken at the next area entrance has the item working; a test saves and loads a merc after a strip (`src/game/save.ts` keeps the item, never a flag), proving no item is lost or doubled.
- [ ] An equipped item cannot be unequipped and sold for its value as if intact while stripped without the strip clearing; test the vault and sell paths do not duplicate it.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

M: medium on blast radius (the stat sum in unit.ts, one area-change hook); a test proves each claim.

## Notes for the worker

- Once-per-area limits key on `sim.area`, not on unit identity: party units carry over between areas in one `Sim` (`src/content/CLAUDE.md`).
- Keep the strip as a set on the sim, not a field on `Item`: items are saved and cards and sets read them, and a flag on the item could be saved by accident.
- Sets (`src/content/sets.ts`) count worn pieces. Decide whether a stripped piece counts toward a set; the simplest correct choice is that it does not, and the test pins it.
- Do not add the Confessor here. `be-monsters-deep` does.

## After the splits

- After split-unit: the Unit logic lives in `src/sim/unit/` (movement, casting, statuses, gear, combat, kit). Edit the module listed under `shared:`, keep new per-unit state in a WeakMap in your own module, and leave `src/sim/unit.ts` alone.
- After split-roster: new monsters go in their faction module under `src/content/monsters/`, a template flag is one module plus one entry in `SPAWN_STEPS` (`src/content/monsters/spawn-steps.ts`, a step is `(unit, template, sim) => void`); `src/content/roster.ts` is a barrel and stays unchanged.
