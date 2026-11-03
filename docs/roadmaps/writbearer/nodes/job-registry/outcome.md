# Outcome: job-registry

## Built

Each job is now one module plus registries. The skill tree path is gone. Final shape of the job-def contract, for `contracts/job-def.md`:

```ts
// src/content/jobs/types.ts
export interface Template { job; base; weapon; kit; modifiers?; race?; rank?; element?;
  elementLevel?; attackElement?; hunt?; skills? } // moved here from roster.ts; roster re-exports it
export type Role = 'guard' | 'striker' | 'support';
export interface Innate { name: string; effect: Passive; describe: () => string } // rank 1, never raised
export type SpellIcon = (props: ComponentProps<'svg'>) => JSX.Element; // solid-js types, type-only import
export interface JobDef {
  kind: string;            // key in JOBS, LOOKS and ICONS
  template: Template;      // template.job.name is the name item bases list in `jobs`
  discipline: number;
  role: Role;
  fighter: boolean;
  hireable: boolean;       // false for the four new jobs until roster-balance
  blurb: string;           // offer card line
  spells: readonly [Skill, Skill, Skill, Skill]; // cast order, last is the filler
  innate: Innate;
  upgrades: Upgrade[];     // 12, 3 per spell
  starterGear: readonly string[];
  starterBelt: readonly (readonly [string, number])[];
  icons: Readonly<Partial<Record<string, SpellIcon>>>; // own spell icons, by spell id
}

// src/content/jobs/index.ts
export const JOB_KINDS = ['vanguard','ranger','cleric','sellsword','warden','duelist','arcanist'] as const;
export type JobKind = (typeof JOB_KINDS)[number];
export const JOBS: Record<JobKind, JobDef>;
export const isJobKind: (kind: string) => kind is JobKind;

// src/content/jobs/designed.ts: placeholders
designedSpell(id, name, summary, cost, cooldown): Skill   // wants() is always false
designedUpgrade(id, spell, name, summary): Upgrade        // no patch, no effect: never offered
designedInnate(id, name, summary): Innate                 // a passive that does nothing
// src/content/jobs/stats.ts: stats(...), job(...) template shorthands (roster uses them too)

// src/render/looks/types.ts
export type HeldWeapon = 'sword' | 'mace' | 'bow' | 'dagger' | 'staff';
export type Attack = 'slash' | 'shoot' | 'cast';
export interface JobLook {
  hitFraction: number;
  size: number;
  bare: { weapon: HeldWeapon | null; shield: boolean }; // when gear is unknown
  attachments: (weapon: HeldWeapon | null, shield: boolean) => readonly Attachment[];
  attack: (weapon: HeldWeapon | null) => Attack;
}
// src/render/looks/held.ts: heldGear(weapon, asStaff?), swingOrShoot, plainLook(weapon, shield)
// src/render/looks/index.ts: LOOKS: Record<JobKind, JobLook>, isJobLook(kind)

// src/render/zones.ts
export type ZoneLook = (ctx: CanvasRenderingContext2D, at: Pt, zone: Zone, iso: Iso) => void;
export const ZONE_LOOKS: Partial<Record<string, ZoneLook>>; // banner, lightningRod, bait, rampart, spikeField
```

Spell icons: a job module imports its icons as `import GiX from '~icons/game-icons/x'` and lists them in `icons` by spell id. `SkillIcon` (src/ui/spell-panel.tsx, used by the spell panel and the Orders tab) draws the job's own icon, else `ICONS[spell id]` from src/ui/icons.ts, else the `points` icon. Job nodes never edit src/ui/icons.ts. The three built jobs carry their 12 spell icons in their own modules, moved out of ICONS. `heal` stays in ICONS too, because the map's Respite reward uses it. The four new jobs have `icons: {}` for now. Tests run without the icons plugin: vitest.config.ts maps every `~icons/...` import to `test/support/icon.ts`, a stub.

Files per job, for all seven: `src/content/jobs/<kind>/index.ts` default-exports the JobDef. `src/content/jobs/<kind>/upgrades.ts` default-exports the `Upgrade[]`. `src/render/looks/<kind>.ts` default-exports the JobLook. A job node edits only these. It never edits the registries.

- Vanguard: Intercept, Challenge, Shield Wall, Crush; innate Sunder. Ranger: Snare, Lightning Rod, Aimed Shot, Charged Arrow; innate Static. Cleric: Ward, Heal, Sacred Ground, Smite; innate Aegis. All from the existing skill code. Their 36 upgrades are summary-only, with ids taken from the tree node they come from (`vow`, `bait`, `renew`, ...) or new camelCase ones (`charge`, `stormCell`, `twinWard`, ...).
- Sellsword, Warden, Duelist, Arcanist: placeholder spells (doc 16 names, mana and cooldowns), placeholder innates, 12 summary-only upgrades each, first-guess templates, `hireable: false`. They spawn, wear their gear and fight with basic attacks. All 84 upgrade ids are unique.
- `spawnMerc` reads JOBS: template, discipline, gear, belt. It sets `skillPoints = level - 1`, calls `giveSpells(unit, def.spells)` and starts the innate at rank 1 under `unit.passives.get(innate.effect.id)`.
- `MercKind = 'bearer' | JobKind`. `MERCS` is removed. Read `JOBS[kind].template` instead.
- `HIREABLE` and `FIGHTERS` (recruits.ts) come from JOBS in registry order and hold only hireable jobs. The Guild House draw is unchanged.
- `STARTER_GEAR` and `STARTER_BELT` were removed from items.ts. `STARTER_PACK` stays. Sellsword and Warden were added to the `jobs` lists of armingSword, flangedMace, buckler, kettleHelm, hauberk (and towerShield for the Warden only). No new bases.
- builds.ts: `buildFor(kind)` and `upgradeById(id)` read JOBS (`upgradeById` scans every call, no cache). `registerBuild` and `unregisterBuild` are deleted. `src/sim/builds.ts` now imports JOBS from `src/content` at runtime. It is the first module under src/sim to do so. Later nodes should not add more: the sim gets content through hooks and arguments.
- Removed: `src/content/trees.ts` (TREES, learn, findNode, TIER_LEVEL), `src/ui/skill-tree.tsx`, `loadTree` in save.ts. The Skills tab always shows the spell panel and counts shards.
- rig.ts: merc kinds come from LOOKS. `hitFraction(kind)` replaces `HIT_FRACTION`. `paperColor` and `sizeOf` read LOOKS. sprites.ts: `isSprited` and `lookOf` read LOOKS. effects.ts: a dying merc drops a shield when it wears one, no longer only when it is a Vanguard.
- ui/icons.ts: unit icons for sellsword, warden, duelist and arcanist. offer.tsx: the card shows the blurb and the 4 spell names ("Spells: ...") instead of tree branches.
- Tests: `test/content/jobs.test.ts` (7 contract tests). `tree-skills.test.ts` is split into `test/sim/{vanguard,ranger,cleric}-upgrades.test.ts`. Cases of skills that are now upgrades are `it.skip`, using `teach(unit, skillOrPassive, rank)` from `test/support/build.ts`. `spendAll` now spends shards. recruits.test and e2e/recruit.spec read HIREABLE.
- `.changeset/job-registry.md` (minor).

The three built jobs lose these skills until their upgrade node lands: Vanguard: Vow, Shared Burden, Last Line, Banner, Shield Bash, Immovable, Rampart, Bastion, Fault Line, Earthshaker (plus new Charge, Sundering Blow). Ranger: Rearguard, Bait, Spike Field, Killing Ground, Pin Down, Eagle Eye, Killshot, Arc Volley, Thunderhead, Piercing Arrow (plus new Storm Cell, Overcharge). Cleric: Cleanse, Wall of Faith, Renew, Resurrection, Martyr, Veil, Consecrate, Turn Undead, Purge, Holy Light (plus new Twin Ward, Pilgrim's Rest). Their skill code stays in vanguard.ts, ranger.ts, cleric.ts, skills.ts and passives.ts.

## Deviations

- **Spell numbers changed (approved by the user at the gate).** The brief says "at today's numbers". With today's per-rank gains and ranks up to 10, the boss and Creditor balance tests fail: two mercs won 5 of 6 and 6 of 6, where the limits are 2 and 1. Doc 16 says each per-rank gain is half of today's. The per-rank gains of 11 of the 12 spells are halved as doc 16 gives them: Intercept 4+0.5r, Challenge 3+0.25r, Shield Wall 2+0.25r, Crush 140+10r and 30+5r Earth, Snare 1.5+0.25r, Lightning Rod 5+0.5r s and 35+5r%, Aimed Shot 200+15r, Charged Arrow 90+8r, Ward 30+8r, Sacred Ground 6+2.5r, Smite 110+10r. Heal stays at today's 40+20r, against doc 16's 40+10r: the layer-1 boss test needs 5 wins of 6 for three mercs, and with Heal's gain halved they win 4. A comment beside `healAmount` in skills.ts says so. Sacred Ground's gain is 2.5 a rank, rounded down (6 + floor(2.5r)), so its text shows whole numbers. Mana, cooldowns and rank-1 values are unchanged, except that a rank-1 Smite is now 120% (one recruits test number changed). Crush stays at 10 mana and 6 s, not doc 16's 8 and 3. Files: skills.ts, vanguard.ts, ranger.ts, cleric.ts, which this node does not own.
- Contract shape changes: `name` and `icon` are dropped from JobDef (`template.job.name` is the name; the ICONS key is the kind). Default exports replace the named `<KIND>` and `<KIND>_UPGRADES`, because the repo's oxlint config enforces prefer-default-export and forbids narrowing casts. `MERCS` is removed, and `hitFraction()` replaces `HIT_FRACTION`, for the same lint rule. JobLook has `bare`, `attachments()` and `attack()` instead of an open `attachments` field.
- The icon map needs `vitest.config.ts` (alias for `~icons/...`) and `test/support/icon.ts`, and `src/ui/spell-panel.tsx` (SkillIcon). e2e/recruit.spec.ts no longer imports src: Node cannot load `~icons` imports. It reads HIREABLE from the dev server with `page.evaluate(() => import('/src/content/recruits.ts'))`.
- Edited outside the owned paths, as little as possible: `src/sim/builds.ts` (registry, as the brief asks), `src/game/save.ts` (no loadTree; saveMerc keeps any job kind through `isJobKind`, not only hireable ones), `src/ui/merc-panel.tsx` (no tree fallback), `src/content/events.ts` and `src/game/game.ts` (the job name read from JOBS, 3 lines), `src/render/view.ts` (hitFraction).
- Tests outside the owned list changed because the tree is gone or because mercs now cast spells: balance, boss, builds, morale, potions, progress, save, skills, recruits (Renew case: spells cleared; Smite number), fight (the ambush case turns spells off), shout (the Focus case clears the Ranger's spells), and `test/support/build.ts`. `e2e/orders.spec.ts`: its two tree cases were rewritten for the spell panel. Not run.
- `unit.skillPoints` stays. Under the frozen builds contract it is the field that `giveSpells` turns into shards, and old saves carry it. Nothing grants it to a merc or spends it now.

## Stubs left

- 72 spells/innates/upgrades are placeholders: the 4 new jobs' spells, innates and upgrades (sellsword, warden, duelist, arcanist nodes and their upgrade nodes) and the 36 upgrades of the built jobs (vanguard-upgrades, ranger-upgrades, cleric-upgrades).
- The four new looks are plain: `plainLook` or a robe and staff. The job nodes draw the real ones.
- 24 skipped tests: the upgrade nodes turn them back on.

## Gotchas

- A job node adds its spell icons to its own `icons` map, not to src/ui/icons.ts. Unit icons for all seven jobs are in ICONS already. A job module that imports `~icons/...` cannot be loaded by plain Node (Playwright specs): read job data in e2e from the page, as recruit.spec.ts does.
- `plainLook` (src/render/looks/held.ts) draws a tower shield for any shield. The sellsword node must draw its own buckler look; the Warden's and Duelist's placeholders have the same issue.
- `upgradeById` reads `JOBS[k].upgrades` live. builds.test swaps `JOBS.vanguard.upgrades` for a test pool and puts it back in `afterEach`.
- Every merc casts its 4 spells from level 1. Fight tests that are not about spells may need `unit.skills.length = 0` or `SkillMode.Off` toggles.
- With spells on, the fight.test ambush gives "attacking the bearer first" more bearer damage than "nearest" (250 against 50 over 6 seeds). Worth a look in roster-balance or combat-core.
- `bosses.test` layer 1 is at the edge: Heal at 40+10r drops it to 4 of 6.
- The innate is not in `unit.skillRanks` or the save. It is set up again on each spawn and load.
- Upgrade ids such as `vow` equal the old tree passive ids, so a built upgrade's `effect` can reuse `VOW` (same `unit.passives` key).
- Use `/usr/bin/git`. The rtk hook blocks globs, shell variables and heredocs piped to python in this worktree's guard. Write scripts to the scratchpad instead.

## Proposed learnings

- Single-export modules default-export; registries type their keys with an `as const` tuple | oxlint prefer-default-export and no-unsafe-type-assertion | src | yes (lint)
- Keep per-rank gains at doc 16's half scale for spells that rank to 10 | today's tree numbers doubled at rank 10 break the balance tests | src/content | yes (bosses, creditor tests)

## Verification

- `pnpm vitest run test/content/jobs.test.ts`: 7 passed.
- `pnpm typecheck`: exit 0. `oxlint src test e2e`: exit 0. `pnpm test`: 56 files, 436 passed, 24 skipped (run twice, the same).
- `pnpm build`: ok.
- `pnpm test:e2e` not run, as instructed. e2e/recruit.spec.ts now imports `src/content/recruits` and orders.spec.ts has new spell-panel cases: both unverified.

## Size

- Estimated L, actual L. The balance fallout of spells from level 1 added more test changes than planned.
