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

#### Shouts in the game so far

| Key | Shout | Lasts | Cooldown | What the mercs do |
|---|---|---|---|---|
| Z | Rally | 5 s | 12 s | Gather on the bearer in Guard, and fight only what comes within 2 tiles of it. |
| F | Focus | 6 s | 10 s | Go for the enemy under the mouse, marked with a red ring, until it dies. |
| X | Fall back | 3 s | 12 s | Break off, stop attacking, and run round the bearer to its far side from the nearest threat. |
| C | Hold | 6 s | 10 s | Stand where they are, in Hold. |

- Each merc acts on a shout after its response delay: `0.2 + (100 - effective Discipline) × 0.01` seconds. See [Discipline](05-mercenaries.md#discipline).
- The bar at the bottom left shows each shout's key and cooldown. Its buttons shout too, except Focus, which needs the mouse on an enemy.
- Focus stands in for Mark for now. Sprint, hiding and using items on corpses wait.

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
| Spectral | Neutral attacks lose up to half their damage. | Elemental weapons. |

### In the game so far

| Monster | Faction | Type | Behavior | Element |
|---|---|---|---|---|
| Hollow soldier | The Old King's guard | Plain | Goes for the bearer. Hits whoever stands in its way. | Neutral |
| Penitent | The Church | Plain | Goes for the bearer with a knife. Fast and fragile. | Radiant |
| Penitent Cantor | The Church | Healer | Keeps behind the others, out of the party's reach. Sings a long hymn that heals every ally within 4 tiles for 20%. A stun or a Shield Bash breaks it. | Radiant |
| The Hollowed | The Church, gone mad | Assassin | Runs past mercs in its way to claw at the bearer. Its Occult hits build up Dread. | Occult |
| Crawler | Blight | Plain | Bites whoever is closest. Its bites build up Poison. | Venom |
| Husk | The Old King's drowned townsfolk | Weak | Slow. Shambles at whoever is nearest. | Neutral |
| Mite | Blight | Weak | A crawler not yet grown: quick, frail, in threes. | Venom |
| The Gatekeeper | The Old King's guard | Boss | The Rift Road's boss, the Old King's captain. Very heavy armor. A slow cleave, 1.4 seconds of windup, for 220% damage to everything in front of him. At half health his horn calls three Hollow soldiers. | Neutral |
| The Abbess | The Church | Boss, healer, summoner | The Undercroft's boss. Keeps back. Calls two Penitents at a time, up to four. Her long Litany, 2.6 seconds of windup, makes every Penitent within 5 tiles take no harm for 6 seconds. Not herself: the party can go past them to her. A stun or a Shield Bash breaks it off. | Radiant |
| The Hollowed Saint | The Church, gone mad | Boss, assassin | The Sunken Crown's boss. Dread builds up each second in every merc within 3 tiles of her, 4.5 once she is wounded to half. Every 9 seconds she lunges from the dark to the bearer's side. | Occult |
| Brood Mother | Blight | Boss, summoner | The Marches' boss. Slow. Lays 3 mites every 9 seconds, up to 8 of hers alive. At half health she frenzies: she and her brood go for the bearer, and she lays 5 at a time. Her brood dies with her. | Venom |

- **Noticing:** a monster notices the lantern-bearer within its notice range, and an unlit merc within three quarters of it: Mites and Husks 4 tiles, Crawlers, Hollow soldiers and Cantors 5, Penitents 6, the Hollowed 7. The bearer sees 7, so most packs are seen before they wake. A monster that notices wakes every monster within 3 tiles.
- **Dread** (Occult, resisted by WIL): the merc drops its Ward and runs from the source for 2.5 seconds. The bearer never gets it, since the Writ drives it on.
- **Each boss tests a setup.** The Gatekeeper tests armor breaking and Fall back. The Abbess tests interrupts and going past her flock. The Saint tests Brave and Devout mercs, taunts and where the bearer stands. A test fights each with a party four levels below it: three mercs win at least 5 times in 6, two at most 2 times in 6.
- **The Brood Mother** tests the target priorities. Two level 9 mercs on their default orders lose to her most of the time, as they fight the brood. Told to take "Casters and healers" first, they go past it to her and win most of the time. Three mercs win every time; one never does. A test holds these numbers.
- **Elites**: any monster can spawn as an elite. An elite has +150% health, +30% attack and +25 armor, and is drawn a quarter larger.
- **Casters and healers**: a new target priority. It picks monsters that have skills of their own, such as the Cantor.
- Monsters use their skills with the same rules as mercs: a skill fires when its rule wants it and mana and cooldown allow.

### Monster data

Based on rAthena's monster data.

- Race: Beast, Undead, Demon, Human, Insect, Construct, Plant, Spirit, Dragon.
- Defense element and level.
- Card drop.
- Bosses test a specific setup, so beating one is about preparation.
- The player sees these details only after beating the monster once. See [compendium](01-overview.md#compendium).
