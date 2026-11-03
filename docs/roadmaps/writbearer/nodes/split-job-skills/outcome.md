# Outcome: split-job-skills

## Built

Each job's skill and passive code now lives in its own module. skills.ts is 762 -> 28 lines, passives.ts 130 -> 23 lines. Code, names, numbers and comments are unchanged.

Where names live now:

- `src/content/vanguard.ts`: CHALLENGE, CRUSH, SHIELD_BASH, INTERCEPT, `crushEarth`, SUNDER, `sunderText`, VOW, `vowText`, SHARED_BURDEN, `sharedBurdenText` (plus the private ratios, times and helpers `threatToBearer`, `challenged`).
- `src/content/ranger.ts`: AIMED_SHOT, SNARE, `comingForBearer`, CHARGED_ARROW, PIERCING_ARROW, PIN_DOWN, EAGLE_EYE, `eagleEyeText`, STATIC, `staticText`.
- `src/content/cleric.ts`: HEAL, RENEW, CLEANSE, RESURRECTION, SMITE, `PRAYER_REACH`, `flockOf`, `neediest` (the `healAmount` comment stays beside it).
- `src/content/monster-skills.ts` (new): HYMN, BURST.
- `src/content/skills.ts` keeps: `isElite`, `rankOf`, `inReach`, `inLine`, `PIERCE_WIDTH`, `PIERCE_OVERSHOOT` (`inLine` is used by Vanguard's Fault Line and Ranger's Piercing Arrow).
- `src/content/passives.ts` keeps only `listen`, now a default export: `import listen from './passives'`.

Importers updated: `src/content/jobs/{vanguard,ranger,cleric}/index.ts`, `roster.ts` (BURST, HYMN), `sets.ts` (listen), the three job modules (listen, moved names), and eight test files in test/sim (import paths only): statuses, progress, builds, morale, targeting, recruits, roster, skills.

## Deviations

- `listen` is now `export default` in passives.ts, because oxlint's prefer-default-export fires once passives.ts has a single export, the same rule job-registry hit. Importers changed from `{ listen }` to `listen` (vanguard.ts, ranger.ts, cleric.ts, sets.ts). `sets.ts` is outside the owned paths; the edit is one import line.
- `inLine` and its two constants stay in skills.ts instead of moving to ranger.ts, because vanguard.ts also uses `inLine`. `PIERCE_WIDTH` and `PIERCE_OVERSHOOT` in skills.ts are now exported, because ranger.ts (Piercing Arrow) and `inLine` both use them.
- Moved blocks sit above each job module's older code, not at the end, because `no-use-before-define` fires otherwise (`crushEarth`, `PRAYER_REACH`).
- Other edits outside the owned paths: `src/content/roster.ts`, `src/content/jobs/*/index.ts`, test imports (listed above).

## Stubs left

- None.

## Gotchas

- Upgrade nodes: skills.ts and passives.ts are no longer shared files for job code. Edit `src/content/<kind>.ts` instead. Do not add job code back to skills.ts.
- Shared helpers (used by two or more jobs) go in skills.ts or passives.ts; a job module should not import another job module.

## Proposed learnings

- Job skill code lives in its own `src/content/<kind>.ts`; skills.ts and passives.ts hold only helpers used by two or more callers | keeps upgrade nodes off shared files | src/content | no

## Verification

- `pnpm typecheck`: ok. `pnpm lint`: ok. `pnpm test`: 56 files, 436 passed, 24 skipped (same as before). `pnpm build`: ok.
- `pnpm format` run.

## Size

- Estimated M, actual M.
