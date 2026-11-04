---
id: layer-map-snapshot
title: Snapshot of layer maps by seed
status: todo
priority: could
type: chore
outline: false
milestone: gauntlets-stages
target:
from:
size: S
spike: false
verify: pnpm vitest run test/gen/map-snapshot.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - test/gen/map-snapshot.test.ts
  - test/gen/__snapshots__/map-snapshot.test.ts.snap
  - src/gen/CLAUDE.md
shared: []
reserves: []
provides: []
depends_on: []
---

# Snapshot of layer maps by seed

## Goal

A test that hashes `generateLayerMap` (`src/gen/graph.ts`) for a few seeds and every layer, as `test/gen/stage-snapshot.test.ts` does for stages, so a change that adds an RNG draw before an existing one shows in the snapshot diff. Then the rule in `src/gen/CLAUDE.md` is checked by a test, and the prose can go.

## Context

- mastery-offers placed `rollMastery` after `rollMutators` so old seeds keep their maps; nothing checks that today.
- Pattern: `test/gen/stage-snapshot.test.ts` (hash of a stage per seed and index).

## Acceptance

- [ ] `test/gen/map-snapshot.test.ts` covers seeds 1 to 4 and each layer, including an endless phase.
- [ ] Moving `rollMastery` before `rollMutators` on a scratch change fails the test.
- [ ] Remove the bullet in `src/gen/CLAUDE.md` (or delete the file if it is the only one).
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

S: one test file following an existing one.

## Notes for the worker

- No changeset: test only.
