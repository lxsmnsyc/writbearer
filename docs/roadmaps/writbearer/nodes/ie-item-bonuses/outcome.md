# Outcome: ie-item-bonuses

## Built

- `Modifier` gains `{ spell: string; rank: number }` (`src/sim/stats.ts`). `deriveStats` sums it per spell id into `StatResult.spellRanks: Map<string, number>`. The `{ defense, level }` form and its application came from cc-el-defense and are used as is.
- `rankOf` (`src/content/skills.ts`) starts from `max(1, learned) + spellRanks.get(id)`, capped at `MAX_RANK`, before `CheckSkillRank` is emitted. A spell the unit lacks (`skillRank(id) === 0`) gets no bonus. No shards, no effect on `rankCap`.
- `describe` in `src/gen/loot.ts` shows "Defense: Fire 2" and "+1 to Heal" (camelCase spell ids read as words).
- `BONUS_CARDS` in `src/content/cards.ts`: `emberGem` (Fire 2 defense) and `healingCard` (+1 Heal). Appended to `CARDS` so saves and the compendium know them. They are not in `GEMS` or `CARD_BY_MONSTER`, so no loot draw changes.
- `test/sim/item-bonuses.test.ts` (10 tests): defense Fire 2 worn and removed, higher level wins, rank bonus with an elite upgrade applied, MAX_RANK cap, absent spell, stacking, save round trip of item and cards, old item, tooltip.

## Deviations

- `MAX_RANK` now lives in `src/sim/stats.ts`; `src/sim/builds.ts` imports and re-exports it, so every importer is unchanged. `skills.ts` importing `builds.ts` made an import cycle through the job modules.

## Stubs left

- None. The example cards are not dropped anywhere; ie-cards places them.

## Gotchas

- Bonus rank on a spell the unit lacks sits in `stats.spellRanks` and `rankOf` ignores it.
- Code that reads `unit.skillRank(id)` directly (the spell panel, `raise`) does not see the bonus; only `rankOf` does.
- The bonus is capped by `MAX_RANK`, not by `rankCap(level)`.

## Proposed learnings

- Read a spell's rank through `rankOf`, not `skillRank`, in effects | only `rankOf` counts gear and listeners | src/content | no

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: pass (81 files, 775 tests, 3 skipped). `pnpm vitest run test/sim/item-bonuses.test.ts` passes. The cards, save, bosses and balance tests are unchanged.

## Size

- Estimated M, actual S to M.
