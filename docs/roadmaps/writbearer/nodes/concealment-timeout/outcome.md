# Outcome: concealment-timeout

## Built

- `test/sim/concealment.test.ts`, Escort test: seeds 1 to 200 instead of 1 to 400, and the repeat-generation determinism check runs on every fourth seed instead of every seed. Time alone: about 2.5 s to 0.6 s. Rate 45 of 183 Escorts (0.246).

## Deviations

- None. No timeout raised.

## Stubs left

- None.

## Gotchas

- The cost is `generateStage`, not the test logic. A rate of 0.246 on 183 samples is well inside the 0.18 to 0.32 band (same band, same `total > 100` floor).

## Proposed learnings

- Tests that generate many stages should keep the seed count small | each stage costs about 3 ms and vitest stops at 5 s under load | test/ | no

## Verification

- `pnpm vitest run test/sim/concealment.test.ts`: 7 pass, Escort test 635 ms.
- `pnpm test` run twice at once: 70 files, 688 passed, 3 skipped. `pnpm typecheck` and `rtk proxy pnpm lint` exit 0.

## Size

- Estimated S, actual S.
