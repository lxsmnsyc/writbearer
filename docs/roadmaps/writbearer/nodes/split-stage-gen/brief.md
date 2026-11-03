---
id: split-stage-gen
title: Split gen/stage.ts by feature
status: active
priority: should
type: refactor
outline: false
milestone: gauntlets-stages
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
owns:
  - src/gen/stage.ts
  - src/gen/stage/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Split gen/stage.ts by feature

## Goal

`src/gen/stage.ts` is 2,251 lines: the stage types and the whole generator. Nine open nodes edit it: bp-ground, bp-roll and the seven gs-terrain nodes (kinds, braziers, deep, grass, hazards, ledges, patrols). Move its features into modules under `src/gen/stage/`, so each of those nodes changes mostly its own module. Generated stages do not change.

## Context

- Read the briefs of the nine nodes above (`docs/roadmaps/writbearer/nodes/<id>/brief.md`) for what each adds. Their needs decide the seams.
- Features that fit a module of their own include the types (`Stage`, `Prop`, `Patch`, `Pack`, `Exit`, ...), exits and roads (`placeExits`, `beyond`), hazards and traps, packs and threat (`THREAT`, pack placement), props and solids (`SOLID`), vaults, the Labyrinth and gates, the collapse, boss stages and holes (`holesOf`, `ensureReachable`). Pick the seams from the code.
- `src/gen/stage.ts` stays the entry point: it keeps `generateStage` and re-exports the types, so importers do not change.

## Steps

- [ ] Map the file's functions and constants to features.
- [ ] Move each into `src/gen/stage/<feature>.ts`. Keep `generateStage` calling them in the same order.
- [ ] Where a later node adds a kind (a ground kind, a prop kind, a hazard kind), keep that kind's data in one table in its module, so the later node adds an entry.

## Acceptance

- [ ] Every seeded stage is the same as on main. Write a test that generates stages for a range of seeds, biomes and node kinds and compares them with a snapshot taken on main before the move. Keep that test.
- [ ] No other test file changes, except import paths. No file outside `src/gen/` changes, except import paths.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`. `pnpm build` succeeds.

## Sizing

Over 2,200 lines, and the generator draws random numbers in a fixed order. L, opus.

## Notes for the worker

- Move code as it is. The order of random draws must not change, or every seeded stage changes. The snapshot test catches that.
- Stage generation tests are slow. slow-stage-tests keeps them under the 5 second limit. Keep the new snapshot test under that limit too.
- Nothing else goes into this pull request. No changeset: the game does not change.
- Write in the outcome where each feature now lives and which tables exist. The orchestrator updates the nine downstream briefs from it.
