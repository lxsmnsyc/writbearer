# Outcome: roster-balance

## Built

- All seven starting jobs are hireable: `hireable: true` on Sellsword, Warden, Duelist and Arcanist (`src/content/jobs/<kind>/index.ts`).
- `src/content/recruits.ts`: `STARTING_OFFERS` (5), `SLOTS` (`guard`, `striker`, `support`), `rollStartingJobs(rng)`: one job per slot from the hireable jobs of that role, then any job not drawn yet up to 5, no job twice. If none is a fighter, the last one drawn is swapped for one (cannot happen with today's roles, since every guard is a fighter). `rollStartingOffers` uses it and still rerolls a name that repeats.
- The deserter Event and endless mode's wandering mercs already called `rollOffer` with `HIREABLE`, so they now draw from all seven jobs. A test covers it.
- `src/ui/offer.tsx`: the title panel says five recruits wait and four may go.
- `test/sim/spell-impact.test.ts` (new): for each of the seven jobs, a level 10 merc beside a standing bearer fights 2 Crawlers and 2 Hollowed of level 6, with its spells and with basic attacks only (spells set to `SkillMode.Off`; the innate stays). Neither the merc nor the bearer can die, so each fight runs to the last kill. Mean of seeds 1 to 32. `SPELL_IMPACT=1 pnpm vitest run test/sim/spell-impact.test.ts` prints the table.
- `test/sim/bosses.test.ts`: Warden, Duelist and Arcanist win at least 5 of 6 seeds on each of layers 1 to 3, as Vanguard, Ranger and Cleric must. Each new job swapped into the Vanguard, Ranger and Cleric party wins at least 9 of 18 fights over layers 1 to 3.
- `test/gen/balance.test.ts`: the lone-merc test runs over every hireable job (all seven clear 12 of 12 seeds; limit 11).
- `test/sim/recruits.test.ts`: 200 seeds, each draw has 5 recruits, a guard, a striker, a support, 5 jobs, a fighter, 5 names; same seed same draw; every job shows up over 50 seeds; the deserter pool covers every hireable job; the Guild House has 5 spots.
- `e2e/recruit.spec.ts`: 5 recruits of 5 jobs; the first hire is any fighter (read from `FIGHTERS`); a new test hires four and finds the fifth refused ("The party is full: 4 mercs at most.") and still waiting; the Cleric-only party still cannot leave.
- Docs: doc 09 "In the game so far" rewritten for the build model (all seven jobs, spells with cost and cooldown, innates, where numbers differ from doc 16, "no monster shoots yet" dropped); doc 05 party size, "In the game so far", the skill trees section and the starting job list; doc 12 roster table and starting offers (five recruits, two of any job, with the jobs in the game so far); README decisions (starting recruits, builds).
- `.changeset/roster-balance.md` (minor).

### Impact numbers

Seconds to clear the pack, and bearer health lost (damage taken less healing), mean of seeds 1 to 32:

| Job | With spells | Basic only | Speed-up | Bearer lost, spells | Bearer lost, basic |
|---|---|---|---|---|---|
| Vanguard | 19.5 s | 22.1 s | x1.13 | 156 | 558 |
| Warden | 19.7 s | 29.3 s | x1.48 | 327 | 531 |
| Ranger | 11.2 s | 17.3 s | x1.54 | 153 | 427 |
| Sellsword | 11.9 s | 22.0 s | x1.85 | 180 | 559 |
| Duelist | 14.6 s | 18.9 s | x1.29 | 347 | 521 |
| Arcanist | 9.8 s | 41.6 s | x4.26 | 364 | 1042 |
| Cleric | 26.5 s | 55.6 s | x2.10 | 42 (took 538) | 1426 |

- The Ranger was x1.48 over 32 seeds before the chain change below (x1.58 on the first 4 seeds only).
- Duelist with Whirlwind: 9.0 s, bearer lost 232. The test now compares it with its base spells (14.6 s), not with basic attacks.
- Warden with Trap Field: 18.4 s, bearer lost 124. Faster than basic attacks (29.3 s) and, over these 32 seeds, a little faster than its base spells (19.7 s); on seeds 1 to 4 it was slower (20.3 s against 18.5 s). The result against its base spells depends on the seeds, so the test only compares it with basic attacks. Trap Field slows and marks, it deals no damage. It lowers the bearer's loss from 327 to 124.
- Every job's spells shorten the fight; the Vanguard's least (x1.13), but they cut the bearer's loss by 72%.

### Boss numbers

Wins on layers 1 / 2 / 3, `test/sim/bosses.test.ts` fight, over seeds 1 to 24 (the tests themselves use seeds 1 to 6). Measured after the review round, with the chain change:

| Party | Wins of 24 |
|---|---|
| Vanguard, Ranger, Cleric | 18 / 24 / 23 (review, before the chain change: 19 / 24 / 23) |
| Vanguard, Ranger (must lose) | 0 / 1 / 4 |
| Warden, Duelist, Arcanist | 22 / 20 / 21 (was 0 / 0 / 0 on 6 seeds before tuning) |
| Warden, Ranger, Cleric | 23 / 24 / 17 |
| Vanguard, Sellsword, Cleric | 5 / 22 / 23 |
| Vanguard, Duelist, Cleric | 7 / 15 / 18 |
| Vanguard, Arcanist, Cleric | 24 / 22 / 24 |

- Cleric parties with the Sellsword or the Duelist win the layer-1 boss (Gatekeeper) only 5 and 7 of 24. The test's 9-of-18 limit over three layers does not catch it. For cc-tuning.
- On seeds 1 to 6, Warden, Duelist, Arcanist win 5 / 5 / 6 and Vanguard, Ranger, Cleric 6 / 6 / 5.

### Numbers tuned

The Warden's Interpose (`src/content/jobs/warden/spells.ts`) and, in the review round, the Ranger's chain (`src/content/ranger.ts`).

- `INTERPOSE_REACH` 2 -> 3 tiles.
- `INTERPOSE_SHARE` 0.7 -> 0.8.
- New `INTERPOSE_CHASE` = 4: Interpose also caps the Warden's chase (CheckChase, `ValuePriority.Exact`) at 4 tiles from the bearer, so it stays near enough to step in. Pursue still leaps out to a marked enemy. Tether's 3-tile cap during Cover stays tighter.

- New `CHAIN_SHARE` = 1.5 in `src/content/ranger.ts`: a Storm arrow's chain hits for 1.5 times the arrow's ratio (before: the same ratio). It applies to Charged Arrow and the arrows of Arc Volley and Thunderhead, all through `stormArrow`. Ranger impact over 32 seeds x1.48 -> x1.54. Tried first: chain reach 3 -> 4 tiles (no change, x1.48); Lightning Rod 35 + 5r -> 45 + 5r and 55 + 5r (x1.50 and x1.53, but Vanguard, Ranger, Cleric fell to 2 and 3 of 6 on layer 1); chain at 1.25 and 2 times (x1.51 and x1.73, boss tests pass). Single-target damage is unchanged.

Why Interpose: with no Cleric, the bearer died in 15 to 40 s at every layer. The Gatekeeper's guard and the Abbess's Penitents walk to the bearer while the Warden fights 3 to 8 tiles away. Tried: reach 4 alone (layer 1, 2 of 3 seeds); reach 3 + chase 4 (2 / 2 / 6); chase 3 (2 / 1 / 5); then share 0.8 (5 / 5 / 6).

### The three spells kept off doc 16 (inbox)

Measured with the rest of this branch, one value at a time, then reverted:

- Heal +10 a rank (doc): Vanguard, Ranger, Cleric 4 / 6 / 5. Layer 1 fails (needs 5).
- Crush 8 mana / 3 s (doc): 1 / 6 / 6. Fails.
- Charged Arrow 2.5 s (doc): 1 / 6 / 5, and `boss.test` Brood Mother fails (0 two-merc wins, needs 4).

The impact test passes with the kept values (Ranger x1.54 over 32 seeds at 3.5 s, with the chain change). So my numbers support keeping all three, and updating doc 16 to the game's values. Doc 09 now lists them, with Interpose, under "Where the game differs from doc 16".

## Deviations

- `src/content/jobs/warden/spells.ts` (not owned): Interpose's numbers and chase cap. The Warden's spells moved there from `index.ts` in warden-upgrades, so "the job module" now means this file.
- `src/content/jobs/warden/upgrades.ts` (not owned): one comment on Living Shield said 70%; it now names `INTERPOSE_SHARE`. No code change.
- `src/gen/stage/havens.ts` (not owned): `GUILD_RECRUITS` 4 -> 5, spots 2.5 tiles apart instead of 3. Without it only four offers stand in the Guild House. `test/gen/__snapshots__/stage-snapshot.test.ts.snap`: the three `guild/<seed>` hashes change, nothing else.
- `src/content/ranger.ts` (not owned): `CHAIN_SHARE`, for the 1.5 pack-clearing limit over 32 seeds (designer's decision in review). `bosses.test`, `boss.test` (Brood Mother), `creditor.test` and `ranger-upgrades.test` pass with it.
- `src/ui/merc-panel.tsx` (not owned): the chase line shows the distance after `CheckChase` (`chaseOf`), so a Warden reads 4 tiles, not the slider's 7.
- `e2e/support/guild.ts` (not owned): the `kinds(page, 'HIREABLE' | 'FIGHTERS')` helper moved here from `recruit.spec.ts`, so `save.spec.ts` reads `FIGHTERS` too.
- Tests outside the owned paths, each a line or two: `test/sim/warden.test.ts` and `test/sim/warden-upgrades.test.ts` (80% share, hireable, chase 4 without Cover), `test/sim/sellsword.test.ts`, `duelist.test.ts`, `arcanist.test.ts` (hireable now true), `test/sim/events.test.ts` (the deserter may be any hireable job).
- `e2e/save.spec.ts` and `e2e/seed.spec.ts` (not owned): save.spec picked a Vanguard or Ranger, and seed ASHEN now draws neither; it picks a recruit whose job is in `FIGHTERS`, read from the dev server. seed.spec expected 4 recruits; now 5.
- Doc 16 is not owned, so the Interpose numbers there (2 tiles, 70%) now disagree with the game. Doc 09 records it.
- The orchestrator note said the Guild House needs a Vanguard or Ranger. That was `FIGHTERS` with only those two hireable; `hasFighter` reads `FIGHTERS`, which now holds every job but the Cleric.
- The boss threshold for each new job in a Cleric party is mine (9 of 18); the brief gave a number only for Warden, Duelist and Arcanist.
- The impact test spares the merc and the bearer from death, and uses 2 Crawlers and 2 Hollowed at level 6. With 4 Hollow Soldiers at level 8 most mercs die alone and the times mean nothing. With 4 Hollowed the Ranger is x1.40; with 4 Crawlers x1.70. The brief gave no pack.

## Stubs left

- None.

## Gotchas

- Warden, Ranger and Cleric on layer 3 win 17 of 24 (2 of seeds 1 to 6): the Warden stays by the bearer, where the Hollowed Saint's Dread and Lunge reach it. For cc-tuning.
- Vanguard, Duelist, Cleric and Vanguard, Sellsword, Cleric win the layer-1 boss 7 and 5 of 24. The test asks only 9 of 18 over three layers.
- The WDA boss result on the test's 6 seeds is 5 / 5 / 6 against a limit of 5: any change to the Warden, Duelist, Arcanist or the bosses can tip it.
- The Ranger's impact is x1.54 against a limit of 1.5. The Vanguard, Ranger, Cleric layer-1 boss result moved with every Ranger change tried in review (Lightning Rod +10 dropped it to 2 of 6).
- The chain now hits harder than the arrow, so Arc Volley's three arrows chain at 105% each, and Thunderhead's chain also gains.
- `rollStartingJobs` reads `def.role`; a new job with a role outside `SLOTS` is drawn only as one of the two extras.
- The e2e fifth-recruit test reads wages through the page's own `rollStartingOffers` and `RunStreams('ASHEN')`, with the stream key `'recruits'` spelled out (const enum).

## Proposed learnings

- A guard with no taunt needs a chase cap near the bearer | otherwise it fights the boss and leaves the bearer to adds | src/content/jobs | yes (boss test with no Cleric)

## Verification

- `pnpm vitest run test/sim/spell-impact.test.ts`: 5 passed, 32 seeds.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (69 files, 687 passed, 3 skipped). After the review fixes, one run timed out in `test/sim/concealment.test.ts` (unrelated, under load); it passes alone and in the next full run.
- `pnpm test:e2e`: 25 passed (port 5199 was free). After the review fixes the first run took 4.4 min with `orders.spec.ts` and the first `recruit.spec.ts` test failing; both passed alone, and the full rerun passed 25 of 25.

## Size

- Estimated L, actual L.
