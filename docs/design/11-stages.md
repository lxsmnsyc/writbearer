# Stages

Draft. A stage is one playable isometric level, entered from a node on the phase map.

## Goal

- The citizen must reach the exit.
- Clearing the stage is not required. Leaving early skips the loot, cards and experience the remaining monsters would have given.
- Every stage asks the same question: push to the exit now, or clear more of it for loot and risk the citizen.

A stage lasts 1.5 to 3 minutes. See [run length](01-overview.md#run-length).

Stages are open fields, not rooms. See [layout](#layout).

## Which nodes are stages

| Node | Played as | Objective |
|---|---|---|
| Combat | Stage | Reach the exit. |
| Elite | Stage | An elite pack guards the exit or the key to it. |
| Ambush | Stage | Looks like a Combat stage. Monsters surround the citizen once a trigger is crossed. |
| Refugee | Stage | Reach the exit with the refugees alive. They follow the citizen. |
| Treasure | Stage | A locked vault on the field. The key or lever is elsewhere in the stage. Traps guard it. |
| Boss | Closed arena | A walled arena. The gate closes behind the party. The boss has phases. |
| Camp, Town, Event, Shrine, Waystation | Place | A small, safe area the party walks into. Talking to an NPC or using a station opens its menu. |

## Layout

Stages are open fields, as in Diablo 2's outdoor areas. There are no rooms or corridors. Large open spaces give the citizen room to choose where to stand and where the mercs fight.

Each layer of the Hollow is open in its own way:

| Layer | Open field |
|---|---|
| The Marches | Fields, burned villages and forest edges on the surface. |
| The Rift Road | Wide terraces and ledges along the chasm walls, joined by ramps and bridges. |
| The Drowned Undercroft | Huge flooded caverns with islands of dry ground. |
| The Sunken Crown | Ruined plazas and broad streets. Broken buildings are obstacles, not rooms. |

### Size

- A stage is about 48×32 to 64×48 tiles.
- The path from the entrance to the exit is about 50 to 70 tiles long, so a stage still takes 1.5 to 3 minutes.
- The entrance and the exit sit far apart, usually on opposite sides.

### Terrain

The terrain gives the player positioning choices.

| Feature | What it does for positioning |
|---|---|
| Open ground | Room to move around a fight. Monsters can surround the party. |
| Choke points | Narrow passes, bridges and gaps between ruins. A Vanguard can hold one while the citizen waits behind. |
| Ledges | Raised ground reached by ramps. Melee monsters must go around. |
| Obstacles | Rocks, rubble, ruined walls, pillars. They block movement, sight and projectiles. |
| Water | Shallow water slows units. Deep water blocks them until Frost freezes it. Shallow water is in. |
| Tall grass and fungus | The citizen can hide in it. |
| Chasm edges | The border of the stage. Some edges are drops into darkness. |

### Points of interest

Hand-made pieces placed on the field, as Diablo 2's presets.

- The entrance and the exit.
- An alarm bell or horn tower.
- A cache: a chest, a corpse with gear, or Old King regalia.
- A brazier circle the citizen can light.
- A trap field.
- A monster lair that holds a stronger pack.

### Building a stage

1. Pick the size from the node type and the phase.
2. Place the entrance and the exit far apart.
3. Place the points of interest. Each node type has its own required pieces. A Treasure stage always has a vault, and an Elite stage always has a lair.
4. Fill the rest with terrain from noise: open ground, obstacles, ledges, water and grass, in the biome's mix.
5. Check that every point of interest can be reached from the entrance. Carve paths where it cannot.
6. Make sure the main route has at least one choke point and one open area.
7. Place monster packs from a threat budget. Packs gather near points of interest and the exit. Some patrol between them.
8. Apply the phase modifiers, such as night or rain.

### In the game so far

`src/gen/stage.ts` builds an area from the `layout` stream with its index, so a seed always gives the same journey. It follows the steps above, for one kind of field.

- **Layers:** `src/gen/layers.ts` splits the run into the four layers of the lore, 8 areas each, one per layer of a phase's stage graph. The Marches, on the surface, have bare earth with dead grass and dead trees. The Rift Road has bare rock and stone pillars. The two layers under the city keep the flagstone plazas. The map (M) names the layer.
- **Exits:** inside a layer, an area's exit is the road on to the next area, off the east edge, marked by the Guild's signpost and two torches. Only the last area of a layer has a way down, a stair between two braziers, to the next layer. The phase boss will stand before it.
- **Layer map:** `src/gen/graph.ts` rolls each layer's map from the `map` stream as a plan of rooms on a grid, 8 columns deep, one per area. The Waystation, or the Guild House, stands on the first room; the way in is to its west. Each column's rooms stand beside rooms of the column before, never on one already laid, and lean east. The first column has 2 rooms below a Waystation and 1 where the run begins; columns 2 to 7 have 1 to 3; the last is the boss's room, beside every room before it. Each area leads to 1 or 2 rooms beside it. M opens the map: the rooms as they lie, seen from the game's corner, with a door wherever a road joins two, the way the party came, where it is now and where it can go next.
- **Monsters by layer:** each layer fields its own packs, after the lore. The Marches: the Blight's mites and crawlers, the drowned Husks and the Church's first keepers. The Rift Road: the Old King's guard, Hollow soldiers in threes. The Undercroft: Penitents, Cantors and the drowned. The Sunken Crown: the Hollowed, with the last of the guard. The lair's pack follows the layer too.
- **Area kinds:** Fight, Event from the second column (16%), Elite from the third (25%), and Camp from the fourth (18%). No road joins two Camps, two Elites or two Events.
- **Objectives:** after Aghanim's Labyrinth, every fight area has an objective, and its exits stay shut until it is done. The objective shows on the map, on the signpost of the road to it, and in a badge in the corner while the party is there. Once done, the exits open and a chest and gold appear before them. What the chest holds is the fight's reward, shown on the map and the signpost. See [rewards on the road](14-gauntlets.md#rewards-shown-on-the-road). Elite is a harder version of any of them. The run opens on a Hunt. `?objective=hunt`, `horde`, `maze`, `escort`, `vault`, `ritual`, `collapse` or `ambush` gives the first fight that objective, for playtesting. See `src/game/objective.ts`.
  - **Hunt:** the open field, with 3 of its packs' leaders marked (4 in an Elite area, one more below the Marches): the lair's leader, and others among the packs farthest from the entrance. A red mark floats over each, even in the dark. Done once every marked monster is dead; the rest of the field is optional.
  - **Escort:** the Marches and the Rift Road only. The open field with its packs, and five refugees by the entrance who follow the bearer once it comes for them. Done once the bearer brings at least half of them to an exit. With fewer than half left alive, the exits open but nothing is paid. See [gauntlets](14-gauntlets.md#new-kinds-of-gauntlet).
  - **Vault:** every layer. A strongroom ringed by traps, its key on the lair's leader. Done once the bearer brings the key to its door. Its chest holds two more items and twice the gold. See [gauntlets](14-gauntlets.md#new-kinds-of-gauntlet).
  - **Ritual:** from the Undercroft down. The open field with no packs and three sigils across it. The bearer stands on each in turn for 15 seconds while waves come for it. Done once the third breaks. See [gauntlets](14-gauntlets.md#new-kinds-of-gauntlet).
  - **Collapse:** the Rift Road only. The open field with its packs, its floor falling away from the entrance's edge once the bearer moves on. Done once the bearer reaches an exit. See [gauntlets](14-gauntlets.md#new-kinds-of-gauntlet).
  - **Ambush:** a fight that shows as a Camp on the map and its signpost, from the fourth column. Its groups close in once the bearer nears the fire or an exit. Done once they are dead; then the fire rests the party. See [gauntlets](14-gauntlets.md#new-kinds-of-gauntlet).
  - **Horde:** the open field with no packs. Waves come from the north, south and east edges once the bearer has walked 6 tiles from the entrance: 4 of them (one more in an Elite area, one more below the Marches), rising in strength, each 20 seconds after the last, or 2 seconds after the last is beaten. The last is led by an elite once deep enough. Done once the last wave is dead.
  - **Labyrinth:** a maze of low ruined walls, 14 by 9 cells of 4 tiles, carved from the entrance with a few loops, and a hall down the east side to the exits. Packs wait in dead ends, a chest in another, and traps stand in the corridors: spike grates (a 0.8 second warning, then 12% of health to all on them, every 3 seconds) and fire vents (1.4 seconds, 22%, every 5). Traps strike monsters too. The hall's gates are locked, and a monster in the maze carries the key. Levers open gates inside the maze. See [the Labyrinth](14-gauntlets.md#the-labyrinth). Done once the bearer reaches the hall. The old bonus for crossing unhurt is now the Untouched [bonus challenge](14-gauntlets.md#bonus-challenge).
- **Warnings:** a boss's big blows and a maze's traps first show on the ground, a circle, square, line or cone that fills in red, then strike whoever stands in it. See `src/sim/warning.ts`. The column before the boss always has a Camp and never an Elite, so the party can rest before the fight.
  - **Elite:** 40% more threat, and its lair always holds an elite, even in the first layer's early areas.
  - **Town:** in the Marches and the Rift Road only, one per layer, in the fourth or fifth column. A small safe field round a well, with a smithy, a Synthesis bench, a chapel, a market stall and a tavern fire with a merc to hire. See [items](06-items-inventory.md#in-the-game-so-far).
  - **Event:** a small safe field with someone or something by the road, its scenery in an arc behind it. Walking up to it opens a text choice; once made, the choice says what came of it and the Event is spent. Each Event rolls what it offers from the `events` stream, and a run meets each at most once while the layer has others left. See `src/content/events.ts`:
    - **The toll** (layers 1 to 3): three of the Old King's guard ask 20 gold plus 10 per monster level. Refusing wakes them, round the scene.
    - **Another bearer** (all): a dead bearer with the same Writ. Search it for an elite's drop and gold (mercs −5 morale), bury it (+6), or read its Writ.
    - **Refugees** (layers 1 and 2): give two Healing Draughts (mercs +8 morale), or share their fire: gold, or one time in three a Hollowed assassin.
    - **The old sergeant** (layers 1 to 3): pays 15 gold per level for +5 Discipline to every living merc.
    - **The Penitents' blessing** (all): heals the party whole, but only Devout mercs like it (+10; others −6). Or leave alms for a Smith's Blessing.
    - **Dice by the fire** (layers 1 to 3): double or nothing, 10 gold per level, won 45% of the time.
    - **A fallen cellar** (layers 2 to 4): digging costs every merc a quarter of its health, for two elite drops and 2 Iron.
    - **A deserter** (layers 1 and 2): a merc at half the wage, always Cowardly or Greedy.
  - **Camp:** a small safe field with a fire. Walking up to it rests the living back to full health and mana, once. While anyone is left to hire, a wandering merc waits by it.
- **Forks:** an area that leads to two others has two exits, each with a road, a signpost and two torches. The signpost names what lies ahead: Fight, Elite, Camp or the walled ring. Taking one road closes the other; there is no way back.
- **Waystation:** the way down from a layer's last area leads to the Guild's Waystation at the top of the next layer. It is a small safe field, 26 by 20 tiles, with the paymaster's post, the vault's strongbox and the road on to the east. No monsters come there. Leaving by the road begins the layer's first area. See [wages](05-mercenaries.md#wages-and-contracts).
- **Boss field:** a layer's last area is a wide open field, 64 by 46 tiles, with no way back: room to run from the boss's blows. The boss waits in its middle, a level above the layer's last packs, and the way down is far beyond it, shut while it lives. A few pillars or dead trees stand about, and two packs of the layer's own monsters stray on the near side. The boss wakes once the bearer comes within 13 tiles, or when struck; its name and health then show across the top of the screen. Bosses are drawn as a larger figure of their kind.
- **Boss moves:** each boss's big moves warn on the ground and fill while it holds still, then strike whoever is still inside; a warned blow never misses. Several aim at the bearer, so the player must move it. Mercs step out of a warning once they react, as late as they would answer a shout, so a disciplined merc gets clear and an unruly one may not. See `src/content/boss-moves.ts`.
  - **Brood Mother** (the Marches): lays mites, and spits acid where the bearer stands (1.3 seconds, Poison). At half health she and her brood go for the bearer.
  - **Gatekeeper** (the Rift Road): a wide cleave in front of him (1.8 seconds, a cone 3 tiles deep) and a charge down a line at the bearer and past it (1.2 seconds). At half health his horn calls three soldiers, and he slams the ground around him (2 seconds, 4.5 tiles).
  - **Abbess** (the Undercroft): her Litany and her Penitents, as before, and now consecrated ground under the bearer and two of the party (1.5 seconds) and a beam of judgement through the bearer (1.7 seconds).
  - **Hollowed Saint** (the Sunken Crown): her Dread aura, a lunge that marks where the bearer stands and lands there a second later, and a nova of Dread around her (1.9 seconds, 5 tiles). At half health she goes for the bearer.
- **Balance check:** with the test's bearer stepping out of warnings: three mercs four levels below each boss of the Rift Road and below win at least 11 of 12 fights, two at most 3 of 12. Two level 9 mercs beat the Brood Mother about half the time whatever their orders, three always, one never.
- **Size:** square, 46 to 54 tiles a side, after Aghanim's Labyrinth's rooms. The entrance is near a corner of the west edge and the exits are on the far side, so the way crosses the field.
- **Ground plans:** each open field takes one, by its layer (`src/gen/fields.ts`). Obstacles stand as islands, or as walls with openings, so there is always a second way across.

  | Plan | Layer | Layout |
  |---|---|---|
  | Grove | The Marches | Clumps of trees on a loose grid with paths looping between them, and lone trees between. |
  | Cavern | The Rift Road, sometimes the Undercroft | Three by three chambers walled by ragged rock, one or two wide openings in each wall, a few loose rocks. |
  | Bridges | The Rift Road, 40% | Islands over the chasm, one under the entrance and each exit and three or four between, joined by bridges 3 tiles wide: each island to its nearest, then one more for a loop. The chasm blocks bodies but not sight. |
  | Halls | The Undercroft, the Sunken Crown | Three by three rooms with straight walls, a doorway between each two, and four pillars in each. |

- **Ground features:** open fields also hold patches that work on anyone standing in them, party and monsters alike (`src/game/footing.ts`). None lies on the entrance, the exits or the places.
  - **Water:** shallow pools, 2.5 to 4 tiles across their middle. Wading slows a unit to 60% speed. Pools may lie across a road. The Marches have 1 or 2, the Undercroft 2 or 3, the Sunken Crown 1 or 2.
  - **Embers:** charred ground, 1.5 to 2.5 tiles across their middle, with sparks that glow in the dark. They burn 4% of maximum health each second stood in them. They never touch a road, so the way on never has to cross them. The Rift Road has 2 or 3, the Sunken Crown 1 or 2.
  - **Blossoms:** pale flowers with a teal heart that shows in the dark, 1 or 2 on every field. The first of the party to walk into one bursts it, and every party member within 4 tiles is mended by 30% of maximum health. Each bursts once.

  | Layer | Water | Embers | Blossoms |
  |---|---|---|---|
  | The Marches | 1 to 2 | none | 2 |
  | The Rift Road | none | 2 to 3 | 1 |
  | The Undercroft | 2 to 3 | none | 1 to 2 |
  | The Sunken Crown | 1 to 2 | 1 to 2 | 1 |

- **Road:** outside the city, a road follows the way a body walks from the entrance to each exit. A pack watches it from a little past halfway along, on open ground.
- **Places:**
  - The Church's sealing site: an altar on a blood sigil with candles and a banner, kept by Penitents and a Cantor.
  - A lair ringed with pikes and gibbets, holding an elite and its pack. It is on the other half of the field from the site.
- **Captains:** from the third area, and in any Elite area, the lair's leader is a captain. Below the Marches, one roaming pack of four or more may have one too, half the time. A captain carries a red pennant over its head that shows even in the dark (`src/game/captains.ts`).
  - Once it is in the fight, it calls more of its pack: first after 4 seconds, then every 12 seconds, 3 times at most.
  - Each call brings the cheapest half of its pack, 3 monsters plus 1 per layer down. They come 4 tiles behind it, away from the bearer, already in the fight.
  - A red circle shows where they will come for 1.2 seconds first. If the captain dies before then, no one comes, and it never calls again. So it is the one to kill first.
  - A cache, a chest for now. It opens only when clicked: the bearer walks to it and opens it.
- **Places on open ground:** each place stands where a body can walk around it, plus pikes and gibbets along the way.
- **Guild House:** where every run begins, before the first phase. A small field, lit through, with four recruits along its north side, a quartermaster's stall and the Guild's strongbox. Its road east leads into the first area. The game is not saved here; the first save is on entering the first area. Waystations, Towns and Camps are lit through too.
- **Sight:** mercs take as targets only enemies they or the bearer can see, and monsters notice and go for only the party members they can see. Walls, pillars and trees block sight as they block bodies. A monster that loses sight of its quarry walks to where it saw it last.
- **Reachability:** loose obstacles between the entrance and any place it cannot reach are removed. Walls stay, since their breaches already make a way through.
- **Packs:** a threat budget of 9, plus 5 per stage deeper. Mites and Husks cost 1, other monsters 2 or 3, and an elite 6 more. Monster level is 2, plus 1 per stage. No pack stands within 13 tiles of the entrance.
- **Depth:** the first two stages field only Mites and Husks, with one Penitent at the Church's site and Husks in the lair. Crawlers and Hollow soldiers join from the third stage, Penitent packs from the fifth, elites and the Cantor from the fifth, and the Hollowed from the sixth.
- **Balance check:** a test plays the first stages with a lone merc of each job. The bearer walks to the exit, steps behind its merc when monsters near it wake, and drinks when hurt. Every job must clear the first two stages on 11 of 12 seeds. Measured on 40 seeds, all three jobs clear four stages alone every time. From the fifth stage on, a lone merc starts to fall: by the eighth, 38% to 60% of runs survive, so a second merc and gear matter.
- **Pathfinding:** a half-tile grid, blocked around solid props. Units walk straight when nothing is in the way, and follow an A* path when something is.
- **Exits:** each way out is a gold tile on the ground, a diamond on screen, that fills when the mouse is over it. Clicking it walks the bearer there, and the party leaves on arrival. Walking over it without clicking does nothing, so no one leaves by accident. The way down shows dark red while the boss lives.
- **Turns:** an area's exits leave toward the rooms its roads lead to on the plan: ahead, or by its left or right edge. So the world turns as the map shows it: a road that leaves a room north on the map leaves it north on the ground.
- **Crossing:** areas within a layer join edge to edge, with no cut. Clicking an open exit walks the bearer to it; there the next area is built, turned to face that way, and laid beyond the exit, its entrance across from it. Rubble runs along the edge where the two meet, but for the road. The other roads fall in, rubble across them. The next area's monsters wait in it from then on, and its objective starts once the bearer is a tile inside. See `src/gen/place.ts`.
- **Collapse:** once the bearer is in the new area, the one behind waits up to 4 seconds for the party to follow, then collapses and its floor fades. What is left in it is lost. Mercs still in it, living or dead, are brought to the new area's entrance.
- **The way down:** the stair from a boss's field to the next layer's Waystation, and down to the tomb, stays a cut.

Not yet: deep water, ledges, grass, alarms, patrols, and Treasure and Shrine areas.

### Map

- The darkness hides unexplored ground.
- Explored ground stays on a map, as Diablo 2's automap.
- The map shows terrain and points of interest the party has seen. It does not show monsters outside light.

## Monsters

### Packs

- Monsters stand in packs, as in Diablo, and an area can swarm. Each layer's factions set a pack's kinds and its size: swarms of fodder 6 to 12, mixed packs 4 to 8, packs of the strong 3 to 5. A pack stands as a crowd round its leader.
- An area's monsters add up to a threat budget of 24, plus 6 per area, and 1.4 times that in an Elite area. A first Hunt holds about 18 monsters, a deep one about 65. A Labyrinth's dead end holds at most 6, a Horde's wave at most 15.
- A plain monster is worth little: half the experience of before, and it drops equipment 15% of the time, gold 20%, a potion 15% and its card 3%.
- A pack is idle, patrolling or alert.
- An idle pack notices the party by sight, by light (the lantern) or by noise.
- Noise comes from fights, explosions and alarm bells. A fight near another pack can pull it in.
- The toggle "Do not chase beyond N tiles" matters here. A merc that chases too far wakes the next pack.

### Alarms

Alarms replace a timer as the source of pressure.

- Some stages have an alarm bell or horn tower.
- Some packs have a herald. When the pack becomes alert, the herald runs to the nearest bell.
- If the bell rings, reinforcements come out of spawn holes for a short time.
- Killing the herald before it reaches the bell stops the alarm.
- A new target priority, "Heralds", lets mercs go for them first. A Ranger is the natural choice for it.
- A Sapper can destroy a bell before it rings.

## Light and vision

The Hollow is dark. What the player sees depends on light.

- The citizen's lantern lights a circle around them.
- Each merc sees a smaller circle around itself.
- Outside light, the stage is dark. Monsters there are hidden.
- Brazier circles can be lit by the citizen. A lit brazier lights a wide area for the rest of the stage, but it also lets monsters see the party.
- Night phases shrink every light circle. The Warden's Night Eyes widens them.
- Some monsters are drawn to the lantern. The citizen can shade it to hide, at the cost of seeing less.

This ties the art style to the game. The lantern is the warm light in every scene, and the dark hides what the player has not yet reached.

## The citizen in a stage

The citizen does not fight. The citizen decides:

- **Where to go.** The route, and when to move up behind the mercs.
- **Where to stand.** Close enough for the mercs to guard, far enough from area attacks and traps.
- **What to pick up.** Monsters drop loot on the ground. Only the citizen picks it up, except Greedy mercs. Picking up loot in a fight is a risk.
- **What to interact with.** Levers, gates, chests, braziers, corpses to resurrect.
- **What to hand over.** Potions and items to mercs, by standing next to them.
- **When to shout.** Rally, Focus, Fall back, Hold.

## Traps and hazards

- Spike plates, falling rocks, pits, collapsing floors.
- Traps hurt anyone who triggers them, including monsters. See [elements](04-elements.md#friendly-fire).
- The Scout disarms traps. The Warden's Sentry reveals hidden ones near the citizen.
- Deep water slows units. Frost can freeze it into a walkable surface.

## Seamless connections

Areas join without loading screens, as in Diablo 2.

### Forks

- An area that leads to more than one next node has one exit per path.
- Each exit is a border feature: a bridge, a pass, a tunnel mouth, a stair or a gap in the ruins.
- Each exit shows what lies ahead before the party commits:
  - A signpost or landmark with the node's icon.
  - Something visible from a distance: the lights of a Town, the smoke of a Camp, the glow of a Shrine.
  - Ambush nodes show as Combat. Hidden nodes show nothing until a Scout or a Cartographer reveals them.

### Crossing

- When the citizen crosses an exit, the party enters the next area.
- Living mercs follow the citizen. A merc too far away runs to catch up.
- Dead mercs come along. See [death](05-mercenaries.md#death-and-resurrection).
- Alert monsters chasing the party follow it across, as in Diablo 2. Idle monsters stay.
- Loot left on the ground in the old area is lost.

### Paths collapse

- Once the party crosses an exit, the other exits of that area collapse: the bridge falls, the tunnel caves in.
- The party cannot go back. The lore gives the reason: paths collapse behind the bearer. See [lore](10-lore.md#why-the-citizen-keeps-going-deeper).
- This keeps the choice of path as final as a node choice on a map.

### Rewards

- The 1 of 3 reward pick comes from a cache at each exit of a fighting area.
- Opening it shows the three choices. See [loot budget](06-items-inventory.md#loot-budget).
- The cache is next to the exit, so it is always reachable on the way out.

### Map

- The map screen shows the whole phase graph: areas already visited, the current area, and the paths ahead that the party has seen.
- It is for planning. Choices are made by walking.

### Loading

- Each area is generated from the seed when the party gets near one of its entrances, and kept only while it can still be reached.
- Areas are generated from the `layout` stream with their node ID, so the same seed always builds the same area.
- Moving between phases is the only loading screen inside a run. It plays as a descent into the next layer.

## Shortcuts

There is no supplies resource. A shortcut costs what the party skips.

- A shortcut is a path that skips one or two layers of the stage graph.
- Ways to find one:
  - A Smuggler opens one for gold.
  - The Scout's Trailblazer reveals one.
  - Some areas hide one behind an obstacle that a Sapper can break.
- What the party gives up on a shortcut: the loot, cards, experience, recruits and Towns of the skipped layers.
- What the party gains: fewer fights, so fewer merc deaths, so fewer souls for the Creditor. See [lore](10-lore.md#the-creditors-strength).
- A strong party can skip ahead with less to feed the final boss. A weak party falls further behind if it skips.

## Controls

- The citizen can move by clicking, as in Ragnarok Online and Diablo, or with WASD. Both work at once.
- Every key can be rebound. The settings screen encourages players to set their own bindings.
- A merc opens from its plate or its number key. Clicking it on the field does nothing, so a click meant for the ground or an item never lands on it.
- Shouts and the lantern have their own keys.

## Pausing

- Opening the inventory, the toggles, a merc sheet or the map pauses the game.
- Handing an item to a merc still needs the citizen next to it, so pausing does not remove that risk.

## Leaving an area

- Only the citizen has to reach the exit. Mercs that are too far away run to catch up. See [crossing](#crossing).
