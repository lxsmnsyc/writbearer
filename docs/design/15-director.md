# The level director

Draft. A game AI that runs each gauntlet as it plays, after Left 4 Dead's AI Director and the pacing of Aghanim's Labyrinth. It watches how well the party is doing over the run and tunes the gauntlet's challenge to match, so a party that is struggling can catch up and a party that is winning easily is pushed harder.

## What it does

- It reads how the party is doing, during the area and over the run so far.
- It decides the gauntlet's parameters from that reading, inside bounds set by the depth.
- It orchestrates the gauntlet as it plays: when a wave comes, how big it is, and how hard.
- It never changes what the map and the signposts promised: the objective, the reward and the mutators stay as shown.

## What it reads

| Signal | What it says |
|---|---|
| Party health | Health and mana of the living, as a share of their maximum. |
| Losses | Mercs dead in this area and over the run. |
| Damage taken | How much the party and the bearer took in the last stretch of time. |
| Potions | Potions drunk, and potions left on the belts and in the pack. |
| Pace | How long the party is taking against the objective's usual time. |
| Bonus record | How many bonus challenges the party has met so far. |
| Party strength | Levels and gear against the depth's expected level. |

From these it keeps one number for the run, the party's standing, and one for the moment, the pressure the party is under now.

## What it controls

| Parameter | Examples |
|---|---|
| Timing | When the next wave comes, and how long the lull before it lasts. |
| Size | How many monsters a wave or a pack holds. |
| Difficulty | Which kinds come, whether an elite leads, and the elite's affixes. |
| Where | Which of the area's key points a wave comes from. |
| Relief | Whether a blossom grows, or a potion drops, after a hard stretch. |

## Pacing

As Left 4 Dead's director, a gauntlet moves through phases:

1. **Build-up:** the pressure rises as the party moves on and fights.
2. **Peak:** the hardest stretch, such as a Horde's last wave or the fight at a Ritual's last sigil.
3. **Relax:** a lull with no new threat, so the party can heal, loot and set orders.

The director moves to Relax once the pressure has stayed high for long enough, and back to Build-up once it has fallen. A party that is struggling gets longer lulls and smaller waves. A party that is winning easily gets shorter lulls and bigger, harder waves.

## Key points

Each kind of gauntlet has key points: the places in its layout that the director works with. The terrain generator must lay them out, and lay the ground around them so they play well.

| Gauntlet | Key points |
|---|---|
| Hunt | Where the packs stand, where the marked ones wait, and where a marked one runs to for help. |
| Horde | Where waves come from, the ground the party holds, and the routes waves take to it. |
| Labyrinth | The start, the end, the main path between them, its branches, and where traps and packs stand along it. |
| Escort | The route to the exit, and where packs lie in wait along it. |
| Vault | The vault, its ring of traps, and the lair. |
| Ritual | The sigils, and where waves come from round each. |
| Collapse | The falling edge, the route ahead of it, and where packs stand across it. |
| Ambush | The fire, and where the groups wait round it. |

- Generating an area means laying out its key points first, then the ground between them.
- Each key point is tagged with what the director may do there: spawn a wave, hold a pack, place relief.

## The Labyrinth, reworked

The Labyrinth stops being a maze. As Aghanim's Labyrinth's obstacle rooms, it is an obstacle course:

- It has a start and an end, and on average a single path between them.
- The path may branch, but every branch rejoins it, so the party always ends up in the same place.
- Branches hold something worth the detour: a chest, a shortcut past traps, or a safer way round a pack. None is a dead end.
- Traps and packs stand along the path, at key points the director can use.
- The key, gates and levers stay, laid along the path instead of hidden in a maze.

## Rules it keeps

- **Seeded:** the director's choices come from the run's seed and the party's play. The same seed played the same way gives the same gauntlet.
- **Bounded:** each depth sets a least and a most for every parameter, so the director can ease a fight but never make it trivial, and push a fight but never make it hopeless.
- **Fair:** whatever it spawns is shown first, as waves are today.
- **Quiet:** the player is never told that the director eased off.

## Order to build in

1. Track the signals over the run, and show them in a debug overlay.
2. Key points in the generator for the open field gauntlets: Hunt, Horde, Escort, Ritual and Ambush.
3. The director for the Horde: wave timing, size and difficulty, with the three pacing phases.
4. The same for the other gauntlets with waves or packs.
5. The Labyrinth reworked as an obstacle course with key points.
6. Relief: blossoms and drops after a hard stretch.

## Open questions

- Should the party's standing also change rewards, or only the challenge? Paying more for struggling could be exploited.
- How wide should the bounds be at each depth?
- Should the player be able to see the director's reading, for example on a difficulty setting?
- Should an Elite gauntlet narrow the director's bounds, so it is always hard?
