---
milestones: [starting-jobs, combat-core, more-jobs, bestiary, gauntlets-stages, items-economy, story-bearer]
merge:
  mode: maintainer
branches:
---

# Writbearer

## Outcome

The game matches its design notes in `docs/design/`. Every item there is built, or recorded as dropped, in `COVERAGE.md`. The first milestone, starting-jobs, moves mercs to the build model of `docs/design/16-builds.md` (4 spells, 1 innate passive and 12 elite upgrades per job, shards to raise spell ranks) and makes the Guild House offer all seven starting jobs (Vanguard, Ranger and Cleric plus Sellsword, Warden, Duelist and Arcanist), each complete in that model, from five recruits drawn by slot (a guard, a striker, a support and two more).

## Acceptance

- starting-jobs: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` passes; no spell or upgrade of the seven starting jobs is left "designed, not in the game"; a run offers elite upgrades at the Waystations and on Mastery roads; a boss test wins with a party of new jobs.
- Each later milestone: its outline nodes are refined, built and merged, and `COVERAGE.md` shows none of its items open.

## Milestones

In order. Only starting-jobs is broken into briefs; the rest are outline nodes, refined as they come within two waves (`plan.py refine`).

- starting-jobs: the build model (rules, offers, the seven jobs drawn as spells and upgrades), the four designed jobs, the job registry, CheckTarget, hidden units, recruits by slot.
- combat-core: threat, cast events and interrupts, autocast, element gaps, engine systems for later jobs, merc autonomy.
- more-jobs: the six jobs of doc 12, new jobs beyond docs 09 and 12 (designed in mj-new-jobs-design), the seven outlined jobs, the shard trainer.
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
- The repo is public. Its only GitHub Actions workflow is `release.yml`, which versions and tags releases. No workflow runs the checks, so run them locally.
- Releases use Changesets (`.changeset/`). Every pull request that changes the game adds a changeset (`pnpm cs:add`); roadmap and design doc changes do not.

## Shared files

`plan.py` warns about files that many detailed nodes edit. The job and upgrade nodes of starting-jobs no longer edit core simulation files. `job-hooks` adds the hooks they need first (`contracts/job-hooks.md`). Each job's spells, passives and statuses live in its own module. Most of the remaining overlap is the terrain and boss nodes of later milestones. They edit `src/gen/stage.ts` (2,251 lines), `src/render/renderer.ts` (2,178 lines) and `src/game/game.ts` (2,651 lines). Those nodes are spread across waves, so they are not split first. Merge in the order `plan.py status` prints, and split one of those three by feature in a behavior-preserving node if merges start to conflict.

## Numbered resources

- None. No migrations or numbered decision records in this repo.

## Sources

- `docs/design/01` to `15`.

## Coverage

`COVERAGE.md` maps every item of the design notes to a node id, to code already built, to "not code", or to "dropped". It also lists where the notes and the code disagree.

## Decisions

- The Guild House offers five recruits at the start of a run, drawn by slot; the player hires up to four (roster-balance).
- Build model B of `docs/design/16-builds.md` (build-variety, 2026-10-27), as in Aghanim's Labyrinth: each job has 4 spells known from level 1 and 1 innate passive. Each spell holds one elite upgrade, which changes how it works, kept for the run. Shards are the regular upgrades: they stack, 1 per merc level, each raising one spell a rank (1 to 10, capped at 1 + level / 2). Elite upgrades come from the Waystations of phases 2 to 4 and a Mastery road reward. No Auto spend: the player spends by hand. Doc 09's trees become the pool for spells and upgrades; synergies are dropped.
- Clearing groups (2026-10-27): every job can help clear a pack, but for the Duelist and the Warden only through an elite upgrade. Doc 16 gives every spell a mana cost and a cooldown, and roster-balance measures what each job's spells add over basic attacks.
- More jobs: since a job is cheaper to make in this model, design new jobs beyond docs 09 and 12 (mj-new-jobs-design).

## Open questions

- Shards per merc level, or a party pool? Per merc level for now. Revisit if levels move to stage clears (one level per cleared stage). Blocks nothing.
- Recruiting after the Guild House (taverns in phases 1 and 2, as doc 05 says) or Guild-only, as now? Blocks ie-party only.

## Gates

- builds-design: the user approves the seven jobs' spells and upgrades before job-registry starts.
- job-registry: review the job-def contract before the job nodes fan out.
- roster-balance: play a run with the new offers before closing starting-jobs.
- mj-new-jobs-design: the user picks which new jobs enter the plan.
- Every milestone end: review the refined briefs of the next milestone before its first wave.
