import { EventPriority } from '../core/event-emitter';
import { SimEvents } from '../sim/events';
import type Sim from '../sim/sim';
import { type Skill, Targeting } from '../sim/skill';
import { DamagePriority } from '../sim/types';
import type Unit from '../sim/unit';
import { Hunt } from '../sim/ai';
import { spawnMonster } from './roster';

// The Marches' boss. The Blight grows a mother where it breaks the surface,
// and she lays mites as fast as the party can kill them. She tests whether
// the party's orders send it past the brood to her.

// Mites she lays at once, and at most alive around her
const BROOD = 3;
const FRENZY_BROOD = 5;
const BROOD_CAP = 8;
// How far from her the eggs land, in tiles
const LAY_RADIUS = 1.8;
// Below this share of health she frenzies.
const FRENZY_AT = 0.5;

// Mothers that have frenzied, and the mites each one laid
const frenzied = new WeakSet<Unit>();
const broods = new WeakMap<Unit, Set<Unit>>();

const livingBrood = (u: Unit): Unit[] => [...(broods.get(u) ?? [])].filter((m) => m.alive);

/**
 * Brood Mother. Lays a clutch of mites around her: 3, or 5 once she
 * frenzies. She stops while 8 of hers still live.
 */
export const LAY_BROOD: Skill = {
  id: 'layBrood',
  name: 'Lay Brood',
  describe: () => `Lays ${BROOD} mites around her, ${FRENZY_BROOD} once she frenzies.`,
  cost: 30,
  cooldown: 9,
  windup: 1.4,
  recovery: 0.6,
  targeting: Targeting.Self,
  wants(u) {
    return u.aware && livingBrood(u).length < BROOD_CAP;
  },
  elite() {
    return false;
  },
  release(u, _target, sim) {
    const clutch = frenzied.has(u) ? FRENZY_BROOD : BROOD;
    const count = Math.min(clutch, BROOD_CAP - livingBrood(u).length);
    const brood = broods.get(u) ?? new Set<Unit>();
    broods.set(u, brood);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + u.angle;
      const x = u.x + Math.cos(a) * LAY_RADIUS;
      const z = u.z + Math.sin(a) * LAY_RADIUS;
      const mite = spawnMonster(sim, 'mite', Math.max(1, u.level - 2), x, z);
      mite.aware = true;
      if (frenzied.has(u)) {
        mite.hunt = Hunt.Bearer;
      }
      brood.add(mite);
    }
  },
};

/**
 * Spawns the Brood Mother. At half health she frenzies: she and every mite
 * of hers go for the bearer, and her clutches grow.
 */
export function spawnBroodMother(sim: Sim, level: number, x: number, z: number): Unit {
  const mother = spawnMonster(sim, 'broodMother', level, x, z);
  mother.skills.push(LAY_BROOD);
  mother.mana = mother.derived.maxMana;
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (
      event.target !== mother ||
      frenzied.has(mother) ||
      !mother.alive ||
      mother.hp > mother.derived.maxHp * FRENZY_AT
    ) {
      return;
    }
    frenzied.add(mother);
    mother.hunt = Hunt.Bearer;
    for (const mite of livingBrood(mother)) {
      mite.hunt = Hunt.Bearer;
    }
  });
  // Her brood dies with her.
  sim.on(SimEvents.UnitDies, EventPriority.Post, (event) => {
    if (event.source !== mother) {
      return;
    }
    for (const mite of livingBrood(mother)) {
      mite.die(null);
    }
  });
  return mother;
}

/** Whether a Brood Mother has frenzied, for the HUD and tests. */
export const isFrenzied = (u: Unit): boolean => frenzied.has(u);
