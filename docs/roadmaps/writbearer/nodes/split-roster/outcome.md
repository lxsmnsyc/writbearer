# Outcome: split-roster

## Built

- `src/content/monsters/old-king.ts`, `church.ts`, `blight.ts`, `creditor.ts`: one default-exported const each (`OLD_KING`, `CHURCH`, `BLIGHT`, `CREDITOR`), holding the monster entries with their comments. Old King: hollowSoldier, hollowArcher, hollowShieldbearer, hornBearer, hornPost, husk, gatekeeper. Church: penitentSlinger, penitent, cantor, hollowed, abbess, hollowedSaint. Blight: mite, crawler, bloat, broodMother. Creditor: creditor.
- `src/content/monsters/table.ts`: `MONSTERS` (keys listed one by one in the old order, as `faction.key`) and `MonsterKind`. A new monster goes in its faction module and one line here.
- `src/content/monsters/steps.ts`: `MonsterStep = (unit: Unit, template: Template, sim: Sim) => void` and `MONSTER_STEPS: readonly MonsterStep[]`, empty (no flag handling existed). `spawnMonster` runs each step after the unit is made (elite or not), passing the base template `MONSTERS[kind]`.
- `src/content/spawn.ts`: `spawn` (not exported), `spawnBearer`, `spawnMerc`, `spawnMonster`, `spawnRefugee`, `spawnDisguisedAssassin`, `ELITE`, `BEARER`, `REFUGEE`, `ASSASSIN_FUSE`.
- `src/content/roster.ts`: barrel re-exporting `Template`, `MONSTERS`, `MonsterKind`, `MercKind` and the five exported spawn functions.
- `test/content/monster-table.test.ts`: checks the order of `Object.keys(MONSTERS)`.

## Deviations

- One new test file (allowed). `MONSTER_STEPS` is in `monsters/steps.ts`, not `spawn.ts`, so flag nodes do not edit `spawn.ts`. The faction modules use default exports because of the lint rule `prefer-default-export`.

## Stubs left

- `MONSTER_STEPS` is empty. be-thieves, be-kidnappers, be-flyers and be-corpse-raisers add entries.

## Gotchas

- Steps receive the base template, not the elite copy. `spawn` is not exported; a step that makes units uses `sim.add`, or exports `spawn` from `spawn.ts` itself.
- `test/sim/concealment.test.ts` can pass its 5 s limit under heavy machine load; it takes about 2.5 s alone.

## Proposed learnings

- None.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: pass (688 passed, 3 skipped). No existing test changed.

## Size

- Estimated M, actual M.
