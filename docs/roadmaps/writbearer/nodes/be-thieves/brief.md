---
id: be-thieves
title: Thieves: take an item from the pack and run
status: active
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
verify: pnpm vitest run test/sim/thieves.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/theft.ts
  - src/sim/ai/thief.ts
  - src/sim/leave.ts
  - src/game/game/theft.ts
  - test/sim/thieves.test.ts
shared:
  - src/sim/ai/monster.ts
  - src/sim/sim.ts
  - src/content/monsters/spawn-steps.ts
  - src/game/game/listeners.ts
  - src/game/inventory.ts
  - src/ui/log.ts
reserves: []
provides: []
depends_on:
  - on: split-ai
    kind: hard
    why: the thief's behavior is a module under src/sim/ai/ plus one inserted step in monster.ts
  - on: split-roster
    kind: hard
    why: adds its monsters or template flag through src/content/monsters/ and the spawnMonster step list
---

# Thieves: take an item from the pack and run

## Goal

A thief monster runs at the bearer, takes an item (or gold) from the pack, and runs for an exit. Killed, it drops what it took on the ground. If it reaches the exit, it is gone with the item. The same exit-run is reused by kidnappers and by the Regalia thieves.

## Context

- Source: `docs/design/13-bestiary.md` (Tithe-Taker row; "What the engine needs", Thieves), `07-citizen-npcs-enemies.md#enemies` (Thief row, counter: ranged mercs, caltrops).
- Items: `../../COVERAGE.md`, entries with target `be-thieves`.
- The pack is in the game layer (`src/game/inventory.ts`, class `Pack`), not the sim. The sim reaches game state through ports, such as `sim.purse` (set in `src/game/game/listeners.ts` line 24). Follow that model: `src/sim/theft.ts` declares a `Pocket` port on the sim, `src/game/game/theft.ts` implements it against `Pack` and `g.ground`.
- Ground items: `GroundItem` and `g.ground` in `src/game/inventory.ts`, `src/game/game/state.ts`; areas clear `g.ground` in `src/game/game/areas.ts`.
- Leaving without dying: Bribe removes a unit with `alive = false` and `sim.units.delete(u)`, with no `UnitDies` (see `BRIBED` in `src/content/jobs/sellsword/upgrades.ts`). Objectives that keep lists of units count a non-alive unit as gone.

## Steps

- [ ] `src/sim/leave.ts`: `leaveMap(u)`, the one shared exit path for a unit that is not killed (same effect as Bribe's last tick). Switch nothing else over; Bribe stays as it is.
- [ ] `src/sim/theft.ts`: the `Pocket` port (`pick(rng): Loot | null`, `take(loot)`, `give(loot, at)`), `steal(thief, sim)` and `dropLoot(thief)` on its death. The loot sits on the thief unit as a field; add it with a one-line append in `unit.ts` only if `Unit` has no free slot for it (prefer a `WeakMap` in `theft.ts` and no change to `unit.ts`).
- [ ] `src/game/game/theft.ts`: implement the port. Choose from the pack by rule: not an equipped item, not a potion on a belt, not a key or quest item; gold if the pack has no item. Drops go to `g.ground`. Log a line.
- [ ] `src/sim/ai/thief.ts`: step order is (1) go for the bearer ignoring others, (2) strike once to steal, (3) run to the nearest open exit and `leaveMap`. A stun, root or snare stops the run; killing it drops the loot. Insert it as one step in `src/sim/ai/monster.ts`.
- [ ] Template flag for a thief in `roster.ts` and a log line when something is stolen or recovered.

## Acceptance

- [ ] A test thief (test-only template) takes exactly one item from a pack of three, leaves the equipment alone, and runs to the exit; the pack has one fewer item.
- [ ] Killing the thief before it leaves drops the item on the ground and the bearer can pick it up; the pack holds it again.
- [ ] A thief that reaches the exit is gone: `alive` false, removed from `sim.units`, no `UnitDies` event, the item lost, and the objective is not stuck waiting for it (a Hunt or Horde that counted it completes).
- [ ] Gold is taken only when the pack has no item; the amount is a share, never the whole purse.
- [ ] An empty pack: the thief does nothing and attacks like any monster.
- [ ] A save taken at the next area's entrance after a theft has the item missing or restored, never duplicated: a test saves and loads (`src/game/save.ts`) around a stolen and a recovered item.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

M: pattern new to the repo (a sim port into the pack, a non-death exit), but small; an automated test proves it. Medium on coupling (game layer wiring).

## Notes for the worker

- Code that reacts to a monster leaving must check `alive`, not wait for `UnitDies`. Look at what listens for kills (souls, compendium, loot, `slain` count) and confirm that a thief that escapes counts as no kill and drops no loot.
- Pick the stolen item with a stream that exists already (`g.streams`) so saves and seeds stay stable; do not use `Math.random`. Once-per-area limits (one theft per thief; one thief per area where a pack would otherwise empty) key on `sim.area`, not on unit identity.
- Which exit counts: use the same exits the party uses (`src/render/draw/exits.ts` reads them, `src/game/game/areas.ts` owns them). If an area has no open exit, run to the farthest map edge.
- A theft must not remove an item mid-drag in the UI. Check the pack screen handles a uid that disappears.
- The `sb-regalia` node needs a thief to take a named heavy item: make the choice rule a function it can override (`pickLoot`), do not hard-code the Tithe-Taker's rule.
- Do not add the Tithe-Taker here. `be-monsters-deep` does.

## After the splits

- After split-roster: new monsters go in their faction module under `src/content/monsters/`, a template flag is one module plus one entry in `SPAWN_STEPS` (`src/content/monsters/spawn-steps.ts`, a step is `(unit, template, sim) => void`); `src/content/roster.ts` is a barrel and stays unchanged.
