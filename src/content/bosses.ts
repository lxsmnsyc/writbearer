import { EventPriority } from '../core/event-emitter';
import { SimEvents, type UnitDamageEvent } from '../sim/events';
import type Sim from '../sim/sim';
import { type Skill, Targeting } from '../sim/skill';
import type { StatusDef } from '../sim/status';
import { DREAD } from '../sim/statuses';
import { DamagePriority, Side } from '../sim/types';
import type Unit from '../sim/unit';
import { Hunt } from '../sim/ai';
import { CHARGE, CLEAVE, CONSECRATE, DREAD_NOVA, JUDGEMENT, LUNGE, slam } from './boss-moves';
import { spawnBroodMother } from './brood';
import { spawnMonster } from './roster';

// The bosses of the layers below the Marches. Each tests one setup.

const party = (sim: Sim): Unit[] => sim.living(Side.Party);

// Calls `once` the first time `boss` drops to `share` of its health.
function atHealth(sim: Sim, boss: Unit, share: number, once: () => void): void {
  let done = false;
  sim.on(SimEvents.UnitDamage, DamagePriority.Post, (event) => {
    if (!done && event.target === boss && boss.alive && boss.hp <= boss.derived.maxHp * share) {
      done = true;
      once();
    }
  });
}

// Spawns monsters around a boss, awake, as its call brings them.
function call(sim: Sim, boss: Unit, kind: 'hollowSoldier' | 'penitent', count: number): Unit[] {
  return Array.from({ length: count }, (_, i) => {
    const a = boss.angle + Math.PI + ((i - (count - 1) / 2) * Math.PI) / 4;
    const m = spawnMonster(
      sim,
      kind,
      Math.max(1, boss.level - 2),
      boss.x + Math.cos(a) * 2.5,
      boss.z + Math.sin(a) * 2.5,
    );
    m.aware = true;
    return m;
  });
}

// ---------- The Gatekeeper ----------

/**
 * The Gatekeeper. A wide cleave in front of him and a charge at the bearer,
 * both shown on the ground first. At half health he blows his horn, three
 * of his guard come, and he starts slamming the ground around him.
 */
function spawnGatekeeper(sim: Sim, level: number, x: number, z: number): Unit {
  const boss = spawnMonster(sim, 'gatekeeper', level, x, z);
  let wounded = false;
  boss.skills.push(
    CLEAVE,
    CHARGE,
    slam(() => wounded),
  );
  atHealth(sim, boss, 0.5, () => {
    wounded = true;
    call(sim, boss, 'hollowSoldier', 3);
  });
  return boss;
}

// ---------- The Abbess ----------

const LITANY_RADIUS = 5;
const SANCTIFIED_TIME = 6;
const FLOCK_CAP = 4;

/** The Abbess's Litany: nothing harms the sanctified while it lasts. */
export const SANCTIFIED: StatusDef = {
  id: 'sanctified',
  name: 'Sanctified',
  duration: SANCTIFIED_TIME,
  immunity: 0,
  setup: (s) => {
    const listener = (event: UnitDamageEvent): void => {
      if (event.target === s.unit) {
        event.value = 0;
      }
    };
    return {
      start: () => {
        s.unit.sim.on(SimEvents.UnitDamage, DamagePriority.Barrier, listener);
      },
      stop: () => {
        s.unit.sim.off(SimEvents.UnitDamage, DamagePriority.Barrier, listener);
      },
    };
  },
};

const flockOf = (u: Unit): Unit[] =>
  u.sim
    .living(Side.Monster)
    .filter((m) => m.kind === 'penitent' && u.distanceTo(m) <= LITANY_RADIUS);

/**
 * The Abbess. A long Litany that sanctifies every Penitent within 5 tiles of
 * her: nothing harms them for 6 seconds. She is not shielded herself, so the
 * party can go past them to her. A stun or a Shield Bash breaks it off before
 * it ends.
 */
export const LITANY: Skill = {
  id: 'litany',
  name: 'Litany',
  describe: () =>
    `A long prayer. Nothing harms her Penitents within ${LITANY_RADIUS} tiles for ${SANCTIFIED_TIME} seconds.`,
  cost: 40,
  cooldown: 14,
  windup: 2.6,
  recovery: 0.4,
  targeting: Targeting.Self,
  wants(u) {
    return u.aware;
  },
  elite() {
    return false;
  },
  release(u) {
    for (const m of flockOf(u)) {
      m.addStatus(SANCTIFIED, u);
    }
  },
};

/** The Abbess. She calls two Penitents to her, up to four at a time. */
export const CALL_FLOCK: Skill = {
  id: 'callFlock',
  name: 'Call the Flock',
  describe: () => 'Calls two Penitents to her side.',
  cost: 30,
  cooldown: 12,
  windup: 1.0,
  recovery: 0.4,
  targeting: Targeting.Self,
  wants(u) {
    return (
      u.aware && u.sim.living(Side.Monster).filter((m) => m.kind === 'penitent').length < FLOCK_CAP
    );
  },
  elite() {
    return false;
  },
  release(u, _target, sim) {
    call(sim, u, 'penitent', 2);
  },
};

function spawnAbbess(sim: Sim, level: number, x: number, z: number): Unit {
  const boss = spawnMonster(sim, 'abbess', level, x, z);
  boss.skills.push(LITANY, CALL_FLOCK, CONSECRATE, JUDGEMENT);
  boss.mana = boss.derived.maxMana;
  call(sim, boss, 'penitent', 2).forEach((m) => {
    m.aware = false;
  });
  return boss;
}

// ---------- The Hollowed Saint ----------

// How far her Dread reaches, and how far once she is wounded to half
const DREAD_AURA = 3;
const DREAD_AURA_WOUNDED = 4.5;
// Dread built up each second in a merc within the aura
const DREAD_PER_SECOND = 14;

export { CLEAVE, LUNGE };
/**
 * The Hollowed Saint. Dread gathers in every merc near her, each second.
 * She leaps onto where the bearer stood, and bursts with Dread around her.
 * At half health her Dread reaches further, and she goes for the bearer.
 */
function spawnSaint(sim: Sim, level: number, x: number, z: number): Unit {
  const boss = spawnMonster(sim, 'hollowedSaint', level, x, z);
  boss.skills.push(LUNGE, DREAD_NOVA);
  let aura = DREAD_AURA;
  let tick = 0;
  sim.on(SimEvents.Tick, EventPriority.Post, (event) => {
    if (!boss.alive || !boss.aware) {
      return;
    }
    tick += event.dt;
    if (tick < 1) {
      return;
    }
    tick -= 1;
    for (const m of party(sim)) {
      if (m !== sim.bearer && boss.distanceTo(m) <= aura) {
        m.buildUp(DREAD, boss, DREAD_PER_SECOND);
      }
    }
  });
  // Wounded, she widens her Dread and hunts the bearer alone.
  atHealth(sim, boss, 0.5, () => {
    aura = DREAD_AURA_WOUNDED;
    boss.hunt = Hunt.Bearer;
  });
  return boss;
}

/** The boss of each layer, by its index: the Marches first. */
const SPAWN: ((sim: Sim, level: number, x: number, z: number) => Unit)[] = [
  spawnBroodMother,
  spawnGatekeeper,
  spawnAbbess,
  spawnSaint,
];

/** Spawns a layer's boss. */
export function spawnBoss(sim: Sim, layer: number, level: number, x: number, z: number): Unit {
  return SPAWN[Math.min(layer, SPAWN.length - 1)](sim, level, x, z);
}
