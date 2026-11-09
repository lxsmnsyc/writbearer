# Outcome: cc-afflictions

## Built

- `src/sim/afflict.ts`: `FRIGHTENED` (flees, 3 s default), `frighten(source, targets, seconds)` (skips non-normal rank, the bearer, the dead, Dread-immune units; goes through `allowed` and `addStatus`; time = seconds / (1 + WIL * 0.03)), `CURSED` (-25% atk/matk min/max, healing received halved, 8 s, immunity 4 s, WIL threshold), `curse(source, target, power, direct = false)` (buildup, or direct with power as status power), `dispel(target, count = Infinity)` (removes `buff` statuses in order given, returns the removed `ActiveStatus` list), and `resistedTime(target, seconds)`.
- `test/sim/afflict.test.ts`: 9 tests covering every step of the brief.
- `.changeset/cc-afflictions.md` (minor).

## Proof

Not a fix node.

## Deviations

- Added a changeset outside the owned paths (required by GOAL.md).

## Stubs left

- None. No skill calls these yet (Berserker Howl, Sage Dispel, Hexblade, Medium, Litany come in their own nodes).

## Gotchas

- Frightened needs `flees: true` only; Immovable (cc-knockback) blocks all `flees` statuses, but today it blocks only DREAD, STUN and PETRIFY, so Frightened is not blocked by it until cc-knockback lands.
- Monster buff statuses must set `buff: true` or `dispel` skips them.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/afflict.test.ts`: pass (9 tests).
- `pnpm typecheck && pnpm lint && pnpm test`: see below.

## Size

- Estimated M, actual S.

Landed as 7a705aa on batch/writbearer.
