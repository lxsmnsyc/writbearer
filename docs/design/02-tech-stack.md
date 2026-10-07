# Tech stack and architecture

## Stack

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript | Decided. |
| Simulation | Plain TypeScript, no DOM | Runs headless in tests. Can move to a Web Worker later. |
| Rendering | Three.js with an orthographic camera at an isometric angle | The art is made in code as 3D models. See [art](#art). It only draws, so it does not compete with the simulation. |
| UI | SolidJS over the canvas | Inventory, toggles and sheets are dense menus, which the DOM handles better than a canvas. |
| Build and tests | Vite, pnpm, Vitest, Playwright, oxlint, oxfmt | Same as the other repositories. |

PixiJS and Phaser were considered. Both are 2D and need sprite sheets for every direction and animation. Phaser also brings its own scene and physics model, which would compete with a separate simulation.

## Simulation

- The simulation runs at a fixed 20 ticks per second (50 ms).
- The renderer interpolates between ticks.
- All game rules live in the simulation. The renderer and the UI read its state and send commands.
- Commands from the player (move, hand off, shout, mark) are queued and applied at the start of a tick.

## Randomness

- Reuse `alea.ts` from the-fighting-game for seeded streams.
- Reuse `prd.ts` for crit and proc chances, so streaks of luck stay short.
- One stream per subsystem. See [overview](01-overview.md#seeds).

## Determinism

- Map generation from a seed is always the same in every browser.
- `Math.sin`, `Math.cos` and `Math.pow` can return different values in different browsers. Combat uses lookup tables for trigonometry from the start.
- Full combat replays across browsers would also need fixed-point math. This is not a goal yet.

## World

- The simulation uses a square grid. The camera shows it at an isometric angle.
- Tiles have height levels. The depth buffer handles draw order.
- Units turn freely. Facing matters for blocking and backstabs.
- Mercs path with grid A*.
- Monsters move toward the citizen with a flow field. One field serves every monster, which keeps large groups cheap.
- A spatial hash answers range and target queries.
- Separation steering keeps units from stacking on one tile.
- Projectiles and ground zones are simulation entities. Walls and bodies block projectiles.

## Stats

- A unit's stats are a pure function of its job, level, raised stats, learned passives and equipment. This follows wAthena decision 0009.
- Stats are computed again in full whenever an input changes: equip, unequip, level up, a raised stat, or a timed bonus starting or ending.
- Conditional effects that depend on the moment of combat, such as "more damage against burning targets", are event listeners. They are not part of the stat total.

## Art

Claude makes the art. Claude cannot paint or generate raster images. Claude can write code that builds art. The art style follows from that.

- Units, monsters, props and tiles are low-poly or voxel models built in code from simple shapes.
- Models are made of rigid parts: head, torso, arms, legs, weapon. Animations move the parts. This is enough for walk, attack, cast, hit and death.
- Equipment is visible. A helmet, a shield or a weapon is a part attached to the model, so loot changes how a merc looks.
- Colors come from a small palette per biome, so everything matches.
- Lighting, shadows and fog come from Three.js.
- Item icons and UI art are SVG written in code.
- Merc portraits are SVG busts generated from the recruit's seed, so each merc has its own face.
- Effects such as fire, frost and sparks are particles and simple shaders.
- Claude checks the result through Playwright screenshots and adjusts.

Hand-made art can replace any of this later. The renderer reads models from one place, so a swap does not touch the simulation.

## Saves

The game stores two things in the browser's IndexedDB. Nothing else is kept.

### Suspended run

- There is one save slot.
- The game writes it when the party crosses into a new area. Quitting inside an area resumes at its entrance.
- The save is a snapshot of the run state and the position of each random stream. It does not replay an action log.
- Loading a save does not delete it. Because the random streams are saved, replaying a node gives the same rolls.
- The save is deleted when the run ends, by winning or by the citizen's death.

### Compendium

- The list of mercs met, monsters beaten and items acquired. See [overview](01-overview.md#compendium).
- It is written as discoveries happen, so it survives a crash or a closed tab.

## Folder layout

```
src/
  core/        event-engine, event-emitter, lifecycle, alea, prd, trig tables
  sim/
    events/    event names, the event map, payload types
    mechanics/ hit, damage, defense, element, critical, barrier,
               heal, buildup, threat, morale, stagger, mana
    stats/     stat calculation from equipment and passives
    world/     grid, pathfinding, flow field, spatial hash, projectiles, zones
    ai/        toggle evaluator, utility movement, personality
  content/
    jobs/ skills/ statuses/ items/ affixes/ cards/ monsters/ biomes/ events/
  gen/         phase, stage graph, stage layout, loot
  render/      Three.js scene, models built in code, animation, effects
  ui/          Solid: map, inventory, toggles, merc sheet
```

## First milestone

The goal is to prove the combat engine before anything else.

1. Port `core/` from the-fighting-game. Add trigonometry tables.
2. Build the damage pipeline for physical and magical damage and one element. Test each step with Vitest.
3. Run a headless fight: one merc, three monsters and the citizen on a grid. Test that a guard merc keeps the citizen alive.
4. Draw that fight with the Three.js isometric view.
5. Add the toggle panel in Solid.

## Later milestones

1. Party of four, recruiting, wages, camp and town nodes.
2. Full inventory, rolled loot, sockets, refine, crafting, skill trees, stat allocation.
3. Uniques.
4. Four phases with bosses, events and NPCs.
5. Squad sets, after uniques are tested.
6. Compendium, endless mode, seed sharing.

The toggle UI carries the most risk. If editing toggles is tedious, the game is tedious. Prototype it early.
