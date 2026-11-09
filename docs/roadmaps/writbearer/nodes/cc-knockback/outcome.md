# Outcome: cc-knockback

## Built

- `src/sim/knockback.ts`: `knockback(source, target, from, distance)` (default export) pushes in 0.25 tile steps away from `from`; stops at a wall, a closed tile or another body (one step short); returns the distance moved; clears `route`. Bearer, `Rank.Boss`, rooted and dead units are not moved. A comment marks where cc-cast-events adds the interrupt.
- `SimEvents.CheckKnockback` with `CheckKnockbackEvent { source, target, distance }` on `ValuePriority`, in `src/sim/events/cc-knockback.ts`. Listeners shorten `distance` or set `disabled`.
- Charge (`src/content/jobs/vanguard/upgrades.ts`) calls `knockback`; its private `push()` is gone.
- Immovable also vetoes `CheckKnockback` and blocks every `flees` status, plus stun and Petrify, during Shield Wall.
- Tests: `test/sim/knockback.test.ts`; Immovable case extended in `test/sim/vanguard-upgrades.test.ts`.
- Changeset `.changeset/cc-knockback.md`.

## Deviations

- None. Outside owned paths: `.changeset/cc-knockback.md` only.

## Stubs left

- Cast interrupt on knockback (cc-cast-events).

## Gotchas

- `from` is a point, so Charge passes a point one tile behind the target along its sideways direction.
- A unit already overlapping a body may be pushed out of it but never deeper.

## Proposed learnings

- Move units only through `knockback` | keeps vetoes and blocked tiles in one place | src/content | no

## Verification

- `pnpm typecheck`, `rtk proxy pnpm lint`, `pnpm test`: pass (878 passed, 3 skipped). e2e not run.

## Size

- Estimated M, actual M.
