import { describe, expect, it } from 'vitest';
import WARDEN, {
  COVER,
  COVERING,
  EXECUTE,
  INTERPOSE,
  MARKED,
  PURSUE,
  TRIPWIRE,
  isMarked,
} from '../../src/content/jobs/warden';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { SimEvents, type UnitDamageEvent } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { STUN } from '../../src/sim/statuses';
import { DamageKind, Range, Rank, Side, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import spendAll from '../support/build';

// The Warden's four spells and its innate, Interpose.

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

// A blow of a set size from `from` on `to`
const blow = (from: Unit, to: Unit, fixed = 50, range = Range.Melee): UnitDamageEvent | null =>
  from.hit(to, { kind: DamageKind.True, range, fixed });

describe('the Warden job', () => {
  it('has its four spells in cast order and Interpose as the innate', () => {
    expect(WARDEN.spells.map((s) => s.id)).toEqual(['cover', 'execute', 'tripwire', 'pursue']);
    expect(WARDEN.innate.name).toBe('Interpose');
    expect(WARDEN.hireable).toBe(true);
  });

  it('plays out a fight beside the bearer and wins it', () => {
    for (const seed of [1, 2, 3]) {
      const sim = new Sim(seed);
      const bearer = spawnBearer(sim, 0, 0);
      const warden = spawnMerc(sim, 'warden', 5, 0.8, 0.5);
      spawnMerc(sim, 'ranger', 5, -0.6, -0.6);
      spawnMonster(sim, 'hollowSoldier', 4, 9, 0.5);
      spawnMonster(sim, 'penitent', 4, 9.5, -0.5);
      bearer.order = { x: 10, z: 0 };
      sim.run(90, () => sim.living(Side.Monster).length === 0 || !bearer.alive);
      expect(bearer.alive).toBe(true);
      expect(warden.alive).toBe(true);
      expect(sim.living(Side.Monster)).toHaveLength(0);
    }
  });
});

describe('Interpose', () => {
  it('takes 80% of a hit aimed at the bearer from within 3 tiles, and marks the attacker', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 1, 0);
    const foe = spawnMonster(sim, 'hollowSoldier', 5, 3, 0);
    expect(warden.passives.has(INTERPOSE.id)).toBe(true);
    const hp = warden.hp;
    const bearerHp = bearer.hp;
    blow(foe, bearer, 100);
    expect(bearerHp - bearer.hp).toBe(20);
    expect(hp - warden.hp).toBe(80);
    expect(isMarked(foe)).toBe(true);
    expect(foe.statuses.get(MARKED.id)?.remaining).toBeCloseTo(6, 0);
  });

  it('takes nothing from farther away, but the attacker is still marked', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 5, 0);
    const foe = spawnMonster(sim, 'hollowSoldier', 5, 3, 0);
    const hp = warden.hp;
    blow(foe, bearer, 100);
    expect(warden.hp).toBe(hp);
    expect(isMarked(foe)).toBe(true);
  });

  it('does not take a hit twice', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    spawnMerc(sim, 'warden', 10, 1, 0);
    const other = spawnMerc(sim, 'warden', 10, -1, 0);
    const foe = spawnMonster(sim, 'hollowSoldier', 5, 3, 0);
    const before = other.hp;
    blow(foe, bearer, 100);
    // The second Warden sees only the redirected hit, which it leaves alone.
    expect(before - other.hp).toBeLessThan(70);
  });
});

describe('Cover', () => {
  it('pulls the bearer behind the Warden and stops arrows from the front', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 2, 0);
    const archer = spawnMonster(sim, 'hollowArcher', 5, 8, 0);
    still(bearer, warden, archer);
    archer.aware = true;
    archer.target = bearer;
    expect(COVER.wants(warden, null, sim)).toBe(true);
    COVER.release(warden, null, sim);
    // The bearer now stands behind the Warden, away from the archer.
    expect(bearer.x).toBeCloseTo(1.1, 1);
    expect(warden.statuses.has('covering')).toBe(true);
    const hp = bearer.hp;
    sim.fire(archer, bearer, {
      speed: 12,
      distance: 20,
      radius: 0.5,
      options: { fixed: 50, kind: DamageKind.True },
    });
    sim.run(2);
    expect(bearer.hp).toBe(hp);
  });

  it('lets arrows through once it ends, and from behind', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 2, 0);
    const archer = spawnMonster(sim, 'hollowSoldier', 5, -8, 0);
    still(bearer, warden, archer);
    warden.addStatus(COVERING, warden, 3);
    const hp = bearer.hp;
    // The archer is on the far side of the bearer from the Warden.
    sim.fire(archer, bearer, {
      speed: 12,
      distance: 20,
      radius: 0.5,
      options: { fixed: 50, kind: DamageKind.True },
    });
    sim.run(2);
    expect(bearer.hp).toBeLessThan(hp);
  });

  it('wants to be cast only against a shooter at the bearer', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 1, 0);
    const foe = spawnMonster(sim, 'hollowSoldier', 5, 6, 0);
    foe.aware = true;
    foe.target = bearer;
    expect(COVER.wants(warden, null, sim)).toBe(false);
    const archer = spawnMonster(sim, 'hollowArcher', 5, 8, 0);
    archer.aware = true;
    archer.target = bearer;
    expect(COVER.wants(warden, null, sim)).toBe(true);
  });
});

describe('Execute', () => {
  const setup = (): { sim: Sim; warden: Unit; foe: Unit } => {
    const sim = new Sim(1);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 5, 0);
    const foe = spawnMonster(sim, 'hollowSoldier', 5, 5.9, 0);
    still(warden, foe);
    return { sim, warden, foe };
  };

  it('only wants a marked enemy in reach', () => {
    const { sim, warden, foe } = setup();
    expect(EXECUTE.wants(warden, foe, sim)).toBe(false);
    foe.addStatus(MARKED, warden);
    expect(EXECUTE.wants(warden, foe, sim)).toBe(true);
  });

  it('kills a marked enemy below 20% health, even a sturdy one', () => {
    const { sim, warden, foe } = setup();
    foe.derived.maxHp = 1000;
    foe.addStatus(MARKED, warden);
    foe.hp = 150;
    expect(warden.startCast(EXECUTE, foe)).toBe(true);
    sim.run(EXECUTE.windup + 0.05);
    expect(foe.alive).toBe(false);
  });

  it('leaves an unmarked enemy alive below 20%', () => {
    const { sim, warden, foe } = setup();
    foe.derived.maxHp = 1000;
    foe.hp = 150;
    EXECUTE.release(warden, foe, sim);
    expect(foe.alive).toBe(true);
  });

  it('leaves a marked enemy above 20% alive', () => {
    const { sim, warden, foe } = setup();
    foe.derived.maxHp = 1000;
    foe.hp = 900;
    foe.addStatus(MARKED, warden);
    EXECUTE.release(warden, foe, sim);
    expect(foe.alive).toBe(true);
  });

  it('cannot finish a boss or a mini-boss', () => {
    for (const kind of ['boss', 'named'] as const) {
      const { sim, warden, foe } = setup();
      if (kind === 'boss') {
        foe.rank = Rank.Boss;
      } else {
        foe.named = true;
      }
      foe.derived.maxHp = 1000;
      foe.hp = 150;
      foe.addStatus(MARKED, warden);
      EXECUTE.release(warden, foe, sim);
      expect(foe.alive).toBe(true);
    }
  });
});

describe('Tripwire', () => {
  it('sets a trap toward a coming enemy, and its victim is marked and slowed', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    const bearer = spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 1, 0);
    const foe = spawnMonster(sim, 'hollowSoldier', 5, 8, 0);
    still(bearer, warden);
    foe.aware = true;
    expect(TRIPWIRE.wants(warden, null, sim)).toBe(true);
    expect(warden.startCast(TRIPWIRE, null)).toBe(true);
    sim.run(TRIPWIRE.windup + 0.05);
    expect(sim.traps).toHaveLength(1);
    expect(TRIPWIRE.wants(warden, null, sim)).toBe(false);
    // The enemy walks onto the wire.
    foe.x = sim.traps[0].x;
    foe.z = sim.traps[0].z;
    const speed = foe.speed;
    sim.run(0.1);
    expect(sim.traps).toHaveLength(0);
    expect(isMarked(foe)).toBe(true);
    expect(foe.statuses.has('tripped')).toBe(true);
    // 30% + 2% a rank, at rank 1.
    expect(foe.speed).toBeLessThan(speed * 0.75);
  });

  it('is not set once an enemy is already close', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 1, 0);
    const foe = spawnMonster(sim, 'hollowSoldier', 5, 2, 0);
    foe.aware = true;
    expect(TRIPWIRE.wants(warden, null, sim)).toBe(false);
  });
});

describe('Pursue', () => {
  it('only wants a marked enemy', () => {
    const sim = new Sim(1);
    spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 1, 0);
    const foe = spawnMonster(sim, 'hollowSoldier', 5, 5, 0);
    expect(PURSUE.wants(warden, foe, sim)).toBe(false);
    foe.addStatus(MARKED, warden);
    expect(PURSUE.wants(warden, foe, sim)).toBe(true);
  });

  it('leaps to the marked enemy, hits it and builds stun', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 1, 0);
    const foe = spawnMonster(sim, 'hollowSoldier', 5, 5, 0);
    still(warden, foe);
    foe.addStatus(MARKED, warden);
    const hp = foe.hp;
    expect(warden.startCast(PURSUE, foe)).toBe(true);
    sim.run(PURSUE.windup + 0.05);
    expect(warden.distanceTo(foe)).toBeLessThan(1.2);
    expect(foe.hp).toBeLessThan(hp);
    expect(foe.buildup.get(STUN.id) ?? 0).toBeGreaterThan(0);
  });

  it('picks the nearest marked enemy when its target is not marked', () => {
    const sim = new Sim(1);
    alwaysHit(sim);
    spawnBearer(sim, 0, 0);
    const warden = spawnMerc(sim, 'warden', 10, 1, 0);
    const plain = spawnMonster(sim, 'hollowSoldier', 5, 2, 0);
    const marked = spawnMonster(sim, 'hollowSoldier', 5, 5, 3);
    still(warden, plain, marked);
    marked.addStatus(MARKED, warden);
    PURSUE.release(warden, plain, sim);
    expect(warden.distanceTo(marked)).toBeLessThan(1.2);
  });
});

describe('the Warden at higher ranks', () => {
  it('describes its spells by rank', () => {
    const sim = new Sim(1);
    const warden = spawnMerc(sim, 'warden', 20, 0, 0);
    warden.shards = 30;
    spendAll(warden);
    expect(warden.skillRank('execute')).toBeGreaterThan(1);
    expect(EXECUTE.describe(10)).toContain('240%');
    expect(TRIPWIRE.describe(10)).toContain('50%');
  });
});
