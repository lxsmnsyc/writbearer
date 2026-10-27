# Outcome: builds-design

## Built

- `docs/design/16-builds.md` now draws all seven starting jobs under option B. The Vanguard section existed; the new section "The other six starting jobs under option B" adds Ranger, Cleric, Sellsword, Warden, Duelist and Arcanist.
- Per job: role, a line on why the 4 spells alone play the role, cast order (the first spell that wants to fire casts; the last is the filler), 1 innate, a table of 4 spells with per-rank formulas and 3 elite upgrades each (12), a Needs line, and two example builds.
- A "Decisions" section at the top of doc 16 matches GOAL.md. No Auto spend. The old open questions are answered.
- Vanguard rows are now in cast order: Intercept, Challenge, Shield Wall, Crush.
- `docs/design/09-skill-trees.md` (shared): only the top note changed. It now says doc 16 replaces its Rules and the trees are source lists.

The seven jobs, in cast order, with the innate:

- Vanguard (guard): Intercept, Challenge, Shield Wall, Crush. Innate Sunder.
- Warden (guard): Cover, Execute, Tripwire, Pursue. Innate Interpose (also applies the mark).
- Ranger (striker): Snare, Lightning Rod, Aimed Shot, Charged Arrow. Innate Static.
- Sellsword (striker): Rush, Pocket Sand, Hamstring, Cleave. Innate Second Wind.
- Duelist (striker): Duel, Shadowstep, Lunge, Flurry. Innate Riposte.
- Arcanist (striker): Frost Nova, Fireball, Frost Shard, Firebolt. Innate Elemental Sense.
- Cleric (support): Ward, Heal, Sacred Ground, Smite. Innate Aegis.

Counts: 84 upgrades, 64 from doc 09 and 20 new. Doc 09's 105 nodes: 28 spells, 7 innates, 64 upgrades, 5 dropped (Hazard Pay, Paid in Full, Haggler, Backstab, Night Eyes), 1 merged (Controlled Burn into Inferno).

Revision after gate feedback (second commit):

- Every spell has mana and cooldown in a table per job (first guesses on today's scale). Fillers are 2 to 3 s cooldown. Changed from today: Crush 8 mana, 3 s (was 10, 6); Charged Arrow 2.5 s (was 4). Upgrades that change cost say so: Inferno 32 mana and 12 s, Resurrection 30 and 20, Veil 18 and 15, Renew 12 and 5, Bribe 12 mana.
- A note in doc 16 compares spell impact with basic attacks (area spell on 4 enemies about doubles damage, single target adds about half).
- Pack clearing: Duelist gets Whirlwind (Flurry hits every enemy within 2 tiles), replacing Backstab, because Shadowstep's base already hits from behind. Warden gets Trap Field (Tripwire marks and slows every enemy that enters a 2.5-tile field), replacing Night Eyes, because it only removes a night penalty and has no fight effect. Dancer build now uses Whirlwind.
- Warden cast order changed to Cover, Execute, Tripwire, Pursue so that the filler (Pursue, 6 mana, 4 s) is last.
- "How the seven fit together" lists the pack-clearing spells and upgrades per job and says the base spells of the Duelist and Warden do not clear packs.

Gate: the user approves doc 16 before job-registry starts. Questions for the user:

- Is the Sellsword innate Second Wind right, with Hazard Pay, Paid in Full and Haggler dropped? Or build overpay at the paymaster and bring them back?
- Is the Warden right with Interpose also applying the mark, so that Pursue and Execute always have a target?
- Is the Arcanist right with two bolts (Firebolt, Frost Shard) and Elemental Sense as the innate that picks between them?
- Are Inferno (with Controlled Burn merged) and its friendly fire acceptable as one upgrade of Fireball?
- Is the Cleric's spell set right: Resurrection, Renew and Martyr as upgrades of Heal, and Cleanse as an upgrade of Ward?
- Are Bribe (Pocket Sand upgrade) and Play Dead (Pocket Sand upgrade) acceptable as changes that large?
- There is only one support job (Cleric) among the seven. Is a support slot that always draws the Cleric fine until more-jobs?
- Do the 20 new upgrades read well? New ones: Vanguard (Sundering Blow, Charge), Ranger (Storm Cell, Overcharge), Cleric (Twin Ward, Pilgrim's Rest), Sellsword (Shield Rush, Chain Rush, Knock Aside, Salt the Wound, Cripple), Warden (Hangman's Reach, Last Rites, Trap Field), Duelist (Smoke Step, Assassin's Mark, Whirlwind), Arcanist (Rimefield, Cold Snap, Piercing Bolt).
- Are the first-guess numbers acceptable until cc-tuning?
- (New) Are costs and cooldowns right, and is Pursue as the Warden's filler (6 mana, 4 s) acceptable?
- (New) Is it right that Backstab and Night Eyes are dropped for Whirlwind and Trap Field?

## Deviations

- Edited `docs/design/09-skill-trees.md` (listed under `shared:`): its top note only.
- Doc 16 also changed outside the new section: the intro, a Decisions section, Auto spend removed, open questions answered, Vanguard rows reordered. All inside the owned file.

## Stubs left

- None. This node writes design only.

## Gotchas

- Upgrades that need a system the engine lacks are marked "Needs" under each job: knockback (Vanguard Charge, Sellsword Knock Aside), flyers (Ranger Pin Down and Eagle Eye clauses), taking enemy buffs (Sellsword Cutpurse), hidden units (Warden Sentry, Read the Room), a light radius (Warden Night Eyes), an ambush marker (Warden Never Surprised), health as a spell cost (Arcanist Overchannel), no-corpse kills (Arcanist Shatterpoint), a bind between two units (Duelist Duel), gold spending (Sellsword Bribe), a free attack outside the attack timer (Warden Retaliate, Last Rites). Job nodes may ship these upgrades later; each job node should say which it deferred.
- Consecrate's corpse rule and Purge's corruption removal are left out of the Cleric until those systems exist.
- Cast order is the spell order in the tables. Pursue and Execute need a mark; Interpose and Tripwire give it.
- Spells with an upgrade that replaces the base effect (Snare to Bait, Pocket Sand to Bribe, Sacred Ground to Veil, Frost Nova to Glacial Wall) need `wants` and `release` in the patch.

## Proposed learnings

- None.

## Verification

- `check_prose.py` on doc 16: remaining hits are game terms (magic, synergy, unlocks) and text that existed before. No tests apply to a docs node.

## Size

- Estimated M, actual M.
