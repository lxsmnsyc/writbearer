---
id: mj-sage
title: Sage
status: todo
priority: should
type: feature
outline: true
milestone: more-jobs
size: XL
depends_on:
  - on: job-registry
    kind: contract
    via: job-def
  - on: cc-job-systems
    kind: hard
    why: needs weapon element buffs, dispel and warning cancel
---

# Sage

## Goal

The Sage job from doc 12: themes Endow, Breaker and Study, drawn as 4 spells, 1 innate passive and 12 elite upgrades as in `docs/design/16-builds.md`, its look and tests. Splits into a job node and an upgrades node when refined, as the starting jobs did.

## Context

- Source: `docs/design/12-new-jobs.md#sage`
- Items: `../../COVERAGE.md`, entries with target `mj-sage`.
