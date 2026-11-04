---
id: ie-item-carry
title: Carry limit, heavy armor slowdown and two-handed weapons
status: todo
priority: should
type: feature
outline: false
milestone: items-economy
target:
size: M
spike: false
verify: pnpm vitest run test/sim/item-carry.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - test/sim/item-carry.test.ts
shared:
  - src/sim/item.ts
  - src/content/items.ts
  - src/sim/unit/movement.ts
  - src/sim/unit/gear.ts
  - src/game/inventory.ts
  - src/ui/inventory.tsx
  - src/ui/stat-sheet.tsx
reserves: []
provides: []
depends_on:
  - on: ie-item-model
    kind: hard
    why: reads the STR requirement and the tiers it adds to ItemBase, and edits the same equip check in src/game/inventory.ts
  - on: split-unit
    kind: hard
    why: edits a feature module under src/sim/unit/ instead of the Unit class
---

# Carry limit, heavy armor slowdown and two-handed weapons

## Goal

A merc has a carry limit from STR. Worn gear over the limit, and heavy armor worn below its STR requirement, slow the merc. A two-handed weapon in the Weapon slot also fills the Offhand.

## Context

- Source: `docs/design/06-items-inventory.md#inventory-layers` (Equipment weight, loadout table), `docs/design/05-mercenaries.md#requirements`. Items: `../../COVERAGE.md`, entries with target `ie-item-model`.
- Built: every base has `weight`; the bearer's pack has `weight`, `maxWeight` and `speed`, and `game/state.ts` sets `bearer.burden = pack.speed`; `Unit.speed` is `kit.moveSpeed * burden * slows` (`src/sim/unit.ts`). Mercs' `burden` is unused.
- Not built: merc carry limit, gear weight sum, requirement slowdown, any `twoHanded` flag. The Offhand today holds only shields (`ItemType.Shield`), and no job in `jobs` lists wields a shield with a bow or staff.
- Equipment is saved by slot and rebuilt with `unit.equip`, and a base's `twoHanded` is static data, so no save field changes. An old save still loads. A save that holds a shield and a two-handed weapon cannot exist before this node, since none is flagged.

## Steps

- [ ] `twoHanded?: boolean` on `ItemBase` (`src/sim/item.ts`). Flag the bows and the Ash Staff in `src/content/items.ts` (first guess; the Pilgrim Staff and the Censer stay one-handed so Clerics keep a shield).
- [ ] `equip` in `src/game/inventory.ts`: putting a two-handed weapon on moves the Offhand item to the pack (or refuses if the pack is full); putting a shield on over a two-handed weapon is refused with a message. `slotFor` stays.
- [ ] `carryLimit(unit)` and `gearWeight(unit)` in `src/sim/item.ts` (pure). First guess: limit is `40 + 4 * str`; equipment weight sums `base.weight` of worn items and sockets are free.
- [ ] A slow factor for a merc: over the limit, speed falls by the share over, floored at 0.6; each Head, Body, Cloak or Boots piece whose STR requirement is above the merc's adds a flat -5%, floored together at 0.6. Apply it in `Unit.recalc` or `Unit.speed` next to `burden` without touching the bearer's pack rule (a separate `gearSlow` field multiplied in `speed`).
- [ ] The stat sheet and the inventory show carried / limit and a slowed marker.

## Acceptance

- [ ] `test/sim/item-carry.test.ts`: a merc with STR 5 in a full set of heavy gear walks slower than the same merc with STR 25; unequipping lowers the slowdown at once; the bearer's pack speed is unchanged.
- [ ] Two-handed: equipping a bow with a shield on empties the Offhand into the pack; equipping a shield over a bow is refused; unequipping the bow frees the slot.
- [ ] A save round trip keeps equipped gear; a save from before this node loads and a merc with no gear has no slowdown.
- [ ] Seeded fights without heavy gear are unchanged: `test/sim/bosses.test.ts` and `test/gen/balance.test.ts` pass without re-recording.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

Size M: about 6 files and 400 lines. `src/sim/unit.ts` is core, so blast radius is medium; the rest is a known pattern (`burden`).

## Notes for the worker

- Starter and recruit gear may exceed the new limits; the slowdown must not make `test/sim/recruits.test.ts` or the balance tests fail. Tune the first-guess numbers, not the tests.
- Do not read gear bonuses into the STR used for the limit; use `unit.base.str` to avoid a loop with `recalc`.
- Do not add a run-long count; nothing here needs `Unit.tally`.
- Do not edit job modules. Mark two-handed in `items.ts`, which item nodes may edit.

## After the splits

- After split-unit: the Unit logic lives in `src/sim/unit/` (movement, casting, statuses, gear, combat, kit). Edit the module listed under `shared:`, keep new per-unit state in a WeakMap in your own module, and leave `src/sim/unit.ts` alone.
