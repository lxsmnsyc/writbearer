---
name: job-def
version: 2
status: frozen
defined_by: job-registry
---

# Contract: job-def

## Purpose

One module per job, registered in one place, so the four new jobs and their upgrades can be built at the same time without editing the same files. Today a job is spread over `src/content/roster.ts` (MERCS, DISCIPLINE, the non-exported `Template`), `trees.ts` (TREES), `recruits.ts` (HIREABLE, FIGHTERS, `rollStartingOffers`), `items.ts` (job-name lists, STARTER_GEAR, STARTER_BELT), `src/ui/icons.ts`, `src/ui/offer.tsx` (blurb), `src/render/rig.ts` (Kind, KINDS, HIT_FRACTION, KIND_SIZE, `paperColor`), `src/render/sprites.ts` (`isSprited`, attachments, a `kind === 'cleric'` test) and `src/render/effects.ts` (a `kind === 'vanguard'` test). Used by every job node and roster-balance.

## Interface

Frozen at v2, as job-registry built it (see `nodes/job-registry/outcome.md`).

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

Files per job, for all seven:

- `src/content/jobs/<kind>/index.ts` default-exports the JobDef.
- `src/content/jobs/<kind>/upgrades.ts` default-exports the `Upgrade[]`. `index.ts` imports it.
- `src/render/looks/<kind>.ts` default-exports the JobLook.
- A job node edits only these, never the registries (`src/content/jobs/index.ts`, `src/render/looks/index.ts`).

Spell icons: a job module imports its icons from `~icons/...` and lists them in `icons` by spell id. `SkillIcon` (`src/ui/spell-panel.tsx`) draws the job's own icon, then `ICONS[spell id]`, then the `points` icon. Job nodes never edit `src/ui/icons.ts`. Unit icons for all seven jobs are already there. e2e specs cannot import job modules (Node cannot load `~icons`), so they read job data from the page.

Layering: `src/sim/builds.ts` imports JOBS from `src/content` at runtime. It is the only module under `src/sim` that may. Later nodes pass content to the sim through hooks and arguments.

## Behavior

- job-registry registers Sellsword, Warden, Duelist and Arcanist with placeholder modules: a first-guess template, `hireable: false`, a plain look, 4 placeholder spells and 12 summary-only upgrades named as in `docs/design/16-builds.md`. Vanguard, Ranger and Cleric get their real spells and innate, with summary-only upgrades. A job node fills in `index.ts` and its look; an upgrade node fills in `upgrades.ts`. Neither edits the registries.
- `MercKind` stays a literal union of the seven kinds. `HIREABLE` and `FIGHTERS` hold only jobs with `hireable: true`, so the Guild House draw does not change until roster-balance.
- Item bases stay in `src/content/items.ts`, which already lists Arcanist and Duelist gear and has `WeaponKind` (`dagger`, `staff`). Imports go one way: `jobs/*` import `items.ts`, never the reverse. `STARTER_GEAR` and `STARTER_BELT` are read from JOBS where they are used (`roster.ts`), not in `items.ts`. job-registry adds Sellsword and Warden to the `jobs` lists of fitting bases and any missing base the four jobs need for starter gear.
- Monster kinds stay in `rig.ts`; only merc kinds come from LOOKS.
- An upgrade without `patch` or `effect` is "designed, not in the game" and is never offered.
- A zone kind's drawing is added as one entry in `ZONE_LOOKS` (append-only, shared).
- Saved runs keep loading: tree ranks are refunded as shards (builds contract).

## Stub

The placeholder modules are the stub: every new job can be spawned with `spawnMerc` from the first day, so upgrade nodes test their upgrades on it.

## Contract tests

- `test/content/jobs.test.ts`: every registered job has 4 spells, an innate passive and 12 upgrades, 3 per spell, each naming one of its spells; a look, starter gear that resolves to item bases, and can be spawned. HIREABLE holds exactly the hireable jobs.
- `test/sim/recruits.test.ts` and `e2e/recruit.spec.ts` read HIREABLE instead of a fixed list.

## Changes

- v1: initial.
- v1 (draft, 2026-10-27): trees replaced by spells, innate and upgrades after the build-variety gate.
- v2 (2026-11-03): frozen as built. `name` and `icon` dropped from JobDef (`template.job.name`; the ICONS key is the kind). Default exports per module. `JOB_KINDS` tuple and `MercKind = 'bearer' | JobKind`. `MERCS` removed, `hitFraction()` replaces `HIT_FRACTION`. JobLook gets `bare`, `attachments()`, `attack()`. `ZONE_LOOKS` is a Partial record. New `icons` map on JobDef (user decision at the gate).
