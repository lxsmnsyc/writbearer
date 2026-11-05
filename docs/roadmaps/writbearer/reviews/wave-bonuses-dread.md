# Wave: item bonus forms, dread and the unseen (2026-11-05)

Ran 2 workers. Both PRs merged by the orchestrator.

## Merged (PRs #31, #32)

- ie-item-bonuses: PR #31, two fix rounds. The review found the spell rank bonus missed passive upgrades set up from the learned rank (`startEffect`), the rank shown in the spell panel, merc panel and upgrade offer, and the Vanguard's Intercept. Fix: `effectiveRank`/`bonusRank` in `src/sim/unit/casting.ts`, and a `RANK_LISTENERS` hook in `recalc` that restarts upgrades when gear changes a rank. The orchestrator asked for a second round: restart only the upgrades on spells whose bonus changed, since a restart resets state kept in a `setup` closure and gear can change mid-fight. `MAX_RANK` moved to `src/sim/stats.ts` (import cycle). The two `BONUS_CARDS` never drop and are left out of the compendium count. A note on the closure state went into the ie-item-roll brief. About 260k tokens.
- be-deep-dread: PR #32, clean on the first round (778 tests, e2e 25 of 25). Drowned Bell (stationary, rings Dread only with an aware monster within 4 tiles), Whisperer (Dread aura 4 tiles), Skulker (hide, strike, re-hide on timers, so a fight with no Lamplighter still ends). New `src/content/monsters/drowned.ts`; `bosses.ts` untouched. Checked on main plus the PR before merging: 790 pass; `concealment.test.ts` timed out once under load and passed alone (7 of 7). About 196k tokens.

## Plan notes

- Upgrade state in `setup` closures resets when gear for that spell changes mid-fight. Fix before item rolls give the rank form (ie-item-roll brief).
- be-deep-moth waits on gs-terrain-lantern. be-minibosses now needs only be-affixes, be-monsters-upper, bp-ground and bp-link.
