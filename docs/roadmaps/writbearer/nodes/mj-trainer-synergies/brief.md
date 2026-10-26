---
id: mj-trainer-synergies
title: Shard trainer and Consecrate's rest
status: todo
priority: should
type: feature
outline: true
milestone: more-jobs
size: M
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: cc-job-systems
    kind: hard
    why: Consecrate needs corpses laid to rest
---

# Shard trainer and Consecrate's rest

## Goal

A Town trainer that resets a merc's spent shards for gold (half its wage); elite upgrades stay. Consecrate's 'corpses inside cannot be raised', if Consecrate is still a Cleric spell or upgrade in `docs/design/16-builds.md`. Synergies were dropped at the build-variety gate.

## Context

- Source: `docs/design/09-skill-trees.md#rules, #cleric`
- Items: `../../COVERAGE.md`, entries with target `mj-trainer-synergies`.
