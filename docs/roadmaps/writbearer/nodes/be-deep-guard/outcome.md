# Outcome: be-deep-guard

## Built

- `src/content/monsters/old-king.ts`: templates `revenantKnight` (Undead, `Element.Spectral` level 2, armor +45, move 1.4) and `gildedEffigy` (Construct, Earth, armor +60, move 1.2, `notice` 2.5, Hunt.Nearest). Both listed in `MONSTERS` (`table.ts`).
- `src/sim/steadfast.ts`: `makeSteadfast(u)`, `isSteadfast(u)`. One `CheckStatusDuration` listener per sim at Pre; blocks `STUN` and any status with `flees`. Other disables and Sunder still work.
- `src/content/monsters/guard-steps.ts`: one spawn step in `SPAWN_STEPS`; makes the Effigy steadfast.
- Cards (Revenant: Body +8 armor; Effigy: Head +6% max health), bestiary lines, `MONSTER_ORDER`, icons, `THREAT` (6, 6).
- Two layer 3 packs after the last layer 3 entry: Revenant Knight with two Hollow soldiers (from 2), Gilded Effigy with two Hollow archers (from 3).
- `src/render/rig.ts`: two kinds on the Hollow soldier build and spear. Revenant: pale (`C.bone`) and drawn at alpha 0.5, size 1.15. Effigy: gold, with a crown 1.9x wide and tall.
- `test/sim/deep-guard.test.ts`: 5 tests covering every acceptance line.
- Changeset `.changeset/be-deep-guard.md` (minor).

## Deviations

- Touched `src/render/effects.ts` (not owned): `bodyColor` gives the two kinds their gold and pale colors, as for the Church kinds.
- `test/content/monster-table.test.ts` lists the two new keys. `test/sim/compendium.test.ts` needed no change (be-deep-church already uses `MONSTER_ORDER.length`).
- The layer 3 pack roll changed three stage snapshots (hashes only: plain fields, objectives, and `lastHerald/collapse/1/21`); updated with `-u`. The boss and creditor tests pass with their expectations untouched. The `ie-item-model` node or later pack nodes will conflict on this file: regenerate with `-u`.

## Stubs left

- None.

## Gotchas

- The Effigy's `notice` is 2.5, but `wakePack` can wake it early when its pack mates notice the bearer at 5.
- The ghost alpha is skipped on the white hit flash.
- Under load, several unrelated tests time out in a full run; they pass on rerun.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/deep-guard.test.ts`: 5 pass.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (757 passed, 3 skipped).

## Size

- Estimated M, actual M.
