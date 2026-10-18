# Gauntlets

Draft. Improvements to the fight areas: the Hunt, the Horde and the Labyrinth, and new kinds beside them. How they work today is in [stages](11-stages.md#in-the-game-so-far).

## What is wrong today

- **The choice of road is blind.** A signpost names the objective, but not what the area pays. Every road looks the same apart from its objective.
- **Every area pays the same way.** A chest and gold appear at the end. Playing well and playing badly pay the same, except the Labyrinth's no-hit bonus.
- **Areas of one kind play alike.** Two Hunts differ only in where the packs stand.
- **The Horde gives no warning.** Waves walk in from the edges with no sign of where or what.
- **The Labyrinth is only walking.** Its packs sit in dead ends, so the shortest route skips most of them.
- **Elite areas are only harder.** They have more threat and an elite, and nothing else changes.

## Changes to every gauntlet

### Rewards shown on the road

As Hades's doors. Each signpost shows the objective and the reward.

| Reward | What the chest holds |
|---|---|
| Gold | A large pile of gold. |
| Arms | An item of Magic quality or better, for a job in the party. |
| Cards | A monster card from the area's monsters. |
| Materials | Crafting materials, and a Smith's Blessing in the deeper layers. |
| Respite | The party is healed when it is done, and the dead are not torn apart while the area lasts. |
| Lore | A piece of the Old King's regalia or an earlier bearer's remains. Only where the lore places one. |

- The reward is rolled from the `map` stream, so the map and the signposts agree.
- The layer map shows each area's reward icon beside its objective.
- No two roads from one fork offer the same reward.

In the game so far (`src/gen/graph.ts`, `Game.spoilsOf`):

- Every chest holds an elite's item, gold and two potions. The reward adds to that.
- Gold: the pile is four times as large.
- Arms: two more items, Magic or better, each made for the job of a living merc where a base of the level is.
- Cards: the card of a monster in the area, or a gem if none has one.
- Materials: 2 Iron, 1 each of Chitin, Bone and Rags, and 2 of one essence go in the pouch. From the Undercroft down, a Smith's Blessing too.
- Respite: the party's dead are not torn apart while the party is in the area. When the objective is done, every living member is healed to full health and mana.
- Lore is not in yet. No regalia or remains are placed so far.

### Bonus challenge

As Aghanim's Labyrinth's room grades. Each gauntlet has one bonus challenge, shown in the objective badge from the start.

- Meeting it upgrades the reward: more gold, a better item, a second card.
- Failing it only loses the upgrade. The objective still opens the exits.
- The Labyrinth's "the bearer takes no hit" becomes one of these.

| Challenge | Met when |
|---|---|
| Untouched | The bearer takes no hit. |
| No losses | No merc dies. |
| Swift | The objective is done within a set time. |
| Thorough | Every pack in the area is dead. |
| Silent | No horn is blown and no bell is rung. |
| In order | The marked monsters of a Hunt die in the order shown. |

In the game so far (`src/game/bonus.ts`):

- Each fight on the map rolls Untouched, No losses, Swift or Thorough from the `map` stream.
- A Horde rolls only Untouched or No losses. Its field starts empty, so Thorough would always be met, and its waves keep their own time.
- Swift is 150 seconds for a Hunt and 120 for a Labyrinth, from when the party enters.
- Thorough counts the living monsters inside the area's rectangle when the objective is done.
- The badge shows the challenge, how it stands, and what it added once met.
- Meeting it gives twice the gold, one Arms item of Rare or better, a second card, twice the materials, or for a Respite, raises the party's untorn dead.
- Silent and In order are not in yet. Silent needs horns and bells, and In order needs the Hunt's order shown.

### Mutators

As Aghanim's Labyrinth's room modifiers. From the Rift Road down, a gauntlet may roll one mutator. An Elite gauntlet always rolls one, and two in the Sunken Crown. The mutator shows on the signpost.

| Mutator | What it does |
|---|---|
| Darkness | The party's light is halved. |
| Fog | No one sees past 4 tiles, monsters included. |
| Blood moon | Monsters below half health deal more damage. |
| Restless dead | Bodies not torn apart rise as Husks after 10 seconds, the party's dead too. |
| Volatile | Monsters burst when they die, shown on the ground first. |
| Alarmed | Every pack has a Horn-Bearer, and horn posts stand on the field. |
| Shield wall | Every pack has a Shieldbearer. |
| Plague | No health returns outside a fight, and potions heal less. |
| Frenzy | Monsters move faster but have less health. |
| Rich | Monsters drop twice the gold and materials. The packs are bigger. |

- A mutator raises the area's reward by one step, so a harder road can be chosen on purpose.
- Mutators come from the `map` stream.

### Mini-bosses

Elite gauntlets end on a mini-boss. Ordinary gauntlets have one about one time in four, from the Rift Road down. See [mini-bosses](13-bestiary.md#mini-bosses).

### Elite gauntlets

- Elite affixes on every elite. See [elite affixes](13-bestiary.md#elite-affixes).
- One mutator, and a mini-boss.
- The reward is always at least Rare.

## The Hunt

Today: kill 3 to 5 marked monsters anywhere on the open field.

- **Arrows at the screen's edge** point to each marked monster the party has seen, so the field does not need to be searched blind.
- **Marked monsters react.** A marked monster that drops below half health runs to its nearest pack and wakes it. The Snare and Pin Down skills gain a use.
- **Kinds of quarry.** Each Hunt rolls one:
  - **Leaders:** today's Hunt. The leaders of the farthest packs.
  - **Heralds:** the marked are Horn-Bearers. Each one that reaches a horn post calls a pack before it can be killed.
  - **Fugitive:** one marked mini-boss that flees from the party toward an escape at the far edge. If it escapes, the Hunt fails, the exits open, and the chest is empty.
  - **Nests:** the marked are Blight nests that do not move. Each one lays mites until it is destroyed.

## The Horde

Today: 4 to 6 waves from three edges, every 20 seconds, or 2 seconds after the last is beaten.

- **Warnings before each wave.** Its spawn points show on the ground 3 seconds before it arrives, as boss moves do.
- **The next wave shows in the badge**, with icons for its monsters, so the party can set orders before it comes.
- In the game so far: each wave's spawn point shows as a 2 tile circle 3 seconds before it comes. It harms no one, and mercs do not step out of it. A wave called early by the last one being beaten now comes 3 seconds later than before. The badge lists the next wave's monsters by kind, with a count.
- **Hold the light.** The Horde gains a brazier near the middle. While the bearer stands within its light, waves come only from the edges. Away from it, they may come from anywhere.
- **Call it early.** Between waves, the bearer can ring a bell to bring the next wave at once. Each early wave adds gold to the reward.
- **A last wave with a leader.** The last wave is led by an elite in ordinary Hordes, and by a mini-boss in Elite Hordes.
- **Kinds of horde.** Each Horde rolls one:
  - **Siege:** today's waves from the edges.
  - **Breach:** waves come through gaps in a ruined wall. A Vanguard can hold a gap.
  - **Rising:** the dead rise from graves across the field. Consecrate and Pyre stop a grave.

## The Labyrinth

Today: a maze of low walls, traps in the corridors, packs in dead ends, and a hall at the far end.

- **A key to the hall.** The hall's gate is locked. Its key is carried by a pack in the maze, so the party must fight at least once.
- **Levers and gates.** Some corridors are closed by gates. A lever elsewhere opens them. Some levers open a shortcut back to the entrance side.
- **More traps, with patterns.** Each trap keeps a fixed rhythm, so the player can learn its timing.

| Trap | What it does |
|---|---|
| Spike grate | Today's trap. A square that strikes on a rhythm. |
| Fire vent | Today's trap. A circle of fire on a rhythm. |
| Arrow slit | Fires a bolt along a corridor, shown as a line first. |
| Swinging blade | Sweeps across a corridor, back and forth. |
| Falling floor | A square of floor that drops away after it is stepped on, shown first. It stays open, which can cut a route. |
| Gas vent | Leaves a Venom cloud that lasts a few seconds. |

- **The stalker.** From the Rift Road down, some Labyrinths hold a mini-boss that walks the maze toward the bearer from the start. It cannot be killed until the hall. It can be slowed with snares and doors.
- **Darkness.** The maze's walls block light as they block sight. Lanterns on the walls light parts of it.
- **Kinds of maze.** Each Labyrinth rolls one:
  - **Ruins:** today's low walls.
  - **Catacomb:** narrow corridors, more traps, packs of the dead in alcoves. The Undercroft and the Crown.
  - **Hedge:** dead hedges that can be burned with Fire. The Marches.

## New kinds of gauntlet

| Gauntlet | Objective | Where | Inspired by |
|---|---|---|---|
| Escort | Refugees follow the bearer. Reach the exit with at least half of them alive. | Marches, Rift Road | The Refugee node in the [overview](01-overview.md#stage-node-types). |
| Vault | A locked vault on the field. Its key is on a mini-boss, and traps guard it. Opening it is the reward. | All | The Treasure node. |
| Silence | Horn posts stand across the field. Destroy every post before its Horn-Bearer reaches it. | Rift Road | The alarms in [stages](11-stages.md#alarms). |
| Ritual | The bearer must stand on three sigils in turn, 15 seconds each. Waves come while it stands. | Undercroft, Crown | Aghanim's Labyrinth's hold-the-point rooms. The bearer breaking the Church's sigils is a clue to the twist. |
| Collapse | The floor falls away from the west. Reach the exit before it does. Packs stand in the way. | Rift Road | The Bridge-Warden's fight, on a smaller scale. |
| Ambush | The area looks like a safe Camp. Packs surround the party once the bearer reaches the fire. | All | The Ambush node. |

- Each new kind keeps the rules above: a reward on the road, a bonus challenge, mutators and mini-bosses.
- A layer offers four or five kinds. The Hunt, the Horde and the Labyrinth stay the most common.

## Kinds by layer

| Layer | Gauntlets |
|---|---|
| Marches | Hunt, Horde, Labyrinth (Hedge), Escort |
| Rift Road | Hunt, Horde (Breach), Labyrinth, Silence, Collapse |
| Undercroft | Hunt, Horde (Rising), Labyrinth (Catacomb), Vault, Ritual |
| Sunken Crown | Hunt, Horde, Labyrinth (Catacomb), Ritual, Ambush |

## Order to build in

1. Rewards on the road. It changes how every fork is chosen, and needs only the chest and the signposts. Done, without Lore.
2. The bonus challenge. Most checks already exist, such as the Labyrinth's no-hit check. Done, without Silent and In order.
3. Wave warnings and the next wave in the Horde's badge. Done.
4. Arrows to marked monsters, and marked monsters that run.
5. Mutators, starting with Darkness, Blood moon, Volatile and Restless dead.
6. The Labyrinth's key, gates and new traps.
7. New kinds: Escort and Vault first, then Silence, Ritual, Collapse and Ambush.

## Open questions

- Should a failed Fugitive Hunt still pay something, or nothing at all?
- Should the player see a gauntlet's mutator on the map from the start, or only at the signpost?
- Should Ritual's sigils count as feeding the Creditor, as shrines do? It would make the clue a cost.
