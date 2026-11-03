# Outcome: arcanist

## Built

- The Arcanist job in `src/content/jobs/arcanist/index.ts`: real template, innate, icons, spells in cast order Frost Nova, Fireball, Frost Shard, Firebolt. Still `hireable: false`.
- `src/content/jobs/arcanist/spells.ts` (new file): the four spells and the innate `ELEMENTAL_SENSE`, exported so the `arcanist-upgrades` node can patch them. Rank formulas and costs follow doc 16.
  - Frost Nova: self ring of 2.5 tiles, 90 + 8r% Frost magic damage, 30 + 3r Chill buildup (Chill escalates to Freeze). Cost 14, 7 s.
  - Fireball: 2-tile Fire area at the target, 130 + 12r%, saved for 2 or more enemies in the blast or an elite. Victims come from `areaVictims` with the spell as the unit casts it (`unit.skills`), so an upgrade that patches `friendlyFire` (Inferno) takes effect with no code here. Cost 16, 6 s.
  - Frost Shard: homing Frost bolt, 100 + 8r%. Cost 7, 2.5 s.
  - Firebolt: homing Fire bolt, 100 + 8r%, 20 + 2r Burn buildup, the filler. Cost 7, 2.5 s.
  - Elemental Sense: `senseElement(target)` compares `affinity(Fire)` and `affinity(Frost)` against the target's element and level. Frost Shard `wants` the target only when Frost is strictly better, Firebolt otherwise. The passive also adds Fire and Frost to `CheckAttackElements`, so the "weak to my element" priority counts both.
- `src/render/looks/arcanist.ts`: taller figure (size 1.08), robe and plain staff, no sash or sunburst staff so it does not read as the Cleric.
- `test/sim/arcanist.test.ts`: 18 tests.

Elemental Sense, all three cases pass through `src/sim/elements.ts` and `src/sim/mechanics/damage.ts`, so the split fallback is NOT triggered:

- Fire-weak target (Earth defender, Fire 150 vs Frost 100): casts Firebolt; the hit lands as Fire, Magical.
- Frost-weak target (Fire defender, Frost 150 vs Fire 25): casts Frost Shard; the hit lands as Frost.
- Neither (Neutral, Radiant, Occult, all 100 and 100): casts Firebolt.
- Also tested: a Frozen target (counts as Frost 1) switches the pick from Frost Shard to Firebolt; the damage dealt reflects the picked element's affinity; the WeakToElement priority prefers a Fire enemy over a nearer Neutral one.

## Deviations

- New file `src/content/jobs/arcanist/spells.ts` inside the owned folder (the Duelist does the same).
- The template changed from Melee to Ranged with reach 5.5, so the AI keeps the Arcanist back and its spells (`inReach`) can fire. This changes its basic attack to a staff projectile. First guess, for roster-balance to judge.
- The look uses existing attachments only. A pointed hat would need a new `Attachment` in `src/render/sprites.ts`, which this node does not own. Not done.
- No edits to `src/sim/zone.ts`, `src/sim/mechanics/zones.ts` or `src/render/zones.ts`: Volcano and its zone drawing belong to `arcanist-upgrades`.
- Shared files untouched. Added `.changeset/arcanist-job.md`.

## Stubs left

- The 12 upgrades are still summary-only (`designedUpgrade`, `arcanist-upgrades` node).

## Gotchas

- Bolt choice lives in each bolt's `wants`. An upgrade patch for a bolt that overrides `wants` must keep the `senseElement` check or the Arcanist will cast both bolts at every target.
- Fireball and Frost Nova read their area from the spell in `unit.skills` (the upgraded one). A patch that replaces `release` should call `areaVictims` the same way to keep friendly fire correct.
- Frost Nova's "Freeze buildup" is Chill buildup: Freeze has no threshold in the engine and Chill escalates to it.
- Magic damage is low for now: the Ash Staff has no matk, so a 100% bolt does about 28 base damage (INT 18 x 1.5 + DEX/5). Tuning or a staff with matk is a balance matter.
- Not tested in a headless full-party run beyond Vanguard plus Arcanist against 3 soldiers.

## Proposed learnings

- A `Skill.wants` that picks between two spells by target must be copied into any patch that replaces `wants` | otherwise both spells fire | src/content/jobs | no

## Verification

- `pnpm vitest run test/sim/arcanist.test.ts && pnpm vitest run test/content/jobs.test.ts`: pass.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (61 files, 517 passed, 24 skipped). `pnpm test:e2e` not run (fixed port).

## Size

- Estimated M, actual M.
