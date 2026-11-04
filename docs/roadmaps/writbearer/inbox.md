# Inbox

Design items with no node yet, from `COVERAGE.md`. Decide at a checkpoint whether each becomes a node or is dropped.

- Aegis "the citizen always has a Ward refilled outside combat" (09#Cleric): built as a 3 s refill out of a fight. Decide whether that matches the design or needs a node.
- "Surface Temple = the Church" (10#World / structure): an open lore choice. Needs a design decision, not code.
- Ranged monsters shoot from 6 tiles and step back (13#Elite affixes): survey says built. Confirm, then mark built in COVERAGE.md.
- Overpay at the Waystation (paying a merc more than its wage): not designed. Hazard Pay, Paid in Full and Haggler return as Sellsword upgrades if it is built (doc 16).
- Arcanist elements: if Elemental Sense proves hard to build or balance, split Fire and Frost into separate jobs, or rework the elemental damage calculation (maintainer, 2026-10-27).
- Balance against doc 16: three spells stay off doc 16's numbers because the doc's values fail the layer-1 boss test (`bosses.test`): Heal +20 a rank (doc 10), Crush 10 mana / 6 s (doc 8 / 3), Charged Arrow 3.5 s cooldown (doc 2.5 s). Settle in roster-balance or cc-tuning, or update doc 16.
- A Ranger raised to the monster side by the Creditor still chains Charged Arrow among its own side. Guarding it makes `creditor.test` too easy (3 wins of 6, limit 1). Fix together with a Creditor retune.
- Sellsword `SECOND_WIND` keys on unit identity (module WeakSet), so it fires once per run, not per stage, because party units carry over between areas. Key on `sim.area` as Play Dead does.
- The Rearguard raise test in `test/sim/ranger-upgrades.test.ts` still passes with the fix reverted; the review proved the bug with a scratch test. Tighten the test.
- `e2e/recruit.spec.ts:33` picks the first non-Cleric recruit as the fighter, the cause stale-e2e fixed in `save.spec.ts`; it passes on today's seed only. Also `e2e/compendium.spec.ts:12` reads `count()` before the list renders. One small test-only fix.
- Doc 16 disagrees with the game, and the tests back the game: Heal +20 a rank, Crush 10 mana / 6 s, Charged Arrow 3.5 s, Interpose 3 tiles / 80% with a 4-tile chase cap, and Storm arrow chains at 1.5x the arrow's ratio (`CHAIN_SHARE`). Doc 09 lists them as differences (roster-balance). Update doc 16 to match.
- Cleric parties with the Sellsword or the Duelist win the layer-1 boss only 5 and 7 of 24 seeds (roster-balance); `bosses.test` sums the layers, so it does not catch this. Tune in a later balance pass.
- `e2e/orders.spec.ts` and the first `e2e/recruit.spec.ts` test failed once in a 4.4-minute full e2e run and passed alone and on rerun (roster-balance). Watch for flakes.
