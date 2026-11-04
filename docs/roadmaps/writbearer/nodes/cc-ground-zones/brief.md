---
id: cc-ground-zones
title: Turrets, warning cancel and zones that block ground skills
status: todo
priority: should
type: feature
outline: false
milestone: combat-core
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/ground.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/turret.ts
  - src/sim/protect.ts
  - test/sim/ground.test.ts
shared:
  - src/sim/zone.ts
  - src/sim/warning.ts
  - src/sim/sim.ts
reserves: []
provides: []
depends_on: []
---

# Turrets, warning cancel and zones that block ground skills

## Goal

Three ground systems on top of zones and warnings. Turrets: a zone that shoots the nearest foe on an interval (Arbalist, Sapper). Warning cancel: remove an enemy warning that has not struck yet. A zone flag that stops ground skills being laid inside it and cancels enemy warnings inside it before they strike (Sage's Land Protector).

## Context

- `Zone` (`src/sim/zone.ts`) has `pulse` every second on each unit inside, guards, calm and lure; `updateZones` runs from `Sim.tick`. Lightning Rod strikes each second but through `pulse`, with no projectile and no own target pick. `mechanics/zones.ts` holds what zones do to hits.
- `Warning` (`src/sim/warning.ts`) fills over its windup then strikes; `updateWarnings` only lifts a warning whose source died. Nothing cancels one by hand.
- Projectiles are fired through `Sim` (`src/sim/sim.ts` around line 439) and `Projectile`.
- Source: `docs/design/12-new-jobs.md#what-the-engine-needs`, `#sage` (Land Protector), `#arbalist`.

## Steps

- [ ] `src/sim/turret.ts`: `Zone.turret?: { interval, range, fire(zone, target) }` handled by `updateTurrets(sim, dt)`, called from `Sim.tick` next to `updateZones`. It picks the nearest foe in range with `hostiles(owner)` and line of sight (`sim.sees`), then calls `fire` (a helper `shootFrom(zone, target, options)` fires a homing projectile owned by the zone's owner). A zone with no owner alive stops shooting; one with the owner away still shoots.
- [ ] `cancelWarnings(sim, test)` in `src/sim/warning.ts` (append): removes each warning the test accepts and returns them; `done` is not called for a canceled one.
- [ ] `src/sim/protect.ts`: `Zone.protects?: Side` (the side that is protected). `setZone` refuses a zone whose owner is on another side and whose center is inside a protecting zone; `protect` zones cancel enemy warnings whose spot is inside each tick (call from `updateWarnings` or a tick hook; before they can strike).
- [ ] Tests: a turret hits the nearest foe on its interval and not an ally, a hidden unit (it goes through `hostiles`) or a foe out of line of sight; a cancelled warning does not strike; a Land Protector zone cancels a boss warning inside it and blocks a hostile zone laid in it, but a friendly one still works; zones expire normally.

## Acceptance

- [ ] A turret zone fires at its interval at the nearest allowed foe and its projectile damages that foe; it stops when its life ends.
- [ ] `cancelWarnings` removes pending warnings without striking.
- [ ] A protecting zone cancels enemy warnings that start inside it, and `setZone` by an enemy inside it returns without adding a zone (decide the return shape and note it).
- [ ] `pnpm vitest run test/sim/ground.test.ts` passes.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

Two new modules and three small appends to zone, warning and tick. Known pattern. M.

## Notes for the worker

- Victim lists go through `hostiles/allowed/canTarget` from `src/sim/targeting.ts`; the owner is the source of the check.
- A turret owned by a unit that left without dying (Sellsword Bribe sets `alive = false`) checks `alive` before firing.
- Draw: render is out of scope here; turret and Land Protector art come with their jobs. Make `kind` strings distinct.
- `setZone` is called by many skills (cleric, ranger, duelist, monster skills): keep its signature, and its result type unchanged for non-protected spots.
- Sim stays DOM-free; a seeded fight with no turret records the same.

- `src/sim/ground.ts` is the terrain module gs-terrain-kinds creates; this node's protecting zone lives in `src/sim/protect.ts` (renamed at the wave-2 checkpoint).
