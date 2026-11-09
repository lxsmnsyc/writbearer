---
id: cc-side-switch
title: Monsters switching sides for a while
status: done
priority: should
type: feature
outline: false
milestone: combat-core
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/turned.test.ts && pnpm vitest run test/sim/control.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent: 144094
owns:
  - src/sim/ai/turned.ts
  - test/sim/turned.test.ts
shared:
  - src/sim/control.ts
  - src/sim/ai/think.ts
reserves: []
provides: []
depends_on:
  - on: split-ai
    kind: hard
    why: adds an AI module and a dispatch branch in the files split-ai creates under src/sim/ai/
  - on: bp-possess
    kind: hard
    why: extends the timed side change in src/sim/control.ts (mercs to the monster side) to monsters going to the party side, instead of a second mechanism
---

# Monsters switching sides for a while

## Goal

A normal monster fights for the party for a set time, then returns to its own side, hunt and target (Medium's Possess, Necromancer's raised dead later). Bosses and elites cannot be taken. A turned monster does not count as a monster for party-wiped, kills or loot, and the bearer never takes it as a threat.

## Context

- bp-possess builds the timed side change for mercs under `src/sim/control.ts`: records side, hunt, orders and target, flips, restores. This node adds the other direction. If bp-possess left the function side-agnostic, this node is mostly the AI and the rules; read its outcome first.
- `think` dispatches by side: `Side.Ward`, `Side.Party` (`thinkMerc`), else monsters (`thinkMonster`) (`src/sim/ai.ts`, after split-ai `src/sim/ai/think.ts`). A monster put on `Side.Party` would be handled by `thinkMerc`, which needs `toggles` and a job; a turned monster needs its own small think.
- The Creditor flips dead mercs for good (`src/content/creditor.ts`); this is a different, timed flip.
- Foes and allies come from `sim.foes`/`sim.living(side)`; victim lists go through `hostiles/allowed/canTarget`.
- Source: `docs/design/12-new-jobs.md#medium` (Possess), `#what-the-engine-needs`.

## Steps

- [ ] `turn(sim, monster, seconds, by)`: refuses a boss, an elite, the bearer and a unit already turned; records side/hunt/target; sets `Side.Party`; ends on time, on the caster's death (option) or on `dispel`-like removal, restoring the record. A status (`TURNED`, `buff: false`) carries the timer and the restore in its lifecycle so `clearStatuses` on death also cleans it.
- [ ] `src/sim/ai/turned.ts`: `thinkTurned(sim, u, dt)`: attack the nearest allowed foe; stay within a leash of the caster; no belt, no orders, no skills with mana (monster skills allowed on their own cooldown).
- [ ] Dispatch: in `src/sim/ai/think.ts`, a Party-side unit that has the `TURNED` status goes to `thinkTurned` before `thinkMerc`.
- [ ] Rules for counting: party-wiped, morale on kill, wages, kill credit and loot ignore a turned unit's kills and death; a turned monster that dies is a monster corpse (not a merc's), and a rested or torn body stays so.
- [ ] Tests: a turned mite attacks monsters and not mercs for N s, then goes back and fights mercs; a boss and an elite refuse; turning ends when the unit dies; two Mediums cannot stack it; target and hunt are restored.

## Acceptance

- [ ] A turned normal monster fights for the party for the time set and then for its own side again, with its hunt and target restored.
- [ ] Bosses, elites and the bearer cannot be turned.
- [ ] A fight with a turned monster neither ends early (party-wiped) nor gives the merc kill credit or loot for the monster's death.
- [ ] `pnpm vitest run test/sim/turned.test.ts` and `test/sim/control.test.ts` pass.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`.

## Sizing

One new AI module, one dispatch branch and a few rule checks around an existing mechanism. M.

## Notes for the worker

- A unit can leave without dying (Sellsword Bribe sets `alive = false`); code that reacts to the end of a turn checks `alive`.
- Once-per-area effects (a Possess charge) key on `sim.area`.
- Do not touch the Creditor's reveal; its permanent flip is separate.
- If bp-possess is not merged when you start, stop and report; this node must reuse its mechanism.
- Sim stays DOM-free. Saved runs from before must still load: a turn does not last across a save (end it when saving at a Waystation or on load).
