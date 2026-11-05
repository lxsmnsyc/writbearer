# Wave: kidnappers, corpse raisers (2026-11-05)

Ran 2 workers: the machine has 8 GB RAM.

## Waiting on the maintainer (PRs #25, #26)

`can-merge` sends both to the maintainer: each changes one file outside its owned paths besides its changeset.

- be-kidnappers: PR #25, fresh review clean on the first round (typecheck, lint, 726 tests, e2e 25 of 25). Outside owned paths: `Template.kidnapper` in `src/content/jobs/types.ts` (as be-thieves did). The AI does not read stance; a Guard merc in the lane is fought like any foe. `objective.ts` needed no change. About 132k tokens.
- be-corpse-raisers: PR #26, one should-fix round. The review found raised units did not count toward a Horde or Hunt; the fix adds a private `crowd()` in `src/game/objective.ts` (units that came plus what they raised) and copies the raiser's Hunt mark onto the raised unit. Corpses were already kept and drawn, so no `death.ts` or render change. No `Template` flag, no spawn step and the skill lives in `src/sim/ai/raiser.ts`: no game monster raises yet (see inbox). About 169k tokens.

Expect a trivial conflict between the two in `src/sim/ai/monster.ts` and `src/content/monsters/spawn-steps.ts`: keep both entries. Merge one, then update the other branch from main.

Both nodes stay active until their PRs merge.

## Plan notes

- Inbox: the first raiser monster wires `markRaiser`; a flaky unit test seen once.
- be-monsters-deep is the next outline to refine; both its bestiary inputs (kidnappers, raisers) land with these PRs.
