# src/sim/unit

The logic of the `Unit` class, one module per feature. `Unit` in `../unit.ts` keeps the fields and short delegating methods.

- Each feature function takes the unit as its first argument. Import `Unit` as a type only (`import type Unit from '../unit'`), never as a value, to avoid a cycle.
- Edit the module of your feature. Do not add logic to the `Unit` class beyond a delegate.
- New per-unit state from a node goes in a `WeakMap<Unit, ...>` in that node's own module, not as a new `Unit` field.
- A new input to the stat modifiers is a `RecalcSource` entry in `RECALC_SOURCES` (`gear.ts`). The list is summed in order, so put the entry where the sum should include it.
- Keep the order of side effects in `recalc`, `hit` and `addStatus`. Float sums depend on it and the seed-sensitive boss tests catch a change.
