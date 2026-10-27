---
id: job-hooks
title: Engine hooks for the four new jobs
status: todo
priority: must
type: feature
outline: false
milestone: starting-jobs
target:
from:
size: M
spike: false
verify: pnpm vitest run test/sim/job-hooks.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-10-27
owns:
  - test/sim/job-hooks.test.ts
shared:
  - src/sim/skill.ts
  - src/sim/status.ts
  - src/sim/statuses.ts
  - src/sim/events.ts
  - src/sim/nav.ts
  - src/sim/ai.ts
  - src/sim/sim.ts
  - src/sim/mechanics/zones.ts
  - src/content/skills.ts
  - src/ui/merc-panel.tsx
reserves: []
provides: [job-hooks]
depends_on:
  - on: builds-design
    kind: hard
    why: doc 16 decides which skills of doc 09 become spells and upgrades, so which hooks are needed at all
  - on: targeting-rules
    kind: hard
    why: CheckChase and the new target priority go into thinkMerc and pick, which targeting-rules rewrites
---

# Engine hooks for the four new jobs

## Goal

Add the engine hooks in `contracts/job-hooks.md`, so the Sellsword, Warden, Duelist and Arcanist nodes and their upgrade nodes build everything in their own modules and edit no core simulation file. Add only the hooks that the spells and upgrades drawn in `docs/design/16-builds.md` need.

## Context

- The engine already runs on events with priorities (`sim.on` in `src/sim/mechanics/damage.ts` and `hit.ts`); passives attach listeners in `Passive.setup` (`src/sim/skill.ts`).
- The hooks come from the job briefs' notes: Inferno (friendly fire), Glacial Wall (blocked tiles), Elemental Sense (target priority), Tether (chase), Cover (projectiles), Blind (Sellsword, reused by Lamplighter and monsters), Cutpurse (buff flag), Veteran of Many Wars (bonus ranks).
- Toggles and chase: `src/sim/ai.ts` near line 177. Projectile flight: `flyHoming` and `flyStraight` in `src/sim/sim.ts`.

## Steps

- [ ] Read the Sellsword, Warden, Duelist and Arcanist sections of doc 16. Drop each hook of the contract that no spell or upgrade there uses, and add any core hook that is missing.
- [ ] Build each hook with a test that attaches a listener made in the test.
- [ ] Write the final shape into your outcome so the orchestrator can freeze `contracts/job-hooks.md`.

## Acceptance

- [ ] Each hook in the outcome has a test in `test/sim/job-hooks.test.ts`.
- [ ] No existing test changes.
- [ ] Fast check passes.

## Sizing

About eight small hooks across core files, each with a test, no job content. M.

## Notes for the worker

- Do not build any spell, upgrade or job status here. Warden's Marked, for example, stays in the Warden's module.
- Keep `src/game/save.ts` loading old saves. None of these hooks should need a save field.
