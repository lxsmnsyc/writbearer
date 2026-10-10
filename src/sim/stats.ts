import { Range } from './types';

export interface BaseStats {
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  wil: number;
}

export type BaseStat = keyof BaseStats;

/**
 * Everything a unit's combat reads. All of it comes from `deriveStats`.
 */
export interface Derived {
  maxHp: number;
  maxMana: number;
  // Per second
  manaRegen: number;
  atkMin: number;
  atkMax: number;
  matkMin: number;
  matkMax: number;
  accuracy: number;
  evasion: number;
  // Percent
  crit: number;
  // Hard defenses, from gear and buffs. Percent reduction with diminishing returns.
  armor: number;
  resistance: number;
  // Soft defenses, subtracted after the hard ones.
  softDef: number;
  softMdef: number;
  // Shield block, percent chance and percent of damage stopped.
  blockChance: number;
  blockAmount: number;
}

export type DerivedStat = keyof Derived;

// Every derived stat, in one list, so bonuses can be applied to each.
const DERIVED_STATS: readonly DerivedStat[] = [
  'maxHp',
  'maxMana',
  'manaRegen',
  'atkMin',
  'atkMax',
  'matkMin',
  'matkMax',
  'accuracy',
  'evasion',
  'crit',
  'armor',
  'resistance',
  'softDef',
  'softMdef',
  'blockChance',
  'blockAmount',
];

/**
 * A bonus category for the Amplify and Reduce steps. Bonuses in the same
 * category add, and different categories multiply, as rAthena's cardfix.
 */
export const enum Category {
  // Against the target's race, or from the attacker's race when reducing
  Race = 0,
  // Against the target's defense element
  TargetElement = 1,
  // The hit's own element
  AttackElement = 2,
  AttackRange = 3,
  // Against or from elites and bosses, keyed by `Rank`
  Rank = 4,
  // Physical or magical, keyed by `DamageKind`. Reduce only.
  Kind = 5,
}

export type Modifier =
  | { base: BaseStat; add: number }
  | { stat: DerivedStat; add?: number; percent?: number }
  | { amplify: Category; key: number; percent: number }
  | { reduce: Category; key: number; percent: number };

export interface Job {
  name: string;
  baseHp: number;
  hpPerLevel: number;
  baseMana: number;
  manaPerLevel: number;
  // The range of the basic attack, which decides STR or DEX scaling
  range: Range;
}

export interface Weapon {
  min: number;
  max: number;
  matk: number;
}

export interface StatInput {
  job: Job;
  level: number;
  base: BaseStats;
  weapon: Weapon;
  modifiers: readonly Modifier[];
}

export type Bonuses = Map<string, number>;

export const bonusKey = (category: Category, key: number): string => `${category}:${key}`;

export interface StatResult {
  base: BaseStats;
  derived: Derived;
  amplify: Bonuses;
  reduce: Bonuses;
}

/**
 * A unit's stats, computed in full from its inputs. Nothing is kept between
 * calls, so the result never drifts. Called again whenever an input changes.
 */
export function deriveStats(input: StatInput): StatResult {
  const { job, level, weapon, modifiers } = input;
  const base = { ...input.base };
  const adds: Partial<Record<DerivedStat, number>> = {};
  const percents: Partial<Record<DerivedStat, number>> = {};
  const amplify: Bonuses = new Map();
  const reduce: Bonuses = new Map();

  for (const m of modifiers) {
    if ('base' in m) {
      base[m.base] += m.add;
    } else if ('stat' in m) {
      adds[m.stat] = (adds[m.stat] ?? 0) + (m.add ?? 0);
      percents[m.stat] = (percents[m.stat] ?? 0) + (m.percent ?? 0);
    } else if ('amplify' in m) {
      const key = bonusKey(m.amplify, m.key);
      amplify.set(key, (amplify.get(key) ?? 0) + m.percent);
    } else {
      const key = bonusKey(m.reduce, m.key);
      reduce.set(key, (reduce.get(key) ?? 0) + m.percent);
    }
  }

  const { str, agi, vit, int, dex, wil } = base;
  const lv = level - 1;
  const statusAtk =
    job.range === Range.Melee ? str * 2 + Math.floor(dex / 5) : dex * 2 + Math.floor(str / 5);
  const statusMatk = Math.floor(int * 1.5 + dex / 5);
  const maxMana = Math.floor((job.baseMana + job.manaPerLevel * lv) * (1 + int / 100));

  const derived: Derived = {
    maxHp: Math.floor((job.baseHp + job.hpPerLevel * lv) * (1 + vit / 100)),
    maxMana,
    manaRegen: (1 + maxMana / 100 + wil / 6) / 8,
    atkMin: statusAtk + weapon.min,
    atkMax: statusAtk + weapon.max,
    matkMin: statusMatk + Math.floor(weapon.matk * 0.7),
    matkMax: statusMatk + weapon.matk,
    accuracy: level + dex,
    evasion: level + agi,
    crit: 1 + dex * 0.3,
    armor: 0,
    resistance: 0,
    softDef: Math.floor(vit / 2 + level / 2),
    softMdef: Math.floor(wil / 2 + int / 4),
    blockChance: 0,
    blockAmount: 0,
  };

  for (const key of DERIVED_STATS) {
    const value = (derived[key] + (adds[key] ?? 0)) * (1 + (percents[key] ?? 0) / 100);
    derived[key] = key === 'manaRegen' || key === 'crit' ? value : Math.floor(value);
  }

  return { base, derived, amplify, reduce };
}
