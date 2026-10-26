---
id: bb-reeve-siege
title: The Drowned Reeve and the Siege Crew
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
  - on: bp-ground
    kind: contract
    via: boss-field
---

# The Drowned Reeve and the Siege Crew

## Goal

The Marches' and the Rift Road's second bosses. The Reeve raises water that joins at half health and calls Husks from it; the Siege Crew mans a ballista guarded by archers.

## Context

- Source: `docs/design/13-bestiary.md#bosses`, `#order-to-build-in` (second bosses first).
- Each boss is a `BossDef` module (contract boss-def). Research notes for the split: see `bp-roll`'s brief and `contracts/boss-def.md`.
- Items: `../../COVERAGE.md`, entries with target `bb-reeve-siege`.
