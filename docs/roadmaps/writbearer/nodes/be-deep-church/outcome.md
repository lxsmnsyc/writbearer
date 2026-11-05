# Outcome: be-deep-church

## Built

- `src/content/monsters/church.ts`: templates `ossuaryPriest` (Support), `titheTaker` (fast), `confessor`, `flagellant`, all Radiant. Listed in `MONSTERS` (`table.ts`).
- `src/content/monsters/church-steps.ts`: one spawn step in `SPAWN_STEPS`, keyed on `unit.kind`. Priest: `markRaiser` (cap 3) with a husk maker. Tithe-Taker: `markThief` with a pick that allows one theft per area across all (`WeakMap<Sim, number>` of the last area, `sim.area`). Confessor: `markStripper`. Flagellant: `markBerserker({ most: 0.6, bleed: 2 })`.
- `src/sim/berserk.ts`: `markBerserker`, `rage(u)`, `isBerserker`. Outgoing damage rises with missing health, linear to +`most` at 10% health, through one `UnitDamage` listener at Pre. A Post listener adds `BLEED` (power `bleed`) for each landed basic attack on the party.
- Cards, bestiary lines, `MONSTER_ORDER`, icons (reused existing imports), `THREAT` (4, 3, 3, 3), and four layer 2 packs after the last layer 2 entry.
- `src/render/rig.ts`: four kinds on the Penitent and Cantor draws. New gear: tall bone staff (Priest), sack on the back (Tithe-Taker), hanging chain (Confessor), whip in place of the knife (Flagellant).
- `test/sim/deep-church.test.ts`: 8 tests covering every acceptance line, plus one that a raised husk equals a spawned husk.
- Changeset `.changeset/be-deep-church.md` (minor).

## Deviations

- The husk is built in `church-steps.ts` (`makeHusk`, same fields as `spawn`), not through `spawnMonster`: importing `spawn.ts` makes a cycle that lint (`import/no-cycle`) rejects. It skips modifiers, rank, element, skills and SPAWN_STEPS (the husk has none); a test guards against drift.
- Touched `src/render/effects.ts` (not owned): the four kinds join the Penitent color list, as in `paperColor`.
- `test/sim/compendium.test.ts`: the count uses `MONSTER_ORDER.length`, and the Creditor lookup `entries.at(-1)` became `entries[MONSTER_ORDER.indexOf('creditor')]` because the Creditor is no longer last. `test/content/monster-table.test.ts` lists the four new keys.
- The layer 2 pack roll changed three stage snapshots in `test/gen/__snapshots__/stage-snapshot.test.ts.snap` (hashes only); updated. The other `be-deep-*` node will conflict on this file: regenerate with `-u`.

## Stubs left

- None.

## Gotchas

- A Tithe-Taker whose pick finds the area already spent is marked spent for good and fights normally, even in a later area.
- The monster-table test and the snapshot file list every monster and pack, so parallel nodes conflict there.
- `concealment`, `creditor`, `flow` and `fields` tests can time out under load; they pass alone.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/deep-church.test.ts`: 8 pass.
- `pnpm typecheck`, `pnpm lint`: pass. `pnpm test`: all pass except load timeouts that pass alone.

## Size

- Estimated M, actual M.
