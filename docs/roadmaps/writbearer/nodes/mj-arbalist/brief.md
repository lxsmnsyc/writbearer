---
id: mj-arbalist
title: Arbalist
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
    why: needs knockback, turrets and the standing-still timer
---

# Arbalist

## Goal

The Arbalist job: themes Siege, Marksman, Overwatch (doc 12), drawn as 4 spells, 1 innate passive and 12 elite upgrades as in `docs/design/16-builds.md`, planted ranged damage that grows the longer it stands still.

## Context

- Split when refined into a job node (job, look, spells, innate) and an upgrades node, as the starting jobs did.

- Source: `docs/design/12-new-jobs.md#arbalist`
- Items: `../../COVERAGE.md`, entries with target `mj-arbalist`.
