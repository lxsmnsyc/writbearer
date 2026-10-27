# Outcome: slow-stage-tests

## Built

- `test/game/spawn.test.ts`: the altar test runs 10 seeds (was 30) for every objective and index 0, 1, 5. It still asserts at least one altar.
- `test/game/flow.test.ts`: "an open field's key points" runs 4 seeds (was 8) for every open-field objective and indexes 2, 10, 18, 26.
- No timeout was raised. No game code changed. Cost scales with case count (generateStage plus enterStage per case). I did not find that `generateStage` slowed down, but I did not bisect it.

## Deviations

- The worktree started at 1084f1b, older than 8e7cdd8, so I ran `git reset --hard 8e7cdd8` as instructed. Branch is `fix/slow-stage-tests`.

## Stubs left

- None.

## Gotchas

- Fewer seeds means a rare layout bug that only seeds 11 to 30 would hit is no longer caught by these two tests.

## Proposed learnings

- Tests that loop over generateStage should use few seeds (about 10 per objective) | each stage costs several ms and the fast check runs in parallel worktrees | test/ | no

## Verification

- Verify command `pnpm vitest run test/game/spawn.test.ts test/game/flow.test.ts --testTimeout=1500`: pass.
- Timings, before: altar 1.65, 1.92, 2.40 s; key points 0.78, 0.81, 0.93 s. After (3 runs): altar 0.61, 0.66, 0.61 s; key points 0.41, 0.44, 0.42 s. Load average was about 6.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (51 files, 424 tests): pass. e2e not run.

## Size

- Estimated S, actual S.
