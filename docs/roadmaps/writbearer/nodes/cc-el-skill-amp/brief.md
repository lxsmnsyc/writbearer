---
id: cc-el-skill-amp
title: Amplify bonuses for a specific skill
status: todo
priority: should
type: feature
outline: false
milestone: combat-core
size: M
spike: false
verify: pnpm vitest run test/sim/el-skill-amp.test.ts && pnpm vitest run test/sim/damage.test.ts test/sim/bosses.test.ts test/sim/boss.test.ts test/sim/creditor.test.ts test/sim/save.test.ts
exclusive: []
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/events/cc-el-skill-amp.ts
  - src/sim/skill-amp.ts
  - test/sim/el-skill-amp.test.ts
shared:
  - src/sim/stats.ts
  - src/sim/events.ts
  - src/sim/unit/combat.ts
  - src/sim/mechanics/damage.ts
  - src/sim/mechanics/skill.ts
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

# Amplify bonuses for a specific skill

## Goal

Add the missing "specific skill" amplify category (doc 03): an item, card or passive that says "Fireball deals 20% more". The damage event must know which skill made it, including a hit from a projectile that lands later.

## Context

- Source: `docs/design/03-combat-engine.md#damage-pipeline` ("Specific skill"). COVERAGE: "Amplify categories ... specific skill NOT BUILT".
- Built: `Category` (Race, TargetElement, AttackElement, AttackRange, Rank, Kind) in `src/sim/stats.ts`; the Amplify step in `src/sim/mechanics/damage.ts` multiplies per category; `Projectile.skill: string | null` already carries the firing skill id (`src/sim/projectile.ts`). `UnitDamageEvent` has no skill field.
- Category keys are numbers, skill ids are strings. Intern the ids in `src/sim/skill-amp.ts` (`skillKey(id): number`, stable for a run, never saved; bonuses are rebuilt on load).

## Steps

- [ ] Append `Category.Skill = 6` and `skill?: string` on `UnitDamageEvent` and `HitOptions`.
- [ ] Set it: `mechanics/skill.ts` records the casting skill id for the duration of `release` (module state on the sim, cleared after) so `Unit.hit` fills `skill` when the option is absent; projectiles pass `projectile.skill` when they strike.
- [ ] Add `[Category.Skill, skillKey(event.skill)]` to the Amplify list when `event.skill` is set.
- [ ] Tests: a card with `{ amplify: Category.Skill, key: skillKey('fireball'), percent: 20 }` boosts a Fireball hit and a Fireball projectile landing later, not a basic attack or another skill; categories still multiply with the others.

## Acceptance

- [ ] The bonus applies to the named skill's direct hit and to its projectile, and to nothing else (`test/sim/el-skill-amp.test.ts`).
- [ ] With no skill bonus on a unit, every hit's value is unchanged; `test/sim/damage.test.ts` and the three boss tests pass without edits.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

Touches `stats.ts`, `events.ts`, `unit.ts`, `damage.ts` and `skill.ts`, all hot or core, but each by an appended field or a single list entry and proven by a test. M.

## Notes for the worker

- Any change that can touch shared damage math must keep `test/sim/bosses.test.ts`, `boss.test.ts` and `creditor.test.ts` passing unchanged; they are seed-sensitive. New code does nothing until something opts in, so a seeded fight matches the code before the node.
- The multiplier list order does not change the product, but do not add an RNG draw. Skill ids are the `Skill.id` strings, as in `rankOf(u, 'fireball')`.
- Do not add card or item content that uses it; the content nodes do (ie-cards).
- Victim lists go through `hostiles`/`allowed`/`canTarget` (`src/sim/targeting.ts`), never `sim.foes` directly. Once-per-area effects key on `sim.area`. Passive state lives in a module `WeakMap<Unit, ...>`. Old saves must load. The sim stays DOM-free.

## After the splits

- After split-unit: the Unit logic lives in `src/sim/unit/` (movement, casting, statuses, gear, combat, kit). Edit the module listed under `shared:`, keep new per-unit state in a WeakMap in your own module, and leave `src/sim/unit.ts` alone.
- After split-events: put new event types and their map entries in `src/sim/events/cc-el-skill-amp.ts` and add one `SimEvents` line plus one name in the `SimEventMap` extends list in `src/sim/events.ts`.
