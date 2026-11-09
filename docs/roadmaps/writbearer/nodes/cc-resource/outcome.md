# Outcome: cc-resource

## Built

- `src/sim/resource.ts`: `ResourceDef { id, name, max, start, decayPerSecond?, keepAcrossAreas? }`, `grant(unit, def)`, `gain(unit, id, n)` (returns the amount gained), `spend(unit, id, n): boolean`, `amountOf(unit, id)`, `resourcesOf(unit)` (`{ id, name, amount, max }[]` for the UI). Values live in a module WeakMap keyed by unit. Granting again keeps the amount (so a rank raise that reruns passive setup does not reset it). `Unit` is not widened.
- One `Tick` listener per Sim, added on the first `grant` in that Sim: resets non-`keepAcrossAreas` resources to `start` when `sim.area` changes, then applies decay to living units.
- `Skill.spends?: { resource, cost }` in `src/sim/skill.ts`. `canCast` (`src/sim/unit/casting.ts`) also needs the amount; `startCast` spends it after the windup event is not disabled.
- `src/ui/merc-panel.tsx`: a meter per resource in the stats grid, only for units that have one.
- `test/sim/resource.test.ts`: 7 tests (cap, failed spend, decay, area reset and keep, cast gating and spend, regrant keeps amount, unit without resources).
- Changeset `.changeset/cc-resource.md` (minor).

## Deviations

- The resource is paid in `startCast` (casting.ts, a listed shared file), not in `src/sim/mechanics/skill.ts`, to stay inside the listed files.
- Files outside owned paths: only the three `shared:` files, plus the changeset.

## Stubs left

- None. No job grants a resource yet; the Monk node calls `grant` in its passive setup.

## Gotchas

- A skill with `spends` that a monster or AI casts through some path other than `startCast` would not pay the resource.
- The merc panel meter reuses the mana colour; a job wanting pips or another colour edits that row.
- `pnpm lint` through the rtk hook is rewritten to eslint here and fails to parse; `pnpm exec oxlint src test e2e` is the real linter.

## Proposed learnings

- Per-unit job state lives in a WeakMap in the job's own module | survives passive setup reruns | src/sim | no

## Verification

- `pnpm vitest run test/sim/resource.test.ts`: 7 pass.
- `pnpm typecheck`, `pnpm exec oxlint src test e2e`, `pnpm test` (87 files, 833 pass, 3 skipped): pass.

## Size

- Estimated M, actual M.

## Review fix

- The panel's resource rows were not reactive. `merc-panel.tsx` now holds a `resources` signal refreshed from `resourcesOf` every 100 ms (cleared on cleanup) and renders it with `Index`. A resource granted after the panel opens appears. The HP and mana rows have no refresh of their own in this panel; I left them alone.
- Panel check: the repo has no component test setup (vitest runs in node, no DOM). "Only for units that have one" holds because the rows come from `resourcesOf`, which is empty for a unit with no resources (tested), and `Index` over an empty list renders nothing. Not checked in a browser.
