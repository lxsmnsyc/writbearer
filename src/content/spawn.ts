import type { Toggles } from '../sim/ai';
import { giveSpells } from '../sim/builds';
import type Sim from '../sim/sim';
import type { Modifier } from '../sim/stats';
import { Range, Rank, Side } from '../sim/types';
import Unit from '../sim/unit';
import { plainItem, potionStack } from '../gen/loot';
import { slotFor } from '../sim/item';
import { BASE_BY_ID } from './items';
import { JOBS, type JobKind, type Template } from './jobs';
import { job, stats } from './jobs/stats';
import { SPAWN_STEPS } from './monsters/spawn-steps';
import { MONSTERS, type MonsterKind } from './monsters/table';
import { applyTraits } from './traits';

// The bearer cannot fight. Its stats only decide how much it can take.
const BEARER: Template = {
  job: job('Bearer', 190, 8, 0, Range.Melee),
  base: stats(1, 5, 5, 5, 5, 5),
  weapon: { min: 0, max: 0, matk: 0 },
  kit: { reach: 0, interval: 0, moveSpeed: 2.4 },
};

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

// How long a disguised assassin walks with the refugees before it strikes
const ASSASSIN_FUSE = 12;

/**
 * A refugee that is a Hollowed in disguise. It joins the bearer like the
 * others, then turns on it: revealed, it changes sides and hunts the bearer.
 */
export function spawnDisguisedAssassin(sim: Sim, level: number, x: number, z: number): Unit {
  const at = sim.nav?.free(x, z) ?? { x, z };
  const unit = spawn(
    sim,
    'hollowed',
    MONSTERS.hollowed,
    Side.Ward,
    level,
    at.x,
    at.z,
    undefined,
    'Refugee',
  );
  unit.disguise = 'refugee';
  unit.fuse = ASSASSIN_FUSE;
  unit.onReveal = () => {
    unit.side = Side.Monster;
    unit.name = 'Assassin';
    unit.aware = true;
  };
  return unit;
}

export function spawnBearer(sim: Sim, x: number, z: number): Unit {
  const unit = spawn(sim, 'bearer', BEARER, Side.Party, 1, x, z);
  sim.bearer = unit;
  return unit;
}

export function spawnMerc(
  sim: Sim,
  kind: JobKind,
  level: number,
  x: number,
  z: number,
  toggles?: Toggles,
  profile: { name?: string; traits?: readonly string[] } = {},
): Unit {
  const def = JOBS[kind];
  const unit = spawn(sim, kind, def.template, Side.Party, level, x, z, toggles, profile.name);
  // Discipline starts from the job, one more per level, then the traits.
  unit.discipline = def.discipline + level;
  applyTraits(unit, profile.traits ?? []);
  for (const id of def.starterGear) {
    const base = BASE_BY_ID.get(id);
    const item = base && plainItem(base);
    const slot = item && slotFor(item);
    if (item && slot !== null && slot !== undefined) {
      unit.equip(slot, item);
    }
  }
  for (const [i, [id, count]] of def.starterBelt.entries()) {
    const base = BASE_BY_ID.get(id);
    if (base) {
      unit.belt[i] = potionStack(base, count);
    }
  }
  // It knows its 4 spells at rank 1, and arrives with a shard per level
  // past the first, unspent. giveSpells turns the points into shards.
  unit.skillPoints = level - 1;
  giveSpells(unit, def.spells);
  // The innate passive is known from the start, at rank 1.
  const innate = def.innate.effect.setup(unit, 1);
  unit.passives.set(def.innate.effect.id, innate);
  innate.start();
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
  const unit = options.elite
    ? spawn(
        sim,
        kind,
        {
          ...t,
          rank: Rank.Elite,
          modifiers: [...(t.modifiers ?? []), ...ELITE, ...(options.modifiers ?? [])],
        },
        Side.Monster,
        level,
        x,
        z,
        undefined,
        options.name,
      )
    : spawn(sim, kind, t, Side.Monster, level, x, z);
  // Template-flag steps, in their order.
  for (const step of SPAWN_STEPS) {
    step(unit, t, sim);
  }
  return unit;
}
