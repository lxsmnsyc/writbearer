---
id: cc-knockback
title: Knockback and Immovable's immunity
status: todo
priority: should
type: feature
outline: false
milestone: combat-core
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/knockback.test.ts && pnpm vitest run test/sim/vanguard-upgrades.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/knockback.ts
  - test/sim/knockback.test.ts
shared:
  - src/sim/events.ts
  - src/content/jobs/vanguard/upgrades.ts
  - test/sim/vanguard-upgrades.test.ts
reserves: []
provides: []
depends_on: []
---

# Knockback and Immovable's immunity

## Goal

A knockback system for the Arbalist and Sapper: push a unit away from a point by a distance, stopping at walls, blocked tiles and bodies, with a `CheckKnockback` event that listeners can veto or shorten. Move the Vanguard's Charge push onto it, and make Immovable match doc 09: no knockback, stun or fear while Shield Wall stands.

## Context

- Today Charge has its own `push()` (`src/content/jobs/vanguard/upgrades.ts`, `PUSH_STEP`): it steps 0.25 tiles at a time while `nav.walkable`, with no event and no check for other units. The COVERAGE entries (doc 09 Immovable, doc 16 Charge) are partly built for this reason.
- Immovable (same file) listens on `CheckStatusDuration` for STUN, DREAD and PETRIFY while `SHIELD_WALL` is active.
- Nav treats a blocked tile (Glacial Wall) as closed (`nav.walkable`, job-hooks contract).
- Source: `docs/design/12-new-jobs.md#what-the-engine-needs`, `09-skill-trees.md#vanguard`, `16-builds.md` (Charge).

## Steps

- [ ] `src/sim/knockback.ts`: `knockback(source, target, from, distance)` moves the target along the line from `from` through it in small steps, ending at a wall, a closed tile or a solid unit; returns the distance moved. It does not interrupt casts; cc-cast-events owns interrupts, so leave a comment where that would hook in.
- [ ] `SimEvents.CheckKnockback` in `src/sim/events.ts` (append): `{ source, target, distance }` with a value priority; `disabled` stops it.
- [ ] Built-in rules: the bearer, bosses (`Rank.Boss`) and rooted units are not moved. A weight per unit is a later tuning; do not add one now.
- [ ] Move `push()` in Charge to `knockback`, with the same 1.5 tiles.
- [ ] Immovable: during Shield Wall also listens on `CheckKnockback` and blocks every status with `flees` (Dread, and Frightened from cc-afflictions) as well as stun and Petrify.
- [ ] Tests: push stops at a wall and at a blocked tile; a veto listener stops it; a boss is not moved; Charge still pushes aside (existing vanguard-upgrades test passes); Immovable resists a knockback and a frighten.

## Acceptance

- [ ] A knockback moves a unit the requested distance in open ground and less near a wall, and never into a blocked tile or out of the floor.
- [ ] `CheckKnockback` listeners can veto; Immovable's Shield Wall vetoes for its owner.
- [ ] Charge's push goes through the system; no private push loop remains in the Vanguard file.
- [ ] While Immovable's Shield Wall stands, stun, Petrify, Dread and knockback all fail on the Vanguard.
- [ ] `pnpm vitest run test/sim/knockback.test.ts` passes and `test/sim/vanguard-upgrades.test.ts` still passes.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

One new module, one event, one skill moved. M.

## Notes for the worker

- The unit stays where `separate()` would put it; do not teleport it into another body. If the final tile is occupied, stop one step short.
- The pushed unit's route is stale after the move; clear its `route` the way other movers do (grep `route` in `src/sim/unit.ts`).
- A unit that left without dying (Sellsword Bribe sets `alive = false`) is never pushed: check `alive`.
- Victim lists for area knockbacks go through `hostiles/allowed/canTarget` in `src/sim/targeting.ts`.
- Edit `vanguard/upgrades.ts` only for the push and the Immovable listener; `vanguard-upgrades` is done.
- Sim stays DOM-free. A seeded fight with no knockback must record the same as before.
