---
id: be-flyers
title: Flyers: out of melee reach until grounded
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
verify: pnpm vitest run test/sim/flyers.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/flight.ts
  - src/sim/ai/flyer.ts
  - src/render/draw/flight.ts
  - test/sim/flyers.test.ts
shared:
  - src/sim/ai/monster.ts
  - src/content/monsters/spawn-steps.ts
  - src/content/jobs/ranger/upgrades.ts
  - src/render/draw/figures.ts
reserves: []
provides: []
depends_on:
  - on: split-ai
    kind: hard
    why: the flyer's behavior is a module under src/sim/ai/ plus one inserted step in monster.ts
  - on: targeting-rules
    kind: contract
    via: targeting
  - on: split-unit
    kind: hard
    why: edits a feature module under src/sim/unit/ instead of the Unit class
  - on: split-roster
    kind: hard
    why: adds its monsters or template flag through src/content/monsters/ and the spawnMonster step list
---

# Flyers: out of melee reach until grounded

## Goal

A monster can fly. While aloft, melee attacks and melee skills cannot target it; ranged attacks, spells and projectiles can. It lands to strike (or while it dives), and is grounded by Pin Down. This is the engine; the Carrion Moth, Rift Vulture, Crown-Moth and the Lantern-Eater use it.

## Context

- Source: `docs/design/13-bestiary.md#what-the-engine-needs`, `07-citizen-npcs-enemies.md#enemies` (Flyer row), `09-skill-trees.md` (Ranger: Pin Down, Eagle Eye; line 66 says their flyer clauses were left out).
- Items: `../../COVERAGE.md`, entries with target `be-flyers`.
- Not built: no flight state in `src/sim/unit.ts`. Built and reusable: `CheckTarget` forbids targets (`src/sim/targeting.ts`, `src/sim/concealment.ts` is the model: a listener in a `setup*` function wired from `src/sim/mechanics/index.ts`), `ROOTED` in `src/sim/statuses.ts`, projectiles in `src/sim/projectile.ts`.
- Pin Down and Eagle Eye are in `src/content/jobs/ranger/upgrades.ts` (about line 510); both describe text saying "once flyers exist".

## Steps

- [ ] `src/sim/flight.ts`: `aloft` state on the unit (a field appended to `unit.ts`, default false), `ground(u, seconds)`, `land(u)`, `takeOff(u)`, and a `setupFlight(sim)` with a `CheckTarget` listener at the same priority as the hidden rule: a melee-range attacker (`Range.Melee`, or a skill whose range tag is melee) may not pick an aloft unit. Emit no new event unless a test needs one.
- [ ] `src/sim/ai/flyer.ts`: the flyer's step. It circles or hovers at its reach, strikes from the air with a ranged or swooping attack, and lands for a set time after each dive. Insert it as one named step in `src/sim/ai/monster.ts`.
- [ ] Pin Down: when it roots an aloft target, ground it for the root's time (the text already says 4 seconds in doc 09; read `pinTime`). Update the describe text and drop "once flyers exist".
- [ ] Eagle Eye: accuracy against a flyer, as in doc 09 (`+accuracy against flyers`); update its text. Killshot: read doc 09 line 66 and 09#Ranger for what its flyer clause was meant to be; if the doc gives none, leave it and say so in the outcome.
- [ ] Template flag (`flies`) in the monster template type in `roster.ts`, read by `spawnMonster`, so a monster def only sets a flag and a flight style.
- [ ] Drawing: `src/render/draw/flight.ts` draws a shadow on the ground and lifts the figure by a height while aloft. Follow the minimalist rule: no new figure, only the lift and the shadow; the signature shape of each flyer is drawn by the monster node that adds it.

## Acceptance

- [ ] A test flyer (a test-only template in `test/sim/flyers.test.ts`, not in the roster) aloft is never picked by a melee merc, even with nothing else to attack; the merc picks it once it lands.
- [ ] A ranged merc and a projectile do hit the aloft flyer.
- [ ] A Pin Down shot grounds it for the root's time, then it takes off again; the same shot on a non-flyer only roots.
- [ ] Eagle Eye's bonus applies against the flyer and not against a walker.
- [ ] A flyer that lands to strike can be hit by melee only while grounded; a party of two melee mercs and no ranged one still wins by waiting for it to land, so no stalemate: the test runs 200 s of sim time and the fight ends.
- [ ] The fight tests that existed before still pass unchanged.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

M: new pattern but small (one field, one listener, one AI step, two skill texts); an automated test proves it. Medium on blast radius (unit.ts append, roster.ts append).

## Notes for the worker

- A melee-only party must never be stuck: a flyer that never lands is a soft lock. Make the landing unconditional and test it.
- The CheckTarget rule goes through `allowed`/`canTarget`, so victim lists built by `hostiles` pick up the rule; do not filter inside `pick` in `src/sim/ai/merc.ts`. Check area skills: they hit units in a radius and may still hit an aloft unit; decide that melee-tagged area skills skip it and write it in the outcome.
- A flyer is not hidden: hidden-units' `hidden` flag is separate. Do not reuse it.
- A saved run is taken at an area's entrance, so `aloft` need not be saved. Do not add it to `RunSave`.
- Balance tests are seed-sensitive; adding a field with a default must not change any existing roll order. Do not draw from `sim.rng` in code that runs for non-flyers.
- Do not add the Carrion Moth or Rift Vulture here. `be-monsters-upper` does.

## After the splits

- After split-unit: the Unit logic lives in `src/sim/unit/` (movement, casting, statuses, gear, combat, kit). Edit the module listed under `shared:`, keep new per-unit state in a WeakMap in your own module, and leave `src/sim/unit.ts` alone.
- After split-roster: new monsters go in their faction module under `src/content/monsters/`, a template flag is one module plus one entry in `SPAWN_STEPS` (`src/content/monsters/spawn-steps.ts`, a step is `(unit, template, sim) => void`); `src/content/roster.ts` is a barrel and stays unchanged.
