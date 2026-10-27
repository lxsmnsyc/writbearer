---
id: slow-stage-tests
title: Stage generation tests that pass the 5 second limit
status: active
priority: must
type: fix
outline: false
milestone: starting-jobs
target:
from:
size: S
spike: false
verify: pnpm vitest run test/game/spawn.test.ts test/game/flow.test.ts --testTimeout=1500
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - test/game/spawn.test.ts
  - test/game/flow.test.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# Stage generation tests that pass the 5 second limit

## Goal

`pnpm test` fails on main when the machine is busy: two tests that generate many stages run past vitest's 5 second timeout. Make both fast enough to pass with room to spare. The fast check must stay green for every node of starting-jobs, also when several worktrees run it at once.

## Context

- In `test/game/spawn.test.ts`, the altar test takes about 2.6 s alone and 5.3 s under load. It generates a stage and enters it for 30 seeds × every objective × 3 stage indexes.
- `test/game/flow.test.ts`, "an open field’s key points", takes about 1.3 s alone and over 5 s in the full suite under load.
- Seen on 2026-10-27 at commit `dffa66d`, with a load average near 40.

## Steps

- [ ] Time both tests and find what costs the most: the number of cases, `generateStage`, or `enterStage`.
- [ ] Cut the cost first: fewer seeds where the extra seeds cover no new layout, or skip work the assertion does not need. Raise the test's timeout only for what is left, with a comment saying why.

## Acceptance

- [ ] Both tests pass in under 1.5 s each when run alone (the verify command enforces it).
- [ ] They still cover every objective, and the spawn test still sees at least one altar.
- [ ] `pnpm test` passes.

## Sizing

Two test files, no game code. S.

## Notes for the worker

- If `generateStage` itself got slower in a recent commit, say so in the outcome instead of fixing it here. That is a node of its own.
