---
id: second-wind-area
title: Sellsword Second Wind once per area
status: todo
priority: should
type: fix
outline: false
milestone: combat-core
target:
from:
size: S
spike: false
verify: pnpm vitest run test/sim/sellsword.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/content/jobs/sellsword/spells.ts
  - test/sim/sellsword.test.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# Sellsword Second Wind once per area

## Goal

The Sellsword's innate Second Wind says "once per stage" but fires once per run: `WINDED` (`src/content/jobs/sellsword/spells.ts`) is a `WeakSet<Unit>`, and the party's units carry over between areas in one Sim (`carryParty`, `src/game/stage.ts`). Key it on `sim.area`, as Play Dead and Last Line do, so it fires again in each new area.

## Context

- Found in sellsword-upgrades (outcome, Gotchas). Play Dead in `src/content/jobs/sellsword/upgrades.ts` shows the pattern.
- Rule: `src/content/CLAUDE.md`, once-per-area effects.

## Acceptance

- [ ] A test in `test/sim/sellsword.test.ts`: Second Wind fires, fires no second time in the same area, and fires again after `sim.area` goes up with the same unit.
- [ ] The test fails with the old `WeakSet`.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

S: one constant and one test, in one module.

## Notes for the worker

- Store the area it last fired in (`WeakMap<Unit, number>`), not a flag.
- Changeset: `patch` (changed behavior).
- The boss tests (`test/sim/bosses.test.ts`) run one area each, so they should not move; run them to be sure.
