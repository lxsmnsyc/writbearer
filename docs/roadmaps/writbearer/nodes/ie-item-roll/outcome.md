# Outcome: ie-item-roll

## Built

- `Item.element` and `Item.elementLevel` (`src/sim/item.ts`); `ItemSave` carries both, optional (`src/game/save.ts`). The effect is built from the fields by `elementEffect` (`src/sim/item-element.ts`) in `refreshCards` (`src/sim/unit/gear.ts`), not stored on the item, so item copies stay plain data. Old saves load with no element.
- `src/gen/loot.ts`: Rare weapons, and Rare Head/Body/Cloak/Boots, roll an element with 40% chance (Fire, Frost, Storm, Earth, Venom; armor level 2 with 30%, else 1). A weapon sets the wearer's `attackElement` while worn; armor adds a `{ defense, level }` bonus. The name reads "Grave Fang (Fire)"; the tooltip adds "Attacks with Fire" or "Defense: Frost 2".
- `SimEvents.CheckItemRoll` (`src/sim/events/ie-item-roll.ts`, one line plus one map name in `src/sim/events.ts`). Payload `{ base, itemLevel, quality, scale, affixCount }`; `scale` starts at the quality's base scale, `affixCount` is null (roll as usual) or a Rare's total (clamped 0 to 6). Emitted from `rollItem` after quality, before rolls, when a `sim` is passed.
- `rollItem` and `rollDrops` take an optional trailing `sim`. Every caller with the game or sim in reach passes it: kill drops, chests (`pickups.ts`), rewards (`rewards.ts`), events (`scene.sim`) and bench recipes (`Recipe.make`, `craft`, `smith.ts` passes `g.sim`).
- `test/gen/item-roll.test.ts` (10 tests), `.changeset/ie-item-roll.md`.

## Deviations

- Element draws use their own RNG seeded from the item's rolls, not the caller's stream, because any extra draw would shift every later item in the stream. The stream and all other fields are identical to before (digest test).
- Outside owned paths: `src/sim/unit/gear.ts` (one call in `refreshCards`), new `src/sim/item-element.ts`, `src/game/game/listeners.ts` (passes `g.sim` to `rollDrops`), `src/game/game/pickups.ts`, `src/game/game/rewards.ts`, `src/game/game/smith.ts`, `src/game/town.ts`, `src/content/events.ts`, `src/content/recipes.ts` (the sim argument only). `src/sim/item.ts`, `src/gen/loot.ts`, `src/game/save.ts` and `src/sim/events.ts` are listed as shared.
- `src/ui/items.tsx` unchanged: the tooltip lines come from `itemLines`.

## Stubs left

- No `rollItem` caller is left without `sim` (grep found none besides tests).
- The rank-restart audit from ie-item-bonuses (state in upgrade `setup` closures) is not done; no item rolls the `{ spell, rank }` form yet.

## Gotchas

- `affixCount` overrides only Rare totals; Magic items ignore it.
- A weapon element restores the previous `attackElement` on removal, so an Endow active at the same time can be overwritten.

## Verification

- `pnpm vitest run test/gen/item-roll.test.ts` passes (10 tests).
- Fast check: see the orchestrator report.

## Size

- Estimated M, actual M.

Landed as 90cd483 on batch/writbearer.
