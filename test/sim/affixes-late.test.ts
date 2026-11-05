import { describe, expect, it } from 'vitest';
import { affixesOf, giveAffixes } from '../../src/content/affixes';
import { MINI_BOSSES } from '../../src/content/minibosses';
import { spawnMerc, spawnMonster } from '../../src/content/roster';
import Alarms from '../../src/game/alarms';
import { think } from '../../src/sim/ai';
import Sim from '../../src/sim/sim';
import { DamageKind } from '../../src/sim/types';
import { updateWarnings } from '../../src/sim/warning';

const DT = 0.05;

function arena(): Sim {
  const sim = new Sim(1);
  sim.setWorld([{ x0: 0, z0: 0, x1: 40, z1: 40 }]);
  return sim;
}

describe('Storm Enchanted', () => {
  it('throws a spark at the nearest merc within 4 tiles when hit, once every 0.5 s', () => {
    const sim = arena();
    const elite = spawnMonster(sim, 'husk', 8, 10, 10, { elite: true });
    const near = spawnMerc(sim, 'ranger', 8, 12, 10);
    const far = spawnMerc(sim, 'ranger', 8, 12, 13);
    const out = spawnMerc(sim, 'ranger', 8, 20, 10);
    affixesOf(sim).give(elite, 'stormEnchanted');
    const hp = [near.hp, far.hp, out.hp];
    near.hit(elite, { kind: DamageKind.True, fixed: 1, flags: 0 });
    expect(near.hp).toBeLessThan(hp[0]);
    expect(far.hp).toBe(hp[1]);
    expect(out.hp).toBe(hp[2]);
    // A second hit within the half second throws nothing.
    const once = near.hp;
    near.hit(elite, { kind: DamageKind.True, fixed: 1, flags: 0 });
    expect(near.hp).toBe(once);
    sim.time += 0.6;
    near.hit(elite, { kind: DamageKind.True, fixed: 1, flags: 0 });
    expect(near.hp).toBeLessThan(once);
  });

  it('throws nothing when no merc stands in reach', () => {
    const sim = arena();
    const elite = spawnMonster(sim, 'husk', 8, 10, 10, { elite: true });
    const merc = spawnMerc(sim, 'ranger', 8, 20, 10);
    affixesOf(sim).give(elite, 'stormEnchanted');
    const hp = merc.hp;
    merc.hit(elite, { kind: DamageKind.True, fixed: 1, flags: 0 });
    expect(merc.hp).toBe(hp);
  });
});

describe('Mana Burn', () => {
  it('drains a share of the damage it deals from the target’s mana', () => {
    const sim = arena();
    const elite = spawnMonster(sim, 'husk', 8, 10, 10, { elite: true });
    const merc = spawnMerc(sim, 'arcanist', 8, 11, 10);
    affixesOf(sim).give(elite, 'manaBurn');
    merc.mana = 50;
    const before = merc.hp;
    elite.hit(merc, { kind: DamageKind.True, fixed: 20, flags: 0 });
    expect(before - merc.hp).toBeGreaterThan(0);
    expect(merc.mana).toBeLessThan(50);
    expect(merc.mana).toBeGreaterThanOrEqual(0);
  });

  it('is shared with the pack, and Teleport is not', () => {
    const sim = arena();
    const elite = spawnMonster(sim, 'husk', 8, 10, 10, { elite: true });
    const mate = spawnMonster(sim, 'husk', 8, 11, 10);
    giveAffixes(sim, elite, [mate], ['manaBurn', 'teleport']);
    expect(affixesOf(sim).of(mate)).toEqual(['manaBurn']);
    expect(affixesOf(sim).of(elite)).toEqual(['manaBurn', 'teleport']);
  });
});

describe('Teleport', () => {
  it('shows its landing beside the bearer, then blinks there every few seconds while aware', () => {
    const sim = arena();
    const bearer = spawnMerc(sim, 'vanguard', 8, 30, 30);
    sim.bearer = bearer;
    const elite = spawnMonster(sim, 'husk', 8, 5, 5, { elite: true });
    affixesOf(sim).give(elite, 'teleport');
    for (let t = 0; t < 10; t += DT) {
      affixesOf(sim).update(DT);
    }
    expect(sim.warnings).toHaveLength(0);
    elite.aware = true;
    for (let t = 0; t < 6.1; t += DT) {
      affixesOf(sim).update(DT);
    }
    expect(sim.warnings).toHaveLength(1);
    expect(elite.distanceTo(bearer)).toBeGreaterThan(20);
    for (let t = 0; t < 1; t += DT) {
      updateWarnings(sim, DT);
    }
    expect(elite.distanceTo(bearer)).toBeLessThan(3);
  });

  it('stays put when already near the bearer', () => {
    const sim = arena();
    const bearer = spawnMerc(sim, 'vanguard', 8, 10, 10);
    sim.bearer = bearer;
    const elite = spawnMonster(sim, 'husk', 8, 11, 10, { elite: true });
    elite.aware = true;
    affixesOf(sim).give(elite, 'teleport');
    for (let t = 0; t < 8; t += DT) {
      affixesOf(sim).update(DT);
    }
    expect(sim.warnings).toHaveLength(0);
  });
});

describe('Herald', () => {
  it('runs for the nearest standing horn post once awake and blows it, once', () => {
    const sim = arena();
    const near = spawnMonster(sim, 'hornPost', 5, 20, 10);
    near.still = true;
    near.aware = true;
    const herald = spawnMonster(sim, 'penitent', 8, 10, 10, { elite: true });
    affixesOf(sim).give(herald, 'herald');
    const alarms = new Alarms();
    alarms.update(sim, DT, 5, ['husk'], null);
    expect(herald.alarm).toBeNull();
    herald.aware = true;
    alarms.update(sim, DT, 5, ['husk'], null);
    expect(herald.alarm).toEqual({ x: near.x, z: near.z });
    // It does not wake the next pack while it runs.
    const sleeper = spawnMonster(sim, 'husk', 8, 25, 25);
    let blown = 0;
    for (let t = 0; t < 12 && blown === 0; t += DT) {
      think(sim, herald, DT);
      affixesOf(sim).update(DT);
      blown += alarms.update(sim, DT, 5, ['husk'], null);
    }
    expect(blown).toBe(1);
    expect(sleeper.aware).toBe(false);
    for (let t = 0; t < 20; t += DT) {
      expect(alarms.update(sim, DT, 5, ['husk'], null)).toBe(0);
    }
  });

  it('keeps waking the next pack when no post stands', () => {
    const sim = arena();
    const herald = spawnMonster(sim, 'penitent', 8, 10, 10, { elite: true });
    herald.aware = true;
    affixesOf(sim).give(herald, 'herald');
    const next = spawnMonster(sim, 'husk', 8, 25, 25);
    const alarms = new Alarms();
    for (let t = 0; t < 10.2; t += DT) {
      alarms.update(sim, DT, 5, ['husk'], null);
      affixesOf(sim).update(DT);
    }
    expect(herald.alarm).toBeNull();
    expect(next.aware).toBe(true);
  });
});

describe('the Horn of the Road', () => {
  it('has Herald and Teleport, not Swift', () => {
    expect(MINI_BOSSES.hornOfTheRoad.affixes).toEqual(['herald', 'teleport']);
  });
});
