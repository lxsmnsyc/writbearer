# Outcome: cc-side-switch

## Built

- `src/sim/control.ts`: `TURNED` status (`TURN_TIME` 10 s), `turn(sim, monster, seconds?, by?)`, `isTurned`, `fellTurned`. `turn` refuses a boss, an elite, a mini-boss (`named`), a horn post (`still`), the bearer, a non-monster and a unit already turned (so a second turn does not stack or refresh). It saves hunt, target and aware, sets `Side.Party` and `Hunt.Nearest`, and restores them (target only if still a foe) when the status ends. The status ends early if the caster dies. `freeControlled` now also ends turns, so stage changes and saves (which already call it) drop them.
- `src/sim/ai/turned.ts`: `thinkTurned` keeps within `LEASH` (7 tiles) of the caster, fights the nearest allowed foe, uses only skills that cost no mana. `think.ts` sends a Party unit with the turned status to it before `thinkMerc`.
- Counting: `sim.living(Side.Party)` leaves out turned units, so party-wiped checks, morale, wages, the director and the like ignore them. A turned monster that dies is restored to `Side.Monster` (a monster corpse) and `fellTurned` is true.
- `test/sim/turned.test.ts`: 7 tests.

## Deviations

- Files outside owned paths, each minimal: `src/sim/sim.ts` (`living` skips the turned status), `src/game/game/state.ts` (`mercs()` skips turned units), `src/game/game/listeners.ts` (the kill listener skips `fellTurned` corpses: no xp, loot or kill count). `src/sim/control.ts` and `think.ts` are shared files named in the brief.
- Reuses the `UnitControlled` and `UnitFreed` events for turns (no new event). The "ends on caster death" option is always on.
- `sim.ts` checks the status id `'turned'` as a string to avoid an import cycle.

## Stubs left

- Nothing casts `turn` yet (Medium's Possess, Necromancer later).

## Gotchas

- A turned monster is on `Side.Party` but not in `sim.living(Side.Party)`; code that iterates `sim.units` by side still sees it.
- Objective counts of living monsters do not include a turned monster while it is turned.
- `Unit.hit` is `source.hit(target, ...)`; same-side hits are blocked.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/turned.test.ts test/sim/control.test.ts`: pass.
- `pnpm typecheck`, `rtk proxy pnpm lint`, `pnpm test` (877 pass, 3 skipped): pass. oxfmt check clean on changed files.

## Size

- Estimated M, actual M.
