# Bestiary

Draft. New monsters, mini-bosses and bosses, so that no two runs meet the same Hollow. It builds on the enemy types in [enemies](07-citizen-npcs-enemies.md#enemies) and the factions in [lore](10-lore.md#who-the-party-fights).

## Goals

- Each layer fields at least six kinds of monster, from at least two factions.
- Every enemy type in the enemies table has at least one monster. Today only the plain, weak, healer and assassin types do.
- Each monster asks the player to change a toggle, a stance, a merc or gear. A monster that asks nothing is cut.
- A run meets one boss per layer, rolled from a pool of three. With four layers, that gives 81 boss orders.
- Mini-bosses lead the gauntlets, so a fight area can end on a named enemy instead of a pack.
- Names are titles, as the lore asks. No personal names.

## Elite affixes

From Diablo 2's champion and unique monsters. Today an elite is only stronger. With affixes, each elite pack is a small puzzle.

- An elite rolls 1 affix in the Marches, 2 in the Rift Road and the Undercroft, and 3 in the Sunken Crown.
- Its pack shares the first affix, at half strength.
- The affixes show on the elite's floor label, so the player can read the threat before the fight.
- The rolls come from the `layout` stream, so a seed always gives the same elites.

| Affix | What it does | What answers it |
|---|---|---|
| Swift | Moves and attacks faster. | Snares, Pin Down, a Vanguard in front. |
| Stoneskin | Much more armor. | Sunder, magic, Investigate. |
| Fire Enchanted | Fire hits. Bursts into fire when it dies. | Frost gear, not standing on it. |
| Frost Enchanted | Frost hits that Chill. A frost nova when it dies. | Fire gear, Cleanse. |
| Storm Enchanted | Each hit on it throws a spark at a nearby merc. | Ranged mercs, killing it fast. |
| Venomous | Its hits Poison. Poison cuts healing. | Cleanse, Venom resist. |
| Mana Burn | Its hits drain mana. | Mana potions, short fights. |
| Warded | A Ward that absorbs magic. It refills after a few seconds without being hit. | Physical damage, steady pressure. |
| Multishot | Ranged only. Fires three bolts at once. | Rampart, Veil, Pavise, Bastion. |
| Teleport | Blinks next to the bearer every few seconds. | Guard stance, Intercept, Snap. |
| Thorns | Reflects part of melee damage. | Ranged and magic damage. |
| Vampiric | Heals from the damage it deals. | Disarm, Battle Cry, killing it fast. |
| Aura: Might | Its pack deals more damage. | Kill the elite first. |
| Aura: Mending | Its pack heals over time. | Kill the elite first, Poison. |
| Bound | Its pack shares its health. Hitting any of them hurts all. | Area damage. |
| Herald | Runs to an alarm bell when the fight starts. | The Heralds priority, Rangers. |

In the game so far (`src/content/affixes.ts`):

- Every elite of a pack or a wave rolls its affixes from the `layout` stream: 1 in the Marches, 2 in the Rift Road and the Undercroft, 3 in the Sunken Crown. Bound is rolled only for a pack of three or more.
- Its pack shares the first affix at half strength, if it is one that works on whoever has it: Swift, Stoneskin, the Enchanted, Venomous, Vampiric or Thorns.
- The elite's name and affixes show over it once it is seen.
- Swift: 30% faster moving and attacking. Stoneskin: 40 armor.
- Fire, Frost and Venom Enchanted turn its hits to that element, so they build up Burn, Chill or Poison. Fire and Frost Enchanted burst as they die, in a 2 tile circle shown for a second: fire takes 12% of health from the party, frost chills it.
- Vampiric heals 30% of the damage it deals. Thorns throws back 25% of melee damage.
- Aura: Might gives the monsters within 6 tiles 25% more attack. Aura: Mending heals them 2% of health a second. Both end with it.
- Warded: a ward of 30% of its health that takes magic damage first, and refills after 4 seconds unhit.
- Bound: the elite and its pack share every hit evenly.
- Herald: there are no bells yet. Instead, every 10 seconds in a fight it wakes the nearest pack still unaware and sends it to the fight.
- Not yet: Storm Enchanted, Mana Burn, Multishot and Teleport.

## New monsters

Each layer gains monsters that fill the missing enemy types. Every one has a race, an element, a card and a bestiary line, like the monsters already in the game.

### The Marches

The Blight, the drowned townsfolk and the Church's first keepers.

| Monster | Faction | Type | What it does | Element | What answers it |
|---|---|---|---|---|---|
| Bloat | Blight | Bomber | A slow, swollen sac. Walks into the party and bursts in a Venom cloud, shown on the ground first. | Venom | Ranged mercs, spreading out, not letting it reach the bearer. |
| Carrion Moth | Blight | Flyer | Flies in threes, drawn to the lantern. Melee mercs cannot reach it until it lands to bite. Each bite dims the bearer's light for a moment. | Venom | Ranger, Pin Down, Flare. |
| Drowned Wailer | Drowned | Spectral | A husk with nothing left inside. Neutral hits lose up to half their damage on it. | Spectral | Elemental gear, the Medium, the Monk. |
| Penitent Slinger | Church | Archer | Keeps 6 tiles back and slings stones at the bearer. | Radiant | Rampart, Veil, the Arbalist. |

### The Rift Road

The Old King's guard holds the road down.

| Monster | Faction | Type | What it does | Element | What answers it |
|---|---|---|---|---|---|
| Hollow Archer | Old King's guard | Archer | Shoots from ledges and behind pillars, in pairs. | Neutral | Rampart, Bastion, Veil, the Arbalist. |
| Hollow Shieldbearer | Old King's guard | Shielder | A tower shield that blocks every blow from the front. It turns slowly. | Neutral | Flanking, Sunder, magic. |
| Horn-Bearer | Old King's guard | Herald | Runs to the nearest horn post when its pack wakes. If it blows the horn, a fresh pack marches in. | Neutral | The Heralds priority, Snare, Pin Down. |
| Chain Warden | Old King's guard | Kidnapper | Throws a hook at the bearer and drags it back toward its pack. The hook is shown as a line first. | Neutral | Shield Bash, Stun, the Monk's Blade Catch, keeping the bearer behind a merc. |
| Rift Vulture | Blight | Flyer | Circles high, then dives at whoever is weakest. | Storm | Ranger, Pin Down, Flare. |

### The Drowned Undercroft

The Church's keepers and the drowned, in the flooded cellars.

| Monster | Faction | Type | What it does | Element | What answers it |
|---|---|---|---|---|---|
| Ossuary Priest | Church | Summoner | Keeps back and raises the party's kills as Husks. | Radiant | The Casters priority, Consecrate, Pyre, tearing bodies apart. |
| Tithe-Taker | Church | Thief | Runs at the bearer, takes gold or an item from the pack, and flees for an exit. Killed, it drops what it took. If it gets away, it is gone. | Radiant | Snare, Pin Down, ranged mercs, Covering Fire. |
| Confessor | Church | Stripper | Its chain takes a merc's weapon for the rest of the area. The merc fights bare-handed. | Radiant | Kill it fast, a spare weapon in the pack. |
| Flagellant | Church | Berserker | Grows stronger as it is hurt, and bleeds the mercs it hits. | Radiant | Burst damage, Disarm, keeping its health high until it can be finished. |
| Drowned Bell | Drowned | Fear caster | A cracked bell that rings Dread across a wide area while monsters stand near it. It does not move. | Spectral | Break it first, Brave and Devout mercs, Banner. |

### The Sunken Crown

The Hollowed, and the last of the guard, in the ruins of the capital.

| Monster | Faction | Type | What it does | Element | What answers it |
|---|---|---|---|---|---|
| Whisperer | Hollowed | Fear caster | Follows behind other Hollowed, building Dread in mercs within 4 tiles. | Occult | The Casters priority, Banner, Brave mercs. |
| Skulker | Hollowed | Assassin | Unseen until 2 tiles from the bearer. Then it strikes and vanishes again. | Occult | Lamplighter, the Warden's Sentry, Guard stance. |
| Revenant Knight | Old King's guard | Spectral | A guard captain in full plate, so long dead that only the armor remains. Heavy, slow, and Spectral. | Spectral | Elemental gear, Radiant, the Medium. |
| Gilded Effigy | Old King's guard | Construct | A statue of the Old King that wakes when the bearer passes. It cannot be stunned or frightened. | Earth | Fire, Investigate, armor breaking. |
| Crown-Moth | Blight | Flyer | A Carrion Moth grown in the dark. Swarms put out the bearer's light entirely while they live. | Occult | Lamplighter, area damage. |

### What the engine needs

- **Flyers:** a unit that melee cannot reach while it is aloft. Pin Down grounds it, as its text already says.
- **Ranged monsters:** a basic attack that fires projectiles. Mercs already have one, so monsters only need the same path. This gives Rampart, Bastion and Veil their first use.
- **Bombers:** a monster that dies on purpose, through a warning.
- **Thieves:** a monster that takes an item from the pack and leaves by an exit.
- **Hidden units:** unseen until close. The Lamplighter, the Warden and the Scout reveal them.
- **Horn posts:** alarms, as in [stages](11-stages.md#alarms).
- **Raising corpses:** monsters that raise the dead. Consecrate and Pyre stop it.

## Mini-bosses

Named monsters, as Diablo 2's Bishibosh and Rakanishu. Each has a title, two or three fixed affixes, a gimmick, and its own compendium entry and card.

Where they appear:

- The last wave of an Elite Horde.
- The first marked monster of an Elite Hunt.
- The guard of a Labyrinth's hall, in Elite Labyrinths.
- About one ordinary gauntlet in four, from the Rift Road down.

A layer has four mini-bosses, and a run meets each at most once.

In the game so far (`src/content/minibosses.ts`):

- Five are in, each built on a monster already in the game: the Bell-Ringer and the First Keeper in the Marches, the Shield-Oath on the Rift Road, the Drowned Cantor in the Undercroft and the Last Herald in the Sunken Crown. The other eleven wait for their monsters.
- A mini-boss is an elite with 250% more health, 40% more attack and 20 more armor on top, a level above the area's monsters, and drawn larger. It comes with its escort and its fixed affixes. Its name and affixes show over it, and the log names it and its gimmick as it joins the fight.
- Gimmicks: the Bell-Ringer's Herald wakes the next pack every ten seconds. The First Keeper's Ward refills only while its Cantors live. The Shield-Oath and its pack are Bound. The Drowned Cantor raises a pool of water every 6 seconds near it, up to four, which drain when it dies. The Last Herald calls two Hollowed at a time, as a captain does.
- Where: every Elite fight holds one, but a Labyrinth, an Ambush or a Ritual. From the Rift Road down, an ordinary Hunt, Escort, Vault or Collapse holds one a quarter of the time, from the `director` stream. An Elite fight's stands at its farthest boss spot, so the fight ends on it; an ordinary one's at one of its boss spots. An Elite Hunt's first quarry is it, an Elite Horde's last wave is led by it, and a Vault's key is on it.
- Not yet: their compendium entries and cards.

| Layer | Mini-boss | Affixes | Gimmick |
|---|---|---|---|
| Marches | The Bloated Reeve | Bound, Venomous | A drowned magistrate trailing Bloats. Each Bloat that bursts near it heals it. |
| Marches | The Moth-Queen | Swift, Teleport | Flies above the fight. Her swarm dims the light more with each moth. She lands only when her swarm is dead. |
| Marches | The Bell-Ringer | Herald, Aura: Might | A Penitent who rings a hand bell. Every ten seconds the bell wakes the next pack in the area. |
| Marches | The First Keeper | Warded, Aura: Mending | The oldest Penitent of the Marches, with two Cantors. Kill the Cantors and the Ward stops refilling. |
| Rift Road | The Bone Quartermaster | Multishot, Stoneskin | A Hollow Archer captain. Fires volleys shown on the ground as lines. |
| Rift Road | The Shield-Oath | Bound, Stoneskin | A Shieldbearer whose pack locks shields in a wall. The wall turns as one. Flank it, or break it with magic. |
| Rift Road | The Hooked Gaoler | Swift, Vampiric | A Chain Warden that hooks the bearer every few seconds and drags it toward a cage. |
| Rift Road | The Horn of the Road | Herald, Teleport | A Horn-Bearer that blinks from post to post. Each horn blown sends a pack. |
| Undercroft | The Tithe-Collector | Swift, Thorns | A Tithe-Taker that steals from the pack three times, then runs. Killed, it drops everything, with interest. |
| Undercroft | The Flayed Penitent | Vampiric, Fire Enchanted | A Flagellant who whips itself and grows with each lash. At low health it burns. |
| Undercroft | The Drowned Cantor | Aura: Mending, Frost Enchanted | Sings while the floor floods around it. The water slows the party until it is silenced. |
| Undercroft | The Ossuary Warden | Warded, Bound | An Ossuary Priest with its raised dead. Its Ward holds while any of them stand. |
| Sunken Crown | The Whispering Choir | Bound, Mana Burn | Three Whisperers that share health. Their Dread grows when they stand together. |
| Sunken Crown | The Skulker Prince | Teleport, Swift | A Skulker that strikes the bearer from the dark, then hides. Found only by light. |
| Sunken Crown | The Gilded Champion | Stoneskin, Thorns | A Gilded Effigy of the Old King's champion. It petrifies the ground in lines. |
| Sunken Crown | The Last Herald | Herald, Aura: Might | The Crown's last guard captain. Calls Revenant Knights from the ruins. |

## Bosses

Each layer rolls its boss from a pool of three, from the `map` stream. The layer map shows the boss's name from the start, so the player can prepare for it. Endless mode rolls from all twelve.

Every boss follows the rules the current four follow:

- It tests a setup, so preparation matters more than numbers.
- Its big moves show on the ground first. See `src/content/boss-moves.ts`.
- It changes at half health.
- It fights in the open boss field, with room to run.
- It drops its card every time.

### The Marches

| Boss | Faction | What it tests | Moves | At half health |
|---|---|---|---|---|
| The Brood Mother | Blight | Target priorities. See [enemies](07-citizen-npcs-enemies.md#in-the-game-so-far). | Lays mites. Spits acid where the bearer stands. | She and her brood go for the bearer. |
| The Drowned Reeve | Drowned | Positioning and mobility. | Pools of black water rise across the field, slowing all who stand in them. He drags Husks up from the pools. A wave rolls across the field in a line. | The pools join. Only islands stay dry. |
| The Lantern-Eater | Blight | Light and sight. | A great moth that feeds on the lantern. Each bite shrinks the bearer's light. It dives at the bearer along a line. Its dust Blinds mercs. | It puts the light out for 10 seconds at a time. Only flares, braziers and the Lamplighter's light hold. |

### The Rift Road

| Boss | Faction | What it tests | Moves | At half health |
|---|---|---|---|---|
| The Gatekeeper | Old King's guard | Armor breaking and Fall back. | Cleave, charge, slam. | Calls three soldiers. |
| The Siege Crew | Old King's guard | Ranged defense and target choice. | A ballista on the far side of the field fires bolts along lines at the bearer. Four crew reload it. With fewer crew it fires slower. Archers guard it. | The crew turn the ballista to fire chains that sweep across the field. |
| The Bridge-Warden | Old King's guard | Pushing forward, and Rally. | The field is a long bridge over the chasm. Sections fall in turn from the west, shown on the ground first. He holds the east end with a halberd sweep. | Sections fall twice as fast. |

### The Drowned Undercroft

| Boss | Faction | What it tests | Moves | At half health |
|---|---|---|---|---|
| The Abbess | Church | Interrupts, and going past her flock. | Litany, consecrated ground, judgement. | See [stages](11-stages.md#in-the-game-so-far). |
| The Ossuary Bishop | Church | Corpses. | Raises every body on the field as a Husk, the party's dead included, for the fight. Bone spears rise in lines. | He raises the party's dead as Revenants, not Husks. Consecrate, Pyre and Last Rites stop him. |
| The Drowned Choir | Church | Splitting damage, and the Focus shout. | Three Cantor sisters on three islands. Each heals the others. They must fall within 10 seconds of each other, or the fallen rise. | The two left alive swap places when one is nearly dead. |

### The Sunken Crown

| Boss | Faction | What it tests | Moves | At half health |
|---|---|---|---|---|
| The Hollowed Saint | Hollowed | Brave and Devout mercs, taunts, and where the bearer stands. | Dread aura, lunge, Dread nova. | She widens her aura and hunts the bearer. |
| The Usurper | Hollowed | Buffs and the party's strongest merc. | A Hollowed noble in the Old King's broken crown. He takes the party's buffs for himself, and copies the last skill the strongest merc used. | He takes a merc's mind for 6 seconds at a time. It fights for him. |
| The Faceless Regent | Hollowed | Light, and reading the field. | Splits into four images. Only the real one casts a shadow from the lantern. Images that are struck burst in Dread. | The images stop casting shadows. Only Sear, Flare or the Medium shows the real one. |

### What the engine needs

- **Rolled bosses:** a boss pool per layer, picked from the `map` stream and shown on the map.
- **Field changes:** rising water, falling floor sections and darkness, as zones and warnings that change over a fight.
- **Linked units:** health shared between units, and units that must die together.
- **Mind control:** a merc fighting for the other side for a while. The Creditor's final fight already turns mercs.
- **Copied skills:** a boss using a merc's skill. Skills already run on any unit.

## Order to build in

1. Elite affixes. They change every fight at once, with no new art.
2. Ranged monsters: the Hollow Archer and the Penitent Slinger. They give Rampart, Bastion and Veil a use.
3. The Shieldbearer, the Bloat and the Horn-Bearer. Each needs only a small new rule.
4. Mini-bosses for the Elite gauntlets, one per layer first.
5. The second boss of each layer: the Drowned Reeve, the Siege Crew, the Ossuary Bishop and the Usurper.
6. Flyers, thieves, hidden units, and the third boss of each layer.

## Art

Each new monster needs a figure. The rig already draws paper figures on a skeleton. Most new monsters can reuse a figure with one large added shape, as the merc design asks:

| Monster | Built on | Added shape |
|---|---|---|
| Hollow Archer | Hollow soldier | A long bow |
| Hollow Shieldbearer | Hollow soldier | A tower shield taller than it |
| Horn-Bearer | Hollow soldier | A curled horn |
| Chain Warden | Hollow soldier | A hook on a long chain |
| Penitent Slinger, Tithe-Taker, Confessor, Flagellant | Penitent | A sling, a sack, a chain, a whip |
| Ossuary Priest, Whisperer | Cantor | A bone staff, a veil |
| Bloat, Carrion Moth | Crawler | A swollen body, wings |
| Drowned Wailer, Revenant Knight | Husk, Hollow soldier | Drawn pale and see-through |
| Gilded Effigy | Hollow soldier | Drawn in gold, with a crown |
