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
| Labyrinth | The start, the end, the main path between them, its branches, and where traps stand along it. No monsters. |
| Escort | The route to the exit, and where packs lie in wait along it. |
| Vault | The vault, its ring of traps, and the lair. |
| Ritual | The sigils, and where waves come from round each. |
| Collapse | The falling edge, the route ahead of it, and where packs stand across it. |
| Ambush | The fire, and where the groups wait round it. |

## The Labyrinth, reworked

The Labyrinth stops being a maze. As Aghanim's Labyrinth's obstacle rooms, it is an obstacle course:

- It has a start and an end, and on average a single path between them, the way Left 4 Dead's maps have an escape route.
- The path may branch, but every branch rejoins it, so the party always ends up in the same place.
- **It has no monsters.** Its challenge is the traps: the player times the bearer's moves through them. No packs stand in it and no waves come.
- Branches hold something worth the detour: a chest, or a shortcut past traps. None is a dead end.
- Traps stand along the path, at key points the director can use. The flow along the path places them.
- The gates and levers stay, laid along the path instead of hidden in a maze.
- Its traps are the gauntlets design's, with the flamethrowers, pressure plates and arrow launchers to come. See [traps](14-gauntlets.md#the-labyrinth).
- With no monsters, the director paces the traps instead: how many stand along the path, how fast their beats run, and how wide the gaps between strikes are, inside the depth's bounds.

What changes with it:

- The hall's key can no longer be carried by a pack. It lies on the path or in a branch, guarded by traps.
- The Labyrinth no longer rolls the Thorough bonus, since there is nothing to kill.
- It rolls no mutator that works on monsters, such as Blood moon, Volatile and Restless dead. Darkness still applies.
- A Labyrinth mini-boss or stalker, as the gauntlets design planned, no longer fits, and is dropped.

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
3. The pacing phases for the Horde: wave timing from intensity, wave size growing since the last, spawn spots out of sight and mostly behind. Done.
4. The same for the other gauntlets with waves: Ritual and Ambush, then new waves in Hunts and Escorts. Done.
5. Difficulty from standing, inside the depth's bounds. Done.
6. Bosses dealt along the flow from a shuffled deck, once mini-bosses exist. Done.
7. The Labyrinth reworked as a monster-free obstacle course of traps along a main path, its traps paced by the director. Done, without flamethrowers, pressure plates and arrow launchers.
8. Relief at relief spots after a hard stretch. Done.

## In the game so far

All eight steps are in (`src/game/director.ts`, `src/sim/flow.ts`). The director reads, keeps its phase, knows the ground, and paces the Horde, the Ritual's waves and the mobs of Hunts and Escorts.

- **Intensity:** from 0 to 1 for each party member.
  - A hit adds 1.2 times the share of health it took.
  - A merc falling adds 0.4 to everyone left.
  - A monster dying within 6 tiles adds up to 0.06, less the farther away.
  - It decays by 0.05 a second, but not while an aware monster is going for that member.
- **Pacing:** the party's highest intensity, the bearer's counted double.
- **Phases:** build up until pacing reaches 0.75; sustain for 3 to 5 seconds; fade until pacing falls below 0.75; relax for 30 to 45 seconds, or until the bearer has walked 25 tiles; then build up again. Where the party holds its ground, in a Horde, a Ritual or an Ambush, the relax is 10 to 15 seconds, since a party holding ground never walks on to end it early. The timed phases roll from their own `director` stream.
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
  - An Ambush's spawn spots are its groups', and it has two relief spots by the fire. The Labyrinth has none.
- **The Horde, paced** (`Pace` in `src/game/objective.ts`):
  - A wave still comes when its time is up, or 2 seconds after the last is beaten, but not while the director is in a lull: sustain peak, peak fade or relax. Its badge then says the next wave is gathering.
  - A wave is 60% of its full size right after the last, growing to full over 30 seconds. Its leader always comes. The badge shows the next wave at the size it would come now.
  - It comes from a spawn spot no one in the party can see, either beyond 9 tiles in the dark or behind something, at least 8 tiles from all of them and at most 30 from the bearer, and not one of the last two used. Three times in four it is behind the bearer on the flow, when there is one. With none valid, it comes from the wave's own spot on the edge.
  - A Horde keeps its number of waves.
- **Waves rush the party:** a wave or mob that comes out of sight goes for where the bearer was as it came, as Left 4 Dead's mobs do, and fights whoever it finds.
- **Mobs** in Hunts and Escorts: three, rolled with the area, each 15% of its threat from the layer's packs. Each comes 60 to 120 seconds after the last, or after the area begins, but only while the director is building up, and only once there is a spawn spot it can come from. They are shown on the ground first.
- **The Ritual:** its waves keep the Ritual's own beat, as Left 4 Dead's crescendo events ignore pacing, but come from where the director chooses.
- **The Ambush:** left as it is. Its groups are a set piece, as Left 4 Dead's bosses are, and pacing does not touch them.
- Spawn spots on floor that has fallen in a Collapse are passed over.
- **Difficulty from standing:** each fight is built with its threat budget, and so its packs, waves and mobs, scaled by 1 plus a quarter of the standing: from 0.75 for a party struggling most to 1.25 for one winning most easily. An Elite fight is never scaled below 1. The fight's scale is set as it is built, from the standing then, so it holds for the whole area. The overlay shows it.
- **The boss deck** (`bossHand` in `src/gen/stage.ts`): each fight with packs deals a card to each of its boss spots, in order along the flow, from the `layout` stream.
  - The deck holds one elite, the fight's mini-boss if it has one, and nothing for the rest. No kind is dealt twice in a row.
  - An Elite fight's mini-boss is always dealt to its farthest spot, so the fight ends on it.
  - Elites are dealt from the Marches' third area, or in any Elite fight. Before then, every card is nothing.
  - An elite card stands a pack of the layer's at its spot, led by its strongest monster as an elite with rolled affixes.
  - Wandering packs within 6 tiles of a dealt elite or mini-boss are cleared, so the area holds about the same threat. The site's keepers, the lair, the watch on the way and marked quarry stay.
  - A Horde's mini-boss still leads its last wave. The Labyrinth, the Ritual and the Ambush deal no cards.
  - The overlay lists the cards dealt.
- **The Labyrinth** (`generateMaze` in `src/gen/stage.ts`):
  - One main path of cells runs east from the entrance to the column before the hall, turning up or down the rows on the way. Branches, two and three from the Rift Road down, each leave the path and rejoin it 3 to 7 cells further along, through cells the path does not use. Every other cell is walled off and holds a heap of rubble.
  - It has no monsters, no waves and no mobs.
  - Traps stand spread along the path in order along the flow, the first two cells kept clear: 7, one more each two areas, three more in an Elite fight, times the director's scale. Each trap's beat is its usual period divided by the scale, so a party struggling gets fewer and slower traps. The scale is 0.75 to 1.25, and never below 1 in an Elite fight.
  - The first branch holds a chest behind a trap. Each other branch is a way round: the stretch of path it skips gets one more trap.
  - A floor falls in only where the hall can still be reached without it, so only where a branch goes round it.
  - The key lies in the longest way round, or two thirds along the path.
- **Relief:** each time a peak fades into a relax, the director may grow a blossom at one of the area's relief spots, as Left 4 Dead places items. The chance is half, times one less the standing: likely for a party struggling, rarer for one doing well, never under 15%. The spot must be within 20 tiles of the bearer and out of the party's sight, and an area grows at most two. Nothing tells the player it came from the director.
- **Overlay:** `?director` in the address shows the phase and its time left, the pacing, the standing, each member's intensity, and how the last area scored. It also counts the area's key points and draws them on the ground: red for spawn, gold for boss and teal for relief.

## Sources

- Michael Booth, "The AI Systems of Left 4 Dead", GDC 2009. [Slides](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf).
