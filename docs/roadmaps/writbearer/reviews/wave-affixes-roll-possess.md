# Wave: late affixes, boss pool, mind control (2026-11-05)

Ran 3 workers. All three PRs merged by the orchestrator after clean fresh reviews; each was checked on main plus the PR before merging (typecheck, lint, tests, e2e 25 of 25).

## Merged (PRs #33, #34, #35)

- be-affixes: PR #33, one fix round. The review was clean, but the worker had built the Horn of the Road's Teleport as a blink beside the bearer, not "from post to post" as doc 13 and the brief say. The orchestrator sent it back: the Horn now blinks to the next standing post with a 0.8 s warning. Stage snapshot regenerated (three more `AFFIXES` entries shift the roll). The worker left no outcome file; the orchestrator wrote it from the reports. About 218k tokens.
- bp-roll: PR #34, one fix round. Fresh review clean, but the orchestrator's e2e run failed `e2e/map.spec.ts` (the boss node now shows the boss name). Fixed to "Area 8: The Brood Mother". boss-def frozen at v2 to match the code: `Template` from `MONSTERS`, `ItemBase` card, `BestiaryEntry`, no `field` yet, `resolveBoss` exported. About 296k tokens.
- bp-possess: PR #35, one fix round. The review found a hired merc lost for good if the stage changed or the run saved during control (`carryParty` and the save keep only `Side.Party`). Fix: `freeControlled(sim)` before both, with tests. Two edits outside owned paths: one condition in the Cleric's Cleanse, a `StatusDef.hostile` flag. About 376k tokens.

## Plan notes

- bp-ground brief: add `BossDef.field` and wire `arena`. bb-bishop-usurper brief: notes on control and the Cleric AI.
- Load: with 3 workers plus reviewers, 5 s timeouts hit 3 to 11 tests per full run (boss, spawn, concealment, flow, fields, rng). All passed alone and on main plus each PR. The inbox entry on flaky timeouts stands; slow-stage-tests did not cover these files.
- be-monsters-upper (outline, L) is within two waves; refine it before the next wave.
