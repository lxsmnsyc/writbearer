---
id: sellsword-coin
title: Sellsword: the Coin branch
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/sellsword-coin.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/content/jobs/sellsword/coin.ts
  - test/sim/sellsword-coin.test.ts
shared:
  - src/game/wages.ts
  - src/game/town.ts
  - src/gen/loot.ts
  - src/sim/sim.ts
  - src/game/game.ts
reserves: []
provides: []
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: sellsword
    kind: hard
    why: Paid in Full uses the bonus-rank modifier the sellsword node adds
---

# Sellsword: the Coin branch

## Goal

Build the Sellsword's Coin branch: Hazard Pay, Pocket Change, Bribe, Haggler, Paid in Full. Replace the placeholder branch in `src/content/jobs/sellsword/coin.ts`.

## Context

- Source: `docs/design/09-skill-trees.md#sellsword`, the Coin list.
- The Sellsword is registered as a placeholder job by job-registry, so tests can spawn it before the `sellsword` node lands.

## Acceptance

- [ ] Every node of the branch has a skill or effect, and each has a test.
- [ ] Fast check passes.

## Sizing

Five skills in one file plus small engine hooks. M.

## Notes for the worker

- Hazard Pay and Paid in Full read how much was paid over the wage at a Waystation (`src/game/wages.ts`). Add a hook there; do not change wage rules.
- Bribe makes a non-elite Human enemy leave the fight: it walks off the field and is removed, dropping nothing.
- Haggler lowers Town prices in `src/game/town.ts` while the Sellsword is in the party.
