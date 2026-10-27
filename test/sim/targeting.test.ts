import { describe, expect, it } from 'vitest';
import { HEAL } from '../../src/content/skills';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { TAUNTED } from '../../src/sim/statuses';
import { canTarget, hostiles } from '../../src/sim/targeting';
import { ValuePriority } from '../../src/sim/types';
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

  it('does not filter area damage', () => {
    const sim = field();
    spawnBearer(sim, 30, 30);
    const merc = spawnMerc(sim, 'vanguard', 5, 10, 10);
    const a = spawnMonster(sim, 'hollowArcher', 5, 12, 10);
    forbid(sim, a);
    merc.hit(a);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
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
});
