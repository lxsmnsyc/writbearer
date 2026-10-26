---
id: be-monster-types
title: Monster types: flyers, thieves, strippers, raisers
status: todo
priority: should
type: feature
outline: true
milestone: bestiary
size: XL
depends_on:
  - on: hidden-units
    kind: behavior
    via: concealment
  - on: cc-job-systems
    kind: hard
    why: raising and laying to rest share the corpse rules
---

# Monster types: flyers, thieves, strippers, raisers

## Goal

Engine for the enemy types still missing: flyers (melee cannot reach them until they land, Pin Down grounds them), thieves that take an item from the pack and run, strippers that disable an item for the stage, kidnappers, and summoners that raise corpses, with monster corpses kept until the stage ends.

## Context

- Source: `docs/design/13-bestiary.md#what-the-engine-needs, 07-citizen-npcs-enemies.md#enemies`
- Items: `../../COVERAGE.md`, entries with target `be-monster-types`.
