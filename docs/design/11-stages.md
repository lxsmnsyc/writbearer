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
| Water | Shallow water slows units. Deep water blocks them until Frost freezes it. |
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

`src/gen/stage.ts` builds a stage from the `layout` stream with the stage's index, so a seed always gives the same descent. It follows the steps above, for one kind of field: ruined flagstone plazas.

- **Size:** 54 to 62 tiles wide and 34 to 42 deep. The entrance is on the west edge and the stair down on the east edge, between two burning braziers.
- **Choke point:** a ruined wall runs across the whole field, about halfway. It has one breach, and sometimes a second. A pack watches the first one from the far side.
- **Places:**
  - The Church's sealing site: an altar on a blood sigil with candles and a banner, kept by Penitents and a Cantor.
  - A lair ringed with pikes and gibbets, holding an elite and its pack. It is on the other side of the wall from the site.
  - A cache, a chest for now.
- **Terrain from noise:** pillars where the noise runs high, rubble where it runs low, plus pikes and gibbets along the way. Every place keeps clear ground around it.
- **Reachability:** loose obstacles between the entrance and any place it cannot reach are removed. Walls stay, since their breaches already make a way through.
- **Packs:** a threat budget of 24, plus 5 per stage deeper. Each monster costs 2 or 3, and an elite costs 6 more. Packs of 2 or 3 come from one faction: Blight crawlers, the Old King's dead, Penitents with the Hollowed, or the Hollowed alone. No pack stands within 13 tiles of the entrance.
- **Pathfinding:** a half-tile grid, blocked around solid props. Units walk straight when nothing is in the way, and follow an A* path when something is.
- **Descending:** when the bearer reaches the stair, the next stage is built. The party, living and dead, arrives at its entrance. The old stage's monsters stay behind. This is a cut for now. Seamless crossing comes with the phase map.

Not yet: water, ledges, grass, alarms, patrols, forks and the map screen.

### Map

- The darkness hides unexplored ground.
- Explored ground stays on a map, as Diablo 2's automap.
- The map shows terrain and points of interest the party has seen. It does not show monsters outside light.

## Monsters

### Packs

- Monsters stand in packs of 2 to 6.
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
- Clicking a merc inspects it.
- Shouts and the lantern have their own keys.

## Pausing

- Opening the inventory, the toggles, a merc sheet or the map pauses the game.
- Handing an item to a merc still needs the citizen next to it, so pausing does not remove that risk.

## Leaving an area

- Only the citizen has to reach the exit. Mercs that are too far away run to catch up. See [crossing](#crossing).
