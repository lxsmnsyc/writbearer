# Log: ranger-upgrades

- Nothing built before: upgrades.ts held 12 designedUpgrade placeholders; the test file had 8 skipped cases.
- Rank gains per doc 16: Piercing 15r -> 8r, Pin Down 0.5r -> 0.25r. Snare, Rod, Aimed and Charged already matched the doc table.
- Charged Arrow cooldown: doc says 2.5 s. At 2.5 s (and 3 s) bosses.test layer 1 gives 1 of 6 wins (needs 5) and boss.test gives 0 of 12 (needs 4). 3.5 s passes. Kept 3.5; the doc value is left for cc-tuning.
- Making Charged Arrow's chain pick foes with `canTarget` also moved the Creditor fight (a Ranger raised against the party chained among its own side before): creditor.test gave 3 wins of 6 where it needs at most 1. A raised Ranger keeps the old monster list for the chain; a party Ranger uses the guarded list.
- Duel: `around` and `inLineOf` go through `allowed`. The straight projectile already refuses forbidden targets (`refused` in sim.ts).
- Review fixes: passive state moved to module WeakMaps (Rearguard, Killing Ground, Overcharge); Thunderhead rewritten as a Charged Arrow patch; tests for raises, Thunderhead (fails without the patch), boss and Duel titles.
