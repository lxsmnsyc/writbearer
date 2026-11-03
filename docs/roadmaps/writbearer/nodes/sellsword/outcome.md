# Outcome: sellsword

## Built

- `src/content/jobs/sellsword/spells.ts`: the four spells `RUSH`, `POCKET_SAND`, `HAMSTRING`, `CLEAVE`, the innate `SECOND_WIND` (with `secondWindText`), the status `HAMSTRUNG`, rank formulas (`rushStun`, `sandBlind`, `hamstringRatio`, `hamstringSlow`, `cleaveRatio`) and constants. All exported so the upgrade node can patch them.
- `src/content/jobs/sellsword/index.ts`: the real spells, innate and four icons. Still `hireable: false`.
- `src/render/looks/sellsword.ts`: its own look, drawn at size 1.1 with one sword and no shield.
- `test/sim/sellsword.test.ts`: 12 tests. A headless fight, each spell, Second Wind, and Cleave sparing a unit that CheckTarget forbids.

Behavior: Rush aims at the enemy nearest the bearer that is going for it, jumps next to it and hits for 100% with stun buildup. Pocket Sand adds Blind buildup to enemies in a 3-tile cone (45 degrees each side). Hamstring hits and adds `HAMSTRUNG` for 3 s. Cleave hits the target plus the nearest others in a 60 degree arc, up to 3 in all, through `areaVictims`. Second Wind heals 20% of max health once per stage when a hit leaves the Sellsword at 30% or less.

## Deviations

- Hamstring's slow grows with rank (30 + 2r%) through one `StatusDef` per rank (`hamstrungAt`), all with the id 'hamstrung', because a def's `slow` is a constant. `src/sim/status.ts` is untouched.
- The look uses only existing attachments (a sword). A bigger signature shape needs a new `Attachment` in `src/render/sprites.ts`, outside this node.
- No shared file was touched. `listeners.ts`, `unit.ts`, `loot.ts` and `sim.ts` are needed only by the upgrades (Pocket Change, Veteran of Many Wars).
- The new file `src/content/jobs/sellsword/spells.ts` is in the job folder, as the Duelist has.

## Stubs left

- The 12 upgrades are summary-only, built by `sellsword-upgrades`.

## Gotchas

- Second Wind state is a module-level `WeakSet` of units. Each stage builds new units, so it resets; a test covers two stages.
- Rush's `aim` returns null when nobody is attacking the bearer, so the AI skips it. A manual cast needs a target.
- Pocket Sand has no damage: it only calls `buildUp(BLIND, ...)`. Bribe and Play Dead will patch `release`/`wants`.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/sellsword.test.ts`: 12 passed. `pnpm typecheck && pnpm lint && pnpm test`: pass (61 files).
- `pnpm test:e2e` not run (port 5199).

## Size

- Estimated M, actual M.
