---
id: gs-terrain-height-view
title: Drawing height
status: todo
priority: should
type: feature
outline: false
milestone: gauntlets-stages
target:
from:
size: M
spike: false
verify: pnpm vitest run test/render/height.test.ts
exclusive: [e2e-port]
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/render/height.ts
  - test/render/height.test.ts
  - e2e/terraces.spec.ts
shared:
  - src/render/floor.ts
  - src/render/draw/standing.ts
  - src/render/renderer.ts
  - src/render/fog.ts
  - src/render/view.ts
reserves: []
provides: []
depends_on:
  - on: gs-terrain-ledges
    kind: hard
    why: draws the ledges and heightAt that node adds
  - on: split-renderer
    kind: hard
    why: moves renderer.ts features into modules under src/render/draw/; this node edits the moved code
---

# Drawing height

## Goal

The renderer shows ledges: plateau tops raised with one cliff face, ramps sloped, and units, props, shadows and fog lifted by `heightAt` with the right draw order.

## Context

- The floor is one cached canvas per stage (`src/render/floor.ts:45`); fog cells map through `iso(x,z)` at height 0; props and units sort by `x + z`.
- No render tests exist today: keep the math (lift per cell, ramp interpolation, sort key) in `height.ts` so it can be unit tested.
- Code layout: the sort key and lift live in `src/render/draw/standing.ts`. `iso`/`body` and the fog draw stay in `src/render/renderer.ts`.

## Acceptance

- [ ] Unit tests for lift, ramp interpolation and sort key pass.
- [ ] `pnpm test:e2e -g terraces` takes a screenshot of a terraced field.
- [ ] Fast check passes.

## Sizing

Render-only, but touches floor, fog and sorting; the riskiest terrain node. M, could grow to L.

## Notes for the worker

- Minimalist rule: one cliff shade, no texture.
- A raised cell's fog square must be lifted too.
