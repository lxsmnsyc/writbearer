# Wave: thieves, corpses, concealment timeout (2026-11-05)

Ran 3 workers, not 4: the machine has 8 GB RAM and a load average near 7.

## Landed

- concealment-timeout: direct commit c7591ef. The Escort test runs 200 seeds and checks determinism on every fourth one; the rate band is unchanged. A fresh review proved it: two concurrent full `pnpm test` runs time out on the base and pass on the branch. Spent about 81k tokens.

## Waiting for the maintainer

- cc-corpses: PR #21, fresh review clean. Outside owned paths: `src/game/save.ts` (optional `rested` field) and `src/game/town.ts` (Temple raise check). Nits left: no save round trip test for `rested`; the Respite `revive(1)` now skips rested mercs. Worker, reviewer about 117k tokens.
- be-thieves: PR #22, fresh review should-fix, fixed in 5ef53b7 (Hunt objective test, comment placement). Outside owned paths: `Template.thief` in `src/content/jobs/types.ts`. Worker, reviewer about 142k tokens before the fix round.

Both PRs are still drafts. The tool permissions block the orchestrator from `gh pr ready` and `gh pr comment` as well as merging. On merge, set each node `done` with its `spent`.

## Plan notes

- Follow-up for cc-corpses: the Cleric's target search, Martyr, the Choir in `sets.ts` and mutators filter dead bodies themselves and can pick a rested one and waste the cast.
- be-monsters-deep: the thief limit is one theft per thief unit; add an area-keyed guard when the Tithe-Taker lands.

## Next

`plan.py ready` lists be-flyers and be-strippers first. Both share `src/sim/ai/monster.ts` and `spawn-steps.ts` with be-thieves; start them after PR #22 merges to avoid conflicts.
