---
id: split-game
title: Split game.ts by feature
status: active
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
owns:
  - src/game/game.ts
  - src/game/game/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Split game.ts by feature

## Goal

`src/game/game.ts` is 2,652 lines, nearly all one `Game` class. Eight open nodes edit it: mastery-offers, sellsword, sellsword-upgrades, bp-ground, bp-roll, gs-terrain-braziers, gs-terrain-hazards and gs-terrain-lantern. Move its features into modules under `src/game/game/`, so each of those nodes changes mostly its own module plus one registration or call line in game.ts. Behavior does not change.

## Context

- Read the briefs of the eight nodes above (`docs/roadmaps/writbearer/nodes/<id>/brief.md`) for what each adds to game.ts. Their needs decide the seams. Two examples: mastery-offers adds a Mastery road reward next to `spoilsOf`, and the terrain nodes add walk-up props, as levers do in `workMaze`.
- Features that fit a module of their own include rewards and spoils, chests and pickups, Waystations and the Guild House, the collapse, tombs and the Creditor, shouts and callouts, levers and the Labyrinth, and moving between areas. Pick the seams from the code. Do not copy this list blindly.
- Existing modules show the pattern: `src/game/alarms.ts`, `src/game/hazards.ts` and `src/game/objective.ts` are features already outside the class.

## Steps

- [ ] Map the class's methods and fields to features.
- [ ] Move each feature into `src/game/game/<feature>.ts`, as a small class or as functions that take the `Game` (or only the fields they need). `Game` keeps its public methods and fields, since the UI calls them, and delegates to the modules.
- [ ] Where a later node adds a kind of thing (a reward, a walk-up prop, a node kind), put a table or registration point in that feature's module, so the later node adds an entry instead of a branch inside `Game`.

## Acceptance

- [ ] `Game`'s public interface does not change. No file outside `src/game/game.ts` and `src/game/game/` changes, except import paths.
- [ ] No test file changes, except import paths.
- [ ] game.ts is about half its size or less.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`. `pnpm build` succeeds.

## Sizing

Over 2,600 lines in one class, many features and hidden coupling through `this`. Behavior risk is high if done carelessly, so L, opus.

## Notes for the worker

- Move code as it is: same names, numbers, order of updates and RNG streams (`WAYSTATION_STREAM`, `TOMB_STREAM` and others). Moving code must not change the order in which random numbers are drawn, or seeded tests change.
- Nothing else goes into this pull request. Do not fix bugs you find; list them in the outcome.
- No changeset: the game does not change.
- The orchestrator runs `pnpm test:e2e` after merging (fixed port 5199). Do not run it in your worktree.
- Write in the outcome where each feature now lives and which registration points exist. The orchestrator updates the eight downstream briefs from it.
