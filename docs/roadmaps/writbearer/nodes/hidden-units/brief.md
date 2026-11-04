---
id: hidden-units
title: Hidden and disguised units
status: done
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
spent: 173970
size: M
spike: false
verify: pnpm vitest run test/sim/concealment.test.ts
exclusive: []
fulfilled_by:
gate: false
added:
owns:
  - src/sim/concealment.ts
  - test/sim/concealment.test.ts
shared:
  - src/sim/unit.ts
  - src/sim/events.ts
  - src/sim/ai.ts
  - src/sim/sim.ts
  - src/sim/mechanics/index.ts
  - src/render/view.ts
  - src/render/draw/figures.ts
  - src/render/draw/standing.ts
  - src/game/objective.ts
  - src/content/roster.ts
reserves: []
provides: [concealment]
depends_on:
  - on: targeting-rules
    kind: hard
    why: forbids hidden units through CheckTarget listeners, which need the event
  - on: job-registry
    kind: hard
    why: edits spawnRefugee and the assassin monsters in roster.ts, which job-registry rewrites
  - on: split-renderer
    kind: hard
    why: moves renderer.ts features into modules under src/render/draw/; this node edits the moved code
---

# Hidden and disguised units

## Goal

Add hidden and disguised units as in the concealment contract, and use them in one place in the game so the Warden's Watchman skills have something to find: in Escort fights, one refugee may be a disguised assassin that turns on the bearer.

## Context

- The assassin refugee exists only as an Event text today (`src/content/events.ts`); Escort is in `src/game/objective.ts`, refugees spawn through `spawnRefugee` in `src/content/roster.ts`.
- Monsters with `Hunt.Assassin` already go for the bearer (`src/sim/ai.ts`).
- Source: `docs/design/07-citizen-npcs-enemies.md#npcs` (disguised assassin), `12-new-jobs.md#what-the-engine-needs` (hidden monsters).

## Acceptance

- [x] Mercs ignore a hidden monster until it attacks or is revealed.
- [x] A disguised assassin in an Escort is drawn and listed as a refugee until it strikes.
- [x] Fast check passes.

## Sizing

Sim plus a little render and objective work; known patterns. M.

## Notes for the worker

- Keep the disguised assassin rare (for example one Escort in four) and seeded from the existing stage streams.
- Gate what is drawn in `seen()` (`src/render/draw/figures.ts`): it covers figures, bars, glows, labels and quarry arrows. `drawStanding` in `src/render/draw/standing.ts` picks what each unit is drawn as.
