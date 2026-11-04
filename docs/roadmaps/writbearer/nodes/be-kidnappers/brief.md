---
id: be-kidnappers
title: Kidnappers: grab the citizen and drag them off
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: bestiary
target:
ship: auto
size: M
spike: false
verify: pnpm vitest run test/sim/kidnappers.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/grab.ts
  - src/sim/ai/kidnapper.ts
  - test/sim/kidnappers.test.ts
shared:
  - src/sim/ai/monster.ts
  - src/content/spawn.ts
  - src/game/objective.ts
reserves: []
provides: []
depends_on:
  - on: split-ai
    kind: hard
    why: the kidnapper's behavior is a module under src/sim/ai/ plus one inserted step in monster.ts
  - on: be-thieves
    kind: hard
    why: reuses leaveMap, the shared exit path for a unit that is not killed
  - on: split-roster
    kind: hard
    why: adds its monsters or template flag through src/content/monsters/ and the spawnMonster step list
---

# Kidnappers: grab the citizen and drag them off

## Goal

A kidnapper grabs a ward (the citizen in an Escort) and drags it toward an exit; if it gets there, the ward is lost. A stun, a kill or a Guard stance merc in the way breaks the hold. The Chain Warden's hook at the bearer is a later variant on the same hold.

## Context

- Source: `docs/design/07-citizen-npcs-enemies.md#enemies` (Kidnapper row; counters: stuns, Guard stance), `13-bestiary.md` (Chain Warden row, kidnapper).
- Items: `../../COVERAGE.md`, entries with target `be-kidnappers`.
- Wards are `Side.Ward` units; Escort failure counts living wards in `src/game/objective.ts` (`stillWard`, about line 55 and 139). A ward leaving the map must read as lost, so it follows the non-death leave path (`alive = false`, removed from `sim.units`, no `UnitDies`), as in Bribe (`BRIBED` in `src/content/jobs/sellsword/upgrades.ts`).
- Hunts: `Hunt.Assassin` goes for the bearer ignoring others (`src/sim/ai.ts`, becoming `src/sim/ai/monster.ts`); a kidnapper uses the same single-minded approach to a ward, not the bearer.

## Steps

- [ ] `src/sim/grab.ts`: `grab(captor, victim)`, `release(captor)`, the held pair stored in a `WeakMap`; the victim moves with the captor at the captor's speed (or slower) and cannot act while held.
- [ ] `src/sim/ai/kidnapper.ts`: pick the nearest ward (through `hostiles`/`allowed`/`canTarget`, never a raw unit list); close in; grab; run to the exit with `leaveMap` from `src/sim/leave.ts`; the victim leaves with it and the Escort counts it lost. If there is no ward in the area, behave as a plain melee monster. Insert one step in `src/sim/ai/monster.ts`.
- [ ] A stun, root, fear or kill on the kidnapper releases the ward where it stands. A kill leaves the ward alive at full position.
- [ ] Template flag for a kidnapper in `roster.ts`.

## Acceptance

- [ ] A test kidnapper (test-only template) in an Escort field grabs a ward and reaches the exit; the ward is gone, the Escort objective reports failure when the count drops below the need.
- [ ] A stun on the kidnapper mid-drag drops the ward; the ward is alive and not held.
- [ ] Killing it drops the ward; the ward keeps its health.
- [ ] A Guard-stance merc standing in the line is attacked, and the kidnapper does not path through it (it goes around or fights).
- [ ] With no ward in the area it fights like a normal melee monster and the fight ends.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

M: one hold mechanic and one AI step; the thief node's exit path is reused. Medium on coupling (objective.ts counts).

## Notes for the worker

- A held ward must not be counted dead by the Escort until it truly leaves; check `stillWard` and the failure rule in `src/game/objective.ts`, and add no new rule there beyond reading `alive`.
- A ward that leaves does so with no `UnitDies`: any code that reacts to ward death (morale, log lines) must check `alive` instead.
- A saved run is taken at area entrances, so a hold is never saved. Clear any hold at area change (`sim.area`) so a carried-over unit cannot keep one.
- Do not build the Chain Warden here. It targets the bearer and drags toward its pack; `be-monsters-deep` adds it on `grab.ts` and decides how a held bearer is controlled.
- Keep it simple: the figure's signature shape is a long arm or hook; the monster node draws it.

## After the splits

- After split-roster: new monsters go in their faction module under `src/content/monsters/`, a template flag is one module plus one entry in the `spawnMonster` step list in `src/content/spawn.ts`; `src/content/roster.ts` is a barrel and stays unchanged.
