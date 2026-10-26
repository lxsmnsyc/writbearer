---
id: roster-balance
title: Recruits by slot, balance, and design notes
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm test && pnpm test:e2e
exclusive: [e2e-port]
fulfilled_by:
gate: true
added:
owns:
  - src/content/recruits.ts
  - src/ui/offer.tsx
  - src/content/jobs/sellsword/index.ts
  - src/content/jobs/warden/index.ts
  - src/content/jobs/duelist/index.ts
  - src/content/jobs/arcanist/index.ts
  - test/sim/recruits.test.ts
  - test/sim/bosses.test.ts
  - test/gen/balance.test.ts
  - e2e/recruit.spec.ts
  - docs/design/09-skill-trees.md
  - docs/design/05-mercenaries.md
  - docs/design/12-new-jobs.md
  - docs/design/README.md
shared: []
reserves: []
provides: []
depends_on:
  - on: sellsword
    kind: hard
    why: balances and documents the finished jobs
  - on: sellsword-upgrades
    kind: hard
    why: balances and documents the finished jobs
  - on: warden
    kind: hard
    why: balances and documents the finished jobs
  - on: warden-upgrades
    kind: hard
    why: balances and documents the finished jobs
  - on: duelist
    kind: hard
    why: balances and documents the finished jobs
  - on: duelist-upgrades
    kind: hard
    why: balances and documents the finished jobs
  - on: arcanist
    kind: hard
    why: balances and documents the finished jobs
  - on: arcanist-upgrades
    kind: hard
    why: balances and documents the finished jobs
  - on: vanguard-upgrades
    kind: hard
    why: balances and documents the finished jobs
  - on: ranger-upgrades
    kind: hard
    why: balances and documents the finished jobs
  - on: cleric-upgrades
    kind: hard
    why: balances and documents the finished jobs
  - on: mastery-offers
    kind: hard
    why: balances and documents the finished jobs
---

# Recruits by slot, balance, and design notes

## Goal

Offer five Guild House recruits at the start of a run, drawn by slot (a guard, a striker, a support, and two more from any job; no two share a job; at least one fighter). The player still hires a party of up to four from them, the first free and the rest for their wage. Tune first numbers so the new jobs pass the boss tests, and bring the design notes up to date.

## Context

- Source: `docs/design/12-new-jobs.md#starting-offers`; recruit draw in `src/content/recruits.ts`.
- Boss balance: `test/sim/bosses.test.ts` (three mercs win at least 5 of 6 seeds).
- Decided by the user: five offers at the start (GOAL.md). The e2e spec `e2e/recruit.spec.ts` expects four today.

## Steps

- [ ] Set `hireable: true` on the four new jobs.
- [ ] Recruit draw by role from the job registry.
- [ ] Boss and balance tests over parties that include each new job.
- [ ] Make the deserter Event and endless mode's wandering mercs draw from every hireable job.
- [ ] Update doc 12's starting offers table to five recruits (two of them any job), 'In the game so far' in doc 09 (also drop its stale 'no monster shoots yet'), the job list and starting recruits in doc 05 (#party-size), and the doc 12 roster table.

## Acceptance

- [ ] Over 200 seeds, every draw has five recruits: a guard, a striker, a support, five different jobs, and a fighter.
- [ ] The player can hire at most four of the five; the fifth stays at the Guild House.
- [ ] A party of Warden, Duelist and Arcanist wins the boss test as often as Vanguard, Ranger and Cleric.
- [ ] `pnpm test:e2e` passes.

## Sizing

Small code, many tests and doc edits; tuning may take a few rounds. M.

## Notes for the worker

- Tune numbers in the job modules only where a boss test fails; record each change in the outcome.
