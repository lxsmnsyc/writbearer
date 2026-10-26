# Outcome: build-variety

## Built

- `docs/design/16-builds.md`: what is wrong with the trees today, how Diablo 2, rAthena and Aghanim's Labyrinth do builds, options A (real trees), B (four spells with upgrades) and C (four spells plus a small passive tree), a cost table grounded in file paths, the Vanguard sketched fully under A and B, how to keep choices for 4 mercs from becoming a chore, a recommendation with starting numbers, and what it replaces in doc 09.
- `docs/design/09-skill-trees.md`: a note at the top pointing to doc 16 and naming the parts it would replace under each choice.
- `docs/design/README.md`: line 16 for the new doc.

## Recommendation

- Option B: each job has 4 spells known from level 1, 1 innate passive, and 12 upgrades (3 per spell). A spell holds 1 upgrade for the run.
- Shards: 1 per level. Ranks 1 to 10, capped at 1 + floor(level / 2). About 24 shards against 36 to max all 4, so a merc maxes 2. Per-rank gains are half of today's.
- Upgrades come as 1 pick of 3 cards. Each living merc picks one at the Waystations of phases 2 to 4. A new Mastery road reward gives 1 pick of 3 cards, each for a different merc.
- Doc 09's nodes become the upgrade pool. For the Vanguard all 15 nodes are reused and 2 upgrades are new.
- Fallback if the cost is too high now: option A, where a node needs 3 ranks in the node before it and a rank cap of level − tier level + 1 applies. One branch to its capstone costs 13 of the 24 points, so a merc gets one capstone. This adds no variety between runs.

## Questions for the gate

- A, B or C?
- Under B, can a spell hold 2 upgrades instead of 1?
- Under B, are shards per merc level, or a party pool from area clears?
- Under B, one innate passive per job, or none?
- Under B, are the upgrade sources right: Waystations of phases 2 to 4 and a Mastery road reward?
- Should Auto spend (points or shards spent by a rule the player sets) be on by default?

## What changes in the job-def contract and the job briefs

Under option A:

- `TreeNode` gains `requires?: { id: string; rank: number }[]` and `synergies?: { from: string; per: number }[]`. `cannotLearn` checks requires and the rank cap.
- Contract test: every `requires` and `synergies` id resolves to a node of the same job.
- The 12 starting-jobs job briefs keep their shape. Each branch brief gains a line listing its prerequisites and synergies, taken from a per-job table like the Vanguard's in doc 16.
- A small node before job-registry builds the rules, the UI cap display and `test/support/build.ts`. The Vanguard, Ranger and Cleric get their data.
- Saves do not change.

Under option B:

- `JobDef.tree: Branch[]` is replaced by `spells: [Skill, Skill, Skill, Skill]`, `innate: Passive` with its text, and `upgrades: Upgrade[]`.
- `Upgrade` is `{ id, spell, name, describe, patch?: Partial<Skill>, effect?: Passive }`. The spell a merc casts is `{ ...base, ...patch }`.
- Files per job become `jobs/<kind>/index.ts` (template, spells, innate) and `jobs/<kind>/upgrades.ts`, instead of three branch files.
- Contract test: 4 spells, 12 upgrades, 3 per spell, each upgrade names one of the job's spells.
- The 12 job briefs become 8: per job, one node for the job, its spells and innate passive, and one for its 12 upgrades. Each needs a design pass of doc 09's tree first.
- Two nodes come before job-registry: build-rules (types, `Unit.upgrades` and shards, save fields with tree ranks refunded as shards, the 4-row panel replacing `src/ui/skill-tree.tsx`) and mastery-offers (the `mastery` reward in `src/gen/graph.ts`, the 3-card offer screen, Waystation offers).
- The Vanguard, Ranger and Cleric are reshaped in a node of their own.
- mj-trainer-synergies shrinks to a shard reset. The six jobs of doc 12 are written as spells and upgrades when refined.
- COVERAGE.md: doc 09 Rules items move to the new nodes. The synergy items are dropped.

## Deviations

- The worktree started before the brief's commit. The branch was fast-forwarded to main (`c59a26a`) before work began.

## Stubs left

- None. This node writes no code.

## Gotchas

- `useSkill` in `src/sim/ai.ts` casts the first wanted skill in learn order. Under A this stays a hidden priority. Under B the spell order in `JobDef.spells` is the priority.
- Charge (a Vanguard upgrade under B) pushes enemies aside, which needs knockback. Doc 12 lists knockback as a shared engine system that is not built.
- The Aghanim's Labyrinth facts come from player guides, which differ between the 2020 and later versions of the event.

## Proposed learnings

- None.

## Verification

- `check_prose.py` on doc 16 and the log. Remaining hits are game terms (synergy, magic, unlocks) that docs 01 and 09 already use.
- No code changed, so `pnpm lint` was not run.

## Size

- Estimated M, actual M.
