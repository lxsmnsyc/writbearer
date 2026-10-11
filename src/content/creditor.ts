import { type Skill, Targeting } from '../sim/skill';
import { Morale, moraleOf } from '../sim/morale';
import { Hunt } from '../sim/ai';
import type Sim from '../sim/sim';
import { strike } from '../sim/sim';
import { DREAD } from '../sim/statuses';
import { DamageFlags, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { spawnMonster } from './roster';

// The end of the run, from the lore: the seal breaks at the tomb, and the
// bearer becomes the Creditor. The mercs fight it on their own.

// Each soul fed to the Creditor over the run adds this share of its
// health and damage.
export const SOUL_SHARE = 6;
// Health the raised dead come back with
const RAISED_HEALTH = 0.6;

const COLLECT_RADIUS = 3;
const COLLECT_RATIO = 160;
const COLLECT_DREAD = 30;

const near = (u: Unit): Unit[] =>
  u.sim.living(Side.Party).filter((p) => u.distanceTo(p) <= COLLECT_RADIUS);

/**
 * The Creditor collects: an Occult blast around it, for 160% damage to
 * every merc within 3 tiles, with Dread building up in each.
 */
export const COLLECT: Skill = {
  id: 'collect',
  name: 'Collect',
  describe: () =>
    `An Occult blast around it for ${COLLECT_RATIO}% damage, with Dread, to every merc within ${COLLECT_RADIUS} tiles.`,
  cost: 30,
  cooldown: 9,
  windup: 1.6,
  recovery: 0.5,
  targeting: Targeting.Self,
  wants(u) {
    return near(u).length >= 2 || (near(u).length >= 1 && u.hp < u.derived.maxHp * 0.5);
  },
  elite() {
    return false;
  },
  release(u) {
    for (const p of near(u)) {
      strike(u, p, {
        ratio: COLLECT_RATIO,
        flags: DamageFlags.Skill,
        buildup: [{ status: DREAD, amount: COLLECT_DREAD }],
      });
    }
  },
};

/** Who stands where once the seal breaks. */
export interface Reveal {
  creditor: Unit;
  // Dead mercs the Creditor raised to its side
  raised: Unit[];
  // Cowardly mercs whose nerve broke, gone from the fight
  fled: Unit[];
}

/**
 * The seal breaks. The bearer becomes the Creditor, as strong as the souls
 * the run fed it. Every merc that lies dead and was not torn apart rises on
 * its side; a Cowardly merc with low or broken morale runs. The living
 * fight on, with the orders and gear they were given; orders that guard the
 * bearer have nothing left to guard.
 */
export function reveal(sim: Sim, bearer: Unit, level: number, souls: number): Reveal {
  const creditor = spawnMonster(sim, 'creditor', level, bearer.x, bearer.z);
  creditor.angle = bearer.angle;
  const share = souls * SOUL_SHARE;
  creditor.setBonus('souls', [
    { stat: 'maxHp', percent: share },
    { stat: 'atkMin', percent: share },
    { stat: 'atkMax', percent: share },
  ]);
  creditor.hp = creditor.derived.maxHp;
  creditor.mana = creditor.derived.maxMana;
  creditor.skills.push(COLLECT);
  creditor.aware = true;

  bearer.alive = false;
  sim.units.delete(bearer);
  sim.bearer = null;

  const mercs = [...sim.units].filter((u) => u.side === Side.Party);
  const fled = mercs.filter(
    (m) => m.alive && m.traits.includes('cowardly') && moraleOf(m) <= Morale.Low,
  );
  for (const m of fled) {
    sim.units.delete(m);
  }
  const raised = mercs.filter((m) => !m.alive && !m.torn);
  for (const m of raised) {
    m.revive(RAISED_HEALTH);
    m.side = Side.Monster;
    m.hunt = Hunt.Nearest;
    m.aware = true;
    m.heard = null;
  }
  return { creditor, raised, fled };
}
