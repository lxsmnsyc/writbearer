---
id: bb-bishop-usurper
title: The Ossuary Bishop and the Usurper
status: todo
priority: should
type: feature
outline: true
milestone: bestiary
size: L
depends_on:
  - on: bp-roll
    kind: contract
    via: boss-def
  - on: bp-possess
    kind: hard
    why: the Usurper is built on control, copy and theft
  - on: be-corpse-raisers
    kind: hard
    why: the Bishop raises corpses (`raise()` with a kind and level)
---

# The Ossuary Bishop and the Usurper

## Goal

The Undercroft's and the Crown's second bosses. The Bishop raises every body as Husks, then Revenants; the Usurper copies the strongest merc's last skill, steals buffs and takes a merc for 6 s at half health.

## Context

- Source: `docs/design/13-bestiary.md#bosses`, `#order-to-build-in` (second bosses first).
- Each boss is a `BossDef` module (contract boss-def). Research notes for the split: see `bp-roll`'s brief and `contracts/boss-def.md`.
- Items: `../../COVERAGE.md`, entries with target `bb-bishop-usurper`.
- From bp-possess (2026-11-05): `control`, `freeControlled`, `copySkill`/`lastReleased` and `stealBuff` in `src/sim/control.ts` and `src/sim/copy.ts`. Control ends on stage change and save. The Cleric AI never aims Ward or Cleanse at a controlled merc (it counts as a foe), so only a direct cast frees one; widen that here if the Usurper needs it. Play Dead on a controlled merc has no test.
- From bp-roll: the map e2e names the layer-1 pool's first built boss; a boss that changes it updates `e2e/map.spec.ts`.
