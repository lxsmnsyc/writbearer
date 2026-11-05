---
id: ie-item-bonuses
title: Defense element and spell rank bonus forms
status: active
priority: should
type: feature
outline: false
milestone: items-economy
target:
size: M
spike: false
verify: pnpm vitest run test/sim/item-bonuses.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - test/sim/item-bonuses.test.ts
shared:
  - src/sim/stats.ts
  - src/sim/unit/gear.ts
  - src/content/skills.ts
  - src/content/cards.ts
  - src/gen/loot.ts
reserves: []
provides: []
depends_on:
  - on: cc-el-defense
    kind: hard
    why: that node adds the `{ defense: Element; level }` Modifier form and the layered defense element; this node only adds its tooltip and an example card
  - on: split-unit
    kind: hard
    why: edits a feature module under src/sim/unit/ instead of the Unit class
---

# Defense element and spell rank bonus forms

## Goal

Add the two bonus forms items and cards still lack, as data in the `Modifier` union: a defense element with a level, and a rank bonus to one spell. An item, affix or card can then set the wearer's defense element or raise a spell, with no code of its own.

## Context

- Source: `docs/design/06-items-inventory.md#bonuses`; build model in `docs/design/16-builds.md` and `contracts/builds.md`. Items: `../../COVERAGE.md`, entries with target `ie-item-model`.
- Built: `Modifier` has `base`, `stat`, `amplify` and `reduce` forms (`src/sim/stats.ts`); `onHit` buildup and `attackElement` come from socket `setup` effects (`src/content/cards.ts`, `Item.effect`); `Unit.element`, `elementLevel` and `attackElement` exist; `CheckSkillRank` already lets a listener add rank (`rankOf` in `src/content/skills.ts`).
- Skill grant, reshaped: doc 16 gives every job 4 spells from level 5 and raises them with shards (`Unit.spells`, `raise`); upgrades read the rank of their base spell. Granting a skill the merc lacks no longer exists, so the form becomes `{ spell: string; rank: number }`: `+rank` to one of the job's four spells, by spell id, counted in `rankOf`, capped at `MAX_RANK`, ignored when the merc has no such spell. It gives no shards and does not count against `rankCap`. Do not add `autocast`, `effect` or `onHit` as union members here; `ie-cards` and `cc-autocast` own those.
- Saves: `Item.bonuses` and card modifiers are plain JSON, so new members round trip. Old saves have neither member and load as is.

## Proposed contract: item-bonus

The orchestrator may freeze this before `ie-cards` and `ie-item-roll` start. It has: the two new `Modifier` members, the `StatResult` fields `defenseElement?: { element: Element; level: number }` and `spellRanks: Map<string, number>`, `rankOf` including `spellRanks`, and `Unit.element` / `elementLevel` reading `defenseElement` over the unit's own. Rule: the highest level wins when two sources set one; a tie keeps the later.

## Steps

- [ ] Add `{ spell: string; rank: number }` to `Modifier` (the `{ defense, level }` form comes from cc-el-defense; use it, do not add a second one); collect them in `deriveStats` into `StatResult`.
- [ ] `Unit.recalc` exposes `spellRanks` (the defense element is applied by cc-el-defense's override list); `rankOf` adds the bonus to the starting value before `CheckSkillRank` is emitted, so listeners see the sum.
- [ ] Tooltip text for both forms in `modifierLine` (`src/gen/loot.ts`), for example "Defense: Fire 2" and "+1 to Heal".
- [ ] One example card of each in `src/content/cards.ts` (a defense-element gem and a spell-rank card) so the forms are exercised.

## Acceptance

- [ ] `test/sim/item-bonuses.test.ts`: a worn item with a defense Fire 2 modifier makes the wearer take Fire hits as `elementLevel` 2 Fire; unequipping restores the spec element; two sources use the higher level.
- [ ] A spell-rank modifier raises `rankOf(unit, spellId)` by its rank, never past `MAX_RANK`, and does nothing for a spell the unit lacks; an elite upgrade on that spell reads the raised rank.
- [ ] `saveItem` then `loadItem` of an item and a card carrying both forms returns equal `bonuses`; an old-save item without them loads.
- [ ] `test/sim/cards.test.ts`, `test/sim/save.test.ts`, `test/sim/bosses.test.ts` and `test/gen/balance.test.ts` pass unchanged.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

Size M: about 5 files and 300 lines. Blast radius is medium to high (`Modifier` union and `deriveStats` are core) but small and additive; uncertainty low since `CheckSkillRank` is the model.

## Notes for the worker

- Append union members and result fields; do not reorder them, because other nodes narrow on `'base' in m`, `'stat' in m` and so on.
- Add the cards to the end of `CARDS`. Do not add a loot draw: cards drop by `rollCards`, and a longer card list shifts `rng.pick`. If the example cards must not drop, build them outside the dropped pool (tests and `ie-cards` place them).
- Do not edit job modules. If `rankOf` needs a job-hooks change, write `contracts/<name>.change-request.md`.

- Overlap settled at the wave-2 checkpoint: cc-el-defense owns the defense element Modifier form and how it is applied. If a step above still says otherwise, follow cc-el-defense.

## After the splits

- After split-unit: the Unit logic lives in `src/sim/unit/` (movement, casting, statuses, gear, combat, kit). Edit the module listed under `shared:`, keep new per-unit state in a WeakMap in your own module, and leave `src/sim/unit.ts` alone.
