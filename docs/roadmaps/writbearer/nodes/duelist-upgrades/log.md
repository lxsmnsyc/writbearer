# Log: duelist-upgrades

- Branch renamed to feat/duelist-upgrades, reset to main at cfabd20. Upgrades were all placeholders (designedUpgrade), so nothing was fulfilled.
- Built all 12 in `src/content/jobs/duelist/upgrades.ts`. Patches that add to a spell call the base spell's `release` from `spells.ts`; nothing in `spells.ts` changed.
- Feint and Bleed Out need to know which hits are the spell's: their patches wrap the base release and mark the caster in a WeakSet while it runs (try/finally), and the effect listeners read it.
- Feint undoes the core block: stashes the value after the Reduce step and restores it at Block (core Block runs first, it was registered with the sim).
- Untouchable test: Riposte parried some forced misses first and countered; the test stops the Riposte passive.
- Fast check passes: 65 files, 572 tests.
