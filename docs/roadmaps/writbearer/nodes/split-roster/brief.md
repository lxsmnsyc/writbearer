---
id: split-roster
title: Split src/content/roster.ts by feature
status: active
priority: should
type: refactor
outline: false
milestone: bestiary
target:
from:
size: M
spike: false
verify: pnpm typecheck && pnpm lint && pnpm test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns:
  - src/content/roster.ts
  - src/content/monsters/**
  - src/content/spawn.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# Split src/content/roster.ts by feature

## Goal

Move the monster table and the spawn functions in `src/content/roster.ts` (420 lines) into modules by faction and by feature, with no change in behavior, so the monster-type nodes add a faction entry or a template flag in their own module. `src/content/roster.ts` stays a barrel that re-exports every public name, so the 76 importers do not change.

## Context

- Open nodes that edit `src/content/roster.ts` today: be-corpse-raisers, be-flyers, be-kidnappers, be-strippers, be-thieves, bp-roll, gs-terrain-lantern. Most add a template flag read by `spawnMonster`, or new monsters.
- Maintainer decision (2026-11-05): split unit.ts, events.ts and roster.ts.

## Steps

- [ ] `src/content/monsters/<faction>.ts`: the `MONSTERS` entries grouped by the faction their comments name (the Old King's guard and dead, the Church's Penitents, the Blight, and the rest). `src/content/monsters/table.ts` builds `MONSTERS` from them with the keys in today's order, so `MonsterKind` and any iteration order stay the same.
- [ ] `src/content/spawn.ts`: `spawn`, `spawnBearer`, `spawnMerc`, `spawnMonster`, `spawnRefugee`, `spawnDisguisedAssassin`, `ELITE`, `BEARER`, `REFUGEE`, `ASSASSIN_FUSE`.
- [ ] Registration point in `spawnMonster`: an ordered list of template-flag steps, each `(unit, template, sim) => void`, run after the unit is made. Empty today, or holding any flag handling that already exists, in today's order. A node that adds a flag (thief, kidnapper, flyer, corpse raiser) adds one module and one list entry.
- [ ] `roster.ts` re-exports `Template`, `MONSTERS`, `MercKind`, `MonsterKind` and the spawn functions.

## Acceptance

- [ ] Every existing test passes unchanged (`test/` has no diff), including `test/gen/stage-snapshot.test.ts`.
- [ ] `Object.keys(MONSTERS)` returns the same keys in the same order as before (add a test if none checks it).
- [ ] No importer outside the owned paths changes.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

M: a table and five functions moved, plus one step list; the snapshot tests prove nothing changed.

## Notes for the worker

- Nothing else goes into this change, so the review only checks that code moved.
- Keep the job rule in `docs/roadmaps/writbearer/CLAUDE.md`: job nodes never edit `roster.ts`; that now covers `src/content/spawn.ts` and `src/content/monsters/` too.
