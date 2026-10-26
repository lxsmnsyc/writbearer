---
id: cc-autonomy
title: Merc autonomy gaps
status: todo
priority: should
type: feature
outline: true
milestone: combat-core
size: L
depends_on:
  - on: targeting-rules
    kind: hard
    why: behavior flags and stances change the merc think loop that node rewrites
---

# Merc autonomy gaps

## Goal

Skirmish stance, holding a marked spot, behavior flags (no friendly fire near allies, retreat at low health, pick up loot), Discipline effect 2 (traits against toggles, with the chance shown on the sheet), Drill at Camps, a utility score for movement, the Drunkard and Hates-a-job traits, and the morale events still unchecked.

## Context

- Source: `docs/design/05-mercenaries.md#autonomy, #discipline, #morale`
- Items: `../../COVERAGE.md`, entries with target `cc-autonomy`.
