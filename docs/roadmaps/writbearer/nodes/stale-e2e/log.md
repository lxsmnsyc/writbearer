# Log: stale-e2e

- Baseline on main (a438f07): 2 failed, 22 passed, same two tests.
- Compendium: the spec cannot import src (the `~icons` import fails under Playwright), so it counts the Monsters list items and expects "0 of <count>".
- Save: two causes, both in the test. It hired the first non-cleric, which can be a job that is not a Vanguard or Ranger, and the Guild House sends no Writ out without one (`hasFighter`). It also re-clicked the exit plate every poll, which sent the bearer back to the plate after it set out on the area beyond. Now it hires a Vanguard or Ranger and clicks once.
