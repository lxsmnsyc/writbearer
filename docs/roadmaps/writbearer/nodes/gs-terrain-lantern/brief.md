---
id: gs-terrain-lantern
title: One lantern: light level, shading, drawn-to monsters
status: todo
priority: should
type: feature
outline: false
milestone: gauntlets-stages
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/lantern.test.ts && pnpm vitest run test/game/mutators.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/sim/lantern.ts
  - test/sim/lantern.test.ts
shared:
  - src/sim/unit.ts
  - src/sim/ai.ts
  - src/render/renderer.ts
  - src/render/light.ts
  - src/game/mutators.ts
  - src/game/game.ts
  - src/content/roster.ts
  - src/ui/app.tsx
  - src/sim/ground.ts
reserves: []
provides: []
depends_on:
  - on: gs-terrain-kinds
    kind: contract
    via: terrain
---

# One lantern: light level, shading, drawn-to monsters

## Goal

The bearer's lantern becomes sim state (`Sim.lantern`: radius with multiplier slots) that the renderer, the fog and monster noticing all read, and `Frame.dark` becomes a number. The bearer can shade it (less light, noticed from less). Some monsters are drawn to an unshaded lantern. A boss or effect can lower or put out the light for a time while fixed sources (braziers) hold. `sim.ground.litAt` reports lit ground.

## Context

- Three numbers exist today: fog sight 7 (`renderer.ts:128`), light radius 6.5 (`:741`), and each monster's `kit.notice` (`ai.ts:428`). Darkness is a renderer-only boolean (`DARK_SHARE`).
- This node also serves the bosses (Lantern-Eater, Faceless Regent) and later night, the Lamplighter and gs-phase-modifiers: give it slots for night, Darkness and a timed put-out. Night Eyes was dropped from the Warden (doc 16), so no job widens the lantern yet.
- Introduce one `noticeRange(sim, monster, target)` in `ai.ts` as the single place light, cover and shading change noticing.
- Source: `docs/design/11-stages.md#light-and-vision`, `13-bestiary.md#the-marches` (Lantern-Eater).

## Acceptance

- [ ] Shading cuts the notice range by the shade share; a drawn-to monster walks to an unshaded lantern in range, not a shaded one.
- [ ] Putting the light out for 10 s shrinks noticing and the drawn light, then restores it; a held source stays lit.
- [ ] The Darkness mutator and Night Eyes behave as before.
- [ ] Fast check passes.

## Sizing

Sim state replacing three renderer numbers, plus a toggle key. M.

## Notes for the worker

- Keep the current ranges (7, 6.5, `notice`) as the defaults; existing tests rely on them.
- Use a fixed key for shading until gs-controls lands.
- Blind is added by sellsword-upgrades; do not add another.
