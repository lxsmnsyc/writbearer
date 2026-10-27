import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { HEAL } from '../../src/content/skills';
import { Shout } from '../../src/sim/shout';
import { type Skill, Targeting } from '../../src/sim/skill';
import { setZone } from '../../src/sim/zone';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { ROOTED, STUN, TAUNTED } from '../../src/sim/statuses';
import { canTarget, hostiles } from '../../src/sim/targeting';
import { Element, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const DT = 0.05;

function field(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

// Forbids every pick of one unit.
function forbid(sim: Sim, victim: Unit): void {
  sim.on(SimEvents.CheckTarget, ValuePriority.Post, (event) => {
    if (event.target === victim) {
      event.allowed = false;
    }
  });
}

describe('CheckTarget', () => {
  it('allows every living foe when nobody listens', () => {
    const sim = field();
    const bearer = spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 15, 10);
    expect(canTarget(merc, a)).toBe(true);
    expect(canTarget(a, merc)).toBe(true);
    expect(canTarget(merc, bearer)).toBe(false);
    expect(hostiles(merc)).toEqual([a]);
    a.alive = false;
    expect(canTarget(merc, a)).toBe(false);
  });

  it('makes a merc pick another monster', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const near = spawnMonster(sim, 'hollowArcher', 5, 14, 10);
    const far = spawnMonster(sim, 'hollowArcher', 5, 17, 10);
    near.aware = true;
    far.aware = true;
    forbid(sim, near);
    sim.tick(DT);
    expect(merc.target).toBe(far);
  });

  it('drops a forbidden current target on the next think', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 14, 10);
    a.aware = true;
    sim.tick(DT);
    expect(merc.target).toBe(a);
    forbid(sim, a);
    sim.tick(DT);
    expect(merc.target).toBeNull();
  });

  it('makes a monster pick another merc and ignore a forbidden taunter', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const taunter = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const other = spawnMerc(sim, 'vanguard', 5, 20, 10);
    const monster = spawnMonster(sim, 'hollowArcher', 5, 16, 10);
    monster.aware = true;
    monster.addStatus(TAUNTED, taunter);
    forbid(sim, taunter);
    sim.tick(DT);
    expect(monster.target).toBe(other);
  });

  it('keeps straight shots off a forbidden unit', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const merc = spawnMerc(sim, 'ranger', 5, 10, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 14, 10);
    const b = spawnMonster(sim, 'hollowArcher', 5, 16, 10);
    forbid(sim, a);
    sim.fire(merc, b, { speed: 14, pierce: true, options: {} });
    for (let t = 0; t < 1; t += DT) {
      sim.tick(DT);
    }
    expect(a.hp).toBe(a.derived.maxHp);
    expect(b.hp).toBeLessThan(b.derived.maxHp);
  });

  it('does not filter a trap, an area effect', () => {
    const sim = field();
    const bearer = spawnBearer(sim, 30, 30);
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 12, 10);
    a.kit.moveSpeed = 0;
    forbid(sim, a);
    sim.traps.push({
      owner: merc,
      x: 12,
      z: 10,
      radius: 0.5,
      life: 15,
      status: ROOTED,
      duration: 3,
      sprung: false,
      skill: 'test',
    });
    sim.tick(DT);
    expect(a.statuses.has(ROOTED.id)).toBe(true);
    expect(bearer.alive).toBe(true);
  });

  it('does not ask about allies, so heals still reach them', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const cleric = spawnMerc(sim, 'cleric', 5, 11, 10);
    const hurt = spawnMerc(sim, 'vanguard', 5, 12, 10);
    hurt.hp = hurt.derived.maxHp * 0.3;
    cleric.skills.push(HEAL);
    cleric.skillRanks.set('heal', 1);
    let asked = 0;
    sim.on(SimEvents.CheckTarget, ValuePriority.Post, (event) => {
      if (event.target.side === cleric.side) {
        asked++;
        event.allowed = false;
      }
    });
    const before = hurt.hp;
    for (let t = 0; t < 4; t += DT) {
      sim.tick(DT);
    }
    expect(asked).toBe(0);
    expect(hurt.hp).toBeGreaterThan(before);
  });

  it('makes a Support hunter keep off a forbidden unit', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const near = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const far = spawnMerc(sim, 'vanguard', 5, 14, 10);
    const cantor = spawnMonster(sim, 'cantor', 5, 11, 10);
    cantor.aware = true;
    forbid(sim, near);
    sim.tick(DT);
    expect(cantor.target).toBe(far);
    expect(cantor.swingTarget).not.toBe(near);
  });

  it('passes over a forbidden target that a skill aims at', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 20, 10);
    a.kit.moveSpeed = 0;
    let released = 0;
    const skill: Skill = {
      id: 'probe',
      name: 'Probe',
      describe: () => '',
      cost: 0,
      cooldown: 1,
      windup: 0.1,
      recovery: 0.1,
      targeting: Targeting.Enemy,
      aim: () => a,
      wants: () => true,
      elite: () => true,
      release: () => {
        released++;
      },
    };
    merc.skills.push(skill);
    forbid(sim, a);
    for (let t = 0; t < 1; t += DT) {
      sim.tick(DT);
    }
    expect(released).toBe(0);
  });

  it('keeps a Focus shout off a forbidden unit', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'vanguard', 5, 12, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 14, 10);
    const b = spawnMonster(sim, 'hollowArcher', 5, 18, 10);
    a.aware = true;
    b.aware = true;
    merc.heard = { shout: Shout.Focus, from: 0, until: 99, target: b };
    forbid(sim, b);
    sim.tick(DT);
    expect(merc.target).toBe(a);
  });

  it('keeps a monster from walking to bait whose owner is forbidden', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    spawnMerc(sim, 'vanguard', 5, 10, 14);
    const monster = spawnMonster(sim, 'penitent', 5, 14, 10);
    monster.aware = true;
    setZone(sim, {
      kind: 'bait',
      owner: merc,
      x: 14,
      z: 18,
      r: 0.6,
      life: 5,
      element: Element.Neutral,
      lure: 10,
    });
    forbid(sim, merc);
    sim.tick(DT);
    // Not drawn in: it keeps a target of its own.
    expect(monster.target).not.toBeNull();
  });

  it('walks to bait with no listener, even when the owner has died', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const owner = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const monster = spawnMonster(sim, 'penitent', 5, 14, 10);
    monster.aware = true;
    setZone(sim, {
      kind: 'bait',
      owner,
      x: 14,
      z: 18,
      r: 0.6,
      life: 5,
      element: Element.Neutral,
      lure: 10,
    });
    owner.alive = false;
    sim.tick(DT);
    expect(monster.target).toBeNull();
    expect(monster.z).toBeGreaterThan(10);
  });

  it('keeps a monster from hitting a forbidden unit in the way', () => {
    const sim = field();
    const bearer = spawnBearer(sim, 16, 10);
    const blocker = spawnMerc(sim, 'vanguard', 5, 11, 10);
    const monster = spawnMonster(sim, 'penitent', 5, 10, 10);
    monster.aware = true;
    sim.tick(DT);
    expect(monster.swingTarget).toBe(blocker);
    const sim2 = field();
    spawnBearer(sim2, 16, 10);
    const blocker2 = spawnMerc(sim2, 'vanguard', 5, 11, 10);
    const monster2 = spawnMonster(sim2, 'penitent', 5, 10, 10);
    monster2.aware = true;
    forbid(sim2, blocker2);
    sim2.tick(DT);
    expect(monster2.swingTarget).toBeNull();
    expect(bearer.alive).toBe(true);
  });

  it('keeps volley arrows off a forbidden extra', () => {
    const sim = field();
    spawnBearer(sim, 10, 10);
    const merc = spawnMerc(sim, 'ranger', 5, 10, 10);
    merc.volley = 3;
    const a = spawnMonster(sim, 'hollowArcher', 5, 13, 10);
    const b = spawnMonster(sim, 'hollowArcher', 5, 13, 11);
    for (const m of [a, b]) {
      m.aware = true;
      m.kit.moveSpeed = 0;
    }
    forbid(sim, b);
    const aimed = new Set<Unit | null>();
    for (let t = 0; t < 3; t += DT) {
      sim.tick(DT);
      for (const p of sim.projectiles) {
        if (p.source === merc) {
          aimed.add(p.homing);
        }
      }
    }
    expect(aimed.has(a)).toBe(true);
    expect(aimed.has(b)).toBe(false);
  });

  it('does not strike a target forbidden during the swing', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 10.8, 10);
    a.kit.moveSpeed = 0;
    expect(merc.startAttack(a)).toBe(true);
    forbid(sim, a);
    const hp = a.hp;
    for (let t = 0; t < 1; t += DT) {
      sim.tick(DT);
    }
    expect(a.hp).toBe(hp);
  });

  it('cancels a cast on a target forbidden during the windup', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 12, 10);
    a.kit.moveSpeed = 0;
    let released = 0;
    const skill: Skill = {
      id: 'probe',
      name: 'Probe',
      describe: () => '',
      cost: 0,
      cooldown: 1,
      windup: 0.5,
      recovery: 0.1,
      targeting: Targeting.Enemy,
      wants: () => true,
      elite: () => true,
      release: () => {
        released++;
      },
    };
    expect(merc.startCast(skill, a)).toBe(true);
    forbid(sim, a);
    for (let t = 0; t < 1; t += DT) {
      sim.tick(DT);
    }
    expect(released).toBe(0);
  });

  it('does not strike with an arrow in flight at a unit forbidden since', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const merc = spawnMerc(sim, 'ranger', 5, 10, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 20, 10);
    a.kit.moveSpeed = 0;
    sim.fire(merc, a, { speed: 14, homing: true, options: {} });
    forbid(sim, a);
    const hp = a.hp;
    for (let t = 0; t < 2; t += DT) {
      sim.tick(DT);
    }
    expect(a.hp).toBe(hp);
  });

  it('asks about a forbidden unit once per straight shot', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const merc = spawnMerc(sim, 'ranger', 5, 10, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 14, 10);
    a.kit.moveSpeed = 0;
    merc.addStatus(STUN, a, 99);
    let asked = 0;
    sim.on(SimEvents.CheckTarget, ValuePriority.Post, (event) => {
      if (event.target === a && event.source === merc) {
        asked++;
        event.allowed = false;
      }
    });
    sim.fire(merc, a, { speed: 14, pierce: true, radius: 1, options: {} });
    for (let t = 0; t < 1; t += DT) {
      sim.tick(DT);
    }
    expect(asked).toBeGreaterThan(0);
    expect(asked).toBeLessThanOrEqual(2);
  });
});
