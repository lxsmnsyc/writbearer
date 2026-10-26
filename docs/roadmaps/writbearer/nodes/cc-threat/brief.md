---
id: cc-threat
title: Threat and monster targeting
status: todo
priority: should
type: feature
outline: true
milestone: combat-core
size: L
depends_on:
  - on: targeting-rules
    kind: hard
    why: threat is a CheckTarget listener and changes the monster pick that node rewrites
---

# Threat and monster targeting

## Goal

Monsters choose targets by threat instead of hunt rules alone: damage, healing and taunts add threat, threat decays, and the choice runs through the CheckTarget hook. Taunted stays an override.

## Context

- Source: `docs/design/03-combat-engine.md#threat-and-targeting`
- Items: `../../COVERAGE.md`, entries with target `cc-threat`.
