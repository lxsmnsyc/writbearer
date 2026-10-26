---
id: cc-determinism
title: Determinism and engine performance
status: todo
priority: could
type: feature
outline: true
milestone: combat-core
size: M
depends_on:
  - on: roster-balance
    kind: hard
    why: edits the sim core (statuses, unit, ai, sim, damage) that the starting-jobs nodes are changing; start once they have merged
---

# Determinism and engine performance

## Goal

Trig lookup tables in the simulation, a spatial hash if fights get crowded, and a check that the renderer interpolates between ticks. Moving the simulation to a Web Worker stays parked.

## Context

- Source: `docs/design/02-tech-stack.md#determinism, #world, #simulation`
- Items: `../../COVERAGE.md`, entries with target `cc-determinism`.
