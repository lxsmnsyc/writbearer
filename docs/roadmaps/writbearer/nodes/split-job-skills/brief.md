---
id: split-job-skills
title: Move job skill code out of skills.ts and passives.ts
status: done
priority: must
type: refactor
outline: false
milestone: starting-jobs
target:
ship: auto
from:
size: M
spike: false
verify: pnpm typecheck && pnpm lint && pnpm test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-03
spent: 135400
owns:
  - src/content/skills.ts
  - src/content/passives.ts
  - src/content/vanguard.ts
  - src/content/ranger.ts
  - src/content/cleric.ts
  - src/content/monster-skills.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# Move job skill code out of skills.ts and passives.ts

## Goal

`src/content/skills.ts` (762 lines) and `src/content/passives.ts` (130 lines) hold the Vanguard, Ranger and Cleric skill code next to monster skills and shared helpers. The three upgrade nodes and job-hooks all edit them. Move each job's code into that job's own module, so each upgrade node edits only its own files. Behavior does not change.

## Context

- skills.ts sections: helpers (`isElite`, `rankOf`, `inReach`), `// Vanguard` (Challenge, Crush, Shield Bash), `// Ranger` (Aimed Shot, Snare, Charged Arrow, Piercing Arrow), `// Monsters` (Hymn, Burst), `// Added for the trees` (Pin Down: Ranger, Intercept: Vanguard), `// Cleric` (Heal, Renew, Cleanse, Resurrection, Smite, plus `PRAYER_REACH`, `flockOf`, `neediest`).
- passives.ts: `listen` (shared), then Sunder, Vow, Shared Burden (Vanguard), Eagle Eye, Static (Ranger).
- The job modules `src/content/vanguard.ts`, `ranger.ts` and `cleric.ts` already hold the rest of each job's skill code and import from skills.ts. The job registry (`src/content/jobs/<kind>/index.ts`) builds each job's spells from them.

## Steps

- [ ] Move each job's skills, passives, their constants and `*Text` functions into `src/content/<kind>.ts`.
- [ ] Move Hymn and Burst into `src/content/monster-skills.ts`.
- [ ] Keep in skills.ts and passives.ts only what more than one job or monsters use (`isElite`, `rankOf`, `inReach`, `listen`, and any helper with callers in two places).
- [ ] Update every importer to import from the new home. Do not leave re-exports in skills.ts: the job modules import skills.ts, so re-exporting them back creates an import cycle.

## Acceptance

- [ ] No skill, passive or constant that only one job uses is left in skills.ts or passives.ts.
- [ ] No test file changes, except import paths.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] `pnpm build` succeeds.

## Sizing

Moves about 800 lines between 6 files and updates imports, no logic. M.

## Notes for the worker

- Move code as it is: same names, same numbers, same comments. Nothing else goes into this pull request, so the review only checks that code moved.
- No changeset: the game does not change.
- The comment beside `healAmount` explains why Heal keeps 40+20r. Keep it with the code.
- Write in the outcome where each moved name now lives. The orchestrator then updates the upgrade briefs, which list skills.ts and passives.ts as shared today.
