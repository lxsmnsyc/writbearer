import { describe, expect, it } from 'vitest';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import { CHALLENGE, SHIELD_BASH } from '../../src/content/skills';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { CHILL, FREEZE, POISON, STUN } from '../../src/sim/statuses';
import { DamageKind, Element, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

// A Vanguard and a Hollow soldier. Apart, they are out of each other's sight.
function pair(near = false): { sim: Sim; vanguard: Unit; soldier: Unit } {
  const sim = new Sim(1);
  const vanguard = spawnMerc(sim, 'vanguard', 5, 0, 0);
  const soldier = spawnMonster(sim, 'hollowSoldier', 4, near ? 1 : 30, 0);
  return { sim, vanguard, soldier };
}

describe('buildup', () => {
  it('triggers the status at the threshold and starts again from zero', () => {
    const { vanguard, soldier } = pair();
    const limit = STUN.threshold!(soldier);
    soldier.buildUp(STUN, vanguard, limit - 1);
    expect(soldier.statuses.has(STUN.id)).toBe(false);
    expect(soldier.buildup.get(STUN.id)).toBe(limit - 1);
    soldier.buildUp(STUN, vanguard, 1);
    expect(soldier.statuses.has(STUN.id)).toBe(true);
    expect(soldier.buildup.has(STUN.id)).toBe(false);
  });

  it('holds for a moment, then fades when hits stop', () => {
    const { sim, vanguard, soldier } = pair();
    soldier.buildUp(STUN, vanguard, 50);
    sim.run(1);
    expect(soldier.buildup.get(STUN.id)).toBe(50);
    sim.run(6);
    expect(soldier.buildup.has(STUN.id)).toBe(false);
  });

  it('can be changed by CheckBuildup', () => {
    const { sim, vanguard, soldier } = pair();
    sim.on(SimEvents.CheckBuildup, ValuePriority.Multiplicative, (event) => {
      event.value *= 2;
    });
    soldier.buildUp(STUN, vanguard, 10);
    expect(soldier.buildup.get(STUN.id)).toBe(20);
  });

  it('comes from elemental hits', () => {
    const { vanguard, soldier } = pair();
    vanguard.attackElement = Element.Venom;
    for (let i = 0; i < 10 && !soldier.statuses.has(POISON.id); i++) {
      vanguard.hit(soldier, { kind: DamageKind.True, fixed: 30 });
    }
    expect(soldier.statuses.has(POISON.id)).toBe(true);
  });
});

describe('statuses', () => {
  it('stun stops a unit from acting and breaks its swing', () => {
    const { sim, vanguard, soldier } = pair(true);
    soldier.aware = true;
    sim.tick();
    expect(soldier.swing).toBeGreaterThanOrEqual(0);
    soldier.addStatus(STUN, vanguard);
    expect(soldier.swing).toBe(-1);
    const hp = vanguard.hp;
    const at = { x: soldier.x, z: soldier.z };
    sim.run(STUN.duration - 0.1);
    expect(vanguard.hp).toBe(hp);
    expect({ x: soldier.x, z: soldier.z }).toEqual(at);
  });

  it('leaves the unit immune to it for a while after it ends', () => {
    const { sim, vanguard, soldier } = pair();
    soldier.addStatus(STUN, vanguard);
    sim.run(STUN.duration + 0.1);
    expect(soldier.statuses.has(STUN.id)).toBe(false);
    expect(soldier.addStatus(STUN, vanguard)).toBeNull();
    sim.run(STUN.immunity);
    expect(soldier.addStatus(STUN, vanguard)).not.toBeNull();
  });

  it('lasts as long as CheckStatusDuration says', () => {
    const { sim, vanguard, soldier } = pair();
    sim.on(SimEvents.CheckStatusDuration, ValuePriority.Multiplicative, (event) => {
      event.value /= 2;
    });
    expect(soldier.addStatus(STUN, vanguard)?.remaining).toBe(STUN.duration / 2);
  });

  it('chill slows, and chilling again freezes into Frost', () => {
    const { vanguard, soldier } = pair();
    const speed = soldier.speed;
    soldier.buildUp(CHILL, vanguard, CHILL.threshold!(soldier));
    expect(soldier.speed).toBeCloseTo(speed * CHILL.slow!);
    soldier.buildUp(CHILL, vanguard, CHILL.threshold!(soldier));
    expect(soldier.statuses.has(CHILL.id)).toBe(false);
    expect(soldier.statuses.has(FREEZE.id)).toBe(true);
    expect(soldier.element).toBe(Element.Frost);
    soldier.removeStatus(FREEZE.id);
    expect(soldier.element).toBe(Element.Neutral);
  });

  it('poison deals damage over time and cuts healing, then lets go', () => {
    const { sim, vanguard, soldier } = pair();
    soldier.addStatus(POISON, vanguard);
    sim.run(3.05);
    const lost = soldier.derived.maxHp - soldier.hp;
    expect(lost).toBe(3 * Math.round(soldier.derived.maxHp * 0.02));
    expect(soldier.heal(soldier, 100).value).toBe(Math.min(50, lost));
    soldier.removeStatus(POISON.id);
    soldier.hp = 1;
    expect(soldier.heal(soldier, 100).value).toBe(100);
  });

  it('ends on death without leaving changes behind', () => {
    const { vanguard, soldier } = pair();
    soldier.addStatus(FREEZE, vanguard);
    soldier.die(vanguard);
    expect(soldier.statuses.size).toBe(0);
    expect(soldier.element).toBe(Element.Neutral);
  });
});

describe('Shield Bash', () => {
  it('breaks off a skill the target is winding up, and builds up stun', () => {
    const { sim, vanguard, soldier } = pair(true);
    // The soldier borrows a skill, so it has something to wind up.
    soldier.mana = 100;
    soldier.kit.moveSpeed = 0;
    vanguard.mana = 100;
    sim.on(SimEvents.CheckHit, ValuePriority.Pre, (event) => {
      event.hitChance = 1000;
    });
    expect(soldier.startCast(CHALLENGE, null)).toBe(true);
    expect(vanguard.startCast(SHIELD_BASH, soldier)).toBe(true);
    sim.run(SHIELD_BASH.windup + 0.05);
    expect(soldier.cast).toBeNull();
    expect(soldier.buildup.get(STUN.id)).toBeGreaterThan(0);
  });
});
