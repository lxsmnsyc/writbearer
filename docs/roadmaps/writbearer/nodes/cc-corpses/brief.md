---
id: cc-corpses
title: Corpses laid to rest
status: done
priority: should
type: feature
outline: false
milestone: combat-core
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/corpse.test.ts && pnpm vitest run test/sim/creditor.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent: 116811
owns:
  - src/sim/events/cc-corpses.ts
  - src/sim/corpse.ts
  - test/sim/corpse.test.ts
shared:
  - src/sim/unit/combat.ts
  - src/sim/events.ts
  - src/content/creditor.ts
reserves: []
provides: []
depends_on:
  - on: split-unit
    kind: hard
    why: edits a feature module under src/sim/unit/ instead of the Unit class
  - on: split-events
    kind: hard
    why: adds its event types in its own module under src/sim/events/
---

# Corpses laid to rest

## Goal

One set of rules for "can this body still be raised", shared by every mechanic that raises or lays dead to rest: resurrection (Cleric), the Creditor's reveal, Medium's Last Rites and Consecrate, and the Necromancer and monster raisers later. A corpse that is torn, or laid to rest, or inside a guard that forbids raising, cannot be raised. Laying to rest is a new state with an event.

## Context

- Today a body can be raised if `!alive && !torn` (`Unit.revive` in `src/sim/unit.ts`; `reveal` in `src/content/creditor.ts` filters `!m.alive && !m.torn`). `torn` is set in `src/sim/mechanics/death.ts` for a big blow or a crit, never in a Respite area for the party.
- A unit can leave without `UnitDies` (Sellsword Bribe sets `alive = false`), so code that lists corpses must not count it: a corpse is a unit that died, which `torn` and the new rest state both track.
- be-corpse-raisers keeps monster corpses until the stage ends and raises them; it uses this module and does not make its own rules.
- Source: `docs/design/12-new-jobs.md#medium` (Last Rites), `#what-the-engine-needs`, `09-skill-trees.md#cleric` (Consecrate).

## Steps

- [x] `src/sim/corpse.ts`: `isCorpse(unit)` (dead, did die, still in the sim), `canRaise(unit)` (corpse, not torn, not rested, no guard forbids), `layToRest(unit, by)` (marks it in a module `WeakSet<Unit>`, emits `UnitLaidToRest`), `isRested(unit)`, `corpsesNear(sim, side, at, radius)`.
- [x] `addRestGuard(fn: (unit: Unit) => boolean)`: a guard that can forbid raising within some area, returns a `Lifecycle`-style remover. Consecrate will register one over its zone; this node writes no Consecrate.
- [x] `SimEvents.UnitLaidToRest` appended to `src/sim/events.ts`.
- [x] `Unit.revive` returns false for a rested or guarded body (one line calling `canRaise`); the Creditor's reveal filters with `canRaise`.
- [x] A rested body does not come back at the next area either (the carry-over of party units goes through `revive` or `carryParty`; check `src/game/stage.ts`).
- [x] Tests: raise works on a plain corpse; fails on torn, rested and guarded; `reveal` leaves rested mercs dead; a Bribed (left, not dead) merc is never a corpse; guard removal restores raising.

## Acceptance

- [x] `canRaise` is false for a torn, rested or guarded body and true otherwise; `revive` and `reveal` obey it.
- [x] `layToRest` emits `UnitLaidToRest` once and is idempotent.
- [x] A unit that left without dying is not a corpse.
- [x] `pnpm vitest run test/sim/corpse.test.ts` and `test/sim/creditor.test.ts` pass.
- [x] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

New module, one event, two one-line call sites. M.

## Notes for the worker

- Rested state may need to persist across areas: units carry over in one Sim via `carryParty`, so a WeakSet is enough there. Saved runs: check whether dead mercs are saved at all (`src/game/save.ts`); if they are, add an optional field with a default so older saves load.
- Once-per-area effects (a Rite once an area) key on `sim.area`; this module has none.
- What laying to rest gives (a buff, morale, gold) is mj-medium's. Here it only changes the state.
- Do not change when bodies are torn.

## After the splits

- After split-unit: the Unit logic lives in `src/sim/unit/` (movement, casting, statuses, gear, combat, kit). Edit the module listed under `shared:`, keep new per-unit state in a WeakMap in your own module, and leave `src/sim/unit.ts` alone.
- After split-events: put new event types and their map entries in `src/sim/events/cc-corpses.ts` and add one `SimEvents` line plus one name in the `SimEventMap` extends list in `src/sim/events.ts`.
