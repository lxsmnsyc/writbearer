# Outcome: duelist

## Built

- `src/content/jobs/duelist/spells.ts` (new, in the job's folder): DUEL, SHADOWSTEP, LUNGE, FLURRY, the innate RIPOSTE, the DUELING status, and exported helpers for the upgrade node (`duelTime`, `shadowstepRatio`, `lungeRatio`, `flurryRatio`, `partnerOf`, `beginDuel`, `DUEL_RANGE`, `SHADOWSTEP_RANGE`, `LUNGE_RANGE`, `FLURRY_HITS`, `RIPOSTE_CHANCE`).
- `src/content/jobs/duelist/index.ts`: real spells, innate, spell icons (duel, shadow-follower, piercing-sword, dervish-swords). Template and starter gear (stiletto, buckler, jerkin) are the registry's first guesses, kept. Still `hireable: false`.
- `src/render/looks/duelist.ts`: slight (size 0.95), sash and dagger, no drawn shield, hitFraction 0.5 to match the kit.
- `test/sim/duelist.test.ts`: 14 tests, a headless fight plus the 4 spells and Riposte.
- `.changeset/duelist.md` (minor).

Spells (mana, cooldown, per doc 16): Duel 14/16 s, Shadowstep 10/10 s, Lunge 8/6 s, Flurry 8/3 s.

- Duel: Enemy-targeted, elite only, within 2.5 tiles. Binds both for 4 + 0.5r s through CheckTarget. Ends if either dies.
- Shadowstep: `aim` picks the nearest aware caster or healer within 8 tiles. Teleports behind it (opposite its facing), strikes 130 + 10r% with the Flank flag.
- Lunge: within 4 tiles; steps to 0.8 reach from the target, strikes 120 + 10r%.
- Flurry: four `strike` calls at release, 40 + 4r% each, stops if the target dies. In reach only.
- Riposte (rank 1 fixed): 15% to cancel a melee hit that lands, then a free basic-attack counter flagged Sure.

## Deviations

- Added `src/content/jobs/duelist/spells.ts`, a file outside the brief's three owned paths but inside the job's folder, so `upgrades.ts` can import the spells. No other file touched.

## Stubs left

- The 12 upgrades stay summary-only (`duelist-upgrades`). Hooks for them: `DUEL.release` and `duelTime` (Grand Duel, Taunt the Proud), `FLURRY.release` loops over `strike` (Whirlwind, Bleed Out, Thousand Cuts), `wants`/`release` patching.
- Content skills that pick their own victims (`challenged`, `inLine`, `around`, `after`) do not ask CheckTarget, so a Vanguard's Challenge can still taunt the dueled elite. Known gap from targeting-rules; not fixed here.

## Gotchas

- A parry fires UnitMiss on the Duelist, so Untouchable (listens to UnitMiss) also triggers on parries.
- After Shadowstep the monster turns on its next tick, so check the `Flank` flag on the hit, not `isFlankedBy` afterwards.
- Riposte listens at CheckHit `Post`, after the roll. A test that forces hits must do so at `Post` too and register first.
- The Duel status is `dueling` on both units; `partnerOf(u)` gives the other.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/duelist.test.ts test/content/jobs.test.ts`: pass.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (59 files, 480 tests, 24 skipped).
- `pnpm test:e2e` not run, by instruction.

## Size

- Estimated M, actual M.
