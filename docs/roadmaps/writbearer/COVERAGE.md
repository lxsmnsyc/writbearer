# Design coverage

This file maps every item of the design notes in docs/design to one of: a roadmap node that will build it, already built, not code, or dropped because a later doc replaced it. It was made from a survey of the code on 2026-10-26, so each status rests on grep-level evidence and may be off in detail. Each line reads `item (doc#heading) -> target`. For partly built items the target names the node and says what is left. Where the same item appears in two surveys, both lines are kept with the same target.

Targets are node ids of the roadmap in this folder (see GOAL.md and nodes/), or built, not code, dropped, inbox. An inbox target means no node covers the item yet.

## Doc and code mismatches

Each entry says what differs and which node should settle it.

- Card drop rate: code uses 3% (25% elite, 100% boss), docs 06 and 08 say 5%. Owner: cc-tuning.
- Recruiting: docs 05 and 01 say recruits come in phases 1 and 2 through taverns, wanderers and events. Code recruits only at the Guild House before phase 1 (wanderers in endless only), and has no Tavern. Owner: ie-party.
- Guild offers: doc 05 says the run starts with 1 merc chosen from 3 offers of simpler jobs. Code offers 4 recruits from 3 jobs. Doc 12 wants offers by guard, striker and support slot. Decided: five recruits by slot, the player hires up to four. Owner: roster-balance.
- Iron Company 4-piece bonus: doc 06 says a Ward after each fight, code gives -15% damage to the bearer. The Banner morale bonus waits for morale bonuses. Owner: ie-loot-fixes.
- Pale Choir 3-piece: doc says once per stage, code does it once per area. Owner: ie-loot-fixes.
- NodeKind has no Shrine, Treasure or Shortcut. Doc 01 lists all three as node types, doc 11 says "Not yet" for Shrine. The Vault objective covers some of Treasure. Owner: gs-node-kinds.
- Doc 09 says "no monster shoots yet". This is stale: Hollow Archer, Penitent Slinger and Multishot exist. Owner: roster-balance (edit the doc).
- Docs 13 and 14 still describe a Labyrinth stalker or hall-guard mini-boss. Doc 15 reworked the Labyrinth into a monster-free trap course, so these are stale. Owner: gs-labyrinth (edit the docs).
- Doc 01 says the boss fights in an arena and doc 11 says closed arena. Code uses open fields. Owner: gs-world-flow (edit the docs).
- Doc 11 says stages are 48x32 to 64x48 tiles. Code uses 46-54 squares. Owner: gs-world-flow.
- Doc 11 lists flamethrowers, pressure plates and arrow launchers among the traps. They are not built: HazardKind is spikes, vent, arrows, blade, floor, and commit 216185b only planned them. Owner: gs-labyrinth.
- Doc 11 and doc 14 hazard lists differ from HazardKind in code (spike grate, fire vent, arrow slit, swinging blade, falling floor). Owner: gs-labyrinth.
- Doc 06 says the player picks 1 of 3 rewards after each fight. Code shows one reward kind per road on the map (doc 14 design). Owner: ie-loot-fixes.
- Doc 06 uniques: Widow's Lantern reveal and Rimecaller effects are missing from code. Owner: ie-loot-fixes.
- Doc 09 Immovable (no knockback, stun, fear): code blocks stun, Petrify and Dread only because knockback and fear skills do not exist. Owner: cc-job-systems.
- Doc 09 Pin Down and Eagle Eye mention flyers, and no flyer monster exists. Owner: be-monster-types.
- Doc 13 Herald affix: design says run to an alarm bell, code wakes the nearest pack for 10 s. Owner: be-affixes.
- Doc 13 Horn of the Road: design uses Teleport, code uses Swift. Owner: be-affixes.
- Doc 14 mutators: 5 of 10 built. The "reward up one step" rule is only one extra elite item. Owner: gs-mutators.
- Doc 10 Writ warmth: built at the Penitent blessing event only, not near Occult altars in general. Owner: sb-clues.
- Doc 10 Hollowed element: survey assumed Occult in roster.ts without checking. Owner: roster-balance.
- Doc 02 folder layout is aspirational: code has a single ai.ts, not sim/ai/. No doc change needed, listed as not code.
- Doc 08 "Spectral in v1": only the defense affinity exists, no status and no attack. Owner: cc-elements.
- Doc 05 says a pet takes half a party slot; no pet exists. Owner: mj-outline-jobs.

## Counts per milestone

| Milestone | Items |
| --- | --- |
| built | 218 |
| starting-jobs | 39 |
| combat-core | 49 |
| more-jobs | 17 |
| bestiary | 65 |
| gauntlets-stages | 67 |
| items-economy | 44 |
| story-bearer | 28 |
| not code | 20 |
| dropped | 4 |
| inbox | 3 |
| total | 554 |

## Coverage list

### 01-overview

#### Core idea
- Citizen (bearer) cannot attack, mercs fight on their own, bearer death ends run (01#Core idea) -> built: src/sim/ai.ts, src/content/roster.ts (Bearer job), test/sim/fight.test.ts
- Reference games list (01#Core idea) -> not code

#### Seeds
- Seed hashed, per-subsystem streams (src/core/seed.ts, rng.ts; test/core/rng.test.ts); hash(runSeed, phase, name) (01#Seeds) -> built: src/core/seed.ts, rng.ts; test/core/rng.test.ts
- Named streams map/layout/loot/combat/events/recruits/craft (01#Seeds) -> gs-world-flow (remainder: loot, combat, recruits, craft, map, events used; no separate `layout` stream verified)
- Typed seed, New seed, Copy link, `?seed=`/`&endless` (01#Seeds) -> built: commit 27118f6, e2e/seed.spec.ts

#### Structure / Phases
- Run > phase > stage graph of 8 layers > stage (01#Structure / Phases) -> built: src/gen/graph.ts, game/game.ts AREAS_PER_LAYER
- Phases = layers with own biome, boss in arena, Waystation start (01#Structure / Phases) -> built: commits 642edb3, e18050b, 454665a, test/sim/waystation.test.ts, test/sim/boss*.test.ts
- Phase modifiers: night, rain, plague, war zone, faction control (01#Structure / Phases) -> gs-phase-modifiers
- Seamless continuous world within a phase (01#Structure / Phases) -> gs-world-flow (remainder: areas joined edge to edge (fce5a86, b547bea) and World tab was added then removed (9b17ed4))
- Loading screen only between phases (01#Structure / Phases) -> gs-world-flow (remainder: Waystation exists between layers; no explicit loading concept)

#### Stage node types
- Combat, Elite, Boss (src/gen/graph.ts NodeKind) (01#Stage node types) -> built: src/gen/graph.ts NodeKind
- Camp: rest (+10 morale, heal) (game.ts ~1884, sim/morale.ts RESTED) (01#Stage node types) -> built: ONLY rest; swap bench, craft, drill not at Camp (see 05, 06)
- Town: merchant (Market), blacksmith (Smith), temple, bench (src/game/town.ts, test/sim/town.test.ts); NOT tavern (01#Stage node types) -> built: src/game/town.ts, test/sim/town.test.ts
- Event: text choice (commit 11bcae6, src/content/events.ts, e2e/event.spec.ts) (01#Stage node types) -> built: commit 11bcae6, src/content/events.ts, e2e/event.spec.ts
- Ambush (b9d9d38, test/game/ambush.test.ts) (01#Stage node types) -> built: b9d9d38, test/game/ambush.test.ts
- Refugee escort (173a4a1, test/game/escort.test.ts) (01#Stage node types) -> built: 173a4a1, test/game/escort.test.ts
- Shrine node (buff / buff+curse, Creditor's altars) (01#Stage node types) -> gs-node-kinds
- Treasure node (01#Stage node types) -> gs-node-kinds
- Shortcut node skipping layers (01#Stage node types) -> gs-node-kinds
- Rewards per fight shown on map (65a53cf) (01#Stage node types) -> built: beyond doc

#### Stages
- Reach exit, no time limit, monsters wait, alarms bring more (src/game/alarms.ts, test/game/alarms.test.ts; Horn-Bearers 8879534) (01#Stages) -> built: src/game/alarms.ts, test/game/alarms.test.ts; Horn-Bearers 8879534
- Open-field stages (e045c87, b547bea; src/gen/stage.ts) (01#Stages) -> built: e045c87, b547bea; src/gen/stage.ts

#### Run length
- 4 phases x 8 nodes, 60-75 min (01#Run length) -> gs-world-flow (remainder: 4 layers built (test finale: e2e/finale.spec.ts); timing never measured/tuned in code; node mix (60/40) not enforced)
- Save/resume at any node (src/game/save.ts, test/sim/save.test.ts, e2e/save.spec.ts) (01#Run length) -> built: saves at area entry

#### Endless mode
- Endless mode (56cfd09; e2e/endless.spec.ts) (01#Endless mode) -> built: 56cfd09; e2e/endless.spec.ts
- Endless "tiers and modifiers keep rising" (01#Endless mode) -> gs-phase-modifiers (remainder: levels/budgets rise; modifiers do not exist yet)
- The Stranger NPC (07) (01#Endless mode) -> sb-clues

#### Between runs / Compendium
- No meta progression; compendium + one suspended run (src/game/compendium.ts, save.ts) (01#Between runs / Compendium) -> built: src/game/compendium.ts, save.ts
- Compendium with hidden-until-discovered monsters/bosses/cards/uniques (f7bae09, test/sim/compendium.test.ts, e2e/compendium.spec.ts) (01#Between runs / Compendium) -> built: f7bae09, test/sim/compendium.test.ts, e2e/compendium.spec.ts
- Compendium sections: Mercs, Monsters, Uniques, Cards, Gear, Runs built; sets listed? (sets "silhouette until acquired" per doc, likely built) (01#Between runs / Compendium) -> ie-loot-fixes (remainder: Compendium sections: Mercs, Monsters, Uniques, Cards, Gear, Runs built)
- Tone: adult, vices (01#Between runs / Compendium) -> not code
- Tone mechanics: unpaid mercs desert (BUILT: Broken morale desert, src/game/wages.ts); betray (NOT BUILT); injuries/scars (NOT BUILT) (01#Between runs / Compendium) -> ie-party (remainder: Tone mechanics: unpaid mercs desert (BUILT: Broken morale desert, src/game/wages.ts); betray (NOT BUILT))

### 02-tech-stack

#### Stack / Simulation
- TS, plain-TS sim no DOM, Canvas 2D, Solid UI, Vite/pnpm/Vitest/Playwright/oxlint/oxfmt (package.json, vitest.config.ts, playwright.config.ts) (02#Stack / Simulation) -> built: package.json, vitest.config.ts, playwright.config.ts
- Fixed 20 ticks/s (src/sim/sim.ts TICK = 0.05) (02#Stack / Simulation) -> built: src/sim/sim.ts TICK = 0.05
- Renderer interpolates between ticks (02#Stack / Simulation) -> cc-determinism (remainder: not confirmed by grep (no "interpol" in src/render))
- Commands queued and applied at tick start (02#Stack / Simulation) -> built: shouts (src/sim/shout.ts); move/hand-off commands partly direct UI calls
- Move sim to a Web Worker ("later") (02#Stack / Simulation) -> cc-determinism

#### Randomness / Determinism
- mulberry32 streams, seed hash, Crockford seeds, prd.ts (src/core/*.ts, test/core/rng.test.ts) (02#Randomness / Determinism) -> built: src/core/*.ts, test/core/rng.test.ts
- Trig lookup tables for combat (02#Randomness / Determinism) -> cc-determinism
- Fixed-point replays "not a goal yet" (02#Randomness / Determinism) -> not code

#### World
- Square grid, iso camera, A* (src/sim/nav.ts), flow field (src/sim/flow.ts), projectiles & zones as entities (projectile.ts, zone.ts) (02#World) -> built: src/sim/flow.ts
- Tile height levels / depth buffer (02#World) -> gs-terrain-height-view (remainder: none in sim; renderer-only)
- Spatial hash (02#World) -> cc-determinism (remainder: unverified (no spatial-hash file; sim iterates units); separation steering likely in sim.ts (stuck handling))
- Facing matters for blocking/backstabs (02#World) -> duelist-footwork (remainder: Flank flag + shield block in damage.ts, unit.ts:279 behind-check; "backstab" bonus not found)

#### Stats
- Stats pure function of job/level/raised stats/passives/equipment, recomputed on change (src/sim/stats.ts, unit.ts; test/sim/progress.test.ts) (02#Stats) -> built: src/sim/stats.ts, unit.ts; test/sim/progress.test.ts
- Conditional effects as event listeners (src/content/passives.ts, affixes.ts) (02#Stats) -> built: src/content/passives.ts, affixes.ts

#### Art
- Greyscale + info colors, 384x216 3x pixel snap, palette (src/render/palette.ts; 0974a12), floor flagstones (floor.ts), light map (light.ts), fog of war (fog.ts) (02#Art) -> built: 70b5fe6
- tools/rig-sheet.html exists (tools/rig-sheet.html) (02#Art) -> mj-portraits (remainder: tools/rig-sheet.html exists (tools/rig-sheet.html))
- Interface: dark glass panels, kit.tsx, icons.ts, inventory paper doll, skill tree grid (6387160) (02#Art) -> built: 6387160
- Statuses as marks: implemented for several (renderer.ts); Taunted notch etc (02#Art) -> cc-cast-events (remainder: Statuses as marks: implemented for several (renderer.ts); Taunted notch etc)
- Merc portraits as cut-paper busts from seed (02#Art) -> mj-portraits (remainder: not found (grep "portrait" not checked deeply; compendium lists mercs); likely NOT BUILT)
- Equipment visible on figure (02#Art) -> ie-loot-fixes (remainder: weapon and shield only ("A merc's figure shows its weapon and shield"); other slots not)
- "Claude makes the art", unit design rules, hand-made art swap (02#Art) -> not code

#### Saves
- One slot IndexedDB, written on area entry, deleted on run end, snapshot not replay (src/game/save.ts, test/sim/save.test.ts) (02#Saves) -> built: src/game/save.ts, test/sim/save.test.ts
- Compendium written as discovered (02#Saves) -> built: present in code

#### Folder layout
- Layout is aspirational; actual: src/{core,sim,sim/mechanics,content,game,gen,render,ui}. Missing from plan: sim/ai/ toggle evaluator folder (single ai.ts) (02#Folder layout) -> not code

#### First milestone (all 5 steps)
- 1. core/ port (d790b39); trig tables NOT BUILT (02#First milestone (all 5 steps)) -> built: d790b39
- 2. Damage pipeline + tests (1527cd7, test/sim/damage.test.ts) (02#First milestone (all 5 steps)) -> built: 1527cd7, test/sim/damage.test.ts
- 3. Headless fight (36bdad3, test/sim/fight.test.ts) (02#First milestone (all 5 steps)) -> built: 36bdad3, test/sim/fight.test.ts
- 4. Iso canvas render of fight (853b9de / 1088b40) (02#First milestone (all 5 steps)) -> built: 853b9de / 1088b40
- 5. Toggle panel in Solid (d1f5c24 "Add merc orders", src/ui/merc-panel.tsx, e2e/orders.spec.ts) (02#First milestone (all 5 steps)) -> built: d1f5c24 "Add merc orders", src/ui/merc-panel.tsx, e2e/orders.spec.ts

#### Later milestones
- 1. Party of four, recruiting, wages, camp and town (02#Later milestones) -> ie-party (remainder: recruiting (e1bb16b), wages (e18050b), camp, town built; "bench" and tavern not; contracts not)
- 2. Full inventory, rolled loot, sockets, refine, crafting, skill trees, stat allocation (02#Later milestones) -> ie-item-model; also ie-identify-curse, ie-crafting, cc-autocast (remainder: all built (cfdc002, 79e2bad, d24ad70); gaps: identification, requirements, cursed, autocast cards, crafting at Camps)
- 3. Uniques (a80d03a, test/sim/uniques.test.ts); 2 of the 4 doc examples only (Widow's Lantern reveal and Rimecaller missing effects) (02#Later milestones) -> built: a80d03a, test/sim/uniques.test.ts
- 4. Four phases with bosses, events and NPCs (02#Later milestones) -> sb-clues (remainder: 4 phases/bosses/events built (642edb3, 11bcae6); NPC roster mostly missing (see 07))
- 5. Squad sets (b2b102c, test/sim/sets.test.ts) (02#Later milestones) -> built: b2b102c, test/sim/sets.test.ts
- 6. Compendium, endless, seed sharing (f7bae09, 56cfd09, 27118f6) (02#Later milestones) -> built: f7bae09, 56cfd09, 27118f6
- "toggle UI carries the most risk, prototype early" (done) (02#Later milestones) -> not code

### 03-combat-engine

#### Event engine
- Bus, per-type emitters/priority scales, Pre/Exact/Post, `disabled` cancel (src/core/event-engine.ts, event-emitter.ts, test/core/event-engine.test.ts) (03#Event engine) -> built: src/core/event-engine.ts, event-emitter.ts, test/core/event-engine.test.ts
- Lifecycle for skills/passives/statuses/affixes/cards (src/core/lifecycle.ts) (03#Event engine) -> built: src/core/lifecycle.ts
- Check* events: built CheckHit, CheckSkillCost, CheckBuildup, CheckStatusDuration (src/sim/events.ts). NOT BUILT: CheckCastTime, CheckCastAllowed, CheckMonsterTarget (03#Event engine) -> cc-cast-events (remainder: Check* events: built CheckHit, CheckSkillCost, CheckBuildup, CheckStatusDuration)
- Unit* events: built UnitDamage, UnitHeal, UnitDies, UnitMiss, UnitSkillWindup, UnitSkillRelease, UnitRevived (events.ts). NOT BUILT: UnitSkillHit, UnitSkillRecovery (03#Event engine) -> cc-cast-events (remainder: Unit* events: built UnitDamage, UnitHeal, UnitDies, UnitMiss, UnitSkillWindup, UnitSkillRelease)
- Loop safety: Redirected/Reflected flags exist (types.ts), UnitTriggerSkill rule not applicable until autocast exists (03#Event engine) -> cc-cast-events (remainder: Loop safety: Redirected/Reflected flags exist (types.ts), UnitTriggerSkill rule not applicable until autocast exists)

#### Damage axes
- DamageKind/Range/Element enums, flags (src/sim/types.ts); no size (03#Damage axes) -> built: src/sim/types.ts
- Flag set: Pierce/FriendlyFire/Critical etc. exist; `Skill`, `NonLethal` ok; added Flank/Blocked/Sure/Ambush (03#Damage axes) -> targeting-rules (remainder: Flag set: Pierce/FriendlyFire/Critical etc. exist; `Skill`, `NonLethal` ok; added Flank/Blocked/Sure/Ambush)

#### Friendly fire
- Default no friendly fire (03#Friendly fire) -> targeting-rules (remainder: works; `friendlyFire: true` skill option exists only as DamageFlags.FriendlyFire in types.ts)

#### Physical/magical
- Phys uses STR/DEX, accuracy vs evasion (stats.ts, mechanics/hit.ts), crit, block, hard/soft def (damage.ts), Ward vs magic (damage.ts Barrier) (03#Physical/magical) -> built: present in code
- Magical hits always hit and have no crit, INT adds buildup (buildup.ts:22) (03#Physical/magical) -> built: present in code
- Hit-count walls (Safety Wall) and ranged-physical fields (Pneuma) (03#Physical/magical) -> cc-elements
- Interrupt rules (melee hits interrupt casts, big hits interrupt magic) (03#Physical/magical) -> cc-cast-events

#### Mana
- Skill mana costs, max mana from job + INT, regen scaled by max mana + WIL, x faster out of combat (stats.ts:154-159, sim.ts:31,403; commit b196b03) (03#Mana) -> built: stats.ts:154-159, sim.ts:31,403; commit b196b03
- CheckSkillCost passive hook built; items/cards mana-on-hit/kill (bSPDrain/bSPGain) NOT BUILT; Duelist Flourish N/A (job not built) (03#Mana) -> cc-autocast (remainder: CheckSkillCost passive hook built; items/cards mana-on-hit/kill (bSPDrain/bSPGain) NOT BUILT)

#### Skill lifecycle
- windup/recovery/cooldown per skill (skills.ts, unit.ts); CheckCastAllowed/CheckCastTime/UnitSkillHit/UnitSkillRecovery events NOT BUILT (03#Skill lifecycle) -> cc-cast-events (remainder: windup/recovery/cooldown per skill (skills.ts, unit.ts); CheckCastAllowed/CheckCastTime/UnitSkillHit/UnitSkillRecovery)
- Homing basic-attack arrow vs straight skill shot (src/sim/projectile.ts, test/sim/ranged.test.ts; Piercing Arrow) (03#Skill lifecycle) -> built: src/sim/projectile.ts, test/sim/ranged.test.ts; Piercing Arrow
- First skills Challenge, Piercing Arrow with Auto/Elites/Off modes (src/content/skills.ts, test/sim/skills.test.ts) (03#Skill lifecycle) -> built: src/content/skills.ts, test/sim/skills.test.ts

#### Hit check
- crit skips hit check, 80+acc-eva clamp 5..95, UnitMiss (mechanics/hit.ts; test/sim/damage.test.ts) (03#Hit check) -> built: mechanics/hit.ts; test/sim/damage.test.ts

#### Damage pipeline
- All 13 DamagePriority steps, Initial, Ratio/Flat, Amplify/Reduce category multiplication, Defense (4000/1000 scales, 90% cap via formula), Affinity, Crit x1.4, Block (03#Damage pipeline) -> built: src/sim/mechanics/damage.ts, types.ts:80
- Amplify categories: Race, TargetElement, AttackElement, AttackRange, Rank built; "specific skill" category NOT BUILT (03#Damage pipeline) -> cc-elements (remainder: Amplify categories: Race, TargetElement, AttackElement, AttackRange, Rank built; "specific skill" category NOT BUILT)
- Pre step: caps and "Interpose redirect" (03#Damage pipeline) -> warden (remainder: no Interpose/Warden (Warden job not built); no 30% cap rule)
- Post: reflect (Thornhide unique, Reflected flag), drain (minibosses only), buildup built; threat, stagger/interrupt, morale on kill (built in morale.ts) (03#Damage pipeline) -> cc-threat; also cc-cast-events (remainder: threat and stagger NOT BUILT)
- Healing pipeline (src/sim/mechanics/heal.ts); Post overheal shield NOT BUILT; Venom halves healing built (statuses POISON) (03#Damage pipeline) -> built: src/sim/mechanics/heal.ts
- Pierce/armor-break general effect set (Pierce flag + SUNDERED built) (03#Damage pipeline) -> cc-job-systems

#### Skill definition
- Skill interface (src/sim/skill.ts): no `tags`, `targeting` rule enum, `maxRank` may be in tree; `friendlyFire` field missing (03#Skill definition) -> targeting-rules (remainder: Skill interface (src/sim/skill.ts): no `tags`, `targeting` rule enum, `maxRank` may be in tree)
- Interpose skill (Warden) (03#Skill definition) -> warden
- Sunder (src/content/passives.ts, SUNDERED status) (03#Skill definition) -> built: src/content/passives.ts, SUNDERED status

#### Status effects
- Taunted, Stun, Burn, Chill, Freeze, Shock, Petrify, Poison, + Dread, Sear, Sundered, Rooted, Slowed, Bleed, shield wall, Mending etc. (src/sim/statuses.ts (03#Status effects) -> built: src/sim/statuses.ts, test/sim/statuses.test.ts
- Statuses silence, blind, fear, curse (03#Status effects) -> cc-cast-events; also sellsword-tricks, cc-job-systems
- Shield Bash (src/content/skills.ts, 5d8d334) (03#Status effects) -> built: src/content/skills.ts, 5d8d334

#### Threat and targeting
- Threat system (damage/heal/taunt add threat, decays) and CheckMonsterTarget (03#Threat and targeting) -> cc-threat

### 04-elements

#### General
- Element separate from damage kind; element table as data; set of 9 elements (src/sim/elements.ts, test/sim/damage.test.ts) (04#General) -> built: src/sim/elements.ts, test/sim/damage.test.ts
- Element levels 1-3 using attr_fix (elements.ts) (04#General) -> built: present in code
- Buildup rules (buildup.ts; statuses.ts) (04#General) -> built: present in code
- Fire->Burn, Frost->Chill->Freeze, Storm->Shock, Earth->Petrify, Venom->Poison, Radiant->Sear, Occult->Dread (statuses.ts) (04#General) -> built: present in code
- Spectral status/effect (statuses.ts: "Spectral has none yet") (04#General) -> cc-elements
- Storm chain to nearby targets (04#General) -> cc-elements
- Status changes defense element: Freeze=Frost1, Petrify=Earth1 (statuses.ts:32 becomes()) (04#General) -> built: present in code
- Skills/items changing defense element for a while (Benedictio); items with defenseElement bonus (cards "Bog Hag") (04#General) -> cc-elements
- Element fields (Volcano/Deluge/Violent Gale), weather fields, biome tile fields (04#General) -> cc-elements
- Shatter: frozen monsters leave no corpse (04#General) -> arcanist-cryomancy
- Corpses: dead merc stays until resurrected (built); monster corpses persisting until stage end and summoners raising them: NOT BUILT (Necromancer not built (04#General) -> be-monster-types (remainder: Corpses: dead merc stays until resurrected (built); monster corpses persisting until stage end and summoners raising)
- Each job max two native elements; Rare-only element items (04#General) -> ie-item-model (remainder: loot.ts: unclear; Rare "can carry an element" NOT verified)
- "Weak to my element" target priority toggle (04, 05) (04#General) -> cc-autonomy
- Friendly fire default off (damage default); Stage traps hurt anyone (src/sim/trap.ts, 7e71533) (04#General) -> built: src/sim/trap.ts, 7e71533
- Risks section (elements bloat loot; weak points ≥150%) (04#General) -> not code

### 05-mercenaries

#### Party size
- 4 mercs max, living or dead (game inventory/offer); bench of 2 and bench swap at Camp/Town NOT BUILT (05#Party size) -> ie-party (remainder: 4 mercs max, living or dead (game inventory/offer); bench of 2 and bench swap at Camp/Town NOT BUILT)
- Run starts with 1 merc of 3 offers (05#Party size) -> roster-balance (decided: 5 recruits by slot, doc 05 to be updated; today 4 recruits at Guild House (bd3e94c, src/content/guild or e2e/support/guild.ts))

#### Recruiting window
- Recruits only before phase 1 in story (Guild House), none after (bd3e94c, test/sim/recruits.test.ts); endless offers wandering mercs (Camps/Towns) (05#Recruiting window) -> built: bd3e94c, test/sim/recruits.test.ts
- Design says recruits in phases 1 and 2 via taverns/wanderers/events (05#Recruiting window) -> ie-party (remainder: implementation chose Guild-only; open doc/code mismatch)
- Tavern (05, 01 Town) (05#Recruiting window) -> ie-party

#### Wages and contracts
- Wages per Waystation, trait multipliers, ledger, morale effect (e18050b, src/game/wages.ts, test/sim/waystation.test.ts) (05#Wages and contracts) -> built: e18050b, src/game/wages.ts, test/sim/waystation.test.ts
- Contracts lasting several phases, renew/expire, countdown while dead (05#Wages and contracts) -> ie-party
- Betrayal; Guild recruiter renews/buys out (05#Wages and contracts) -> ie-party

#### Morale
- Morale 0-100, bands, events table, Loyal half-loss, desertion at Broken (src/sim/morale.ts, test/sim/morale.test.ts); party bar shows Low/Broken (05#Morale) -> built: src/sim/morale.ts, test/sim/morale.test.ts
- Event table: wage +/-, rest, elite +4, boss +15, merc dies -10, Dread -8 (05#Morale) -> cc-tuning (remainder: most built; verify elite/boss in morale.ts)

#### Stats
- STR/AGI/VIT/INT/DEX/WIL with level-up points (79e2bad, stats.ts): effects built for most; STR carry limit/ heavy armor slow NOT BUILT; AGI small move speed unverified (05#Stats) -> ie-item-model (remainder: STR/AGI/VIT/INT/DEX/WIL with level-up points (79e2bad, stats.ts): effects built for most)
- WIL instead of LUK (05#Stats) -> built: present in code

#### Discipline
- Value, start by job + traits, +1/level, effective = discipline x morale factor (morale.ts) (05#Discipline) -> built: present in code
- Effect 1 partially: target priorities and Save-for-elites follow table (morale.ts prioritiesFollowed/honoursElites) (05#Discipline) -> built: present in code
- Effect 2: traits vs toggles with (100-eff)/2 % chance + UI chance on sheet (doc: "waits for more trait conflicts") (05#Discipline) -> cc-autonomy
- Effect 3: shout response delay (src/sim/shout.ts responseDelay, test/sim/shout.test.ts) (05#Discipline) -> built: src/sim/shout.ts responseDelay, test/sim/shout.test.ts
- Discipline sources: Drill at Camp (+5), Bard skills, items/cards (Signet set piece built +5; sets only), failed bribe events (05#Discipline) -> cc-autonomy
- Discipline loss -10 unpaid built (05#Discipline) -> cc-autonomy (remainder: Discipline loss -10 unpaid built)

#### Derived / Requirements
- Derived stats computed in full (stats.ts) (05#Derived / Requirements) -> built: present in code
- Item STR/DEX requirements; heavy armor slowdown; merc carry limit from STR; equipment weight over limit (05#Derived / Requirements) -> ie-item-model

#### Skill trees
- 3 branches x 5 for Vanguard, Ranger, Cleric (7d942a6, src/content/trees.ts, test/sim/tree-skills.test.ts); other 11 jobs' trees NOT BUILT (09/12 detail) (05#Skill trees) -> built: 7d942a6, src/content/trees.ts, test/sim/tree-skills.test.ts

#### Autonomy
- Stance: Guard, Advance, Hold built (ai.ts Stance). Skirmish NOT BUILT. "Hold line at marked position" NOT BUILT (Hold = stay where it stands) (05#Autonomy) -> cc-autonomy (remainder: Stance: Guard, Advance, Hold built (ai.ts Stance). Skirmish NOT BUILT. "Hold line at marked position" NOT BUILT)
- Target priorities (built): Attacking bearer, Casters, Heralds, Lowest health, Elites, Nearest. NOT BUILT: Weak to my element, Marked by citizen (Mark) (05#Autonomy) -> cc-autonomy; also sb-bearer-kit (remainder: Target priorities (built): Attacking bearer, Casters, Heralds, Lowest health, Elites)
- Per-skill Auto / Elites / Off (SkillMode) (05#Autonomy) -> built: present in code
- Behavior flags: chase distance built (Toggles.chase); NOT BUILT: no friendly-fire-near-allies, retreat when health low (Cowardly trait only) (05#Autonomy) -> cc-autonomy (remainder: Behavior flags: chase distance built (Toggles.chase); NOT BUILT: no friendly-fire-near-allies)
- Belt use: drink at 50/30/15% (DRINK_AT; test/sim/potions.test.ts) (05#Autonomy) -> built: DRINK_AT; test/sim/potions.test.ts
- Traits: Brave, Cowardly, Greedy, Loyal, Glory-seeker, Veteran, Bloodthirsty, Devout built (src/content/traits.ts). NOT BUILT: Drunkard, Hates a job (05#Autonomy) -> cc-autonomy (remainder: Traits: Brave, Cowardly, Greedy, Loyal, Glory-seeker, Veteran, Bloodthirsty)
- Movement utility score (safety, distance, flanking) (05#Autonomy) -> cc-autonomy (remainder: ai.ts has flee/stance logic, no weighted utility score)

#### Death and resurrection
- Corpse persists until resurrected, Cleric Resurrection, Temple, torn bodies not resurrectable (unit.ts:779, town.ts, test/sim/town.test.ts, tree-skills.test.ts) (05#Death and resurrection) -> built: unit.ts:779, town.ts, test/sim/town.test.ts, tree-skills.test.ts
- Resurrection item (Yggdrasil Leaf) used by bearer or belt (05, 07 Utility items) (05#Death and resurrection) -> ie-utility-items
- Resurrected merc may gain an injury; Injuries and Temple treatment; scar bonuses (05#Death and resurrection) -> ie-party
- Dead mercs come along, take party slot (built); contract countdown while dead N/A (05#Death and resurrection) -> ie-party (remainder: Dead mercs come along, take party slot (built); contract countdown while dead N/A)
- If all mercs dead the citizen goes on alone (05#Death and resurrection) -> cc-autonomy (remainder: probably built (bearer survives?) unverified)

#### Jobs permanent / dismissal
- Dismiss a merc (no "dismiss" in src), unequip-before-dismiss (05#Jobs permanent / dismissal) -> ie-party

#### Jobs
- Vanguard, Ranger, Cleric (05#Jobs) -> built: present in code
- Sellsword, Warden, Duelist, Arcanist, Bard, Alchemist, Sapper, Beastmaster, Scout, Hexblade, Necromancer (11 jobs (05#Jobs) -> sellsword; also warden, duelist, arcanist, mj-outline-jobs
- "3 offers from simpler jobs" (current Guild offers 4 from 3 jobs) (05#Jobs) -> roster-balance (decided: 5 recruits by slot)

### 06-items-inventory

#### Inventory layers
- Citizen pack, slots+weight, >50% slow (src/game/inventory.ts, test: cards/potions tests) (06#Inventory layers) -> built: src/game/inventory.ts, test: cards/potions tests
- >90% no sprint/hide, >100% no pickup: no-pickup past limit built; sprint/hide NOT BUILT; capacity growth by background/upgrades/trinkets NOT BUILT (06#Inventory layers) -> sb-bearer-kit; also sb-backgrounds (remainder: >90% no sprint/hide, >100% no pickup: no-pickup past limit built; sprint/hide NOT BUILT)
- Merc loadout 8 slots + belt of 3 (src/sim/item.ts, unit.ts) (06#Inventory layers) -> built: src/sim/item.ts, unit.ts
- Belt "3 or 4" slots built 3; Two-handed weapons filling Offhand: unverified; citizen restocks belt in-fight adjacent (built, same fight rule) (06#Inventory layers) -> ie-item-model (remainder: Belt "3 or 4" slots built 3; Two-handed weapons filling Offhand: unverified)
- Caravan (mule/wagon unit, storage, can be attacked) (06#Inventory layers) -> ie-caravan
- Vault at Waystation (45eef22? / e18050b; test/sim/waystation.test.ts); 40 stacks. "Items in pack can be stolen or lost" NOT BUILT (no thief) (06#Inventory layers) -> built: 45eef22? / e18050b; test/sim/waystation.test.ts

#### Item data
- ItemBase: 16 bases, ilvl, weight, sockets, jobs (src/content/items.ts). Tier (Normal/Exceptional/Elite), weaponType (speed/reach) (06#Item data) -> ie-item-model (remainder: ItemBase: 16 bases, ilvl, weight, sockets, jobs (src/content/items.ts). Tier (Normal/Exceptional/Elite))
- ItemCopy: base rolls, affixes, sockets, refine, quantity built; `identified`, `cursed` NOT BUILT (06#Item data) -> ie-identify-curse (remainder: ItemCopy: base rolls, affixes, sockets, refine, quantity built; `identified`, `cursed` NOT BUILT)
- Stacking only when equal (inventory.ts) (06#Item data) -> built: present in code

#### Quality
- Inferior, Normal, Superior, Magic, Rare built (src/gen/loot.ts, sim/item.ts); Unique built (a80d03a); Squad set built (b2b102c); Cursed NOT BUILT (06#Quality) -> ie-identify-curse (remainder: Inferior, Normal, Superior, Magic, Rare built (src/gen/loot.ts, sim/item.ts); Unique built (a80d03a))
- Rare "can carry element" (06#Quality) -> ie-item-model (remainder: not verified; socket limits per quality and per slot built (in loot.ts))
- Cursed items + Temple curse removal (06#Quality) -> ie-identify-curse

#### Squad sets
- Pieces counted across living mercs, 2/3/4 bonuses, Oath of the Iron Company, Rites of the Pale Choir, Warden's Watch (src/content/sets.ts, test/sim/sets.test.ts) (06#Squad sets) -> built: src/content/sets.ts, test/sim/sets.test.ts
- Iron Company 4-piece bonus: design Ward after fight, built as -15% damage to bearer (needs all-damage Ward); Banner morale bonus waits for morale bonuses (06#Squad sets) -> ie-loot-fixes (remainder: Iron Company 4-piece bonus: design Ward after fight, built as -15% damage to bearer (needs all-damage Ward))
- Pale Choir 3-piece: "once per stage" built as once per area (06#Squad sets) -> ie-loot-fixes (remainder: Pale Choir 3-piece: "once per stage" built as once per area)

#### Affixes
- 15 prefix/suffix affixes in tiered groups gated by item level (src/content/affixes.ts, test/sim/affixes.test.ts) (06#Affixes) -> built: src/content/affixes.ts, test/sim/affixes.test.ts
- CheckItemRoll hook; backgrounds changing rolls (06#Affixes) -> ie-item-model
- Bonus union: stat, addDamage, reduceDamage, attackElement, onHit buildup built via bonus keys (sim/stats.ts) (06#Affixes) -> ie-item-model (remainder: Bonus union: stat, addDamage, reduceDamage, attackElement, onHit buildup built via bonus keys (sim/stats.ts))

#### Sockets and cards
- Sockets 0-4, Smith adds socket (75%, break on fail) (town.ts, test/sim/town.test.ts) (06#Sockets and cards) -> built: town.ts, test/sim/town.test.ts
- Cards: 11 monster cards + gems (45eef22, src/content/cards.ts, test/sim/cards.test.ts); card drop 3%/25%/100% (doc says 5%: doc/code mismatch) (06#Sockets and cards) -> built: 45eef22, src/content/cards.ts, test/sim/cards.test.ts
- Card families: Stat, Damage category, Reduction category (partial), Status on hit (Crawler, Saint), Trade-off (boss cards) (06#Sockets and cards) -> built: present in code
- Families: Defense element, Autocast on attack / when hit, Skill grant, Mana/health gain, Loot, Combo (cards.ts none; "Not yet" per doc) (06#Sockets and cards) -> ie-cards
- Autocast rules (UnitTriggerSkill, PRD chance, per-skill toggles for granted skills) (06#Sockets and cards) -> cc-autocast
- Card collector (remove cards from sockets) (06#Sockets and cards) -> ie-cards
- Cards fitting only one slot kind - built (Fits column); but "slot limit table" per-slot sockets partially (loot.ts) (06#Sockets and cards) -> ie-item-model

#### Crafting
- Materials pouch built (Chitin, Bone, Rags, essences; src/content/materials.ts); doc names Leather/Ore/Ectoplasm/Ingot refining NOT BUILT (06#Crafting) -> ie-crafting (remainder: Materials pouch built (Chitin, Bone, Rags, essences; src/content/materials.ts))
- Salvage into materials (built: Iron, Radiant Essence) (06#Crafting) -> ie-crafting (remainder: Salvage into materials (built: Iron, Radiant Essence))
- Recipe drops / Recipe Book / Towns selling recipes (all recipes known) (06#Crafting) -> ie-crafting
- Synthesis bench at Town (d24ad70, src/content/recipes.ts: potions, gem, Blessing, reforge) (06#Crafting) -> built: d24ad70, src/content/recipes.ts: potions, gem, Blessing, reforge
- Crafting at Camps (consumables, Alchemist) (06#Crafting) -> ie-crafting
- Recipe categories: resurrection items, bombs, identify scrolls, bags/upgrades, equipment from fixed base + 1-2 affixes, rerolls (socket add via Smith exists) (06#Crafting) -> ie-crafting
- Crafting uses `craft` stream (built) (06#Crafting) -> ie-crafting (remainder: Crafting uses `craft` stream (built))

#### Loot budget
- Drop rates built (30% equip, elites 2, boss 4, gold 40%, cache of 3). Doc's "pick 1 of 3 rewards after each fight" is NOT BUILT as such (06#Loot budget) -> ie-loot-fixes (remainder: Drop rates built (30% equip, elites 2, boss 4, gold 40%, cache of 3). Doc's "pick 1 of 3 rewards after each fight" is)
- Recruits arrive with phase-suited gear (06#Loot budget) -> ie-loot-fixes (remainder: starter gear fixed)
- Focus per phase table; target at final boss (balance targets; no sim test: test/gen/balance.test.ts may check some) (06#Loot budget) -> not code

#### Refine
- +0..+10, safe to +4, fail breaks with cards, Blessing -1 level (town.ts, test/sim/town.test.ts) (06#Refine) -> built: town.ts, test/sim/town.test.ts
- Refine rates final numbers (open in 08) (06#Refine) -> cc-tuning

#### Identification
- Unidentified Rare/Unique/Set/Cursed items, identify scroll, Appraiser, Scholar background (doc: "Rares drop identified for now") (06#Identification) -> ie-identify-curse

#### Requirements and item level
- Item level from stage/monster, affix level gate (loot.ts) (06#Requirements and item level) -> built: present in code
- Base tiers Exceptional/Elite; STR/DEX requirements (06#Requirements and item level) -> ie-item-model

#### Unique item examples
- 9 uniques (src/content/uniques.ts); Widow's Lantern reveals invisible enemies: NOT BUILT; Rimecaller NOT BUILT (06#Unique item examples) -> built: src/content/uniques.ts

#### Durability
- No durability (decided) (06#Durability) -> not code
- Strip/Break enemies that disable items for a stage (07 Stripper) (06#Durability) -> be-monster-types

#### Potions (in-game section)
- Healing/Mana/Greater potions, pulses, belt, auto drink, bearer Q (5b70469, test/sim/potions.test.ts) (06#Potions (in-game section)) -> built: 5b70469, test/sim/potions.test.ts

### 07-citizen-npcs-enemies

#### Citizen actions
- Move, pick up, hand off (in-fight rule), open chests (cache), talk to NPCs (wanderers, paymaster, town) (07#Citizen actions) -> built: present in code
- Open doors / pull levers by citizen? partly: Labyrinth gates, levers, keys exist (7e71533) (07#Citizen actions) -> gs-labyrinth
- Shouts Rally, Focus, Fall back, Hold with cooldowns, keys Z/F/X/C (d56f1e5, src/sim/shout.ts, test/sim/shout.test.ts, e2e/shouts.spec.ts) (07#Citizen actions) -> built: d56f1e5, src/sim/shout.ts, test/sim/shout.test.ts, e2e/shouts.spec.ts
- Mark: Focus stands in for it; persistent mark + "Marked by the citizen" toggle NOT BUILT (07#Citizen actions) -> sb-bearer-kit (remainder: Mark: Focus stands in for it; persistent mark + "Marked by the citizen" toggle NOT BUILT)
- Use a resurrection item on a corpse (07#Citizen actions) -> ie-utility-items
- Hide in tall grass/shadows (07#Citizen actions) -> sb-bearer-kit
- Sprint (07#Citizen actions) -> sb-bearer-kit

#### Utility items
- Smoke bomb, Flare, Caltrops, Bandage, Resurrection item (src grep: only ranger.ts trap skills) (07#Utility items) -> ie-utility-items
- Lantern: bearer has a lantern (light, notice range); "needed in night phases", "monsters drawn to it" (07#Utility items) -> gs-phase-modifiers; also gs-terrain-lantern (remainder: lantern light built (render/light.ts, ai.ts notice); night phases NOT BUILT)

#### Backgrounds
- All six backgrounds (Merchant, Noble, Scholar, Physician, Fugitive, Pilgrim) and picking one at run start (07#Backgrounds) -> sb-backgrounds

#### Story hook
- Writ/letter hook: the Writ exists (finale, Creditor); "enemies ignore mercs and go for citizen" built via Assassin kind; Factions chasing NOT BUILT (07#Story hook) -> gs-phase-modifiers (remainder: Writ/letter hook: the Writ exists (finale, Creditor); "enemies ignore mercs and go for citizen" built via Assassin)
- Story flavor (07#Story hook) -> not code

#### NPCs
- Wandering merc (endless only), Refugees (Escort), Quartermaster (Guild stall + Market), Blacksmith (Smith), Priest (Temple resurrect) (07#NPCs) -> built: present in code
- Deserter, Rival escort party, Appraiser, Card collector, Cartographer, Fortune teller, Smuggler, Toll gate, Guild recruiter (contracts), The Stranger (07#NPCs) -> sb-clues; also ie-identify-curse, ie-cards, ie-npc-services, gs-node-kinds, ie-party
- Priest removes curses / treats injuries (resurrect only) (07#NPCs) -> ie-identify-curse (remainder: Priest removes curses / treats injuries (resurrect only))

#### Enemies
- Assassin (Hollowed), Healer (Cantor), Summoner (Abbess, Brood Mother, captains), Shielder (Hollow Shieldbearer 162891b), Bomber (Bloat 162891b) (07#Enemies) -> built: Bloat 162891b
- Kidnapper, Thief, Stripper, Flyer type (Flyer counter text exists in skills but no flyer monsters), Spectral monsters as a type (07#Enemies) -> be-monster-types
- Summoner "raises corpses" NOT BUILT (spawns new); Frost shatters N/A (07#Enemies) -> be-monster-types (remainder: Summoner "raises corpses" NOT BUILT (spawns new); Frost shatters N/A)

#### In-game monster table
- Hollow soldier, Penitent, Cantor, Hollowed, Crawler, Husk, Mite, Gatekeeper, Abbess, Hollowed Saint, Brood Mother (src/content/roster.ts, bestiary.ts, bosses.ts (07#In-game monster table) -> built: src/content/roster.ts, bestiary.ts, bosses.ts, test/sim/boss*.test.ts
- Beyond-doc: archers, slingers, shieldbearers, bloats, mini-bosses (c7c5e4c), captains (a93f2da), elite affixes (16e165a), horn-bearers (8879534) (07#In-game monster table) -> built: 8879534
- Noticing/waking packs, Dread, elites (+150% hp etc.) tests (07#In-game monster table) -> built: present in code
- Boss tests (3 mercs win >=5/6) test/sim/bosses.test.ts, test/sim/boss.test.ts (07#In-game monster table) -> built: present in code
- Casters and healers priority (07#In-game monster table) -> built: present in code

#### Monster data
- Race list: Beast, Undead, Demon, Human, Insect, Construct, Plant, Spirit, Dragon (07#Monster data) -> be-monsters-upper (remainder: Race enum built (types.ts:27) (full set unverified); defense element/level, card drop built; hidden until beaten built)

### 08-open-questions

#### Still open
- Lore details open (10-lore) (08#Still open) -> not code
- Stage questions open (11-stages) (08#Still open) -> not code
- Final numbers for element table, Discipline thresholds, refine rates (08#Still open) -> cc-tuning (remainder: first-guess numbers in code (elements.ts, morale.ts, town.ts); not tuned; test/gen/balance.test.ts exists)

#### Answered (each implies code; status)
- No reactions between statuses; Spectral in v1 (affinity only; no status); mana only from items/cards (no source built); no downed state; friendly fire off (08#Answered (each implies code; status)) -> built: present in code
- Sockets per item (built), card depth "full families incl. autocast" (autocast NOT BUILT), recipes unlimited (all known), card drop 5%/25%/always (code uses 3%) (08#Answered (each implies code; status)) -> cc-autocast; also cc-tuning (remainder: Sockets per item (built), card depth "full families incl. autocast" (autocast NOT BUILT))
- Vault, refine failure rules, crafting basics, no meta unlocks, squad sets, compendium hiding, suspend/resume (08#Answered (each implies code; status)) -> built: present in code
- Discipline (built mostly), job changes none (no dismiss either), skill trees 3x5 (3 of 14 jobs) (08#Answered (each implies code; status)) -> sellsword; also mj-outline-jobs (remainder: Discipline (built mostly), job changes none (no dismiss either), skill trees 3x5 (3 of 14 jobs))
- 4 phases, no stage time limit (08#Answered (each implies code; status)) -> built: present in code
- Art by Claude; visual tone (08#Answered (each implies code; status)) -> not code

### 09-skill-trees

#### Rules
- 1 skill point per level after 1, recruits arrive unspent (09#Rules) -> build-rules (replaced by shards, 1 per level, doc 16; built today as skill points in src/sim/progress.ts)
- Skills 5 ranks, capstones 1 rank (09#Rules) -> build-rules (replaced by spell ranks 1 to 10 capped at 1 + level / 2, doc 16; built today as trees.ts maxRank())
- Tier unlock levels 1/4/8/12/16 (09#Rules) -> job-registry (removed with the tree path; spells are known from level 1, doc 16)
- Prerequisite: 1 rank in previous node of branch (09#Rules) -> job-registry (removed with the tree path, doc 16)
- Synergies (Diablo 2 style) (09#Rules) -> dropped: the build-variety gate chose spells with elite upgrades (doc 16); upgrades take the synergies' role
- Trainer in a Town that resets a merc's points for gold (09#Rules) -> mj-trainer-synergies
- Any active skill can appear on an autocast card (09#Rules) -> not code

#### Vanguard
- Bulwark: Challenge, Shield Wall, Bastion, Rampart, Immovable (trees.ts; test "Vanguard" block in tree-skills.test.ts) (09#Vanguard) -> built: trees.ts; test "Vanguard" block in tree-skills.test.ts
- Breaker: Sunder, Crush, Shield Bash, Fault Line, Earthshaker (same) (09#Vanguard) -> built: present in code
- Oathkeeper: Vow, Intercept, Shared Burden, Banner, Last Line (same) (09#Vanguard) -> built: present in code
- Immovable: spec says no knockback/stun/fear; built blocks stun/Petrify/Dread only (no knockback system exists) (09#Vanguard) -> cc-job-systems (remainder: Immovable: spec says no knockback/stun/fear; built blocks stun/Petrify/Dread only (no knockback system exists))
- Consecrate "corpses inside cannot be raised" and Purge "removes corruption each phase start" (Cleric) (09#Vanguard) -> mj-trainer-synergies; also sb-corruption (remainder: see Cleric)

#### Ranger
- Hawkeye: Aimed Shot, Pin Down, Eagle Eye, Piercing Arrow, Killshot (trees.ts; test "Killshot") (09#Ranger) -> built: trees.ts; test "Killshot"
- Trapper: Snare, Rearguard, Bait, Spike Field, Killing Ground (09#Ranger) -> built: present in code
- Stormcaller: Charged Arrow, Static, Arc Volley, Lightning Rod, Thunderhead (09#Ranger) -> built: present in code
- Pin Down grounds flyers (09 text) (09#Ranger) -> be-monster-types (remainder: roots any enemy; flyers do not exist)
- Eagle Eye "+accuracy against flyers" (09#Ranger) -> be-monster-types (remainder: plain +3 accuracy)

#### Cleric
- Mercy: Heal, Renew, Cleanse, Resurrection, Martyr (trees.ts; test "Martyr") (09#Cleric) -> built: trees.ts; test "Martyr"
- Sanctuary: Ward, Sacred Ground, Wall of Faith, Veil, Aegis (tests) (09#Cleric) -> built: tests
- Inquisition: Smite, Holy Light, Turn Undead, Consecrate (burn), Purge (damage part) (tests) (09#Cleric) -> built: tests
- Consecrate: corpses inside cannot be raised (09#Cleric) -> mj-trainer-synergies
- Purge: removes corruption from every merc at phase start (09#Cleric) -> sb-corruption
- Aegis: "citizen always has a Ward refilled outside combat" built as fill 3 s out of fight (test "Aegis fills the bearer's Ward") (09#Cleric) -> inbox: Aegis ward refill is already built per the survey; no node owns the leftover

#### Sellsword - whole job
- Job + roster template + recruit pool entry (HIREABLE = vanguard, ranger, cleric only, recruits.ts:16; MERCS in roster.ts) (09#Sellsword - whole job) -> sellsword
- Hired Blade: Cleave, Second Wind, Rush, Weapon Habit, Veteran of Many Wars (09#Sellsword - whole job) -> sellsword
- Coin: Hazard Pay, Pocket Change, Bribe, Haggler, Paid in Full (needs wage hooks: game/wages.ts, town prices) (09#Sellsword - whole job) -> sellsword-coin
- Dirty Tricks: Pocket Sand (needs Blind status), Hamstring, Low Blow, Play Dead, Cutpurse (needs buff steal) (09#Sellsword - whole job) -> sellsword-tricks

#### Warden
- Job + all 15 skills. Shadow: Interpose, Tether, Retaliate, Cover, Living Shield. Watchman: Sentry, Tripwire, Read the Room, Night Eyes (09#Warden) -> warden; also warden-watchman, warden-executioner

#### Duelist
- Job + Blade (Lunge, Riposte, Flurry, Bleed Out, Thousand Cuts), Showmanship (Flourish, Taunt the Proud, Duel, Crowd Pleaser, Grand Duel), Footwork (Sidestep, Feint (09#Duelist) -> duelist; also duelist-showmanship, duelist-footwork

#### Arcanist
- Job + Pyromancy (Firebolt..Inferno), Cryomancy (Frost Shard..Shatterpoint), Weave (Mana Flow..Controlled Burn). Only items reference the job name (09#Arcanist) -> arcanist; also arcanist-cryomancy, arcanist-weave

#### Other jobs outlines
- Bard, Alchemist, Sapper, Beastmaster, Scout, Hexblade, Necromancer: jobs, branches, capstones (outline only, no full trees either) (09#Other jobs outlines) -> mj-outline-trees; also mj-outline-jobs

#### Design notes
- Every job has a skill about the citizen; capstones that change toggles; corpses and money matter (09#Design notes) -> not code

#### "In the game so far" claims, spot-checked
- XP 10/monster level, 35 elite, 150 boss, 20*level^1.5 (sim/progress.ts, test/sim/progress.test.ts) (09#"In the game so far" claims, spot-checked) -> built: sim/progress.ts, test/sim/progress.test.ts
- Skills tab and Stats tab, + marker, level-up ring (src/ui/skill-tree.tsx, stat-sheet.tsx, merc-panel.tsx) (09#"In the game so far" claims, spot-checked) -> built: src/ui/skill-tree.tsx, stat-sheet.tsx, merc-panel.tsx
- Mana kept back for healing skills; zones (src/sim/zone.ts, test "zones") (09#"In the game so far" claims, spot-checked) -> built: src/sim/zone.ts, test "zones"
- "No monster shoots yet" is out of date: Hollow Archer, Penitent Slinger exist (git efbb9a9, test/sim/ranged.test.ts); Bastion/Rampart/Veil tested against arrows (09#"In the game so far" claims, spot-checked) -> roster-balance (remainder: "No monster shoots yet" is out of date: Hollow Archer, Penitent Slinger exist (git efbb9a9, test/sim/ranged.test.ts))

### 10-lore

#### The twist
- Citizen becomes the Creditor at the tomb; player loses control (10#The twist) -> built: content/creditor.ts reveal(), game.ts:1952, test "turns the bearer into the Creditor"
- Tomb below the Hollowed Saint, closed chamber, no way out (10#The twist) -> built: test "takes place in a closed tomb"; gen/stage.ts, `?tomb`
- Player can only inspect mercs by plate/number key; R restarts (game.ts, ui/app.tsx) (10#The twist) -> built: present in code
- Dead mercs rise on Creditor's side unless torn; Cowardly+Low morale flee; living fight on (creditor.ts reveal(); test "raises the dead...") (10#The twist) -> built: present in code
- Skills that refer to the citizen do nothing with no bearer (test "fought by the living mercs, with no bearer left") (10#The twist) -> built: test "fought by the living mercs, with no bearer left"
- Creditor uses the bearer's healing potions below 40% (roster.ts creditor, test creditor) (10#The twist) -> built: roster.ts creditor, test creditor
- Souls feed Creditor: only "a merc dies" source (6% hp/damage per soul, creditor.ts SOUL_SHARE, game.ts:893). Missing sources: shrine curse, Pilgrim shrine use (10#The twist) -> sb-souls (remainder: Souls feed Creditor: only "a merc dies" source (6% hp/damage per soul, creditor.ts SOUL_SHARE)
- Cursed item type, shrines/curses, Pilgrim-shrine souls (no "curse"/"shrine" in src/; Pilgrim Staff/Shroud are plain items, items.ts:85,181) (10#The twist) -> sb-souls
- Corruption system (spreads to mercs near citizen; cleansing) (no "corrupt" in src/) (10#The twist) -> sb-corruption
- Creditor "raises unresurrected" and "takes corrupted mercs" (10#The twist) -> sb-corruption
- Creditor's Collect skill (creditor.ts COLLECT) (10#The twist) -> built: present in code
- Balance tests: clean win, 2 raised loses (test/sim/creditor.test.ts "final fight") (10#The twist) -> built: test/sim/creditor.test.ts "final fight"

#### The Old King
- Regalia pieces (Signet phase 2, Scepter phase 3, Crown phase 4) as heavy pack items; "regalia" only in sets.ts as a set name (10#The Old King) -> sb-regalia
- Old King's ghost ally in final fight (bind, seal-stun every 30 s, free a taken merc); banish (10#The Old King) -> sb-regalia
- Compendium entries for regalia pieces; thieves stealing a piece; vault keeps it (10#The Old King) -> sb-regalia

#### Endings
- Mercs win: "The Creditor is sealed again" / mercs lose: "The Creditor rises"; compendium records endings (compendium.ts:42,142,249; endRun game.ts:517) (10#Endings) -> built: present in code
- Compendium shows Creditor after beaten or risen (compendium.ts:251,283), built; per-background ending lines not built (open choice) (10#Endings) -> sb-backgrounds (remainder: Compendium shows Creditor after beaten or risen (compendium.ts:251,283), built)

#### Clues
- Cleric holy magic does nothing to Penitents (Penitent element Radiant, roster.ts:170; Radiant immune table elements.ts) (10#Clues) -> built: present in code
- Church eye banners along descent (gen/stage.ts:1315) (10#Clues) -> built: present in code
- Every dead bearer has same Writ, only name differs (events.ts deadBearer "Read its Writ") (10#Clues) -> built: present in code
- Writ grows warm at Penitents' blessing event (events.ts:241) (10#Clues) -> built: but not near Occult altars generally
- Many monsters ignore mercs and go for citizen: Hunt.Bearer default and Assassin exist (ai.ts:73); roster assigns per monster; broadly built (10#Clues) -> sb-clues (remainder: Many monsters ignore mercs and go for citizen: Hunt.Bearer default and Assassin exist (ai.ts:73))
- Dead mercs do not rot / corpses wait (no corpse-persist rule beyond revive; merc dead bodies stay for resurrection) (10#Clues) -> sb-clues
- Occult corruption spreads to mercs near citizen (10#Clues) -> sb-corruption
- The Stranger across runs warning the party (events.ts "stranger" is only the dice gambler) (10#Clues) -> sb-clues
- Events that let the citizen read part of the Writ progressively (only the dead-bearer read, one flavor) (10#Clues) -> sb-clues
- Shrines as Creditor's altars (no Shrine area; stages says "Not yet: Shrine areas") (10#Clues) -> gs-node-kinds; also sb-souls
- Earlier bearers' remains as repeated finds (only one event, deadBearer) (10#Clues) -> sb-clues

#### World / structure
- Four layers (Marches, Rift Road, Undercroft, Sunken Crown) (10#World / structure) -> built: gen/layers.ts
- Paths collapse behind (gen/place.ts, "Collapse" crossing rule) (10#World / structure) -> built: present in code
- Waystations pay wages, vault strongbox (game/wages.ts, ui/station.tsx, test/sim/waystation.test.ts) (10#World / structure) -> built: game/wages.ts, ui/station.tsx, test/sim/waystation.test.ts
- Enemy factions per layer: Hollow soldiers, Penitents, Blight, Hollowed (roster.ts, bestiary.ts) (10#World / structure) -> built: present in code
- Hollowed are Occult and Radiant hurts them: roster has hollowed, bestiary lore text; verify element Occult in roster.ts:193 (assumed) (10#World / structure) -> roster-balance (remainder: Hollowed are Occult and Radiant hurts them: roster has hollowed, bestiary lore text)
- Guild promises a reward per background (pardon, fortune, title, cure); bearer backgrounds / Pilgrim background (no bearer background system in src/) (10#World / structure) -> sb-backgrounds
- Dreams grow clearer / the pull (no code) (10#World / structure) -> sb-clues
- Turning back voids contract (not applicable: no backtrack) (10#World / structure) -> dropped: no backtracking exists, the rule has nothing to apply to
- Different bearer per seed identity (seed decides who) (10#World / structure) -> sb-backgrounds
- Surface Temple = Church choice (open) (10#World / structure) -> inbox: open design choice (Surface Temple or Church), no node decides it
- Titles not names; twist framing; "what player believes"; Church history; fresh-run vs later-run framing (10#World / structure) -> not code
- Later-run preparation hooks (compendium shows Creditor) (10#World / structure) -> sb-clues

### 11-stages

#### Goal and node types
- Reach exit, leaving early skips loot (game.ts exit handling) (11#Goal and node types) -> built: present in code
- Combat/Elite/Ambush/Refugee(Escort)/Camp/Town/Event/Waystation as areas (gen/graph.ts, objective.ts; tests ambush, escort) (11#Goal and node types) -> built: gen/graph.ts, objective.ts; tests ambush, escort
- Boss as open field (changed from closed arena): bosses.ts, test/sim/boss.test.ts, bosses.test.ts (11#Goal and node types) -> built: present in code
- Treasure stage ("Vault" objective built: commit 45c7e09, test/game/vault.test.ts) (11#Goal and node types) -> gs-node-kinds (remainder: but no Treasure node kind; it is a fight objective)
- Shrine area (stage says "Not yet") (11#Goal and node types) -> gs-node-kinds
- Hidden nodes / Scout / Cartographer reveal (11#Goal and node types) -> gs-node-kinds

#### Layout / terrain
- Size 46-54 tiles square (stage.ts) rather than 48x32..64x48 (11#Layout / terrain) -> built: design changed; sizes tuned
- Ground plans Grove, Cavern, Bridges, Halls (gen/fields.ts, test/gen/fields.test.ts) (11#Layout / terrain) -> built: gen/fields.ts, test/gen/fields.test.ts
- Open ground, choke points (walls with openings), obstacles blocking sight/projectiles (nav.ts, test/sim/sight.test.ts) (11#Layout / terrain) -> built: nav.ts, test/sim/sight.test.ts
- Shallow water slows 60% (footing.ts, test/game/footing.test.ts) (11#Layout / terrain) -> built: footing.ts, test/game/footing.test.ts
- Chasm edges / bridges (Bridges plan) (11#Layout / terrain) -> built: present in code
- Ledges raised ground reached by ramps (11#Layout / terrain) -> gs-terrain-ledges
- Deep water, Frost freezes it (11#Layout / terrain) -> gs-terrain-deep
- Tall grass and fungus the citizen can hide in (only decorative dead grass, floor.ts:33,243) (11#Layout / terrain) -> gs-terrain-grass
- Embers, blossoms (extras beyond doc; commit da6acca, 1d814ed) (11#Layout / terrain) -> built: extras beyond doc; commit da6acca, 1d814ed

#### Points of interest
- Entrance/exit (signpost, torches), horn posts (game/alarms.ts, test/game/alarms.test.ts), cache chest, trap field (Labyrinth traps; hazards.ts), monster lair (stage.ts) (11#Points of interest) -> built: game/alarms.ts, test/game/alarms.test.ts
- Brazier circle the citizen can light: braziers are decor on the stair (stage.ts:1376, renderer.ts:775), citizen cannot light them (11#Points of interest) -> gs-terrain-braziers (remainder: Brazier circle the citizen can light: braziers are decor on the stair (stage.ts:1376, renderer.ts:775))
- Alarm bell/horn: horn posts built; "Sapper destroys bell" is job-gated, no Sapper (11#Points of interest) -> mj-outline-jobs (remainder: Alarm bell/horn: horn posts built; "Sapper destroys bell" is job-gated, no Sapper)

#### Building a stage (algorithm)
- Steps 1-8: size, entrance/exit, places, noise terrain, reachability carve, choke and open check, threat-budget packs, phase modifiers (stage.ts, fields.ts (11#Building a stage (algorithm)) -> built: stage.ts, fields.ts, tests stage/fields/objective/balance
- Phase modifiers "night or rain": mutators Darkness etc. built (game/mutators.ts, test/game/mutators.test.ts); rain not built (11#Building a stage (algorithm)) -> gs-phase-modifiers (remainder: Phase modifiers "night or rain": mutators Darkness etc. built (game/mutators.ts, test/game/mutators.test.ts))

#### Map
- Fog hides unexplored; explored stays (render/fog.ts) and map screen of room graph (ui/map.tsx) (11#Map) -> built: present in code
- Map shows points of interest seen / terrain automap; M map shows room graph, not terrain automap of the field (11#Map) -> gs-world-flow (remainder: Map shows points of interest seen / terrain automap; M map shows room graph, not terrain automap of the field)

#### Monsters
- Packs, threat budget, idle/alert (stage.ts, ai.ts), noise/heard (unit heard), pack wake radius (ai.ts PACK_RADIUS), "chase" toggle waking next pack (ai.ts:36) (11#Monsters) -> built: present in code
- Patrolling pack state: "idle, patrolling or alert" (11#Monsters) -> gs-terrain-patrols (remainder: no patrol (11 says "Not yet: patrols"))
- Heralds run to horn, kill herald stops alarm, "Heralds" priority (alarms.ts, ai.ts, test/game/alarms.test.ts) (11#Monsters) -> built: alarms.ts, ai.ts, test/game/alarms.test.ts
- Reinforcements from spawn holes (alarms.ts) (11#Monsters) -> built: present in code

#### Light and vision
- Lantern circle (bearer 7), merc smaller sight, dark hides monsters (render/light.ts, fog.ts, unit.ts sight) (11#Light and vision) -> built: present in code
- Night phases shrink light: Darkness mutator halves sight; no per-phase night (11#Light and vision) -> gs-phase-modifiers (remainder: Night phases shrink light: Darkness mutator halves sight; no per-phase night)
- Some monsters drawn to lantern; citizen shades lantern to hide (11#Light and vision) -> gs-terrain-lantern
- Warden Night Eyes (job missing) (11#Light and vision) -> warden-watchman

#### Citizen in a stage
- Move (click + WASD, game.ts:2457), stand, pick up loot, interact (levers, gates, chests, corpses), hand over potions, shout (shout.ts: Rally, Focus, Fall back, Hold) (11#Citizen in a stage) -> built: present in code
- Greedy mercs pick up loot (traits.ts) (11#Citizen in a stage) -> built: present in code

#### Traps and hazards
- Spike grates, fire vents, arrow slits, swinging blades, collapsing floors (11#Traps and hazards) -> built: HazardKind in src/gen/stage.ts, src/sim/trap.ts, test/game/collapse.test.ts
- Flamethrowers, pressure plates, arrow launchers (11#Traps and hazards) -> gs-labyrinth (commit 216185b is design only)
- Scout disarms traps; Warden Sentry reveals hidden traps; deep water slow/Frost freeze; falling rocks, pits (not seen) (11#Traps and hazards) -> gs-terrain-hazards; also gs-terrain-deep, also warden-watchman, mj-outline-jobs

#### Seamless connections
- Forks with signpost, exits close the other road, crossing edge to edge, collapse after 4 s, mercs/dead brought along, loot lost (gen/place.ts, game.ts (11#Seamless connections) -> built: gen/place.ts, game.ts; commits fce5a86, b547bea; test/gen/place.test.ts
- Alert monsters follow across (verify: monsters "wait in it from then on" per doc; follow-across is PARTIAL) (11#Seamless connections) -> built: present in code
- Rewards at exit cache (bonus.ts, gen/loot.ts, commit 65a53cf) (11#Seamless connections) -> built: bonus.ts, gen/loot.ts, commit 65a53cf
- Landmark foreshadowing (lights of a Town, smoke of Camp, glow of Shrine) (11#Seamless connections) -> gs-terrain-landmarks (remainder: signposts show names; no distant landmarks)
- Loading: area built near entrance on crossing; generation is by seed stream. "descent into next layer" transition not a loading cutscene (11#Seamless connections) -> gs-world-flow (remainder: the way down stays a cut)
- Pause on inventory/merc sheet/map (game.ts:454) (11#Seamless connections) -> built: present in code

#### Shortcuts
- Shortcut paths skipping layers; Smuggler; Scout Trailblazer; Sapper-breakable obstacle (11#Shortcuts) -> gs-node-kinds

#### Controls
- Click + WASD; merc opens by plate/number key only (commit 495fb30) (11#Controls) -> built: commit 495fb30
- Rebindable keys and settings screen (no binding code in src/) (11#Controls) -> gs-controls

#### Not in design but built (context)
- Objectives Hunt, Horde, Labyrinth (course of traps), Escort, Vault, Ritual, Collapse, Ambush; captains; mutators; bonus challenges (11#Not in design but built (context)) -> built: beyond-doc context line in the survey, already in code

### 12-new-jobs

#### New jobs (all NOT BUILT; no code for any)
- Lamplighter: Beacon (Wide Light, Flare, Steady Flame, Brazier, Dawn), Kindling (Oil Flask, Pitch, Firebreak, Wick, Pyre), Wayfinding (Lead the Way, Lantern Post (12#New jobs (all NOT BUILT; no code for any)) -> mj-lamplighter
- Berserker: Warcries (Howl, Battle Cry, Shout, Battle Orders, War Cry), Fury (Bloodlust, Frenzy, Leap Attack, Whirlwind, Berserk), Hide (Thick Skin, Unyielding (12#New jobs (all NOT BUILT; no code for any)) -> mj-berserker
- Monk: Spheres, Combos, Stillness (Snap, Blade Catch, Mantra...) (12#New jobs (all NOT BUILT; no code for any)) -> mj-monk
- Sage: Endow, Breaker, Study (Land Protector...) (12#New jobs (all NOT BUILT; no code for any)) -> mj-sage
- Medium: Links, Rites (Last Rites, Requiem), Haunting (Possess, Haunt) (12#New jobs (all NOT BUILT; no code for any)) -> mj-medium
- Arbalist: Siege (Ballista, Siege Bolt), Marksman, Overwatch (12#New jobs (all NOT BUILT; no code for any)) -> mj-arbalist
- Signature silhouettes for the 6 jobs plus Sellsword/Warden/Duelist/Arcanist etc. (render/rig.ts, sprites.ts have bearer/vanguard/ranger/cleric rigs only) (12#New jobs (all NOT BUILT; no code for any)) -> sellsword; also warden, duelist, arcanist and each later job node
- Starting offers by slot (guard/striker/support/one more): recruits.ts HIREABLE has 3 jobs and a FIGHTERS rule (12#New jobs (all NOT BUILT; no code for any)) -> roster-balance
- Deserter event / endless wandering mercs draw from every job (deserter event built, draws from 3 jobs; widens when jobs exist) (12#New jobs (all NOT BUILT; no code for any)) -> roster-balance

#### What the engine needs (each row)
- Party buffs with a duration (12#What the engine needs (each row)) -> cc-job-systems (remainder: Banner (zone) and shouts/Rally exist; statuses have duration/modifiers (status.ts))
- Blind status (not in statuses.ts) (12#What the engine needs (each row)) -> sellsword-tricks
- Fear on monsters (12#What the engine needs (each row)) -> cc-job-systems (remainder: `flees` flag and Dread status (status.ts:25, statuses.ts:174) work on any unit; no "frighten non-boss monsters" skill)
- Light radius as a stat (12#What the engine needs (each row)) -> cc-job-systems (remainder: Unit.sight exists (unit.ts:44,58, bearer 7, mercs 4.5); not a modifier stat skills can change)
- Hidden monsters (invisible/disguised/stealth) (12#What the engine needs (each row)) -> hidden-units
- A second resource beside mana (Monk spheres) (12#What the engine needs (each row)) -> cc-job-systems
- Spectral attacks (12#What the engine needs (each row)) -> cc-elements; also mj-monk (remainder: Element.Spectral exists (types.ts:10, elements.ts) but no attack uses it)
- Weapon element buffs (Endow) (12#What the engine needs (each row)) -> cc-job-systems
- Removing enemy buffs and cancelling warnings (Dispel; warning.ts has no cancel) (12#What the engine needs (each row)) -> cc-job-systems
- Corpses laid to rest (Last Rites; also Consecrate); creditor.reveal raises !torn only (12#What the engine needs (each row)) -> cc-job-systems
- Monsters switching sides for a while (Possess; reveal flips side permanently for dead mercs only, creditor.ts) (12#What the engine needs (each row)) -> cc-job-systems
- Knockback (12#What the engine needs (each row)) -> cc-job-systems
- Turrets as zones that shoot (zones exist: sim/zone.ts, mechanics/zones.ts, Lightning Rod strikes each second, close but no projectile turret) (12#What the engine needs (each row)) -> cc-job-systems
- Standing-still timer (12#What the engine needs (each row)) -> cc-job-systems

#### Order to build in (each step)
- 1. Warden (Shadow, Watchman, Executioner trees; needs hidden monsters, mark, redirect) (12#Order to build in (each step)) -> warden
- 2. Arcanist (Fire/Frost area magic) (12#Order to build in (each step)) -> arcanist
- 3. Sage (needs endow, dispel, warning cancel) (12#Order to build in (each step)) -> mj-sage
- 4. Monk (needs sphere resource, Spectral attack, teleport Snap) (12#Order to build in (each step)) -> mj-monk
- 5. Arbalist: its prerequisite "ranged monsters to block" is BUILT (Hollow Archer, Penitent Slinger, Multishot, commits efbb9a9, 162891b) (12#Order to build in (each step)) -> mj-arbalist (remainder: 5. Arbalist: its prerequisite "ranged monsters to block" is BUILT (Hollow Archer, Penitent Slinger, Multishot)
- 6. Berserker, Lamplighter, Medium (need party buffs, light, souls/laid-to-rest) (12#Order to build in (each step)) -> mj-berserker; also mj-lamplighter, mj-medium

### 13-bestiary

#### Goals
- Each layer fields >=6 kinds of monster from >=2 factions (13#Goals) -> be-monsters-upper; also be-monsters-deep (remainder: roster.ts has ~13 non-boss kinds across 4 layers; most new-layer monsters (Undercroft, Crown) missing)
- Every enemy type in the enemies table has a monster (13#Goals) -> be-monster-types (remainder: now archer, shielder, herald, bomber exist; flyer, kidnapper, summoner, thief, stripper, berserker, fear caster)
- Each monster asks the player to change something; names are titles (13#Goals) -> not code
- Boss rolled from a pool of three per layer, 81 boss orders (13#Goals) -> bp-roll
- Mini-bosses lead gauntlets (13#Goals) -> be-minibosses (remainder: 7 of 16 in, placed (see Mini-bosses))

#### Elite affixes
- Elite rolls 1/2/2/3 affixes by layer, from `layout` stream (13#Elite affixes) -> built: src/content/affixes.ts giveAffixes; test/sim/affixes.test.ts
- Pack shares first affix at half strength (SHARED set) (13#Elite affixes) -> built: affixes.ts:68
- Affixes show on elite's floor label (13#Elite affixes) -> built: renderer.ts:1384
- Swift, Stoneskin, Fire/Frost/Venom Enchanted (+death bursts), Vampiric, Thorns, Aura: Might, Aura: Mending, Warded, Bound, Multishot (13#Elite affixes) -> built: affixes.ts:16-30; commits 16e165a, efbb9a9
- Herald affix (13#Elite affixes) -> be-affixes (remainder: built as 10 s wake-nearest-pack; design wants run to an alarm bell. Bells/horn posts exist (alarms.ts))
- Storm Enchanted (spark to nearby merc on hit) (13#Elite affixes) -> be-affixes
- Mana Burn (13#Elite affixes) -> be-affixes
- Teleport (blink next to bearer) (13#Elite affixes) -> be-affixes
- Ranged monsters shoot from 6 tiles, step back, barriers stop shots (13#Elite affixes) -> inbox: ranged monsters are built per the survey; no node owns the leftover

#### New monsters: Marches
- Bloat (bomber, Venom cloud, warning) (13#New monsters: Marches) -> built: roster.ts:238, 162891b, test/sim/shields-and-bloats.test.ts
- Carrion Moth (flyer, dims light) (13#New monsters: Marches) -> be-monsters-upper
- Drowned Wailer (spectral, neutral hits halved) (13#New monsters: Marches) -> be-monsters-upper
- Penitent Slinger (archer) (13#New monsters: Marches) -> built: roster.ts:119, efbb9a9

#### New monsters: Rift Road
- Hollow Archer (13#New monsters: Rift Road) -> built: roster.ts:108
- Hollow Shieldbearer (80% frontal block, slow turn) (13#New monsters: Rift Road) -> built: roster.ts:131
- Horn-Bearer + horn post (13#New monsters: Rift Road) -> built: roster.ts:147,158; src/game/alarms.ts; test/game/alarms.test.ts
- Chain Warden (hook + drag, telegraphed line) (13#New monsters: Rift Road) -> be-monsters-upper
- Rift Vulture (flyer, dives at weakest) (13#New monsters: Rift Road) -> be-monsters-upper

#### New monsters: Undercroft
- Ossuary Priest (summoner, raises party's kills) (13#New monsters: Undercroft) -> be-monsters-deep
- Tithe-Taker (thief) (13#New monsters: Undercroft) -> be-monsters-deep
- Confessor (weapon stripper) (13#New monsters: Undercroft) -> be-monsters-deep
- Flagellant (berserker, bleeds) (13#New monsters: Undercroft) -> be-monsters-deep
- Drowned Bell (stationary fear caster) (13#New monsters: Undercroft) -> be-monsters-deep

#### New monsters: Sunken Crown
- Whisperer (fear caster, Dread within 4 tiles) (13#New monsters: Sunken Crown) -> be-monsters-deep
- Skulker (hidden assassin) (13#New monsters: Sunken Crown) -> be-monsters-deep
- Revenant Knight (spectral) (13#New monsters: Sunken Crown) -> be-monsters-deep
- Gilded Effigy (construct, immune stun/fear) (13#New monsters: Sunken Crown) -> be-monsters-deep
- Crown-Moth (flyer, snuffs light) (13#New monsters: Sunken Crown) -> be-monsters-deep

#### What the engine needs (monsters)
- Flyers: unaerial-untargetable by melee until landing; Pin Down grounds (no flight state in sim/unit.ts) (13#What the engine needs (monsters)) -> be-monster-types
- Ranged monsters: monster basic attack fires projectiles (13#What the engine needs (monsters)) -> built: src/sim/projectile.ts, ai.ts; test/sim/ranged.test.ts
- Bombers: dies on purpose through a warning (13#What the engine needs (monsters)) -> built: bloat; shields-and-bloats.test.ts
- Thieves: take item from pack and exit (13#What the engine needs (monsters)) -> be-monster-types
- Hidden units: unseen until close; revealed by Lamplighter/Warden/Scout (13#What the engine needs (monsters)) -> hidden-units
- Horn posts / alarms (13#What the engine needs (monsters)) -> built: src/game/alarms.ts
- Raising corpses (monster raises dead; Consecrate/Pyre stop it) (13#What the engine needs (monsters)) -> be-monster-types

#### Mini-bosses
- Mini-boss framework: elite +250% hp, +40% atk, +20 armor, escort, fixed affixes, label, log (13#Mini-bosses) -> built: src/content/minibosses.ts; test/game/minibosses.test.ts; c7c5e4c
- Bell-Ringer, First Keeper, Shield-Oath, Bone Quartermaster, Horn of the Road, Drowned Cantor, Last Herald (13#Mini-bosses) -> built: minibosses.ts:44-99
- Bone Quartermaster volleys shown on the ground as lines (13#Mini-bosses) -> be-minibosses (remainder: volleys built, ground telegraph missing (per doc))
- Horn of the Road (13#Mini-bosses) -> be-affixes (remainder: Swift instead of Teleport; posts blown in sequence built)
- Drowned Cantor (13#Mini-bosses) -> be-minibosses (remainder: water pools every 6 s built; party slow from flood and Mending/Frost gimmick per doc partly)
- The Bloated Reeve (needs Bloat+Bound; Bloat exists, mini-boss not defined; could be next) (13#Mini-bosses) -> be-minibosses
- The Moth-Queen (needs flyers, Teleport) (13#Mini-bosses) -> be-minibosses
- The Hooked Gaoler (needs Chain Warden) (13#Mini-bosses) -> be-minibosses
- The Tithe-Collector (needs Tithe-Taker) (13#Mini-bosses) -> be-minibosses
- The Flayed Penitent (needs Flagellant) (13#Mini-bosses) -> be-minibosses
- The Ossuary Warden (needs Ossuary Priest) (13#Mini-bosses) -> be-minibosses
- The Whispering Choir (needs Whisperer, Mana Burn) (13#Mini-bosses) -> be-minibosses
- The Skulker Prince (needs Skulker, Teleport) (13#Mini-bosses) -> be-minibosses
- The Gilded Champion (needs Gilded Effigy) (13#Mini-bosses) -> be-minibosses
- Placement: Elite Horde last wave, Elite Hunt first quarry, ordinary fights 1 in 4 from Rift Road, Vault key on it (13#Mini-bosses) -> built: 5c71932 (bossHand), test/game/boss-deck.test.ts
- Mini-boss at the Labyrinth hall guard (13#Mini-bosses) -> dropped: the Labyrinth rework (doc 15) removed monsters from the maze, so a maze guard no longer fits
- Mini-boss compendium entries and cards (13#Mini-bosses) -> be-minibosses
- "A run meets each at most once" (13#Mini-bosses) -> be-minibosses

#### Bosses
- Existing four boss rules (telegraphed moves, half-health change, drop card) (13#Bosses) -> bp-roll (remainder: boss-moves.ts, bosses.ts, test/sim/boss.test.ts)
- Brood Mother, Gatekeeper, Abbess, Hollowed Saint (13#Bosses) -> built: bosses.ts:171-214
- Rolled boss pool per layer from `map` stream + show boss name on layer map (13#Bosses) -> bp-roll
- Endless mode rolling all twelve (13#Bosses) -> bp-roll
- The Drowned Reeve (13#Bosses) -> bb-reeve-siege
- The Lantern-Eater (13#Bosses) -> bb-bridge-lantern
- The Siege Crew (13#Bosses) -> bb-reeve-siege
- The Bridge-Warden (13#Bosses) -> bb-bridge-lantern
- The Ossuary Bishop (13#Bosses) -> bb-bishop-usurper
- The Drowned Choir (13#Bosses) -> bb-choir-regent
- The Usurper (13#Bosses) -> bb-bishop-usurper
- The Faceless Regent (13#Bosses) -> bb-choir-regent
- Field changes engine: rising water, falling sections, darkness over a fight (the Collapse objective has falling floor; reusable pattern in objective.ts) (13#Bosses) -> bp-ground; also gs-terrain-lantern (darkness)
- Linked units: shared health / must-die-together (Bound affix shares hits, affixes.ts, partial basis) (13#Bosses) -> bp-link
- Mind control of mercs (Creditor turns mercs: creditor.ts, basis) (13#Bosses) -> bp-possess
- Boss copying a merc's skill (skills run on any unit; no copy logic) (13#Bosses) -> bp-possess

#### Order to build in (bestiary)
- 1 Elite affixes (all but 3 affixes) (13#Order to build in (bestiary)) -> built: present in code
- 2 Ranged monsters (Hollow Archer, Penitent Slinger) (13#Order to build in (bestiary)) -> built: efbb9a9
- 3 Shieldbearer, Bloat, Horn-Bearer (13#Order to build in (bestiary)) -> built: 162891b, 8879534
- 4 Mini-bosses for Elite gauntlets, one per layer first (13#Order to build in (bestiary)) -> be-minibosses (remainder: 7/16 in)
- 5 Second boss per layer (Reeve, Siege Crew, Bishop, Usurper) (13#Order to build in (bestiary)) -> bb-reeve-siege; also bb-bishop-usurper
- 6 Flyers, thieves, hidden units, third boss per layer (13#Order to build in (bestiary)) -> be-monster-types; also hidden-units, bb-bridge-lantern, bb-choir-regent

#### Art
- Figures built on existing rigs with added shape (src/render/rig.ts, sprites.ts) (13#Art) -> be-monsters-upper (remainder: archer, slinger, shieldbearer, horn-bearer, bloat have art (70b5fe6))

### 14-gauntlets

#### Rewards shown on the road
- Gold, Arms, Cards, Materials, Respite rewards; rolled from `map`; icons on map; no two roads from a fork alike (14#Rewards shown on the road) -> built: graph.ts:43-45,508-526; game.ts:977 spoilsOf; ui/map.tsx:229
- Lore reward (regalia/remains) (14#Rewards shown on the road) -> sb-regalia

#### Bonus challenge
- Untouched, No losses, Swift, Thorough, Silent (14#Bonus challenge) -> built: src/game/bonus.ts; test/game/bonus.test.ts
- In order (Hunt marked monsters die in order) (14#Bonus challenge) -> gs-hunt-kinds
- Meeting upgrades reward (gold x2, Rare+, second card...) (14#Bonus challenge) -> built: game.ts spoilsOf `better`

#### Mutators
- Darkness, Blood moon, Volatile, Restless dead, Alarmed (14#Mutators) -> built: src/game/mutators.ts; test/game/mutators.test.ts
- Fog, Shield wall, Plague, Frenzy, Rich (5 mutators) (14#Mutators) -> gs-mutators
- Rolling rules (30% from Rift Road, Elite always, two in the Crown), signpost/map/badge display, +1 elite item to chest (14#Mutators) -> built: present in code
- "A mutator raises the area's reward by one step" (14#Mutators) -> gs-mutators (remainder: implemented as one extra elite item only)

#### Mini-bosses / Elite gauntlets
- Elite gauntlets end on a mini-boss; ordinary 1 in 4 (14#Mini-bosses / Elite gauntlets) -> built: 5c71932
- Elite gauntlet reward always at least Rare (14#Mini-bosses / Elite gauntlets) -> gs-mutators (remainder: chest has Rank.Elite item (game.ts:979); no explicit Rare floor found)
- Elite affixes, one mutator on every elite (14#Mini-bosses / Elite gauntlets) -> built: present in code

#### The Hunt
- Edge-of-screen arrows to seen marked monsters (14#The Hunt) -> built: renderer.ts:543 drawQuarry
- Marked monster runs and wakes pack (14#The Hunt) -> built: ai.ts:381-398
- Hunt kind Leaders as a rolled kind (it is the only kind; no 'kind of quarry' roll) (14#The Hunt) -> gs-hunt-kinds
- Hunt kind Heralds (marked are Horn-Bearers that race to posts) (14#The Hunt) -> gs-hunt-kinds
- Hunt kind Fugitive (marked mini-boss flees to an escape; fail = empty chest) (14#The Hunt) -> gs-hunt-kinds
- Hunt kind Nests (stationary Blight nests that lay mites) (14#The Hunt) -> gs-hunt-kinds

#### The Horde
- Spawn-point warnings 3 s before; next wave listed in badge (14#The Horde) -> built: objective.ts:380-396, 471
- Last wave led by elite / mini-boss in Elite Hordes (14#The Horde) -> built: present in code
- Hold the light: brazier near the middle, edge-only spawns while the bearer is in its light (14#The Horde) -> gs-horde-kinds
- Call it early: bell to bring the next wave, gold per early wave (14#The Horde) -> gs-horde-kinds
- Horde kind Siege as a rolled kind (only today's behavior) (14#The Horde) -> gs-horde-kinds
- Horde kind Breach (ruined wall gaps; Vanguard holds) (14#The Horde) -> gs-horde-kinds
- Horde kind Rising (graves; Consecrate/Pyre stop) (14#The Horde) -> gs-horde-kinds

#### The Labyrinth
- Rework to monster-free obstacle course; no Thorough, only Darkness mutator (14#The Labyrinth) -> built: 65dbaae, stage.ts generateMaze
- Key on the path/way round, pickup by walking (14#The Labyrinth) -> built: stage.ts; 7e71533, 65dbaae
- Gates with levers on the path (1, 2 from area 9) (14#The Labyrinth) -> built: stage.ts:2216-2235
- Shortcut levers back to the entrance side (14#The Labyrinth) -> gs-labyrinth
- Traps: spike grate, fire vent, arrow slit, swinging blade, falling floor (14#The Labyrinth) -> built: stage.ts:342 HazardKind, src/sim/trap.ts, src/game/hazards.ts
- Gas vent trap (zones need an owner) (14#The Labyrinth) -> gs-labyrinth
- Flamethrower trap (planned 216-4d9...; commit 216185b is design only) (14#The Labyrinth) -> gs-labyrinth
- Pressure plate trap (14#The Labyrinth) -> gs-labyrinth
- Arrow launcher trap (long projectile) (14#The Labyrinth) -> gs-labyrinth
- The stalker (mini-boss walking the maze) (14#The Labyrinth) -> dropped: the Labyrinth rework (doc 15) removed monsters from the maze, so a maze guard no longer fits
- Walls block light, wall lanterns light parts of maze (14#The Labyrinth) -> gs-labyrinth
- Kinds of maze: Ruins/Catacomb/Hedge (burnable hedge with Fire) (14#The Labyrinth) -> gs-labyrinth
- Labyrinth bonus: Untouched check is built (bonus.ts); Swift 120 s built (14#The Labyrinth) -> gs-labyrinth

#### New kinds of gauntlet
- Escort (14#New kinds of gauntlet) -> built: objective.ts, ai.ts thinkWard; test/game/escort.test.ts; 173a4a1
- Vault (14#New kinds of gauntlet) -> built: test/game/vault.test.ts; 45c7e09
- Silence (14#New kinds of gauntlet) -> built: src/game/alarms.ts; test/game/alarms.test.ts; 8879534
- Ritual (14#New kinds of gauntlet) -> built: test/game/ritual.test.ts; eb6c975
- Collapse (14#New kinds of gauntlet) -> built: test/game/collapse.test.ts; 3df3616
- Ambush (14#New kinds of gauntlet) -> built: test/game/ambush.test.ts; b9d9d38
- Kinds by layer table (which layer rolls which) (14#New kinds of gauntlet) -> built: escort Marches/Rift, silence/collapse Rift, vault all, ritual Undercroft+; graph.ts
- Per-layer rule "Marches: Labyrinth (Hedge); Undercroft: Catacomb; Horde variants" (see kinds above) (14#New kinds of gauntlet) -> gs-labyrinth
- Open questions (failed Fugitive pay; mutator visibility on map; Ritual sigils feed Creditor) (14#New kinds of gauntlet) -> not code

#### Order to build in (gauntlets)
- 1 Rewards (without Lore) (14#Order to build in (gauntlets)) -> built: present in code
- 2 Bonus challenge (without In order) (14#Order to build in (gauntlets)) -> built: present in code
- 3 Wave warnings + next wave in badge (14#Order to build in (gauntlets)) -> built: present in code
- 4 Arrows to marked, marked run (14#Order to build in (gauntlets)) -> built: present in code
- 5 Mutators (14#Order to build in (gauntlets)) -> gs-mutators (remainder: 5 of 10)
- 6 Labyrinth key, gates, new traps (14#Order to build in (gauntlets)) -> gs-labyrinth (remainder: without shortcut levers, gas vents, new-new traps)
- 7 New kinds: Escort, Vault, Silence, Ritual, Collapse, Ambush (14#Order to build in (gauntlets)) -> built: present in code
- 8 Level director (see 15) (14#Order to build in (gauntlets)) -> built: present in code

### 15-director

#### Prior art / What our director does
- Left 4 Dead prior art, goals, and "Pacing and difficulty" prose; Rules section values mostly satisfied below (15#Prior art / What our director does) -> not code

#### What it reads
- Per-member intensity (hit share, merc fall, nearby kills, decay unless engaged), pacing = max with bearer x2 (15#What it reads) -> built: src/game/director.ts; test/game/director.test.ts
- Standing over run, saved with run, scored from health, losses, potions, pace, bonus, strength (15#What it reads) -> built: director.ts; save.ts; director.test.ts:113
- Standing signal "Pace" (15#What it reads) -> gs-director (remainder: only where objective has a Swift time)

#### What it populates
- Wanderers thinned during Relax where unseen (director never thins packs; grep finds none) (15#What it populates) -> gs-director
- Mobs: Horde waves, Ritual waves, Hunt/Escort mobs paced (15#What it populates) -> built: objective.ts Pace; test/game/pacing.test.ts; 494576b, 1dc02df
- Specials: "single harassers on own timers: archers, captains, Horn-Bearers" as a director layer (15#What it populates) -> gs-director (remainder: monsters exist (captains, archers, horn-bearers) but no director-timed special spawns)
- Bosses/elites dealt from shuffled deck along flow (15#What it populates) -> built: gen/stage.ts bossHand; test/game/boss-deck.test.ts; 5c71932
- Relief blossoms after a hard stretch (15#What it populates) -> built: 1d814ed; director.ts (relief)
- Relief items: only blossoms; "potions and chests" at relief spots not built (15#What it populates) -> gs-director (remainder: Relief items: only blossoms; "potions and chests" at relief spots not built)
- Wave spawn rules (out of sight, mostly behind, not recent, fallback to edge, rush party) (15#What it populates) -> built: objective.ts; test/game/spawn.test.ts
- Wave warnings stay (15#What it populates) -> built: present in code

#### Key points
- Flow field per area (15#Key points) -> built: src/sim/flow.ts; test/game/flow.test.ts
- Spawn/boss/relief spots (laySpots) (15#Key points) -> built: gen/stage.ts; 143750e
- Key-point table per kind: Hunt (marked-run spot), Horde (routes waves take), Escort route/packs, Collapse falling edge (15#Key points) -> gs-director (remainder: only generic spawn/boss/relief spots exist; kind-specific points not laid; Labyrinth start/end/path/branches built)

#### The Labyrinth, reworked
- Start/end, one path, branches rejoin, no monsters, chest/shortcut branches, gates/levers on path, key on path, no Thorough, no monster mutators (15#The Labyrinth, reworked) -> built: stage.ts generateMaze; 65dbaae
- Traps paced by director (count, beat, gaps scale 0.75-1.25) (15#The Labyrinth, reworked) -> gs-labyrinth (remainder: count and beat built; "width of gaps" not separate)
- "Branches hold a chest or shortcut" (15#The Labyrinth, reworked) -> gs-labyrinth (remainder: one chest branch; shortcut = way round with extra trap; true shortcut levers not built)
- Flamethrowers, pressure plates, arrow launchers (listed as to come) (15#The Labyrinth, reworked) -> gs-labyrinth

#### Rules it keeps
- Seeded (director stream) (15#Rules it keeps) -> built: director.test.ts
- Bounded to 25% each side (15#Rules it keeps) -> gs-director (remainder: scale 0.75-1.25 on threat/trap count; per-parameter min/max for each depth not separately modelled)
- Elites never eased (15#Rules it keeps) -> built: director.ts:329
- Wave counts fixed; rewards fixed (no reward change by standing) (15#Rules it keeps) -> built: present in code
- What was seen stays (15#Rules it keeps) -> gs-director (remainder: true for boss-card clearing (stage); no thinning implemented anyway)
- Quiet (never told player; no setting) (15#Rules it keeps) -> not code
- Bosses fixed (deck at generation) (15#Rules it keeps) -> built: present in code

#### Order to build in (director)
- 1 Intensity + standing + debug overlay (`?director`, src/ui/director.tsx) (15#Order to build in (director)) -> built: `?director`, src/ui/director.tsx
- 2 Flow + spawn/boss/relief spots (15#Order to build in (director)) -> built: present in code
- 3 Horde pacing (15#Order to build in (director)) -> built: present in code
- 4 Ritual, Ambush (Ambush deliberately left unpaced), Hunt and Escort waves (15#Order to build in (director)) -> built: present in code
- 5 Difficulty from standing (15#Order to build in (director)) -> built: present in code
- 6 Boss deck (15#Order to build in (director)) -> built: present in code
- 7 Labyrinth rework (15#Order to build in (director)) -> gs-labyrinth (remainder: done, without flamethrowers, pressure plates, arrow launchers)
- 8 Relief at relief spots after a hard stretch (15#Order to build in (director)) -> built: present in code
- Rules of the build model: spells, shards, rank cap, one elite upgrade per spell, save refund, spell panel, no Auto spend (16#Options, #Numbers to start from) -> build-rules
- Elite upgrade offers at the Waystations of phases 2 to 4 and the Mastery road reward (16#Numbers to start from) -> mastery-offers
- The Vanguard as 4 spells, Sunder innate and 12 upgrades (16#The Vanguard under option B) -> vanguard-upgrades; also job-registry
- The other six starting jobs drawn as spells and upgrades (16#What it replaces in doc 09) -> builds-design
- Doc 09 trees become source lists for spells and upgrades (16#What it replaces in doc 09) -> builds-design
- Charge pushes enemies aside, needs knockback (16#The Vanguard under option B) -> cc-job-systems; also vanguard-upgrades
