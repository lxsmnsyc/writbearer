---
id: build-rules
title: Spells, shards and elite upgrades: the rules and the spell panel
status: done
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: L
spike: false
verify: pnpm vitest run test/sim/builds.test.ts && pnpm vitest run test/sim/save.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - src/sim/builds.ts
  - src/ui/spell-panel.tsx
  - test/sim/builds.test.ts
  - test/support/build.ts
shared:
  - src/sim/unit.ts
  - src/sim/progress.ts
  - src/sim/ai.ts
  - src/game/save.ts
  - src/ui/merc-panel.tsx
  - src/ui/app.tsx
  - test/sim/save.test.ts
reserves: []
provides: [builds]
depends_on: []
---

# Spells, shards and elite upgrades: the rules and the spell panel

## Goal

Build the rules of the build model in `docs/design/16-builds.md` and freeze the builds contract, so job-registry and the job nodes build on them. Add the spell panel. The old tree path keeps working beside it until job-registry moves every job over and removes it.

## Context

- Contract: `contracts/builds.md` (types, functions, save fields, contract tests).
- Today: `cannotLearn` and `learn` in `src/content/trees.ts`, `unit.skillPoints` and `unit.skillRanks` (`src/sim/unit.ts`), points from `src/sim/progress.ts`, the panel in `src/ui/skill-tree.tsx` opened from `src/ui/merc-panel.tsx`, ranks saved as `ranks` in `src/game/save.ts`.
- The AI casts the first skill in `unit.skills` that its rule wants (`useSkill` in `src/sim/ai.ts`). Under the new model the order is the job's spell order.

## Steps

- [ ] `src/sim/builds.ts`: the types and functions of the contract.
- [ ] `Unit` gains `spells`, `shards` and `upgrades`; a level gives 1 shard instead of 1 skill point to a unit that has spells.
- [ ] Rank cap `1 + floor(level / 2)`, ranks 1 to 10.
- [ ] Saves: optional `shards` and `upgrades` per merc. On load, a merc of a job with spells that still has tree ranks gets them back as shards. `SAVE_VERSION` stays 3.
- [ ] `src/ui/spell-panel.tsx`: 4 rows, each with rank, cap, a + button, the elite upgrade it holds and the per-skill order. The merc panel shows it for units with spells and the old tree otherwise. A merc with shards to spend shows a + on its party card, as points do now.
- [ ] `test/support/build.ts` gains helpers to give a unit spells, ranks and upgrades.

## Acceptance

- [ ] The contract tests in `contracts/builds.md` pass, in `test/sim/builds.test.ts`.
- [ ] Old saves load: a test loads a save with tree ranks and checks the refund.
- [ ] Every existing test still passes.
- [ ] Fast check passes.
- [ ] The outcome has the final shape for `contracts/builds.md`.

## Sizing

New rules, save fields and one panel; the old path stays. L.

## Notes for the worker

- No Auto spend: the player spends shards by hand.
- Do not move any job or skill; that is job-registry.
- Stat points are unchanged.
