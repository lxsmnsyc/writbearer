# Citizen, NPCs and enemies

## Citizen

The citizen never deals damage. The player controls the citizen directly.

### Actions

- Move, pick up items, open doors and chests, pull levers, talk to NPCs.
- Hand off items. In combat, the citizen must stand next to the merc.
- Shouts, each on a cooldown. They override the toggles for a few seconds.
  - Rally: every merc moves to the citizen.
  - Focus: every merc attacks the marked target.
  - Fall back: every merc retreats toward the citizen.
  - Hold: every merc holds its position.
- Mark: points at an enemy. Mercs with the "Marked by the citizen" toggle attack it.
- Use a resurrection item on a dead merc's corpse while standing next to it.
- Hide in tall grass or shadows. Most monsters lose track of the citizen.
- Sprint for a short time.

### Utility items

- Smoke bomb: blocks vision on an area.
- Flare: reveals an area and hidden enemies.
- Caltrops: slow monsters that walk over them.
- Bandage: heals a merc outside combat.
- Resurrection item: brings a dead merc back with low health. Based on rAthena's Yggdrasil Leaf.
- Lantern: needed in night phases. Some monsters are drawn to it.

### Backgrounds

Picked at the start of a run. Every background is available from the first run.

| Background | Upside | Downside |
|---|---|---|
| Merchant | More gold. Lower wages. | Smaller pack. |
| Noble | Higher merc loyalty. | Mercs cost more. |
| Scholar | More merc experience. Identifies items on pickup. | Less health. |
| Physician | Heals mercs outside combat. | Fewer shouts. |
| Fugitive | Better loot. | Bounty hunters chase the party. |
| Pilgrim | Shrines always give a buff and never show a curse. | Less gold. Every shrine used still feeds the Creditor a soul, without telling the player. See [lore](10-lore.md#the-creditors-strength). |

### Story hook

The citizen carries something to the capital: a letter, a relic or a seal. Factions want it. This explains why some enemies ignore the mercs and go straight for the citizen.

## NPCs

| NPC | Role |
|---|---|
| Wandering merc | Can be recruited in the field. Random traits. Sometimes cheaper. |
| Deserter | Very cheap merc with a bad trait. May bring a bounty. |
| Rival escort party | Uses the same path. Cooperate, trade or fight. |
| Refugees | Extra NPCs to escort. A reward if they survive. A morale loss if they die. |
| Quartermaster | Sells consumables. Buys junk. |
| Blacksmith | Refines items. Adds sockets for a price. |
| Priest | Removes curses. Treats injuries. Resurrects dead mercs for gold. |
| Appraiser | Identifies items. |
| Card collector | Removes cards from sockets for a price. |
| Cartographer | Reveals more layers of the map. |
| Fortune teller | Shows the next boss or the next phase's modifiers. |
| Smuggler | Sells illegal items. Opens a shortcut node. |
| Toll gate | Pay or fight. |
| Guild recruiter | Renews contracts. Buys out contracts. |
| The Stranger | Appears across runs. Carries the lore of endless mode. |
| Disguised assassin | An event where a refugee turns on the party. |

## Enemies

Enemies are designed to make the player change toggles and gear.

| Type | Behavior | Counter |
|---|---|---|
| Assassin | Ignores mercs and goes for the citizen. | Warden, the "attacking the citizen" priority. |
| Kidnapper | Grabs the citizen and drags them away. | Stuns, Guard stance. |
| Flyer | Melee mercs cannot reach it. | Ranger, ranged skills. |
| Healer | Heals other monsters. | The "casters and healers" priority. |
| Summoner | Keeps adding monsters. Raises corpses. | Same priority. Frost kills shatter corpses. |
| Shielder | Blocks from the front. | Skirmish stance, flanking. |
| Bomber | Explodes near groups. | Spread out, avoid clustering around the citizen. |
| Fear caster | Occult aura that triggers Cowardly. | WIL, Devout and Brave mercs. |
| Thief | Steals from the citizen's pack and runs. | Ranged mercs, caltrops. |
| Stripper | Strips a merc's item for the stage. | Kill it fast, hand the item back. |
| Spectral | Neutral attacks barely hurt it. | Elemental weapons. |

### Monster data

Based on rAthena's monster data.

- Race: Beast, Undead, Demon, Human, Insect, Construct, Plant, Spirit, Dragon.
- Defense element and level.
- Card drop.
- Bosses test a specific setup, so beating one is about preparation.
- The player sees these details only after beating the monster once. See [compendium](01-overview.md#compendium).
