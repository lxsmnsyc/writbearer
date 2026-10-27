# Builds

How a merc grows during a run. Option B, four spells with upgrades, is chosen (build-variety, 2026-10-27). The comparison with real trees stays below as the record. The seven starting jobs are drawn under option B: [Vanguard](#the-vanguard-under-option-b) and [the other six](#the-other-six-starting-jobs-under-option-b).

## Decisions

These match `docs/roadmaps/writbearer/GOAL.md`. Where a later section disagrees, this section wins.

- Each job has 4 spells, known from level 1, and 1 innate passive with no rank and no choice.
- Spells are listed in cast order. The AI casts the first spell whose rule wants to fire. The last spell is the always-ready filler.
- Each spell holds at most 1 elite upgrade, which changes how the spell works. It is kept for the run.
- Shards are the regular upgrades. They stack. A merc gets 1 shard per level past the first, and each shard raises one spell by one rank. Ranks run from 1 to 10, capped at 1 + floor(level / 2).
- Elite upgrades come from the Waystations of phases 2 to 4 and from a Mastery road reward.
- There is no Auto spend. The player spends shards by hand.
- Doc 09's trees are the pool for spells and upgrades. Synergies are dropped.
- Per-rank gains are half of today's, so rank 10 is about today's rank 5.

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

**Cast order:** Intercept, Challenge, Shield Wall, Crush. Crush is the filler.

**Innate: Sunder.** Melee hits lower the target's armor by 4 per stack, up to 5 stacks.

| Spell | At rank r | Upgrade | What it changes | From doc 09 |
|---|---|---|---|---|
| Intercept | Dashes up to 4 + 0.5r tiles between the bearer and the nearest threat | Vow | On arrival, the Vanguard and the bearer gain +20 armor for 6 s. | Vow |
| | | Shared Burden | For 5 s after the dash, the Vanguard takes 30% of every hit on the bearer. | Shared Burden |
| | | Charge | Each enemy the dash passes through gets 40 stun buildup and is pushed aside. | New |
| Challenge | Taunts every enemy within 3 tiles for 3 + 0.25r s | Last Line | Also fires by itself, once an area, when the bearer drops below 30% health. It taunts within 5 tiles of the bearer. | Last Line |
| | | Banner | Also plants a banner for 10 s. Allies within 4 tiles gain morale and take half the dread buildup. | Banner |
| | | Shield Bash | Becomes a shove on one enemy: 100% damage, 50 + 5r stun buildup, interrupts casts. It taunts only that enemy. | Shield Bash |
| Shield Wall | For 2 + 0.25r s, stops physical blows from the front and halves magic from it. Cannot move. | Immovable | No stun, Petrify or Dread during it. Lasts 1 s longer. | Immovable |
| | | Rampart | Plants a wall toward the nearest archer for 4 + 0.5r s instead. The Vanguard can move. Projectiles that fly into the wall stop. | Rampart |
| | | Bastion | Allies within 2 tiles behind it get the same cover from the front. | Bastion |
| Crush | 140 + 10r% damage, 30 + 5r Earth buildup | Fault Line | Becomes a 5-tile shockwave in a line. Every enemy in it takes 80% of Crush's damage and buildup. | Fault Line |
| | | Earthshaker | When the target is Petrified, every enemy within 3 tiles of it gets 40 Earth buildup. | Earthshaker |
| | | Sundering Blow | Puts all 5 Sunder stacks on the target at once. | New |

- All 15 of today's nodes are used. Two upgrades are new.
- Pushing aside needs knockback, which doc 12 lists for the Arbalist and Sapper. Charge waits for it, or drops the push.

Two Vanguards at the end of a run:

- **Wall:** Challenge with Banner, Shield Wall with Immovable, Crush with Sundering Blow, Intercept with Vow. Shards in Shield Wall and Challenge.
- **Breaker:** Challenge with Shield Bash, Shield Wall with Rampart, Crush with Fault Line, Intercept with Charge. Shards in Crush.

The first holds a crowd in place. The second stuns, breaks lines and lets the archers through to its wall.

## The other six starting jobs under option B

Same form as the Vanguard. Each per-rank gain is half of today's, so rank 10 is about today's rank 5. Where today's game has no number, the number is a first guess.

- Spells are listed in cast order. The AI casts the first spell in the list whose rule wants to fire (`useSkill` in `src/sim/ai.ts`). The last spell is always ready, so the merc never stands idle.
- "From doc 09" names the skill an upgrade comes from. "New" means doc 09 has no such skill.
- An upgrade that needs a system the engine lacks has a **Needs** line under the table.
- Each job is drawn so that its 4 spells and its innate passive already play its role with no upgrade.

### Ranger

Striker. Storm, bows. It kills from behind the guard and punishes groups.

The 4 spells alone: Snare holds the nearest threat, Lightning Rod and Charged Arrow work the crowd, Aimed Shot picks off the one that matters.

**Cast order:** Snare, Lightning Rod, Aimed Shot, Charged Arrow.

**Innate: Static.** Storm hits add 25% more Shock buildup.

| Spell | At rank r | Upgrade | What it changes | From doc 09 |
|---|---|---|---|---|
| Snare | Roots the nearest enemy close to the bearer for 1.5 + 0.25r s | Rearguard | Also lays a snare on the tile the bearer stood on 5 s ago. In a fight, it lays one by itself every 7 s. Two at a time. | Rearguard |
| | | Bait | Becomes a decoy placed past the nearest threat for 3 + 0.25r s. Monsters within 5 tiles go to it. Bosses ignore it. | Bait |
| | | Spike Field | Becomes a 2-tile field for 6 s. It slows by half and bleeds 1% of max health a second. It does not root. | Spike Field |
| Lightning Rod | A 2.5-tile Storm field for 5 + 0.5r s. It strikes each enemy in it for 35 + 5r% damage a second. | Killing Ground | When the bearer shouts Hold, the rod is planted on the Hold point at once and ringed with 6 snares. | Killing Ground |
| | | Storm Cell | Each strike adds 20 Shock buildup. An enemy that becomes Shocked in the field is stunned for 1 s. | New |
| | | Overcharge | When the field ends it bursts for 150% damage and 40 Shock buildup on every enemy inside. | New |
| Aimed Shot | A long windup, then 200 + 15r% damage | Pin Down | Also roots the target for 1 + 0.25r s. It grounds a flyer once flyers exist. | Pin Down |
| | | Eagle Eye | +3 tiles of reach. It never misses a flyer, once flyers exist. | Eagle Eye |
| | | Killshot | A shot at an enemy that had not noticed the party is a critical at double damage and needs no windup. | Killshot |
| Charged Arrow | 90 + 8r% damage, chains once | Arc Volley | Fires 3 arrows at different enemies, 70% damage each. Each chains once. | Arc Volley |
| | | Thunderhead | A Shocked target sends a bolt to every Shocked enemy within 6 tiles for 60% Storm damage. | Thunderhead |
| | | Piercing Arrow | Does not chain. Hits every enemy in a line for 150 + 8r% damage. | Piercing Arrow |

- All 15 of today's nodes are used: 4 spells, Static and 10 upgrades. Two upgrades are new.
- **Needs:** flyers, for the flyer clauses of Pin Down and Eagle Eye. Rooting and reach work now. Everything else is in the game today.

Two Rangers at the end of a run:

- **Sniper:** Aimed Shot with Killshot, Charged Arrow with Piercing Arrow, Snare with Rearguard, Lightning Rod with Overcharge. Shards in Aimed Shot.
- **Stormcaller:** Charged Arrow with Thunderhead, Lightning Rod with Storm Cell, Aimed Shot with Pin Down, Snare with Spike Field. Shards in Charged Arrow and Lightning Rod.

The first picks one target at a time and guards the bearer's back with traps. The second shocks whole groups and does not care which one it aims at.

### Cleric

Support. Radiant. It keeps the party and the bearer alive and fights the dead.

The 4 spells alone: Ward before the blow, Heal after it, Sacred Ground for a long fight, Smite when nobody needs help.

**Cast order:** Ward, Heal, Sacred Ground, Smite. Today's rule stays: a healer keeps 25 mana back for Heal and Sacred Ground.

**Innate: Aegis.** 3 s out of a fight, the bearer's Ward fills to 80 + 4 per Cleric level. It costs no cast.

| Spell | At rank r | Upgrade | What it changes | From doc 09 |
|---|---|---|---|---|
| Ward | A Ward of 30 + 8r, plus magic attack, on whoever an enemy is after. It absorbs magic damage. | Cleanse | Also removes harmful statuses and clears their buildup from the target. | Cleanse |
| | | Wall of Faith | Also puts a barrier on the target's tile that stops the next 2 + 0.5r melee blows on anyone in it. | Wall of Faith |
| | | Twin Ward | Casts on the two allies in most danger. Each gets 60% of the pool. | New |
| Heal | 40 + 10r health, plus magic attack, on one ally or the bearer | Renew | Becomes a heal over time: 8 + 3r health a second for 6 s. | Renew |
| | | Resurrection | Can target a dead merc. A long windup, then it rises with 10 + 5r% health. | Resurrection |
| | | Martyr | When the Cleric dies, every dead ally within 5 tiles rises with 20% health. Heal itself is unchanged. | Martyr |
| Sacred Ground | 2.2 tiles for 8 s, healing 6 + 2.5r a second, plus a quarter of magic attack | Veil | Becomes a 2.5-tile veil around the bearer for 4 + 0.5r s. It stops ranged physical hits inside. It does not heal. | Veil |
| | | Consecrate | The ground also burns enemies inside for 40 + 5r% Radiant magic damage a second. | Consecrate |
| | | Pilgrim's Rest | Allies inside also regain 2 mana a second and 0.5 morale a second. | New |
| Smite | 110 + 10r% magic damage, half again on the Undead and Occult | Turn Undead | Also a 15 + 2r% chance, plus up to 30% as the target is hurt, to destroy a non-boss Undead. | Turn Undead |
| | | Purge | Marks an Occult target for 8 s. The party deals 25% more damage to it. | Purge |
| | | Holy Light | Doubles the Sear buildup, and half of it spreads to enemies within 2 tiles of the target. | Holy Light |

- All 15 of today's nodes are used: 4 spells, Aegis and 10 upgrades. Two upgrades are new.
- **Needs:** Consecrate's "corpses inside cannot be raised" waits for corpse raising. Purge's phase-start corruption removal is dropped here and returns with the corruption system (story-bearer). Veil has nothing to stop until archers exist.

Two Clerics at the end of a run:

- **Medic:** Heal with Resurrection, Ward with Cleanse, Sacred Ground with Pilgrim's Rest, Smite with Holy Light. Shards in Heal and Sacred Ground.
- **Inquisitor:** Smite with Turn Undead, Sacred Ground with Consecrate, Ward with Wall of Faith, Heal with Renew. Shards in Smite and Sacred Ground.

The first can raise a merc that fell. The second fights the dead and the Occult from inside its own fire.

### Sellsword

Striker. Neutral. A cheap generalist that wins by wearing enemies down and by not dying.

The 4 spells alone: Rush answers a threat to the bearer, Pocket Sand and Hamstring soften the rest, Cleave kills whoever stays close.

**Cast order:** Rush, Pocket Sand, Hamstring, Cleave. Cleave is the filler. With one enemy near, it is a plain attack.

**Innate: Second Wind.** Once per stage, at 30% health, it heals 20% of max health.

| Spell | At rank r | Upgrade | What it changes | From doc 09 |
|---|---|---|---|---|
| Rush | Charges an enemy that is attacking the bearer, with 40 + 4r stun buildup | Shield Rush | After it arrives, the Sellsword taunts that enemy for 3 s. | New |
| | | Chain Rush | If the target dies within 2 s, it rushes the next enemy attacking the bearer, free. | New |
| | | Knock Aside | The target is pushed 2 tiles away from the bearer. | New |
| Pocket Sand | A cone that adds 40 + 5r blind buildup | Bribe | Becomes a bribe. It costs gold and mana, and a non-elite Human enemy leaves the fight. | Bribe |
| | | Play Dead | The first time the Sellsword would die in a stage, it throws sand, lies still for 3 s and gets up with 20% health. Monsters ignore it while it lies still. | Play Dead |
| | | Salt the Wound | Blinded enemies take 15% more damage from every merc. | New |
| Hamstring | 110 + 8r% damage, slows the target by 30 + 2r% for 3 s | Low Blow | +25% crit rate against blinded or slowed targets. | Low Blow |
| | | Cutpurse | Each hit has a 15% chance to steal one buff from the target and keep it. | Cutpurse |
| | | Cripple | Hamstring on an already slowed target roots it for 1.5 s. | New |
| Cleave | 100 + 8r% damage to up to 3 enemies in the front arc | Weapon Habit | +20% attack speed with the weapon type the Sellsword has used longest this run. | Weapon Habit |
| | | Veteran of Many Wars | Cleave counts as 1 rank higher for each phase the Sellsword survives, up to +3. Shards still add to it. | Veteran of Many Wars |
| | | Pocket Change | Enemies killed by Cleave drop 50% more gold. | Pocket Change |

- 12 of today's 15 nodes are used: 4 spells, Second Wind and 7 upgrades. Five upgrades are new, because three nodes are dropped.
- **Dropped:** Hazard Pay and Paid in Full need extra pay at the paymaster, which is neither built nor designed. Haggler is a town discount, which is not a way a spell works. If the user wants overpay, it is a new system and these return as upgrades.
- **Needs:** Knock Aside needs knockback. Cutpurse needs taking enemy buffs (doc 12, Sage). Bribe needs the sim to spend gold. Weapon Habit needs a count of use per weapon type. Pocket Change needs a gold multiplier on a kill.

Two Sellswords at the end of a run:

- **Veteran:** Cleave with Veteran of Many Wars, Rush with Chain Rush, Hamstring with Low Blow, Pocket Sand with Play Dead. Shards in Cleave.
- **Dirty Fighter:** Cleave with Pocket Change, Rush with Shield Rush, Hamstring with Cutpurse, Pocket Sand with Bribe. Shards in Pocket Sand and Hamstring.

The first is a bruiser that grows with each phase. The second trades blows for gold and steals from what it fights.

### Warden

Guard. Neutral. The bodyguard: it stands by the bearer and punishes anyone who touches them.

The 4 spells alone: Cover shields the bearer, Tripwire marks what comes near, Execute and Pursue finish the marked. Interpose, the innate, does the guarding.

**Cast order:** Cover, Execute, Pursue, Tripwire. Execute comes before Pursue so that a marked enemy at low health dies where it stands. Tripwire is set when no enemy is close.

**Innate: Interpose.** Within 2 tiles of the bearer, the Warden takes hits aimed at the bearer at 70% of their damage. An enemy that damages the bearer is marked for 6 s. This is the mark doc 09 gives Marked for Death. Its damage bonus is an upgrade.

| Spell | At rank r | Upgrade | What it changes | From doc 09 |
|---|---|---|---|---|
| Cover | Pulls the bearer behind the Warden. For 3 + 0.25r s, projectiles from the front cannot reach the bearer. | Living Shield | During Cover, Interpose takes 40% and each hit taken becomes a Ward on the Warden. | Living Shield |
| | | Tether | The Warden dashes to the bearer's side on cast. For the rest of Cover it follows the bearer at +30% speed, never more than 3 tiles away. | Tether |
| | | Retaliate | During Cover, anyone who damages the bearer takes a free attack from the Warden. | Retaliate |
| Execute | 120 + 12r% damage. It kills a marked non-boss enemy below 20% health. | Blood Debt | A kill heals the bearer for 10% of the enemy's max health. | Blood Debt |
| | | Hangman's Reach | The Warden first leaps up to 3 tiles to the target. | New |
| | | Last Rites | A kill resets Pursue and marks the nearest enemy. | New |
| Pursue | Leaps to a marked enemy, 100 + 8r% damage and 20 + 2r stun buildup | Marked for Death | Every merc deals 10% more damage to marked enemies. | Marked for Death |
| | | Debt Collector | +25% crit rate against marked enemies. | Debt Collector |
| | | Read the Room | Can leap to a hidden or disguised enemy and reveals it. It also reveals disguised enemies at the start of a stage. | Read the Room |
| Tripwire | An alarm trap. The enemy that triggers it is marked and slowed by 30 + 2r% for 4 s. | Sentry | While the trap stands, it reveals hidden and invisible enemies within 6 tiles of it. | Sentry |
| | | Night Eyes | The trap is a lantern post: no night penalty for the party within 5 tiles of it, and a wider light. | Night Eyes |
| | | Never Surprised | In an ambush, a Tripwire is already set at the entrance, and ambushers start stunned for 1 s. Ambush nodes also show on the map. | Never Surprised |

- All 15 of today's nodes are used: 4 spells, Interpose (with the mark of Marked for Death) and 10 upgrades. Two upgrades are new.
- **Needs:** hidden units (planned in this milestone) for Sentry and Read the Room. Night Eyes needs a light radius. Never Surprised needs an ambush marker on the map. If either is missing when the Warden is built, that upgrade waits. Retaliate and Last Rites need a free attack outside the normal attack timer.
- Pursue and Execute do nothing without a mark. Interpose and Tripwire give marks, so the Warden has a target in any fight that reaches the bearer.

Two Wardens at the end of a run:

- **Shadow:** Cover with Living Shield, Pursue with Marked for Death, Execute with Blood Debt, Tripwire with Sentry. Shards in Cover.
- **Hunter:** Cover with Retaliate, Pursue with Debt Collector, Execute with Last Rites, Tripwire with Never Surprised. Shards in Pursue and Execute.

The first soaks blows and keeps the bearer alive. The second picks the weakest enemy that came near the bearer and removes it.

### Duelist

Striker. Neutral. Daggers and swords: fast hits on one target, and a duel with the elite.

The 4 spells alone: Duel takes an elite out of the fight, Shadowstep removes a caster, Lunge closes the gap, Flurry kills the one in front. Riposte, the innate, covers defense.

**Cast order:** Duel, Shadowstep, Lunge, Flurry. Flurry is the filler.

**Innate: Riposte.** A 15% chance to parry a melee hit. A parry triggers a free counter.

| Spell | At rank r | Upgrade | What it changes | From doc 09 |
|---|---|---|---|---|
| Duel | Binds the Duelist and one elite for 4 + 0.5r s. Neither can target or be targeted by anyone else. | Grand Duel | Lasts until one of them dies. The Duelist gets +50% crit rate during it. | Grand Duel |
| | | Crowd Pleaser | During the Duel, the party's morale rises by 1 a second. | Crowd Pleaser |
| | | Taunt the Proud | Can be cast on an elite up to 6 tiles away. It walks to the Duelist and the Duel begins. | Taunt the Proud |
| Shadowstep | Teleports behind a caster or healer, then hits it for 130 + 10r% damage with the back bonus | Flourish | A kill with it restores 15 mana and 1 morale, and resets its cooldown. | Flourish |
| | | Smoke Step | Leaves a cloud on the start tile. Enemies lose track of the Duelist for 3 s. | New |
| | | Assassin's Mark | The target takes 20% more damage from the Duelist's next 3 hits. | New |
| Lunge | A thrust that closes the gap, 120 + 10r% damage | Feint | The thrust cannot be blocked. | Feint |
| | | Sidestep | Ends with a sidestep: +30% evasion for 3 s. | Sidestep |
| | | Untouchable | Fires by itself right after an evade, as a critical. | Untouchable |
| Flurry | Four quick hits, 40 + 4r% damage each, each through the full damage pipeline | Bleed Out | Crits add bleed, which deals True damage over time. | Bleed Out |
| | | Thousand Cuts | Each hit in a row on the same target adds 3% damage. Switching targets resets it. | Thousand Cuts |
| | | Backstab | +40% damage from behind. Facing matters. | Backstab |

- All 15 of today's nodes are used: 4 spells, Riposte and 10 upgrades. Two upgrades are new.
- **Needs:** Duel needs a bind between two units that blocks other targeting. Facing exists (`src/sim/unit.ts`), so Backstab and Shadowstep need no new system.

Two Duelists at the end of a run:

- **Bleeder:** Flurry with Bleed Out, Lunge with Feint, Duel with Grand Duel, Shadowstep with Flourish. Shards in Flurry and Duel.
- **Dancer:** Lunge with Untouchable, Flurry with Backstab, Duel with Crowd Pleaser, Shadowstep with Smoke Step. Shards in Lunge and Shadowstep.

The first picks one elite and does not leave it. The second never stands where it is hit and strikes from behind.

### Arcanist

Striker. Fire and Frost. Area magic: the highest damage of the seven, with its strongest spell able to hurt allies.

The 4 spells alone: Frost Nova answers anything that reaches the Arcanist, Fireball clears a crowd, Frost Shard and Firebolt are the two single-target bolts.

**Cast order:** Frost Nova, Fireball, Frost Shard, Firebolt. The two bolts swap by target (see the innate).

**Innate: Elemental Sense.** For each target, the Arcanist casts the bolt of the element the target is weaker to. If neither is better, Firebolt. This works with the "weak to my element" toggle.

| Spell | At rank r | Upgrade | What it changes | From doc 09 |
|---|---|---|---|---|
| Frost Nova | A ring of Frost around the Arcanist, 2.5 tiles, 90 + 8r% damage, 30 + 3r Freeze buildup | Glacial Wall | Becomes a wall of ice between the bearer and the enemies for 4 + 0.5r s. It blocks the path. | Glacial Wall |
| | | Rimefield | The ring leaves a frost field for 5 s. Enemies in it are slowed by 40%. | New |
| | | Cold Snap | Also fires by itself when an enemy first touches the Arcanist, once every 12 s, free. | New |
| Fireball | A Fire area, 2 tiles, 130 + 12r% damage. No friendly fire. | Volcano | Leaves a Fire field for 4 s. Allies inside deal 20% more Fire damage. | Volcano |
| | | Inferno | A 4-tile area, 200 + 15r% damage, at double mana cost. It has friendly fire, unless the Arcanist's effective Discipline is 60 or more. | Inferno, Controlled Burn |
| | | Echo | A 25% chance to cast it again for free. | Echo |
| Frost Shard | A Frost bolt, 100 + 8r% damage | Chill | Also slows the target by 30% for 3 s and adds chill buildup. | Chill |
| | | Shatterpoint | An enemy killed while Frozen shatters for Frost damage to enemies within 2 tiles. It leaves no corpse. | Shatterpoint |
| | | Overchannel | At 0 mana, it costs 5% of max health instead. | Overchannel |
| Firebolt | A Fire bolt, 100 + 8r% damage, 20 + 2r Burn buildup | Ignite | Burn buildup is doubled. A burning enemy that dies spreads Burn to enemies within 2 tiles. | Ignite |
| | | Mana Flow | Each hit returns 3 mana. | Mana Flow |
| | | Piercing Bolt | Passes through up to 3 enemies in a line. | New |

- All 15 of today's nodes are used: 4 spells, Elemental Sense and 9 upgrades. Controlled Burn merges into Inferno, so the friendly fire rule lives with the spell that causes it. Three upgrades are new.
- **Needs:** a spell cost paid in health, for Overchannel. Echo needs the last spell kept on the unit. Glacial Wall can reuse the wall of Rampart. Shatterpoint needs a flag that leaves no corpse.

Two Arcanists at the end of a run:

- **Pyre:** Fireball with Inferno, Firebolt with Ignite, Frost Nova with Cold Snap, Frost Shard with Overchannel. Shards in Fireball and Firebolt.
- **Winter:** Frost Shard with Shatterpoint, Frost Nova with Glacial Wall, Fireball with Echo, Firebolt with Mana Flow. Shards in Frost Shard and Frost Nova.

The first burns a wide area and risks its allies. The second freezes, shatters and walls off the bearer.

### How the seven fit together

- The four strikers differ in shape: Ranger by reach and chains, Sellsword by wearing down, Duelist by one target, Arcanist by area.
- The two guards differ: the Vanguard holds a crowd and breaks it, the Warden protects the bearer and kills the marked.
- The Cleric is the only support among the seven. A recruit slot for a support draws from the Cleric alone until more-jobs adds more.
- Every job has at least one upgrade or innate that cares about the bearer, as the design notes of doc 09 require.
- The seven jobs hold 84 elite upgrades, 12 each. 18 are new and 66 come from doc 09. Doc 09's 105 starting nodes become 28 spells, 7 innates, 66 upgrades, 3 dropped (Hazard Pay, Paid in Full, Haggler) and 1 merged (Controlled Burn, into Inferno).

## Choosing for four mercs

The player builds 4 mercs at once. Each rule below keeps that from becoming a chore. Most apply to both options.

- **No Auto spend** (decided). The player spends shards by hand. Shards still show on the party card.
- **One offer, one pick.** A Mastery chest shows 3 cards, each for a different merc. The player picks 1 card. That is one choice, not four.
- **Offers at a stop.** The Waystation offers come while the game is paused and the paymaster is open, where the player already makes choices.
- **Fewer rows.** 4 spells give 4 per-skill orders instead of up to 8.
- Stat points (3 per level) are not part of this decision. They add 240 choices per party per run.

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

## Questions and their answers

- A, B or C? B (see Decisions).
- Can a spell hold 2 upgrades? No, 1.
- Shards per merc level, or a party pool? Per merc level. Revisit if levels move to stage clears (GOAL.md, open questions).
- One innate passive per job? Yes.
- Upgrade sources? The Waystations of phases 2 to 4 and a Mastery road reward.
- Auto spend? None.
