---
id: cc-el-chain
title: Storm chain as a shared helper
status: todo
priority: could
type: refactor
outline: false
milestone: combat-core
size: S
spike: false
verify: pnpm vitest run test/sim/el-chain.test.ts && pnpm vitest run test/sim/ranger-upgrades.test.ts test/sim/ranged.test.ts
exclusive: []
gate: false
added: 2026-11-04
spent:
owns:
  - src/sim/chain.ts
  - test/sim/el-chain.test.ts
shared:
  - src/sim/types.ts
  - src/content/ranger.ts
reserves: []
provides: []
depends_on: []
---

# Storm chain as a shared helper

## Goal

Turn the Ranger's Storm arrow chain into a helper any Storm source can call, so a later Storm spell, weapon or monster chains by the same rule and cannot chain twice. Doc 04 says Storm skills can chain to nearby targets; today only `stormArrow` does.

## Context

- Already built: `stormArrow`, `CHAIN_REACH = 3` and `CHAIN_SHARE = 1.5` in `src/content/ranger.ts`, on `sim.chain` (`src/sim/sim.ts`). Ranger upgrades are done (`ranger-upgrades` outcome), so the file is free to edit. So "Storm chain" is not an open engine rule; the open part is the generalization.
- Decision made: no auto-chain on every Storm hit. That would double the Ranger's chain, change all Storm balance and every seeded fight. The helper is opt-in.

## Steps

- [ ] `src/sim/chain.ts`: `chainFrom(source, first, { reach, share, count, hit })` picks up to `count` nearest other victims within `reach` of `first` through `allowed`/`canTarget`, none already hit, and fires `sim.chain` with `ratio * share`. Mark the leap with a new `DamageFlags.Chained` (append in `types.ts`) so a chained hit never chains again.
- [ ] Rewrite `stormArrow` to call it with its current numbers (reach 3, share 1.5, count 1).
- [ ] Tests: count, reach, no repeat target, no second chain, line of sight rules as the Ranger had them.

## Acceptance

- [ ] The Ranger's Storm arrow does the same damage and picks the same second target as before (`test/sim/ranger-upgrades.test.ts` unchanged and passing).
- [ ] A fixture Storm hit using `chainFrom` with `count: 2` hits two further foes once each, none twice, and never an ally or a hidden unit (`test/sim/el-chain.test.ts`).
- [ ] Fast check passes: `pnpm typecheck && pnpm lint && pnpm test`

## Sizing

Extract and generalize one function; three files. S.

## Notes for the worker

- Any change that can touch shared damage math must keep `test/sim/bosses.test.ts`, `boss.test.ts` and `creditor.test.ts` passing unchanged; they are seed-sensitive. New code does nothing until something opts in, so a seeded fight matches the code before the node.
- Keep the RNG draw order of `stormArrow` identical, or the Ranger tests shift.
- Victim lists go through `hostiles`/`allowed`/`canTarget` (`src/sim/targeting.ts`), never `sim.foes` directly. Once-per-area effects key on `sim.area`. Passive state lives in a module `WeakMap<Unit, ...>`. Old saves must load. The sim stays DOM-free.
