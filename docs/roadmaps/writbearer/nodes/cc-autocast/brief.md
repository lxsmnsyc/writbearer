---
id: cc-autocast
title: Autocast cards
status: todo
priority: should
type: feature
outline: true
milestone: combat-core
size: L
depends_on:
  - on: cc-cast-events
    kind: hard
    why: autocast fires through UnitTriggerSkill, which that node adds
---

# Autocast cards

## Goal

Cards and items that cast a skill on attack or when hit, with PRD chance, loop safety through UnitTriggerSkill, per-skill toggles for granted skills, and mana or health gain on hit and kill.

## Context

- Source: `docs/design/06-items-inventory.md#cards, 03-combat-engine.md#mana`
- Items: `../../COVERAGE.md`, entries with target `cc-autocast`.
