import { describe, expect, it } from 'vitest';
import { spawnBearer, spawnMonster } from '../../src/content/roster';
import { SimEvents } from '../../src/sim/events';
import knockback from '../../src/sim/knockback';
import Nav from '../../src/sim/nav';
import Sim from '../../src/sim/sim';
import { FRIGHTENED } from '../../src/sim/afflict';
import { DREAD, ROOTED, SHIELD_WALL, STUN } from '../../src/sim/statuses';
import { Rank, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

// The knockback system: stops, vetoes and the units it leaves alone.

function setup(): { sim: Sim; pusher: Unit; bearer: Unit } {
  const sim = new Sim(3);
  sim.nav = new Nav(20, 20, []);
  const bearer = spawnBearer(sim, 1, 1);
  const pusher = spawnMonster(sim, 'hollowSoldier', 10, 5, 10);
  return { sim, pusher, bearer };
}

function foe(sim: Sim, x: number, z: number): Unit {
  const m = spawnMonster(sim, 'hollowSoldier', 10, x, z);
  m.kit.moveSpeed = 0;
  return m;
}

describe('knockback', () => {
  it('moves a unit the full distance in open ground', () => {
    const { sim, pusher } = setup();
    const target = foe(sim, 10, 10);
    const moved = knockback(pusher, target, { x: 9, z: 10 }, 1.5);
    expect(moved).toBeCloseTo(1.5);
    expect(target.x).toBeCloseTo(11.5);
    expect(target.z).toBeCloseTo(10);
  });

  it('stops at a wall of the floor', () => {
    const { sim, pusher } = setup();
    const target = foe(sim, 19.5, 10);
    const moved = knockback(pusher, target, { x: 18, z: 10 }, 3);
    expect(moved).toBeLessThan(1);
    expect(target.x).toBeLessThan(20);
    expect(sim.nav?.walkable(target.x, target.z)).toBe(true);
  });

  it('stops before a blocked tile', () => {
    const { sim, pusher } = setup();
    sim.nav?.block([[12, 10]], 10);
    const target = foe(sim, 10.5, 10.5);
    const moved = knockback(pusher, target, { x: 9, z: 10.5 }, 3);
    expect(moved).toBeLessThan(3);
    expect(target.x).toBeLessThan(12);
    expect(sim.nav?.walkable(target.x, target.z)).toBe(true);
  });

  it('stops short of another body', () => {
    const { sim, pusher } = setup();
    const target = foe(sim, 10, 10);
    const other = foe(sim, 11.5, 10);
    const moved = knockback(pusher, target, { x: 9, z: 10 }, 3);
    expect(moved).toBeLessThan(3);
    expect(other.x - target.x).toBeGreaterThanOrEqual(0.49);
  });

  it('can be shortened or vetoed by a listener', () => {
    const { sim, pusher } = setup();
    const target = foe(sim, 10, 10);
    const off = sim.on(SimEvents.CheckKnockback, ValuePriority.Post, (event) => {
      event.distance = 0.5;
    });
    expect(knockback(pusher, target, { x: 9, z: 10 }, 2)).toBeCloseTo(0.5);
    off.stop();
    sim.on(SimEvents.CheckKnockback, ValuePriority.Post, (event) => {
      event.disabled = true;
    });
    const x = target.x;
    expect(knockback(pusher, target, { x: 9, z: 10 }, 2)).toBe(0);
    expect(target.x).toBe(x);
  });

  it('leaves a boss, the bearer, a rooted unit and the dead alone', () => {
    const { sim, pusher, bearer } = setup();
    const boss = foe(sim, 10, 10);
    boss.rank = Rank.Boss;
    expect(knockback(pusher, boss, { x: 9, z: 10 }, 1)).toBe(0);
    expect(knockback(pusher, bearer, { x: 0, z: 1 }, 1)).toBe(0);
    const rooted = foe(sim, 14, 14);
    rooted.addStatus(ROOTED, pusher);
    expect(knockback(pusher, rooted, { x: 13, z: 14 }, 1)).toBe(0);
    const dead = foe(sim, 16, 16);
    dead.alive = false;
    expect(knockback(pusher, dead, { x: 15, z: 16 }, 1)).toBe(0);
  });

  it('clears the route of the unit it moves', () => {
    const { sim, pusher } = setup();
    const target = foe(sim, 10, 10);
    target.route = { x: 1, z: 1, at: 0, points: [] };
    knockback(pusher, target, { x: 9, z: 10 }, 1);
    expect(target.route).toBeNull();
  });
});

// Immovable's own cases live in vanguard-upgrades.test.ts; here only the shared parts.
describe('knockback and statuses', () => {
  it('a Shield Wall without Immovable does not stop a knockback', () => {
    const { sim, pusher } = setup();
    const target = foe(sim, 10, 10);
    target.addStatus(SHIELD_WALL, pusher);
    expect(knockback(pusher, target, { x: 9, z: 10 }, 1)).toBeCloseTo(1);
    expect(target.addStatus(STUN, pusher)).not.toBeNull();
    expect(DREAD.flees).toBe(true);
    expect(FRIGHTENED.flees).toBe(true);
  });
});
