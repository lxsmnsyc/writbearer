---
id: be-deep-guard
title: The Crown's last guard: Revenant Knight and Gilded Effigy
status: done
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
verify: pnpm vitest run test/sim/deep-guard.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent: 150000
owns:
  - src/content/monsters/guard-steps.ts
  - src/sim/steadfast.ts
  - test/sim/deep-guard.test.ts
shared:
  - src/content/monsters/old-king.ts
  - src/content/monsters/table.ts
  - src/content/monsters/spawn-steps.ts
  - src/render/rig.ts
  - src/ui/icons.ts
  - src/content/cards.ts
  - src/content/bestiary.ts
  - src/game/compendium.ts
  - src/gen/stage/packs.ts
  - test/sim/compendium.test.ts
reserves: []
provides: []
depends_on:
  - on: split-roster
    kind: hard
    why: monsters go in faction modules under src/content/monsters/ and set up through SPAWN_STEPS
---

# The Crown's last guard: Revenant Knight and Gilded Effigy

## Goal

Two Old King's guard monsters for the Sunken Crown. The Revenant Knight is a heavy, slow armored ghost: Spectral, so Neutral hits lose a large share of their damage. The Gilded Effigy is a golden statue that wakes when the bearer comes close, and cannot be stunned or frightened. Both are Hollow soldier figures drawn differently, with cards, bestiary entries, compendium slots and packs in layer 3.

## Context

- Source: `docs/design/13-bestiary.md#the-sunken-crown` (Revenant Knight, Gilded Effigy) and `#art` (Revenant: Hollow soldier drawn pale and see-through; Effigy: Hollow soldier drawn in gold, with a crown).
- Items: `../../COVERAGE.md`, entries with target `be-deep-guard`.
- Spectral needs no new mechanic. `Template.elementLevel` exists, and `src/sim/elements.ts` gives Neutral 90%, 70% and 50% against Spectral 1, 2 and 3. cc-el-spectral (todo) only adds a Spectral buildup status for Spectral attacks; the Revenant's attack stays Neutral, so it does not depend on that node.
- Immunity: Brave (`src/content/traits.ts`) blocks Dread with a `CheckStatusDuration` listener at `ValuePriority.Pre` that sets `event.disabled`. The Effigy uses the same pattern for `STUN` and for every status with `flees: true` (today `DREAD`; cc-afflictions' coming `FRIGHTENED` has `flees` too, so it is covered without a dependency).
- How a monster is added end to end: see the be-deep-church brief, Context (commit `162891b`). Setup without a `Template` flag: a spawn step keyed on `unit.kind` in this node's own `src/content/monsters/guard-steps.ts`, listed once in `SPAWN_STEPS`.

## Steps

- [ ] `revenantKnight` (Hollow soldier build, heavier armor, slower, Race.Undead, `element: Element.Spectral`, `elementLevel: 2` as a first guess). Figure: the Hollow soldier drawn pale and partly see-through (a lower alpha for its paper pieces).
- [ ] `src/sim/steadfast.ts`: `makeSteadfast(u)` blocks `STUN` and every `flees` status on that unit, one listener per sim, state in a `WeakSet`.
- [ ] `gildedEffigy` (Hollow soldier build, Race.Construct, Earth, high armor, slow, short `notice` such as 2.5 so it wakes only when the bearer passes, Hunt.Nearest): `makeSteadfast` from its spawn step. Figure: the Hollow soldier in gold with a crown.
- [ ] Cards, bestiary lines, compendium order, icons, threat costs.
- [ ] Packs in layer 3: append after the last layer 3 entry, for example Revenant Knights with Hollow soldiers, and an Effigy standing with archers.
- [ ] `test/sim/deep-guard.test.ts`.

## Acceptance

- [ ] A Neutral merc hit on a Revenant Knight deals the Spectral 2 share of the same hit on a Hollow soldier with equal defense; a Fire hit is not reduced (test).
- [ ] A Gilded Effigy takes no `STUN` from a stun skill and no `DREAD` from Occult buildup; a Hollow soldier beside it does (test).
- [ ] An unaware Effigy stays still with the bearer at 4 tiles and wakes at 2 (test).
- [ ] Each of the two spawns through `spawnMonster`, has a card, a bestiary entry and a compendium slot, and `isKind` is true for its figure kind (test).
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

M: no new system beyond a status-block helper copied from Brave; two monsters, two figure variants and the shared per-monster entries.

## Notes for the worker

- Other disables (Freeze, Petrify, Root) still work on the Effigy: the design names stun and fear only. "Armor breaking" (Sunder) must still work on it.
- The pack wake (`PACK_RADIUS` in `src/sim/ai/monster.ts`) can wake the Effigy early when its pack notices. Accept it, or keep the Effigy's packs small; do not edit `monster.ts`.
- `old-king.ts` is shared with be-monsters-upper (Chain Warden): append your templates after the last entry.
- Shared files are append-only. Other `be-deep-*` nodes add monsters in the same waves. Add entries at the end of each list or map and packs after the last layer 3 entry; do not reorder or reformat. Expect trivial merge conflicts on adjacent lines.
- `test/sim/compendium.test.ts` checks a literal count ("1 of 17"). Replace it with a count built from `MONSTER_ORDER.length`; the other nodes make the same edit.
- New `FACTIONS` entries change seeded pack rolls in layer 3. Run the whole suite; if a seeded test changes only because of a pack roll, say so in the outcome.
- See-through and gold are drawing choices inside `rig.ts` for the new kinds only. be-monsters-upper draws the Drowned Wailer pale too; if a shared "pale" helper fits, keep it small and local to `rig.ts`.
- The Last Herald calling Revenant Knights is be-minibosses'. Do not edit `src/content/minibosses.ts` or `src/content/bosses.ts`.
