import type RNG from '../core/rng';
import type { Passive, Skill } from './skill';
import type Unit from './unit';

// The build model of docs/design/16-builds.md: each job has 4 spells, known
// from level 1. Shards raise a spell's rank, 1 per merc level. Each spell
// holds at most one elite upgrade, kept for the run.

/** An elite upgrade: changes how one of the job's spells works. */
export interface Upgrade {
  id: string;
  // Id of the spell it changes, one of the job's 4
  spell: string;
  name: string;
  // What it does, at the spell's rank
  describe: (rank: number) => string;
  // The spell cast is `{ ...base, ...patch }`
  patch?: Partial<Skill>;
  // A passive the upgrade starts, set up at the spell's rank
  effect?: Passive;
}

/** What a job brings to the build model. */
export interface Build {
  // The job's 4 spells, in cast priority order
  spells: Skill[];
  upgrades: Upgrade[];
}

export const MAX_RANK = 10;

/** The highest rank a spell may reach at a merc level. */
export const rankCap = (level: number): number => Math.min(MAX_RANK, 1 + Math.floor(level / 2));

// Builds by merc kind, and every upgrade by id, so saves can find them again.
const BUILDS = new Map<string, Build>();
const UPGRADE_BY_ID = new Map<string, Upgrade>();

/** Registers a job's spells and upgrades, by merc kind, over any before. */
export function registerBuild(kind: string, build: Build): void {
  unregisterBuild(kind);
  BUILDS.set(kind, build);
  for (const upgrade of build.upgrades) {
    UPGRADE_BY_ID.set(upgrade.id, upgrade);
  }
}

/** Removes a job's build and its upgrades, for tests. */
export function unregisterBuild(kind: string): void {
  for (const upgrade of BUILDS.get(kind)?.upgrades ?? []) {
    UPGRADE_BY_ID.delete(upgrade.id);
  }
  BUILDS.delete(kind);
}

/** A merc kind's build, or undefined for a job still on its skill tree. */
export const buildFor = (kind: string): Build | undefined => BUILDS.get(kind);

/** An upgrade by id, if a registered job has it. */
export const upgradeById = (id: string): Upgrade | undefined => UPGRADE_BY_ID.get(id);

/** Whether an upgrade does anything yet. Ones that do not are never offered. */
export const isBuilt = (upgrade: Upgrade): boolean =>
  upgrade.patch !== undefined || upgrade.effect !== undefined;

/**
 * Gives a merc its job's spells at rank 1, and turns the skill points it
 * arrived with into shards: a recruit comes with `level - 1`, unspent.
 * `unit.skills`, which the AI and the orders read, follows the spell order.
 * Call it after `spawnMerc` sets `skillPoints` to `level - 1`
 * (src/content/roster.ts), or the recruit gets no shards. It replaces
 * whatever was in `unit.skills`.
 */
export function giveSpells(unit: Unit, spells: readonly Skill[]): void {
  unit.spells = [...spells];
  unit.skills.length = 0;
  for (const spell of spells) {
    unit.skillRanks.set(spell.id, 1);
    unit.skills.push(spellOf(unit, spell));
  }
  unit.shards += unit.skillPoints;
  unit.skillPoints = 0;
}

/** The spell a unit casts, with its elite upgrade applied. */
export function spellOf(unit: Unit, base: Skill): Skill {
  const id = unit.upgrades.get(base.id);
  const patch = id === undefined ? undefined : UPGRADE_BY_ID.get(id)?.patch;
  return patch ? { ...base, ...patch, id: base.id } : base;
}

// Puts the upgraded spell in the cast list, where the base one stood.
function refresh(unit: Unit, base: Skill): void {
  const i = unit.skills.findIndex((s) => s.id === base.id);
  if (i >= 0) {
    unit.skills[i] = spellOf(unit, base);
  }
}

// Sets up an upgrade's passive again at the spell's rank.
function startEffect(unit: Unit, upgrade: Upgrade): void {
  if (!upgrade.effect) {
    return;
  }
  unit.passives.get(upgrade.id)?.stop();
  const life = upgrade.effect.setup(unit, unit.skillRank(upgrade.spell));
  unit.passives.set(upgrade.id, life);
  life.start();
}

/** Why a unit cannot raise a spell now, or null if it can. */
export function cannotRaise(unit: Unit, spell: string): string | null {
  if (!unit.spells.some((s) => s.id === spell)) {
    return 'Not one of its spells.';
  }
  const rank = unit.skillRank(spell);
  if (rank >= MAX_RANK) {
    return 'Mastered.';
  }
  if (rank >= rankCap(unit.level)) {
    return `Needs level ${2 * rank}.`;
  }
  if (unit.shards <= 0) {
    return 'No shards.';
  }
  return null;
}

/** Spends one shard on a spell. Returns why it failed, or null. */
export function raise(unit: Unit, spell: string): string | null {
  const why = cannotRaise(unit, spell);
  if (why) {
    return why;
  }
  unit.skillRanks.set(spell, unit.skillRank(spell) + 1);
  unit.shards--;
  const id = unit.upgrades.get(spell);
  const upgrade = id === undefined ? undefined : UPGRADE_BY_ID.get(id);
  if (upgrade) {
    startEffect(unit, upgrade);
  }
  return null;
}

/** Why a unit cannot take an upgrade, or null if it can. */
export function cannotUpgrade(unit: Unit, upgrade: Upgrade): string | null {
  if (!unit.spells.some((s) => s.id === upgrade.spell)) {
    return 'Not one of its spells.';
  }
  if (unit.upgrades.has(upgrade.spell)) {
    return 'The spell already holds an upgrade.';
  }
  return null;
}

/** Sets a spell's elite upgrade. Fails if the spell already holds one. */
export function applyUpgrade(unit: Unit, upgrade: Upgrade): string | null {
  const why = cannotUpgrade(unit, upgrade);
  if (why) {
    return why;
  }
  unit.upgrades.set(upgrade.spell, upgrade.id);
  const base = unit.spells.find((s) => s.id === upgrade.spell);
  if (base) {
    refresh(unit, base);
  }
  startEffect(unit, upgrade);
  return null;
}

/**
 * Up to `n` upgrades the unit could take, from spells with no upgrade yet.
 * Upgrades not in the game yet are skipped. The same seed gives the same offer.
 */
export function offerUpgrades(
  unit: Unit,
  pool: readonly Upgrade[],
  rng: RNG,
  n: number,
): Upgrade[] {
  const open: Upgrade[] = [];
  for (const upgrade of pool) {
    if (isBuilt(upgrade) && cannotUpgrade(unit, upgrade) === null) {
      open.push(upgrade);
    }
  }
  return rng.shuffle(open).slice(0, n);
}

/** The upgrade a spell holds, or undefined. */
export function upgradeOf(unit: Unit, spell: string): Upgrade | undefined {
  const id = unit.upgrades.get(spell);
  return id === undefined ? undefined : UPGRADE_BY_ID.get(id);
}
