---
id: cc-el-defense
title: Temporary defense element changes
status: active
priority: should
type: feature
outline: false
milestone: combat-core
size: M
spike: false
verify: pnpm vitest run test/sim/el-defense.test.ts && pnpm vitest run test/sim/statuses.test.ts test/sim/cards.test.ts test/sim/bosses.test.ts test/sim/boss.test.ts test/sim/creditor.test.ts
exclusive: []
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/defense-element.ts
  - test/sim/el-defense.test.ts
shared:
  - src/sim/statuses.ts
  - src/sim/stats.ts
  - src/sim/unit/gear.ts
reserves: []
provides: []
depends_on:
  - on: split-unit
    kind: hard
    why: edits a feature module under src/sim/unit/ instead of the Unit class
---

# Temporary defense element changes

## Goal

Let skills and items change a unit's defense element for a while (rAthena's Benedictio, elemental armor), and let gear carry a defense element. Replace the snapshot-and-restore in `becomes` (Frozen to Frost 1, Petrified to Earth 1) with a layered override, so two sources cannot leave a unit stuck on the wrong element.

## Context

- Source: `docs/design/04-elements.md#status-changes-the-defense-element`. COVERAGE: "Skills/items changing defense element for a while; items with defenseElement bonus (cards 'Bog Hag')".
- Built: `Unit.element` and `elementLevel` (`src/sim/unit.ts`), `becomes` in `src/sim/statuses.ts` (saves the previous value on start and writes it back on stop, so a second override that starts and ends inside the first restores the wrong value), and the "weak to my element" target toggle that reads `target.element` (`Priority.WeakToElement` in the AI; reading only, no AI change needed).
- Cards and items have no defense element field today; `cards.ts` has Venom and Occult reductions only.

## Steps

- [ ] `src/sim/defense-element.ts`: per-unit override list in a `WeakMap<Unit, Override[]>` of `{ key, element, level, priority }`. `setDefenseElement(unit, key, element, level, priority)` and `clearDefenseElement(unit, key)` recompute `unit.element` and `unit.elementLevel` from the highest priority override, else the unit's base. Priorities: status (Frozen, Petrified) over skill over item.
- [ ] Rebase `becomes` onto it (a status keeps the same behavior, same ids).
- [ ] A status factory `defenseShift(element, level)` for skills (the Benedictio effect) in the same module. A `Modifier` form `{ defense: Element; level }` in `stats.ts` (append to the union) so an item or card can carry one; it applies at recalc as an item priority override.
- [ ] Tests: freeze then a skill shift, skill ends first, freeze ends first, both orders restore Neutral; an item shift; saves and loads keep the base element (the override is derived, not stored).

## Acceptance

- [ ] Frozen still makes the unit Frost 1 and Petrified Earth 1, with the old tests passing (`test/sim/statuses.test.ts`).
- [ ] Overlapping overrides in any end order leave the unit on the correct element (`test/sim/el-defense.test.ts`).
- [ ] A unit with a Fire defense shift takes Frost damage per the affinity table; a Neutral unit does not.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

Core types touched (`Modifier`, `Unit` element recompute), but each edit is small and a test proves it. M.

## Notes for the worker

- Any change that can touch shared damage math must keep `test/sim/bosses.test.ts`, `boss.test.ts` and `creditor.test.ts` passing unchanged; they are seed-sensitive. New code does nothing until something opts in, so a seeded fight matches the code before the node.
- Do not rewrite the Frozen/Petrified status ids or durations. Do not add content items or cards here; ie-cards owns new cards. Provide the modifier and helper only, plus one fixture in tests.
- `cc-el-spectral` appends one line to `statuses.ts`; keep your edit to `becomes`.
- Victim lists go through `hostiles`/`allowed`/`canTarget` (`src/sim/targeting.ts`), never `sim.foes` directly. Once-per-area effects key on `sim.area`. Passive state lives in a module `WeakMap<Unit, ...>`. Old saves must load. The sim stays DOM-free.

## After the splits

- After split-unit: the Unit logic lives in `src/sim/unit/` (movement, casting, statuses, gear, combat, kit). Edit the module listed under `shared:`, keep new per-unit state in a WeakMap in your own module, and leave `src/sim/unit.ts` alone.
