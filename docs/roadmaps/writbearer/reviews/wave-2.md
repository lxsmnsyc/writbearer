# Wave 2 report (2026-11-04)

## Merged

- duelist-upgrades (#9), sellsword-upgrades (#10), warden-upgrades (#11), cleric-upgrades (#12), vanguard-upgrades (#13), ranger-upgrades (#14), mastery-offers (#15), stale-e2e (#16), roster-balance (#17). Each was reviewed by a fresh reviewer and checked locally. roster-balance ran the full e2e (25 of 25 on rerun).
- The starting-jobs milestone is done: all seven jobs are hireable with 4 spells, an innate and 12 built upgrades, offers come at Waystations and on Mastery roads, and five recruits are drawn by slot.

## Decisions

The repo has no decision records, so lasting decisions are in `GOAL.md` (Decisions) and here.

- Living Shield: the Warden takes 40% of a shared hit instead of `INTERPOSE_SHARE` (now 80%); the bearer's share does not change; what the Warden takes becomes Ward, capped at 50% of its max health.
- Retaliate answers only foes within the Warden's reach + 0.5.
- Thunderhead is a Charged Arrow patch that bolts only Shocked enemies (60% Storm, 6 tiles).
- The Mastery chest is always 3 cards for 3 different living mercs; a met bonus challenge gives +1 shard to the merc picked. Waystations offer in phases 2 to 4 only.
- The 1.5x spell impact limit for the Ranger and the Arcanist stays (the Ranger is at x1.54 with `CHAIN_SHARE` 1.5).
- Heal (+20 a rank), Crush (10 mana, 6 s), Charged Arrow (3.5 s), Interpose (3 tiles, 80%, chase cap 4) and the Storm chain (1.5x) keep the game's numbers over doc 16's. doc16-sync writes them into doc 16.
- Auto-merge is on: `merge.mode: auto`, `max_size: M`.

## Memory

- New nested rules: `src/content/CLAUDE.md` (spells in `spells.ts`; passive state in a module `WeakMap`; once-per-area on `sim.area`; enemy lists through `hostiles`/`allowed`/`canTarget`; run-long counts in `Unit.tally`; upgrade ranks from the base spell; marking a spell's own hits; faked max health resets), `src/game/CLAUDE.md` (units can leave without `UnitDies`; `streams.area` for draws repeated after a load), `src/gen/CLAUDE.md` (new map draws go last), `e2e/CLAUDE.md` (worktrees outside `.git/`; hire from `FIGHTERS`; no `~icons` imports; wait before `count()`).
- Enforcement node: layer-map-snapshot replaces the `src/gen` rule with a test. The `spells.ts` rule is already enforced by `import/no-cycle`; the bullet only says where to put the code.
- `docs/roadmaps/CALIBRATION.md` started: 19 entries and notes (a job's upgrades cost 250k to 280k tokens whether sized M or L).

## Plan changes

- Refined: cc-job-systems into cc-buffs, cc-afflictions, cc-knockback, cc-resource, cc-sight-still, cc-corpses, cc-ground-zones, cc-side-switch (all M). cc-elements into cc-el-field, cc-el-defense, cc-el-skill-amp (M), cc-el-weather (M, could), cc-el-spectral (S), cc-el-chain, cc-el-overshield (S, could). be-monster-types into be-flyers, be-thieves, be-kidnappers, be-strippers, be-corpse-raisers (all M). ie-item-model into ie-item-model, ie-item-carry, ie-item-bonuses, ie-item-roll (all M). Dependents and `COVERAGE.md` targets repointed.
- Found built, dropped from the plan: hit-count walls and Pneuma fields (`Zone.guards`, `charges`), general pierce and armor break (`DamageFlags.Pierce`, `SUNDERED`). "Spectral monsters as a type" is an element set per monster, not a mechanic.
- Overlaps settled: cc-el-defense owns the defense element `Modifier` form and ie-item-bonuses depends on it; cc-ground-zones' protecting zone is `src/sim/protect.ts`, since `src/sim/ground.ts` is the terrain module.
- New early split: split-ai (M) moves `src/sim/ai.ts` into `src/sim/ai/` with a monster step list. bp-possess, gs-terrain-grass, gs-terrain-lantern, gs-terrain-patrols and the new AI nodes depend on it.
- From the inbox: doc16-sync (S, should), second-wind-area (S, should; Second Wind fires once per run), test-nits (S, could; compendium `count()` and the Rearguard raise test; the recruit.spec fighter pick was already fixed in roster-balance). Plus layer-map-snapshot (S, could).
- Updated downstream: cc-tuning lists the boss and impact gaps roster-balance measured; mj-new-jobs-design waits on doc16-sync.

## Left for later nodes

- cc-tuning: Cleric with Sellsword or Duelist wins layer 1 only 5 and 7 of 24; Warden, Ranger, Cleric wins layer 3 17 of 24; Warden, Duelist, Arcanist sits at the test limit.
- The Never Surprised Tripwire stands at the stage entrance and often stays unsprung.
- Mastery chance is 0.2 per fight, a first guess. Mercs hired after a Waystation visit get no offer there.
- `rollStartingJobs` draws a job whose role is outside `SLOTS` only as an extra.

## Open questions from refinement (for the user)

- Spectral status effect: no design; cc-el-spectral defaults to `UNMOORED` (WIL threshold, 5 s, -20% armor and resistance).
- Curse numbers: no design; cc-afflictions uses -25% attack and magic attack, halved healing, 8 s.
- cc-side-switch depends on bp-possess so both side flips share one mechanism; the other order is possible.
- Items: should an unmet STR/DEX requirement block the equip (as briefed) or only penalize? Should the Pilgrim Staff and Censer stay one-handed? Freeze a contract `item-bonus` before ie-cards and ie-item-roll?
- The strip hand-back reuses the hand-over input; a stripped set piece does not count toward its set.

## Priorities that look wrong

- No `must` work is left: GOAL.md's must is the starting-jobs milestone, now done. Decide which combat-core nodes are `must` for the next milestone (candidates: split-ai, second-wind-area, doc16-sync).
- second-wind-area (should): a small fix of designed behavior; could be `must`.
- cc-el-weather and cc-el-chain (could): fine unless gs-phase-modifiers needs weather.
- mj-outline-jobs stays `later`, but its dependencies now name eight cc nodes.

## Inbox items worth a node

- The Creditor-raised Ranger chaining on its own side: fold into cc-tuning (noted there) or a small fix with a Creditor retune.
- "Ranged monsters shoot from 6 tiles and step back": confirm and mark built in COVERAGE.md (a few minutes, no node).

## State

- Active: none.
- Ready (23): split-ai, cc-corpses, cc-el-defense, bp-roll, ie-item-model, be-affixes, gs-terrain-kinds, cc-afflictions, cc-buffs, cc-ground-zones, cc-knockback, cc-resource, cc-el-field, cc-el-skill-amp, gs-terrain-hazards and S nodes (cc-el-spectral, doc16-sync, second-wind-area, test-nits, layer-map-snapshot, cc-el-chain, cc-el-overshield, gs-terrain-landmarks).
- Gate: "every milestone end: review the refined briefs of the next milestone before its first wave" applies now to the combat-core briefs.
- Must line: none open (all must work done). All should work is placed by wave 20, could by wave 23. Critical path: split-ai -> be-thieves -> be-kidnappers -> be-monsters-deep -> be-minibosses.
- Milestones: starting-jobs done (25 nodes); combat-core 25 open, 6 outline, last by wave 23; more-jobs 11 open, 10 outline, wave 22; bestiary 17 open, 7 outline, wave 13; gauntlets-stages 20 open, 9 outline, 1 done, wave 23; items-economy 12 open, 8 outline, wave 21; story-bearer 6 open, 6 outline, wave 19.
- Tokens: 4,899,533 spent, about 28.4M forecast. The total is the sum of every `spent:` field and is right for what is recorded; sellsword-upgrades and roster-balance were closed without `spent:` (empty keys added), so their tokens are missing. `plan.py` prints its "done nodes have no `spent:`" warning only when `GOAL.md` sets a `budget:`, which it does not.
- Archive (not applied, for the user to confirm): arcanist, build-rules, build-variety, cleric-upgrades, duelist, duelist-upgrades, job-hooks, mastery-offers, ranger-upgrades, sellsword, sellsword-upgrades, slow-stage-tests, split-job-skills, stale-e2e, vanguard-upgrades, warden, warden-upgrades; contracts builds and job-hooks are used by no open node.
- Shared-file warnings left on purpose (append-only, see GOAL.md Shared files): `src/sim/ai/monster.ts`, `src/sim/unit.ts`, `src/sim/events.ts`, `src/content/roster.ts`. Still open from before: `src/game/stage.ts`, `src/render/floor.ts`, `src/render/renderer.ts`, `src/sim/ground.ts`, `src/sim/sim.ts`.
