---
id: be-deep-dread
title: Dread and the unseen: Drowned Bell, Whisperer, Skulker
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
verify: pnpm vitest run test/sim/deep-dread.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent: 196000
owns:
  - src/content/monsters/hollowed.ts
  - src/content/monsters/dread-steps.ts
  - src/sim/dread-aura.ts
  - src/sim/ai/skulker.ts
  - test/sim/deep-dread.test.ts
shared:
  - src/content/monsters/drowned.ts
  - src/content/monsters/table.ts
  - src/content/monsters/spawn-steps.ts
  - src/sim/ai/monster.ts
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
  - on: split-ai
    kind: hard
    why: the Skulker's behavior is a module under src/sim/ai/ plus one inserted step in monster.ts
  - on: hidden-units
    kind: behavior
    via: concealment
---

# Dread and the unseen: Drowned Bell, Whisperer, Skulker

## Goal

The two fear casters and the hidden assassin. The Drowned Bell is a stationary bell in the Undercroft that rings Dread over a wide area while other monsters stand near it. The Whisperer follows the Hollowed in the Sunken Crown and builds Dread in mercs within 4 tiles. The Skulker is hidden until it is 2 tiles from the bearer, strikes, and hides again. All three have figures, cards, bestiary entries, compendium slots and packs.

## Context

- Source: `docs/design/13-bestiary.md#the-drowned-undercroft` (Drowned Bell), `#the-sunken-crown` (Whisperer, Skulker), `#art` (Whisperer: Cantor with a veil).
- Items: `../../COVERAGE.md`, entries with target `be-deep-dread`.
- Dread exists: `DREAD` in `src/sim/statuses.ts` (WIL threshold, `flees`, the bearer never takes it; Brave blocks it, Devout halves it, in `src/content/traits.ts`). A Dread aura exists only inside the Hollowed Saint's spawn (`spawnSaint` in `src/content/bosses.ts`): a `Tick` listener that calls `m.buildUp(DREAD, boss, perSecond)` once a second for each merc in radius. No fear skill is needed: cc-afflictions' `frighten` is for mercs scaring monsters.
- Concealment exists (contract `../../contracts/concealment.md`, hidden-units outcome): `unit.hidden`, `reveal(u, by)`, a `CheckTarget` listener that forbids hidden units, and a `UnitDamage` listener that reveals the target and the source of any damage. The renderer skips hidden monsters (`seen()` in `src/render/draw/figures.ts`). Nothing re-hides a unit yet.
- Factions: the Whisperer and Skulker are Hollowed. The existing `hollowed` template stays in `church.ts`; the new ones go in a new `src/content/monsters/hollowed.ts`. The Drowned Bell is Drowned: create `src/content/monsters/drowned.ts` if it does not exist (be-monsters-upper puts the Drowned Wailer there too; whoever lands second appends).
- How a monster is added end to end: see the be-deep-church brief, Context (commit `162891b`). Setup without a `Template` flag: a spawn step keyed on `unit.kind` in this node's own `src/content/monsters/dread-steps.ts`, listed once in `SPAWN_STEPS`.

## Steps

- [ ] `src/sim/dread-aura.ts`: `dreadAura(u, { radius, perSecond, active? })` builds Dread once a second in each party unit within `radius`, while `u` is alive and aware and `active(u)` is true. Victims through `allowed`/`hostiles`. Mini-bosses reuse it (the Whispering Choir), so keep the options open to a power that changes.
- [ ] `drownedBell` (Spectral, Race.Construct or Spirit, `moveSpeed: 0`, no attack, like `hornPost`): `dreadAura` radius 6 (first guess), active only while another aware monster stands within 4 tiles of it. Figure: a large cracked bell.
- [ ] `whisperer` (Occult, Hunt.Support, frail): `dreadAura` radius 4. Figure: Cantor with a long veil.
- [ ] `skulker` (Occult, fast, Hunt.Assassin): hidden at spawn. `src/sim/ai/skulker.ts`: `skulkerStep` inserted in `MONSTER_STEPS`. While hidden it closes on the bearer; within 2 tiles it is revealed and strikes; after its blow lands it hides again within about 1 s and backs off a few tiles; it waits a few seconds before the next approach. A taunt or a stun lets the normal steps run. Figure: a Hollowed with long claws or a hood.
- [ ] Cards, bestiary lines, compendium order, icons, threat costs.
- [ ] Packs: the Bell in layer 2 with husks and Penitents around it (one bell per pack: `packOf` repeats `kinds`, so give the bell's pack a kinds list as long as its largest size, or a fixed size); the Whisperer and Skulker in layer 3 with the Hollowed. Append after the last entry of each layer.
- [ ] `test/sim/deep-dread.test.ts`.

## Acceptance

- [ ] A merc within 6 tiles of a Drowned Bell with a husk beside it builds Dread and flees; with no monster near the bell it builds none; a broken bell stops (test).
- [ ] A Whisperer builds Dread in a merc at 3 tiles and not at 5; the bearer never takes it; a Brave merc is not frightened (test).
- [ ] A hidden Skulker is not targeted by mercs; it is revealed at 2 tiles from the bearer and hits it; after the hit it is hidden again; area damage reveals it (test).
- [ ] A fight of a party against two Skulkers ends within 120 sim seconds (test, so hiding never stalls a fight).
- [ ] Each of the three spawns through `spawnMonster`, has a card, a bestiary entry and a compendium slot, and `isKind` is true for its figure kind (test).
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

M: one aura helper extracted from a known pattern, one AI step on an existing contract, three monsters. The Skulker's hide-strike-hide loop is the one part with medium uncertainty.

## Notes for the worker

- Do not move the Hollowed Saint onto `dreadAura`: `bosses.ts` fights are seed-sensitive (`test/sim/bosses.test.ts`, `boss.test.ts`). A later node may.
- Shared files are append-only. Other `be-deep-*` nodes add monsters in the same waves. Add entries at the end of each list or map and packs after the last entry of the layer; do not reorder or reformat. Expect trivial merge conflicts on adjacent lines.
- `test/sim/compendium.test.ts` checks a literal count ("1 of 17"). Replace it with a count built from `MONSTER_ORDER.length`; the other nodes make the same edit.
- New `FACTIONS` entries change seeded pack rolls in layers 2 and 3. Run the whole suite; if a seeded test changes only because of a pack roll, say so in the outcome.
- Hiding again: set `hidden = true` and clear `u.target` on the units that were attacking it, or rely on `CheckTarget` dropping it on their next pick. Check that a merc mid-swing at it does not keep hitting; a hit that lands reveals it again, which is fine.
- The Skulker's reveal at 2 tiles is a `reveal(u, null)` from its own step. The Lamplighter and the Warden's Sentry reveal it later; do not build light-based finding here (the Skulker Prince's "found only by light" is be-minibosses').
- A stationary bell: `moveSpeed: 0` and `reach: 0`, as `hornPost` in `old-king.ts`. Make sure the plain monster steps do not try to path it.
- Victim lists go through `hostiles`/`allowed`/`canTarget`. Per-unit state lives in a module `WeakMap`. The sim stays DOM-free.
