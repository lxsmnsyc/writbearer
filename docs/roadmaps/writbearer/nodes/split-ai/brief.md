---
id: split-ai
title: Split src/sim/ai.ts by feature
status: active
priority: should
type: refactor
outline: false
milestone: combat-core
target:
from:
size: M
spike: false
verify: pnpm typecheck && pnpm lint && pnpm test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/ai.ts
  - src/sim/ai/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Split src/sim/ai.ts by feature

## Goal

Move `src/sim/ai.ts` (725 lines) into one module per feature under `src/sim/ai/`, with no change in behavior, so the monster-type, job-system and terrain nodes each add their own module instead of all editing one file. `src/sim/ai.ts` stays as a barrel that re-exports the public names, so the 35 importers do not change.

## Context

- Open nodes that edit `src/sim/ai.ts` today: bp-possess, gs-terrain-grass, gs-terrain-lantern, gs-terrain-patrols. The combat-core and bestiary briefs refined on 2026-11-04 add more (fear, knockback, side switching, flyers, thieves).
- Rule: `docs/roadmaps/writbearer` decomposition, "Split hot files by feature first".

## Steps

- [ ] `src/sim/ai/orders.ts`: `Stance`, `Priority`, `Toggles`, `DRINK_AT`, `DEFAULT_TOGGLES`, `copyToggles`, `setToggles`, `skillMode`, `withTraits`, `obeyed`.
- [ ] `src/sim/ai/merc.ts`: `pick`, `weakest`, `engage`, `useSkill`, `fallBack`, `thinkMerc`, `drinkFromBelt`.
- [ ] `src/sim/ai/monster.ts`: `Hunt`, `thinkMonster`, `monsterSkill`, `support`, `flee`, `lureFor`, `wakePack`, `runForHelp`, `ALARM_REACH`.
- [ ] `src/sim/ai/ward.ts` (`thinkWard`) and `src/sim/ai/dodge.ts` (`outOf`, `sidestep`). `think` goes in `src/sim/ai/think.ts` (no `index.ts`, so `./ai` keeps resolving to the barrel).
- [ ] Registration point: `thinkMonster`'s branches become an ordered list of named steps, each `(sim, u, dt, ctx) => boolean` (true when it handled the tick), run in today's order. A new monster behavior adds a module and inserts one step, instead of an `if` in the middle of `thinkMonster`.

## Acceptance

- [ ] Every existing test passes unchanged (`test/` has no diff), including `test/gen/stage-snapshot.test.ts`.
- [ ] `src/sim/ai.ts` only re-exports; no importer outside `src/sim/ai/` changes.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

M: one file moved into five plus a step list; no behavior change, the existing tests prove it.

## Notes for the worker

- Nothing else goes into this change, so the review only checks that code moved.
- Keep the steps' order exactly; the boss and balance tests (`test/sim/bosses.test.ts`, `boss.test.ts`) are seed-sensitive and catch a reorder.
- Watch `import/no-cycle`: modules under `src/sim/ai/` import each other, never the `src/sim/ai.ts` barrel.
