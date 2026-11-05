# Outcome: bp-roll

## Built

- `src/content/bosses/`: `types.ts` (`BossDef`), `index.ts` (`BOSSES`, `POOLS`, `BOSS_ROLL`, `rollBoss`, `resolveBoss`, `spawnBoss`), `shared.ts` (`atHealth`, `call`, `party`), and one def per boss: `brood-mother.ts`, `gatekeeper.ts`, `abbess.ts` (also `SANCTIFIED`, `LITANY`, `CALL_FLOCK`), `hollowed-saint.ts`. `src/content/bosses.ts` is a barrel for the old import path (`spawnBoss`, `CLEAVE`, `LUNGE`, `LITANY`, `SANCTIFIED`). `brood.ts` unchanged.
- Pools (fixed): Marches broodMother, drownedReeve, lanternEater; Rift Road gatekeeper, siegeCrew, bridgeWarden; Undercroft abbess, ossuaryBishop, drownedChoir; Sunken Crown hollowedSaint, usurper, facelessRegent. Unbuilt ids resolve to the first built id of their pool (always the first, which is built).
- `rollMap` (`src/game/game/route.ts`) rolls the boss on `streams.area(1, Stream.Map, BOSS_ROLL + layer)` and sets `MapNode.boss` on the last node. The map's own stream, its nodes and `RunStreams.save()` do not change. `buildStage` passes it as `AreaPlan.boss`; `generateArena` stores `Stage.bossId`; `enterStage` calls `spawnBoss(..., stage.bossId)`. A stage without `bossId` (old save) gets the layer's first boss.
- The map shows the boss's name (`nameOf` in `src/ui/map.tsx`). `view.ts` builds its boss figures from `BOSSES`; `MONSTER_ORDER` appends registered bosses that are monster kinds.
- Tests: `test/sim/boss-pool.test.ts`, `test/game/boss-roll.test.ts`.

## Deviations

- `BossDef.template` points at `MONSTERS[id]`; the templates were not moved out of the faction modules (the `MonsterKind` type and every spawn use that table).
- `BossDef.field` is not in the interface: its type `BossFieldRun` comes from the boss-field contract (bp-ground). bp-ground adds it.
- `def.arena` exists but nothing calls it yet; bp-ground wires it in `arena.ts`.
- `rollBoss` has an optional 4th argument `built` and `resolveBoss` is exported, so tests can check the fallback and all-twelve reach before the other bosses exist.
- Extra shared edits: `src/gen/stage.ts` (passes `plan.boss` to `generateArena`), `src/game/compendium.ts`, `src/render/view.ts`. Cards, bestiary text and icons of the four stay in `cards.ts`, `bestiary.ts`, `icons.ts`; the defs point at them.

## Stubs left

- Eight pool ids have no def (bb-* nodes add them).

## Gotchas

- `src/content/bosses.ts` and `src/content/bosses/` sit side by side; `'../content/bosses'` resolves to the file. Import `.../bosses/index` in new code.
- A new boss kind needs its `MONSTERS`, `BESTIARY` and `CARD_BY_MONSTER` entries and an `ICONS` key (all keyed by kind), then a def in `BOSSES`. It then reaches the map, the figure table and `MONSTER_ORDER` by itself.
- Stage snapshot unchanged; stages without `plan.boss` are identical.

## Proposed learnings

- None.

## Verification

- `pnpm typecheck`, `pnpm lint`: pass. `pnpm test`: all pass except timeouts under load from other workers (boss.test, spawn.test, flow, fields); each passes when rerun alone. Brief's verify files pass. e2e not run.

## Size

- Estimated M, actual M.
