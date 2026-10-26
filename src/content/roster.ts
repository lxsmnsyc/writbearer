import { Hunt, type Toggles } from '../sim/ai';
import type Sim from '../sim/sim';
import type { Skill } from '../sim/skill';
import type { BaseStats, Job, Modifier, Weapon } from '../sim/stats';
import { Element, Race, Range, Rank, Side } from '../sim/types';
import Unit, { type Kit } from '../sim/unit';
import { plainItem, potionStack } from '../gen/loot';
import { slotFor } from '../sim/item';
import { BASE_BY_ID, STARTER_BELT, STARTER_GEAR } from './items';
import { BURST, HYMN } from './skills';
import { applyTraits } from './traits';

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
    // Bare hands. Its sword, shield and mail come as starter gear.
    weapon: { min: 6, max: 10, matk: 0 },
    kit: { reach: 1.1, interval: 1.0, hitAt: 0.55, moveSpeed: 2.6 },
  },
  ranger: {
    job: job('Ranger', 180, 18, 60, Range.Ranged),
    base: stats(5, 10, 8, 3, 18, 6),
    // Bare hands. Its bow and jerkin come as starter gear.
    weapon: { min: 4, max: 8, matk: 0 },
    kit: { reach: 5.5, interval: 1.1, hitAt: 0.7, moveSpeed: 2.7 },
  },
  // A priest of the old faith, before the Church went under. It mends the
  // party and raises its dead. Its holy fire burns the Undead and the mad.
  cleric: {
    job: job('Cleric', 220, 20, 90, Range.Melee),
    base: stats(6, 5, 10, 14, 8, 12),
    // Bare hands. Its staff and vestments come as starter gear.
    weapon: { min: 4, max: 7, matk: 0 },
    kit: { reach: 1.0, interval: 1.2, hitAt: 0.55, moveSpeed: 2.6 },
  },
} satisfies Record<string, Template>;

export const MONSTERS = {
  // One of the Old King's dead. It goes for the bearer.
  hollowSoldier: {
    job: job('Hollow soldier', 150, 14, 0, Range.Melee),
    base: stats(10, 4, 10, 1, 8, 1),
    weapon: { min: 16, max: 22, matk: 0 },
    kit: { reach: 1.2, interval: 1.3, hitAt: 0.6, moveSpeed: 2.0, notice: 5 },
    modifiers: [{ stat: 'armor', add: 30 }],
    race: Race.Undead,
    hunt: Hunt.Bearer,
  },
  // A soldier of the Old King's guard with a long bow. It shoots from
  // behind its own and steps back from whoever comes close.
  hollowArcher: {
    job: job('Hollow archer', 110, 10, 0, Range.Ranged),
    base: stats(6, 8, 6, 1, 14, 1),
    weapon: { min: 10, max: 14, matk: 0 },
    kit: { reach: 6, interval: 1.8, hitAt: 0.7, moveSpeed: 1.9, notice: 6 },
    modifiers: [{ stat: 'armor', add: 15 }],
    race: Race.Undead,
    hunt: Hunt.Nearest,
  },
  // A Penitent with a sling. It keeps well back and slings stones at the
  // bearer. Radiant, as the Church's keepers are.
  penitentSlinger: {
    job: job('Penitent slinger', 80, 8, 0, Range.Ranged),
    base: stats(4, 10, 4, 1, 12, 1),
    weapon: { min: 7, max: 11, matk: 0 },
    kit: { reach: 6, interval: 1.5, hitAt: 0.6, moveSpeed: 2.6, notice: 6 },
    race: Race.Human,
    element: Element.Radiant,
    hunt: Hunt.Bearer,
  },
  // A soldier of the Old King's guard behind a tower shield taller than it.
  // The shield takes most of every physical blow from the front, and it
  // turns slowly, so it is beaten from the side or behind, or with magic.
  hollowShieldbearer: {
    job: job('Hollow Shieldbearer', 170, 15, 0, Range.Melee),
    base: stats(9, 3, 12, 1, 8, 1),
    weapon: { min: 12, max: 16, matk: 0 },
    kit: { reach: 1.1, interval: 1.5, hitAt: 0.6, moveSpeed: 1.7, notice: 5, turn: 1.4 },
    modifiers: [
      { stat: 'armor', add: 30 },
      { stat: 'blockChance', add: 100 },
      { stat: 'blockAmount', add: 80 },
    ],
    race: Race.Undead,
    hunt: Hunt.Nearest,
  },
  // A soldier of the Old King's guard with a curled horn instead of a spear.
  // When its pack wakes it runs for the nearest horn post, to blow it and
  // call a fresh pack. Lightly armored and quick, and weak once cornered.
  hornBearer: {
    job: job('Horn-Bearer', 110, 10, 0, Range.Melee),
    base: stats(6, 8, 6, 1, 6, 1),
    weapon: { min: 8, max: 12, matk: 0 },
    kit: { reach: 1.0, interval: 1.4, hitAt: 0.6, moveSpeed: 2.6, notice: 5 },
    modifiers: [{ stat: 'armor', add: 10 }],
    race: Race.Undead,
    hunt: Hunt.Nearest,
  },
  // A horn post: a pole with the guard's great horn on it. It does nothing,
  // and is there to be broken before a Horn-Bearer reaches it.
  hornPost: {
    job: job('Horn post', 160, 16, 0, Range.Melee),
    base: stats(1, 1, 8, 1, 1, 1),
    weapon: { min: 0, max: 0, matk: 0 },
    kit: { reach: 0, interval: 99, hitAt: 0.5, moveSpeed: 0, notice: 0 },
    modifiers: [{ stat: 'armor', add: 20 }],
    race: Race.Construct,
    hunt: Hunt.Nearest,
  },
  // A Penitent of the Church, keeping the seal with a knife. Fast and fragile,
  // and it wants the bearer. Radiant, so holy attacks cannot hurt it.
  penitent: {
    job: job('Penitent', 90, 8, 30, Range.Melee),
    base: stats(7, 12, 4, 6, 10, 4),
    weapon: { min: 10, max: 14, matk: 0 },
    kit: { reach: 1.0, interval: 1.0, hitAt: 0.55, moveSpeed: 2.4, notice: 6 },
    race: Race.Human,
    element: Element.Radiant,
    hunt: Hunt.Bearer,
  },
  // A Penitent who leads the rites in song. It keeps behind the others and
  // mends them with a long hymn.
  cantor: {
    job: job('Penitent Cantor', 110, 10, 80, Range.Melee),
    base: stats(4, 6, 6, 14, 8, 12),
    weapon: { min: 6, max: 9, matk: 20 },
    kit: { reach: 1.0, interval: 1.4, hitAt: 0.6, moveSpeed: 2.1, notice: 5 },
    race: Race.Human,
    element: Element.Radiant,
    hunt: Hunt.Support,
    skills: [HYMN],
  },
  // A Penitent who listened too long to the whispers. It lopes past anyone
  // in its way to claw at the bearer, and its touch is Occult: dread builds
  // up in whoever it strikes.
  hollowed: {
    job: job('Hollowed', 120, 11, 0, Range.Melee),
    base: stats(9, 14, 5, 1, 9, 1),
    weapon: { min: 12, max: 17, matk: 0 },
    kit: { reach: 1.0, interval: 0.75, hitAt: 0.45, moveSpeed: 3.0, notice: 7 },
    race: Race.Human,
    element: Element.Occult,
    attackElement: Element.Occult,
    hunt: Hunt.Assassin,
  },
  // One of the drowned townsfolk of the sunken capital, risen with the Old
  // King's guard. Slow and weak alone; it shambles at whoever is nearest.
  husk: {
    job: job('Husk', 70, 9, 0, Range.Melee),
    base: stats(6, 2, 6, 1, 4, 1),
    weapon: { min: 7, max: 11, matk: 0 },
    kit: { reach: 1.0, interval: 1.5, hitAt: 0.6, moveSpeed: 1.5, notice: 4 },
    race: Race.Undead,
    hunt: Hunt.Nearest,
  },
  // A Blight mite: a crawler not yet grown. Quick, frail, and never alone.
  mite: {
    job: job('Mite', 38, 5, 0, Range.Melee),
    base: stats(4, 8, 2, 1, 4, 1),
    weapon: { min: 4, max: 7, matk: 0 },
    kit: { reach: 0.8, interval: 0.9, hitAt: 0.45, moveSpeed: 2.8, notice: 4 },
    race: Race.Insect,
    element: Element.Venom,
    hunt: Hunt.Nearest,
  },
  // A Blight crawler. It bites whoever is closest.
  crawler: {
    job: job('Crawler', 110, 10, 0, Range.Melee),
    base: stats(8, 10, 8, 1, 6, 1),
    weapon: { min: 9, max: 13, matk: 0 },
    kit: { reach: 1.0, interval: 0.8, hitAt: 0.5, moveSpeed: 2.6, notice: 5 },
    race: Race.Beast,
    element: Element.Venom,
    // Its bite builds up poison.
    attackElement: Element.Venom,
    hunt: Hunt.Nearest,
  },
  // A Blight bloat: a slow, swollen sac on legs. It walks into the party
  // and bursts in a cloud of Venom, shown on the ground first. Killed
  // before it bursts, it only pops.
  bloat: {
    job: job('Bloat', 90, 9, 0, Range.Melee),
    base: stats(8, 2, 6, 1, 4, 1),
    weapon: { min: 14, max: 18, matk: 0 },
    kit: { reach: 1.0, interval: 99, hitAt: 0.5, moveSpeed: 1.4, notice: 6 },
    race: Race.Insect,
    element: Element.Venom,
    attackElement: Element.Venom,
    hunt: Hunt.Bearer,
    skills: [BURST],
  },
  // The Marches' boss: a Blight crawler grown huge, swollen with eggs. Slow,
  // and she lays mites. Her skill and her frenzy are set up in brood.ts.
  broodMother: {
    job: job('Brood Mother', 2000, 200, 120, Range.Melee),
    base: stats(14, 6, 16, 1, 10, 8),
    weapon: { min: 20, max: 28, matk: 0 },
    kit: { reach: 1.8, interval: 1.5, hitAt: 0.5, moveSpeed: 1.5, notice: 6 },
    modifiers: [{ stat: 'armor', add: 20 }],
    race: Race.Insect,
    rank: Rank.Boss,
    element: Element.Venom,
    attackElement: Element.Venom,
    hunt: Hunt.Nearest,
  },
  // The Rift Road's boss: the Old King's captain, holding the road down. Heavy
  // armor, and a slow cleave across everything in front of him. His skills
  // and his horn are set up in bosses.ts.
  gatekeeper: {
    job: job('The Gatekeeper', 2150, 200, 60, Range.Melee),
    base: stats(18, 4, 18, 1, 10, 6),
    weapon: { min: 26, max: 34, matk: 0 },
    kit: { reach: 1.6, interval: 1.8, hitAt: 0.6, moveSpeed: 1.7, notice: 6 },
    modifiers: [{ stat: 'armor', add: 70 }],
    race: Race.Undead,
    rank: Rank.Boss,
    hunt: Hunt.Nearest,
  },
  // The Undercroft's boss: the head of the Penitents who keep the seal. She
  // keeps back, calls her flock and sanctifies it.
  abbess: {
    job: job('The Abbess', 1000, 100, 240, Range.Melee),
    base: stats(6, 8, 12, 18, 10, 18),
    weapon: { min: 12, max: 18, matk: 40 },
    kit: { reach: 1.0, interval: 1.4, hitAt: 0.6, moveSpeed: 2.0, notice: 6 },
    race: Race.Human,
    rank: Rank.Boss,
    element: Element.Radiant,
    hunt: Hunt.Support,
  },
  // The Sunken Crown's boss: a saint of the Church who listened too long.
  // Dread gathers around her, and she leaps for the bearer.
  hollowedSaint: {
    job: job('The Hollowed Saint', 1850, 180, 0, Range.Melee),
    base: stats(14, 16, 12, 1, 12, 1),
    weapon: { min: 16, max: 22, matk: 0 },
    kit: { reach: 1.2, interval: 1.1, hitAt: 0.45, moveSpeed: 2.8, notice: 6 },
    race: Race.Human,
    rank: Rank.Boss,
    element: Element.Occult,
    attackElement: Element.Occult,
    hunt: Hunt.Assassin,
  },
  // What the bearer carried down: the Creditor, woken in the bearer's body
  // when the seal breaks. Its strength and its skill are set up in
  // creditor.ts.
  creditor: {
    job: job('The Creditor', 2600, 220, 200, Range.Melee),
    base: stats(18, 10, 18, 18, 14, 18),
    weapon: { min: 24, max: 32, matk: 30 },
    kit: { reach: 1.5, interval: 1.2, hitAt: 0.5, moveSpeed: 2.2, notice: 20 },
    modifiers: [{ stat: 'armor', add: 30 }],
    race: Race.Human,
    rank: Rank.Boss,
    element: Element.Occult,
    attackElement: Element.Occult,
    hunt: Hunt.Nearest,
  },
} satisfies Record<string, Template>;

export type MercKind = keyof typeof MERCS;

// Each job's Discipline before levels and traits. Soldiers drill; priests
// keep their vows; hunters go their own way.
const DISCIPLINE: Record<Exclude<MercKind, 'bearer'>, number> = {
  vanguard: 40,
  ranger: 35,
  cleric: 45,
};
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
  name?: string,
): Unit {
  return sim.add(
    new Unit(sim, {
      kind,
      name: name ?? t.job.name,
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

// A refugee on the road: it cannot fight, only follow the bearer and run.
const REFUGEE: Template = {
  job: job('Refugee', 110, 6, 0, Range.Melee),
  base: stats(1, 4, 4, 1, 4, 1),
  weapon: { min: 0, max: 0, matk: 0 },
  kit: { reach: 0, interval: 0, moveSpeed: 2.3 },
};

/** A refugee, one of those an Escort keeps safe. */
export function spawnRefugee(sim: Sim, level: number, x: number, z: number): Unit {
  const at = sim.nav?.free(x, z) ?? { x, z };
  return spawn(sim, 'refugee', REFUGEE, Side.Ward, level, at.x, at.z);
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
  profile: { name?: string; traits?: readonly string[] } = {},
): Unit {
  const unit = spawn(sim, kind, MERCS[kind], Side.Party, level, x, z, toggles, profile.name);
  // Discipline starts from the job, one more per level, then the traits.
  unit.discipline = DISCIPLINE[kind] + level;
  applyTraits(unit, profile.traits ?? []);
  for (const id of STARTER_GEAR[kind] ?? []) {
    const base = BASE_BY_ID.get(id);
    const item = base && plainItem(base);
    const slot = item && slotFor(item);
    if (item && slot !== null && slot !== undefined) {
      unit.equip(slot, item);
    }
  }
  STARTER_BELT[kind]?.forEach(([id, count], i) => {
    const base = BASE_BY_ID.get(id);
    if (base) {
      unit.belt[i] = potionStack(base, count);
    }
  });
  // Recruits arrive with their skill points unspent, one per level past the first.
  unit.skillPoints = level - 1;
  unit.hp = unit.derived.maxHp;
  unit.mana = unit.derived.maxMana;
  return unit;
}

// An elite has far more health, hits harder and is better armored.
const ELITE: Modifier[] = [
  { stat: 'maxHp', percent: 150 },
  { stat: 'atkMin', percent: 30 },
  { stat: 'atkMax', percent: 30 },
  { stat: 'armor', add: 25 },
];

export function spawnMonster(
  sim: Sim,
  kind: MonsterKind,
  level: number,
  x: number,
  z: number,
  options: { elite?: boolean; name?: string; modifiers?: readonly Modifier[] } = {},
): Unit {
  const t: Template = MONSTERS[kind];
  // Never inside something solid or shut in among it, where nothing could
  // reach it.
  const at = sim.nav?.free(x, z) ?? { x, z };
  x = at.x;
  z = at.z;
  if (!options.elite) {
    return spawn(sim, kind, t, Side.Monster, level, x, z);
  }
  const modifiers = [...(t.modifiers ?? []), ...ELITE, ...(options.modifiers ?? [])];
  return spawn(
    sim,
    kind,
    { ...t, rank: Rank.Elite, modifiers },
    Side.Monster,
    level,
    x,
    z,
    undefined,
    options.name,
  );
}
