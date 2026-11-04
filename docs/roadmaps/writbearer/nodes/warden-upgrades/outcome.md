# Outcome: warden-upgrades

## Built

- `src/content/jobs/warden/upgrades.ts`: the Warden's 12 elite upgrades, each with a patch, an effect or both. Numbers are first guesses.
  - Cover
    - Living Shield (effect): during Cover, the Warden takes 40% of a hit Interpose shares instead of 70%. The bearer is still spared 70%. What the Warden takes is added to its Ward, capped at 50% of its max health.
    - Tether (patch + effect): the Warden first dashes to one body from the bearer, then Cover runs. It gets `TETHERED` (exported, `slow: 1.3`, so 30% faster) for as long as Cover lasts. A CheckChase listener caps its chase at 3 tiles while it is covering.
    - Retaliate (effect): during Cover, a foe within reach + 0.5 that damages the bearer takes a free basic attack (`strike`) from the Warden. DoT ticks do not trigger it.
  - Execute
    - Blood Debt (patch): a kill with Execute heals the bearer for 10% of the enemy's max health.
    - Hangman's Reach (patch): `wants` accepts a marked target up to reach + 3 tiles away. The Warden lands one body from it, then Execute runs.
    - Last Rites (patch): a kill sets Pursue's cooldown to 0 and marks the nearest targetable foe.
  - Tripwire
    - Sentry (effect): each tick, while an unsprung Tripwire of the Warden's stands, hidden foes within 6 tiles of it are `reveal`ed.
    - Trap Field (patch + effect): the base Tripwire is set, then swapped for a `trapField` zone (2.5 tiles, 30 s) at the same spot. Each time an enemy steps in from outside, it gets `trippedFor(rank)` (slowed and marked) and becomes aware. It is not set again while one stands.
    - Never Surprised (effect): the effect puts the Warden on a per-Sim watch list. Three exported hooks read it. `seesAmbushes(sim)` makes Ambushes show on the layer map. `springAmbush(sim, entrance)` sets a Tripwire at the stage entrance (60 s). `ambushersArrive(sim, units)` stuns each arriving wave for 1 s.
  - Pursue
    - Marked for Death (effect): +10% damage, at `DamagePriority.Amplify`, from any unit of the Warden's side on a marked enemy (True damage excepted). Only the first living holder applies it, so two Wardens do not stack.
    - Debt Collector (effect): +25 crit rate on the Warden's hits on marked enemies (CheckHit, Additive).
    - Read the Room (patch + effect): with no marked quarry, Pursue wants the nearest hidden monster, or disguised non-party unit, within 6 tiles. It reveals and marks that unit, then leaps and strikes. On the first tick of each `sim.area`, the effect reveals every disguised unit not on the Warden's side.
- `src/content/jobs/warden/spells.ts` (new): the spells, innate and statuses moved out of `index.ts` with no change, so `upgrades.ts` can import them without a cycle. `INTERPOSE_SHARE` is now exported. `index.ts` keeps the JobDef and runs `export * from './spells'`, so every old import from `jobs/warden` still works.
- `src/render/zones.ts`: `ZONE_LOOKS.trapField`, three wires across the field (append-only).
- `src/game/objective.ts`: an Ambush calls `springAmbush` when it springs, and `ambushersArrive` with each wave's units as they are brought.
- `src/game/game/route.ts`: `layerMap` shows the real node instead of `seenAs(n)` while `seesAmbushes(g.sim)`.
- `test/sim/warden-upgrades.test.ts`: 17 tests. They cover the structure, every upgrade (both Sentry and Read the Room run with and without the upgrade, against real `reveal`, hidden monsters and `spawnDisguisedAssassin`) and a full Ambush through `ObjectiveRun`.
- `test/content/jobs.test.ts`: added the Warden's "all built" line and left the others as they were.
- `.changeset/warden-upgrades.md` (minor).

## Deviations

- Files outside the owned paths were edited:
  - `src/content/jobs/warden/index.ts` and the new `spells.ts`: a split that keeps behavior. oxlint's `import/no-cycle` rejects `upgrades.ts` importing from `./index`, because `index.ts` imports `upgrades.ts`. Duelist and Sellsword already use this layout.
  - `src/game/objective.ts` and `src/game/game/route.ts`: Never Surprised needs the game layer, because the sim does not know what an Ambush is. Each file has a small change: one import and one or two calls. Sellsword's `listeners.ts` hooks follow the same pattern.
- `src/ui/map.tsx` and `src/sim/trap.ts` (shared) are unchanged. The map already draws an `ambush` objective once `layerMap` passes it through. Trap Field is a zone, not a new kind of trap.
- Living Shield is read as "the Warden takes 40% instead of 70%, the bearer is still spared 70%". The other reading is that the bearer takes 60%. That reading weakens the soak build doc 16 describes. Ask the user if this is wrong.
- Never Surprised reveals Ambushes only on the layer map, not on signposts (`aheadOf`, `fightsAhead`). Doc 16 says "on the map".

## Stubs left

- None.

## Gotchas

- The Never Surprised Tripwire stands at the stage entrance, as doc 16 says. Ambushers come from round the fire, so it often stays unsprung. Move it toward the waves if playtests show it does nothing.
- Read the Room's area reveal fires on the first tick after the effect starts, and again on each `sim.area` change. Its state is a closure per setup, not per unit identity, because the party carries over in one Sim.
- Death clears statuses and recomputes `derived`, so a test that sets `maxHp` by hand sees it reset after the kill. Blood Debt reads max health before the blow.
- The watch list (`WATCHFUL`) is a `WeakMap<Sim, Set<Unit>>` filled by the effect's lifecycle. Save load re-runs `applyUpgrade`, so the list is rebuilt on load.
- Game modules that import `jobs/warden/upgrades` load the jobs registry first through `roster` and `builds`. There is no cycle now, so the order no longer matters.

## Proposed learnings

- Keep a job's spells in `<kind>/spells.ts`, not `index.ts` | `upgrades.ts` needs them, and `import/no-cycle` rejects importing from `index.ts` | src/content/jobs | yes (oxlint already does)

## Verification

- `pnpm vitest run test/sim/warden-upgrades.test.ts`: 17 passed.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (67 files, 612 passed, 24 skipped).
- `pnpm test:e2e`: not run (exclusive port; orchestrator's full check).

## Size

- Estimated L, actual L.
