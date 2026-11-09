# Outcome: cc-buffs

## Built

- `src/sim/buffs.ts`: `buffParty(source, def, seconds, power = 1, { radius?, includeBearer? })` gives a status to every living unit on the source's side (in range if `radius` is set; the bearer is left out with `includeBearer: false`). Returns the statuses given. A second call refreshes time and keeps one status with one stack. `refreshBuff(unit, source, def, seconds, power)` does the same for one unit.
- `src/sim/endow.ts`: `ENDOWED` (`buff: true`; power is element + 1), `endow(unit, element, seconds, source?)` (replaces any earlier endow) and `endowment(unit)`. The status sets `unit.attackElement` on start and restores it on stop, so basic attacks, weapon-element skills and the `CheckAttackElements` weakness pick all see it. Skills with an explicit `options.element` keep it.
- `test/sim/buffs.test.ts`: range, dead, foes, refresh, late unit, endow element, expiry, replacement, AI event, `stealBuff`.
- `.changeset/cc-buffs.md`.

## Deviations

- `src/sim/mechanics/index.ts` is not edited: no registration is needed, the listener-free design works through the status `setup`.
- `buffParty` takes no `sim` argument (the brief's signature had one); it uses `source.sim`.

## Stubs left

- None.

## Gotchas

- Endow works by changing `attackElement`. Code that sets `attackElement` while an endow is on (affixes do so at spawn only) would be overwritten at expiry.
- To endow with a specific element through `buffParty`, pass `element + 1` as the power; prefer `endow()` for one unit.

## Proposed learnings

- None.

## Verification

- `pnpm vitest run test/sim/buffs.test.ts`: 10 tests pass.
- `pnpm typecheck && pnpm lint && pnpm test`: pass (87 files, 836 tests; the full run was before a one-line lint fix, after which typecheck, lint and the buffs test were re-run).

## Size

- Estimated M, actual S. No registry edit and no listener were needed.
