---
id: builds-design
title: Draw the seven starting jobs as spells and upgrades
status: active
priority: must
type: docs
outline: false
milestone: starting-jobs
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
  - docs/design/16-builds.md
shared:
  - docs/design/09-skill-trees.md
reserves: []
provides: []
depends_on: []
---

# Draw the seven starting jobs as spells and upgrades

## Goal

`docs/design/16-builds.md` draws only the Vanguard under the chosen build model. Draw the other six starting jobs the same way (Ranger, Cleric, Sellsword, Warden, Duelist, Arcanist): for each, 4 spells with what grows per rank (ranks 1 to 10), 1 innate passive, and 12 elite upgrades, 3 per spell, each changing how its spell works. The job nodes build exactly what this doc says.

## Context

- Decisions (GOAL.md): each spell holds one elite upgrade for the run; shards are regular upgrades that stack, 1 per merc level, raising a spell one rank; one innate passive per job; elite upgrades come from the Waystations of phases 2 to 4 and the Mastery road reward; no Auto spend.
- Source skills: `docs/design/09-skill-trees.md`, one section per job, 15 skills each. Use them as the pool: every skill becomes a spell, the innate or an upgrade, or is dropped with a reason. New upgrades are fine where a spell needs a third.
- Pattern: the Vanguard section of doc 16, including "Two Vanguards at the end of a run".
- Per-rank numbers today: the "In the game so far" table in doc 09 (Vanguard, Ranger, Cleric). Halve the per-rank gain for ranks 1 to 10.
- Engine limits: doc 12's "What the engine needs" lists systems that are not built (knockback, fear from skills, turrets and others). Mark any upgrade that needs one, as doc 16 does for Charge.

## Acceptance

- [ ] Doc 16 has a section per job with spells, innate and 12 upgrades, and two example builds per job.
- [ ] Each job's spell order is its cast priority (the AI casts the first spell that wants to); say so per job.
- [ ] Doc 16's "Decisions" section and numbers match GOAL.md.
- [ ] The user approves at the gate.

## Sizing

Six job sections in one doc, from existing skill lists. M.

## Notes for the worker

- Keep the four starting roles readable: a job's 4 spells alone must already play its role (guard, striker, support).
- Elite upgrades should differ in kind, not degree: "hits a line" or "also plants a banner", not "+20%".
