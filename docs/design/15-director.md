# The level director

Draft. A game AI that runs each gauntlet as it plays, after Left 4 Dead's AI Director and the pacing of Aghanim's Labyrinth. It watches how well the party is doing, in the moment and over the run, and tunes the gauntlet to match, so a party that is struggling can catch up and a party that is winning easily is pushed harder.

## Prior art: Left 4 Dead

From Michael Booth's talk "The AI Systems of Left 4 Dead" (GDC 2009). Valve's director populates a hand-made map as it is played, and paces the fight to how the players feel.

**Tools it reasons with:**

- **Flow distance:** the travel distance from the start room to every area of the navigation mesh. Following it upward always leads to the exit. It places enemies and loot, and answers "how far have they come?"
- **Escape route:** the shortest path from the start room to the exit.
- **Potential visibility:** which areas any survivor could see. Enemies spawn only where no one can see them.
- **Active area set:** the areas round the survivors. The director creates enemies as areas enter it and deletes them as they leave, so a few hundred enemies cost only a small set of live ones.

**What it populates**, as "structured unpredictability": each kind of thing comes on its own randomized schedule, neither purely random nor uniform, and the schedules overlap.

| Layer | How often | How |
|---|---|---|
| Wanderers | High | A count per area, rolled at map start from the escape route's length and a density. Spawned as the area enters the active set, removed as it leaves. Zeroed once an area is seen, and during Relax. |
| Mobs | Medium | 20 to 30 enraged infected, every 90 to 180 seconds on Normal. A mob grows from its least size just after the last one to its most over time, so frequent mobs stay fair. A Boomer's vomit forces one at once and resets the timer. |
| Special infected | Medium | Each on its own randomized timer, in an area of the active set no survivor can see. Smokers prefer areas above the team. |
| Bosses | Low | Placed every so many units along the flow, a random amount, at map start. Tank, Witch and Nothing are shuffled and dealt out, with no kind twice in a row. Pacing does not touch them. |
| Weapon caches and items | Low and medium | The map's designer places many possible spots. The director picks which exist. |

**Where a mob spawns:** in the active set, out of sight.

- Behind the survivors, at or below their flow distance: 75% of mobs, since wanderers, specials and bosses are usually met ahead.
- Ahead of them, past their flow distance.
- Near a survivor a Boomer has vomited on.
- Anywhere in the active set, when nothing more specific is valid.
- The director avoids areas that spawned a mob recently.

**Adaptive dramatic pacing:**

- Each survivor has an intensity.
  - It rises with damage taken, in proportion.
  - It rises on being incapacitated, or pulled or pushed off a ledge.
  - It rises when an infected dies nearby, more the nearer it is.
  - It decays toward zero over time, but not while infected are engaging that survivor.
- The director tracks the highest intensity of the four, and moves through four phases:
  1. **Build up:** the full threat population (wanderers, mobs, specials) until intensity crosses a peak threshold.
  2. **Sustain peak:** the full population for 3 to 5 seconds more.
  3. **Peak fade:** the least population until intensity decays out of the peak range, so the current fight can play out.
  4. **Relax:** the least population (no mobs, no new specials) for 30 to 45 seconds, or until the survivors have travelled far enough toward the next safe room. Then build up again.
- It changes pacing, not difficulty. The amplitude of a peak stays the same; how often peaks come changes.
- Booth notes the intensity estimate is crude, and the pacing still works.

## What our director does

- It reads how the party is doing, in the moment and over the run.
- It paces each gauntlet as Left 4 Dead does: build up, sustain peak, peak fade, relax.
- It decides the gauntlet's parameters inside bounds set by the depth: when a wave comes, how big it is, and how hard.
- It never changes what the map and the signposts promised: the objective, the reward and the mutators stay as shown.

### Pacing and difficulty

Left 4 Dead's director changes only pacing. Ours does both, at two time scales:

- **Within an area, pacing.** The party's intensity decides when threats come and when the lulls are, as Left 4 Dead does. Peaks keep their height.
- **Across the run, difficulty.** The party's standing over the run moves the height of the peaks, inside the depth's bounds: wave sizes, kinds and elites. This is how a party catches up or is held back over the run.

## What it reads

**Intensity, for pacing.** Each living member of the party has one, as Left 4 Dead's survivors do.

- It rises with damage taken, in proportion to maximum health.
- It rises when a merc falls, and when the bearer is hit.
- It rises when a monster dies nearby, more the nearer it is.
- It decays over time, but not while a monster is engaging that member.
- The director paces by the highest intensity in the party, with the bearer's counted double, since losing the bearer ends the run.

**Standing, for difficulty.** One number for the run, updated at the end of each area.

| Signal | What it says |
|---|---|
| Party health | Health and mana of the living at the end of the area, as a share of their maximum. |
| Losses | Mercs dead in the area and over the run. |
| Potions | Potions drunk, and potions left on the belts and in the pack. |
| Pace | How long the area took against its objective's usual time. |
| Bonus record | How many bonus challenges the party has met so far. |
| Party strength | Levels and gear against the depth's expected level. |

## What it populates

Our gauntlets map onto Left 4 Dead's layers:

| Layer | Ours | Paced |
|---|---|---|
| Wanderers | The packs laid at generation, standing where they are until the party wakes them. | Thinned during Relax, only where no one has seen them. A pack the party has seen is never moved or thinned. |
| Mobs | Waves: a Horde's, a Ritual's, an Ambush's, and new waves in a Hunt or an Escort. Timer, size and where are the director's. | Yes |
| Specials | Single harassers on their own timers: archers, captains, Horn-Bearers. | Yes |
| Bosses | Elites and mini-bosses, placed along the flow at generation, dealt from a shuffled deck with no kind twice in a row. | No |
| Items | Relief: blossoms, potions and chests, at spots the generator lays out. The director picks which exist. | Yes, after a hard stretch |

**Where a wave comes from:** out of sight of the whole party, in the area round it.

- Mostly from behind, at or below the party's flow distance, since packs and elites wait ahead.
- Sometimes from ahead, past it.
- Anywhere round the party, when nothing more specific is valid.
- Never from a spot used recently.
- Where it comes still shows on the ground first, as waves do today. Out of sight keeps it from appearing in view; the warning keeps it fair.

## Key points

Each kind of gauntlet has key points: the places in its layout that the director works with. The terrain generator must lay them out first, then the ground between them so they play well.

- **Flow:** every open cell gets its travel distance from the entrance, as Left 4 Dead's flow. The main path is the route from the entrance to the exits.
- **Spawn spots:** places a wave may come from, tagged by whether they are behind, ahead or round the main path.
- **Boss spots:** places along the flow where an elite or mini-boss may stand.
- **Relief spots:** places a blossom, potion or chest may appear.

| Gauntlet | Key points |
|---|---|
| Hunt | Where the packs stand, where the marked ones wait, and where a marked one runs for help. |
| Horde | Where waves come from, the ground the party holds, and the routes waves take to it. |
| Labyrinth | The start, the end, the main path between them, its branches, and where traps and packs stand along it. |
| Escort | The route to the exit, and where packs lie in wait along it. |
| Vault | The vault, its ring of traps, and the lair. |
| Ritual | The sigils, and where waves come from round each. |
| Collapse | The falling edge, the route ahead of it, and where packs stand across it. |
| Ambush | The fire, and where the groups wait round it. |

## The Labyrinth, reworked

The Labyrinth stops being a maze. As Aghanim's Labyrinth's obstacle rooms, it is an obstacle course:

- It has a start and an end, and on average a single path between them, the way Left 4 Dead's maps have an escape route.
- The path may branch, but every branch rejoins it, so the party always ends up in the same place.
- Branches hold something worth the detour: a chest, a shortcut past traps, or a safer way round a pack. None is a dead end.
- Traps and packs stand along the path, at key points the director can use. The flow along the path places them.
- The key, gates and levers stay, laid along the path instead of hidden in a maze.

## Rules it keeps

- **Seeded:** the director's rolls come from the run's seed. The same seed played the same way gives the same gauntlet.
- **Bounded:** each depth sets a least and a most for every parameter, so the director can ease a fight but never make it trivial, and push a fight but never make it hopeless. To start, the bounds are 25% either side of today's numbers. They widen only after playtesting.
- **Fair:** whatever it spawns is shown first, as waves are today.
- **Quiet:** the player is never told that the director eased off. There is no setting to turn it off.
- **Rewards are fixed:** the director changes only the challenge. What an area pays stays what its signpost promised, however the party is doing, so playing badly on purpose earns nothing.
- **Elites are never eased:** in an Elite gauntlet, the director may push the challenge or give lulls, but never lowers it below its usual difficulty.
- **Wave counts are fixed:** a Horde keeps its number of waves, so the badge's count stays true. The director chooses each wave's timing and size.
- **What was seen stays:** the director thins packs only where no one has seen them, and never moves or removes a pack the party has seen.
- **Bosses are fixed:** elites and mini-bosses are placed at generation and pacing does not touch them, as in Left 4 Dead.

## Order to build in

1. Intensity for each party member, the standing over the run, and a debug overlay that shows both and the current phase. Done.
2. Flow over each area's open cells, and spawn, boss and relief spots in the generator for the open field gauntlets. Done.
3. The pacing phases for the Horde: wave timing from intensity, wave size growing since the last, spawn spots out of sight and mostly behind.
4. The same for the other gauntlets with waves: Ritual and Ambush, then new waves in Hunts and Escorts.
5. Difficulty from standing, inside the depth's bounds.
6. Bosses dealt along the flow from a shuffled deck, once mini-bosses exist.
7. The Labyrinth reworked as an obstacle course along a main path.
8. Relief at relief spots after a hard stretch.

## In the game so far

Steps 1 and 2 are in (`src/game/director.ts`, `src/sim/flow.ts`). The director reads, keeps its phase and knows the ground, but nothing it decides spawns yet.

- **Intensity:** from 0 to 1 for each party member.
  - A hit adds 1.2 times the share of health it took.
  - A merc falling adds 0.4 to everyone left.
  - A monster dying within 6 tiles adds up to 0.06, less the farther away.
  - It decays by 0.05 a second, but not while an aware monster is going for that member.
- **Pacing:** the party's highest intensity, the bearer's counted double.
- **Phases:** build up until pacing reaches 0.75; sustain for 3 to 5 seconds; fade until pacing falls below 0.75; relax for 30 to 45 seconds, or until the bearer has walked 25 tiles; then build up again. The timed phases roll from their own `director` stream.
- **Standing:** from -1 to 1, saved with the run. When an area's objective is done, each part of how it went is scored from -1 to 1, and their mean moves the standing 40% of the way toward it.
  - Health of the living party: 60% scores 0, full health 1.
  - Mercs lost in the area: -0.5 each.
  - Potions left in the pack and on the belts: 4 scores 0, 8 or more 1.
  - Pace, where the objective has a Swift time: the usual time is 1.2 times it, and finishing in no time scores 1.
  - The bonus challenge: met 0.5, failed -0.25, none left out.
  - Strength: the mercs' mean level against three above the depth's monsters, a third for each level.
- **Flow:** the walking distance from the entrance to every tile of an area, worked out over the world's nav when the party enters it, stepping across corners only where both sides are open. A point whose tile's middle is blocked takes its nearest reachable neighbour's. The overlay shows the bearer's progress: its flow against the area's farthest tile.
- **Key points** (`laySpots` in `src/gen/stage.ts`), on every open field, each on open ground the entrance can reach and clear of the places:
  - Spawn spots: one in each 8 by 8 tile cell where one fits, at most 16, none within 6 tiles of the entrance.
  - Boss spots: 35%, 60% and 85% of the way along the first road, 3 tiles to one side, or the other, or a little along.
  - Relief spots: 4 beside the roads, at least 6 tiles apart, nearer the road where there is no room, as on a bridge.
  - An Ambush's spawn spots are its groups', and it has two relief spots by the fire. The Labyrinth has none until it is reworked.
- **Overlay:** `?director` in the address shows the phase and its time left, the pacing, the standing, each member's intensity, and how the last area scored. It also counts the area's key points and draws them on the ground: red for spawn, gold for boss and teal for relief.

## Sources

- Michael Booth, "The AI Systems of Left 4 Dead", GDC 2009. [Slides](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf).
