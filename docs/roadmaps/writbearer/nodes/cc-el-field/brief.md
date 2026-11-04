---
id: cc-el-field
title: Element fields from skills (Volcano, Deluge, Violent Gale)
status: todo
priority: should
type: feature
outline: false
milestone: combat-core
size: M
spike: false
verify: pnpm vitest run test/sim/el-field.test.ts && pnpm vitest run test/sim/arcanist-upgrades.test.ts test/sim/bosses.test.ts test/sim/boss.test.ts test/sim/creditor.test.ts
exclusive: []
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/fields.ts
  - src/sim/mechanics/fields.ts
  - test/sim/el-field.test.ts
shared:
  - src/sim/zone.ts
  - src/sim/mechanics/index.ts
  - src/render/zones.ts
reserves: []
provides: []
depends_on: []
---

# Element fields from skills (Volcano, Deluge, Violent Gale)

## Goal

Make an element field a general engine rule: a zone that raises the damage of one element for units of the owner's side standing in it. Ship the three rAthena fields as helpers: Volcano (Fire), Deluge (Frost) and Violent Gale (Storm), each with a ground look. Fields only boost, they never hurt anyone.

## Context

- Source: `docs/design/04-elements.md#element-fields`. Items: `../../COVERAGE.md`, entries "Element fields" (04#General).
- Already built: zones (`src/sim/zone.ts`, `setZone`, `zonesAt`, `updateZones`), Pneuma and Safety Wall (`guards`, `charges`, `src/sim/mechanics/zones.ts`) and the Arcanist's Volcano. The Volcano is a one-off: `VOLCANO_EFFECT` in `src/content/jobs/arcanist/upgrades.ts` multiplies Fire by 1.2 inside zone kind `volcano` for its owner only. This node does not edit that file; it leaves the Volcano as is unless the worker can switch it to the new `boost` field with the same numbers and the arcanist tests unchanged.
- Zones are not saved; fields are runtime only.

## Steps

- [ ] Add `boost?: { element: Element; percent: number }` to `Zone` (append). Add `setField(sim, owner, kind, element, at, r, life, percent)` and the three presets in `src/sim/fields.ts`.
- [ ] A UnitDamage listener in `src/sim/mechanics/fields.ts` at `DamagePriority.Amplify`: when the hit's element equals a zone's `boost.element`, the source is inside, and the source is on the zone owner's side, multiply by `1 + percent/100`. Several fields of one element do not stack: take the best. True damage is skipped. Register it in `mechanics/index.ts` (append).
- [ ] Add `ZONE_LOOKS` entries `deluge` and `gale` in `src/render/zones.ts` (append; `volcano` exists).
- [ ] Tests with a fixture caster, no real job: boost applies inside and not outside, only to own side, only to that element, best-of for overlap, expires with `life`.

## Acceptance

- [ ] A Fire hit from a unit inside a Volcano field does `1 + percent/100` times the damage; the same hit outside, from an enemy inside, or with another element does not (`test/sim/el-field.test.ts`).
- [ ] Overlapping fields of one element do not stack; fields of two elements both apply to their own element.
- [ ] A seeded fight with no field is unchanged: `test/sim/bosses.test.ts`, `boss.test.ts`, `creditor.test.ts` pass without edits.
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

Few files, one new listener; the only shared edit is an optional field on `Zone`. M.

## Notes for the worker

- Any change that can touch shared damage math must keep `test/sim/bosses.test.ts`, `boss.test.ts` and `creditor.test.ts` passing unchanged; they are seed-sensitive. New code does nothing until something opts in, so a seeded fight matches the code before the node.
- Victim lists go through `hostiles`/`allowed`/`canTarget` (`src/sim/targeting.ts`), never `sim.foes` directly. Once-per-area effects key on `sim.area`. Passive state lives in a module `WeakMap<Unit, ...>`. Old saves must load. The sim stays DOM-free.
- Do not give a field a job-skill. Granting Deluge or Violent Gale to a merc is the job nodes' work (mj-sage may want them); this node only supplies the rule and presets.
- Weather and biome fields are the next node, cc-el-weather, which reuses `boost`.
