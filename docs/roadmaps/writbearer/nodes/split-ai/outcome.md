# Outcome: split-ai

## Built

- `src/sim/ai.ts` is a barrel (12 lines) re-exporting `Stance`, `Priority`, `Toggles`, `DRINK_AT`, `DEFAULT_TOGGLES`, `copyToggles`, `setToggles`, `skillMode`, `Hunt`, `ALARM_REACH`, `think`. No importer changed.
- `src/sim/ai/orders.ts`: orders types and constants, `withTraits`, `obeyed`, `MANA_AT`.
- `src/sim/ai/merc.ts`: `thinkMerc`, `drinkFromBelt`, `pick`, `weakest`, `useSkill`, `fallBack`.
- `src/sim/ai/monster.ts`: `Hunt`, `ALARM_REACH`, `thinkMonster`, `MONSTER_STEPS` (ordered list of `MonsterStep = (sim, u, dt, ctx) => boolean`: runForHelp, herald, lure, skill, support, pursue), `MonsterCtx`.
- `src/sim/ai/ward.ts` (`thinkWard`), `dodge.ts` (`sidestep`, `outOf`), `think.ts` (`think`), all default exports (lint rule prefer-default-export).
- To add a monster behavior: add a module exporting a `MonsterStep`, insert it into `MONSTER_STEPS` before `pursueStep`.

## Deviations

- Added `src/sim/ai/common.ts` (`nearest`, `engage`, `flee`). The brief puts `engage` in merc and `flee` in monster, but each module uses both, which would be an import cycle.

## Stubs left

- None.

## Gotchas

- `pursueStep` must stay last: it always returns true.
- `test/sim/concealment.test.ts` ("lands about one Escort in four") can hit the 5 s timeout when the machine is loaded; it passes alone.

## Proposed learnings

- Insert new monster behavior as a step in `MONSTER_STEPS`, not an `if` in `thinkMonster` | keeps monster-type nodes from editing one function | src/sim/ai | no

## Verification

- `pnpm typecheck && pnpm lint` pass. `pnpm test`: 686 passed, 1 timeout (concealment, load-related); that file passes alone with a longer timeout. `test/` has no diff.

## Size

- Estimated M, actual M.
