import { strike } from '../sim/sim';
import { type Skill, Targeting } from '../sim/skill';
import { POISON } from '../sim/statuses';
import { DamageFlags, Element, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { warn } from '../sim/warning';
import { setZone } from '../sim/zone';

// First numbers for monster skills. A starting point for balance.

const HYMN_RADIUS = 4;
const HYMN_SHARE = 0.2;
// Allies below this share of health make the Cantor sing.
const HYMN_WOUNDED = 0.7;

// The Cantor's flock: monsters within the hymn's reach, itself included.
function flock(u: Unit): Unit[] {
  return u.sim.living(Side.Monster).filter((m) => u.distanceTo(m) <= HYMN_RADIUS);
}

/**
 * Penitent Cantor. A long hymn that mends every monster within 4 tiles by a
 * fifth of its health. Breaking it off with a stun or a Shield Bash wastes it.
 */
export const HYMN: Skill = {
  id: 'hymn',
  name: 'Hymn of Mending',
  describe: () =>
    `A long hymn that heals every ally within ${HYMN_RADIUS} tiles for ${HYMN_SHARE * 100}% of their health.`,
  cost: 20,
  cooldown: 6,
  windup: 1.6,
  recovery: 0.4,
  targeting: Targeting.Self,
  wants(u) {
    return flock(u).some((m) => m.hp < m.derived.maxHp * HYMN_WOUNDED);
  },
  elite() {
    return false;
  },
  release(u) {
    for (const m of flock(u)) {
      u.heal(m, m.derived.maxHp * HYMN_SHARE);
    }
  },
};

// How near the party a Bloat comes before it bursts, how wide its burst
// and its cloud are, and how long each lasts
const BURST_NEAR = 1.4;
const BURST_R = 2.2;
const BURST_WARN = 1.2;
const CLOUD_TIME = 5;

/**
 * Bloat. Once at the party, it swells and bursts. The ground shows where
 * first. Whoever is caught is hit with Venom, and a cloud stays that
 * poisons whoever stands in it. A Bloat killed while it swells only pops.
 */
export const BURST: Skill = {
  id: 'burst',
  name: 'Burst',
  describe: () =>
    `Swells and bursts ${BURST_WARN} seconds later, poisoning all within ${BURST_R} tiles. A cloud stays for ${CLOUD_TIME} seconds.`,
  cost: 0,
  cooldown: 0,
  windup: 0.1,
  recovery: BURST_WARN + 0.2,
  targeting: Targeting.Self,
  wants(u, _target, sim) {
    return sim.foes(Side.Monster).some((p) => u.distanceTo(p) <= BURST_NEAR);
  },
  elite() {
    return false;
  },
  release(u, _target, sim) {
    warn(sim, {
      x: u.x,
      z: u.z,
      shape: { kind: 'circle', r: BURST_R },
      windup: BURST_WARN,
      spare: Side.Monster,
      source: u,
      strike: (v) => {
        strike(u, v, {
          ratio: 150,
          element: Element.Venom,
          buildup: [{ status: POISON, amount: 40 }],
          flags: DamageFlags.Skill | DamageFlags.AoE | DamageFlags.Sure,
        });
      },
      done: () => {
        setZone(sim, {
          kind: 'venomCloud',
          owner: u,
          x: u.x,
          z: u.z,
          r: BURST_R,
          life: CLOUD_TIME,
          element: Element.Venom,
          pulse: (e) => {
            if (e.side !== Side.Monster) {
              e.addStatus(POISON, u);
            }
          },
        });
        // It is spent. Nothing is left of it to raise.
        u.hp = 0;
        u.lastBlow = { value: u.derived.maxHp, flags: 0 };
        u.die(null);
      },
    });
  },
};
