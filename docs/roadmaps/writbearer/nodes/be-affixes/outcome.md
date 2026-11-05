# Outcome: be-affixes

Written by the orchestrator from the worker's and reviewer's reports; the worker left no outcome file. PR #33, merged.

## Built

- `src/content/affixes.ts`: Storm Enchanted (`SPARK`: a hit on the elite throws a spark of 60% of its attack at the nearest merc within 4 tiles, at most one per 0.5 s), Mana Burn (`MANA_BURN`: hits drain mana equal to half the damage dealt), Teleport (`TELEPORT`: every 6 s while aware and more than 3 tiles from the bearer, a 0.8 s ground circle beside the bearer, then a blink). Storm Enchanted and Mana Burn are in `SHARED`; Teleport is not. All roll from the `layout` stream.
- `src/game/alarms.ts`: a Herald elite runs for the nearest standing horn post once its pack wakes and blows it like a Horn-Bearer. With no post it wakes the next pack every 10 s as before. A Teleport elite that has blown a post (the Horn of the Road) blinks to the next standing post with the same 0.8 s warning and blows it on landing; with no post left it uses the plain Teleport.
- `src/content/minibosses.ts`: the Horn of the Road has Herald and Teleport (was Swift).
- `test/sim/affixes-late.test.ts`: one test per affix, the herald run and the post-to-post blink.
- Doc 13 "In the game so far" and the mini-boss gimmick line updated.

## Deviations

- Regenerated `test/gen/__snapshots__/stage-snapshot.test.ts.snap`: three more entries in `AFFIXES` shift which affixes a seed rolls. Deterministic per seed.
- Edited `test/game/alarms.test.ts`: the Horn of the Road test now expects the blink warning at the next post instead of a run.
- Commit subject shortened to fit the 72-character hook limit.

## Stubs left

- None.

## Gotchas

- Any node that adds to `AFFIXES` (bp-link) changes the affix roll per seed and must regenerate the stage snapshot.

## Proposed learnings

- None.

## Verification

- Main plus the PR: `pnpm typecheck && pnpm lint && pnpm test` (801 pass), `pnpm test:e2e` 25 of 25.

## Size

- Estimated M, actual M.
