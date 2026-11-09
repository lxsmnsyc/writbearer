---
id: ie-item-roll
title: Rare element and CheckItemRoll hook
status: done
priority: should
type: feature
outline: false
milestone: items-economy
target:
size: M
spike: false
verify: pnpm vitest run test/gen/item-roll.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent: 263298
owns:
  - src/sim/events/ie-item-roll.ts
  - test/gen/item-roll.test.ts
shared:
  - src/sim/item.ts
  - src/sim/events.ts
  - src/gen/loot.ts
  - src/game/save.ts
  - src/ui/items.tsx
reserves: []
provides: []
depends_on:
  - on: ie-item-model
    kind: hard
    why: both edit rollItem and itemLines in src/gen/loot.ts; run after the tier swap lands
  - on: ie-item-bonuses
    kind: hard
    why: a Rare armor's element is a defense element modifier, a form that node adds
  - on: split-events
    kind: hard
    why: adds its event types in its own module under src/sim/events/
---

# Rare element and CheckItemRoll hook

## Goal

A Rare weapon can roll an attack element and a Rare armor piece a defense element, shown in its name and tooltip. A `CheckItemRoll` event lets listeners change an item's rolls before it is made.

## Context

- Source: `docs/design/06-items-inventory.md#quality` (Rare "can carry an element"), `#affixes` (CheckItemRoll). Items: `../../COVERAGE.md`, entries with target `ie-item-model`.
- Built: elements, `Unit.attackElement`, and `rollItem` with 3 to 6 Rare affixes. Not built: any element on an item copy, the hook, a roll path that sees the `Sim`.
- Hook pattern: the Check* events in `src/sim/events.ts` (`CheckSkillRank`, `CheckAttackElements`, described in `contracts/job-hooks.md`): a payload with a `value` and `ValuePriority`, emitted by the code that owns the decision, a no-op with no listener. `rollItem` has no `Sim`, so take an optional trailing `sim?: Sim` and emit only when it is set and has listeners. Proposed payload: `{ base: ItemBase; itemLevel: number; quality: Quality; scale: number; affixCount: number }` where listeners change `scale` (base roll bonus) and `affixCount`, and a second `rolls` step is not needed.
- Item shape: add `element?: Element` to `Item` and `ItemSave` (`src/game/save.ts`). Old saves have no field and load with no element. The Item copy is shared with `ie-identify-curse`, which runs after this node and adds its own fields.
- Nothing in the repo uses the hook yet; backgrounds that change rolls (the Scholar, and so on) belong to the background nodes. This node ships the hook and a test listener.

## Steps

- [ ] `element?: Element` on `Item`; set for Rare weapons (as an attack element, applied as a `setup` effect like the elite affixes in `src/content/affixes.ts`, or a modifier if `ie-item-bonuses` offers one) and Rare armor (as `{ defense, level }`, level 1 or 2). Roll it with the draws placed after every existing draw in `rollItem` (after the socket draw), and only for Rare items, so nothing else moves.
- [ ] `loadItem` rebuilds the element effect from `element`, as `effect` is rebuilt for a unique.
- [ ] `SimEvents.CheckItemRoll` and its event type in `src/sim/events.ts` (append to the lists); emit it from `rollItem` after the quality is picked and before the rolls are drawn. With no listener the draws and results are the same as today.
- [ ] Name and tooltip: an element word in `itemName` / `itemLines` for Rare items that carry one.

## Acceptance

- [ ] `test/gen/item-roll.test.ts`: over many seeds only Rare items carry an element; a Rare weapon with Fire sets the wearer's attack element, a Rare helm with Frost sets the wearer's defense element; unequipping clears both.
- [ ] A `CheckItemRoll` listener that raises `scale` raises rolled damage for the same seed; one that sets `affixCount` changes a Rare's affix count; with no listener the item equals a snapshot made before the hook.
- [ ] Existing draws do not move: a test rolls 200 items with a fixed seed and compares everything but `element` with the list from before this node.
- [ ] Save round trip for an element item; an old-save item without `element` loads.
- [ ] `test/sim/bosses.test.ts`, `test/gen/balance.test.ts` and `test/gen/loot.test.ts` pass without re-recording.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

Size M: 5 files and about 350 lines. Blast radius is medium (`Item`, `ItemSave`, events). Uncertainty is medium for the hook path, since `rollItem` runs without a `Sim`.

## Notes for the worker

- Loot RNG draws must not shift. Add the element draws last, inside `if (quality === Quality.Rare)`, so Magic, Normal and every other path draw exactly as before. A Rare with an element still uses the same earlier draws.
- If threading `sim` through `rollDrops` and the game's loot callers is large, add it to `rollItem` only and call it from the game layer's drop and shop paths; say so in `log.md`.
- Do not add identify or curse fields.

## After the splits

- After split-events: put new event types and their map entries in `src/sim/events/ie-item-roll.ts` and add one `SimEvents` line plus one name in the `SimEventMap` extends list in `src/sim/events.ts`.

## Note from ie-item-bonuses (2026-11-05)

- Gear that changes a spell's bonus rank restarts that spell's passive upgrades (`RANK_LISTENERS` in `src/sim/unit/gear.ts`), and gear can change mid-fight (`cannotHand` in `src/game/inventory.ts`). A restart resets state kept in the upgrade's `setup` closure (a grep found Cleric `spreading`; Arcanist `touching`, `echoing`, `frozen`, `burning`, `hits`; Duelist `held`, `answering`; Sellsword `marked`, `last`). Before item rolls give the `{ spell, rank }` form, audit each `setup` and move state that must survive a swap into a `WeakMap`, or block mid-fight swaps of rank gear. See `nodes/ie-item-bonuses/outcome.md`.
