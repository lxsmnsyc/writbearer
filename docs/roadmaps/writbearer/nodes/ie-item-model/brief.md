---
id: ie-item-model
title: Base tiers and STR/DEX requirements
status: active
priority: should
type: feature
outline: false
milestone: items-economy
target:
size: M
spike: false
verify: pnpm vitest run test/sim/item-tiers.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - test/sim/item-tiers.test.ts
shared:
  - src/sim/item.ts
  - src/content/items.ts
  - src/gen/loot.ts
  - src/game/inventory.ts
  - src/ui/inventory.tsx
reserves: []
provides: []
depends_on: []
---

# Base tiers and STR/DEX requirements

## Goal

Give every weapon and armor base a tier (Normal, Exceptional, Elite) and STR and DEX requirements. Higher item levels roll the stronger tier of the base that was picked. A merc below a weapon's, shield's or accessory's requirement cannot equip it, and the item tooltip shows the requirements.

## Context

- Source: `docs/design/06-items-inventory.md#item-data, #requirements-and-item-level`, `docs/design/05-mercenaries.md#requirements`. Items: `../../COVERAGE.md`, entries with target `ie-item-model`.
- Already built, do not redo: `ItemBase` with `level`, `weight`, `maxSockets`, `jobs`; `socketLimit` per quality; item level on every copy; `stackMax`. The sim has `Unit.base` (STR, DEX and the rest).
- Not built: `tier`, `requirements`, `weaponType` as the design's `speed` and `reach` (the existing `weapon: WeaponKind` stays; do not add the design's `weaponType`).
- `ItemBase` is static data found again by id, so `tier` and `requirements` need no save field. A save from before this node loads as is, and items on a new tier base round trip by base id through `saveItem` and `loadItem` (`src/game/save.ts`; `loadItem` resolves ids from `BASE_BY_ID`, so every new base must be in it).
- Equip paths: the player's `equip` in `src/game/inventory.ts` (checks `usableBy`) and `Inventory` UI. `Unit.equip`, `spawnMerc` starter gear (`src/content/roster.ts`) and save loading call `unit.equip` directly and must not check requirements, so recruits and old saves keep their gear.

## Steps

- [ ] Add `tier: Tier` (a `const enum`: Normal, Exceptional, Elite) and `requirements?: { str?: number; dex?: number }` to `ItemBase` in `src/sim/item.ts`. Absent tier means Normal.
- [ ] Add an Exceptional and an Elite sibling for the weapon, shield and body/head armor bases in `src/content/items.ts`: higher level, damage or armor, weight and requirements. Keep them out of the `BASES` pool the loot picks from; export them in `BASE_BY_ID`. Give a base an `upgrades?: { exceptional: string; elite: string }` id link, or a `TIERS` map beside `BASES`.
- [ ] In `rollItem` (`src/gen/loot.ts`), pick the base from the Normal pool exactly as today, then swap to the Exceptional or Elite sibling by item level, with no RNG draw. Thresholds are a first guess (for example Exceptional from item level 12, Elite from 24); choose them above what the balance tests reach, or say in the log why they move.
- [ ] Add `meetsRequirements(item, unit)` and `requirementText(item)` (pure, in `src/sim/item.ts`). A unit meets a requirement when `unit.base.str` and `unit.base.dex` are at least the item's, before gear bonuses.
- [ ] `equip` in `src/game/inventory.ts` returns a message and does nothing when a weapon, shield or accessory is not met. Head, Body, Cloak and Boots always equip; `ie-item-carry` slows the merc for them.
- [ ] Show the requirements, red when unmet, in the item tooltip (`itemLines` in `src/gen/loot.ts`) and grey out unmet items in `src/ui/inventory.tsx`.

## Acceptance

- [ ] `test/sim/item-tiers.test.ts`: at a low item level `rollItem` gives only Normal bases; at a high one it gives Exceptional and Elite bases whose rolled damage and armor exceed the Normal sibling's range.
- [ ] The same seed gives the same sequence of `rng` draws before and after: a test rolls 200 items at item levels 1 to 10 with `new RNG(seed)` and compares the base ids and the RNG state with a fixed list.
- [ ] A merc with STR below a weapon's requirement is refused with a message; with enough STR it equips. Body armor equips either way.
- [ ] `saveItem` then `loadItem` of an Elite item returns the same base, tier and rolls. A save written before this node (a fixture item without any tier base) loads.
- [ ] `test/sim/save.test.ts`, `test/gen/loot.test.ts`, `test/sim/bosses.test.ts` and `test/gen/balance.test.ts` pass without re-recording a snapshot.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

Size M: 5 files and about 500 lines, mostly data. Blast radius medium (`ItemBase` and `items.ts` are shared). Uncertainty low: the pattern is `socketLimit` and `jobs`.

## Notes for the worker

- Item nodes may edit `src/content/items.ts`; job nodes may not. Append new bases; do not reorder `BASES`, because `rng.pick(bases)` indexes it and a reorder shifts every roll.
- Loot RNG draws must not move: `test/sim/bosses.test.ts` and `test/gen/balance.test.ts` are seed-sensitive. Tier choice is by item level, never by `rng`. If higher tiers change fight numbers in those tests, raise the thresholds until they do not.
- Unique and set items (`src/content/uniques.ts`, `src/content/sets.ts`) point at Normal bases and stay on them.
- `ie-item-carry` runs after this node and reads `requirements.str`. Do not add carry or speed rules here.
