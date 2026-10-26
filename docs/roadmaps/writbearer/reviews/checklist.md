# Checklist

- Data and migrations: no database. Saved runs store merc kinds; job-registry keeps the save format and `save.ts` reads kinds through HIREABLE. New kinds only appear in new saves.
- Compatibility: saved runs from before the roadmap must load (GOAL constraint, job-registry note). Seeds: recruit draws change in roster-balance, so a shared seed gives different recruits than before. Accepted; seeds are not promised stable across versions.
- Auth and permissions: N/A, single-player game in the browser.
- Failure modes: a job with a broken tree or missing item base fails at load. Covered by `test/content/jobs.test.ts` (job-registry).
- Concurrency: four job nodes run at once. Shared files are the two registries (one line each) and `src/sim/statuses.ts`, `ai.ts`, `events.ts` (append-only, listed under `shared:`). Merge order is printed by `plan.py status`.
- Limits: N/A. Party size stays four.
- Security: N/A, no untrusted input added.
- Observability: N/A beyond tests; the game has no telemetry.
- Performance: CheckTarget runs per candidate per think. targeting-rules keeps it cheap (no listeners in the default case). No budget set; the fight tests time out if it is badly slow.
- Testing: each node has a verify command on its own test file; fast check runs in parallel worktrees; e2e needs the fixed port 5199 (`exclusive: [e2e-port]` on roster-balance).
- Developer experience: the job-def contract and Vanguard's module are the example for later jobs (more-jobs roadmap).
- Rollout: N/A. No flags; a job is hireable when its core node merges. Branch nodes can land later because placeholders are not learnable.
- Cleanup: placeholder branch nodes are removed by the branch nodes; GOAL acceptance checks that no designed-only node remains.
- Coverage: `COVERAGE.md` maps every design item to a node id, built, not code, dropped or inbox.
- Dependencies: no new libraries.
