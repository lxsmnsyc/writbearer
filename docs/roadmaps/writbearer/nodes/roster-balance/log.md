# Log: roster-balance

- Started from origin/main 77207af. No earlier log; acceptance not met (four jobs not hireable, draw is one of each plus a fighter).
- `hireable: true` on Sellsword, Warden, Duelist, Arcanist; dropped the "Not offered until roster-balance" comments.
- `rollStartingJobs` in `recruits.ts`: one job per slot (guard, striker, support), then any jobs up to 5, no repeats, a fighter guaranteed. `GUILD_RECRUITS` 4 -> 5 in `src/gen/stage/havens.ts` (spots 2.5 apart), guild snapshot hashes updated.
- First boss probe (6 seeds, layers 1/2/3): VRC 6 6 5, WDA 0 0 0. WDA lost the bearer at 15-40 s: Gatekeeper's guard and the Penitents walk to the bearer, the Warden is 3-8 tiles away, nothing heals.
- Interpose reach 2 -> 4: WRC layer 1 2/3 seeds. Added a chase cap (CheckChase) to Interpose: reach 3, chase 4 -> WDA 2 2 6. Chase 3 -> 2 1 5 (worse). Share 0.7 -> 0.8 -> WDA 5 5 6. Kept reach 3, chase 4, share 0.8.
- Side effect: Warden + Ranger + Cleric layer 3 fell from 6 to 2 (the Warden stays by the bearer where the Saint's Dread reaches it). Still 14 of 18 over three layers.
- Impact test: Hollow Soldiers pack: mercs alone die, times meaningless. Spared the merc and bearer from death. Ranger x1.39 vs 4 Hollowed, x1.70 vs 4 Crawlers; settled on 2 Crawlers + 2 Hollowed at level 6 (Ranger x1.58).
- Inbox check: doc values with the rest of this branch: Heal +10 -> VRC 4 6 5 (layer 1 fails); Crush 8/3 -> 1 6 6; Charged Arrow 2.5 s -> 1 6 5 and boss.test Brood Mother 0 of 4 needed. All three still fail; reverted.
- e2e: save.spec picked Vanguard/Ranger, ASHEN now draws neither; seed.spec expected 4. Both one-line fixes. Fifth-recruit test hires the dearest first (free), then the three cheapest, wages read from the same draw in the page.
- Full checks green: typecheck, lint, test (69 files, 685 passed, 3 skipped), e2e 25 passed.
