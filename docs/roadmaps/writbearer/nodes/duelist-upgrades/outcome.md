# Outcome: duelist-upgrades

## Built

- `src/content/jobs/duelist/upgrades.ts`: the 12 elite upgrades, each with a patch, an effect or both, 3 per spell. Exports `ASSASSINS_MARK`, `SIDESTEPPING` and `SMOKED` (statuses, for tests and later UI). Numbers are first guesses.
- `test/sim/duelist-upgrades.test.ts`: 13 tests, one per upgrade plus the count check.
- `.changeset/duelist-upgrades.md` (minor).

The upgrades:

- Duel
  - Grand Duel: patch, the bond lasts until one dies (duration `Infinity`). Effect: +50 crit rate (points, CheckHit Additive) on blows at the partner.
  - Crowd Pleaser: effect, a Tick listener; while the Duelist is bound, each living party merc except the bearer gains 1 morale a second (`shiftMorale`).
  - Taunt the Proud: patch with its own `aim` (nearest aware, targetable elite within 6 tiles, neither bound) and `wants`. The Duel begins at once on release; the bond then makes the elite walk to the Duelist.
- Shadowstep
  - Flourish: patch, if the step's strike killed the target: +15 mana, +1 morale to the Duelist, cooldown reset to 0.
  - Smoke Step: patch, a `smoke` zone (r 1, 3 s) on the start point, and the SMOKED status on the Duelist for 3 s: CheckTarget refuses any enemy but its Duel partner. Only when the step moved the Duelist.
  - Assassin's Mark: patch, puts ASSASSINS_MARK (10 s) on the target. The Duelist's next 3 blows on it (not DoT ticks) deal 20% more, at DamagePriority.Amplify. `power` holds the blows left.
- Lunge
  - Feint: patch marks the thrust; effect undoes the shield block on it (value stashed after Reduce, restored at Block, `Blocked` flag cleared). No Flank flag is added.
  - Sidestep: patch, after the thrust the Duelist steps 0.8 tiles aside and gets SIDESTEPPING for 3 s: -30 hit chance on hits at it (CheckHit Additive, like BLIND). Read "+30% evasion" as 30 points of hit chance.
  - Untouchable: effect, on UnitMiss with the Duelist as target, if Lunge is off cooldown, the Duelist is not casting (a basic-attack swing in progress is cancelled) and the attacker is targetable and within 4 tiles: Lunge's base release at the attacker, free, forced to hit as a critical (CheckHit Post); Lunge's cooldown then starts.
- Flurry
  - Bleed Out: patch marks the Flurry; effect adds BLEED (power 1 + 0.2r, so 1.2% max health a second at rank 1, 4 s, True) on each critical Flurry hit.
  - Thousand Cuts: effect, each blow in a row on the same target adds 3%, capped at 20 blows (+60%); a blow on another target resets. Counts all the Duelist's blows (basic and spells), not DoT ticks.
  - Whirlwind: patch, 4 rounds; each round hits every foe from `areaVictims` within 2 tiles of the Duelist once, at the Flurry ratio, flags Skill | AoE. Wanted when any foe is within 2 tiles.

## Deviations

- `test/content/jobs.test.ts` (not in the owns list): added the Duelist line to the "all built" check next to the Arcanist's, as the job-registry test asks each upgrade node to.
- Thousand Cuts has a cap of 20 blows that doc 16 does not give; without it a Grand Duel on a boss grows without limit. The describe text says so.
- Untouchable needs Lunge off cooldown and starts it; doc 16 sets no limit, but without one every evade would fire it.

## Stubs left

- No drawing for the `smoke` zone: `ZONE_LOOKS` has no entry, so the default ring and dot are drawn. A look would go in `src/render/zones.ts` (shared, not owned here).

## Gotchas

- A parry fires UnitMiss on the Duelist, so Untouchable also fires after a Riposte parry. Tests that force misses must stop the Riposte passive (`duelist.passives.get('riposte')?.stop()`), or a forced hit at Post lets Riposte parry and counter.
- Grand Duel's status has `remaining = Infinity`. It ends only through `endsWithSource` (a death) or `removeStatus`.
- Smoke Step forbids the Duelist as a target even for its Shadowstep victim, which turns aware after the strike.
- Feint relies on its Block listener running after every blocking listener; the core one is registered when the Sim is built, so it runs first, but a blocking listener added later at DamagePriority.Block would still block a Feint. A comment in the code says so.

## Proposed learnings

- To tell a spell's own hits from others in an effect listener, wrap the base release in the patch and mark the caster in a WeakSet with try/finally | a flag set on UnitSkillRelease Pre and cleared on Post can stick if a later listener disables the event | src/content/jobs | no

## Verification

- `pnpm vitest run test/sim/duelist-upgrades.test.ts`: 13 pass.
- `pnpm vitest run test/content/jobs.test.ts`: pass.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (65 files, 572 tests, 24 skipped).
- `pnpm test:e2e` not run, by instruction.

## Size

- Estimated L, actual L.
