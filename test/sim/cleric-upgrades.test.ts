import { describe, expect, it } from 'vitest';
import { SACRED_GROUND, WARD } from '../../src/content/cleric';
import { JOBS } from '../../src/content/jobs';
import CLERIC_UPGRADES, { PURGED } from '../../src/content/jobs/cleric/upgrades';
import { beginDuel } from '../../src/content/jobs/duelist/spells';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { type Upgrade, isBuilt } from '../../src/sim/builds';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import type { Skill } from '../../src/sim/skill';
import { POISON, RENEWED, SEAR, STUN } from '../../src/sim/statuses';
import { DamageKind, Element, Range, Side, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';
import { setZone } from '../../src/sim/zone';
import { setRank, withUpgrade } from '../support/build';

// The Cleric's spells, innate and 12 elite upgrades.

const upgrade = (id: string): Upgrade => {
  const found = CLERIC_UPGRADES.find((u) => u.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
};

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

// The spell as the unit casts it, upgrade applied
const spell = (u: Unit, id: string): Skill => {
  const found = u.skills.find((s) => s.id === id);
  if (!found) {
    throw new Error(id);
  }
  return found;
};

// A blow from one unit on another, as a basic attack lands
const blow = (from: Unit, to: Unit, range = Range.Melee): number =>
  from.hit(to, { kind: DamageKind.Physical, range, fixed: 50 })?.value ?? -1;

// A still Cleric at rank 5 in every spell, with an upgrade when one is named
function clericWith(id: string | null, seed = 1): { sim: Sim; cleric: Unit; bearer: Unit } {
  const sim = new Sim(seed);
  alwaysHit(sim);
  const bearer = spawnBearer(sim, 0, 0);
  still(bearer);
  const cleric = spawnMerc(sim, 'cleric', 10, 1, 1);
  still(cleric);
  cleric.mana = cleric.derived.maxMana;
  for (const s of cleric.spells) {
    setRank(cleric, s.id, 5);
  }
  if (id) {
    withUpgrade(cleric, upgrade(id));
  }
  return { sim, cleric, bearer };
}

describe('the Cleric upgrades', () => {
  it('has 12, all built, 3 for each spell', () => {
    const { upgrades, spells } = JOBS.cleric;
    expect(upgrades).toBe(CLERIC_UPGRADES);
    expect(upgrades).toHaveLength(12);
    for (const u of upgrades) {
      expect(isBuilt(u), u.id).toBe(true);
      expect(u.describe(5), u.id).not.toBe('');
    }
    for (const s of spells) {
      expect(upgrades.filter((u) => u.spell === s.id)).toHaveLength(3);
    }
  });
});

describe('the Cleric', () => {
  it('Ward absorbs magic on whoever an enemy is after', () => {
    const { sim, cleric, bearer } = clericWith(null);
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
});

describe('Ward upgrades', () => {
  it('Cleanse lifts harmful statuses and buildup with the Ward', () => {
    const { sim, cleric } = clericWith('cleanse');
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 0);
    const crawler = spawnMonster(sim, 'crawler', 4, 20, 0);
    vanguard.addStatus(POISON, crawler);
    vanguard.buildUp(STUN, crawler, 60);
    spell(cleric, 'ward').release(cleric, vanguard, sim);
    expect(vanguard.statuses.has(POISON.id)).toBe(false);
    expect(vanguard.buildup.size).toBe(0);
    expect(vanguard.ward).toBeGreaterThan(0);
  });

  it('Wall of Faith stops a few melee blows, then breaks', () => {
    const { sim, cleric, bearer } = clericWith('wallOfFaith');
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 1, 0);
    soldier.aware = true;
    soldier.target = bearer;
    spell(cleric, 'ward').release(cleric, bearer, sim);
    expect(bearer.ward).toBeGreaterThan(0);
    // Rank 5: 2 + 5 / 2, rounded down, is 4 blows
    const stopped = [1, 2, 3, 4].map(() => blow(soldier, bearer));
    expect(stopped).toEqual([0, 0, 0, 0]);
    sim.tick();
    expect(sim.zones).toHaveLength(0);
    expect(blow(soldier, bearer)).toBeGreaterThan(0);
  });

  it('Twin Ward shields the two allies in most danger, 60% of the pool each', () => {
    const { sim, cleric, bearer } = clericWith('twinWard');
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 1);
    const ranger = spawnMerc(sim, 'ranger', 10, 1, 0);
    const a = spawnMonster(sim, 'hollowSoldier', 5, 4, 0);
    const b = spawnMonster(sim, 'hollowSoldier', 5, 4, 1);
    a.aware = true;
    a.target = bearer;
    b.aware = true;
    b.target = vanguard;
    const twin = spell(cleric, 'ward');
    const first = twin.aim?.(cleric, sim) ?? null;
    expect(first).toBe(bearer);
    twin.release(cleric, first, sim);
    const pool = 30 + 5 * 8 + cleric.derived.matkMax;
    expect(bearer.ward).toBe(Math.round(pool * 0.6));
    expect(vanguard.ward).toBe(Math.round(pool * 0.6));
    expect(ranger.ward).toBe(0);
  });
});

describe('Heal upgrades', () => {
  it('Renew heals over time for 6 seconds', () => {
    const { sim, cleric, bearer } = clericWith('renew');
    const renew = spell(cleric, 'heal');
    expect(renew.cost).toBe(12);
    expect(renew.cooldown).toBe(5);
    bearer.hp = 50;
    expect(renew.aim?.(cleric, sim)).toBe(bearer);
    renew.release(cleric, bearer, sim);
    expect(bearer.statuses.has(RENEWED.id)).toBe(true);
    sim.run(3.05);
    // Rank 5: 8 + 3 * 5 a second
    expect(bearer.hp).toBe(50 + 3 * 23);
  });

  it('Resurrection raises a fallen merc, but not one torn apart', () => {
    const { sim, cleric } = clericWith('resurrection');
    const vanguard = spawnMerc(sim, 'vanguard', 10, 2, 1);
    const ranger = spawnMerc(sim, 'ranger', 10, 0, 2);
    const crawler = spawnMonster(sim, 'crawler', 4, 20, 0);
    vanguard.hp = 1;
    crawler.hit(vanguard, { kind: DamageKind.True, fixed: 5 });
    crawler.hit(ranger, { kind: DamageKind.True, fixed: 10000 });
    expect(vanguard.torn).toBe(false);
    expect(ranger.torn).toBe(true);
    const raise = spell(cleric, 'heal');
    expect(raise.cost).toBe(30);
    expect(raise.cooldown).toBe(20);
    expect(raise.aim?.(cleric, sim)).toBe(vanguard);
    raise.release(cleric, vanguard, sim);
    expect(vanguard.alive).toBe(true);
    // Rank 5: 10 + 5 * 5 percent
    expect(vanguard.hp).toBe(Math.floor(vanguard.derived.maxHp * 0.35));
    expect(ranger.revive(0.5)).toBe(false);
  });

  it('Resurrection is cast through the real cast path and takes its windup', () => {
    const { sim, cleric } = clericWith('resurrection');
    const vanguard = spawnMerc(sim, 'vanguard', 10, 2, 1);
    const crawler = spawnMonster(sim, 'crawler', 4, 20, 0);
    vanguard.hp = 1;
    crawler.hit(vanguard, { kind: DamageKind.True, fixed: 5 });
    expect(vanguard.alive).toBe(false);
    const raise = spell(cleric, 'heal');
    expect(cleric.startCast(raise, vanguard)).toBe(true);
    sim.run(2.5);
    expect(vanguard.alive).toBe(false);
    sim.run(1);
    expect(vanguard.alive).toBe(true);
  });

  it('Resurrection still heals the living', () => {
    const { sim, cleric, bearer } = clericWith('resurrection');
    bearer.hp = 20;
    const heal = spell(cleric, 'heal');
    expect(heal.aim?.(cleric, sim)).toBe(bearer);
    heal.release(cleric, bearer, sim);
    expect(bearer.hp).toBeGreaterThan(20);
  });

  it('Martyr raises the fallen around it as it dies', () => {
    const { sim, cleric } = clericWith('martyr');
    const fallen = spawnMerc(sim, 'vanguard', 10, 2, 1);
    const mite = spawnMonster(sim, 'mite', 1, 9, 9);
    // Worn down first, so the killing blow is too light to tear it apart
    fallen.hp = 5;
    mite.hit(fallen, { kind: DamageKind.True, fixed: 5 });
    expect(fallen.alive).toBe(false);
    mite.hit(cleric, { kind: DamageKind.True, fixed: cleric.hp });
    expect(fallen.alive).toBe(true);
    expect(fallen.hp).toBe(Math.floor(fallen.derived.maxHp * 0.2));
  });
});

describe('Sacred Ground upgrades', () => {
  it('Veil stops arrows on those inside it, but not blows, and does not heal', () => {
    const { sim, cleric, bearer } = clericWith('veil');
    const soldier = spawnMonster(sim, 'hollowSoldier', 5, 5, 0);
    const veil = spell(cleric, 'sacredGround');
    expect(veil.cooldown).toBe(15);
    bearer.hp = bearer.derived.maxHp / 2;
    veil.release(cleric, bearer, sim);
    expect(sim.zones[0].guards).toBe('ranged');
    expect(sim.zones[0].pulse).toBeUndefined();
    expect(blow(soldier, bearer, Range.Ranged)).toBe(0);
    expect(blow(soldier, bearer, Range.Melee)).toBeGreaterThan(0);
  });

  it('Consecrate burns every enemy on the ground each second', () => {
    const { sim, cleric, bearer } = clericWith('consecrate');
    const a = spawnMonster(sim, 'hollowSoldier', 5, 2, 0);
    const b = spawnMonster(sim, 'hollowSoldier', 5, 2, 1.5);
    still(a, b);
    a.aware = true;
    b.aware = true;
    const ground = spell(cleric, 'sacredGround');
    expect(ground.aim?.(cleric, sim)).not.toBeNull();
    ground.release(cleric, bearer, sim);
    sim.run(2.05);
    expect(a.hp).toBeLessThan(a.derived.maxHp);
    expect(b.hp).toBeLessThan(b.derived.maxHp);
  });

  it('Pilgrim’s Rest restores mana and morale to allies on the ground', () => {
    const { sim, cleric, bearer } = clericWith('pilgrimsRest');
    const vanguard = spawnMerc(sim, 'vanguard', 10, 0, 1);
    vanguard.mana = 0;
    vanguard.morale = 50;
    spell(cleric, 'sacredGround').release(cleric, bearer, sim);
    sim.run(2.05);
    expect(vanguard.mana).toBeGreaterThanOrEqual(4);
    expect(vanguard.morale).toBeGreaterThanOrEqual(51);
  });
});

describe('Smite upgrades', () => {
  it('Turn Undead destroys the dead it is lucky against, and spares the living', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const turned = seeds.filter((seed) => {
      const { sim, cleric } = clericWith('turnUndead', seed);
      const dead = spawnMonster(sim, 'hollowSoldier', 5, 3, 1);
      dead.hp = dead.derived.maxHp * 0.3;
      spell(cleric, 'smite').release(cleric, dead, sim);
      return !dead.alive;
    }).length;
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThan(seeds.length);
    const { sim, cleric } = clericWith('turnUndead');
    const living = spawnMonster(sim, 'penitent', 5, 3, 1);
    spell(cleric, 'smite').release(cleric, living, sim);
    expect(living.alive).toBe(true);
  });

  it('Purge makes an Occult target take more from the party', () => {
    const { sim, cleric } = clericWith('purge');
    const vanguard = spawnMerc(sim, 'vanguard', 10, 2, 1);
    const husk = spawnMonster(sim, 'hollowSoldier', 9, 3, 1);
    husk.element = Element.Occult;
    const before = blow(vanguard, husk);
    husk.hp = husk.derived.maxHp;
    spell(cleric, 'smite').release(cleric, husk, sim);
    expect(husk.statuses.has(PURGED.id)).toBe(true);
    husk.hp = husk.derived.maxHp;
    expect(blow(vanguard, husk)).toBeGreaterThan(before * 1.2);
    // A target that is not Occult is not marked
    const other = spawnMonster(sim, 'hollowSoldier', 5, 3, 2);
    other.element = Element.Neutral;
    spell(cleric, 'smite').release(cleric, other, sim);
    expect(other.statuses.has(PURGED.id)).toBe(false);
  });

  it('Holy Light doubles Sear buildup and spreads half of it to enemies nearby', () => {
    const buildup = (w: {
      sim: Sim;
      cleric: Unit;
    }): { main: number; near: number; far: number } => {
      const main = spawnMonster(w.sim, 'hollowSoldier', 5, 3, 0);
      const near = spawnMonster(w.sim, 'hollowSoldier', 5, 4.5, 0);
      const far = spawnMonster(w.sim, 'hollowSoldier', 5, 8, 0);
      main.buildUp(SEAR, w.cleric, 30);
      return {
        main: main.buildup.get(SEAR.id) ?? 0,
        near: near.buildup.get(SEAR.id) ?? 0,
        far: far.buildup.get(SEAR.id) ?? 0,
      };
    };
    const base = buildup(clericWith(null));
    const light = buildup(clericWith('holyLight'));
    expect(light.main).toBeCloseTo(base.main * 2);
    expect(base.near).toBe(0);
    expect(light.near).toBeCloseTo(base.main);
    expect(light.far).toBe(0);
  });

  it('Sear holds only on the dead and the Occult, and seared targets take more', () => {
    const { sim, cleric } = clericWith('holyLight');
    const living = spawnMonster(sim, 'penitent', 5, 3, 2);
    living.buildUp(SEAR, cleric, 500);
    expect(living.statuses.has(SEAR.id)).toBe(false);
    const dead = spawnMonster(sim, 'hollowSoldier', 5, 3, 0);
    const before = blow(cleric, dead);
    dead.hp = dead.derived.maxHp;
    dead.buildUp(SEAR, cleric, 1000);
    expect(dead.statuses.has(SEAR.id)).toBe(true);
    expect(blow(cleric, dead)).toBeGreaterThan(before);
  });
});

describe('Duel', () => {
  it('the Cleric’s effects skip an elite a Duelist is dueling', () => {
    const { sim, cleric, bearer } = clericWith('consecrate');
    const duelist = spawnMerc(sim, 'duelist', 10, 2, 2);
    // The Duelist stands by and does nothing
    duelist.skills.length = 0;
    duelist.kit.interval = 0;
    still(duelist);
    const boss = spawnMonster(sim, 'hollowSoldier', 5, 1.5, 0, { elite: true });
    const other = spawnMonster(sim, 'hollowSoldier', 5, 1.5, 1);
    boss.aware = true;
    boss.target = bearer;
    still(boss, other);
    // Before the Duel, Ward reads the elite as a threat to the bearer
    expect(WARD.aim?.(cleric, sim)).toBe(bearer);
    expect(beginDuel(duelist, boss, 20)).toBe(true);
    // The dueled elite is no threat the Cleric may answer
    expect(WARD.aim?.(cleric, sim)).toBeNull();
    // Its ground does not burn the dueled elite
    // Both stand on the ground; only the ground does damage
    const ground = spell(cleric, 'sacredGround');
    cleric.skills.length = 0;
    for (const u of sim.units) {
      u.kit.interval = 0;
    }
    ground.release(cleric, bearer, sim);
    sim.run(2.05);
    expect(boss.hp).toBe(boss.derived.maxHp);
    expect(other.hp).toBeLessThan(other.derived.maxHp);
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
