import type { BaseStats, Job } from '../../sim/stats';
import type { Range } from '../../sim/types';

// Shorthands for templates, shared by the jobs and the monsters.

export const stats = (
  str: number,
  agi: number,
  vit: number,
  int: number,
  dex: number,
  wil: number,
): BaseStats => ({
  str,
  agi,
  vit,
  int,
  dex,
  wil,
});

export const job = (
  name: string,
  baseHp: number,
  hpPerLevel: number,
  baseMana: number,
  range: Range,
): Job => ({
  name,
  baseHp,
  hpPerLevel,
  baseMana,
  manaPerLevel: 4,
  range,
});
