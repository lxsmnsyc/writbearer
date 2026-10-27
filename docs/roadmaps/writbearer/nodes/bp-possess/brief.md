---
id: bp-possess
title: Mind control, skill copy and buff theft
status: todo
priority: should
type: feature
outline: false
milestone: bestiary
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/control.test.ts && pnpm vitest run test/sim/creditor.test.ts test/sim/statuses.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-26
owns:
  - src/sim/control.ts
  - src/sim/copy.ts
  - test/sim/control.test.ts
shared:
  - src/sim/status.ts
  - src/sim/statuses.ts
  - src/sim/ai.ts
  - src/sim/sim.ts
  - src/sim/events.ts
  - src/content/creditor.ts
  - src/sim/targeting.ts
reserves: []
provides: []
depends_on:
  - on: targeting-rules
    kind: hard
    why: a controlled merc is a CheckTarget listener so Duel and Play Dead still hold
  - on: roster-balance
    kind: hard
    why: edits statuses.ts, ai.ts and sim.ts after the starting-jobs nodes settle them
---

# Mind control, skill copy and buff theft

## Goal

A timed mind control that turns a merc to the monster side and then restores its side, hunt, orders and target. A record of each merc's last released skill that a boss can cast with a power override. A `beneficial` flag on statuses and a move of buffs from one unit to another. Used by the Usurper.

## Context

- Base: the Creditor turns dead mercs for good (`src/content/creditor.ts:78`); AI dispatch is by side (`src/sim/ai.ts:580`); skills run on any unit (`Unit.startCast`); `UnitSkillRelease` carries source and skill.
- If sellsword-upgrades already added a buff flag for Cutpurse, reuse it.
- Source: `docs/design/13-bestiary.md#the-sunken-crown` (Usurper).

## Acceptance

- [ ] A controlled merc attacks the party for 6 s, then returns to its side and orders; the bearer cannot be controlled; Cleanse ends it.
- [ ] A boss copies the last skill at the merc's rank, ignoring mana.
- [ ] Theft moves duration and stacks.
- [ ] A controlled merc does not count toward party-wiped, morale, wages or kill credit.
- [ ] Fast check passes.

## Sizing

Three small mechanics, all for one boss. M.

## Notes for the worker

- cc-cast-events changes cast events; if it has landed, read its outcome first.
