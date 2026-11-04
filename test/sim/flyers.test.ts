import { describe, expect, it } from 'vitest';
import RANGER_UPGRADES from '../../src/content/jobs/ranger/upgrades';
import { SPAWN_STEPS } from '../../src/content/monsters/spawn-steps';
import { MONSTERS } from '../../src/content/monsters/table';
import { pinTime } from '../../src/content/ranger';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { DEFAULT_TOGGLES, type Toggles } from '../../src/sim/ai';
import { SimEvents } from '../../src/sim/events';
import {
  ALOFT_MAX,
  LAND_TIME,
  flies,
  ground,
  isAloft,
  makeFlyer,
  takeOff,
} from '../../src/sim/flight';
import Sim from '../../src/sim/sim';
import { SkillMode } from '../../src/sim/skill';
import { ROOTED } from '../../src/sim/statuses';
import { canTarget } from '../../src/sim/targeting';
import { Side, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { withUpgrade } from '../support/build';

const DT = 0.05;

function run(sim: Sim, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    sim.tick(DT);
  }
}

function field(seed = 1): Sim {
  const sim = new Sim(seed);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

// A test-only flyer: a monster given wings, not in the roster
function flyer(sim: Sim, x: number, z: number, style: 'dive' | 'hover' = 'dive'): Unit {
  const m = spawnMonster(sim, 'hollowSoldier', 1, x, z);
  m.aware = true;
  makeFlyer(m, style);
  return m;
}

function quiet(): Toggles {
  const skills: Toggles['skills'] = { aimedShot: SkillMode.Off };
  return { ...DEFAULT_TOGGLES, skills };
}

function upgrade(id: string): (typeof RANGER_UPGRADES)[number] {
  const found = RANGER_UPGRADES.find((u) => u.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
}

function aimedShot(u: Unit): NonNullable<Unit['cast']>['skill'] {
  const found = u.skills.find((s) => s.id === 'aimedShot');
  if (!found) {
    throw new Error('aimedShot');
  }
  return found;
}

describe('flyers', () => {
  it('cannot be picked by a melee merc while aloft, and can once landed', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const f = flyer(sim, 14, 10);
    f.still = true;
    expect(isAloft(f)).toBe(true);
    expect(canTarget(merc, f)).toBe(false);
    run(sim, 3);
    expect(f.hp).toBe(f.derived.maxHp);
    ground(f, 2);
    expect(canTarget(merc, f)).toBe(true);
    run(sim, 1.5);
    expect(f.hp).toBeLessThan(f.derived.maxHp);
  });

  it('can be picked and hit by a ranged merc while aloft', () => {
    const sim = field();
    sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
      event.hit = true;
    });
    spawnBearer(sim, 10, 10);
    const ranger = spawnMerc(sim, 'ranger', 5, 10, 12);
    const f = flyer(sim, 14, 10);
    f.still = true;
    expect(isAloft(f)).toBe(true);
    expect(canTarget(ranger, f)).toBe(true);
    run(sim, 4);
    expect(f.hp).toBeLessThan(f.derived.maxHp);
  });

  it('Pin Down grounds a flyer for the root, then it takes off again', () => {
    const sim = field();
    sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
      event.hit = true;
    });
    spawnBearer(sim, 10, 10);
    const ranger = spawnMerc(sim, 'ranger', 10, 10, 12, quiet());
    ranger.kit.moveSpeed = 0;
    ranger.mana = ranger.derived.maxMana;
    withUpgrade(ranger, upgrade('pinDown'));
    const f = flyer(sim, 14, 10);
    f.still = true;
    const skill = aimedShot(ranger);
    expect(ranger.startCast(skill, f)).toBe(true);
    run(sim, skill.windup + 0.6);
    expect(f.statuses.has(ROOTED.id)).toBe(true);
    expect(isAloft(f)).toBe(false);
    // It stays down for the root's time and then rises
    run(sim, pinTime(10) + 0.5);
    expect(isAloft(f)).toBe(true);
  });

  it('the same Pin Down shot on a walker only roots', () => {
    const sim = field();
    sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
      event.hit = true;
    });
    spawnBearer(sim, 10, 10);
    const ranger = spawnMerc(sim, 'ranger', 10, 10, 12, quiet());
    ranger.kit.moveSpeed = 0;
    ranger.mana = ranger.derived.maxMana;
    withUpgrade(ranger, upgrade('pinDown'));
    const walker = spawnMonster(sim, 'hollowSoldier', 1, 14, 10);
    walker.still = true;
    walker.aware = true;
    const skill = aimedShot(ranger);
    expect(ranger.startCast(skill, walker)).toBe(true);
    run(sim, skill.windup + 0.6);
    expect(walker.statuses.has(ROOTED.id)).toBe(true);
    expect(flies(walker)).toBe(false);
    expect(isAloft(walker)).toBe(false);
  });

  it('Eagle Eye never misses a flyer, and a walker can still dodge it', () => {
    const hits = (id: string | null, wings: boolean): number => {
      let count = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const sim = field(seed);
        spawnBearer(sim, 10, 10);
        const ranger = spawnMerc(sim, 'ranger', 10, 10, 12, quiet());
        ranger.kit.moveSpeed = 0;
        ranger.mana = ranger.derived.maxMana;
        if (id) {
          withUpgrade(ranger, upgrade(id));
        }
        const m = spawnMonster(sim, 'hollowSoldier', 1, 14, 10);
        m.still = true;
        m.derived.evasion = 500;
        m.derived.maxHp = 100000;
        m.hp = 100000;
        if (wings) {
          makeFlyer(m, 'hover');
        }
        const skill = aimedShot(ranger);
        if (ranger.startCast(skill, m)) {
          run(sim, skill.windup + 0.6);
        }
        if (m.hp < 100000) {
          count++;
        }
      }
      return count;
    };
    expect(hits('eagleEye', true)).toBe(20);
    expect(hits('eagleEye', false)).toBeLessThan(20);
    expect(hits(null, true)).toBeLessThan(20);
  });

  it('a diver lands, and two melee mercs alone win by waiting', () => {
    const sim = field();
    const bearer = spawnBearer(sim, 10, 10);
    spawnMerc(sim, 'vanguard', 5, 12, 10);
    spawnMerc(sim, 'sellsword', 5, 12, 12);
    const f = flyer(sim, 20, 10);
    let landed = false;
    for (let t = 0; t < 200 && f.alive; t += DT) {
      sim.tick(DT);
      landed = landed || !isAloft(f);
    }
    expect(f.alive).toBe(false);
    expect(landed).toBe(true);
    expect(bearer.alive).toBe(true);
    expect(sim.living(Side.Monster)).toHaveLength(0);
  });

  it('a hoverer perches after ALOFT_MAX seconds, so it cannot stalemate', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    merc.kit.moveSpeed = 0;
    const f = flyer(sim, 14, 10, 'hover');
    f.kit.moveSpeed = 0;
    f.kit.interval = 999;
    let down = 0;
    for (let t = 0; t < ALOFT_MAX * 3; t += DT) {
      sim.tick(DT);
      if (!isAloft(f)) {
        down += DT;
      }
    }
    expect(down).toBeGreaterThan(LAND_TIME);
  });

  it('takeOff lifts a grounded flyer; a walker is never aloft', () => {
    const sim = field();
    const f = flyer(sim, 20, 10);
    ground(f, 10);
    expect(isAloft(f)).toBe(false);
    takeOff(f);
    expect(isAloft(f)).toBe(true);
    const walker = spawnMonster(sim, 'hollowSoldier', 1, 5, 5);
    ground(walker, 5);
    expect(isAloft(walker)).toBe(false);
  });

  it('the spawn step gives a flying template wings', () => {
    const sim = field();
    const m = spawnMonster(sim, 'mite', 1, 5, 5);
    expect(flies(m)).toBe(false);
    for (const step of SPAWN_STEPS) {
      step(m, { ...MONSTERS.mite, flies: 'hover' }, sim);
    }
    expect(flies(m)).toBe(true);
  });
});
