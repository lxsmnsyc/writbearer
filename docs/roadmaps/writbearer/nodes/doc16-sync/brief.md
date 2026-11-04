---
id: doc16-sync
title: Bring doc 16 in line with the game
status: todo
priority: should
type: docs
outline: false
milestone: combat-core
target:
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-04
spent:
owns:
  - docs/design/16-builds.md
  - docs/design/09-skill-trees.md
shared: []
reserves: []
provides: []
depends_on: []
---

# Bring doc 16 in line with the game

## Goal

`docs/design/16-builds.md` still has the numbers and readings the starting-jobs nodes changed. The game and its tests are right; update doc 16 so later nodes (cc-tuning, mj-new-jobs-design, the new job nodes) read the game's values, then drop doc 09's "Where the game differs from doc 16" list.

## Context

Values the game keeps over doc 16, each backed by `test/sim/bosses.test.ts`, `boss.test.ts` or `spell-impact.test.ts` (roster-balance outcome; doc 09 lines 53 to 59):

- Heal +20 a rank (doc: 10).
- Crush 10 mana, 6 s (doc: 8, 3 s).
- Charged Arrow cooldown 3.5 s (doc: 2.5 s).
- Storm arrow chain at 1.5 times the arrow's ratio (`CHAIN_SHARE` in `src/content/ranger.ts`); doc gives the chain no ratio.
- Interpose: within 3 tiles, takes 80% of the hit, and the Warden chases nothing farther than 4 tiles from the bearer (`INTERPOSE_REACH`, `INTERPOSE_SHARE`, `INTERPOSE_CHASE`, `src/content/jobs/warden/spells.ts`). Doc: 2 tiles, 70%.

Readings the designer decided in review (wave-2 report):

- Living Shield: the Warden takes 40% of a shared hit instead of 80%; the bearer's share does not change; what the Warden takes becomes Ward, capped at 50% of its max health.
- Retaliate: answers only foes within the Warden's reach + 0.5 (melee).
- Thunderhead: a Charged Arrow patch; when the arrow hits a Shocked target, a 60% Storm bolt goes to every other Shocked enemy within 6 tiles.
- Mastery chest: always 3 cards for 3 different living mercs; a met bonus challenge gives +1 shard to the merc picked. Waystations offer in phases 2 to 4 only.
- Limits the builders added: Thousand Cuts caps at 20 blows (+60%); Untouchable needs Lunge off cooldown and starts it; Overchannel triggers when mana is below the spell's cost (doc: at 0 mana).

## Acceptance

- [ ] Each value above reads the same in doc 16 and in the code (grep the constants named).
- [ ] Doc 09's "Where the game differs from doc 16" list is gone or points to doc 16.
- [ ] `pnpm lint` still passes (no code change).

## Sizing

S: two docs, values listed here.

## Notes for the worker

- Docs only. No changeset.
- Keep doc 16's tables in their shape; change the numbers and the "Today ..." notes in place.
