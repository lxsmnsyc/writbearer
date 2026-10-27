---
id: stale-e2e
title: Two end-to-end tests that fail on main
status: todo
priority: must
type: fix
outline: false
milestone: starting-jobs
target:
from:
size: S
spike: false
verify: pnpm exec playwright test e2e/compendium.spec.ts e2e/save.spec.ts
exclusive: [e2e-port]
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - e2e/compendium.spec.ts
  - e2e/save.spec.ts
shared:
  - e2e/support/guild.ts
reserves: []
provides: []
depends_on: []
---

# Two end-to-end tests that fail on main

## Goal

`pnpm test:e2e` has 2 failing tests on main (seen 2026-10-27 at `59ac775`); the other 22 pass. The starting-jobs acceptance needs the full e2e run to pass, so make both pass again.

## Context

- `e2e/compendium.spec.ts`: expects the Monsters tab to read "0 of 12". The game now has 17 monsters, so the count is stale.
- `e2e/save.spec.ts`: walks the bearer east out of the Guild House and clicks the road's plate (`data-exits` on the canvas). After 30 s, `data-recruits` still lists the three recruits not hired, so the run never leaves the Guild House and no save is written.
- Neither test changed recently. The game around them did: monsters were added, and the Guild House flow changed with the recruit offers.

## Steps

- [ ] Compendium: read the expected total from the game data (the monster list the Compendium counts), not a fixed number.
- [ ] Save: find out why the plate click does not leave the Guild House. Check the plate's position in `data-exits`, whether the bearer is close enough, and whether leaving needs something the test does not do.
- [ ] If the cause is in the test, fix the test. If it is a game bug, fix it in the smallest change and say so in the outcome.

## Acceptance

- [ ] Both tests pass, run alone and in the full `pnpm test:e2e`.
- [ ] The other 22 end-to-end tests still pass.

## Sizing

Two test files, maybe one small game fix. S.

## Notes for the worker

- The e2e run starts a dev server on fixed port 5199. Do not run it while another node runs it (`exclusive: [e2e-port]`).
- If the save failure is a game bug outside these files, record the file you changed under Deviations.
