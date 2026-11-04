# Outcome: split-renderer

## Built

`src/render/renderer.ts` went from 2,156 lines to 366. It keeps the `Renderer` class (camera, `iso`/`body`, hit tests, the floor cache, the fog instance and the draw order in `render()`) and the `Frame` interface. Every drawing feature moved to `src/render/draw/`. Code was moved as it was; `render()` calls the modules in the old order.

Public interface unchanged: `renderer.ts` still exports `default Renderer`, `Frame`, `W`, `H`, `SCALE`, `EXIT_PLATE` and `LABEL_COLOR` (the last five are re-exports). `src/game/game.ts` and `src/ui/items.tsx` were not touched.

Where each feature lives now:

| Feature | File | Exports |
| --- | --- | --- |
| Shared draw context, frame size, tile size, helpers | `draw/scene.ts` | `Scene` (`ctx`, `out`, `scratch`, `iso`, `body`, `sub`), `W`, `H`, `SCALE`, `tw()`, `th()`, `propsOf`, `focusOf`, `onScreen` |
| Props: shapes, light, flames | `draw/props/` | see the table below |
| Everything that stands, sorted back to front (props, units, waiting figures, flying pieces), and prop dimming | `draw/standing.ts` | `drawStanding`, `Standing` |
| Unit figures, horn posts, emissive glows, `seen()`, bar height | `draw/figures.ts` | `drawFigure`, `glowsOf`, `seen`, `barHeight` |
| Lantern light map and fog viewers (sight 7 and 4.5, lantern light 6.5, `DARK_SHARE`, lit safe places) | `draw/light.ts` | `drawLight`, `viewersOf`, `Viewer` |
| Glows after the dark: key, captain's pennant, Hunt mark, statuses, emissives, prop flames | `draw/glow.ts` | default `drawGlow` |
| Status marks over heads, status colors, buildup statuses | `draw/statuses.ts` | `drawStatuses`, `STATUS_COLOR`, `BUILDUP_STATUS` |
| Health bars and buildup bar | `draw/bars.ts` | default `drawHealth` |
| Ground marks: skill zones, player traps, warnings, focus and selection rings, director spots | `draw/marks.ts` | `drawZones`, `drawTraps`, `drawWarnings`, `drawRings`, `drawSpots` |
| Labyrinth and Vault hazards | `draw/hazards.ts` | `HAZARD_LOOKS`, `HazardLook`, `drawHazards` |
| Objectives: sealing sigils, Ritual rites, Collapse edge | `draw/objectives.ts` | `drawSigil`, `drawRites`, `drawCollapse` |
| Exit plates and signpost text (objective, reward, ahead, mutators) | `draw/exits.ts` | `EXIT_PLATE`, `drawExits`, `drawSigns` |
| Items on the floor and their labels | `draw/items.ts` | `drawItems`, `drawItemLabels`, `ItemLabel`, `LABEL_COLOR`, `LABEL_HEIGHT` |
| Callout, waiting-figure labels, elite affix labels | `draw/labels.ts` | `drawCallout`, `drawFigureLabels`, `drawEliteLabels` |
| Embers on burning patches | `draw/embers.ts` | default `drawEmbers` |
| Off-screen arrows to marked monsters and the next rite | `draw/quarry.ts` | default `drawQuarry` |
| Notice, boss bar, end-of-run screen | `draw/hud.ts` | default `drawHud` |

Tables:

- `PROP_LOOKS` in `draw/props/index.ts`: `Partial<Record<PropKind, PropLook>>`, merged from four group files. A `PropLook` is `{ draw, light?, flame? }`: `draw` paints the shape in design pixels, `light(p)` returns the `Light` the prop adds to the light map, `flame(ctx, p, at, time)` paints what shines through the dark after the light (called only once its place is known, with the fill color set to flame). Kinds without an entry draw as a pale peg (`shapes.ts` `peg`). Helpers: `drawProp`, `propLight`, `drawPropFlame`, `hasFlame`.
  - `props/ruins.ts`: tree, pillar, wall, rubble, gibbet, pike, banner, altar, sarcophagus.
  - `props/town.ts`: signpost, post, strongbox, well, anvil, bench, chapel, stall.
  - `props/dungeon.ts`: vault, gate, lever, key, pit, chest, stair, blossom (with its glowing heart as `flame`).
  - `props/fires.ts`: torch, brazier, campfire, candle, each with `light` and `flame`.
  - `props/shapes.ts`: `block` (the stone block) and `peg`.
- `HAZARD_LOOKS` in `draw/hazards.ts`: `Partial<Record<HazardKind, HazardLook>>` with `spikes` and `vent`. Other kinds (`arrows`, `blade`, `floor`) fall back to the vent, as before.
- `ZONE_LOOKS` in `src/render/zones.ts` is unchanged.

Where the eight downstream nodes go:

- hidden-units: `seen()` in `draw/figures.ts` gates figures, bars, glows, labels and quarry arrows; `drawStanding` in `draw/standing.ts` picks what each unit is drawn as.
- bp-ground: next to `drawCollapse` in `draw/objectives.ts`, or a new `draw/` module called from `render()`. Water patches are floor (`src/render/floor.ts`).
- gs-terrain-braziers: the `brazier` entry in `draw/props/fires.ts` (shape, `light`, `flame`); a lit state reads `p` in those functions.
- gs-terrain-grass: an overlay module under `draw/`, called after `drawStanding` in `render()`.
- gs-terrain-hazards: new entries in `HAZARD_LOOKS`; a pit or rubble prop is a `PROP_LOOKS` entry (the `pit` and `rubble` looks exist).
- gs-terrain-height-view: the sort key and lift in `draw/standing.ts`; `iso`/`body` and the fog draw stay in `renderer.ts`.
- gs-terrain-landmarks: next to `drawSigns` in `draw/exits.ts`, or a new `draw/landmarks.ts`.
- gs-terrain-lantern: the three numbers (`BEARER_SIGHT`, `MERC_SIGHT`, the lantern light 6.5 now `LANTERN_LIGHT`) and `DARK_SHARE` all live in `draw/light.ts`. `Frame.dark` is still in `renderer.ts`.

## Deviations

- One step beyond the brief: the prop light and flame code that sat in `drawLight` and `drawGlow` as `if (p.kind === ...)` chains now lives in `PROP_LOOKS` next to each prop's shape, so a prop kind is one entry. Output is the same (see Verification).
- The hazard `if/else` became `HAZARD_LOOKS` in the same way.
- `+ flicker` (always 0) was dropped from the prop light radii; it is kept for the lantern and embers.
- No file outside `src/render/renderer.ts` and `src/render/draw/` changed, not even import paths.

## Stubs left

- None.

## Gotchas

- Draw modules take a `Scene`, built once in the `Renderer` constructor. `iso` and `body` read the camera live, so a `Scene` is valid on any frame.
- Modules import `Frame` from `../renderer` as a type only. Keep it type-only, or move `Frame` out first, to avoid a runtime import cycle.
- The repo's lint wants a default export in a file with a single export. That is why `glow`, `bars`, `embers`, `quarry`, `hud` and the prop group files use default exports. Adding a second export to one of them is fine; the default can stay.
- `drawSigns`, `drawItemLabels` and `drawFigureLabels` rely on the font and alignment that `Renderer.drawLabels` sets first. `drawCallout` puts the 13px font back after it; `drawEliteLabels` sets 11px.
- `drawPropFlame` is called with the fill color set to flame; a flame that changes it (the blossom) puts it back.
- Bugs seen, not fixed: none.

## Proposed learnings

- A new prop, hazard or zone kind adds an entry to `PROP_LOOKS`, `HAZARD_LOOKS` or `ZONE_LOOKS`, not a branch in the renderer | keeps nodes that add kinds apart | `src/render/` | no
- Compare rendering changes by drawing one captured `Frame` with both renderers in the same page, with a seeded `Math.random` | two dev servers running in real time never land on the same frame | `src/render/` | no

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: pass (56 files, 436 tests, 24 skipped). On the untouched tree the same suite once timed out in 2 to 6 heavy sim tests (5 s limit) while other worktrees loaded the machine. Those tests do not touch the renderer, and they passed on reruns.
- `pnpm build`: succeeds.
- No test file changed. `git diff main --stat` lists only `src/render/renderer.ts`, `src/render/draw/**` and this node's folder.
- Pixel comparison with main, using the same frame. Two dev servers running in real time never reach the same frame: the camera drifted a few pixels, so whole frames differed even where the code was the same. Instead, one dev server ran the branch with a temporary copy of main's `renderer.ts`, never committed. A Playwright script drove each scene, captured the `Frame` the game passed to `render()`, and drew that same Frame with both Renderers on fresh canvases, 40 times each, with the same seeded `Math.random`. It then compared the 1152×648 screens. Scenes: guild, town, a fight (area 2), Hunt, Horde, Ritual, Collapse, Labyrinth, Vault, Silence, Escort, Waystation, Event (toll), and the tomb boss early and 15 s into the fight. Result: 0 differing pixels in every scene. As a control, changing the candle light radius from 1.6 to 1.7 gave 10,964 differing pixels in the Hunt scene, so the check does catch changes.

## Size

- Estimated L, actual L.
