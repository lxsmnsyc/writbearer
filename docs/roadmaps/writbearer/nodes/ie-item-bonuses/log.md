# Log: ie-item-bonuses

- Defense form already in the union from cc-el-defense; added only the tooltip line.
- Added `{ spell, rank }` to Modifier, `spellRanks` to StatResult. rankOf adds it (only if the unit has the spell) and caps at MAX_RANK.
- MAX_RANK moved to stats.ts and re-exported by builds.ts: skills.ts importing builds made an import cycle (lint no-cycle).
- Example cards are in BONUS_CARDS, appended to CARDS only. GEMS and monster cards are unchanged, so rng.pick draws are unchanged.
