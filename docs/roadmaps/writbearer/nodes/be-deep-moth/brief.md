---
id: be-deep-moth
title: Crown-Moth: a flying swarm that puts out the lantern
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: bestiary
target:
ship: auto
size: S
spike: false
verify: pnpm vitest run test/sim/crown-moth.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-05
spent:
owns:
  - src/content/monsters/moth-steps.ts
  - src/sim/snuff.ts
  - test/sim/crown-moth.test.ts
shared:
  - src/content/monsters/blight.ts
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
  - on: be-flyers
    kind: hard
    why: the Crown-Moth is a flyer through the Template.flies flag
  - on: gs-terrain-lantern
    kind: hard
    why: the snuff lowers the bearer's light through the Sim.lantern slots that node adds; there is no light state in the sim before it and no frozen contract to stub
---

# Crown-Moth: a flying swarm that puts out the lantern

## Goal

The Crown-Moth, a Blight flyer of the Sunken Crown. It comes in swarms, melee mercs reach it only when it lands to bite, and while a swarm of them lives near the bearer, the bearer's lantern goes out. Fixed light sources still hold. It has a figure, a card, a bestiary entry, a compendium slot and packs in layer 3.

## Context

- Source: `docs/design/13-bestiary.md#the-sunken-crown` (Crown-Moth: "A Carrion Moth grown in the dark. Swarms put out the bearer's light entirely while they live." Occult; answered by the Lamplighter and area damage) and `#art` (Crawler with wings).
- Items: `../../COVERAGE.md`, entries with target `be-deep-moth`.
- Flight is done (be-flyers outcome): set `flies: 'dive'` on the template and `flyerFlag` in `SPAWN_STEPS` does the rest. Area damage still hits an aloft flyer, which is the design's answer.
- Light: read gs-terrain-lantern's `outcome.md` for the exact API. Its brief promises `Sim.lantern` with multiplier slots and a way for an effect to lower or put out the light while fixed sources (braziers) hold.
- be-monsters-upper adds the Carrion Moth (dims the light per bite) and may draw crawler wings first. Reuse its wings if they are in; otherwise draw them here, and the later node reuses yours.
- How a monster is added end to end: see the be-deep-church brief, Context (commit `162891b`). Setup without a `Template` flag: a spawn step keyed on `unit.kind` in `src/content/monsters/moth-steps.ts`, listed once in `SPAWN_STEPS`.

## Steps

- [ ] `crownMoth` in `blight.ts` (crawler build, small, Race.Insect, Occult, `flies: 'dive'`).
- [ ] `src/sim/snuff.ts`: while at least 3 (first guess) living, aware Crown-Moths are within 7 tiles of the bearer, set the lantern's snuff slot to 0; clear it when that stops holding. One check per sim, not per moth.
- [ ] Figure: crawler with large wings. Card, bestiary line, compendium order, icon, threat cost.
- [ ] Packs in layer 3: a swarm of Crown-Moths, and a mixed pack with Hollowed. Append after the last layer 3 entry.
- [ ] `test/sim/crown-moth.test.ts`.

## Acceptance

- [ ] Three aware Crown-Moths near the bearer put the lantern out; killing one brings it back; a fixed light source stays lit meanwhile (test).
- [ ] A melee merc cannot pick an aloft Crown-Moth and can when it lands (test, through `canTarget`).
- [ ] The Crown-Moth spawns through `spawnMonster`, has a card, a bestiary entry and a compendium slot, and `isKind` is true for its figure kind (test).
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

S: one monster on two finished mechanics and one light hook; the per-monster entries are the same pattern as the other be-deep nodes.

## Notes for the worker

- Do not add light state of your own. If gs-terrain-lantern's API has no slot that can reach 0, stop and say so in the outcome instead of working around it.
- The Moth-Queen (be-minibosses) dims the light more with each moth; keep the snuff rule in one function so a later node can scale it.
- `blight.ts` is shared with be-monsters-upper (Carrion Moth, Rift Vulture): append after the last entry.
- Shared files are append-only. Other `be-deep-*` nodes add monsters in the same waves. Add entries at the end of each list or map and packs after the last layer 3 entry; do not reorder or reformat.
- `test/sim/compendium.test.ts` checks a literal count ("1 of 17"). Replace it with a count built from `MONSTER_ORDER.length` if no earlier node did.
- New `FACTIONS` entries change seeded pack rolls in layer 3. Run the whole suite; if a seeded test changes only because of a pack roll, say so in the outcome.
