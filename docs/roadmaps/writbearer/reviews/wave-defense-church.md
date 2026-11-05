# Wave: defense elements, Church keepers (2026-11-05)

Ran 2 workers. From this wave on, the orchestrator merges a PR itself once its fresh review is clean and the checks pass, and sends it to the maintainer only when it needs a decision (maintainer, 2026-11-05). `can-merge` still reports "maintainer" for every game PR because the changeset is outside the owned paths; that alone is no reason to wait.

## Merged (PRs #27, #28)

- cc-el-defense: PR #27, fresh review clean on the first round (typecheck, lint, e2e 25 of 25). Layered defense element overrides (status over skill over item) in `src/sim/defense-element.ts`; `becomes` in `statuses.ts` replaced. Saves unaffected (element is not saved). Nits left: no save and load test; one unrelated reformatted line in `gear.ts`. About 111k tokens.
- be-deep-church: PR #28, one fix round. The review found a lint error in `compendium.test.ts` and that the Priest's local `makeHusk` could drift from `spawnMonster` (lint `import/no-cycle` blocks the import). Fix: a test that compares a raised husk with a spawned one. Outside owned paths: Penitent colors in `effects.ts`, two test files for the monster count, and 3 layer 2 stage snapshots (new packs change the pack roll; boss and creditor tests unchanged). Checked on main plus the PR before merging: 752 tests pass. About 180k tokens.

## Plan notes

- `makeHusk` skips the `SPAWN_STEPS` pass. If a husk ever gets a spawn flag, the drift test fails; then make the spawn path lazy.
- Flaky tests under load: `concealment`, `creditor`, `flow`, `fields` (5 s timeouts). Already in the inbox.
