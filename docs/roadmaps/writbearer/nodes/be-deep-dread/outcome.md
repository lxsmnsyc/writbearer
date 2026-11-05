# Outcome: be-deep-dread

## Built

- `src/sim/dread-aura.ts`: `dreadAura(u, { radius, perSecond, active? })`, default export. Radius and perSecond are numbers or `(u) => number`, read each second. Once a second, while `u` is alive and aware and `active(u)` allows, each unit in `hostiles(u)` within radius (never the bearer) gets `buildUp(DREAD, u, perSecond)`.
- `src/sim/ai/skulker.ts`: `markSkulker(u)` (sets `hidden`), `isSkulker`, and `skulkerStep`, inserted in `MONSTER_STEPS` before `skillStep`. Loop: stalk the bearer (else the nearest target) hidden, `reveal(u, null)` within 2 tiles and strike, after the blow (hit or miss) back off 4 tiles, hide within 1 s of being seen (units targeting it drop it), wait 3.5 s, stalk again. A taunt or Stun returns false so the plain steps run. A strike that does not land in 4 s is given up.
- `src/content/monsters/drowned.ts` (new): `drownedBell` (Construct, Spectral, move 0, reach 0, no attack). `src/content/monsters/hollowed.ts` (new): `whisperer` (Support, Occult), `skulker` (Assassin, fast, Occult). Listed in `table.ts`.
- `src/content/monsters/dread-steps.ts`: one spawn step in `SPAWN_STEPS`. Bell: aura radius 6, 14/s, active while another aware monster (not a bell) is within 4 tiles. Whisperer: radius 4, 16/s. Skulker: `markSkulker`.
- Cards (Bell: Accessory +10 resistance; Whisperer: Head +4 WIL; Skulker: Accessory +8 evasion), bestiary lines, `MONSTER_ORDER`, icons, `THREAT` (4, 4, 5).
- Packs: layer 2 from area 2, Bell with husks and Penitents (kinds list is 8 long, size 4 to 8, so one bell per pack); layer 3 Whisperer with Hollowed (from 2) and Skulker with Hollowed (from 3), each after the last entry of its layer.
- Figures (`src/render/rig.ts`, `draw/figures.ts`): Bell has its own draw `drawBell` (bronze bell on a beam with a crack, like `drawHornPost`). Whisperer is the Cantor robe and hood with a long pale veil. Skulker is the Hollowed with claws about twice as long.
- `test/sim/deep-dread.test.ts`: 13 tests covering every acceptance line, plus one bell per pack.
- Changeset `.changeset/be-deep-dread.md` (minor).

## Deviations

- Touched `src/render/effects.ts` (not owned): Whisperer and Skulker join the Penitent color list in `bodyColor`, as the Church kinds did.
- `test/content/monster-table.test.ts` lists the three new keys. `test/sim/compendium.test.ts` needed no change (already `MONSTER_ORDER.length`).
- The pack roll changed three stage snapshots in `test/gen/__snapshots__/stage-snapshot.test.ts.snap` (hashes only: `drownedCantor/ritual/4242/18`, `firstKeeper/horde/7/3`, `lastHerald/collapse/1/21`); updated with `-u`. Boss and creditor tests pass with expectations untouched. The `ie-item-bonuses` node may conflict on this file: regenerate with `-u`.
- `src/sim/dread-aura.ts` and `skulker.ts` are default-export modules (lint rule); `bosses.ts` still has its own Dread aura.

## Stubs left

- None.

## Gotchas

- The Bell needs to be aware to ring. Its `notice` is 6, and a pack mate waking within 3 tiles wakes it too.
- A hidden Skulker that is unaware stays still; it stalks only once it notices the bearer (notice 8).
- Light-based finding (the Skulker Prince) is not built.
- Under load, several unrelated tests time out in a full run; they pass on rerun.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/deep-dread.test.ts`: 13 pass.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (one rerun after load timeouts).

## Size

- Estimated M, actual M.
