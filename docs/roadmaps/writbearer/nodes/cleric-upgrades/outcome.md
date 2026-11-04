# Outcome: cleric-upgrades

## Built

- `src/content/jobs/cleric/upgrades.ts`: the Cleric's 12 elite upgrades. Numbers are first guesses; rank is the base spell's rank.
  - Ward: Cleanse (patch: Ward, then lifts harmful statuses and clears buildup), Wall of Faith (patch: Ward plus a melee-guard zone, `floor(2 + r/2)` blows, one at a time), Twin Ward (patch: `aim`/`release` shield the two most endangered allies at 60% of the pool each; alone, the one gets the full pool).
  - Heal: Renew (patch: 12 mana, 5 s, RENEWED for `8 + 3r` a second), Resurrection (patch: 30 mana, 20 s, 3 s windup; aims at a fallen merc first, raises it with `10 + 5r`% health, else heals as normal), Martyr (effect, `MARTYR`: the dead within 5 tiles rise at 20%).
  - Sacred Ground: Veil (patch: 2.5-tile ranged-guard zone for `4 + r/2` s, no heal, 18 mana, 15 s), Consecrate (patch: the base zone plus a pulse of `40 + 5r`% Radiant; also aims at 2+ enemies on the ground when no ally is hurt), Pilgrim's Rest (patch: the zone pulse also gives +2 mana, +0.5 morale).
  - Smite: Turn Undead (patch: `15 + 2r`% plus up to 30% by missing health to destroy a non-boss Undead, else Smite), Purge (patch + `PURGED` status exported: an Occult target takes +25% from the other side for 8 s), Holy Light (effect: doubles the Cleric's Sear buildup, half spread to hostiles within 2 tiles; the spread is not doubled or spread again).
- `src/content/cleric.ts`: only the 4 spells and Aegis remain, with shared helpers exported (`after`, `placed`, `bearerFirst`, `hurtCluster`, `healAmount`, `wardAmount`, `sacredHeal`, `SACRED_RADIUS`, `SMITE_REACH`, `HEAL_BELOW`). `after(u, ally)` now takes the Cleric and goes through `hostiles(u)`. The old tree skills and passives are gone from it.
- `test/sim/cleric-upgrades.test.ts`: 19 tests, one per upgrade, the kept spell and Aegis cases, and the Duel gap (Ward skips a dueled elite, Consecrate does not burn it).
- `test/content/jobs.test.ts`: the Cleric's "all built" line. `.changeset/cleric-upgrades.md` (minor).

## Deviations

- `test/sim/recruits.test.ts` (outside owned paths): deleted its renew, cleanse and raise cases and their imports, since those skills are now upgrade patches. The new test file covers them.
- Spell ranks: the spells were already at doc 16's per-rank gains except Heal (20 a rank, not 10). Left, because the existing comment says 10 fails the layer-1 boss test. Balance tests are unchanged and pass.
- Resurrection's cost, cooldown and windup apply to every Heal cast of that merc (a patch is per spell, not per target), as doc 16's "30 mana, 20 s" reads.

## Stubs left

- None. Consecrate's "corpses inside cannot be raised" waits for corpse raising, Purge's corruption removal for story-bearer (doc 16, Needs).

## Gotchas

- Upgrade ranks use the base spell id (`rankOf(u, 'heal')`), not the upgrade id.
- A zone patch finds the zone the base `release` just set with `lastZone` and wraps its `pulse`.
- Dueled elites: any new Cleric code that picks enemies should use `hostiles(u)` or `canTarget`.

## Proposed learnings

- Area effects that damage enemies filter through `hostiles(u)` | so Duel and later CheckTarget rules hold | src/content | no

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: pass (67 files, 624 passed, 17 skipped).
- `pnpm vitest run test/sim/cleric-upgrades.test.ts`: 19 passed.

## Size

- Estimated M, actual M.
