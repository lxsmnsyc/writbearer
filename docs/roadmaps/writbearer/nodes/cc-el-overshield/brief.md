---
id: cc-el-overshield
title: Heal overshield
status: todo
priority: could
type: feature
outline: false
milestone: combat-core
size: S
spike: false
verify: pnpm vitest run test/sim/el-overshield.test.ts && pnpm vitest run test/sim/bosses.test.ts test/sim/boss.test.ts test/sim/creditor.test.ts
exclusive: []
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/overshield.ts
  - test/sim/el-overshield.test.ts
shared:
  - src/sim/events.ts
  - src/sim/mechanics/index.ts
reserves: []
provides: []
depends_on: []
---

# Heal overshield

## Goal

Overheal on some skills becomes a short shield, as doc 03 puts it for the Post step of the heal pipeline. A heal that carries `overshield` turns the health it could not add into a shield that absorbs damage for a few seconds.

## Context

- Source: `docs/design/03-combat-engine.md#damage-pipeline` (healing, "overheal becomes a short shield on some skills"). COVERAGE line 200 marks it NOT BUILT.
- Built: `src/sim/mechanics/heal.ts` (Pre, Exact), `HealPriority.Post` exists but nothing listens, `Unit.ward` (absorbs magical only), `buff` flag on statuses so Cutpurse can steal it.
- Keep it separate from Ward: a shield absorbs any damage kind except True.

## Steps

- [ ] `overshield?: number` on `UnitHealEvent` (append): the share of overheal kept, 0 to 1.
- [ ] `src/sim/overshield.ts`: a Post heal listener that adds a `buff: true` status `OVERSHIELD` (5 s) with the pool in a `WeakMap<Unit, number>`, capped at 20% of max health, and a damage listener after the Barrier step that spends the pool. Register both from `mechanics/index.ts` (append).
- [ ] Tests: overheal 40 at 0.5 gives 20 shield; no overheal or no flag gives none; the shield absorbs physical and magical but not true damage; it expires; a stolen buff does not duplicate the pool.

## Acceptance

- [ ] Overheal with `overshield` creates a shield that absorbs damage up to its pool and then ends; heals without the field behave as before (`test/sim/el-overshield.test.ts`).
- [ ] The three boss tests pass without edits.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

One new module and two appended lines. S.

## Notes for the worker

- Any change that can touch shared damage math must keep `test/sim/bosses.test.ts`, `boss.test.ts` and `creditor.test.ts` passing unchanged; they are seed-sensitive. New code does nothing until something opts in, so a seeded fight matches the code before the node.
- Do not set `overshield` on any existing skill; a cleric balance pass picks which.
- Pool in a WeakMap, not on `Unit`; statuses are not saved, so old saves load.
- Victim lists go through `hostiles`/`allowed`/`canTarget` (`src/sim/targeting.ts`), never `sim.foes` directly. Once-per-area effects key on `sim.area`. Passive state lives in a module `WeakMap<Unit, ...>`. Old saves must load. The sim stays DOM-free.
