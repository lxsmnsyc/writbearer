---
id: cc-el-spectral
title: Spectral status and Spectral attacks
status: todo
priority: should
type: feature
outline: false
milestone: combat-core
size: S
spike: false
verify: pnpm vitest run test/sim/el-spectral.test.ts && pnpm vitest run test/sim/statuses.test.ts test/sim/bosses.test.ts test/sim/boss.test.ts
exclusive: []
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/spectral.ts
  - test/sim/el-spectral.test.ts
shared:
  - src/sim/statuses.ts
reserves: []
provides: []
depends_on: []
---

# Spectral status and Spectral attacks

## Goal

Give Spectral the buildup status it lacks and prove Spectral attacks work end to end, so the Monk and the Medium can use them. Today `Element.Spectral` has a full affinity table and a defense meaning, but `ELEMENT_STATUS` has no entry, so a Spectral hit builds nothing, and no attack uses the element.

## Context

- Source: `docs/design/04-elements.md#element-set` (Spectral row), `docs/design/12-new-jobs.md#what-the-engine-needs-each-row` (Spectral attacks: Monk, Medium). COVERAGE: "Spectral status/effect" and "Spectral attacks".
- Built: `src/sim/elements.ts` (Neutral does 90 to 50% to Spectral, Spectral does 125 to 175% to Spectral), `ELEMENT_STATUS` in `src/sim/statuses.ts` (comment "Spectral has none yet"). `Unit.hit` takes `element` and `attackElement` already.
- Design gap: doc 04 names no Spectral status. Default for the worker to build and note in the outcome: `UNMOORED`, threshold on WIL like Dread, 5 s, immunity 4 s, `modifiers` take 20% from armor and resistance (spirits slip the body's guard) and it is a debuff, not a buff. If the owner wants another effect, only the def changes.

## Acceptance

- [ ] A Spectral hit builds buildup toward the new status and triggers it at the threshold; a Neutral hit does not (`test/sim/el-spectral.test.ts`).
- [ ] A merc with `attackElement: Element.Spectral` deals 125% to a Spectral 1 target and 100% to a Neutral target; a Neutral attacker deals 90% to Spectral 1.
- [ ] The status is exported from `src/sim/spectral.ts` for job modules, and `ELEMENT_STATUS` maps Spectral to it (one appended line).
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

One new module and one appended line; the main work is the test. S.

## Notes for the worker

- This is the node mj-monk and mj-medium need. Their briefs depend on this node. Write the outcome with the export names and the status id.
- Any change that can touch shared damage math must keep `test/sim/bosses.test.ts`, `boss.test.ts` and `creditor.test.ts` passing unchanged; they are seed-sensitive. New code does nothing until something opts in, so a seeded fight matches the code before the node.
- Keep `statuses.ts` edits to the `ELEMENT_STATUS` line and one import; `cc-el-defense` edits `becomes` in the same file.
- A Spectral status must not put Spectral monsters' `becomes`-style element change on the target; it only debuffs.
- Victim lists go through `hostiles`/`allowed`/`canTarget` (`src/sim/targeting.ts`), never `sim.foes` directly. Once-per-area effects key on `sim.area`. Passive state lives in a module `WeakMap<Unit, ...>`. Old saves must load. The sim stays DOM-free.
