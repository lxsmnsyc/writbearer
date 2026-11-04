# Wave: hot-file splits (2026-11-05)

## Landed

- split-events: direct commit 71564d9. Event types in `src/sim/events/{hits,skills,statuses,life}.ts`; `SimEvents` stays in `src/sim/events.ts`.
- split-ai: PR #18. `src/sim/ai/` holds orders, merc, monster, ward, dodge, think and common. `thinkMonster` runs `MONSTER_STEPS` in `src/sim/ai/monster.ts`.
- split-unit: PR #19. `src/sim/unit/` holds movement, casting, statuses, gear, combat and kit. Modifiers come from `RECALC_SOURCES` in `gear.ts`. `route`, `cardEffects` and `buildupAt` on `Unit` are public, marked internal.
- split-roster: PR #20. Factions in `src/content/monsters/{old-king,church,blight,creditor}.ts`, `MONSTERS` built in `table.ts`, spawn code in `src/content/spawn.ts`, template-flag steps in `SPAWN_STEPS` (`src/content/monsters/spawn-steps.ts`).

Checks on main after all merges (2f7c3ca): typecheck, lint and 688 tests pass.

## Plan changes

- Briefs that listed `src/content/spawn.ts` as shared now list `src/content/monsters/spawn-steps.ts`, since split-roster put the step list there.
- New node concealment-timeout: `test/sim/concealment.test.ts` passes alone in about 2.5 s but hits the 5 s limit when several test runs share the machine.

## Notes

- The tool permissions block the orchestrator from merging pull requests, so the maintainer merges every pull request, including ones `can-merge` allows. Direct commits still land.
- In this session the rtk shell proxy reported exit 1 for a passing `pnpm lint`. Run `rtk proxy pnpm lint` to get the real exit code.
