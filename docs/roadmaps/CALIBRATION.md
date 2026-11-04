# Calibration

One line per closed node: date, roadmap/node, estimated against actual size, tokens (`spent:`), one short cause. The planner reads the notes in the decompose phase.

## Notes

- Every node so far landed in its estimated class. Tokens per class in writbearer: S about 125k (1 node), M 135k to 300k (median about 200k), L 215k to 340k, plus one L at 821k (job-registry, a contract node whose spell numbers failed the balance tests).
- A job's 12 elite upgrades cost about 250k to 280k tokens whether sized M or L (6 nodes). Size them L by default.
- A new job (4 spells, an innate, a look) costs about 160k to 200k tokens (M).
- A behavior-preserving split of a 2,000-line file costs about 230k to 340k tokens (L); a 700-line split is M.
- Nodes that touch spell numbers or bosses spend extra on the seed-sensitive boss tests (`test/sim/bosses.test.ts`); budget a balance round.

## Entries

2026-11-03 writbearer/split-job-skills est M actual M, 135400 tokens: moved code; prefer-default-export changed importers
2026-11-03 writbearer/split-game est L actual L, 337600 tokens: moved code only
2026-11-03 writbearer/split-renderer est L actual L, 305700 tokens: also turned prop and hazard if-chains into look tables
2026-11-03 writbearer/split-stage-gen est L actual L, 232600 tokens: moved code, merged five duplicate closures
2026-11-03 writbearer/job-hooks est M actual M, 302300 tokens: six hooks added beyond the draft contract
2026-11-03 writbearer/job-registry est L actual L, 821000 tokens: spells from level 1 failed the boss tests; spell numbers retuned at the gate
2026-11-03 writbearer/warden est M actual M, 168366 tokens: no surprises
2026-11-03 writbearer/duelist est M actual M, 183364 tokens: added spells.ts to break an import cycle
2026-11-03 writbearer/sellsword est M actual M, 159579 tokens: rank-scaled slow needed one status def per rank
2026-11-03 writbearer/arcanist est M actual M, 198184 tokens: switched to ranged to make its spells fire
2026-11-03 writbearer/hidden-units est M actual M, 173970 tokens: refugee spawn edited outside owned paths; kept seeds stable
2026-11-03 writbearer/arcanist-upgrades est L actual L, 216720 tokens: rewrote the "no upgrade built" assertion in jobs.test
2026-11-04 writbearer/duelist-upgrades est L actual L, 257000 tokens: added caps doc 16 lacks (Thousand Cuts, Untouchable)
2026-11-04 writbearer/warden-upgrades est L actual L, 257675 tokens: spells.ts split for no-cycle; Never Surprised needed game-layer hooks
2026-11-04 writbearer/cleric-upgrades est M actual M, 263105 tokens: moved tree skills out of cleric.ts and their old tests
2026-11-04 writbearer/vanguard-upgrades est M actual M, 252458 tokens: Crush kept off doc 16 to pass the boss test
2026-11-04 writbearer/ranger-upgrades est M actual M, 279753 tokens: Charged Arrow kept off doc 16; passive state moved to WeakMaps
2026-11-04 writbearer/mastery-offers est M actual M, 228134 tokens: five small edits outside owned paths (Record<Reward> types, state)
2026-11-04 writbearer/stale-e2e est S actual S, 126625 tokens: both causes were in the tests
