# Outcome: cc-el-defense

## Built

- `src/sim/defense-element.ts`: per-unit override list in a `WeakMap<Unit, ...>` (not saved; the base element is kept and restored). `setDefenseElement(unit, key, element, level, priority)`, `clearDefenseElement(unit, key)`, `DefensePriority` (Item < Skill < Status; ties go to the later one), `holdDefenseElement` (a Lifecycle), `statusElement(element, level)` (status setup), `defenseShift(element, level, duration = 10)` (a StatusDef for skills, id `defense-shift-<element>-<level>`), `syncItemDefense(unit, modifiers)`.
- `becomes` in `src/sim/statuses.ts` is replaced by `statusElement`; Freeze and Petrify keep ids, durations and Frost 1 / Earth 1.
- `Modifier` in `src/sim/stats.ts` gains `{ defense: Element; level: number }`; `deriveStats` skips it. `recalc` (`src/sim/unit/gear.ts`) calls `syncItemDefense` after the stats, so gear and bonuses with it set an item override (highest level wins among several).
- `test/sim/el-defense.test.ts`: both end orders, item under skill, base kept, affinity of a Fire shift against Frost.

## Deviations

- None outside owned and shared paths. `src/sim/unit/gear.ts` gets one call in `recalc`.

## Stubs left

- None. No card or item uses the modifier yet; ie-cards owns that. `src/gen/loot.ts` `describe` returns null for it (no tooltip line).

## Gotchas

- The base element is captured when the first override is set. Changing `unit.element` by hand while an override is active is overwritten at the next recompute.
- Saves hold no override; statuses and gear re-derive it.

## Proposed learnings

- Change a unit's defense element only through `setDefenseElement`/`clearDefenseElement` | a direct write is lost or restored wrongly | src/sim | no

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: pass (77 files, 744 tests). The brief's verify command passes; bosses, boss and creditor tests are unchanged.

## Size

- Estimated M, actual M.
