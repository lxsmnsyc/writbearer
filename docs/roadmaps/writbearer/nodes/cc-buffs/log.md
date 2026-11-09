# cc-buffs log

- Endow sets `unit.attackElement` in the status `setup` and restores it on stop. This covers the hit path (`options.element ?? unit.attackElement`) and `CheckAttackElements` (it starts from `attackElement`) without a listener or an edit to `unit/combat.ts`. So `setupMechanics` is not touched.
- `endow()` removes the old status before adding: `addStatus` refresh keeps the higher power, which would keep the old element.
- `buffParty(source, def, seconds, power, opts)` has no `sim` argument; the sim is `source.sim`.
- Doubt: if two things change `attackElement` at once (an affix and an endow) the restore puts back the value seen at start.
