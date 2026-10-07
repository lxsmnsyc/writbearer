# Open questions

## Still open

- Lore details. The twist is decided. See [lore](10-lore.md#open-choices).
- Stage questions. See [stages](11-stages.md#open-questions).
- Final numbers for the element table, Discipline thresholds and refine rates.

## Answered

### Combat

| Question | Answer |
|---|---|
| Reactions between statuses? | No. Elements work as in rAthena and Diablo 2: status changes the defense element, element fields, and Shatter. See [elements](04-elements.md#interactions). |
| Spectral element in the first version? | Yes. |
| Mana on hit for physical jobs? | Only from items and cards, as in rAthena and Diablo 2. See [combat engine](03-combat-engine.md#mana). |
| How long before a downed merc dies? | No downed state. A dead merc's corpse stays until it is resurrected, as in rAthena. See [mercenaries](05-mercenaries.md#death-and-resurrection). |
| Friendly fire? | Off, except for skills that declare it. |
| Do mercs shatter when killed while Frozen? | No. Too punishing, since the player cannot steer mercs away from Frost. Only monsters shatter. |
| Size in damage? | Removed. |

### Items

| Question | Answer |
|---|---|
| Sockets per item? | 4 at most. Fewer for higher qualities: Normal 4, Rare 1. See [quality](06-items-inventory.md#quality). |
| Card design depth? | Full rAthena card families, including autocast. See [cards](06-items-inventory.md#cards). |
| Refine failures? | The item breaks with its cards. A rare material turns one failure into a loss of one level. |
| Vault? | Yes, as storage for the current run. It opens only at the Waystation at the start of each phase. |
| Crafting? | Yes, based on Inotia 3's synthesis. See [crafting](06-items-inventory.md#crafting). |
| Recipe Book size? | Unlimited. |
| Card drop rate? | 5% for normal monsters. Elites 25%. Bosses always. |
| Anything kept between runs? | Only the compendium of mercs met, monsters beaten and items acquired. It unlocks nothing. |
| Unlocks? | None. Every job and background is available from the first run. |
| Squad sets? | Yes, after uniques are tested. |
| Compendium hides unknown details? | Yes. Monsters, bosses, cards and uniques show "?" until discovered once. Only the UI hides them. |
| Suspend and resume? | Yes. One slot, written on entering a node, deleted when the run ends. |

### Mercenaries

| Question | Answer |
|---|---|
| Discipline? | Explained in [mercenaries](05-mercenaries.md#discipline). Not raised with stat points. |
| Job changes? | No. As in Inotia, a merc keeps its job. Dismissal is the only way to change the party. |
| Skill trees? | 3 branches of 5 skills per job. See [skill trees](09-skill-trees.md). |

### Structure

| Question | Answer |
|---|---|
| Phases per run? | 4, for a run of 60 to 75 minutes. See [overview](01-overview.md#run-length). |
| Time limit per stage? | No. |

### Tech

| Question | Answer |
|---|---|
| Who makes the art? | Claude, in code. This moves rendering from PixiJS to Three.js. See [art](02-tech-stack.md#art). |
