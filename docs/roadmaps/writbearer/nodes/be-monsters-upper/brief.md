---
id: be-monsters-upper
title: New monsters of the Marches and the Rift Road
status: todo
priority: should
type: feature
outline: true
milestone: bestiary
size: L
depends_on:
  - on: be-flyers
    kind: hard
    why: moths and vultures are flyers
  - on: be-kidnappers
    kind: hard
    why: the Chain Warden's hook and drag is built on src/sim/grab.ts
---

# New monsters of the Marches and the Rift Road

## Goal

Carrion Moth, Drowned Wailer, Chain Warden and Rift Vulture, with looks, compendium entries and cards, in the layer spawn tables.

## Context

- Source: `docs/design/13-bestiary.md#the-marches, #the-rift-road`
- Items: `../../COVERAGE.md`, entries with target `be-monsters-upper`.
- The Chain Warden is this node's, not be-deep-*'s (the be-kidnappers notes said be-monsters-deep; COVERAGE targets it here). It decides how a held bearer is controlled.
- The Drowned Wailer goes in `src/content/monsters/drowned.ts`, which be-deep-dread creates for the Drowned Bell; whichever lands second appends. The Carrion Moth may reuse the crawler wings be-deep-moth draws, and its dimming uses gs-terrain-lantern like the Crown-Moth.
