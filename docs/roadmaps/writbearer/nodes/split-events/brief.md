---
id: split-events
title: Split src/sim/events.ts by feature
status: done
priority: should
type: refactor
outline: false
milestone: combat-core
target:
from:
size: S
spike: false
verify: pnpm typecheck && pnpm lint && pnpm test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent: 93019
owns:
  - src/sim/events.ts
  - src/sim/events/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Split src/sim/events.ts by feature

## Goal

Move the event payload types and their `SimEventMap` entries in `src/sim/events.ts` (215 lines) into one module per feature under `src/sim/events/`, with no change in behavior, so a node that adds an event adds its own module. `src/sim/events.ts` keeps `SimEvents` and re-exports every name, so the 72 importers do not change.

## Context

- Open nodes that add events today: bp-link, bp-possess, cc-corpses, cc-el-overshield, cc-el-skill-amp, cc-knockback, cc-sight-still, ie-item-roll. Each now appends to three lists in one file: the enum, the interfaces, the map.
- Maintainer decision (2026-11-05): split unit.ts, events.ts and roster.ts.

## Steps

- [x] Group modules, for example `src/sim/events/hits.ts` (CheckHit, CheckTarget, UnitMiss, UnitDamage, Buildup, CheckAttackElements), `skills.ts` (CheckSkillCost, windup, release, CheckSkillRank, CheckProjectile), `statuses.ts` (CheckBuildup, CheckStatusDuration, StatusEvent), `life.ts` (UnitHeal, UnitDies, UnitRevived, UnitRevealed, Tick, CheckChase). Each module exports its payload interfaces and one `interface <Group>EventMap` with its entries.
- [x] `SimEventMap` in `events.ts` becomes `interface SimEventMap extends EventMap, HitEventMap, SkillEventMap, ...` with no body.
- [x] `SimEvents` stays one `const enum` in `events.ts` (a const enum cannot be split across files). A new event is then one enum line in `events.ts` plus its own module and one name in the `extends` list.
- [x] Write the "how to add an event" rule in a nested `src/sim/events/CLAUDE.md`.

## Acceptance

- [x] Every existing test passes unchanged (`test/` has no diff).
- [x] No importer outside `src/sim/events.ts` and `src/sim/events/` changes.
- [x] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

S: types moved into four modules; the type checker proves it.

## Notes for the worker

- Group modules import `SimEvents` from `../events` only where a map key needs it; check `import/no-cycle` allows a type-only cycle, otherwise move the enum to `src/sim/events/names.ts` and re-export it.
