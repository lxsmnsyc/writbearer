# Content rules

- Keep a job's spells in `jobs/<kind>/spells.ts` (Vanguard, Ranger and Cleric: `src/content/<kind>.ts`); `upgrades.ts` imports from there, never from `./index`, because `index.ts` imports `upgrades.ts` and `import/no-cycle` fails.
- Keep passive state that must last a fight in a module `WeakMap<Unit, ...>`, not a local in `setup`, because spending a shard (`raise` -> `startEffect`) stops the passive and runs `setup` again.
- Key once-per-area or once-per-stage effects on `sim.area`, not on unit identity, because the party's units carry over between areas in one Sim (`carryParty`).
- Pick enemies for conditions, victims and areas through `hostiles`, `allowed` or `canTarget` (`src/sim/targeting.ts`), not `sim.living(Side.Monster)`, so a Duel and later CheckTarget rules hold.
- Put run-long counts for a merc in `Unit.tally` under a prefixed key (`habit.<kind>`), because `MercSave.tally` already saves and loads them.
- Read an upgrade's rank from its base spell (`rankOf(u, 'heal')`), because upgrades have no rank of their own.
- To tell a spell's own hits in an effect, wrap the base `release` in the patch and mark the caster in a WeakSet inside try/finally, because a flag set on `UnitSkillRelease` Pre stays set when a later listener disables the event.
- When a test fakes a unit's max health, count damage with a `UnitDamage` listener instead, because a status change or death recomputes stats and restores the old value.
