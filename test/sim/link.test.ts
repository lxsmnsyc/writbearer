import { describe, expect, it } from 'vitest';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import { SimEvents } from '../../src/sim/events';
import { linksOf } from '../../src/sim/link';
import Sim from '../../src/sim/sim';
import { DamageFlags, DamageKind } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

function arena(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

const strike = (from: Unit, to: Unit, value: number): void => {
  from.hit(to, { kind: DamageKind.True, fixed: value, flags: 0 });
};

function trio(sim: Sim): Unit[] {
  return [
    spawnMonster(sim, 'husk', 8, 10, 10),
    spawnMonster(sim, 'husk', 8, 11, 10),
    spawnMonster(sim, 'husk', 8, 12, 10),
  ];
}

function run(sim: Sim, seconds: number): void {
  for (let t = 0; t < seconds; t += 0.1) {
    sim.tick(0.1);
  }
}

// A small last blow, so the body is not torn and can rise
function kill(u: Unit): void {
  u.hp = 1;
  u.hit(u, { kind: DamageKind.True, fixed: 1, flags: DamageFlags.Redirected });
}

describe('linked units', () => {
  it('share a hit evenly, once, without looping', () => {
    const sim = arena();
    const group = trio(sim);
    linksOf(sim).link(group);
    const full = group[0].hp;
    const merc = spawnMerc(sim, 'vanguard', 8, 9, 10);
    strike(merc, group[0], 30);
    for (const u of group) {
      expect(full - u.hp).toBeGreaterThan(8);
      expect(full - u.hp).toBeLessThan(12);
    }
  });

  it('give one death event per unit when a shared hit kills', () => {
    const sim = arena();
    const group = trio(sim);
    linksOf(sim).link(group);
    const dead: Unit[] = [];
    sim.on(SimEvents.UnitDies, 0, (e) => {
      dead.push(e.source);
    });
    const merc = spawnMerc(sim, 'vanguard', 8, 9, 10);
    strike(merc, group[0], group[0].hp * 10);
    expect(dead).toHaveLength(3);
    expect(new Set(dead).size).toBe(3);
  });

  it('raise the fallen when the rest outlive the window', () => {
    const sim = arena();
    const group = trio(sim);
    linksOf(sim).link(group, { window: 3 });
    kill(group[0]);
    expect(group[0].alive).toBe(false);
    run(sim, 2);
    expect(group[0].alive).toBe(false);
    run(sim, 2);
    expect(group[0].alive).toBe(true);
  });

  it('stay dead when all fall inside the window', () => {
    const sim = arena();
    const group = trio(sim);
    linksOf(sim).link(group, { window: 3 });
    for (const u of group) {
      kill(u);
      run(sim, 0.5);
    }
    run(sim, 6);
    for (const u of group) {
      expect(u.alive).toBe(false);
    }
  });

  it('heal each other', () => {
    const sim = arena();
    const group = trio(sim);
    linksOf(sim).link(group, { heal: 0.1, healEvery: 1 });
    group[1].hp = 5;
    run(sim, 1.5);
    expect(group[1].hp).toBeGreaterThan(5);
  });

  it('swap places, linked and living only', () => {
    const sim = arena();
    const group = trio(sim);
    const other = spawnMonster(sim, 'husk', 8, 20, 20);
    const links = linksOf(sim);
    links.link(group);
    expect(links.swap(group[0], group[2])).toBe(true);
    expect([group[0].x, group[2].x]).toEqual([12, 10]);
    expect(links.swap(group[0], other)).toBe(false);
  });
});
