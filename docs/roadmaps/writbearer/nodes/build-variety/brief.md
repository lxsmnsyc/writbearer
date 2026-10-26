---
id: build-variety
title: Choose how mercs build: real skill trees or upgraded fixed spells
status: todo
priority: must
type: docs
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: true
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-10-26
owns:
  - docs/design/16-builds.md
  - docs/roadmaps/writbearer/nodes/build-variety/
shared:
  - docs/design/09-skill-trees.md
  - docs/design/README.md
reserves: []
provides: []
depends_on: []
---

# Choose how mercs build: real skill trees or upgraded fixed spells

## Why

Two mercs of the same job end up alike. The trees in `src/content/trees.ts` are three straight chains of five nodes: each node needs a rank in the one before it in its branch, and nothing crosses branches. The synergies that `docs/design/09-skill-trees.md` describes are not built (no code mentions them). The only limit is the point budget (1 per level, about 24 by level 25, against 63 ranks per job), with no cap per skill beyond rank 5 and no tier gate past `TIER_LEVEL`. The user feels the trees lack real choices and caps.

This decides the shape every job node builds, so it comes before the four new jobs fan out.

## Options to compare

1. **Real trees, rAthena / Diablo 2 style.** Keep 3 branches and points, but add:
   - prerequisites that cross branches and need more than 1 rank (rAthena: "Bowling Bash needs Bash 10 and Two-Hand Quicken 10");
   - Diablo 2 synergies (each rank in one skill strengthens another);
   - caps: per-skill rank caps tied to merc level, and a branch-depth cap so a merc commits to one or two branches.
2. **Fixed spells with upgrades, Aghanim's Labyrinth style.** Throw the trees out. Each job has 4 fixed spells. Rewards between areas offer an upgrade for one spell that heavily changes how it behaves (one of a few per spell, picked from an offer). Each level gives skill shards to raise a chosen spell's power.
3. Any mix the comparison turns up (for example fixed spells plus a small passive tree).

## Work

- Read docs 05, 09 and 12 and `src/content/trees.ts`, `src/ui/skill-tree.tsx`, `src/sim/progress.ts`.
- For each option: how a run plays (when choices happen, how many), how two mercs of one job can differ, what it costs to build for the 3 built jobs and the 4 new ones, what it does to saves, the UI, the AI (mercs cast on their own), recruits arriving with levels, the Town trainer reset, and the rewards between areas.
- Sketch one job (the Vanguard) fully under each option, so the difference is concrete.
- Recommend one, with the numbers to start from (points or shards per level, caps, upgrades per spell).
- Write the result as `docs/design/16-builds.md` and mark what in doc 09 it replaces.

## Acceptance

- `docs/design/16-builds.md` compares the options and recommends one.
- The user picks one at the gate. The orchestrator then updates the job-def contract, the job briefs and the coverage map to match before job-registry starts.
