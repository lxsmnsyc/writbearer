# Outcome: split-stage-gen

## Built

`src/gen/stage.ts` went from 2,251 lines to 73. It keeps `generateStage` and `buildArea` (which picks the generator for a plan) and re-exports every name it exported before, so no importer changed. The rest lives in `src/gen/stage/`. No module imports `../stage`. They import each other directly.

| Module | Lines | What lives there |
| --- | --- | --- |
| `types.ts` | 130 | `Stage`, `AreaPlan` (types only). New `Stage` fields go here, optional. |
| `props.ts` | 92 | `PropKind` union, `Prop`, `Add`, table `SOLID` (blocking radius per prop kind), `tallFor`, and `adder(stage, rng)`, the one `add` every generator uses. |
| `exits.ts` | 112 | `Ahead`, `ExitSide`, `Exit`, `OUT`, `placeExits` (it also adds the exit torches, signposts, stair and braziers), `beyond`, `onRoads`, `Fight`, `withFightsAhead`. |
| `field.ts` | 230 | `generateField`: the open fight field, step by step (it was the body of `buildArea`). `FIELD_SIZE`, `KEEP_ENTRANCE`, `KEEP_EXIT`, `KEEP_PLACE`, `RECRUIT_CHANCE`. |
| `ground.ts` | 68 | `Patch` (kinds `'water' \| 'embers'`), table `GROUND` (counts per layer), `WATER_R`, `EMBERS_R`, `EMBERS_OFF_ROAD`, `layGround` (patches and blossoms). |
| `hazards.ts` | 37 | `Hazard`, `HazardKind` union, tables `TRAP_PERIOD` (beat per kind), `TRAPS_SHALLOW`, `TRAPS_DEEP`. |
| `packs.ts` | 299 | `Pack`, `THREAT` (threat per monster kind), `FACTIONS` with `Faction` and the sizes `SWARM`, `MIXED`, `STRONG`, `packOf`, `approachPack`, `factionPool`, `areaBudget`, `monsterLevel`, `siteKeepers`, `lairPack`, `PACK_DISTANCE`, `ELITE_FROM`, `placePacks`, `rollAffixes`, `shoots`, `appointCaptains`. |
| `waves.ts` | 125 | `Wave`, `Mob`, `buildWaves`, `buildMobs`. |
| `bosses.ts` | 133 | `BossCard`, `bossHand`, `dealBosses`, `leadLastWave`, `clearAround`, `standMiniBoss`. |
| `spots.ts` | 118 | `KeyPoint`, `laySpots` and its constants. |
| `objectives.ts` | 101 | `RITE_TIME`, `RITE_REACH`, `Rite`, horn posts (`layPosts`, `placeHorns`), `refugeesAt`, `markHunt`. |
| `vault.ts` | 69 | `Vault`, `layVault` (the strongroom, its door, cleared ground), `vaultTraps`. |
| `collapse.ts` | 55 | `Collapse`, `floorOf`, `collapseFor`, `COLLAPSE_*`. |
| `reach.ts` | 63 | `rectOf`, `navFor`, `holesOf` (chasm cells, `CHASM_R`), `solidsOf`, `ensureReachable`, `reaches`, `distanceToSegment`. |
| `arena.ts` | 89 | default `generateArena`: the boss field (`BOSS_WIDTH`, `BOSS_DEPTH`, `BOSS_CLEAR`). |
| `maze.ts` | 361 | `Gate`, `openGate`, `GATES_DEEP_FROM`, `generateMaze` (the Labyrinth). |
| `havens.ts` | 181 | `smallField`, `edgeTrees`, `generateWaystation`, `GUILD_RECRUITS`, `generateGuild`, `generateTown`, `generateCamp`, `generateEvent`. |
| `ambush.ts` | 55 | default `generateAmbush`. |
| `tomb.ts` | 57 | default `generateTomb`. |

Tables a later node adds an entry to:

- A prop kind: a member of `PropKind` and, if it blocks, an entry in `SOLID` (`props.ts`).
- A hazard kind: a member of `HazardKind` and an entry in `TRAP_PERIOD` (`hazards.ts`). The pick lists `TRAPS_SHALLOW` and `TRAPS_DEEP` are what the Labyrinth rolls from.
- A ground kind: a member of `Patch['kind']` (`ground.ts`). Counts per layer are the `GROUND` table, one row per layer with a field per kind. `layGround` still treats kinds with `kind === 'water'` and fixed `lay(...)` calls. gs-terrain-kinds turns this into one table keyed by kind.
- A monster kind: an entry in `THREAT`, and in `FACTIONS` if it is rolled into packs (`packs.ts`).
- A hole kind (deep water, cliffs): `holesOf` in `reach.ts`. `navFor` and `ensureReachable` use it.

Order of steps in `generateField` (`field.ts`): size and entrance, `placeExits`, `planFor` and `layOut` (trees, walls, pillars, chasm), site, lair, vault (`layVault`), rites, cache, wandering merc, pikes, `ensureReachable`, roads, `layGround`, `laySpots`, stains, waves or `placePacks`, reward, Hunt marks, refugees, mobs, collapse, `dealBosses` or `leadLastWave`, `placeHorns`, vault key. A new roll that must not shift existing stages goes after `placeHorns`, just before `return stage`, or on a forked stream.

Notes for the nine downstream nodes:

- bp-ground, bp-roll: the boss field is `arena.ts`. The collapse is `collapse.ts` (`floorOf`, `collapseFor`).
- gs-terrain-kinds: `layGround` and `Patch` are in `ground.ts`.
- gs-terrain-braziers: decor braziers and torches come from `placeExits` (`exits.ts`) and `arena.ts`. A ring of braziers goes in `generateField` after the existing rolls.
- gs-terrain-deep, gs-terrain-ledges: add holes in `holesOf` (`reach.ts`). Plans stay in `src/gen/fields.ts`.
- gs-terrain-grass: open-field ground is `ground.ts`. Roads are on `stage.roads`; `onRoads` is in `exits.ts`.
- gs-terrain-hazards: `HazardKind` and `TRAP_PERIOD` are in `hazards.ts`. The field build is `field.ts`.
- gs-terrain-patrols: `Pack` and `placePacks` are in `packs.ts`. The site pack is `packs[0]`, the lair `packs[1]`, the watch `packs[2]`. The roaming packs follow. `dealBosses` adds packs at boss spots after them.

## Deviations

- Besides moving code: the five identical `add` closures became one `adder(stage, rng)` (`props.ts`). Parts of the old `buildArea` became functions: the open field `generateField`, the vault block `layVault`, the collapse literal `collapseFor` and the horn block `placeHorns`. They make the same draws in the same order. The snapshot test confirms this.
- `arena.ts`, `ambush.ts` and `tomb.ts` use default exports, because the lint rule `prefer-default-export` requires one in a file with a single export.
- No file outside `src/gen/` changed, and no existing test changed.

## Stubs left

- None.

## Gotchas

- `src/gen/stage.ts` and the folder `src/gen/stage/` sit side by side. `'../gen/stage'` resolves to the file. Do not add `src/gen/stage/index.ts`.
- `src/content/minibosses.ts` imports `type Patch` from `gen/stage` while `bosses.ts` imports `MINI_BOSSES`. That works only because the first import is type-only. Keep it type-only.
- A new public name goes in its module and, if code outside `src/gen/` uses it, gets a re-export in `src/gen/stage.ts`.
- `test/gen/stage-snapshot.test.ts` hashes 171 seeded stages (open fields with every objective, arenas, mini-bosses with mutators, scale and biome, endless fields, small fields, the Waystation, the Guild, the tomb), plus boss hands and affixes. A node that changes generation on purpose updates the snapshot with `pnpm vitest run test/gen/stage-snapshot.test.ts -u` and says so in its outcome. A node that must not change stages leaves the snapshot alone.

## Proposed learnings

- When code moves without changing behavior, record a snapshot of seeded output before the move | the snapshot catches any change to the order of random draws | src/gen/ | yes

## Verification

- `test/gen/stage-snapshot.test.ts` was recorded on the untouched code (commit `split-stage-gen: Snapshot seeded stages before the move`) and passes unchanged after the split. Each of its 5 tests takes 0.4 to 1.7 s, the longest on a cold run.
- A script compared every line of the old file with the new files. The only lines missing are the removed `add` closures, the collapse literal, the horn block comment (now on `placeHorns`) and imports.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (57 files, 441 tests, 24 skipped). `pnpm build`: pass. Its warning about chunks over 500 kB does not come from this change. e2e not run.

## Size

- Estimated L, actual L.
