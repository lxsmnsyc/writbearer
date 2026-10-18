import type { Buildup } from '../sim/events';
import type Sim from '../sim/sim';
import { strike } from '../sim/sim';
import { type Skill, Targeting } from '../sim/skill';
import { DREAD, POISON } from '../sim/statuses';
import { DamageFlags, Element, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { type WarningShape, warn } from '../sim/warning';

// The bosses' big moves, after Aghanim's Labyrinth: each first shows on the
// ground, a shape that fills while the boss holds still, then strikes
// whoever is still in it. Many are aimed at the bearer, so the player has
// to move it out of the way, and the mercs out of the boss's reach.

interface Placement {
  x: number;
  z: number;
  shape: WarningShape;
  done?: () => void;
}

interface MoveSpec {
  id: string;
  name: string;
  describe: string;
  cooldown: number;
  cost?: number;
  // Seconds the warning takes to fill, while the boss holds still
  warn: number;
  wants: (boss: Unit, sim: Sim) => boolean;
  place: (boss: Unit, sim: Sim) => Placement[];
  // The blow each unit still inside takes
  ratio: number;
  element?: Element;
  buildup?: Buildup[];
}

/** A boss move that warns on the ground before it strikes. */
function warnedMove(spec: MoveSpec): Skill {
  return {
    id: spec.id,
    name: spec.name,
    describe: () => spec.describe,
    cost: spec.cost ?? 0,
    cooldown: spec.cooldown,
    windup: 0.2,
    recovery: spec.warn,
    targeting: Targeting.Self,
    wants: (u, _target, sim) => u.aware && spec.wants(u, sim),
    elite: () => false,
    release(u, _target, sim) {
      for (const p of spec.place(u, sim)) {
        warn(sim, {
          ...p,
          windup: spec.warn,
          spare: Side.Monster,
          source: u,
          strike: (v) => {
            strike(u, v, {
              ratio: spec.ratio,
              element: spec.element,
              buildup: spec.buildup,
              flags: DamageFlags.Skill | DamageFlags.AoE | DamageFlags.Sure,
            });
          },
        });
      }
    },
  };
}

// The bearer if it is up, the unit most bosses are after.
const bearerOf = (sim: Sim): Unit | null => (sim.bearer?.alive ? sim.bearer : null);

// A few of the party, the bearer first, then mercs at random.
function marks(sim: Sim, count: number): Unit[] {
  const bearer = bearerOf(sim);
  const mercs = sim.living(Side.Party).filter((u) => u !== bearer);
  sim.rng.shuffle(mercs);
  return [...(bearer ? [bearer] : []), ...mercs].slice(0, count);
}

const near = (u: Unit, sim: Sim, r: number): boolean =>
  sim.living(Side.Party).some((p) => u.distanceTo(p) <= r);

// A straight run from the boss toward a spot, going `past` beyond it, at
// most `max` long, `width` across. The boss lands at its end.
function run(
  u: Unit,
  to: { x: number; z: number },
  past: number,
  max: number,
  width: number,
): Placement {
  const d = Math.hypot(to.x - u.x, to.z - u.z) || 1;
  const len = Math.min(max, d + past);
  const x2 = u.x + ((to.x - u.x) / d) * len;
  const z2 = u.z + ((to.z - u.z) / d) * len;
  u.face(to);
  return {
    x: u.x,
    z: u.z,
    shape: { kind: 'line', x2, z2, width },
    done: () => {
      if (u.alive) {
        const at = u.sim.clamp({ x: x2, z: z2 });
        u.x = at.x;
        u.z = at.z;
      }
    },
  };
}

// ---------- The Brood Mother ----------

/** She spits acid where the bearer stands. */
export const ACID_SPIT: Skill = warnedMove({
  id: 'acidSpit',
  name: 'Acid Spit',
  describe: 'Spits acid where the bearer stands. It lands a moment later.',
  cooldown: 9,
  warn: 1.3,
  wants: (u, sim) => {
    const b = bearerOf(sim);
    return b !== null && u.distanceTo(b) <= 14;
  },
  place: (_u, sim) => {
    const b = bearerOf(sim);
    return b ? [{ x: b.x, z: b.z, shape: { kind: 'circle', r: 1.7 } }] : [];
  },
  ratio: 110,
  element: Element.Venom,
  buildup: [{ status: POISON, amount: 20 }],
});

// ---------- The Gatekeeper ----------

const CLEAVE_REACH = 3;
const CLEAVE_SPREAD = (Math.PI * 2) / 3;

/** A wide cleave in front of him. The ground shows its arc before it falls. */
export const CLEAVE: Skill = warnedMove({
  id: 'cleave',
  name: 'Cleave',
  describe: 'A wide cleave across everything in front of him, shown on the ground first.',
  cooldown: 7,
  warn: 1.8,
  wants: (u, sim) => near(u, sim, CLEAVE_REACH),
  place: (u, sim) => {
    const target = sim
      .living(Side.Party)
      .filter((p) => u.distanceTo(p) <= CLEAVE_REACH)
      .sort((a, b) => u.distanceTo(a) - u.distanceTo(b))
      .at(0);
    if (target) {
      u.face(target);
    }
    return [
      {
        x: u.x,
        z: u.z,
        shape: { kind: 'cone', angle: u.angle, spread: CLEAVE_SPREAD, r: CLEAVE_REACH },
      },
    ];
  },
  ratio: 115,
});

/** He lowers his shield and charges at the bearer down a straight line. */
export const CHARGE: Skill = warnedMove({
  id: 'charge',
  name: 'Charge',
  describe: 'Charges down a straight line at the bearer, and past it.',
  cooldown: 11,
  warn: 1.2,
  wants: (u, sim) => {
    const b = bearerOf(sim);
    return b !== null && u.distanceTo(b) >= 4 && u.distanceTo(b) <= 12;
  },
  place: (u, sim) => {
    const b = bearerOf(sim);
    return b ? [run(u, b, 2, 13, 1.8)] : [];
  },
  ratio: 100,
});

/** Wounded, he slams the ground: a ring around him the party must leave. */
export const slam = (wounded: (u: Unit) => boolean): Skill =>
  warnedMove({
    id: 'slam',
    name: 'Slam',
    describe: 'Once wounded, slams the ground, striking all around him.',
    cooldown: 8,
    warn: 2.0,
    wants: (u, sim) => wounded(u) && near(u, sim, 4.5),
    place: (u) => [{ x: u.x, z: u.z, shape: { kind: 'circle', r: 4.5 } }],
    ratio: 90,
  });

// ---------- The Abbess ----------

/** She consecrates the ground under the bearer and two of the party. */
export const CONSECRATE: Skill = warnedMove({
  id: 'consecrate',
  name: 'Consecrate',
  describe: 'Consecrates the ground under the bearer and two of the party.',
  cooldown: 6,
  cost: 20,
  warn: 1.5,
  wants: (u, sim) => near(u, sim, 14),
  place: (_u, sim) =>
    marks(sim, 3).map((p) => ({ x: p.x, z: p.z, shape: { kind: 'circle', r: 1.6 } })),
  ratio: 100,
  element: Element.Radiant,
});

/** A beam of the Church's judgement, through the bearer and on. */
export const JUDGEMENT: Skill = warnedMove({
  id: 'judgement',
  name: 'Judgement',
  describe: 'A beam from her through the bearer, and on.',
  cooldown: 11,
  cost: 30,
  warn: 1.7,
  wants: (u, sim) => {
    const b = bearerOf(sim);
    return b !== null && u.distanceTo(b) <= 14;
  },
  place: (u, sim) => {
    const b = bearerOf(sim);
    if (!b) {
      return [];
    }
    const d = u.distanceTo(b) || 1;
    u.face(b);
    return [
      {
        x: u.x,
        z: u.z,
        shape: {
          kind: 'line',
          x2: u.x + ((b.x - u.x) / d) * 14,
          z2: u.z + ((b.z - u.z) / d) * 14,
          width: 1.4,
        },
      },
    ];
  },
  ratio: 160,
  element: Element.Radiant,
});

// ---------- The Hollowed Saint ----------

/** She marks where the bearer stands, and comes out of the dark onto it. */
export const LUNGE: Skill = warnedMove({
  id: 'lunge',
  name: 'Lunge',
  describe: 'Marks where the bearer stands, then leaps from the dark onto it.',
  cooldown: 8,
  warn: 1.0,
  wants: (u, sim) => {
    const b = bearerOf(sim);
    return b !== null && u.distanceTo(b) > 3.5;
  },
  place: (u, sim) => {
    const b = bearerOf(sim);
    if (!b) {
      return [];
    }
    const at = { x: b.x, z: b.z };
    return [
      {
        ...at,
        shape: { kind: 'circle', r: 1.5 },
        done: () => {
          if (u.alive) {
            u.x = at.x;
            u.z = at.z;
          }
        },
      },
    ];
  },
  ratio: 140,
  element: Element.Occult,
});

/** Dread bursts out of her in a wide ring. */
export const DREAD_NOVA: Skill = warnedMove({
  id: 'dreadNova',
  name: 'Dread Nova',
  describe: 'Dread bursts out of her, striking all around her.',
  cooldown: 10,
  warn: 1.9,
  wants: (u, sim) => near(u, sim, 5),
  place: (u) => [{ x: u.x, z: u.z, shape: { kind: 'circle', r: 5 } }],
  ratio: 90,
  element: Element.Occult,
  buildup: [{ status: DREAD, amount: 40 }],
});
