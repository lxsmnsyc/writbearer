# Log: sellsword-upgrades

- Worktree was on 02bcd55; reset to main (cfabd20) before work. Nothing built yet: upgrades.ts held 12 summary-only placeholders.
- Engine reading: no attack speed stat (kit.interval only), units carry over between areas in one Sim (carryParty), phase = floor(stageIndex / AREAS_PER_LAYER) in the game, gold lives in g.pack.
- Plan: Unit.bounty (gold multiplier on a kill), Unit.tally (run-long counts), Sim.purse (party gold). listeners.ts wires purse, phase and weapon counts, and passes bounty to rollDrops. save.ts keeps tally (outside owned paths, deviation).
- Built all 12 in upgrades.ts; 21 tests in test/sim/sellsword-upgrades.test.ts. Added the Sellsword line to test/content/jobs.test.ts.
- Salt the Wound test: other Amplify listeners and later steps vary, so it compares the blind/seeing ratio at Amplify.
- Full `pnpm test`: two unrelated files timed out once under load from other worktrees; they pass on rerun.
