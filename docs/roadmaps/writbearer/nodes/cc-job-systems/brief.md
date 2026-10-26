---
id: cc-job-systems
title: Engine systems for the later jobs
status: todo
priority: should
type: feature
outline: true
milestone: combat-core
size: XL
depends_on:
  - on: roster-balance
    kind: hard
    why: edits the sim core (statuses, unit, ai, sim, damage) that the starting-jobs nodes are changing; start once they have merged
---

# Engine systems for the later jobs

## Goal

The shared systems in doc 12's table: party buffs with a duration, fear and curse from skills, knockback, light radius as a stat, a second resource, weapon element buffs, dispel and warning cancel, corpses laid to rest, monsters switching sides for a while, turrets as zones that shoot, a standing-still timer. Also Immovable's knockback immunity.

## Context

- Source: `docs/design/12-new-jobs.md#what-the-engine-needs`
- Items: `../../COVERAGE.md`, entries with target `cc-job-systems`.
