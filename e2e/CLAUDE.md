# E2E rules

- Run e2e from a worktree outside `.git/` (for example `.claude/worktrees/`), because Vite refuses to serve files under `.git/`.
- A spec that leaves the Guild House hires a recruit whose job is in `FIGHTERS` (`kinds(page, 'FIGHTERS')` in `support/guild.ts`), because `hasFighter` blocks the exit and the jobs drawn change with the seed.
- Specs cannot import `src/` modules that pull `~icons`; read game data through the page.
- Wait for a list to render before reading its `count()`; read it through a locator assertion such as `toHaveCount`.
