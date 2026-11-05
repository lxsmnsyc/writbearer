---
id: be-deep-church
title: The Undercroft's Church keepers: Ossuary Priest, Tithe-Taker, Confessor, Flagellant
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
verify: pnpm vitest run test/sim/deep-church.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns:
  - src/content/monsters/church.ts
  - src/content/monsters/church-steps.ts
  - src/sim/berserk.ts
  - test/sim/deep-church.test.ts
shared:
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
  - on: be-corpse-raisers
    kind: hard
    why: the Ossuary Priest is markRaiser from src/sim/ai/raiser.ts
  - on: be-thieves
    kind: hard
    why: the Tithe-Taker is markThief from src/sim/theft.ts
  - on: be-strippers
    kind: hard
    why: the Confessor is markStripper from src/sim/ai/stripper.ts
---

# The Undercroft's Church keepers: Ossuary Priest, Tithe-Taker, Confessor, Flagellant

## Goal

Four new Church monsters for the Drowned Undercroft, each a Penitent or Cantor figure with one added shape, with a card, a bestiary entry, a compendium slot and packs in layer 2. Three are built on mechanics that are already done (raiser, thief, stripper). The Flagellant adds a small berserker mechanic: it hits harder the more it is hurt, and its hits bleed.

## Context

- Source: `docs/design/13-bestiary.md#the-drowned-undercroft` (rows: Ossuary Priest, Tithe-Taker, Confessor, Flagellant) and `#art` (Penitent with a sack, a chain, a whip; Cantor with a bone staff).
- Items: `../../COVERAGE.md`, entries with target `be-deep-church`.
- Mechanics to call, all built (read their `outcome.md`):
  - `markRaiser(unit, { make, cap? })` in `src/sim/ai/raiser.ts` (be-corpse-raisers). `make(sim, level, x, z)` must add the unit to the sim; `spawnMonster(sim, 'husk', ...)` does.
  - `markThief(u, pick?)` and `PickLoot` in `src/sim/theft.ts` (be-thieves). The thieves outcome warns that the once-per-area limit is per thief, so several thieves can empty the pack.
  - `markStripper(unit)` in `src/sim/ai/stripper.ts` (be-strippers). It takes the weapon first.
  - `BLEED` in `src/sim/statuses.ts` (1% of max health a second per point of power, 4 s).
- How a monster is added (see commit `162891b`, Bloat, for the full set): a template in its faction module, one line in `MONSTERS` (`table.ts`), a `THREAT` cost and `FACTIONS` packs (`src/gen/stage/packs.ts`), `BESTIARY` (`src/content/bestiary.ts`), `CARD_BY_MONSTER` (`src/content/cards.ts`), `MONSTER_ORDER` (`src/game/compendium.ts`), an icon (`src/ui/icons.ts`), and a figure kind in `src/render/rig.ts` (`Kind`, `KINDS`, `OTHER_HIT`, `OTHER_SIZE`, `paperColor`, the draw code).
- Setup without a `Template` flag: a spawn step keyed on `unit.kind` (`if (unit.kind === 'ossuaryPriest') ...`) in this node's own `src/content/monsters/church-steps.ts`, listed once in `SPAWN_STEPS`. This keeps `src/content/jobs/types.ts` out of the change.

## Steps

- [ ] `ossuaryPriest` (Cantor build, Hunt.Support, Radiant): `markRaiser` with `make` spawning a `husk`, cap 3. Figure: Cantor with a tall bone staff.
- [ ] `titheTaker` (Penitent build, fast, Radiant): `markThief` with a `pick` that allows one theft per area across all Tithe-Takers (a `WeakMap<Sim, number>` of the last area that lost an item, keyed on `sim.area`), otherwise it calls the default pick. Figure: Penitent with a large sack on its back.
- [ ] `confessor` (Penitent build, Radiant): `markStripper`. Figure: Penitent with a long chain.
- [ ] `flagellant` (Penitent build, Radiant): `src/sim/berserk.ts` exports `markBerserker(u, { most, bleed })`. Its outgoing damage rises with its missing health share, up to `most` (first guess +60% at 10% health), through one `UnitDamage` listener at a pre priority that checks the source. Each landed basic attack on a party unit adds `BLEED` (first guess power 2). Figure: Penitent with a whip.
- [ ] Cards, bestiary lines (who it was, how it fights, as the others read), compendium order, icons, threat costs.
- [ ] Packs in layer 2: append entries after the last layer 2 entry, for example a Priest with Penitents and husks (the bodies it raises), a Tithe-Taker with Penitents, a Confessor pack, a Flagellant pack. At least one pack per monster.
- [ ] `test/sim/deep-church.test.ts`.

## Acceptance

- [ ] An Ossuary Priest next to a fallen penitent raises it as a husk, and stays behind its allies (test).
- [ ] Two Tithe-Takers in one area take one item in all; in the next area one can take another (test).
- [ ] A Confessor's landed hit strips a merc's weapon (test, through `isStripped`).
- [ ] A Flagellant at 20% health deals more than at full health to the same target with the same seed, and its hit leaves `BLEED` on the merc (test).
- [ ] Each of the four spawns through `spawnMonster`, has a card, a bestiary entry and a compendium slot, and `isKind` is true for its figure kind (test).
- [ ] A seeded layer 2 stage can field each of the four (test through `FACTIONS`, not a random stage roll).
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

M: four monsters on three finished mechanics and one small new one; most of the work is the per-monster entries in shared files and four figures.

## Notes for the worker

- Shared files are append-only. Other `be-deep-*` nodes add monsters in the same waves. Add your entries at the end of each list or map (after the last monster entry, before comments such as `// Places on the map` in `icons.ts`), and your packs after the last entry of layer 2. Do not reorder or reformat existing entries. Expect trivial merge conflicts on adjacent lines.
- `test/sim/compendium.test.ts` checks a literal count ("1 of 17"). Replace it with a count built from `MONSTER_ORDER.length`, so parallel nodes do not each change the number. The other nodes are told the same; identical edits merge cleanly.
- New `FACTIONS` entries change which pack a seeded stage rolls in layer 2. Run the whole suite; if a seeded test changes only because a pack roll changed, say so in the outcome and fix the test's expectation, not the roll.
- `markRaiser`'s `make` calls `spawnMonster`. Importing `src/content/spawn.ts` from `church-steps.ts` makes an import cycle through `spawn-steps.ts`. It works at call time; if lint rejects it, take `spawnMonster` lazily or set the raiser up from `spawn.ts`, and note it.
- The Tithe-Taker's drop "with interest" and three thefts are the Tithe-Collector's (be-minibosses), not this node's.
- Strip set bonus lag (be-strippers outcome) is known; do not fix it here.
- Figures follow the minimalist rule: one large signature shape each, readable at 384x216. Reuse the Penitent and Cantor draws; do not draw new bodies.
- Victim lists go through `hostiles`/`allowed`/`canTarget` (`src/sim/targeting.ts`). Per-unit state lives in a module `WeakMap`. The sim stays DOM-free. Do not edit `src/content/bosses.ts`.
