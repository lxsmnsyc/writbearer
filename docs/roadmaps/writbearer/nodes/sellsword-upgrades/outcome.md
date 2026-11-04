# Outcome: sellsword-upgrades

## Built

`src/content/jobs/sellsword/upgrades.ts` default-exports the Sellsword's 12 elite upgrades, each with a patch, an effect or both. Numbers are first guesses.

| Spell | Upgrade | How |
|---|---|---|
| Rush | Shield Rush | patch: Rush, then `TAUNTED` on the target for 3 s if the Sellsword reached it |
| Rush | Chain Rush | effect: marks Rush's target on `UnitSkillRelease` Pre; if it dies within 2 s, releases Rush again, free, at `RUSH.aim` (the next enemy going for the bearer). Chains again on another kill |
| Rush | Knock Aside | patch: Rush, then pushes the target 2 tiles straight away from the bearer, in 0.25-tile steps that stop at an unwalkable tile |
| Pocket Sand | Bribe | patch: cost 12 mana, `aim` picks the nearest non-elite Human monster within 4 tiles the party can pay for. Release pays `bribeGold` (10 + 4 per level) from `sim.purse` and adds `BRIBED` (flees, 3 s). On its last tick the unit is set `alive = false` (cast and swing cleared) and deleted from `sim.units`. No `UnitDies` is emitted, so it drops nothing and gives no experience. effect: CheckTarget forbids targeting to and from a bribed unit |
| Pocket Sand | Play Dead | effect: `UnitDies` Pre disables the death once per `sim.area`, sets hp to 1, adds Blind buildup (Pocket Sand's amount) to enemies within 3 tiles, and adds `PLAYING_DEAD` (disables, 3 s). Monsters may not target it meanwhile (CheckTarget). When the status ends it has at least 20% health |
| Pocket Sand | Salt the Wound | effect: `UnitDamage` Amplify, x1.15 on party hits against a blinded enemy, once per hit even with two Sellswords |
| Hamstring | Low Blow | effect: `CheckHit` Additive, +25 crit rate against a blinded or slowed target (any status with `slow < 1`), on all its hits |
| Hamstring | Cutpurse | effect: `UnitDamage` Post, on any of its hits (not DoT) on a target with a buff, 15% chance of `stealBuff` |
| Hamstring | Cripple | patch: its own release; if the target was slowed before the hit, also `ROOTED` for 1.5 s. `wants` changes to "in reach and not rooted", so a second Hamstring follows to root |
| Cleave | Weapon Habit | effect: on `Tick` Post, a basic attack started this tick has its cooldown divided by 1.2 when the held weapon kind is `habitOf(unit)` |
| Cleave | Veteran of Many Wars | effect: `CheckSkillRank` Additive, + min(3, `phasesSurvived`) to Cleave |
| Cleave | Pocket Change | patch: Cleave, marking its blows. effect: `UnitDies` Pre sets `bounty = 1.5` on an enemy its Cleave kills |

Engine and game pieces:

- `Unit.bounty` (`src/sim/unit.ts`): gold multiplier on a kill, default 1.
- `Unit.tally` (`src/sim/unit.ts`): run-long counts by key. Keys used: `phases` and `habit.<WeaponKind>` (seconds fought holding that kind). Saved with the merc (`MercSave.tally`).
- `Sim.purse` (`src/sim/sim.ts`): `{ gold }` or null. With null nothing can be bribed.
- `rollDrops(rng, level, rank, bounty = 1)` and `rollGold(..., bounty = 1)` (`src/gen/loot.ts`): the gold pile is multiplied; the RNG draws do not change.
- `src/game/game/listeners.ts` (`watchSim`): sets `sim.purse` to read and write `g.pack.gold`; a Tick listener calls `survivePhase(sim)` when `floor(stageIndex / AREAS_PER_LAYER)` rises and `countWeaponUse(sim, dt)` every tick; passes `event.source.bounty` to `rollDrops`.
- Exports for tests and later nodes: `BRIBED`, `PLAYING_DEAD`, `bribeGold`, `heldKind`, `habitOf`, `countWeaponUse`, `phasesSurvived`, `survivePhase` and the number constants.

Tests: `test/sim/sellsword-upgrades.test.ts`, 23 tests: at least one per upgrade; an Ambush that finishes once its last wave units are bribed away; the save round trip of `tally`, and a save without `tally` loading; the gold bounty in `rollDrops`; and that only Sellswords get counts. `test/content/jobs.test.ts` has the Sellsword's "all built" line.

## Deviations

- `src/game/save.ts` is not in the brief's paths. It gains an optional `MercSave.tally`, written only when non-empty and read back in `loadMerc`. Without it a resumed run would forget the phases survived and the weapon habit. Old saves load (the field is optional).
- Counting starts from hire for every Sellsword, not from when the upgrade is taken, so a Veteran taken in phase 3 already counts phases 1 and 2. The counting runs in the game layer, so a headless sim test must call `survivePhase` and `countWeaponUse` itself.
- "Phase survived" means alive at the moment the run enters a higher phase. A Sellsword dead at that moment and revived later does not get it.
- "Used longest" is measured as seconds alive with a living target while holding the weapon kind.
- Play Dead is once per area (`sim.area`), the design's "stage". Low Blow and Cutpurse apply to all the Sellsword's hits, not only Hamstring's ("each hit").
- Bribe's gold price (10 + 4 per enemy level) is a first guess; the design gave none.
- No change request: every hook needed existed.

## Stubs left

- None.

## Gotchas

- A bribed unit leaves without `UnitDies`: it reads `alive === false` and is gone from `sim.units`, but no death listener runs. Objectives that keep their own unit lists (Ambush and Horde `came`, defence checks, "left" counts) read `alive`, so they count it as gone. Code that must react to it leaving has to check `alive`, not listen for deaths. Only non-elite Humans can be bribed, so bosses and mini-bosses are safe.
- `SECOND_WIND` (sellsword node) uses a module `WeakSet` and claims each stage builds new units. In the game the party's units carry over between areas in one `Sim` (`carryParty`), so Second Wind fires once per run, not per stage. Play Dead avoids this by keying on `sim.area`. Worth a fix in a sellsword follow-up.
- Weapon Habit has no attack speed stat to read: it shortens `unit.cooldown` on the tick a basic attack starts. Anything else that edits the cooldown on that same tick could stack with it.
- Chain Rush and Knock Aside call `RUSH.release`; if Rush changes how it moves, these follow.

## Proposed learnings

- Run-long counts for a merc go in `Unit.tally` with a prefixed key, not in a new save field | `MercSave.tally` already carries them through save and resume | src/sim, src/content/jobs | partly (the save round-trip test)
- Once-an-area effects key on `sim.area`, not on unit identity | units survive area changes in one Sim | src/content | no

## Verification

- `pnpm vitest run test/sim/sellsword-upgrades.test.ts`: 23 passed. The Ambush test fails with the `alive = false` line removed.
- `pnpm typecheck`: pass. `pnpm lint`: pass.
- `pnpm test` after the review fix: 65 files, 582 passed, 24 skipped. In an earlier run two unrelated files (`test/game/spawn.test.ts`, `test/sim/concealment.test.ts`) timed out under load from other worktrees; they pass on rerun.
- `pnpm test:e2e` not run (port 5199).

## Size

- Estimated L, actual L.
