# Outcome: cc-el-spectral

## Built

- `src/sim/spectral.ts` exports `UNMOORED` (status id `'unmoored'`, name Unmoored) and `UNMOORED_LOSS` (20). Threshold on WIL like Dread, 5 s, immunity 4 s, a debuff only: `modifiers` give armor -20% and resistance -20%. No element change on the target.
- `ELEMENT_STATUS[Element.Spectral] = UNMOORED` in `src/sim/statuses.ts` (one import, one appended line, comment trimmed). Any Spectral hit (`attackElement: Element.Spectral`, or `hit(..., { element: Element.Spectral })`) builds Unmoored through the existing buildup mechanic.
- `test/sim/el-spectral.test.ts` (8 tests): mapping, buildup and trigger, Neutral builds none, stat drop and restore, Spectral does 125% vs Spectral 1, Neutral does 90% vs Spectral 1, `attackElement` default.
- Changeset `.changeset/cc-el-spectral.md` (minor).
- For Monk and Medium modules: `import { UNMOORED } from '../../sim/spectral'`; set `attackElement: Element.Spectral` or pass `element` per hit.

## Deviations

- Brief says a Spectral attack does 100% to a Neutral target. `src/sim/elements.ts` has 90% (Spectral attacker vs Neutral 1). I left the table alone; the test asserts 90%. Spectral vs Spectral 1 is 125% as stated.
- The WIL threshold formula is duplicated in `spectral.ts` to avoid an import cycle with `statuses.ts`.
- The resistance drop is a `percent` -20 on a derived stat, so it only shows on units with resistance above 0; the test asserts armor strictly and resistance non-increasing.

## Stubs left

- None.

## Gotchas

- `ratio` in hit options is a percent (default 100); small ratios on low-INT mercs deal 0 and build nothing.

## Verification

- `pnpm vitest run test/sim/el-spectral.test.ts test/sim/statuses.test.ts test/sim/bosses.test.ts test/sim/boss.test.ts`: 36 passed.
- `pnpm typecheck` and `pnpm exec oxlint src test e2e`: clean. `pnpm test`: 87 files passed (before the last lint-only edits to a return type and an export keyword). `pnpm lint` prints "ESLint output (JSON parse failed)" and exits 1 in this worktree; oxlint run directly is clean.

## Size

- Estimated S, actual S.

Landed as 29c1d8a on batch/writbearer.
