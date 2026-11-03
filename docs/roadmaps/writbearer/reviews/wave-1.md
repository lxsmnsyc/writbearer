# Wave 1 report (2026-11-03)

## Merged

- warden (#3), duelist (#4), sellsword (#5), arcanist (#6), hidden-units (#7), arcanist-upgrades (#8). Each was reviewed by a fresh reviewer and checked locally. e2e was not run.

## Decisions

- Arcanist debate (`debate/debate.md`, approved): the Arcanist stays one job with Fire and Frost. The Elemental Sense test passed in arcanist and arcanist-upgrades, so the split fallback is not triggered.
- Duel gap: skills that pick their own victims skip CheckTarget, so a Vanguard's Challenge can still taunt a dueled elite. The fix is an acceptance line in vanguard-upgrades, ranger-upgrades and cleric-upgrades, and a note in sellsword. Sellsword's area spells already use `areaVictims`.
- contracts/concealment.md is frozen at v2, as built: `onReveal`, `fuse`, `setupConcealment`.
- `test/content/jobs.test.ts` now asserts that the Arcanist's upgrades are all built. Each upgrade brief now says to add its own job's line there.

## Left for later nodes

- roster-balance: the Arcanist is ranged with reach 5.5, and its magic damage is low because the Ash Staff has no matk. These are first guesses.
- duelist-upgrades: a Riposte parry fires UnitMiss, so Untouchable also triggers on parries.
- warden-upgrades: `INTERPOSE_SHARE` is not exported (Living Shield).
- Looks reuse existing attachments. A larger signature shape would need `src/render/sprites.ts`.
- Overchannel triggers when mana is below the spell's cost. Doc 16 says "at 0 mana".

## State

- Active: none. No worker is running.
- Ready: duelist-upgrades, sellsword-upgrades and warden-upgrades (L, on the critical path through roster-balance), cleric-, ranger- and vanguard-upgrades, mastery-offers, stale-e2e, and should-priority nodes.
- Shared-file pairs to avoid running together: sellsword-upgrades with warden-upgrades or other `src/sim/*.ts` editors. Check `plan.py status`.
- The must line is at wave 3. Tokens spent are about 3.23M.
