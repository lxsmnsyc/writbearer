---
id: cc-afflictions
title: Fear and curse from skills, and dispel
status: todo
priority: should
type: feature
outline: false
milestone: combat-core
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/afflict.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/afflict.ts
  - test/sim/afflict.test.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# Fear and curse from skills, and dispel

## Goal

Skill-facing helpers for status effects that act on enemies. `frighten`: makes normal monsters flee for a time (not elites or bosses, not the bearer), with WIL resisting. `CURSED`: a status from skills (Hexblade and Medium later) that weakens its target and is resisted by WIL. `dispel`: removes buffs from an enemy (Sage Dispel, the Abbess's Litany on a Penitent).

## Context

- `DREAD` (`src/sim/statuses.ts`) already has `flees: true` and the AI makes any unit with a fleeing status run (`src/sim/ai.ts`). It builds up from hits and ignores rank; no skill gives it directly at a chosen length. Doc 03 says silence, fear and curse are resisted by WIL, and that curse exists; the code has no curse.
- `buffsOf` and `stealBuff` (`src/sim/status.ts`) give the list of stealable buffs; `dispel` uses `buff: true`, so monster buff statuses added later must set it.
- Immovable (`src/content/jobs/vanguard/upgrades.ts`) blocks Dread through `CheckStatusDuration`; cc-knockback changes it to block every `flees` status, so Frightened needs only `flees: true`. Give the status through `addStatus` so that event fires.
- Source: `docs/design/12-new-jobs.md#berserker` (Howl: normal monsters within 4 tiles run), `#sage` (Dispel), `03-combat-engine.md#status-effects`.

## Steps

- [ ] `frighten(source, targets, seconds)`: skips `Rank` above normal and the bearer; WIL scales the time down, a unit that is Dread-immune is skipped. Uses a new `FRIGHTENED` status (`flees`, `endsWithSource` false) defined in `src/sim/afflict.ts`.
- [ ] `CURSED` status: -25% attack and magic attack and halved healing received (first guess), 8 s, immunity 4 s, with a WIL threshold. `curse(source, target, power)` gives it through buildup or directly.
- [ ] `dispel(target, count?)`: removes up to `count` buffs (default all) and returns what it took, in order. Only the `buff` statuses; a status with `setup` stops cleanly (lifecycle runs).
- [ ] Tests: frighten skips a boss and an elite; a frightened mite runs from the source and returns to fight; curse lowers damage dealt, and WIL lowers its chance; dispel strips Mending and Shield Wall but not Stun.

## Acceptance

- [ ] A frightened normal monster runs for the time set; a boss, an elite and the bearer do not; time shrinks with WIL.
- [ ] Cursed units deal less and heal less; the status ends on time; `dispel` leaves it alone (only `buff` statuses go).
- [ ] `dispel` removes the buffs of an enemy and nothing else, firing the status stop hooks.
- [ ] `pnpm vitest run test/sim/afflict.test.ts` passes.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

One new module, known status patterns. M by the number of behaviors to test.

## Notes for the worker

- Silence is cc-cast-events's; do not add it here. The Blind status is in `statuses.ts` already.
- Victim lists go through `hostiles/allowed/canTarget` from `src/sim/targeting.ts`; area fear takes the foes in radius through `allowed(source, ...)`.
- A status given to a unit that just left (Sellsword Bribe sets `alive = false`) must check `alive`.
- Do not edit the Vanguard upgrades; Immovable is cc-knockback's.
- Sim stays DOM-free. Saved runs from before must still load (`src/game/save.ts`): a new Unit or Sim field is optional, with a default.
