# Wave: item tiers, the Crown's last guard (2026-11-05)

Ran 2 workers. Both PRs merged by the orchestrator after clean fresh reviews (merge rule of 2026-11-05).

## Merged (PRs #29, #30)

- be-deep-guard: PR #29, clean on the first round (typecheck, lint, 757 tests, e2e 25 of 25). Revenant Knight (Spectral 2, Hollow soldier drawn pale) and Gilded Effigy (gold Hollow soldier with a crown; `makeSteadfast` in `src/sim/steadfast.ts` blocks `STUN` and every status with `flees`, only for units in its set). Outside owned paths: body colors in `effects.ts`, two keys in `monster-table.test.ts`, 3 layer 3 stage snapshots (boss and creditor tests unchanged). About 150k tokens.
- ie-item-model: PR #30, clean on the first round (typecheck, lint, 760 tests, e2e 25 of 25). Tier siblings generated in code (`TIERS`, `TIER_BASES`): Tempered from item level 12 (x2.2), Masterwork from 24 (x3); STR/DEX requirements of base + 8 and + 16, starting gear of all 7 jobs meets its own. The reviewer compared 400 rolls per seed on main and on the branch for 6 seeds and 3 level bands: no extra randomness at any level. Outside owned paths: an optional `unit` prop in `src/ui/items.tsx`. Checked on main plus the PR before merging: 765 tests pass. About 168k tokens.

## Plan notes

- Inbox: the Revenant's bestiary wording; requirement coloring outside the inventory.
- The critical path continues with ie-item-roll (needs ie-item-bonuses, now unblocked).
