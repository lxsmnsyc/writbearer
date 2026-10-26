# Builds

Draft. How a merc grows during a run. Two models are compared: real skill trees, and four fixed spells with upgrades. The recommendation is option B, four spells with upgrades, in [recommendation](#recommendation). The user picks one at the build-variety gate.

## What is wrong today

- **Every merc of a job ends with every skill.** A tree has 15 nodes. A node needs only 1 rank in the node before it (`cannotLearn` in `src/content/trees.ts`). 15 points open all 15 nodes at rank 1. A merc has 15 points at level 16, the level the capstones open. From there, points only add ranks.
- **Nothing crosses branches.** Each branch is a chain of 5. No node needs a node of another branch.
- **Synergies are not built.** Doc 09 names them. The only one in the code is Fault Line, whose Earth buildup grows with Crush's rank (`faultEarth` in `src/content/vanguard.ts`).
- **The only cap is the point budget.** About 24 points by level 25, against 63 ranks per job. No rank cap ties a skill to merc level past the tier level (`TIER_LEVEL`).
- **Learn order is a hidden priority list.** `useSkill` in `src/sim/ai.ts` casts the first skill in `unit.skills`, in the order learned, that its rule wants. A Vanguard can have 8 actives. The player never sees this order.
- **Many small choices.** 4 mercs gain 20 levels each in a run (from `START_LEVEL` 5 in `src/game/stage.ts` to about 25). That is about 96 skill points to spend, and 3 stat points per level besides (`STAT_POINTS` in `src/sim/progress.ts`).

## How the reference games do it

### Diablo 2

- 1 skill point per character level. 30 skills in 3 trees of 10.
- A skill has up to 20 ranks.
- Each skill has a required character level (1, 6, 12, 18, 24 or 30). A skill's rank cannot pass the character level minus its required level, plus 1.
- A skill needs 1 point in each of its prerequisites, which can be in other rows of its tree.
- Synergies: each rank in a named skill raises another skill's effect by a fixed percent. A build puts 20 in a main skill and 20 in each of its synergies.
- Two characters of one class differ because the budget forces 4 or 5 maxed skills out of 30.

### rAthena

- 1 skill point per job level. A first job has up to 49 points, a second job up to 69.
- A skill has up to 10 levels.
- A skill needs other skills at set levels, often 5 or 10, and these often come from the first job.
- Points left from the first job must be spent before the job change.
- Two characters of one job differ because high prerequisites eat most of the budget.

### Aghanim's Labyrinth

Dota 2's 2020 event, Continuum Conundrum.

- A hero keeps its own 4 abilities for the whole run.
- Each room's outpost shows its reward before the party enters.
- Clearing a room offers a pick of 1 shard from a few.
- Normal rooms give minor buffs. Elite and trap rooms give moderate ones. Boss rooms give heavy ones that change how an ability works, such as Winter Wyvern's Arctic Burn hitting more targets.
- Two runs of one hero differ because the offers are random.

The game already borrows the Labyrinth's room grades and reward signposts. See [rewards on the road](14-gauntlets.md#rewards-shown-on-the-road).

## Options

### A. Real trees

Keep 3 branches of 5 nodes and 1 point per level. Add rAthena prerequisites, Diablo 2 rank caps and synergies.

| Rule | Today | Option A |
|---|---|---|
| Points | 1 per level | Same |
| Ranks | 5, capstone 1 | Same |
| Same-branch prerequisite | 1 rank in the node before | 3 ranks in the node before |
| Cross-branch prerequisite | None | 1 or 2 per job, at rank 3 |
| Rank cap | Tier level only | Rank ≤ merc level − tier level + 1 |
| Synergies | Fault Line only | 3 to 5 per job, each +a fixed amount per rank of the source |
| Branch cap | None | None needed. See below. |

- A branch to its capstone costs 3 + 3 + 3 + 3 + 1 = 13 points. Two capstones cost 26, more than the 24 a merc has by level 25. So a merc takes one capstone and part of a second branch.
- A merc at `START_LEVEL` 5 has 4 points. It can reach tier 2 only by putting 3 in one tier 1 skill.
- Choices happen at each level up: about 24 per merc, 96 per party.

### B. Four spells with upgrades

Throw the trees out. Each job has 4 fixed spells, known from level 1.

- **Shards.** Each level gives the merc 1 shard. A shard raises one spell by one rank. Ranks run from 1 to 10, with a cap tied to merc level.
- **Upgrades.** Each spell has 3 upgrades. Each upgrade changes how the spell works, not only its numbers. A spell holds 1 upgrade, kept for the run.
- **Offers.** Upgrades come as a pick of 1 from 3 cards, at set places in the run.
- **Innate passive.** Each job has 1 passive with no choice. It keeps the job's identity, such as the Vanguard's Sunder.
- Choices happen at each level up (shards, about 24 per merc) and at each offer (about 4 to 6 per merc).

### C. Four spells plus a small passive tree

Option B's spells and shards, plus a tree of 6 to 9 passives bought with a second kind of point.

- Two currencies, two screens and two sets of rules per merc.
- It keeps more of doc 09's passives as choices.
- It doubles the choices at each level up, which is the chore option B tries to cut.
- Not recommended. It is listed because the brief asked for mixes. Its cost is option B's plus a tree screen.

## Comparison

| Topic | A. Real trees | B. Four spells with upgrades |
|---|---|---|
| Two mercs of one job | Differ if the player builds them differently. Across runs, a player can repeat the best build. | Differ because each merc gets its own random offers. |
| Choices per run | About 96 point spends, each read off a tree of 15. | About 96 shard spends on 4 rows, and 16 to 24 upgrade picks. |
| Size of a choice | Small: one rank. The big choice is which branch, made once, early. | Shards are small. An upgrade is large and changes how the merc plays. |
| Early game | At level 5 a merc has 1 or 2 skills. | At level 5 a merc has all 4 spells. |
| AI | Up to 8 actives. Learn order decides priority. | 4 actives in a fixed order. An upgrade may replace the spell's `wants`. |
| Per-skill orders (Auto, Elites, Off) | Up to 8 rows per merc. | 4 rows per merc. |
| Job identity | 15 nodes, 3 themes. | 4 spells and 1 passive. The themes move into the upgrades. |
| Reuse of doc 09 | Keeps every node and all 12 job briefs. | Every node becomes a spell, the innate passive or an upgrade. The 4 new jobs need a design pass. |

### Cost to build

| Part | A. Real trees | B. Four spells with upgrades |
|---|---|---|
| Rules | `TreeNode` gains `requires` and `synergies`. `cannotLearn` checks them and the rank cap (`src/content/trees.ts`). | New `Spell` and `Upgrade` types. `Unit` gains `upgrades` and `shards` (`src/sim/unit.ts`). `rankOf` in `src/content/skills.ts` stays. |
| Effect of an upgrade | Not needed. | An upgrade is a patch over the spell: new `describe`, `wants`, `release`, or a `Passive` it starts. The spell is `{ ...base, ...patch }`. |
| Synergy | A helper that each skill's formula calls, as `faultEarth` does now. | Not needed. Upgrades take this role. |
| UI | `src/ui/skill-tree.tsx` (267 lines) adds cross-branch lines or tooltips, and shows the cap. | `skill-tree.tsx` is replaced by a 4-row panel: rank, cap, +, the upgrade, the order. A new offer screen for 3 cards. |
| Rewards | None. | A new `Reward` kind, `mastery`, in `src/gen/graph.ts`, with its name, icon and chest in `Game.spoilsOf` (`src/game/game.ts`). An offer at each Waystation. |
| Saves | None. `ranks: [id, rank][]` is unchanged (`src/game/save.ts`). | An optional `upgrades: string[]` and `shards` per merc. Ranks of nodes that are no longer spells are refunded as shards on load. `SAVE_VERSION` stays 3. |
| Recruits | Unchanged: `skillPoints = level − 1` in `spawnMerc` (`src/content/roster.ts`). | Shards = level − 1, unspent. No upgrades in the story, since hiring is only at the Guild House. Endless recruits from phase p arrive with p − 1 upgrades picked at random. |
| Trainer | Resets every point for gold. Still to build (mj-trainer-synergies). | Resets shards for gold. Upgrades stay. Simpler to build. |
| The 3 built jobs | Add prerequisite and synergy data. Skill code changes only where a synergy is read. | Reshape 45 nodes into 12 spells, 3 passives and 36 upgrades. About 30 of the 36 reuse code that exists. Each needs a patch and a test. |
| The 4 new jobs | 60 nodes, as the 12 briefs say now. | 4 × (4 spells + 1 passive + 12 upgrades) = 68 pieces. Doc 09's trees need a design pass first. |
| Tests | `test/sim/tree-skills.test.ts` (48 cases) mostly stands. `test/support/build.ts` follows the new rules. | Most of `tree-skills.test.ts` moves to spells and upgrades. `test/support/build.ts` is rewritten. |

- Option A is about one S to M node before job-registry, plus small data in each job brief.
- Option B is about two M nodes before job-registry: one for rules and saves, one for the UI and offers. It also needs a design pass for the 4 new jobs and a rewrite of the 12 job briefs into 8.

## The Vanguard under option A

Today's 15 nodes, with the new rules.

| Branch | Tier | Node | Needs | Synergy |
|---|---|---|---|---|
| Bulwark | 1 | Challenge (A) | | +0.3 s taunt per rank of Intercept |
| Bulwark | 2 | Shield Wall (A) | Challenge 3 | +0.2 s per rank of Bastion |
| Bulwark | 3 | Bastion (P) | Shield Wall 3 | |
| Bulwark | 4 | Rampart (A) | Bastion 3 | |
| Bulwark | 5 | Immovable (P) | Rampart 3, Vow 3 | |
| Breaker | 1 | Sunder (P) | | |
| Breaker | 2 | Crush (A) | Sunder 3 | +2 Earth buildup per rank of Sunder |
| Breaker | 3 | Shield Bash (A) | Crush 3 | |
| Breaker | 4 | Fault Line (A) | Shield Bash 3 | Earth buildup from Crush, as now. +5% damage per rank of Crush. |
| Breaker | 5 | Earthshaker (P) | Fault Line 3 | |
| Oathkeeper | 1 | Vow (P) | | |
| Oathkeeper | 2 | Intercept (A) | Vow 3 | |
| Oathkeeper | 3 | Shared Burden (P) | Intercept 3 | |
| Oathkeeper | 4 | Banner (A) | Shared Burden 3 | +1 s per rank of Vow |
| Oathkeeper | 5 | Last Line (P) | Banner 3, Challenge 3 | |

Two Vanguards at level 25, with 24 points each:

- **Breaker:** Sunder 3, Crush 5, Shield Bash 3, Fault Line 5, Earthshaker 1, Challenge 3, Shield Wall 3, Bastion 1. It has no Intercept and no Banner.
- **Oathkeeper:** Vow 3, Intercept 3, Shared Burden 3, Banner 5, Challenge 3, Last Line 1, Sunder 3, Crush 3. It has no Shield Wall and no Fault Line.

## The Vanguard under option B

4 spells, 1 innate passive and 12 upgrades. Ranks run 1 to 10, so each per-rank gain is half of today's.

**Innate: Sunder.** Melee hits lower the target's armor by 4 per stack, up to 5 stacks.

| Spell | At rank r | Upgrade | What it changes | From doc 09 |
|---|---|---|---|---|
| Challenge | Taunts every enemy within 3 tiles for 3 + 0.25r s | Last Line | Also fires by itself, once an area, when the bearer drops below 30% health. It taunts within 5 tiles of the bearer. | Last Line |
| | | Banner | Also plants a banner for 10 s. Allies within 4 tiles gain morale and take half the dread buildup. | Banner |
| | | Shield Bash | Becomes a shove on one enemy: 100% damage, 50 + 5r stun buildup, interrupts casts. It taunts only that enemy. | Shield Bash |
| Shield Wall | For 2 + 0.25r s, stops physical blows from the front and halves magic from it. Cannot move. | Immovable | No stun, Petrify or Dread during it. Lasts 1 s longer. | Immovable |
| | | Rampart | Plants a wall toward the nearest archer for 4 + 0.5r s instead. The Vanguard can move. Projectiles that fly into the wall stop. | Rampart |
| | | Bastion | Allies within 2 tiles behind it get the same cover from the front. | Bastion |
| Crush | 140 + 10r% damage, 30 + 5r Earth buildup | Fault Line | Becomes a 5-tile shockwave in a line. Every enemy in it takes 80% of Crush's damage and buildup. | Fault Line |
| | | Earthshaker | When the target is Petrified, every enemy within 3 tiles of it gets 40 Earth buildup. | Earthshaker |
| | | Sundering Blow | Puts all 5 Sunder stacks on the target at once. | New |
| Intercept | Dashes up to 4 + 0.5r tiles between the bearer and the nearest threat | Vow | On arrival, the Vanguard and the bearer gain +20 armor for 6 s. | Vow |
| | | Shared Burden | For 5 s after the dash, the Vanguard takes 30% of every hit on the bearer. | Shared Burden |
| | | Charge | Each enemy the dash passes through gets 40 stun buildup and is pushed aside. | New |

- All 15 of today's nodes are used. Two upgrades are new.
- Pushing aside needs knockback, which doc 12 lists for the Arbalist and Sapper. Charge waits for it, or drops the push.

Two Vanguards at the end of a run:

- **Wall:** Challenge with Banner, Shield Wall with Immovable, Crush with Sundering Blow, Intercept with Vow. Shards in Shield Wall and Challenge.
- **Breaker:** Challenge with Shield Bash, Shield Wall with Rampart, Crush with Fault Line, Intercept with Charge. Shards in Crush.

The first holds a crowd in place. The second stuns, breaks lines and lets the archers through to its wall.

## Choosing for four mercs

The player builds 4 mercs at once. Each rule below keeps that from becoming a chore. Most apply to both options.

- **Auto spend.** Each merc has an Auto switch for its points or shards. Option A follows a branch the player marks. Option B raises the spell the player stars, then the lowest. Points still show on the party card for players who spend by hand.
- **One offer, one pick.** A Mastery chest shows 3 cards, each for a different merc. The player picks 1 card. That is one choice, not four.
- **Offers at a stop.** The Waystation offers come while the game is paused and the paymaster is open, where the player already makes choices.
- **Fewer rows.** 4 spells give 4 per-skill orders instead of up to 8.
- Stat points (3 per level) are not part of this decision. They add 240 choices per party per run, and an Auto switch would help there too.

## Recommendation

Option B, with an innate passive per job and doc 09's nodes as the upgrade pool.

- It answers the complaint directly. Two mercs of one job differ because their offers differ, and an upgrade changes how a merc plays, not only its numbers.
- It fits a roguelite with no unlocks between runs. Variety comes from the run, not from the player's plan.
- It makes the AI easier to read and test: 4 actives in a fixed order.
- It costs more than option A: two engine nodes, a design pass for the 4 new jobs, and a rewrite of the job briefs. Job-registry waits for all of that.
- It loses breadth. A merc never has 8 actives, and a passive that is not innate exists only as an upgrade.

If the cost is too high now, option A with the numbers above fixes the "every merc gets everything" math for one small node. It does not add variety between runs.

### Numbers to start from (option B)

| Item | Value |
|---|---|
| Spells per job | 4, known from level 1 at rank 1 |
| Innate passives per job | 1, no rank |
| Shards | 1 per level past the first. A merc at `START_LEVEL` 5 has 4. About 24 by level 25. |
| Spell ranks | 1 to 10 |
| Rank cap | 1 + floor(level / 2): 3 at level 5, 6 at level 10, 10 at level 18 |
| Shards to max all 4 spells | 36. A merc has about 24, so it maxes 2 spells, or spreads. |
| Gain per rank | Half of today's per-rank gain, so rank 10 is about today's rank 5 |
| Upgrades per spell | 3 |
| Upgrades a spell holds | 1, for the rest of the run |
| Offer | 3 cards, pick 1 |
| Waystation offer | At the Waystations of phases 2 to 4: each living merc picks 1 of 3 from its own spells. 3 picks per merc. |
| Mastery reward | A new road reward. 1 pick of 3 cards, each for a different living merc. |
| Full slots | A merc with 4 upgrades gets a card for +2 shards instead. |
| Trainer | Resets shards for half the merc's wage (`wageFor` in `src/content/recruits.ts`). Upgrades are not reset. |
| Recruits | Shards = level − 1, unspent. Endless recruits from phase p arrive with p − 1 random upgrades. |

With 3 Waystation picks, a merc needs one Mastery pick to fill its 4th slot. A party of 4 needs 4 Mastery picks to fill every slot, and each pick fills one. So a party often ends with an empty slot unless it takes Mastery roads over Gold or Arms. That is the intended pressure on the choice of road.

## What it replaces in doc 09

Under option B:

- The Rules section: points, ranks, tiers, `TIER_LEVEL`, prerequisites, synergies and the trainer. This doc's numbers replace them.
- The "In the game so far" table stays as the record of what each skill does. Its per-rank column is halved.
- The starting job trees become source lists. Each job is redrawn as 4 spells, 1 innate passive and 12 upgrades, as the Vanguard is above.
- "Other jobs" outlines stay outlines. They are written as spells and upgrades when refined.

Under option A:

- The Rules section changes: prerequisites need 3 ranks, the rank cap, cross-branch prerequisites and the synergy list are added.
- Each tree gains a "Needs" and a "Synergy" note per node, as the Vanguard table above.

## Open questions

- A, B or C?
- Under B, can a spell hold 2 upgrades instead of 1? The Labyrinth stacks them. It triples the pairs to test.
- Under B, are shards earned per merc level, or a party pool from area clears that the player assigns?
- Under B, is one innate passive per job right, or none?
- Under B, are the upgrade sources right: the Waystations of phases 2 to 4 and a Mastery road reward?
- Should Auto spend be on by default?
