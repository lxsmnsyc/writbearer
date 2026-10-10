# Mercenaries

## Party size

- Up to 4 active mercs and 2 on the bench.
- Four keeps the AI readable and the screen clear. It still leaves room for a tank, a damage dealer, a support and one flexible slot.
- The bench can only be swapped at a Camp or a Town.
- The run starts with 1 merc, picked from 3 offers rolled from the seed.

### Recruiting window

Mercs can only be recruited in phases 1 and 2. Phases 3 and 4 are for building the party the player already has.

| Phase | Focus |
|---|---|
| 1 | Gather mercs. Taverns, wandering mercs and events offer recruits. |
| 2 | Finish the roster. The last chance to recruit. |
| 3 | Build: gear, cards, refines, skill points. No recruits. |
| 4 | Build and prepare for the final fight. No recruits. |

- In phases 3 and 4, no tavern, wandering merc or event offers a recruit.
- A merc lost in phases 3 or 4 cannot be replaced. Dismissing one shrinks the party for good. Resurrection matters more.
- Contracts can still be renewed in phases 3 and 4.
- The lore gives the reason: below the Rift Road, no one is left to hire.
- Endless mode has no story. It offers recruits in every phase, since the party has no other way to replace losses.

## Wages and contracts

- Each merc asks for pay at the start of each phase.
- An unpaid merc loses morale. Low morale leads to ignoring toggles, then deserting, then betrayal.
- Each contract lasts a number of phases. When it ends, the player renews it or the merc leaves.
- Wages are the main brake on party size.

## Stats

The player raises stats with points on level up.

| Stat | Effect |
|---|---|
| STR | Melee attack. Carry limit for equipment. |
| AGI | Attack speed. Evasion. A little move speed. |
| VIT | Max health. Physical soft defense. Resists stun and bleed. |
| INT | Magic attack. Max mana. Element buildup. |
| DEX | Accuracy. Ranged attack. Crit rate. Shorter cast time. |
| WIL | Mana regeneration. Magical soft defense. Resists fear, silence and curse. Morale. |

The first five follow rAthena. WIL replaces LUK, since mercs do not loot and luck-based drops belong to the citizen.

### Discipline

Discipline is how well a merc follows the player's toggles. It turns control into a resource. A strong but undisciplined merc hits hard and ignores orders. A disciplined merc does what it is told.

#### Value

- Discipline goes from 0 to 100.
- A new recruit starts between 10 and 40, set by its job and traits.
- It is not raised with stat points.

It goes up through:

- Levels: +1 per level.
- Drill at a Camp: +5. This uses the Camp action, so the merc does not rest.
- Bard skills.
- Items and cards.
- The Veteran trait: +10.

It goes down through:

- An unpaid wage: -10.
- Some events, such as a failed bribe or a betrayal in the party.

#### Effective Discipline

Morale scales Discipline in combat.

```
effective = discipline * moraleFactor
```

| Morale | Factor |
|---|---|
| High | 100% |
| Normal | 90% |
| Low | 70% |
| Broken | 50% |

Occult Dread lowers morale, so it also lowers effective Discipline for a while.

#### Effect 1: how many toggles the merc follows

| Effective Discipline | Target priorities | Behavior flags | "Save for elites" on skills |
|---|---|---|---|
| 0 to 19 | 1 | 1 | No |
| 20 to 39 | 2 | 2 | Yes |
| 40 to 59 | 2 | 3 | Yes |
| 60 to 79 | 3 | 4 | Yes |
| 80 to 100 | 3 | All | Yes |

- Toggles beyond the limit show as greyed out in the UI. The player picks which ones stay active.

#### Effect 2: traits against toggles

- A trait sometimes wants an action that a toggle forbids. Example: a Cowardly merc at 25% health, with "Retreat when health is low" turned off.
- Each time this happens, the trait wins with a chance of `(100 - effective) / 2` percent.
- At 0 Discipline the chance is 50%. At 60 it is 20%. At 100 the trait never wins.
- The roll uses the pseudo-random distribution from `prd.ts`, so long streaks are rare.
- The UI shows this chance on the merc sheet.

#### Effect 3: shout response

- Mercs react to the citizen's shouts after a delay of `0.2 + (100 - effective) * 0.01` seconds.
- At 0 Discipline the delay is 1.2 seconds. At 100 it is 0.2 seconds.

#### Why

- Cheap mercs with bad traits are cheap for a reason.
- Paying wages has a combat effect, through morale.
- The Bard has a clear job.
- Some skills check Discipline, such as the Arcanist's Controlled Burn. See [skill trees](09-skill-trees.md).

### Derived values

- Health, mana, accuracy, evasion, crit rate, attack speed, cast speed, armor, resistance, move speed, threat.
- Computed in full from job, level, stats, passives and equipment. See [tech stack](02-tech-stack.md#stats).

### Requirements

- Items have STR and DEX requirements, as in Diablo 2.
- Heavy armor slows a merc whose STR is below its requirement.
- This ties stat allocation to gear choices.

## Skill trees

- Each job has 3 branches of 5 skills. The last skill of each branch is a capstone.
- Skills are active or passive. Both use the same `setup` shape. See [combat engine](03-combat-engine.md#skill-definition).
- The rules and every tree are in [skill trees](09-skill-trees.md).

## Autonomy

Each merc's behavior has three layers.

### 1. Stance

The player picks one:

- Guard citizen: stays within a few tiles of the citizen.
- Hold line: holds a position the citizen marks.
- Advance: pushes ahead and clears the path.
- Skirmish: flanks and chases.

### 2. Toggles

Target priority. The player checks up to 3, in order:

- Enemies attacking the citizen.
- Casters and healers. In the game: monsters that have skills.
- Heralds running to an alarm bell. See [stages](11-stages.md#alarms).
- Lowest health.
- Elites.
- Weak to my element.
- Marked by the citizen.
- Nearest.

Per skill:

- Auto.
- Save for elites and bosses.
- Off.

Behavior flags:

- Do not use friendly fire skills near allies or the citizen.
- Do not chase beyond N tiles.
- Retreat when health is low.
- Pick up loot. A Greedy merc may pick up loot even when this is off. See [Discipline](#discipline).

Belt use:

- Drink potions at 50%, at 30%, or only in emergencies.

### 3. Personality traits

Rolled when the merc is recruited. They cannot be changed.

| Trait | Effect |
|---|---|
| Brave | Never retreats. |
| Cowardly | Flees below 25% health. |
| Greedy | Wants to run for loot during combat. Asks for higher wages. |
| Loyal | Morale bonus. Guards the citizen more often. |
| Glory-seeker | Prefers elites. |
| Drunkard | Random buffs and penalties. |
| Bloodthirsty | Chases kills. Ignores retreat. |
| Veteran | One extra toggle slot. |
| Hates a job | Morale penalty when that job is in the party. |
| Devout | Resists Occult. Refuses to work with a Necromancer. |

### Movement

- Toggles choose what to do. A utility score chooses where to stand.
- The score weighs safety, distance to the citizen, distance to the target and flanking angle.

## Death and resurrection

Based on rAthena, where a dead character stays on the ground until it is resurrected.

- At 0 health a merc dies. Its corpse stays where it fell.
- A dead merc stays dead until it is resurrected. There is no timer.
- Ways to resurrect:
  - The Cleric's Resurrection skill.
  - A resurrection item, based on rAthena's Yggdrasil Leaf. The citizen uses it while standing next to the corpse. A merc can also use one from its belt.
  - A Temple in a Town, for gold.
- When the party leaves a stage, its dead mercs come along. They still take a party slot.
- Dead mercs draw no wage. Their contract still counts down.
- If a contract ends while the merc is dead, the merc is gone for good.
- A resurrected merc comes back with low health and may gain an injury.
- If every merc is dead, the citizen goes on alone until a merc is resurrected or the citizen dies.

### Injuries

- An injury is a lasting penalty that a Temple can treat.
- Scars from injuries can add small bonuses too, such as fear resistance.

## Jobs are permanent

- As in Inotia, a merc keeps its job for life. There are no job changes.
- The only way to change the party is to dismiss a merc and recruit another.
- A dismissed merc leaves with what it has equipped. The player can unequip it first at a Camp or Town.
- A dismissed merc does not come back in the same run.

## Jobs

| Job | Role | Element | Hook |
|---|---|---|---|
| Sellsword | Generalist | Neutral | Cheap wage. Good first pick. |
| Vanguard | Tank | Earth | Taunts, shield wall, intercepts. |
| Warden | Bodyguard | Neutral | Stays by the citizen. Counters anyone who hits the citizen. |
| Duelist | Melee damage | Neutral | Parries. Single-target executes. Daggers and swords. |
| Ranger | Ranged damage | Storm | Prefers flyers. Sets traps. |
| Arcanist | Area magic | Fire, Frost | High damage. Its strongest spells have friendly fire. |
| Cleric | Healer | Radiant | Heals, cleanses, Ward barriers. |
| Bard | Support | Neutral | Auras. Restores morale. Raises Discipline of others. |
| Alchemist | Utility | Venom, Fire | Uses belt items at double strength. Crafts potions at camp. |
| Sapper | Control | Fire, Earth | Bombs. Breaks walls. Opens shortcuts in stages. |
| Beastmaster | Pet | Earth | The pet takes half a party slot. |
| Scout | Recon | Neutral | Reveals hidden map nodes. Disarms traps. |
| Hexblade | Debuff | Occult | Curses. Lifesteal. |
| Necromancer | Summons | Occult | Raises dead enemies. Morale penalty with Clerics. |

- Every job is available from the first run.
- The 3 offers at the start of a run come from the simpler jobs: Sellsword, Vanguard, Warden, Duelist, Ranger, Arcanist and Cleric.
- The other jobs appear later through taverns, events and wandering mercs.
