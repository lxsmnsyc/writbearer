---
id: bb-bridge-lantern
title: The Bridge-Warden and the Lantern-Eater
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
  - on: gs-terrain-lantern
    kind: hard
    why: puts out the sim light
  - on: be-monster-types
    kind: hard
    why: the moth is a flyer
---

# The Bridge-Warden and the Lantern-Eater

## Goal

Third bosses. The Bridge-Warden fights on a bridge whose sections fall from the west; the Lantern-Eater, a great moth, puts the light out and dives.

## Context

- Source: `docs/design/13-bestiary.md#bosses`, `#order-to-build-in` (second bosses first).
- Each boss is a `BossDef` module (contract boss-def). Research notes for the split: see `bp-roll`'s brief and `contracts/boss-def.md`.
- Items: `../../COVERAGE.md`, entries with target `bb-bridge-lantern`.
