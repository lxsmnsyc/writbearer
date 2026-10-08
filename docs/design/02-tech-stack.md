# Tech stack and architecture

## Stack

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript | Decided. |
| Simulation | Plain TypeScript, no DOM | Runs headless in tests. Can move to a Web Worker later. |
| Rendering | Canvas 2D | Figures are drawn from projected skeletons, so no sprite sheets are needed. The whole frame is drawn small and scaled up. See [art](#art) and `experiments/demo`. It only draws, so it does not compete with the simulation. PixiJS stays an option if performance needs it. |
| UI | SolidJS over the canvas | Inventory, toggles and sheets are dense menus, which the DOM handles better than a canvas. |
| Build and tests | Vite, pnpm, Vitest, Playwright, oxlint, oxfmt | Same as the other repositories. |

Three.js with voxel models and 2D sprite sheets were both tried and dropped. Phaser was not used, since it brings its own scene and physics model, which would compete with a separate simulation.

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

The working reference is `experiments/demo`. Its rig is in `experiments/demo/rig.ts`.

### Visual tone

The game is mature: cult imagery, gore and corruption are part of the look.

- **Greyscale world.** Almost everything is grey.
- **Color is information.** Only a few things keep color, and each color has one meaning:
  - Red: blood, damage, danger, cult marks.
  - Gold: light, the bearer, treasure, the Writ's seal.
  - Teal: the Hollow's dead and magic.
  - Element effects (fire, frost, venom and so on) show their color briefly.
- **Gore stays.** Hits spray blood that stains the floor. The dead fall apart into paper pieces that remain in pools of blood.
- **Cult and death props:** blood sigils with candles, altars, gibbets with hanging bodies, heads on pikes, flayed banners.

### Pixel art

- The frame is drawn at 384×216 and scaled up 3× with no smoothing.
- Every pixel snaps to the palette: a grey ramp plus the information colors, with a light ordered dither.

### Light

- The world outside light is dark but still visible.
- The bearer's lantern lights hard rings around it, each a step brighter. There is no soft glow, since soft gradients speckle in pixel art.
- Candles light small rings. Each merc carries a faint light, so the party never disappears.
- Glowing things (eyes, flames, growths) are drawn after the darkness, so they shine through it.

### Figures

- Units are cut-paper figures: flat angular shapes, tapered limbs, a plain polygon head and no face.
- Each figure is a 3D skeleton of joints, turned to face any angle and projected into the isometric view. Paper pieces are drawn between the projected joints and sorted back to front. A body narrows when seen from the side.
- Legs use two-bone IK. Feet step and lift, and the walk cycle advances with distance walked, so feet do not slide.
- Attacks have a windup, a strike and a recovery. Damage lands on the strike frame.
- Equipment is a shape attached to a joint, so loot changes how a merc looks. Signature items have thickness, so they still read edge-on.

### Other art

- Item icons and UI art are drawn in code in the same style.
- Merc portraits are cut-paper busts generated from the recruit's seed.
- Effects such as fire, frost and sparks are pixel particles.
- Claude checks the result through Playwright screenshots and adjusts.

### Unit design

The art is minimalist. A unit's design must show its job at a glance.

- Each unit is a plain body plus one oversized signature item. The Vanguard is a tower shield wider and taller than its body. The Ranger is a bow taller than itself.
- Detail is cut, not added. If a shape does not help tell the job apart, it goes.
- Sides read by brightness:
  - Mercs are pale.
  - Monsters are dark, with glowing features such as eyes or growths.
  - The bearer is small and dark, and only the lantern is bright.
- Every new unit is checked in a screenshot at game resolution before it is accepted.

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
  render/      canvas renderer, figure rig, light, palette snapping, effects
  ui/          Solid: map, inventory, toggles, merc sheet
```

## First milestone

The goal is to prove the combat engine before anything else.

1. Port `core/` from the-fighting-game. Add trigonometry tables.
2. Build the damage pipeline for physical and magical damage and one element. Test each step with Vitest.
3. Run a headless fight: one merc, three monsters and the citizen on a grid. Test that a guard merc keeps the citizen alive.
4. Draw that fight with the isometric canvas renderer.
5. Add the toggle panel in Solid.

## Later milestones

1. Party of four, recruiting, wages, camp and town nodes.
2. Full inventory, rolled loot, sockets, refine, crafting, skill trees, stat allocation.
3. Uniques.
4. Four phases with bosses, events and NPCs.
5. Squad sets, after uniques are tested.
6. Compendium, endless mode, seed sharing.

The toggle UI carries the most risk. If editing toggles is tedious, the game is tedious. Prototype it early.
