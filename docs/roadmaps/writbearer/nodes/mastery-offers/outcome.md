# Outcome: mastery-offers

## Built

Mercs get their elite upgrades during a run. An offer is 3 cards and the player picks 1.

- `src/game/mastery.ts`: `UpgradeOffer` (`title`, `cards`), `Card` (`merc` = index in the party's mercs, `upgrade` = upgrade id or `null` for shards), `waystationOffers(mercs, rng)`, `masteryOffer(mercs, rng, n)`, `takeCard`, `cannotTake`, `loadOffers(saved, mercs)` (drops cards that fail `cannotTake`, and offers left empty, so a stale save cannot pause the game), `offersAt`, `OFFER_CARDS` (3), `SHARD_CARD` (2), `BONUS_SHARDS` (1). The shard card also covers a merc whose job has upgrades not built yet, not only one with all 4 slots full. It draws with `offerUpgrades`, so unbuilt upgrades and spells that hold one are skipped. A merc with no upgrade left gets a card of +2 shards (a Waystation offer for it is that one card).
- Waystation: `visitStation` (`src/game/game/station.ts`) calls `openOffers` the first time the bearer meets the post, in the Waystations of phases 2 to 4 only (`offersAt`, layers 1 to 3); endless Waystations after phase 4 offer nothing. Each living merc gets an offer from `g.streams.area(1, Stream.Loot, 2000 + stageIndex)`. The run is saved at that moment (`persist`), so the offers are in the save. `pickCard(g, i)` takes a card of the open offer.
- Mastery: `Reward` gains `mastery` at the end (`src/gen/graph.ts`), with name "Mastery", a `REWARDS` entry whose `done` opens one offer of always 3 cards for 3 different living mercs (a met bonus challenge adds 1 shard to the merc whose card is picked; `BONUS_PAYS`: "The merc you pick gains a shard."), a map icon (`mastery`, laurel crown, in `src/ui/icons.ts`) and a signpost text. Its draw is `3000 + stageIndex` on the Loot area stream.
- Road draw: `rollMastery` runs after `rollMutators`, the last RNG draws of `generateLayerMap`. Each fight node draws once with chance 0.2 and, if no sibling at its fork already pays Mastery, takes it in place of its reward. The first draw (`REWARDS` array) is unchanged, so every other part of a seed's map stays the same; only the rewards of nodes that turn to Mastery differ.
- Save: `RunSave.offers?` (optional, `SAVE_VERSION` unchanged). `snapshot` writes it when an offer is open; `reset` reads it back through `loadOffers` and marks the layer as already offered so the Waystation does not draw again.
- UI: `src/ui/upgrade-offer.tsx` (a centered panel with the cards, no close button). `GameState.paused` is true while an offer is open, so the game waits for a pick. `Game` exposes `offer`, `mercsOf()` and `pickCard(i)`. The panel rides the existing `onChange` version signal, so no new hook.
- Tests: `test/game/mastery.test.ts` (9 tests): 3 upgrades per living merc, determinism, applying a pick, the shard card, Mastery cards for 3 different living mercs, a dead merc's card refused, offers surviving a JSON round trip, the real Vanguard's built upgrades offered, and `mastery` on the map at most once per fork.

## Deviations

- Files outside the brief's owned and shared paths, each with a small change: `src/game/game.ts` (`offer`, `mercsOf`, `pickCard`), `src/game/game/state.ts` (`offers`, `offeredAt`, and `paused`), `src/game/game/run.ts` (read offers back on resume), `src/ui/map.tsx` (`REWARD_ICON` entry) and `src/render/draw/exits.ts` (`REWARD_SIGN` entry; both are `Record<Reward, ...>` and fail to compile without it).
- The brief hooks the Waystation in `visitStation`, so offers open when the bearer walks to the post, not on entering the area.
- The brief's note says to use a test job. The registry now reads `JOBS`, so tests swap `JOBS.vanguard.upgrades` as `test/sim/builds.test.ts` does, and one test uses the real Vanguard.
- Mastery and Waystation draws use area streams (a fresh RNG from seed and area id), not a stateful stream, so they leave the saved stream states untouched.

## Stubs left

- None.

## Gotchas

- The exported type is `UpgradeOffer`, since `Offer` is the recruit type in `src/content/recruits.ts`.
- A Mastery offer opens when the fight is won, in mid-area. Saves are taken on entering an area, so quitting before picking returns to the area entrance, where the fight is fought again and the same cards come up. Only a Waystation offer is saved open.
- Cards refer to a merc by index in `g.mercs()`. An offer must be resolved before the party changes, which holds because it pauses the game.
- The Waystation's offers are drawn from the party at the first visit. Mercs hired later in that area get none.
- A run saved mid-layer before this change may see fights ahead turn into Mastery roads after the update (the changeset says so).
- Mastery chances are first guesses (0.2 per fight); roster-balance should check how often a run meets it.

## Proposed learnings

- New RNG draws for a map go after the last existing draw of `generateLayerMap`, or seeds change | keeps saved and shared seeds stable | src/gen | no
- Draws that must repeat after a load use `streams.area` with an id offset, not a stateful stream | the draw needs no saved state | src/game/game | no

## Verification

- `pnpm vitest run test/game/mastery.test.ts`: 9 passed.
- `pnpm typecheck` and `pnpm lint`: pass. `pnpm test`: 68 files; one run all green apart from timeouts (a different file each run, `concealment.test.ts` and `spawn.test.ts`), which pass alone. The machine was loaded by the other worktree.
- Review round: `pnpm typecheck`, `pnpm lint`, `pnpm test` (68 files, 677 passed) pass. `pnpm test:e2e`: 22 passed, 2 failed (`save.spec.ts`, `compendium.spec.ts`, the stale ones PR #16 fixes). `e2e/waystation.spec.ts` now takes a card for each merc at the phase 2 post and checks the upgrade shows on the merc's Spells tab.
- No e2e reload test: a saving run reaches a phase 2 post only after 8 areas of play (a run with `party` or `area` options does not save). Instead `test/game/mastery.test.ts` drives `visitStation` and `pickCard` on a stand-in state: same cards for the same run, one draw per post, none after phase 4, and offers kept through a JSON round trip.

## Size

- Estimated M, actual M.
