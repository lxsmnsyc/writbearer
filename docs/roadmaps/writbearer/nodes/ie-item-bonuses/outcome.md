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

## Review fixes

- `startEffect` (`src/sim/builds.ts`) sets passive upgrades up at `effectiveRank`. `recalc` (`src/sim/unit/gear.ts`) calls `RANK_LISTENERS` when the unit's bonus ranks change, and builds.ts restarts each upgrade effect then. `raise` and `cannotRaise` still use the learned rank.
- `effectiveRank` and `bonusRank` in `src/sim/unit/casting.ts`; `rankOf` builds on `effectiveRank`.
- UI shows the effective rank: spell panel "Rank 4 (+1)/cap", tooltips in the merc panel and the upgrade offer. Upgrade offer gating is unchanged (offers do not depend on rank; only the description text uses the effective rank).
- Intercept in `src/content/vanguard.ts` reads `rankOf`.
- `src/game/compendium.ts` counts and lists only droppable cards; `BONUS_CARDS` never drop.
- Extra files outside owned paths (deviations): `src/sim/builds.ts`, `src/sim/unit/gear.ts`, `src/sim/unit/casting.ts`, `src/ui/spell-panel.tsx`, `src/ui/merc-panel.tsx`, `src/ui/upgrade-offer.tsx`, `src/content/vanguard.ts`, `src/game/compendium.ts`.
- Tests added: a passive upgrade gets the bonus and updates on removal; Intercept reach reads the bonus. Fast check: 81 files, 777 tests pass.

## Rank restart scope

- `notifyRankChange` (`src/sim/unit/gear.ts`) passes the spell ids whose gear bonus changed; the builds.ts listener restarts only the upgrade effect on those spells. Gear for spell A never restarts the upgrade on spell B (test added).
- Gear can change mid-fight: `cannotHand` (`src/game/inventory.ts`) allows it when the bearer stands within hand reach. So a swap of gear for a spell restarts that spell's upgrade effect and resets state kept in the closure of its `setup`: Cleric `spreading` (Holy Light), Arcanist `touching`/`last` (Rimefield), `echoing`, `frozen` (Cold Snap), `burning` (Ignite), `hits` (Overchannel or Mana Flow); Duelist `held`, `answering`, `last`/`row`; Sellsword `marked`/`at`, `last`. Effects that keep state in a WeakMap (Ranger trails, rods, Vanguard FIRED, Sellsword PLAYED) keep it. Only an item that carries a `{ spell, rank }` bonus for that spell triggers this, and only the two example cards do so far. Line numbers are approximate; check each `setup` before an item roll uses the form widely.
