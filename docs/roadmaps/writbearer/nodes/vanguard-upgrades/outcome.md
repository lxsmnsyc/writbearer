# Outcome: vanguard-upgrades

## Built

- The Vanguard's 12 elite upgrades in `src/content/jobs/vanguard/upgrades.ts`, each a patch over its spell, a passive it starts, or both:
  - Intercept: Vow (`VOWED` status, +20 armor for 6 s on the Vanguard and bearer), Shared Burden (`BURDENED` status plus a damage listener, 30% of bearer hits for 5 s), Charge (40 stun buildup and a 1.5-tile push aside for each enemy on the dash line).
  - Challenge: Last Line (passive, once per `sim.area`, taunts within 5 tiles of the bearer), Banner (also plants a 10 s banner zone: morale and half dread buildup within 4 tiles), Shield Bash (Challenge becomes a single-target shove with stun buildup, interrupt and a taunt on that enemy only).
  - Shield Wall: Immovable (1 s longer; no stun, Petrify or Dread during it), Rampart (the spell plants a blocking wall toward the nearest archer), Bastion (allies within 2 tiles behind it share the wall's front cover).
  - Crush: Fault Line (5-tile piercing shockwave at 80% damage and Earth), Earthshaker (Petrified target: 40 Earth buildup on enemies within 3 tiles), Sundering Blow (fills Sunder to 5 stacks on a landed blow).
- `src/content/vanguard.ts` now holds the four spells, Sunder, and helpers the upgrades use (`taunt`, `bash`, `bashStun`, `challengeTime`, `crushRatio`, `crushEarth`, `CHALLENGE_RADIUS`). The tree skills that became upgrades are removed from it.
- Spell numbers follow `docs/design/16-builds.md`: the spells already had them; Shield Bash's stun is 50+5r with a flat 100% damage.
- Duel gap closed: `challenged` and Challenge's release use `hostiles(u)`; Last Line, Shield Bash, Charge, Earthshaker and Fault Line's line use `hostiles` or `canTarget`. Tested with a Duelist bound to an elite.
- `test/sim/vanguard-upgrades.test.ts`: a test per upgrade, the spell ranks, the Shield Wall case, and three Duel cases. `test/content/jobs.test.ts`: one line block asserting the Vanguard's upgrades are built.
- Changeset `.changeset/vanguard-upgrades.md` (minor).

## Deviations

- Crush keeps cost 10 and cooldown 6, not the doc's 8 and 3. With 8/3 `test/sim/bosses.test.ts` layer 1 wins 1 of 6 seeds (needs 5); with 8/6, 3 of 6; with 10/6 it passes. For roster-balance or cc-tuning to settle.
- Charge's push is written in the Vanguard's own module (1.5 tiles, perpendicular to the dash, stops at an unwalkable tile), not an engine system and not imported from the Sellsword.
- `SHIELD_BASH`, `VOW` and `SHARED_BURDEN` stay exported from `src/content/vanguard.ts`, because `test/sim/{statuses,progress,roster}.test.ts` import them (outside the owned paths, left untouched). They are not part of the build.

## Stubs left

- None.

## Gotchas

- An upgrade that patches `release` and wants the base behavior calls the base spell's `release` (INTERCEPT, CHALLENGE, CRUSH). Shield Bash and Rampart replace `wants`, `elite` and `release` and carry their own `describe`.
- Last Line keys once-per-area on `sim.area`, not on unit identity. Banner removes the Vanguard's older banner before planting.
- The Banner's morale is 1 per second and its dread factor 0.5 (the doc says "morale" and "half"); first guesses.
- Bastion ignores the Flank flag: cover is the geometry between the attacker and the ally.
- Tests that fake a monster's max health fail silently: a status change recomputes stats and restores full health. Count damage with a `UnitDamage` listener instead.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/vanguard-upgrades.test.ts`: 18 passed.
- `pnpm typecheck && pnpm lint && pnpm test`: ok (67 files, 629 passed, 17 skipped).
- `pnpm format` run. `pnpm test:e2e` not run (exclusive port; not part of the fast check).

## Size

- Estimated M, actual M.
