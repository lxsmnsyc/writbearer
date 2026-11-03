---
id: split-renderer
title: Split renderer.ts by feature
status: done
priority: must
type: refactor
outline: false
milestone: starting-jobs
target:
ship: auto
from:
size: L
spike: false
verify: pnpm typecheck && pnpm lint && pnpm test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent: 305700
owns:
  - src/render/renderer.ts
  - src/render/draw/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Split renderer.ts by feature

## Goal

`src/render/renderer.ts` is 2,156 lines, mostly one `Renderer` class plus `drawProp`. Eight open nodes edit it: hidden-units, bp-ground, gs-terrain-braziers, gs-terrain-grass, gs-terrain-hazards, gs-terrain-height-view, gs-terrain-landmarks and gs-terrain-lantern. Move its drawing features into modules under `src/render/draw/`, so each of those nodes changes mostly its own module. Behavior and output do not change.

## Context

- Read the briefs of the eight nodes above (`docs/roadmaps/writbearer/nodes/<id>/brief.md`) for what each draws. Their needs decide the seams. Most add a prop kind, a ground kind, a light or a unit state (hidden or disguised).
- Features that fit a module of their own include props (`drawProp` and its switch, `drawHornPost`), signs and plates (exits, objectives, rewards), bars and labels (health, boss bar, item labels), light and fog, and the HUD overlays drawn on the canvas. Pick the seams from the code.
- Existing modules show the pattern: `src/render/floor.ts`, `src/render/zones.ts` (`ZONE_LOOKS`, a registry by zone kind) and `src/render/looks/`.

## Steps

- [ ] Map the class's methods and the file's functions to features.
- [ ] Move each into `src/render/draw/<feature>.ts`. `Renderer` keeps its public interface and calls the modules in the same order, so draw order does not change.
- [ ] Turn the prop switch in `drawProp` into a table by `PropKind`, as `ZONE_LOOKS` is, so a new prop kind adds a file or an entry.

## Acceptance

- [ ] `Renderer`'s public interface and `Frame` do not change. No file outside `src/render/renderer.ts` and `src/render/draw/` changes, except import paths.
- [ ] No test file changes, except import paths.
- [ ] renderer.ts is about half its size or less.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`. `pnpm build` succeeds.

## Sizing

Over 2,100 lines in one class, draw order matters and tests barely cover rendering. L, opus.

## Notes for the worker

- Move code as it is. Keep the draw order and the canvas state (save, restore, alpha, transforms) the same.
- Tests do not cover most drawing. Before you open the pull request, run the game (`pnpm dev`, on a port other than 5199) and compare screenshots of a town, a fight and a boss stage with main.
- Nothing else goes into this pull request. Do not fix bugs you find; list them in the outcome.
- No changeset: the game does not change.
- Write in the outcome where each feature now lives and which tables exist. The orchestrator updates the eight downstream briefs from it.
