# Overview and run structure

## Core idea

- The player controls a citizen who must reach the end of the journey alive.
- The citizen cannot attack. Mercenaries (mercs) fight on their own.
- The player decides where the citizen goes, what the mercs carry, and how the mercs prioritize targets and skills.
- If the citizen dies, the run ends. Mercs die permanently.

Closest references:

- Slay the Spire for the branching map.
- Final Fantasy XII gambits and Dragon Age tactics for configurable AI. This game uses simpler toggles.
- Darkest Dungeon for roster, upkeep and stress.
- Dragon's Dogma pawns for autonomous companions.
- Ragnarok Online (rAthena) for damage rules, equipment and cards.
- Diablo 2 for randomized item stats.

## Seeds

- Every run comes from a seed. The default seed is random. The player can type one.
- The seed string is hashed to a number. Each subsystem gets its own random stream derived from it: `map`, `layout`, `loot`, `combat`, `events`, `recruits`, `craft`.
- Each phase derives its streams from `hash(runSeed, phaseIndex, streamName)`.
- Separate streams mean player choices in one system never change the results of another. Two players on the same seed see the same map.

## Structure

```
Run (seed)
  Phase 1..N        a biome with modifiers
    Stage graph     a layered graph of nodes, 8 layers
      Stage         an area of the world, joined seamlessly to the next
```

Inside a phase, the world is one continuous place, as Diablo 2's areas. The stage graph is not a separate map screen. Each node is an area, and each edge is a path the party walks. See [stages](11-stages.md#seamless-connections).

### Phases

- Each phase is a layer of the Hollow with its own biome. See [lore](10-lore.md#why-the-citizen-keeps-going-deeper).
- Each phase rolls one or two modifiers: night, rain, plague, war zone, faction control.
- Each phase starts at a Waystation, where the party's vault opens. See [items](06-items-inventory.md#vault).
- Each phase ends with a boss in a closed arena.
- After the boss, the party descends to the next layer. This is the only loading screen inside a run.

### Stage node types

- Combat, Elite and Boss.
- Camp: rest, reorganize the party, swap the bench, craft.
- Town: merchant, tavern, blacksmith, temple.
- Event: a text choice with consequences.
- Ambush: looks like a safe node, but is a fight.
- Refugee: an extra NPC to escort for a reward.
- Shrine: a buff, or a stronger buff with a curse. Shrines are the Creditor's altars. See [lore](10-lore.md#the-creditors-strength).
- Treasure.
- Shortcut: a path that skips one or two layers of the stage graph. See [stages](11-stages.md#shortcuts).

### Stages

- The citizen must reach the exit.
- Monsters wait in the level. More arrive when an alarm is raised.
- There is no time limit.
- The main choices are the route through the level and where the citizen stands.
- Reinforcements come from alarms and noise, not from a timer. A fight that goes on too long near an alarm draws more monsters.
- Stages are open fields, as in Diablo 2's outdoor areas. See [stages](11-stages.md#layout).

## Run length

Target: 60 to 75 minutes for a full run.

| Part | Count | Time |
|---|---|---|
| Phases | 4. The last one ends at the capital with the final boss. | |
| Nodes visited per phase | 8 | 15 to 18 minutes per phase |
| Combat stage | 60% of nodes | 1.5 to 3 minutes each |
| Other nodes | 40% of nodes | about 1 minute each, with menus |

- A run can be saved and resumed at any node.

### Endless mode

- A separate mode, chosen from the main menu. It is not part of the story and has no ending.
- It uses the same structure as story mode: phases made of stage graphs.
- Its phases are numbered, not named. They are not the four layers of the Hollow.
- Each phase rolls a biome from the full pool, plus modifiers.
- Phases never end. Enemy tiers and modifiers keep rising until the citizen dies.
- There is no Writ, no Creditor and no final fight.
- **In the game so far:** the start screen chooses Story or Endless, on the same seed; `?endless` starts in it. Phases are named "Phase 1", "Phase 2" and on, on the HUD and the map. Each is a layer map of 8 areas ending in a boss's arena, then a Waystation, as in the story. Each phase rolls its biome, one of the four layers' ground, monster packs, boss and Events, from its own `map` stream. Monster levels and threat budgets keep rising with depth as they do in the story, without end. Wandering mercs and a Town are offered in every phase. The way down from the fourth phase leads on to the fifth, not to the tomb. When the bearer falls, the compendium keeps the deepest phase reached; endless runs do not count toward the story's endings. Modifiers such as night or rain wait for those systems.

## Between runs

There is no meta progression. Every run starts from the same footing. Every job and background is available from the first run.

The game stores only two things:

- The compendium.
- One suspended run. See [saves](02-tech-stack.md#saves).

No items, recipes, gold or currency carry over.

### Compendium

The compendium records what the player has discovered. It unlocks no power. It carries the player's knowledge from run to run.

- Mercs met: each merc recruited or met, with its job, traits and portrait.
- Monsters beaten: each monster kind, with its race, element, skills and card.
- Items acquired: bases, uniques, set pieces, cards and recipes.
- Each section shows how much of it the player has found.

#### Hidden until discovered

The UI hides details the player has not discovered in any run yet.

| Entry | Hidden until | What shows before that |
|---|---|---|
| Monster | The player beats that monster kind once | Name and model. Race, element, level, weak points, skills and card show as "?". |
| Boss | The player beats that boss once | Name and model. Its mechanics show as "?". |
| Card | The player acquires it once | Its name, once seen in a drop. Its effect shows as "?" until picked up. |
| Unique or set piece | The player acquires it once | The compendium shows its silhouette. Its value ranges appear after the first copy. |
| Recipe | The player learns it once | Not listed. |

- Only the UI hides details. The mercs' AI always reads the real data. A merc with the "weak to my element" toggle still picks the right target against an unknown monster.
- Hidden details affect how the player plans: which mercs to bring, which gear to craft, which path to take. They never weaken the mercs.
- Item identification is separate. An unidentified item hides its rolls in every run, even when its base is known.

#### In the game so far

- `src/game/compendium.ts` keeps the record in IndexedDB, beside the suspended run. K opens it, in a run or from the start screen, and the game pauses while it is open.
- **Monsters:** each kind, the bosses and the Creditor. Never met shows "?"; met shows the name, with race, element, how it fights and its card as "?"; beaten shows them all, how many were beaten, and who it was (`src/content/bestiary.ts`). The Creditor stays nameless until it has been beaten or has risen.
- **Mercs:** each merc taken into the party or met by its fire, with its job, level and traits.
- **Uniques:** a silhouette ("A unique Flanged Mace.") until one is acquired, then its name, value ranges and lore.
- **Cards:** "?" until one drops, then its name with its effect as "?" until one is acquired.
- **Gear:** each base acquired. **Runs:** how each run ended.
- Anything in the pack or worn counts as acquired, with the cards set in it. Raised mercs are not monsters.
- Something found for the first time is written at once; kill counts a second later, or as the page closes. Nothing is written until the stored record is read, so it is never replaced. Runs started at a chosen place through the address record nothing.

### Seeds

- Seeds can be shared, so players can compare runs on the same seed.

## Tone

- Adult. Mercs are paid killers with vices.
- Injuries leave lasting scars.
- Unpaid mercs desert or betray the citizen.
- Occult enemies can corrupt mercs.
