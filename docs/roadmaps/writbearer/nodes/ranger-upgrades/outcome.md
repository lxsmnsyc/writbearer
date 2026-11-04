# Outcome: ranger-upgrades

## Built

- The Ranger's 12 elite upgrades, in `src/content/jobs/ranger/upgrades.ts`: Rearguard, Bait, Spike Field (Snare); Killing Ground, Storm Cell, Overcharge (Lightning Rod); Pin Down, Eagle Eye, Killshot (Aimed Shot); Arc Volley, Thunderhead, Piercing Arrow (Charged Arrow). Each is a patch over its spell, a passive it starts, or both.
- `src/content/ranger.ts` keeps the four spells and exports helpers the upgrades use: `around`, `inLineOf`, `aimedArrow`, `stormArrow`, `pierceArrow`, `plantRod`, `trap`, `snareTime`, `pinTime`, `pierceRatio`, `chargedRatio`, `rodTime`. The old stand-alone skills the upgrades came from (Rearguard, Bait, Spike Field, Killing Ground, Arc Volley, Thunderhead, Killshot, Pin Down) are gone.
- Rank gains halved where they were not yet: Piercing Arrow `150 + 8r`, Pin Down root `1 + 0.25r`. The other numbers already matched doc 16.
- Duel gap closed: `around` (foes the Ranger may pick, through `allowed`) and `inLineOf` (`inLine` through `allowed`) replace raw monster lists in spell conditions, the chain, the volley, zones, Thunderhead and the burst. A piercing arrow is also refused by the projectile code for a forbidden target.
- `test/sim/ranger-upgrades.test.ts`: 18 cases, one per upgrade plus the spell basics and two Duel-gap cases (piercing shot and Arc Volley skip an elite dueled by a Duelist). `test/content/jobs.test.ts` has the Ranger's "all built" line.
- Changeset `.changeset/ranger-upgrades.md` (minor).

## Deviations

- Charged Arrow cooldown is 3.5 s, not the doc's 2.5 s (was 4). 2.5 s and 3 s fail `bosses.test` (layer 1: 1 of 6 wins, needs 5) and `boss.test` (Brood Mother: 0 of 12 two-merc wins, needs 4). 3.5 s passes. Left for cc-tuning.
- A Ranger raised against the party (Creditor fight) still chains Charged Arrow among `Side.Monster` units, as before, so it hits its own side. Guarding it with `canTarget` gave 3 wins of 6 in `creditor.test` (needs at most 1). Party Rangers use the guarded list.
- Thunderhead is a Charged Arrow patch: when the arrow hits a Shocked target (status, not buildup), a 60% Storm bolt goes to every other Shocked enemy within 6 tiles. Review decision.
- Killshot's "no windup" is a passive (`killshotQuick`) that moves the cast to its release when the target has not noticed the party; the double damage and critical are in the spell patch.
- Eagle Eye, Pin Down and Killshot leave out the flyer clauses; flyers do not exist yet.
- `PIERCING_ARROW` and `EAGLE_EYE` stay exported from `ranger.ts` because `test/sim/skills.test.ts` and `test/sim/progress.test.ts` (outside this node) still use them. No job uses them.
- Files outside the owned paths: `test/content/jobs.test.ts` (one block, as the brief says) and `.changeset/ranger-upgrades.md`.

## Stubs left

- None.

## Gotchas

- Rearguard keeps the bearer's trail in a module `WeakMap` set up by its passive, so the cast patch reads the same trail. Restarting the passive (a rank raise) clears the trail.
- Overcharge bursts only when a rod's field ran out (`zone.life <= 0`), not when zones are cleared with the stage.
- Killing Ground plants through `plantRod`, so the rod follows the Lightning Rod's rank. It replaces the Ranger's earlier rod and ring.

- A rank raise stops and sets up a passive again (`startEffect`), so state held in a local of `setup` resets mid-fight. Rearguard (trail, timer), Killing Ground (last shout) and Overcharge (rods) keep theirs in module `WeakMap`s keyed by the Ranger.

## Proposed learnings

- Condition and victim lists in spells go through `allowed(u, ...)` or `canTarget`, never `sim.living(Side.Monster)` | keeps a Duel closed to the other mercs | src/content | no
- Passive state that must survive a rank raise lives in a module `WeakMap<Unit, ...>`, not in `setup` | `raise` reruns `setup` | src/content/jobs | no

## Verification

- `pnpm vitest run test/sim/ranger-upgrades.test.ts`: 18 passed.
- `pnpm typecheck && pnpm lint && pnpm test`: see the final report (run after the last edit).

## Size

- Estimated M, actual M.
