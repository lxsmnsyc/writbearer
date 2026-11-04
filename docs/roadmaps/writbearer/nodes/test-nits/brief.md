---
id: test-nits
title: Tighten the compendium e2e and the Rearguard raise test
status: todo
priority: could
type: fix
outline: false
milestone: combat-core
target:
from:
size: S
spike: false
verify: pnpm vitest run test/sim/ranger-upgrades.test.ts && pnpm exec playwright test e2e/compendium.spec.ts
exclusive: [e2e-port]
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - e2e/compendium.spec.ts
  - test/sim/ranger-upgrades.test.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# Tighten the compendium e2e and the Rearguard raise test

## Goal

Two tests that pass for the wrong reason. Fix both, test code only.

## Context

- `e2e/compendium.spec.ts:13` reads `count()` on the Monsters list before it renders, so `total` can be 0 or short on a slow machine.
- `test/sim/ranger-upgrades.test.ts`, "does not reset Rearguard timer or trail": it still passes with the ranger-upgrades fix reverted (the trail and timer kept in a module `WeakMap` across `raise`). The review proved the bug with a scratch test (PR #14).
- `e2e/recruit.spec.ts:33` was listed with these; roster-balance already reads `FIGHTERS` there, so it is done.

## Acceptance

- [ ] The compendium spec waits for the list (a locator assertion such as `toHaveCount` or `not.toHaveCount(0)`) before it reads the total.
- [ ] The Rearguard raise test fails when `src/content/jobs/ranger/upgrades.ts` keeps the trail or timer in a local of `setup` (check by hand on a scratch change, then revert), and passes on main.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` passes; `pnpm exec playwright test e2e/compendium.spec.ts` passes.

## Sizing

S: two tests, no game code.

## Notes for the worker

- No changeset: no game change.
- The e2e run uses port 5199; only one copy at a time (`exclusive: [e2e-port]`). Run it from a worktree outside `.git/`.
