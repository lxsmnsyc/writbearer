# Tech stack and architecture

## Stack

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript | Decided. |
| Simulation | Plain TypeScript, no DOM | Runs headless in tests. Can move to a Web Worker later. |
| Rendering | Canvas 2D | Figures are drawn from projected skeletons, so no sprite sheets are needed. The whole frame is drawn small and scaled up. See [art](#art) and `src/render`. It only draws, so it does not compete with the simulation. PixiJS stays an option if performance needs it. |
| UI | SolidJS over the canvas | Inventory, toggles and sheets are dense menus, which the DOM handles better than a canvas. |
| Build and tests | Vite, pnpm, Vitest, Playwright, oxlint, oxfmt | Same as the other repositories. |

Three.js with voxel models and 2D sprite sheets were both tried and dropped. Phaser was not used, since it brings its own scene and physics model, which would compete with a separate simulation.

## Simulation

- The simulation runs at a fixed 20 ticks per second (50 ms).
- The renderer interpolates between ticks.
- All game rules live in the simulation. The renderer and the UI read its state and send commands.
- Commands from the player (move, hand off, shout, mark) are queued and applied at the start of a tick.

## Randomness

- Streams use mulberry32 (`src/core/rng.ts`). Its whole state is one 32-bit number, so a save stores each stream as one number.
- A stream's seed is a hash of the run seed, the phase and the stream name (`src/core/seed.ts`). Drawing from one stream never changes another.
- Run seeds are 8 characters of Crockford base 32, such as `7KQ2M9XA`. A typed seed is trimmed and upper-cased. Any other text works.
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

The renderer is in `src/render`. The figure rig is `src/render/rig.ts`. `tools/rig-sheet.html` shows every figure at 8 facings, through a walk cycle and through its attack, for checking animation.

### Visual tone

The game is mature: the Church's blood rites, gore and corruption are part of the look.

- **Greyscale world.** Almost everything is grey.
- **Color is information.** Only a few things keep color, and each color has one meaning:
  - Red: blood, damage, danger, the Church's sealing marks.
  - Gold: light, the bearer, treasure, the Writ's seal.
  - Teal: the Hollow's dead and magic.
  - Element effects (fire, frost, venom and so on) show their color briefly.
- **Gore stays.** Hits spray blood that stains the floor. The dead fall apart into paper pieces that remain in pools of blood.
- **Church and death props:** blood sigils with candles, altars, gibbets with hanging bodies, heads on pikes, flayed banners with the Church's eye.

### Pixel art

- The frame is drawn at 384×216 and scaled up 3× with no smoothing.
- Every pixel snaps to the palette: a neutral grey ramp, a warm one for lit stone, a cool one for the dark, and the information colors, with a light ordered dither.
- The floor is worn flagstones of uneven size, drawn once per stage: mortar, cracks, grit, grime, puddles of black water, rubble and bones. There is no visible grid.
- The camera stays at its normal distance. A closer camera was tried and dropped, since it cost the player too much field of view.

### Light

- The scene is multiplied by a light map: a cold, dim ambient, plus warm light where lights reach.
- The bearer's lantern lights hard rings around it, each a step brighter. There is no soft glow, since soft gradients speckle in pixel art.
- Candles light small rings. Each merc carries a faint, cold light, so the party never disappears.
- Glowing things (eyes, flames, growths) are drawn after the light, so they shine through the dark.
- Light casts no shadows. The light map covers the whole screen and has no depth, so shadows fell across figures standing in front of them. Fog of war does the hiding instead.

### Fog of war

- The party sees only around itself: the bearer 7 tiles, each merc 4.5. Pillars, altars and other solid props block sight; bodies do not.
- Ground the party has seen stays dimly remembered. Props there are drawn dimmed. Monsters there are hidden.
- Ground never seen is black, so packs come out of the dark.
- The fog lives on a grid of quarter tiles and is drawn on the floor, under everything that stands. Each standing thing is shown, dimmed or hidden by the cell it stands on, so the fog never covers a figure in front of it.
- Fog of war is visual only. Monster and merc AI keep their own sight.

### Atmosphere and impact

- Low fog drifts through the light, ash rises through it, and fine grain and a vignette sit over the frame.
- Heavy hits freeze the frame for a moment and shake the screen. Whoever is hit is pushed back a little, and blood sprays.

### Interface

- Panels and party cards are torn paper with ink text in IM Fell English, an old print face that echoes the Writ and the Church's manuscripts.
- The interface is due for another pass.

### Figures

- Units are cut-paper figures: flat angular shapes, tapered limbs, a plain polygon head and no face.
- Pieces are thick, with slightly uneven hand-cut edges, and each casts a hard paper shadow.
- Each figure is a 3D skeleton of joints, turned to face any angle and projected into the isometric view. Paper pieces are drawn between the projected joints and sorted back to front. A body narrows when seen from the side.
- Legs use two-bone IK. Feet step and lift, and the walk cycle advances with distance walked, so feet do not slide.
- Attacks have a windup, a strike and a recovery. Damage lands on the strike frame.
- The dead fall back over their heels and lie where they fell, in a pool of their blood. A killing blow of 30% of max health or more, or a critical one, tears the body into paper pieces instead.
- Statuses show as marks in their element's color: motes circling the head for Stun and the like, frost at the feet for Chill, embers or bubbles rising for Burn and Poison, a red notch for Taunted. A thin bar under the health bar fills as a status builds up.
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
  render/      canvas renderer, figure rig, floor, light, fog of war, atmosphere, palette snapping, effects
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
