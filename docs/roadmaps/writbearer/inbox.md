# Inbox

Design items with no node yet, from `COVERAGE.md`. Decide at a checkpoint whether each becomes a node or is dropped.

- Aegis "the citizen always has a Ward refilled outside combat" (09#Cleric): built as a 3 s refill out of a fight. Decide whether that matches the design or needs a node.
- "Surface Temple = the Church" (10#World / structure): an open lore choice. Needs a design decision, not code.
- Ranged monsters shoot from 6 tiles and step back (13#Elite affixes): survey says built. Confirm, then mark built in COVERAGE.md.
- Overpay at the Waystation (paying a merc more than its wage): not designed. Hazard Pay, Paid in Full and Haggler return as Sellsword upgrades if it is built (doc 16).
- Arcanist elements: if Elemental Sense proves hard to build or balance, split Fire and Frost into separate jobs, or rework the elemental damage calculation (maintainer, 2026-10-27).
- A Ranger raised to the monster side by the Creditor still chains Charged Arrow among its own side. Guarding it makes `creditor.test` too easy (3 wins of 6, limit 1). Fix together with a Creditor retune.
- Cleric parties with the Sellsword or the Duelist win the layer-1 boss only 5 and 7 of 24 seeds (roster-balance); `bosses.test` sums the layers, so it does not catch this. Tune in a later balance pass.
- `e2e/orders.spec.ts` and the first `e2e/recruit.spec.ts` test failed once in a 4.4-minute full e2e run and passed alone and on rerun (roster-balance). Watch for flakes.
- A `GameState` test harness (stubbed canvas) that calls `moveOn`, so hooks on area change (`restoreAll` from be-strippers) can be tested through the real path.
- No game monster raises corpses yet: be-corpse-raisers left no `Template` flag or `SPAWN_STEPS` entry. The first raiser monster (the Summoner of doc 07, or the Ossuary Priest in be-monsters-deep) calls `markRaiser` from its own spawn step.
- `pnpm test` failed once in 734 during the PR #26 review and passed on reruns; the failing test was not captured. Suspect `test/sim/concealment.test.ts` (5 s timeout, load-sensitive).
