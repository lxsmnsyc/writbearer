---
name: job-def
version: 1
status: draft
defined_by: job-registry
---

# Contract: job-def

## Purpose

One module per job, registered in one place, so the four new jobs and their twelve branches can be built at the same time without editing the same files. Today a job is spread over `src/content/roster.ts` (MERCS, DISCIPLINE, the non-exported `Template`), `trees.ts` (TREES), `recruits.ts` (HIREABLE, FIGHTERS, `rollStartingOffers`), `items.ts` (job-name lists, STARTER_GEAR, STARTER_BELT), `src/ui/icons.ts`, `src/ui/offer.tsx` (blurb), `src/render/rig.ts` (Kind, KINDS, HIT_FRACTION, KIND_SIZE, `paperColor`), `src/render/sprites.ts` (`isSprited`, attachments, a `kind === 'cleric'` test) and `src/render/effects.ts` (a `kind === 'vanguard'` test). Used by every job node and roster-balance.

## Interface

A first shape. job-registry may change names while it builds, then writes the final shape into this file's interface section through its outcome.

```ts
// src/content/jobs/types.ts
export type Role = 'guard' | 'striker' | 'support';
export type { Template } from '../roster'; // exported from roster.ts

export interface JobDef {
  kind: string; // MercKind key, e.g. 'warden'
  name: string; // 'Warden'; the name item bases list in `jobs`
  template: Template; // job stats, base stats, bare weapon, kit
  discipline: number;
  role: Role;
  fighter: boolean; // can kill what attacks the bearer alone
  hireable: boolean; // offered at the Guild House; false until roster-balance
  blurb: string; // one line on the offer card
  icon: string; // an IconName from src/ui/icons.ts (job-registry adds icons for all seven jobs)
  tree: Branch[]; // 3 branches of 5 nodes
  starterGear: string[]; // ids of bases in items.ts
  starterBelt: [string, number][];
}

// src/render/looks/types.ts
export interface JobLook {
  hitFraction: number; // as HIT_FRACTION
  size: number; // as KIND_SIZE
  attachments: ...; // what sprites.ts draws on the shared body, as for the first three jobs
}
```

Files, all created by job-registry, for all seven jobs:

- `src/content/jobs/<kind>/index.ts` exports `<KIND>: JobDef` (for example `WARDEN`).
- `src/content/jobs/<kind>/<branch>.ts` exports `<BRANCH>: Branch` (for example `jobs/warden/watchman.ts` exports `WATCHMAN`). Branch file names: sellsword `hired-blade`, `coin`, `tricks`; warden `shadow`, `watchman`, `executioner`; duelist `blade`, `showmanship`, `footwork`; arcanist `pyromancy`, `cryomancy`, `weave`.
- `src/content/jobs/index.ts`: JOBS, all seven registered.
- `src/render/looks/<kind>.ts` and `src/render/looks/index.ts`: LOOKS, all seven registered.
- `src/render/zones.ts`: ZONE_LOOKS, with the five skill zones drawn today (`banner`, `lightningRod`, `bait`, `rampart`, `spikeField`).

## Behavior

- job-registry registers Sellsword, Warden, Duelist and Arcanist with placeholder modules: a first-guess template, `hireable: false`, a plain look, and three branches of five summary-only nodes (text from doc 09). A job node fills in its own folder and look file; a branch node replaces one branch file. Neither edits the registries.
- `MercKind` stays a literal union of the seven kinds. `HIREABLE` and `FIGHTERS` hold only jobs with `hireable: true`, so the Guild House draw does not change until roster-balance.
- Item bases stay in `src/content/items.ts`, which already lists Arcanist and Duelist gear and has `WeaponKind` (`dagger`, `staff`). Imports go one way: `jobs/*` import `items.ts`, never the reverse. `STARTER_GEAR` and `STARTER_BELT` are read from JOBS where they are used (`roster.ts`), not in `items.ts`. job-registry adds Sellsword and Warden to the `jobs` lists of fitting bases and any missing base the four jobs need for starter gear.
- Monster kinds stay in `rig.ts`; only merc kinds come from LOOKS.
- Tree nodes without `skill` or `effect` stay "designed, not in the game" and cannot be learned.
- A zone kind's drawing is added as one entry in `ZONE_LOOKS` (append-only, shared).
- Saved runs keep loading: the save format does not change.

## Stub

The placeholder modules are the stub: every new job can be spawned with `spawnMerc` from the first day, so branch nodes test their skills on it.

## Contract tests

- `test/content/jobs.test.ts`: every registered job has 3 branches of 5 nodes with tiers 1 to 5, a look, starter gear that resolves to item bases, and can be spawned. HIREABLE holds exactly the hireable jobs.
- `test/sim/recruits.test.ts` and `e2e/recruit.spec.ts` read HIREABLE instead of a fixed list.

## Changes

- v1: initial.
