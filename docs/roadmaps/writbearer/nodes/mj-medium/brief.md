---
id: mj-medium
title: Medium
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
  - on: cc-corpses
    kind: hard
    why: needs laying to rest
  - on: cc-side-switch
    kind: hard
    why: needs side switching (Possess)
  - on: cc-buffs
    kind: hard
    why: needs per-job buffs
  - on: cc-afflictions
    kind: hard
    why: needs fear
  - on: cc-el-spectral
    kind: hard
    why: needs the Spectral status and Spectral attacks
---

# Medium

## Goal

The Medium job: themes Links, Rites, Haunting (doc 12), drawn as 4 spells, 1 innate passive and 12 elite upgrades as in `docs/design/16-builds.md`; Spectral damage, per-job buffs, laying dead mercs to rest, possessing monsters.

## Context

- Split when refined into a job node (job, look, spells, innate) and an upgrades node, as the starting jobs did.

- Source: `docs/design/12-new-jobs.md#medium`
- Items: `../../COVERAGE.md`, entries with target `mj-medium`.
