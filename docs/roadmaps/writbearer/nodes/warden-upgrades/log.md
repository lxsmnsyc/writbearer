# Log: warden-upgrades

- Verify command had no test file yet: nothing built before this node.
- oxlint `import/no-cycle` forbids upgrades.ts importing from ./index (index imports upgrades). Split the Warden's spells, innate and statuses out of `index.ts` into `spells.ts`, as duelist and sellsword do; `index.ts` re-exports them (`export * from './spells'`), so existing imports keep working. `INTERPOSE_SHARE` is now exported.
- Living Shield, read as: the bearer is still spared 70%, but the Warden takes only 40% of the hit, and what it takes becomes Ward (capped at 50% of max health). The other reading (share drops to 40%, bearer takes 60%) weakens the "soak" build doc 16 describes.
- Trap Field: a `trapField` zone (no new trap kind), so `src/sim/trap.ts` is unchanged. An enemy is tripped each time it steps in from outside.
- Never Surprised needs the game layer: `src/game/objective.ts` calls `springAmbush` (trap at the stage entrance) and `ambushersArrive` (1 s stun per wave), and `src/game/game/route.ts` `layerMap` skips `seenAs` while `seesAmbushes(sim)`. Signposts still show an Ambush as a Camp (doc 16 says "on the map").
- Doubt: the Never Surprised trap sits at the entrance, as doc 16 says, but the ambushers come from round the fire, so it often stays unsprung. It lasts 60 s.
- Read the Room's area reveal keys on `sim.area` (party carries over in one Sim). Its first tick after setup also reveals.
- Blood Debt reads the target's max health before the blow: death clears statuses and recomputes stats.
- Retaliate: a free basic attack via `strike`, only on a foe within reach + 0.5, never for DoT ticks.
- Review (PR #11): the Tether test now checks the dash (the Warden leaves x 4; the test fails with `landBy` removed) and the 1.3x speed. The designer confirmed the Living Shield reading and kept Retaliate's reach limit; both are recorded in the outcome's Deviations.
