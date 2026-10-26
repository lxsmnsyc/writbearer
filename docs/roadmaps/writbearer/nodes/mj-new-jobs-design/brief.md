---
id: mj-new-jobs-design
title: Design more jobs in the spells-and-upgrades shape
status: todo
priority: should
type: docs
outline: false
milestone: more-jobs
target:
from:
size: M
spike: false
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-10-27
owns:
  - docs/design/17-more-jobs.md
shared:
  - docs/design/README.md
reserves: []
provides: []
depends_on:
  - on: builds-design
    kind: hard
    why: new jobs follow the job shape and style that node settles
---

# Design more jobs in the spells-and-upgrades shape

## Goal

Under the build model a job is 4 spells, 1 innate passive and 12 elite upgrades, which is much less to build than a tree of 15. Use that to widen the roster beyond the 13 jobs in docs 09 and 12: propose new jobs in `docs/design/17-more-jobs.md`, each drawn in full in the shape of doc 16.

## Context

- The 7 starting jobs: `docs/design/16-builds.md`. The 6 planned jobs: `docs/design/12-new-jobs.md`. The 7 outlined jobs: `docs/design/09-skill-trees.md#other-jobs`.
- The rules every new job follows: doc 12, "Rules every new job follows" (one signature shape, a role, a reason to hire it over the others).
- Lore and setting: `docs/design/10-lore.md`.

## Acceptance

- [ ] Doc 17 proposes new jobs, each with a role, a signature shape, 4 spells, an innate and 12 upgrades, and what it adds that no other job does.
- [ ] Each job lists the engine systems it needs that are not built.
- [ ] A table places every job (starting, planned, outlined, new) by role and theme, so gaps and overlaps show.
- [ ] The user picks which ones enter the plan at the gate; each picked job becomes a node in more-jobs.

## Sizing

Design only. M.

## Notes for the worker

- Prefer jobs that use systems the game already has or that several jobs share.
