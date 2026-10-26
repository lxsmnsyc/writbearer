---
id: bb-choir-regent
title: The Drowned Choir and the Faceless Regent
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
  - on: bp-link
    kind: hard
    why: the sisters are a link group
  - on: bp-ground
    kind: contract
    via: boss-field
  - on: gs-terrain-lantern
    kind: hard
    why: the shadow comes from the lantern
  - on: hidden-units
    kind: behavior
    via: concealment
---

# The Drowned Choir and the Faceless Regent

## Goal

Third bosses. Three linked Cantor sisters on three islands who must fall together; four images of the Regent, only the real one casting a lantern shadow.

## Context

- Source: `docs/design/13-bestiary.md#bosses`, `#order-to-build-in` (second bosses first).
- Each boss is a `BossDef` module (contract boss-def). Research notes for the split: see `bp-roll`'s brief and `contracts/boss-def.md`.
- Items: `../../COVERAGE.md`, entries with target `bb-choir-regent`.
