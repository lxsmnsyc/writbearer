---
milestones: [starting-jobs, combat-core, more-jobs, bestiary, gauntlets-stages, items-economy, story-bearer]
merge:
  mode: maintainer
branches:
---

# Writbearer

## Outcome

The game matches its design notes in `docs/design/`. Every item there is built, or recorded as dropped, in `COVERAGE.md`. The first milestone, starting-jobs, makes the Guild House offer all seven starting jobs of the skill-tree design (Vanguard, Ranger and Cleric plus Sellsword, Warden, Duelist and Arcanist), each with a full set of skills in the build model build-variety picks (today: a tree of 3 branches and 15 skills), from five recruits drawn by slot (a guard, a striker, a support and two more).

## Acceptance

- starting-jobs: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` passes; no node of the four new trees is left "designed, not in the game"; a boss test wins with a party of new jobs.
- Each later milestone: its outline nodes are refined, built and merged, and `COVERAGE.md` shows none of its items open.

## Milestones

In order. Only starting-jobs is broken into briefs; the rest are outline nodes, refined as they come within two waves (`plan.py refine`).

- starting-jobs: the four designed jobs, the job registry, CheckTarget, hidden units, recruits by slot.
- combat-core: threat, cast events and interrupts, autocast, element gaps, engine systems for later jobs, merc autonomy.
- more-jobs: the six jobs of doc 12, the seven outlined jobs, the respec trainer.
- bestiary: monster types, new monsters, mini-bosses, the boss pool and new bosses.
- gauntlets-stages: Hunt and Horde kinds, mutators, Labyrinth, director, node kinds, terrain, phase modifiers, controls.
- items-economy: item model, identification and curses, crafting, cards, bench and contracts, utility items.
- story-bearer: bearer kit, backgrounds, corruption, souls, regalia, clues.

## Priorities

- must: the starting-jobs milestone.
- should: the rest of the designed game.
- could: tuning, polish and side systems (determinism, final numbers, portraits, caravan, loot fixes).
- later: parked (the seven outlined jobs, the Web Worker).

## Constraints

- The simulation stays plain TypeScript with no DOM (`src/sim`, `src/content`). Rendering stays in `src/render`, UI in `src/ui`.
- Saved runs from before a change must still load (`src/game/save.ts`).
- Numbers are first guesses; balance only has to pass the tests until cc-tuning.
- Figures follow the minimalist rule: one large signature shape per unit, readable at 384×216.

## Non-goals

- Meta progression or unlocks between runs (decided in doc 01).
- Durability (decided in doc 06).

## Verification

- Fast check (safe to run in parallel worktrees): `pnpm typecheck && pnpm lint && pnpm test` (about 10 s).
- Full check (after merging, at checkpoints): `pnpm test:e2e` (a few minutes). It starts a dev server on fixed port 5199, so only one copy can run at a time: nodes that run it carry `exclusive: [e2e-port]`.
- The repo is public and has no GitHub Actions workflows: run checks locally.

## Shared files

`plan.py` warns about files that many detailed nodes edit: `src/gen/stage.ts` and `src/render/renderer.ts` (9 nodes each), `src/sim/ai.ts` (8), `src/sim/sim.ts` (7), `src/game/game.ts` (6), and four or five each for `roster.ts`, `events.ts`, `statuses.ts`, `unit.ts`, `floor.ts`, `zones.ts`, `ground.ts`, `game/stage.ts`. Most edits are small hooks or appended rows, and the nodes touching the same file are spread across waves, so they are not split first. Merge in the order `plan.py status` prints. `gen/stage.ts`, `renderer.ts`, `ai.ts` and `game.ts` are each over 2,000 lines, so a behavior-preserving split of one of them is the first fix if merges start to conflict.

## Numbered resources

- None. No migrations or numbered decision records in this repo.

## Sources

- `docs/design/01` to `15`.

## Coverage

`COVERAGE.md` maps every item of the design notes to a node id, to code already built, to "not code", or to "dropped". It also lists where the notes and the code disagree.

## Decisions

- The Guild House offers five recruits at the start of a run, drawn by slot; the player hires up to four (roster-balance).

## Open questions

- Build model: keep skill trees and make them real (rAthena / Diablo 2 prerequisites, synergies, caps), or switch to 4 fixed spells with behavior-changing upgrades and skill shards (Aghanim's Labyrinth)? Decided at the build-variety gate. Blocks job-registry and so every job node; the job briefs are rewritten to match.
- Recruiting after the Guild House (taverns in phases 1 and 2, as doc 05 says) or Guild-only, as now? Blocks ie-party only.

## Gates

- build-variety: the user picks the build model before job-registry starts.
- job-registry: review the job-def contract before the job nodes fan out.
- roster-balance: play a run with the new offers before closing starting-jobs.
- Every milestone end: review the refined briefs of the next milestone before its first wave.
