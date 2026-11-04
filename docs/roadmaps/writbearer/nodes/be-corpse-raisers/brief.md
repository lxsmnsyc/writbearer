---
id: be-corpse-raisers
title: Monster corpses kept, and summoners that raise them
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
verify: pnpm vitest run test/sim/raisers.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/raise.ts
  - src/sim/ai/raiser.ts
  - src/render/draw/corpses.ts
  - test/sim/raisers.test.ts
shared:
  - src/sim/ai/monster.ts
  - src/sim/mechanics/death.ts
  - src/content/monsters/spawn-steps.ts
  - src/content/monster-skills.ts
reserves: []
provides: []
depends_on:
  - on: split-ai
    kind: hard
    why: the raiser's behavior is a module under src/sim/ai/ plus one inserted step in monster.ts
  - on: cc-corpses
    kind: hard
    why: raising and laying to rest share the corpse rules (what counts as a corpse, how it is consumed, what stops it)
  - on: split-roster
    kind: hard
    why: adds its monsters or template flag through src/content/monsters/ and the spawnMonster step list
---

# Monster corpses kept, and summoners that raise them

## Goal

Monster corpses stay on the ground until the stage ends, and a raiser monster can stand one up again as a weaker undead on its own side. Laying a corpse to rest (the party's Consecrate and Pyre, from the job-systems nodes) stops it. Doc 07's Summoner "keeps adding monsters. Raises corpses" is this node's test monster.

## Context

- Source: `docs/design/13-bestiary.md#what-the-engine-needs` ("Raising corpses"), `07-citizen-npcs-enemies.md#enemies` (Summoner row; "Frost shatters corpses" is not needed here).
- Items: `../../COVERAGE.md`, entries with target `be-corpse-raisers`.
- Built: a dead unit stays in `sim.units` with `alive = false` and its body, and a killing blow of 30% of max health or a critical sets `torn`, so nothing is left to raise (`src/sim/mechanics/death.ts`). `Unit.revive(share)` brings a dead unit back; the Cleric's Resurrection and Martyr already use it for mercs (`src/content/jobs/cleric/upgrades.ts` lines 198 to 240). Torn bodies are drawn as pieces (`src/render/effects.ts`, `gibbed`).
- Check first: whether anything removes a dead monster before the stage ends (render fade, `src/game/stage.ts` line 70 area clear removes by rectangle, `src/game/objective.ts`). If not, "kept until the stage ends" is already true for the sim and only the drawing remains; say so in the outcome.
- `cc-corpses` defines the corpse API (list of corpses, consuming, a block on raising). Build against it; until it lands, use only `alive`, `torn` and `revive`.

## Steps

- [ ] Verify what happens to a dead monster today; remove any early cleanup and keep the body to stage end. Draw a corpse as a flat low figure (`src/render/draw/corpses.ts`), no new art per monster.
- [ ] `src/sim/raise.ts`: `corpsesNear(sim, at, reach)` (through the `cc-corpses` API once it exists), `raise(raiser, corpse)` which makes a new monster of a raised kind at the corpse's place, with a share of the original's health and a reduced level, and removes the corpse (a consumed body cannot be raised again or revived).
- [ ] `src/sim/ai/raiser.ts`: a raiser keeps behind its allies (`Hunt.Support`), walks to the nearest raisable corpse in reach, casts a long raise (visible windup through `src/sim/warning.ts`), and raises. Cap the number alive at once. Insert one step in `src/sim/ai/monster.ts`.
- [ ] Stops: a corpse laid to rest (cc-corpses) is not raisable; a torn body is not raisable; a body in a zone that forbids it is not raisable. An interrupt (stun) on the cast cancels the raise and the corpse stays.
- [ ] A monster skill for the raise in `src/content/monster-skills.ts`, and a template flag in `roster.ts`.

## Acceptance

- [ ] After a fight a monster killed by a normal blow is still in `sim.units` with `alive` false at the end of the area, and gone after the stage changes.
- [ ] A test raiser (test-only template) raises a fresh corpse into a living monster at that spot with the set health share; the corpse is gone afterward.
- [ ] It does not raise a torn corpse, and does not raise a corpse that was laid to rest (using the `cc-corpses` rule).
- [ ] A stun during the raise cast cancels it and leaves the corpse.
- [ ] A raised unit is a Monster on the raiser's pack, counts toward a Hunt or Horde that tracks live monsters (check `src/game/objective.ts`), and awards no extra soul or loot a second time (`slain` and drops count once per body).
- [ ] The raiser cannot raise past its cap, and a fight with a raiser and mercs that kill it first ends within a bounded time.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

M: the corpse rules come from `cc-corpses`; this adds a cast, a spawn and a drawing. Medium on coupling (cc-corpses, objectives) and on blast radius (death.ts, objective counting).

## Notes for the worker

- Kills trigger rewards in listeners on `UnitDies`. A raised unit that dies again fires `UnitDies` again for a new unit: that is fine. A corpse consumed by raising must not fire anything; remove it as a non-death exit (`alive` stays false, `sim.units.delete`).
- A unit can leave without `UnitDies` (Bribe, thieves). Code that reacts must check `alive`.
- Victim lists and "nearest ally" go through `hostiles`/`allowed`/`canTarget`; a corpse is not a valid target for attacks.
- Once-per-area keys use `sim.area`. Do not cache corpses across areas.
- Balance tests are seed-sensitive: draw no extra randomness for non-raiser fights, and raise at a fixed rule (nearest first) rather than by rng.
- The Ossuary Bishop's mass raise (`bb-bishop-usurper`) is a boss move on top of `raise()`. Keep `raise` callable with an explicit kind and level.
- Do not add the Ossuary Priest here. `be-monsters-deep` does.

## After the splits

- After split-roster: new monsters go in their faction module under `src/content/monsters/`, a template flag is one module plus one entry in `SPAWN_STEPS` (`src/content/monsters/spawn-steps.ts`, a step is `(unit, template, sim) => void`); `src/content/roster.ts` is a barrel and stays unchanged.
