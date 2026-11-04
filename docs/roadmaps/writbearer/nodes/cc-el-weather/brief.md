---
id: cc-el-weather
title: Weather and biome tile fields
status: todo
priority: could
type: feature
outline: false
milestone: combat-core
size: M
spike: false
verify: pnpm vitest run test/sim/el-weather.test.ts && pnpm vitest run test/sim/bosses.test.ts test/sim/boss.test.ts test/sim/creditor.test.ts
exclusive: []
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/weather.ts
  - test/sim/el-weather.test.ts
shared:
  - src/sim/mechanics/fields.ts
  - src/game/stage.ts
  - src/render/zones.ts
reserves: []
provides: []
depends_on:
  - on: cc-el-field
    kind: hard
    why: reuses the field boost rule and listener in src/sim/mechanics/fields.ts, which that node creates
  - on: gs-terrain-kinds
    kind: contract
    via: terrain
    why: biome tile fields are keyed by ground kind; the kind tables and the Ground object come from that node
---

# Weather and biome tile fields

## Goal

Two more sources of element boosts beside skill fields: a weather that boosts one element across the whole stage (rain boosts Frost everywhere), and biome tiles that boost the element of their kind (an embers patch boosts Fire, a water patch Frost). Both apply to every unit standing there, on either side, since nobody owns them.

## Context

- Source: `docs/design/04-elements.md#element-fields`. Items: `../../COVERAGE.md`, "Element fields ... weather fields, biome tile fields".
- Weather is set by the phase modifiers (`gs-phase-modifiers`, outline). This node only provides `setWeather(sim, { element, percent })` and the boost; picking rain for a phase is that node's job.
- Terrain contract: `../../contracts/terrain.md`. Per-kind code is one table per concern keyed by kind; add a `FIELD_OF_KIND` table in `src/sim/weather.ts` (water to Frost, embers to Fire; no entry for the rest), not a switch in shared code.
- Patches are on `Stage`, not on the sim. Build the field circles from `Stage.patches` where the stage is set up in `src/game/stage.ts` (append a call), unless the `Ground` object offers a better query by then; if it needs a `fieldAt`, write a change request instead of editing the contract.

## Steps

- [ ] `src/sim/weather.ts`: ownerless fields in a module `WeakMap<Sim, ...>` (weather plus circles); `setWeather`, `setBiomeFields(sim, circles)`, `fieldBoost(sim, unit, element)`.
- [ ] Extend the damage listener of `cc-el-field` (append a call): the best of weather, tile and zone boosts applies, no stacking across sources of one element.
- [ ] Hook the stage setup in `src/game/stage.ts`; ZONE_LOOKS is not needed for weather. A faint tint for tile fields is optional and stays in `src/render/zones.ts`.
- [ ] Tests: weather boosts both sides; a unit on an embers patch boosts Fire only; no patches or weather means the old damage.

## Acceptance

- [ ] With rain set, a Frost hit by either side does `1 + percent/100` times damage anywhere; other elements are unchanged (`test/sim/el-weather.test.ts`).
- [ ] A hit from a unit standing in an embers patch is boosted for Fire, not for Frost; leaving the patch ends it.
- [ ] A stage with no patches matching a kind and no weather is bit-identical to before; the three boss tests pass without edits.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

Three small edits across game and sim plus a contract dependency. M.

## Notes for the worker

- Any change that can touch shared damage math must keep `test/sim/bosses.test.ts`, `boss.test.ts` and `creditor.test.ts` passing unchanged; they are seed-sensitive. New code does nothing until something opts in, so a seeded fight matches the code before the node.
- Victim lists go through `hostiles`/`allowed`/`canTarget` (`src/sim/targeting.ts`), never `sim.foes` directly. Once-per-area effects key on `sim.area`. Passive state lives in a module `WeakMap<Unit, ...>`. Old saves must load. The sim stays DOM-free.
- Old saves: weather and tile fields are derived from the stage at load, not stored.
- Do not edit `src/render/renderer.ts` or `src/sim/ground.ts`; other open nodes already do.
