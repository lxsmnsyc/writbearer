# Log: be-corpse-raisers

- Checked first: nothing existed. Dead monsters leave `sim.units` only on a stage change (`src/game/stage.ts` clear, `carryParty`, `objective.ts`), so "kept until the stage ends" already holds in the sim. `standing.ts` already draws dead units where they fell, lying down by the rig's fall; only torn ones are hidden.
- Built `src/sim/raise.ts`, `src/sim/ai/raiser.ts`, one step in `MONSTER_STEPS`, `test/sim/raisers.test.ts`.
- Skipped a Template flag and spawn step: `Template` lives in `src/content/jobs/types.ts` (not owned, other node edits it). `markRaiser(unit, spec)` is the hook; the monster that raises calls it from a spawn step.
- Review fix: raised units count in the Horde and Ambush tallies (`objective.ts` `crowd()`) and inherit the raiser's Hunt mark. Test added.
