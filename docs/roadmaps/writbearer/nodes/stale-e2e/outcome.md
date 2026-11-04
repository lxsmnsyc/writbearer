# Outcome: stale-e2e

## Built

- `e2e/compendium.spec.ts`: the Monsters tab total is the number of monsters the tab lists, not a fixed 12.
- `e2e/save.spec.ts`: hires a Vanguard or Ranger (the Guild House needs one to let the party out) and clicks the exit plate once instead of on every poll.

## Deviations

- None. Both causes were in the tests; no game bug.

## Stubs left

- None.

## Gotchas

- Playwright specs cannot import from `src/` files that pull `~icons`; read game data through the page.
- `e2e/recruit.spec.ts` line 33 also picks the first non-cleric as a fighter; it passes today but can pick a non-fighter on other seeds.

## Proposed learnings

- E2E specs that need the party to leave the Guild House hire a Vanguard or Ranger | `hasFighter` blocks the exit otherwise | e2e | no

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: pass (one timeout flake in test/sim/concealment.test.ts under load, passes on rerun).
- `pnpm test:e2e`: 24 passed.

## Size

- Estimated S, actual S.
