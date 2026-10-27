---
id: targeting-rules
title: CheckTarget: one rule for who may be targeted
status: done
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/targeting.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/sim/targeting.ts
  - test/sim/targeting.test.ts
shared:
  - src/sim/events.ts
  - src/sim/ai.ts
  - src/sim/sim.ts
reserves: []
provides: [targeting]
depends_on: []
---

# CheckTarget: one rule for who may be targeted

## Goal

Add the `CheckTarget` event and `canTarget` helper from the targeting contract, and route every target choice in the AI and in targeted skills through it. Nothing forbids a target yet, so play does not change.

## Context

- Target choice today: `pick` and `thinkMerc` for mercs, `thinkMonster` (taunt, hunt, nearest, `blocker`, `lureFor` bait) for monsters, all in `src/sim/ai.ts`; volleys and straight shots pick through `Sim.foes` in `src/sim/sim.ts`; skills choose in their `wants` and release code in `src/content/*.ts`. Ally choices (heals, buffs) are not filtered.
- Event types live in `src/sim/events.ts` (see `CheckHit` for the pattern).
- Source: `docs/design/03-combat-engine.md#threat-and-targeting` (CheckMonsterTarget). Threat itself is out of scope (roadmap combat-core).

## Acceptance

- [ ] A test listener that forbids one monster makes mercs and skills pick another one.
- [ ] A forbidden current target is dropped on the next think.
- [ ] Area damage still hits a forbidden unit, and heals still reach allies.
- [ ] Fast check passes, with no changes to existing tests.

## Sizing

Touches ai.ts (shared) and many call sites; uncertainty low. M.

## Notes for the worker

- Skill files in src/content are owned by job nodes. Put the filter in shared helpers (target lists in ai.ts or a `targets()` helper in targeting.ts) rather than editing every skill.
