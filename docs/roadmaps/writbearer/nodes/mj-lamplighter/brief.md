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

The Lamplighter job: Beacon, Kindling, Wayfinding branches; changes how far the party sees and blinds monsters.

## Context

- Source: `docs/design/12-new-jobs.md#lamplighter`
- Items: `../../COVERAGE.md`, entries with target `mj-lamplighter`.
