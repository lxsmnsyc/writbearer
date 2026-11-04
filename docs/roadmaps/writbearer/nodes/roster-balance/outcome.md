# Outcome: roster-balance

## Built

- All seven starting jobs are hireable: `hireable: true` on Sellsword, Warden, Duelist and Arcanist (`src/content/jobs/<kind>/index.ts`).
- `src/content/recruits.ts`: `STARTING_OFFERS` (5), `SLOTS` (`guard`, `striker`, `support`), `rollStartingJobs(rng)`: one job per slot from the hireable jobs of that role, then any job not drawn yet up to 5, no job twice. If none is a fighter, the last one drawn is swapped for one (cannot happen with today's roles, since every guard is a fighter). `rollStartingOffers` uses it and still rerolls a name that repeats.
- The deserter Event and endless mode's wandering mercs already called `rollOffer` with `HIREABLE`, so they now draw from all seven jobs. A test covers it.
- `src/ui/offer.tsx`: the title panel says five recruits wait and four may go.
- `test/sim/spell-impact.test.ts` (new): for each of the seven jobs, a level 10 merc beside a standing bearer fights 2 Crawlers and 2 Hollowed of level 6, with its spells and with basic attacks only (spells set to `SkillMode.Off`; the innate stays). Neither the merc nor the bearer can die, so each fight runs to the last kill. Mean of seeds 1 to 4. `SPELL_IMPACT=1 pnpm vitest run test/sim/spell-impact.test.ts` prints the table.
- `test/sim/bosses.test.ts`: Warden, Duelist and Arcanist win at least 5 of 6 seeds on each of layers 1 to 3, as Vanguard, Ranger and Cleric must. Each new job swapped into the Vanguard, Ranger and Cleric party wins at least 9 of 18 fights over layers 1 to 3.
- `test/gen/balance.test.ts`: the lone-merc test runs over every hireable job (all seven clear 12 of 12 seeds; limit 11).
- `test/sim/recruits.test.ts`: 200 seeds, each draw has 5 recruits, a guard, a striker, a support, 5 jobs, a fighter, 5 names; same seed same draw; every job shows up over 50 seeds; the deserter pool covers every hireable job; the Guild House has 5 spots.
- `e2e/recruit.spec.ts`: 5 recruits of 5 jobs; the first hire is any fighter (read from `FIGHTERS`); a new test hires four and finds the fifth refused ("The party is full: 4 mercs at most.") and still waiting; the Cleric-only party still cannot leave.
- Docs: doc 09 "In the game so far" rewritten for the build model (all seven jobs, spells with cost and cooldown, innates, where numbers differ from doc 16, "no monster shoots yet" dropped); doc 05 party size, "In the game so far", the skill trees section and the starting job list; doc 12 roster table and starting offers (five recruits, two of any job, with the jobs in the game so far); README decisions (starting recruits, builds).
- `.changeset/roster-balance.md` (minor).

### Impact numbers

Seconds to clear the pack, and bearer health lost (damage taken less healing), mean of 4 seeds:

| Job | With spells | Basic only | Speed-up | Bearer lost, spells | Bearer lost, basic |
|---|---|---|---|---|---|
| Vanguard | 22.1 s | 22.4 s | x1.01 | 160 | 599 |
| Warden | 18.5 s | 30.9 s | x1.68 | 365 | 560 |
| Ranger | 11.9 s | 18.9 s | x1.58 | 119 | 452 |
| Sellsword | 12.9 s | 20.9 s | x1.62 | 211 | 500 |
| Duelist | 14.7 s | 18.8 s | x1.28 | 375 | 498 |
| Arcanist | 9.5 s | 39.2 s | x4.15 | 345 | 925 |
| Cleric | 25.2 s | 52.9 s | x2.10 | 64 (took 496) | 1319 |

- Duelist with Whirlwind: 9.2 s, bearer lost 253 (x2.04 over basic, x1.60 over its base spells).
- Warden with Trap Field: 20.3 s, bearer lost 123. Faster than basic attacks (30.9 s), but not faster than its base spells (18.5 s): Trap Field slows and marks, it deals no damage. It lowers the bearer's loss from 365 to 123.
- Every job's spells shorten the fight; the Vanguard's barely do (x1.01) but cut the bearer's loss by 73%.

### Boss numbers

Wins of 6 seeds (1 to 6) on layers 1 / 2 / 3, `test/sim/bosses.test.ts` fight:

| Party | Wins |
|---|---|
| Vanguard, Ranger, Cleric | 6 / 6 / 5 |
| Vanguard, Ranger (must lose) | 0 / 1 / 0 |
| Warden, Duelist, Arcanist | 5 / 5 / 6 (was 0 / 0 / 0) |
| Warden, Ranger, Cleric | 6 / 6 / 2 (was 0 / 5 / 6) |
| Vanguard, Sellsword, Cleric | 3 / 6 / 6 |
| Vanguard, Duelist, Cleric | 3 / 3 / 4 |
| Vanguard, Arcanist, Cleric | 6 / 6 / 6 |

### Numbers tuned

All in the Warden's Interpose (`src/content/jobs/warden/spells.ts`); nothing else was tuned.

- `INTERPOSE_REACH` 2 -> 3 tiles.
- `INTERPOSE_SHARE` 0.7 -> 0.8.
- New `INTERPOSE_CHASE` = 4: Interpose also caps the Warden's chase (CheckChase, `ValuePriority.Exact`) at 4 tiles from the bearer, so it stays near enough to step in. Pursue still leaps out to a marked enemy. Tether's 3-tile cap during Cover stays tighter.

Why: with no Cleric, the bearer died in 15 to 40 s at every layer. The Gatekeeper's guard and the Abbess's Penitents walk to the bearer while the Warden fights 3 to 8 tiles away. Tried: reach 4 alone (layer 1, 2 of 3 seeds); reach 3 + chase 4 (2 / 2 / 6); chase 3 (2 / 1 / 5); then share 0.8 (5 / 5 / 6).

### The three spells kept off doc 16 (inbox)

Measured with the rest of this branch, one value at a time, then reverted:

- Heal +10 a rank (doc): Vanguard, Ranger, Cleric 4 / 6 / 5. Layer 1 fails (needs 5).
- Crush 8 mana / 3 s (doc): 1 / 6 / 6. Fails.
- Charged Arrow 2.5 s (doc): 1 / 6 / 5, and `boss.test` Brood Mother fails (0 two-merc wins, needs 4).

The impact test passes with the kept values (Ranger x1.58 at 3.5 s). So my numbers support keeping all three, and updating doc 16 to the game's values. Doc 09 now lists them, with Interpose, under "Where the game differs from doc 16".

## Deviations

- `src/content/jobs/warden/spells.ts` (not owned): Interpose's numbers and chase cap. The Warden's spells moved there from `index.ts` in warden-upgrades, so "the job module" now means this file.
- `src/content/jobs/warden/upgrades.ts` (not owned): one comment on Living Shield said 70%; it now names `INTERPOSE_SHARE`. No code change.
- `src/gen/stage/havens.ts` (not owned): `GUILD_RECRUITS` 4 -> 5, spots 2.5 tiles apart instead of 3. Without it only four offers stand in the Guild House. `test/gen/__snapshots__/stage-snapshot.test.ts.snap`: the three `guild/<seed>` hashes change, nothing else.
- Tests outside the owned paths, each a line or two: `test/sim/warden.test.ts` and `test/sim/warden-upgrades.test.ts` (80% share, hireable, chase 4 without Cover), `test/sim/sellsword.test.ts`, `duelist.test.ts`, `arcanist.test.ts` (hireable now true), `test/sim/events.test.ts` (the deserter may be any hireable job).
- `e2e/save.spec.ts` and `e2e/seed.spec.ts` (not owned): save.spec picked a Vanguard or Ranger, and seed ASHEN now draws neither; it picks any non-Cleric (all are fighters now). seed.spec expected 4 recruits; now 5.
- Doc 16 is not owned, so the Interpose numbers there (2 tiles, 70%) now disagree with the game. Doc 09 records it.
- The orchestrator note said the Guild House needs a Vanguard or Ranger. That was `FIGHTERS` with only those two hireable; `hasFighter` reads `FIGHTERS`, which now holds every job but the Cleric.
- The boss threshold for each new job in a Cleric party is mine (9 of 18); the brief gave a number only for Warden, Duelist and Arcanist.
- The impact test spares the merc and the bearer from death, and uses 2 Crawlers and 2 Hollowed at level 6. With 4 Hollow Soldiers at level 8 most mercs die alone and the times mean nothing. With 4 Hollowed the Ranger is x1.40; with 4 Crawlers x1.70. The brief gave no pack.

## Stubs left

- None.

## Gotchas

- Warden, Ranger and Cleric on layer 3 dropped from 6 to 2 of 6 with the chase cap: the Warden stays by the bearer, where the Hollowed Saint's Dread and Lunge reach it. For cc-tuning.
- Vanguard, Duelist, Cleric (3 / 3 / 4) and Vanguard, Sellsword, Cleric on layer 1 (3) are the weakest parties with a Cleric. The test asks only 9 of 18.
- The WDA boss result is 5 / 5 / 6 against a limit of 5: any change to the Warden, Duelist, Arcanist or the bosses can tip it.
- The Ranger's impact is x1.58 against a limit of 1.5, also near the edge.
- `rollStartingJobs` reads `def.role`; a new job with a role outside `SLOTS` is drawn only as one of the two extras.
- The e2e fifth-recruit test reads wages through the page's own `rollStartingOffers` and `RunStreams('ASHEN')`, with the stream key `'recruits'` spelled out (const enum).

## Proposed learnings

- A guard with no taunt needs a chase cap near the bearer | otherwise it fights the boss and leaves the bearer to adds | src/content/jobs | yes (boss test with no Cleric)

## Verification

- `pnpm vitest run test/sim/spell-impact.test.ts`: 4 passed.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (69 files, 685 passed, 3 skipped).
- `pnpm test:e2e`: 25 passed, first run after the last change (port 5199 was free).

## Size

- Estimated L, actual L.
