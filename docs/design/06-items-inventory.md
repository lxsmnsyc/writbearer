# Items, equipment and inventory

Equipment and inventory follow rAthena: fixed equipment slots, refine levels, cards in sockets, and weight limits. Item stats are rolled per copy, as in Diablo 2.

## Inventory layers

### Citizen pack

- The main storage for the run.
- Limited by weight and by slot count, as in rAthena.
- Holds spare equipment, consumables, cards, quest items, trade goods and gold.
- Weight thresholds, based on rAthena's 50% and 90% rules:
  - Above 50%: the citizen moves 25% slower.
  - Above 90%: the citizen cannot sprint or hide.
  - Above 100%: the citizen cannot pick anything up.
- Capacity grows with the citizen's background, pack upgrades and trinkets.

### Merc loadout

Each merc has 8 equipment slots and a belt.

| Slot | Holds |
|---|---|
| Weapon | Main weapon. Two-handed weapons also fill Offhand. |
| Offhand | Shield, second weapon, focus or quiver. |
| Head | Helmets, hoods, circlets. |
| Body | Armor. |
| Cloak | Element and status resistance, as rAthena's garment slot. |
| Boots | Move speed and evasion. |
| Accessory 1 | Rings, amulets, charms. |
| Accessory 2 | Rings, amulets, charms. |

rAthena's three head slots are merged into one. Three would add little for an autonomous merc.

Belt:

- 3 or 4 consumable slots.
- The merc uses them on its own, following its belt toggles.
- The citizen restocks the belt.
  - Outside combat, from any distance.
  - In combat, only when standing next to the merc.

Equipment weight:

- Mercs have a carry limit from STR.
- Gear over the limit slows the merc.

### Caravan

- An optional mule or wagon, based on rAthena's cart.
- Adds storage weight.
- It is a unit in the stage. Monsters can attack it.
- It is a second thing to protect, so carrying more is a real risk.

### Vault

- The party's storage for the current run, based on rAthena's Kafra storage.
- It opens only at the Waystation at the start of each phase.
- Items in the vault are safe. Items in the pack and on the caravan can be stolen or lost.
- It has no weight limit and a fixed number of slots.
- It is emptied when the run ends. Nothing carries over to the next run.
- Opening it only at phase starts makes the player decide what to carry into the phase and what to leave behind.

## In the game so far

- **Bases:** 16 bases across the 8 slots, in `src/content/items.ts`. Each has an item level, weight, socket cap, jobs that can use it, and ranges for damage, armor and block. Some fit jobs not in the game yet, such as the Ash Staff, since about half of all drops should fit someone in the party.
- **Qualities:** Inferior, Normal, Superior, Magic and Rare, with the affix and socket limits from the table below. Inferior bases roll 20% lower, Superior 15% higher.
- **Affixes:** 15 prefixes and suffixes in tiers that share a group, gated by item level. Each item stores the bonuses its affixes rolled.
- **Starter gear:** mercs arrive in plain middle-roll gear: the Vanguard with an Arming Sword, a Tower Shield and a Mail Hauberk, the Ranger with a Hunting Bow and a Leather Jerkin. Their old built-in stats became this gear.
- **Drops:** from the `loot` stream. A normal monster drops equipment 30% of the time. An elite always drops 2 pieces, a boss 4. Gold drops 40% of the time. Elites and bosses roll better qualities.
- **The cache:** the chest on each stage opens when the bearer reaches it, for 3 pieces rolled as an elite's drop, plus gold.
- **Picking up:** click an item to walk over and take it. Gold is taken by walking over it. Labels show each item's name in its quality's color: grey for Crude, white for plain and Fine, teal for Magic, gold for Rare. What is left on a stage is lost when the party descends.
- **The pack:** 30 slots and 400 weight. Past half the weight, the bearer walks 25% slower. Past the limit, nothing more goes in.
- **Handing gear over:** press I. Click a pack item to hand it to the chosen merc, and a worn item to take it back. In a fight, meaning an awake monster within 8 tiles, the bearer must stand within 2 tiles of the merc. A merc's figure shows its weapon and shield.

- **Potions:** the Healing Draught (35% of health) and the Mana Tincture (40% of mana) restore over 3 seconds, in half-second pulses. The Greater Healing Draught (60%) drops from item level 7. Potions stack 10 to a pack slot and weigh 2 each. Monsters drop one 25% of the time, and a chest holds two. The bearer starts with 4 Healing Draughts and 2 Mana Tinctures.
- **The belt:** each merc has 3 belt slots of up to 5 potions. The Vanguard starts with 2 Healing Draughts, the Ranger with 2 and a Mana Tincture. Clicking a potion in the inventory puts it on the chosen merc's belt, under the same fight rule as gear. A merc drinks on its own: healing below its belt threshold, set in its orders at 50%, 30% or emergencies (15%), and mana below 25% in a fight if it has skills. One potion per second at most.
- **The bearer drinks** a Healing Draught from the pack with Q.

Not yet: identification, cursed items, uniques, sets, sockets with cards, refining, requirements and the vault. Rares drop identified for now.

## Item data

### Item base

Static data for each kind of item.

```ts
interface ItemBase {
  id: ItemId;
  name: string;
  type: ItemType;            // Weapon, Armor, Consumable, Card, Material, Quest, Trade
  slot?: EquipSlot;
  weaponType?: WeaponType;   // attack speed, reach, skill requirements
  tier: Tier;                // Normal, Exceptional, Elite
  level: number;             // item base level, as Diablo 2's qlvl
  weight: number;
  stackMax: number;
  requirements: { str?: number; dex?: number; int?: number; level?: number };
  base: BaseRolls;           // damage range, armor range, block, magic attack
  maxSockets: number;        // 0 to 4
  refinable: boolean;
}
```

### Item copy

Runtime data for one copy.

```ts
interface ItemCopy {
  uid: number;
  base: ItemId;
  itemLevel: number;          // level of the stage or monster that dropped it
  quality: Quality;
  baseRolls: Record<string, number>; // rolled damage or armor within the base range
  affixes: { id: AffixId; values: number[] }[];
  sockets: (CardId | null)[];
  refine: number;
  identified: boolean;
  cursed: boolean;
  quantity: number;
}
```

- Two copies stack only when everything but `uid` and `quantity` is equal. This follows wAthena decision 0014.
- Equipment does not stack.

## Quality

Based on Diablo 2.

| Quality | Affixes | Max sockets | Notes |
|---|---|---|---|
| Inferior | 0 | 2 | Lower base rolls. Cheap. |
| Normal | 0 | 4 | The best base for cards. |
| Superior | 0 | 3 | Higher base rolls. |
| Magic | 1 prefix, 1 suffix at most | 2 | |
| Rare | 3 to 6, at most 3 prefixes and 3 suffixes | 1 | Can carry an element. |
| Unique | Fixed list, each value rolled in a range | 0 or 1, fixed per item | Named items with special effects. |
| Squad set | Fixed list plus set bonuses | 0 | See below. |
| Cursed | Strong affixes plus a behavior change | 1 | This game's own quality. |

The fewer affixes an item has, the more sockets it can have. This gives two ways to gear a merc:

- A Normal item with 4 sockets is built from cards.
- A Rare item with 1 socket is built from rolled affixes.

### Cursed items

- Strong stats with a drawback that changes how the merc acts.
- Example: "Bloodthirsty: the merc ignores the Guard citizen stance."
- A Temple can remove the curse. The item loses its strong affix too.

### Squad sets

Squad sets come after uniques are tested. See [milestones](02-tech-stack.md#later-milestones).

In Diablo 2, a set is a group of named items, such as the 5 pieces of Tal Rasha's Wrappings. Each piece has its own stats. Wearing more pieces of the same set on one character unlocks extra bonuses, and wearing all of them unlocks a full set bonus.

A squad set uses the same idea, but counts pieces across the whole party instead of one character.

Rules:

- Each piece has its own fixed stats, which only help the merc wearing it.
- A piece counts toward its set while a living merc in the active party wears it. Bench mercs and dead mercs do not count.
- Set bonuses apply to the whole party, and some apply to the citizen.
- Bonuses unlock at 2 pieces, 3 pieces and the full set.
- Two pieces of the same set on one merc count once. This pushes the player to spread the set.

Why it fits this game:

- It rewards keeping the same party together.
- Losing a merc also loses a set bonus, which adds weight to every death.
- It makes the player gear the party as a whole, not each merc alone.

Example: Oath of the Iron Company, 4 pieces.

| Piece | Slot | Own stats |
|---|---|---|
| Iron Company Helm | Head | +armor, +VIT |
| Iron Company Hauberk | Body | +armor, -10% damage from ranged |
| Iron Company Banner | Offhand | +block, +morale |
| Iron Company Signet | Accessory | +Discipline 5 |

| Pieces worn in the party | Bonus |
|---|---|
| 2 | Every merc gets +10% armor. |
| 3 | Every merc gets +10 Discipline. |
| 4 | The citizen gets a Ward that refills after each fight. |

Example: Rites of the Pale Choir, 3 pieces, for Radiant mercs.

| Pieces worn in the party | Bonus |
|---|---|
| 2 | Radiant damage +15% for the party. |
| 3 | Once per stage, the first merc to die is resurrected at 30% health. |

## Affixes

```ts
interface Affix {
  id: AffixId;
  kind: 'prefix' | 'suffix';
  group: string;            // only one affix per group on an item
  level: number;            // minimum item level, as Diablo 2's alvl
  frequency: number;        // weight in the pool
  itemTypes: ItemType[];    // where it can roll
  rolls: Roll[];            // value ranges
  bonuses: Bonus[];         // what the values do
}

interface Roll {
  min: number;
  max: number;
  distribution: 'uniform' | 'triangular';
}
```

- Higher affix tiers share a group with lower ones. "Sturdy" (+10 to 20 armor) and "Fortified" (+40 to 60 armor) cannot both roll on one item.
- Affixes roll from the `loot` stream.
- `CheckItemRoll` lets items and backgrounds change rolls, as wAthena's `item_roll` hook.

### Bonuses

Bonuses are data, not code, as rAthena's `bonus` script commands.

```ts
type Bonus =
  | { stat: Stat; add: number }
  | { addDamage: Category; target: string; percent: number }   // +20% against Undead
  | { reduceDamage: Category; source: string; percent: number } // -15% from Fire
  | { attackElement: Element }
  | { defenseElement: Element; level: number }
  | { skill: SkillId; rank: number }
  | { onHit: StatusId; buildup: number }
  | { autocast: SkillId; rank: number; chance: number; trigger: 'attack' | 'hit' }
  | { effect: EffectId };                                        // runs a setup() for complex effects
```

- `addDamage` and `reduceDamage` feed the Amplify and Reduce steps. Bonuses in one category add. Different categories multiply. See [combat engine](03-combat-engine.md#amplify-and-reduce).
- `effect` points to code for things data cannot describe, such as "cast Chain Lightning on crit".

## Sockets and cards

rAthena's cards and Diablo 2's sockets are the same idea. This game uses monster cards.

### Sockets

- An item has 0 to 4 sockets.
- The limit is the lower of the quality limit (see [quality](#quality)) and the slot limit below.

| Slot | Max sockets |
|---|---|
| Two-handed weapon, Body | 4 |
| One-handed weapon, Offhand | 3 |
| Head | 2 |
| Cloak, Boots, Accessory | 1 |

- Sockets are rolled when the item drops.
- A Blacksmith can add one socket to an item that has fewer than its limit. The attempt can fail and break the item, as rAthena's socket enchant.

### Cards

- Each monster kind can drop its card. Drop rates are set for a short run, not for an MMO:
  - Normal monsters: 5%.
  - Elites: 25%.
  - Bosses: always. Boss cards are trade-off cards.
- Each card fits one kind of slot, such as Weapon or Cloak.
- A card goes into a free socket. It cannot be removed, except by the Card collector for a price.
- Cards are the main way to build around a specific merc.
- Gems are a common socketable with plain stats, so sockets are never wasted.

Card families, based on rAthena's item bonuses:

| Family | rAthena bonus | Example |
|---|---|---|
| Stat | `bStr`, `bVit` | +3 STR. |
| Damage category | `bAddRace`, `bAddEle` | +20% damage against Undead. |
| Reduction category | `bSubRace`, `bSubEle` | -15% damage from Fire. |
| Defense element | `bDefEle` | Venom defense element level 1. |
| Status on hit | `bAddEff` | Adds Freeze buildup on hit. |
| Autocast on attack | `bAutoSpell` | 5% chance to cast Firebolt rank 3 on attack. |
| Autocast when hit | `bAutoSpellWhenHit` | 5% chance to cast Heal rank 2 on self when hit. |
| Skill grant | `bonus skill` | The merc can use Hide, even if its job cannot. |
| Mana and health gain | `bSPDrainValue`, `bSPGainValue` | +3 mana per hit. +10 mana per kill. |
| Loot | `bAddMonsterDropItem` | Kills by this merc have a chance to drop a potion. |
| Trade-off | Phen, Ghostring | Strong effect with a clear cost. Mostly boss cards. |
| Combo | rAthena card combos | Extra bonus when certain cards are on the same merc. |

Autocast rules:

- An autocast skill can come from any job. A Sellsword with a Firebolt card casts Firebolt.
- Autocasts cost no mana and have no windup, as rAthena's `bAutoSpell`.
- Autocasts ignore the per-skill toggles. They fire when their trigger happens.
- Autocasts never have friendly fire, even if the skill normally does.
- Autocast chance uses the pseudo-random distribution, so streaks stay short.
- Autocasts run on `UnitTriggerSkill`, so a card can never trigger itself in a loop. See [loop safety](03-combat-engine.md#loop-safety).

Granted skills get their own per-skill toggle, as if the merc had learned them.

Example cards:

| Card | Slot | Effect |
|---|---|---|
| Gravedigger | Weapon | +20% damage against Undead. |
| Bog Hag | Cloak | Venom defense element level 1. |
| Iron Golem | Body | +25% armor. -10% move speed. |
| Ember Imp | Weapon | 5% chance to cast Firebolt rank 3 on attack. |
| Hedge Witch | Body | 4% chance to cast Heal rank 2 on self when hit. |
| Footpad | Accessory | Grants Hide. Based on rAthena's Smokie card. |
| Leech Swarm | Weapon | +2 mana per hit. |
| Will-o'-Wisp | Accessory | The merc's casts cannot be interrupted. -20% max mana. Based on rAthena's Phen card. |
| Wraith | Body | Spectral defense element. -25% max health. Based on rAthena's Ghostring card. |
| Kidnapper | Boots | +15% move speed while the citizen is within 3 tiles. |

## Crafting

Based on Inotia 3's synthesis system, with crafted equipment as in Diablo 2.

### Materials

- Monster types drop materials. Examples:
  - Beasts drop Leather.
  - Constructs drop Ore.
  - Undead drop Bone.
  - Spectral monsters drop Ectoplasm.
  - Element monsters drop an essence of their element.
- Salvaging an unwanted item turns it into materials. Higher qualities give rarer materials.
- Some materials are refined before use, as Inotia's Mithril from Ore. Example: 10 Ore make 1 Ingot.
- Materials go into a separate pouch. It has no weight and no slot limit, so materials never crowd the pack.

### Recipes

- Recipes drop from monsters, chests and events. Towns sell some.
- A learned recipe goes into the Recipe Book. The book has no size limit.
- The book lasts for the run only.

### Where

- A Town has a Synthesis bench that can make any learned recipe.
- A Camp can make consumables and simple recipes. The Alchemist adds more.
- Crafting costs materials and gold. It takes no time.

### What can be crafted

| Category | Examples | Purpose |
|---|---|---|
| Consumables | Potions, resurrection items, bombs, identify scrolls | A steady supply for the belts. |
| Equipment | The recipe fixes the base item and 1 or 2 affixes. The other affixes are rolled, as Diablo 2's crafted items. | Lets the player aim for what the party needs. |
| Bags and upgrades | Bigger pack, extra belt slot, caravan upgrades | Based on Inotia's bags. |
| Smith's Blessing | Rare materials | Protects one refine attempt. |
| Rerolls | Reroll a Magic item's affixes. Add a socket. Raise the base to the next tier. | Gives surplus drops a use, as Diablo 2's Horadric Cube. |
| Card fusion | 3 cards make 1 random card of the next tier | Gives duplicate cards a use. |

- Cards cannot be crafted directly. Each card still has to come from its monster.
- Crafting rolls use the `craft` stream.

## Loot budget

A run has 4 phases of 8 nodes. About 19 of the nodes are fights, including 4 bosses, for about 285 kills. The party needs 32 equipment slots filled.

### Sources

- Drops: random. They fill slots. A fight drops 3 to 5 pieces of equipment.
- About half of equipment drops can be used by a job in the party.
- After each fight, the player picks 1 of 3 rewards, as in Slay the Spire. The choice comes from a cache at the area's exit. This steers the build.
- Crafting: targeted. It fills gaps, such as gear for a merc who joined late or resistance before a boss.
- Recruits arrive with gear suited to the current phase, as in Inotia. New gear replaces items instead of filling empty slots.

### Focus per phase

| Phase | Focus |
|---|---|
| 1 | Recruit. Fill the slots with Normal and Magic items. Learn the first recipes. |
| 2 | Finish recruiting. Rares, the first cards, the first crafted pieces. |
| 3 | Sockets, cards and refines. |
| 4 | Final upgrades and preparing for the boss. |

### Target at the final boss

- Every slot holds gear that fits the merc's job.
- 2 or 3 key pieces per merc: Rare, Unique, crafted, or socketed with cards.
- About 15 to 20 cards found across the run, including 4 boss cards. Most come from the 5% rate on about 265 normal kills.
- 4 to 6 crafted pieces of equipment.
- A few items refined past the safe level.

## Refine

Based on rAthena's `refine.yml`.

- A Blacksmith raises an item's refine from +0 to +10.
- Each level adds flat attack to weapons or flat defense to armor.
- Up to the safe level, usually +4, refining always works.
- Above it, each attempt can fail.
- A failure destroys the item and every card in it. This follows pre-renewal rAthena.
- A Smith's Blessing changes one failure into a loss of one refine level instead. It follows rAthena's Blacksmith Blessing. It is crafted from rare materials. See [crafting](#crafting).
- Refining uses the `craft` stream.

Breaking is the riskier choice. A +7 Normal item with 4 cards is the result of a whole run of drops, and one failed attempt can lose all of it. Each refine past the safe level is a real gamble.

## Identification

- Rare, Unique, Set and Cursed items drop unidentified.
- An unidentified item shows its base and its quality color only.
- It can be worn. Its hidden affixes still apply, including a curse.
- Ways to identify:
  - An identify scroll.
  - A Town appraiser.
  - The Scholar background, which identifies items on pickup.

## Requirements and item level

- Item level comes from the stage or monster level.
- Affixes can only roll when the item level is at least the affix level.
- Base tiers unlock with item level: Normal, then Exceptional, then Elite.
- STR and DEX requirements apply to mercs. See [mercenaries](05-mercenaries.md#requirements).

## Unique item examples

- **Widow's Lantern** (Accessory). The citizen's lantern also reveals invisible enemies. +10 to 20 Occult resistance.
- **Debtor's Chain** (Weapon, flail). +30 to 50% damage. The merc's wage doubles.
- **The Last Contract** (Body). When the citizen would die, this merc takes the hit instead and dies. Once per stage.
- **Rimecaller** (Weapon, staff). Frost spells add twice the buildup. Fire spells cannot be cast.

## Durability

- No durability. It adds upkeep without interesting choices.
- Instead, some enemies can strip or break items for a while, based on rAthena's Strip and Break skills. A stripped item stops working until the stage ends or the citizen hands it back.
