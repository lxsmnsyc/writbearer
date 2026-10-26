---
id: mj-lamplighter
title: Lamplighter
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
    why: needs light radius as a stat
  - on: gs-terrain-lantern
    kind: hard
    why: changes the sim lantern value that node adds
  - on: hidden-units
    kind: behavior
    via: concealment
---

# Lamplighter

## Goal

The Lamplighter job: themes Beacon, Kindling, Wayfinding (doc 12), drawn as 4 spells, 1 innate passive and 12 elite upgrades as in `docs/design/16-builds.md`; changes how far the party sees and blinds monsters.

## Context

- Split when refined into a job node (job, look, spells, innate) and an upgrades node, as the starting jobs did.

- Source: `docs/design/12-new-jobs.md#lamplighter`
- Items: `../../COVERAGE.md`, entries with target `mj-lamplighter`.
