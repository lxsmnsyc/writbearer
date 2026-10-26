# Log: build-variety

- Branch renamed to `docs/build-variety` and fast-forwarded to main (`c59a26a`), since the worktree started before the brief was committed.
- `docs/design/16-builds.md` did not exist. Doing the work.
- Read docs 05, 09, 12, 14 (rewards), `src/content/trees.ts`, `src/ui/skill-tree.tsx`, `src/sim/progress.ts`, `src/sim/skill.ts`, `src/sim/ai.ts` (`useSkill`), `src/game/save.ts`, `src/content/recruits.ts`, `src/content/roster.ts` (`spawnMerc`), `src/content/vanguard.ts`, `src/content/skills.ts`, `src/gen/graph.ts` (`Reward`), the job-def contract and the warden briefs.
- Finding: a Vanguard has 15 nodes and a node needs only 1 rank in the one before. 15 points open every node at rank 1, and a merc has 15 points at level 16, the capstone level. So every merc of a job ends with every skill. This is the main reason two mercs end alike, more than the missing synergies.
- Finding: Fault Line already reads Crush's rank (`faultEarth` in `src/content/vanguard.ts`). That is the one synergy in the code.
- Finding: `useSkill` in `src/sim/ai.ts` casts the first skill, in learn order, that its rule wants. With 8 actives, learn order is a hidden priority list.
- Finding: save version 3 stores `ranks: [id, rank][]` and drops ids it cannot find (`findNode` in `src/game/save.ts`). A new field can be optional.
- Aghanim's Labyrinth facts from web guides (esports.gg, hotspawn.com): after a room the player picks 1 shard from an offer. Normal rooms give minor buffs. Elite and trap rooms give moderate ones. Boss rooms give heavy ones that change an ability. Outposts show the room's reward before the choice.
- Recommendation: option B (four spells, shards, upgrades from offers), with one innate passive per job and the doc 09 nodes reused as the upgrade pool.
