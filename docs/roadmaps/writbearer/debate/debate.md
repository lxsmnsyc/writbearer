---
goal: Decide the Arcanist's shape for the starting-jobs milestone: keep one Arcanist with Fire and Frost (Elemental Sense), or split it into several jobs, each built around one element
date: 2026-11-03
rounds: 2 of 2
status: approved
roadmap: docs/roadmaps/writbearer
supersedes: none
decision: none
---

# Debate: one Arcanist, or one job per element

## Settled structure

1. Keep one Arcanist with Fire and Frost, Elemental Sense and 12 upgrades, as drawn in doc 16 and approved on 2026-10-27. The roster stays at seven starting jobs, and no new design gate is needed. (A1, O8, Q1)
2. The arcanist node builds and tests Elemental Sense first, with three cases in `test/sim/arcanist.test.ts`: a Fire-weak target, a Frost-weak target, and a target weak to neither, which gets Firebolt. If a case cannot pass through `src/sim/elements.ts` and `src/sim/mechanics/damage.ts`, the worker stops and reports. That report triggers the split fallback that GOAL.md already names. (P7, J3)
3. The mj-new-jobs-design brief gets one line. A later one-element job (Frost-only, Storm, and so on) has one element, one signature shape, 4 spells, 1 innate and 12 upgrades of its own. It does not reuse Elemental Sense, so the Arcanist stays the only two-element striker. (P8, amended by the opponent in round 2)

## Budget

- device: not a deciding axis. Both options are TypeScript content modules inside the 10 s fast check. (J9)
- time: no change to the plan. arcanist stays in wave 1 and arcanist-upgrades in wave 2, with no new nodes and no new approval round. (J1, O1, O5)
- tokens: the arcanist and arcanist-upgrades nodes as planned, about 0.8M as an estimate. No job node has closed yet, so there is no calibration. job-registry alone spent 821k. (J5, O2)
- roster readability: one figure with one staff, whose bolt color changes with the target. The user accepted this as one signature shape. (O7, Q1)

## Rejected

- Split into Pyromancer and Cryomancer as starting jobs: about 16 undrawn design items needing a new approval round, 5 strikers among 8 jobs, and about 25 files and briefs to change. The user chose to keep one Arcanist. (P1, P2, P4; O1, O4, O5, Q1)
- Its cost estimate of 1.3M against 0.8M was bounded on an engine node, not a job node. (P3; O2)
- Two jobs sharing a module: it breaks the job model of 4 spells, 1 innate and 12 upgrades. (A3)
- Ship now and split later at a cost of +0.5M: superseded by O8, since doc 16 already sorts every spell and upgrade by element, so a later split moves content rather than redesigning it. (A2; O8)

## Proofs

- None. The engine hooks were already built and tested by job-hooks (J4).

## Prior art

- The proponent cited Dota 2's one-element heroes (Lina, Crystal Maiden) in favor of the split, and rAthena's single Wizard holding every element as the counterexample. Neither side fetched these sources. They are cited from memory and weighed lightly, because neither game uses a job model with 12 upgrades and shard ranks. (P1, O7)

## Open risks

- Elemental Sense may not fit the damage calculation: covered by the guard in item 2, so it would show up in the first hour of the arcanist node. A spike is not needed, since the hooks are built and frozen (J4).
- Later one-element jobs and the Sage overlap. Doc 12's Sage also picks Fire, Frost, Storm or Earth bolts by weakness. This is accepted for now and left to mj-new-jobs-design, because it is not a starting-jobs choice. (P5)

## Inferred choices

- Device does not decide anything (J9): from GOAL.md Verification.
- One staff with a bolt color that changes counts as one silhouette under the minimalist rule (O7): from GOAL.md Constraints and the user's one-shape rule. The user confirmed it through Q1.

## Answers from the user

- Q1, which Arcanist shape: keep one Arcanist as drawn. The split stays the fallback if Elemental Sense breaks, and a Frost-only job can come later through mj-new-jobs-design.

## Overruled

- None.

## Cost of this debate

- 2 of 2 rounds, about 105k tokens.
