# Outcome: split-game

## Built

`src/game/game.ts` went from 2,652 lines to 402. The `Game` class is now a facade. It owns one `GameState`, the browser listeners and the frame loop, and passes each public call to a feature module in `src/game/game/`. The public interface is the same: every public method, getter and export keeps its name and signature. `pack`, `vault` and `compendium` were fields and are now accessors (`pack` has a setter).

How the pieces fit:

- `src/game/game/state.ts`: `GameState` (default export). It holds every field the class had, all public, with the same names. It also holds the helpers many features share: `paused`, `saving`, `startsAtGuild`, `hasFighter`, `priceOf`, `say`, `itemsChanged`, `mercs`, `select`, `openInventory`, `scatter`, `goFor`. Shared constants live here too: `PARTY_SIZE`, `START_GOLD`, `MEET_REACH`, `LEAVE_REACH`, and the `Wanderer` type (it replaces `Game['seeking']`).
- Feature modules export plain functions that take the state as `g: GameState`. Code that was `this.x` is now `g.x`.
- `game.ts` re-exports `PARTY_SIZE`, `START_GOLD`, `sidesToward` and the types `GameHooks`, `GameOptions`, `EventView`, `ComingGroup`, `BonusStatus`, so no import path changed.

Where each feature lives:

| Module         | What it holds (old `Game` members)                                                                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`     | `GameHooks`, `GameOptions`, `EventView`, `ComingGroup`, `BonusStatus`                                                                                                                                                                                                                   |
| `run.ts`       | `reset` (start or resume a run, pick the start place), `resumeArea`, `setSeed`, `setEndless`, `shareLink`                                                                                                                                                                               |
| `saving.ts`    | `snapshot`, `persist`, `endRun`                                                                                                                                                                                                                                                         |
| `listeners.ts` | default `watchSim`: the sim listeners `reset` hung (heavy-hit stop and shake, revive, deaths and kill drops, key drops), plus `shareXp`                                                                                                                                                 |
| `route.ts`     | layer map and roads: `here`, `aheadOf`, `fightsAhead`, `rollMap`, `biome`, `region`, `goTo`, `buildStage`, `sidesAhead`, `pickMiniBoss`, `layerMap`, `sidesToward`                                                                                                                      |
| `areas.ts`     | moving between areas: `enter`, `leave`, `joinArea`, `workGround`, `blockRoad`, `seam`, `cross`, `settleBehind`, `collapse`, `descend`, `buildWaystation`; `moveOn` is the tick's cross, settle and fade step; `names`; `TOMB_STREAM`, `GUILD_STREAM`, `WAYSTATION_STREAM`, `COLLAPSE_*` |
| `fight.ts`     | `objectiveStatus`, `exitsOpen`, `checkObjective`, `soundAlarms`, `relieve`, `reportArea`, `directorStatus`, `noteMonsters`                                                                                                                                                              |
| `rewards.ts`   | `REWARDS` table, `BONUS_PAYS`, `spoilsOf`, `cardHere`, `layChest` (the chest and gold laid when an objective is done), `materialList`                                                                                                                                                   |
| `pickups.ts`   | `drop`, `loot` (ground pickups and chest opening), `pickUp`, `pickItem`, `chestAt`, `PICK_REACH`                                                                                                                                                                                        |
| `walkups.ts`   | `WALK_UPS` table (key, levers), `workWalkUps` (was `workMaze`), `openGates`                                                                                                                                                                                                             |
| `encounter.ts` | Events: `beginEvent`, `figures`, `eventView`, `visitEvent`, `chooseEvent`, `closeEvent`                                                                                                                                                                                                 |
| `recruits.ts`  | `hire`, `endTalk`, `join`, `meet`, `recruitAt`                                                                                                                                                                                                                                          |
| `station.ts`   | Waystation post, Town well, Camp fire: `visitStation`, `visitTown`, `closeStation`, `closeTown`, `rest`, `dues`, `pay`, `store`, `takeOut`                                                                                                                                              |
| `smith.ts`     | `smithable`, `refineItem`, `socketItem`, `craft`, `salvage`, `raise`, `buy`, `sell`                                                                                                                                                                                                     |
| `tomb.ts`      | `breakSeal`, `endFinale`, `FINALE_KEYS`                                                                                                                                                                                                                                                 |
| `shouts.ts`    | `shout`, `shoutBar`, `enemyAtPointer`, `SHOUT_KEY`                                                                                                                                                                                                                                      |
| `input.ts`     | `keyDown` (gets the `Game` to call its public methods), `mouseMove`, `mouseDown`, `exitAt`, `steer`                                                                                                                                                                                     |
| `tick.ts`      | `advance` (one frame: pause, hit-stop, fixed ticks) and `step` (one tick, every per-tick check in the old order); `MAX_FRAME`                                                                                                                                                           |
| `render.ts`    | default `render`: the `Frame` passed to the renderer, and the canvas `dataset` for e2e                                                                                                                                                                                                  |

Registration points:

- Rewards (mastery-offers): `REWARDS: Record<Reward, RewardDef>` in `rewards.ts`. A `RewardDef` has `fill(c: ChestFill)`, which adds to the chest as it opens, and an optional `done(g, better)`, which runs the moment the objective is done, before the chest is laid. Respite's heal and revive is its `done`. When `mastery` is appended to `Reward`, the compiler asks for a `REWARDS` entry and a `BONUS_PAYS` line. An offer that opens when the chest opens goes in `fill`. One that opens when the fight is won goes in `done`.
- Walk-up props (gs-terrain-braziers, gs-terrain-hazards plates): append a `WalkUp` (`(g) => void`) to `WALK_UPS` in `walkups.ts`. Each one runs every tick while the bearer lives, in the old `workMaze` slot: after `visitEvent`, before `noteMonsters`. Use `PICK_REACH` from `pickups.ts`, or a reach of your own.
- Per-tick systems (rocks, the lantern, the BossField): add one call line in `step` in `tick.ts`. Its order is the update order, so add new lines where the brief says and do not reorder the old ones. `wakeBoss` is in `step` too: arm a boss field in its `if` block.
- Per-area setup (props or drivers an area builds as it is entered): `enter` in `areas.ts`. Hazards are built there today.
- Plan of the next area (bp-roll's boss id, new node kinds): `buildStage` in `route.ts`. RNG draws must go after the existing ones.
- Render inputs (gs-terrain-lantern's `dark` number): the `Frame` literal in `render.ts`.

## Deviations

- None in scope. Only `src/game/game.ts`, the new `src/game/game/` and this node's folder changed. No test, UI file or import path changed.
- The old comment "Which edges each area's exits leave by, rolled apart from its layout" stood above unrelated constants and described nothing, so it was dropped.
- `loot`'s and `pickUp`'s ground-item variable `g` was renamed `item`, and the shout loop variable `shout` was renamed `s`, since `g` is now the state.

## Stubs left

- None.

## Gotchas

- Feature modules may not import each other in a cycle: oxlint's `import/no-cycle` fails the lint. Shared helpers go on `GameState` (as `scatter` did) or in a leaf module (as `saving.ts` did). `input.ts` imports `Game` only as a type.
- oxlint's `prefer-default-export` fails a module with a single export. That is why `listeners.ts` and `render.ts` use default exports.
- No unit test builds a `Game`: it needs a canvas. Only e2e covers this code. Run `pnpm test:e2e` after merging this node.
- `GameState` fields are public. Keep the state's fields and helpers apart from `Game`'s public interface: the UI sees only `Game`.

## Proposed learnings

- A feature of `Game` goes in its own module under `src/game/game/`, as functions over `GameState`, with a one-line delegation on `Game` if the UI calls it | keeps game.ts small, so parallel nodes do not conflict | src/game/game | no
- Adding a kind of reward or walk-up prop means adding an entry to `REWARDS` or `WALK_UPS`, not a branch | the tables are the registration points | src/game/game | partly (`Record<Reward, ...>` makes the compiler check rewards)

## Verification

- `pnpm typecheck`: pass. `pnpm lint`: pass. `pnpm test`: 56 files, 436 passed, 24 skipped (the same as the baseline). `pnpm build`: pass.
- Baseline on the untouched tree: one run had 7 failing files under load from the other worktrees, the next run was all green. The failures look like timeouts.
- A script compared every line of the old game.ts with the new code, after rewriting `this.` as `g.` and stripping spaces. The only lines missing were declarations, `this.method()` calls that are now `fn(g)`, and the renames listed above.
- `pnpm test:e2e` was not run (port 5199); the orchestrator runs it after merging.

## Size

- Estimated L, actual L.
