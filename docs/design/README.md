# Writbearer: design notes

This folder holds the game design while it is still being brainstormed. Nothing here is final. Each file covers one area.

## Pitch

A real-time isometric roguelite where the player is a citizen who cannot fight. Autonomous mercenaries escort the citizen across procedurally generated phases. The player wins through preparation, positioning and party management, not through attacking.

## Files

1. [Overview and run structure](01-overview.md)
2. [Tech stack and architecture](02-tech-stack.md)
3. [Combat engine and damage](03-combat-engine.md)
4. [Elements](04-elements.md)
5. [Mercenaries](05-mercenaries.md)
6. [Items, equipment and inventory](06-items-inventory.md)
7. [Citizen, NPCs and enemies](07-citizen-npcs-enemies.md)
8. [Open questions](08-open-questions.md)
9. [Skill trees](09-skill-trees.md)
10. [Lore](10-lore.md) (draft)

## Decisions so far

| Topic | Decision |
|---|---|
| Title | Writbearer. |
| Combat timing | Real-time, on a fixed simulation tick. |
| View | Isometric, with an orthographic camera. |
| Platform | Desktop first, running in the browser. |
| Language | TypeScript. |
| Citizen | Never deals damage. |
| Merc control | Toggles, not a full rule list. |
| Tone | Adult. |
| Skill cost | Mana for every skill. Basic attacks are free. |
| Damage model | Physical and magical split, resolved through an event engine with before, current and after steps. |
| Damage formulas | Based on rAthena's order of steps, without size. |
| Friendly fire | Off. Only skills that declare it hurt their own side. |
| Elements | As in rAthena and Diablo 2. Spectral is included. No custom status reactions. |
| Mana gain | Regeneration, items, cards and potions, as in rAthena and Diablo 2. |
| Death | A merc's corpse stays until it is resurrected, as in rAthena. |
| Jobs | Permanent, as in Inotia. |
| Sockets | Up to 4. Fewer on higher qualities. |
| Refine failure | Breaks the item and its cards. |
| Vault | Storage for the current run. Opens only at the start of each phase. |
| Crafting | Recipes and materials, based on Inotia 3. Unlimited Recipe Book. |
| Card drops | 5% normal, 25% elite, 100% boss. |
| Between runs | Only the compendium and one suspended run are stored. No unlocks. |
| Compendium | Hides monster, boss, card and unique details until discovered once. Only the UI hides them. |
| Squad sets | Added after uniques are tested. |
| Story twist | The citizen is the final boss. At the end the player loses control, and the hired mercs must beat the citizen. |
| Run length | 4 phases, 60 to 75 minutes. No stage time limit. |
| Rendering and art | Three.js. Claude builds the art in code. |
| Item stats | Randomized per copy, in the style of Diablo 2. |
| Equipment and inventory | Based on rAthena: slots, refine, sockets for monster cards, weight limits. |

## References

- `../the-fighting-game/src/core/event-engine.ts`: the event engine this game reuses.
- `../rathena/src/map/battle.cpp`: the order of damage steps.
- `../rathena/db/re/attr_fix.yml`, `refine.yml`, `item_randomopt_db.yml`: element, refine and random option data.
- `../wathena/docs/decisions/0009-stats-as-totals-of-modifiers.md`: stats as a pure function of the character.
- `../wathena/docs/decisions/0014-rolled-items.md`: rolled item values and random options.
- `../wathena/docs/decisions/0023-storage-cart-trade.md`: storage, cart and weight rules.
