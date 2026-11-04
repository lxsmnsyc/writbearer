# Log: vanguard-upgrades

- Verify command passed only for the Shield Wall case; the 12 upgrades were summary-only. Built them.
- `src/content/vanguard.ts` keeps the four spells, Sunder, and the old `SHIELD_BASH`, `VOW` and `SHARED_BURDEN` (other test files import them). The tree skills that became upgrades (Bastion, Rampart, Immovable, Fault Line, Earthshaker, Banner, Last Line) were rewritten as patches in `jobs/vanguard/upgrades.ts` and removed from vanguard.ts. `upgrades.ts` imports vanguard.ts, not index.ts, so no import cycle.
- The spells already had the doc's ranks (Intercept 4+0.5r, Challenge 3+0.25r, Shield Wall 2+0.25r, Crush 140+10r and 30+5r). Shield Bash's stun became 50+5r and its damage a flat 100%, as the doc has it.
- Crush cost and cooldown: doc says 8 and 3 (today 10 and 6). With 8/3, `bosses.test` layer 1 wins 1 of 6 seeds (needs 5); with 8/6 it wins 3 of 6; with 10/6 (kept) it passes. Kept 10/6; cc-tuning or roster-balance can settle the filler's numbers.
- Charge: pushes 1.5 tiles perpendicular to the dash, to the side the enemy stands on, in 0.25-tile steps that stop at an unwalkable tile (the same small push as Sellsword's Knock Aside, written locally).
- Duel gap: Challenge (`challenged`, release), Last Line, Shield Bash, Charge, Earthshaker and the Fault Line line take enemies through `hostiles(u)` or `canTarget`. The Fault Line projectile already refuses forbidden targets.
- Tests use quiet toggles (all spells off) and a still Vanguard.
