---
id: cc-buffs
title: Party buffs with a duration and weapon element buffs
status: done
priority: should
type: feature
outline: false
milestone: combat-core
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/buffs.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent: 109571
owns:
  - src/sim/buffs.ts
  - src/sim/endow.ts
  - test/sim/buffs.test.ts
shared:
  - src/sim/mechanics/index.ts
reserves: []
provides: []
depends_on: []
---

# Party buffs with a duration and weapon element buffs

## Goal

Two engine pieces for the Berserker, Sage, Medium and Bard. First, `buffParty`: gives a `buff: true` status to every living party member in range (or the whole party), with a duration and power, refreshing instead of stacking when it is already on. Second, a weapon element buff (Endow): a status that sets the element of a unit's basic attacks, and of its skills that use the weapon element, for a while.

## Context

- Statuses already have duration, `modifiers`, `buff` and `setup` (`src/sim/status.ts`); `stealBuff` and `buffsOf` exist. What is missing is a way to give one to a group, and a status that changes the hit element. Banner and Rally are zones and shouts, not buffs.
- The hit element is `options.element ?? this.attackElement` (`src/sim/unit.ts`, `Unit.hit`). The `CheckAttackElements` event (job-hooks contract) reads `[source.attackElement]` for the weakness choice in `src/sim/ai.ts`; the endow must show there too, or Sage's Endow picks an element the AI then ignores.
- Source: `docs/design/12-new-jobs.md#what-the-engine-needs`, `#sage` (Endow).
- Contract: `../../contracts/job-hooks.md`.

## Steps

- [ ] `src/sim/buffs.ts`: `buffParty(sim, source, def, seconds, power, opts?)` where `opts` has `radius` (around the source) and `includeBearer`. Returns the units that took it. Victims are the source's side, alive; no targeting check (allies).
- [ ] `src/sim/endow.ts`: `ENDOWED` status (`buff: true`; power encodes the element) and `endow(unit, element, seconds)`. A listener on `CheckAttackElements` and the hit path makes the element the unit's attack element while it lasts; a second endow replaces the first.
- [ ] Register the listener once in `setupMechanics` (`src/sim/mechanics/index.ts`) or from the status's `setup`.
- [ ] Test: buff reaches all in range and none out of range; refresh keeps one status; endow changes the damage element and the element table result; expiry restores the old element; `stealBuff` can take Endowed.

## Acceptance

- [ ] `buffParty` gives the status to every living ally in range, none to foes or the dead, and a second call refreshes the time without stacking.
- [ ] A merc endowed with Fire hits for Fire damage (damage event element) and the AI's weakness pick sees it; after expiry it hits with its own element again.
- [ ] A new unit added after the buff does not get it; the buff survives a skill rank raise (it is a status, not passive state).
- [ ] `pnpm vitest run test/sim/buffs.test.ts` passes.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

Two new modules and one registration line; known pattern (statuses, event listeners). M.

## Notes for the worker

- Endow is a status, so it lives in `statuses`, not a passive: nothing to keep in a WeakMap.
- Status data is not saved mid-fight; check `src/game/save.ts` before adding anything that must persist between areas.
- Do not edit `src/sim/statuses.ts`; the new statuses live in your modules.
- Skill elements set explicitly (`options.element`) stay as they are; only the weapon element is replaced.
- Sim stays DOM-free. Saved runs from before must still load (`src/game/save.ts`): a new Unit or Sim field is optional, with a default.
