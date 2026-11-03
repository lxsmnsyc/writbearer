import { describe, expect, it } from 'vitest';
import {
  CONSECRATION,
  HOLY_LIGHT,
  MARTYR,
  PURGE,
  SACRED_GROUND,
  TURN_UNDEAD,
  VEIL,
  WALL_OF_FAITH,
  WARD,
} from '../../src/content/cleric';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { SEAR } from '../../src/sim/statuses';
import { DamageKind, Range, Side, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { setZone } from '../../src/sim/zone';
import { setRank, teach } from '../support/build';

// The Cleric's spells and innate, and the skill code its elite upgrades
// will use. Cases of skills that are now upgrade placeholders are skipped
// until cleric-upgrades builds them (src/content/jobs/cleric/upgrades.ts).

// Every blow lands, so the tests do not hang on the roll.
const alwaysHit = (sim: Sim): void => {
  sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
    event.hit = true;
  });
};

const still = (...units: Unit[]): void => {
  for (const u of units) {
    u.kit.moveSpeed = 0;
  }
};

// A blow from one unit on another, as a basic attack lands
const blow = (from: Unit, to: Unit, range = Range.Melee): number =>
  from.hit(to, { kind: DamageKind.Physical, range, fixed: 50 })?.value ?? -1;

describe('the Cleric', () => {
  it.skip('Martyr raises the fallen around it as it dies', () => {
    const sim = new Sim(1);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    const fallen = spawnMerc(sim, 'vanguard', 10, 2, 0);
    const mite = spawnMonster(sim, 'mite', 1, 9, 9);
    teach(cleric, MARTYR);
    // Worn down first, so the killing blow is too light to tear it apart
    fallen.hp = 5;
    mite.hit(fallen, { kind: DamageKind.True, fixed: 5 });
    expect(fallen.alive).toBe(false);
    mite.hit(cleric, { kind: DamageKind.True, fixed: cleric.hp });
    expect(fallen.alive).toBe(true);
    expect(fallen.hp).toBe(Math.floor(fallen.derived.maxHp * 0.2));
  });

  it('Ward absorbs magic on whoever an enemy is after', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const cleric = spawnMerc(sim, 'cleric', 10, 1, 0);
    const cantor = spawnMonster(sim, 'cantor', 5, 3, 0);
    cantor.aware = true;
    cantor.target = bearer;
    setRank(cleric, 'ward', 2);
    expect(WARD.aim?.(cleric, sim)).toBe(bearer);
    WARD.release(cleric, bearer, sim);
    expect(bearer.ward).toBeGreaterThan(0);
    const hp = bearer.hp;
    cantor.hit(bearer, { kind: DamageKind.Magical, fixed: 10 });
    expect(bearer.hp).toBe(hp);
  });

  it('Sacred Ground heals the hurt standing on it', () => {
    const sim = new Sim(1);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    const a = spawnMerc(sim, 'vanguard', 10, 1, 0);
    const b = spawnMerc(sim, 'ranger', 10, 1, 1);
    for (const m of [a, b]) {
      m.hp = m.derived.maxHp / 2;
    }
    const at = SACRED_GROUND.aim?.(cleric, sim) ?? null;
    expect(at).not.toBeNull();
    SACRED_GROUND.release(cleric, at, sim);
    sim.run(1.05);
    expect(a.hp).toBeGreaterThan(a.derived.maxHp / 2);
    expect(b.hp).toBeGreaterThan(b.derived.maxHp / 2);
  });

  it.skip('Wall of Faith stops a few melee blows, then breaks', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const cleric = spawnMerc(sim, 'cleric', 10, 1, 1);
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 1, 0);
    soldier.aware = true;
    soldier.target = bearer;
    teach(cleric, WALL_OF_FAITH, 1);
    expect(WALL_OF_FAITH.aim?.(cleric, sim)).toBe(bearer);
    WALL_OF_FAITH.release(cleric, bearer, sim);
    expect([blow(soldier, bearer), blow(soldier, bearer), blow(soldier, bearer)]).toEqual([
      0, 0, 0,
    ]);
    sim.tick();
    expect(sim.zones).toHaveLength(0);
    expect(blow(soldier, bearer)).toBeGreaterThan(0);
  });

  it.skip('Veil stops arrows on those inside it, but not blows', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const cleric = spawnMerc(sim, 'cleric', 10, 1, 1);
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 1, 0);
    VEIL.release(cleric, bearer, sim);
    expect(blow(soldier, bearer, Range.Ranged)).toBe(0);
    expect(blow(soldier, bearer, Range.Melee)).toBeGreaterThan(0);
  });

  it('Aegis fills the bearer’s Ward once the fight is over', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const cleric = spawnMerc(sim, 'cleric', 10, 1, 1);
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 3, 0);
    soldier.aware = true;
    still(soldier);
    sim.run(4);
    // Mercs fight it: wait for it to fall, then for the quiet.
    sim.units.delete(soldier);
    sim.run(4);
    expect(bearer.ward).toBe(80 + cleric.level * 4);
  });

  it.skip('Sear holds only on the dead and the Occult, and Holy Light builds it faster', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    const dead = spawnMonster(sim, 'hollowSoldier', 5, 3, 0);
    const living = spawnMonster(sim, 'penitent', 5, 3, 2);
    living.buildUp(SEAR, cleric, 500);
    expect(living.statuses.has(SEAR.id)).toBe(false);
    dead.buildUp(SEAR, cleric, 30);
    const plain = dead.buildup.get(SEAR.id) ?? 0;
    dead.buildup.clear();
    teach(cleric, HOLY_LIGHT, 4);
    dead.buildUp(SEAR, cleric, 30);
    expect(dead.buildup.get(SEAR.id)).toBeCloseTo(plain * 2);
    dead.buildUp(SEAR, cleric, 1000);
    const before = blow(cleric, living);
    expect(dead.statuses.has(SEAR.id)).toBe(true);
    expect(blow(cleric, dead)).toBeGreaterThan(before);
  });

  it.skip('Turn Undead destroys the dead it is lucky against, and spares the living', () => {
    const turned = [1, 2, 3, 4, 5, 6, 7, 8].filter((seed) => {
      const sim = new Sim(seed);
      const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
      const dead = spawnMonster(sim, 'hollowSoldier', 5, 2, 0);
      teach(cleric, TURN_UNDEAD, 5);
      TURN_UNDEAD.release(cleric, dead, sim);
      return !dead.alive;
    }).length;
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThan(8);
    const sim = new Sim(1);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    expect(TURN_UNDEAD.wants(cleric, spawnMonster(sim, 'penitent', 5, 2, 0), sim)).toBe(false);
  });

  it.skip('Consecrate burns every enemy on its ground each second', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 4, 0);
    const b = spawnMonster(sim, 'hollowSoldier', 5, 4, 1.5);
    still(a, b);
    teach(cleric, CONSECRATION);
    expect(CONSECRATION.wants(cleric, a, sim)).toBe(true);
    CONSECRATION.release(cleric, a, sim);
    sim.run(2.05);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
    expect(b.hp).toBeLessThan(b.derived.maxHp);
  });

  it.skip('Purge makes Occult enemies take more from the party', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
    const vanguard = spawnMerc(sim, 'vanguard', 10, 1, 0);
    const husk = spawnMonster(sim, 'husk', 5, 2, 0);
    // A husk taken for something Occult
    const before = blow(vanguard, husk);
    husk.hp = husk.derived.maxHp;
    teach(cleric, PURGE);
    expect(blow(vanguard, husk)).toBe(before);
    husk.element = 7;
    const occult = blow(vanguard, husk);
    cleric.passives.get('purge')?.stop();
    expect(occult).toBeGreaterThan(blow(vanguard, husk) * 1.2);
  });
});

describe('zones', () => {
  it('fade when their time runs out', () => {
    const sim = new Sim(1);
    const owner = spawnMerc(sim, 'cleric', 10, 0, 0);
    setZone(sim, { kind: 'veil', owner, x: 0, z: 0, r: 1, life: 1, element: 0 });
    sim.run(1.1);
    expect(sim.zones).toHaveLength(0);
    expect(Side.Party).toBe(owner.side);
  });
});
