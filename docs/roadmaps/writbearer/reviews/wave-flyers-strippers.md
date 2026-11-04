# Wave: flyers, strippers (2026-11-05)

Ran 2 workers: the machine has 8 GB RAM and a load average near 6.

## Ready for the maintainer

- be-flyers: PR #24, fresh review clean (typecheck, lint, 711 tests pass). Outside owned paths: `Template.flies` in `src/content/jobs/types.ts`, one line in `src/sim/mechanics/index.ts`, one call in `src/render/draw/standing.ts`. The first commit ran the formatter on the whole repo (50 unrelated files); the worker restored them. Nits left: an aloft flyer draws two shadows; the landing clock starts on the flyer's first step, so a stunned flyer stays aloft longer (outcome says so). Worker and reviewer about 157k tokens.
- be-strippers: PR #23, fresh review clean after one fix round (typecheck, lint, 710 tests pass). Outside owned paths: one line in `src/content/sets.ts` (a stripped piece does not count toward a set). No AI step and no spawn flag: the stripper reacts to `UnitDamage`, and `markStripper` is the hook for be-monsters-deep. Gaps: party set bonuses refresh only on the next `applySets`; the area-change hook in `areas.ts` is untested because `cross()` needs a full `GameState`. Worker and reviewer about 143k tokens.

The two branches merge with each other and with main without conflicts. On merge, set each node `done` with its `spent`.

## Plan notes

- Rule added to the roadmap `CLAUDE.md`: format only the files you changed. This is the second wave where a worker reformatted the whole repo.
- Inbox: a small `GameState` test harness (stubbed canvas) calling `moveOn`, so area-change hooks can be tested.

## Next

After #23 and #24 merge: be-kidnappers and be-corpse-raisers (both edit `src/sim/ai/monster.ts` and `spawn-steps.ts`; be-flyers adds a step there first).
