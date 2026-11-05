# Outcome: bp-possess

## Built

- `src/sim/control.ts`: `CONTROLLED` status (6 s, `CONTROL_TIME`), `control(by, merc, seconds?)`, `isControlled`, `setupControl`. Control flips the merc to `Side.Monster` with `Hunt.Nearest`, and saves and restores side, hunt, order, target and aware. A CheckStatusDuration listener refuses the bearer and non-party units. Ends early if the source dies.
- A merc that dies under control stays on the monster side until `UnitDies` Post: morale sees no ally death, and the game's listeners (registered after it) see a merc death, not a monster kill (no xp, drops or kill count).
- `src/sim/copy.ts`: `lastReleased(unit)` (skill and rank of a party unit's last release), `copySkill(by, from, target)`: emits `UnitSkillRelease` for the boss with no mana or cooldown, and a `CheckSkillRank` listener forces the merc's rank. Copies are not recorded.
- `src/sim/events/bp-possess.ts`: `UnitControlled`, `UnitFreed`, `SkillCopied`; entries added to `events.ts`.
- `StatusDef.hostile` (status.ts): harmful even when the source is on the unit's side. `CONTROLLED` sets it; the Cleric's Cleanse removes statuses with it.
- Buff theft: the `buff` flag and `stealBuff` (moves time, power, stacks) already existed from sellsword-upgrades; tested here with stacks.
- `test/sim/control.test.ts`: 8 tests. Numbers: 6 s control, 8 s immunity.

## Deviations

- `src/content/jobs/cleric/upgrades.ts` (not owned): one condition in `cleanse` (`|| s.def.hostile`).
- `src/sim/sim.ts`: two calls, `setupControl` and `setupCopy`, in the constructor. `src/sim/ai/think.ts` is not edited: a controlled merc is on the monster side, so `thinkMonster` runs.
- `src/game/stage.ts` (not owned): `carryParty` calls `freeControlled(sim)` first, so a stage change keeps a controlled merc.
- `src/game/game/saving.ts` (not owned): `snapshot` calls `freeControlled(g.sim)` first, so a save keeps it.
- The brief's `beneficial` flag is the existing `buff`.
- No Usurper in the game yet; nothing casts these. Its node calls `control`, `copySkill` and `stealBuff`.

## Stubs left

- The Cleric's AI never aims Ward at a controlled merc (it is a foe to it), so in play only a direct cast lifts control. The Usurper node may widen `WARD.aim`.

## Gotchas

- `freeControlled(sim)` (control.ts) ends control on every unit; call it before anything that sorts units by side. Objective counts of living monsters include a controlled merc for the 6 s.
- `copySkill` ranks work through `CheckSkillRank` by skill id; a skill that reads ranks another way is not overridden.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/control.test.ts test/sim/creditor.test.ts test/sim/statuses.test.ts`: pass.
- `pnpm typecheck && pnpm lint` pass. `pnpm test`: 797 pass; `boss.test` and `concealment.test` timed out under load and pass alone with a longer timeout.

## Size

- Estimated M, actual M.
