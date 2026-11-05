# Log: ie-item-model

- Normal bases got `requirements` (weapons, shields, helm and body); siblings are generated in `src/content/items.ts` by `makeSibling` (`TIERS` map, `TIER_BASES` appended to `BASE_BY_ID`; `BASES` untouched).
- Tier swap is `tierBase` in `src/gen/loot.ts`, by item level only (Exceptional from 12, Elite from 24), after the pick, so no RNG draw moves. Below 12 the code path is a no-op.
- Scales 2.2x and 3x: the Exceptional armor range had to clear the Normal max (Hood 3-6 needs more than 2x).
- First run had 7 timeouts under load; all pass alone.
