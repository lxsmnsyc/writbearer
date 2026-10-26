---
id: mj-berserker
title: Berserker
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
    why: needs party buffs and fear
---

# Berserker

## Goal

The Berserker job: themes Warcries, Fury, Hide (doc 12), drawn as 4 spells, 1 innate passive and 12 elite upgrades as in `docs/design/16-builds.md`, area melee that loses Discipline as it rages.

## Context

- Split when refined into a job node (job, look, spells, innate) and an upgrades node, as the starting jobs did.

- Source: `docs/design/12-new-jobs.md#berserker`
- Items: `../../COVERAGE.md`, entries with target `mj-berserker`.
