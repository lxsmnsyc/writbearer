# Outcome: warden

## Built

- `src/content/jobs/warden/index.ts`: the Warden job (still `hireable: false`), with real spells in cast order and the innate.
  - Cover (12 mana, 12 s): pulls the bearer behind the Warden and, for 3 + 0.25r s, stops projectiles from the Warden's side of the bearer (`COVERING` status, CheckProjectile). Wanted when a ranged enemy aims at the bearer.
  - Execute (12, 8 s): 120 + 12r% damage; kills a marked enemy below 20% health unless it is Boss rank or a named mini-boss. Wanted only on a marked enemy in reach.
  - Tripwire (10, 12 s): sets a trap 2 tiles from the bearer toward an approaching aware enemy, when none is within 3 tiles of the Warden or bearer, one at a time. The victim gets `Tripped` (slow 30 + 2r% for 4 s, from `trippedFor(rank)`) and is marked.
  - Pursue (6, 4 s, filler): leaps within one body of a marked enemy (the target if marked, else the nearest marked within 6 tiles), 100 + 8r% damage, 20 + 2r stun buildup.
  - Interpose (innate): UnitDamage at `DamagePriority.Pre`. Any enemy that damages the bearer is marked; within 2 tiles of the bearer the Warden takes 70% of the hit (True damage, `Redirected` flag).
  - `MARKED` status (6 s) and `isMarked(unit)` for other skills to read. Also exported: COVER, EXECUTE, TRIPWIRE, PURSUE, INTERPOSE, COVERING, trippedFor.
  - Spell icons for the four spells (game-icons).
- `src/render/looks/warden.ts`: hood, a lantern as the signature shape, and a mace; no shield attachment.
- `test/sim/warden.test.ts`: 19 tests. A headless fight, one or more per spell, Interpose (share, mark, far away, no double take), boss and mini-boss immunity.

## Deviations

- None. Nothing was edited in shared files (`zones.ts`, `map.tsx`, `trap.ts`); no hook was missing.

## Stubs left

- The 12 elite upgrades stay placeholders (`upgrades.ts`, node warden-upgrades).

## Gotchas

- Cover and Tripwire casts in tests call `release` directly: a monster's AI retargets within a tick, so a cast through the AI loses the set target.
- Tripwire's slow is ten status defs sharing the id `tripped`; use `trippedFor(rank)`, not a fixed def.
- Execute's finish is a True hit for the target's current health with `Pierce`.
- Living Shield changes Interpose's share (constant `INTERPOSE_SHARE`, not exported); the upgrade node may need to export or patch it.
- Tether needs a CheckChase listener. Retaliate and Last Rites need a free attack outside the attack timer (not built).
- Sentry and Read the Room (hidden units) belong to the upgrade node.

## Proposed learnings

- None.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: pass (485 passed, 24 skipped).
- `pnpm vitest run test/sim/warden.test.ts && pnpm vitest run test/content/jobs.test.ts`: pass.
- `pnpm test:e2e` not run, as instructed.

## Size

- Estimated M, actual M.
