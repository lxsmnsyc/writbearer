---
id: mj-monk
title: Monk
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
  - on: cc-resource
    kind: hard
    why: needs the second resource
  - on: cc-el-spectral
    kind: hard
    why: needs the Spectral status and Spectral attacks
---

# Monk

## Goal

The Monk job: themes Spheres, Combos, Stillness (doc 12), drawn as 4 spells, 1 innate passive and 12 elite upgrades as in `docs/design/16-builds.md`, with spirit spheres as a second resource and Spectral attacks.

## Context

- Split when refined into a job node (job, look, spells, innate) and an upgrades node, as the starting jobs did.

- Source: `docs/design/12-new-jobs.md#monk`
- Items: `../../COVERAGE.md`, entries with target `mj-monk`.
