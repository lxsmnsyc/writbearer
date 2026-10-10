import { Hunt, type Toggles } from '../sim/ai';
import type Sim from '../sim/sim';
import type { Skill } from '../sim/skill';
import type { BaseStats, Job, Modifier, Weapon } from '../sim/stats';
import type { Rank } from '../sim/types';
import { Element, Race, Range, Side } from '../sim/types';
import Unit, { type Kit } from '../sim/unit';
import { CHALLENGE, PIERCING_ARROW, SHIELD_BASH } from './skills';

// First numbers for the starting jobs and the first monsters. They are a
// starting point for balance, not final values.

interface Template {
  job: Job;
  base: BaseStats;
  weapon: Weapon;
  kit: Partial<Kit>;
  modifiers?: Modifier[];
  race?: Race;
  rank?: Rank;
  element?: Element;
  elementLevel?: number;
  attackElement?: Element;
  hunt?: Hunt;
  skills?: Skill[];
}

const stats = (
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

const job = (
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

export const MERCS = {
  // The bearer cannot fight. Its stats only decide how much it can take.
  bearer: {
    job: job('Bearer', 190, 8, 0, Range.Melee),
    base: stats(1, 5, 5, 5, 5, 5),
    weapon: { min: 0, max: 0, matk: 0 },
    kit: { reach: 0, interval: 0, moveSpeed: 2.4 },
  },
  vanguard: {
    job: job('Vanguard', 300, 30, 40, Range.Melee),
    base: stats(14, 5, 16, 1, 8, 6),
    weapon: { min: 28, max: 36, matk: 0 },
    kit: { reach: 1.1, interval: 1.0, hitAt: 0.55, moveSpeed: 2.6 },
    modifiers: [
      { stat: 'armor', add: 70 },
      { stat: 'blockChance', add: 35 },
      { stat: 'blockAmount', add: 60 },
    ],
    skills: [CHALLENGE, SHIELD_BASH],
  },
  ranger: {
    job: job('Ranger', 180, 18, 60, Range.Ranged),
    base: stats(5, 10, 8, 3, 18, 6),
    weapon: { min: 24, max: 32, matk: 0 },
    kit: { reach: 5.5, interval: 1.1, hitAt: 0.7, moveSpeed: 2.7 },
    modifiers: [{ stat: 'armor', add: 20 }],
    skills: [PIERCING_ARROW],
  },
} satisfies Record<string, Template>;

export const MONSTERS = {
  // One of the Old King's dead. It goes for the bearer.
  hollowSoldier: {
    job: job('Hollow soldier', 150, 14, 0, Range.Melee),
    base: stats(10, 4, 10, 1, 8, 1),
    weapon: { min: 16, max: 22, matk: 0 },
    kit: { reach: 1.2, interval: 1.3, hitAt: 0.6, moveSpeed: 2.0 },
    modifiers: [{ stat: 'armor', add: 30 }],
    race: Race.Undead,
    hunt: Hunt.Bearer,
  },
  // A Penitent of the Church, keeping the seal with a knife. Fast and fragile,
  // and it wants the bearer. Radiant, so holy attacks cannot hurt it.
  penitent: {
    job: job('Penitent', 90, 8, 30, Range.Melee),
    base: stats(7, 12, 4, 6, 10, 4),
    weapon: { min: 10, max: 14, matk: 0 },
    kit: { reach: 1.0, interval: 1.0, hitAt: 0.55, moveSpeed: 2.4 },
    race: Race.Human,
    element: Element.Radiant,
    hunt: Hunt.Bearer,
  },
  // A Blight crawler. It bites whoever is closest.
  crawler: {
    job: job('Crawler', 110, 10, 0, Range.Melee),
    base: stats(8, 10, 8, 1, 6, 1),
    weapon: { min: 9, max: 13, matk: 0 },
    kit: { reach: 1.0, interval: 0.8, hitAt: 0.5, moveSpeed: 2.6 },
    race: Race.Beast,
    element: Element.Venom,
    // Its bite builds up poison.
    attackElement: Element.Venom,
    hunt: Hunt.Nearest,
  },
} satisfies Record<string, Template>;

export type MercKind = keyof typeof MERCS;
export type MonsterKind = keyof typeof MONSTERS;

function spawn(
  sim: Sim,
  kind: string,
  t: Template,
  side: Side,
  level: number,
  x: number,
  z: number,
  toggles?: Toggles,
): Unit {
  return sim.add(
    new Unit(sim, {
      kind,
      name: t.job.name,
      side,
      job: t.job,
      level,
      base: t.base,
      weapon: t.weapon,
      kit: t.kit,
      modifiers: t.modifiers,
      race: t.race,
      rank: t.rank,
      element: t.element,
      elementLevel: t.elementLevel,
      attackElement: t.attackElement,
      hunt: t.hunt,
      skills: t.skills,
      toggles,
      x,
      z,
    }),
  );
}

export function spawnBearer(sim: Sim, x: number, z: number): Unit {
  const unit = spawn(sim, 'bearer', MERCS.bearer, Side.Party, 1, x, z);
  sim.bearer = unit;
  return unit;
}

export function spawnMerc(
  sim: Sim,
  kind: Exclude<MercKind, 'bearer'>,
  level: number,
  x: number,
  z: number,
  toggles?: Toggles,
): Unit {
  return spawn(sim, kind, MERCS[kind], Side.Party, level, x, z, toggles);
}

export function spawnMonster(
  sim: Sim,
  kind: MonsterKind,
  level: number,
  x: number,
  z: number,
): Unit {
  return spawn(sim, kind, MONSTERS[kind], Side.Monster, level, x, z);
}
