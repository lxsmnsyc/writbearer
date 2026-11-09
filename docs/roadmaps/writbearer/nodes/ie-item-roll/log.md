# Log: ie-item-roll

- Element draws would shift the caller's stream, so a Rare's element uses its own RNG seeded from `hashSeed(rng.state, base, itemLevel, name)` after all draws. No draw on the caller's stream; checked against a pre-node digest (seed 42, 200 items).
- Element is applied by `refreshCards` from `item.element` (an `item.effect` broke the toEqual stream test in loot.test.ts, since closures differ). `elementLevel` added for armor.
- `affixCount` is `number | null`: null rolls as usual; the original draw is still consumed.
- `sim` threaded into `rollItem` and `rollDrops`; only the kill-drop call in `src/game/game/listeners.ts` passes it. Chests, shops, events and recipes still call without it.
