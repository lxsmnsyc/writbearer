import { describe, expect, it } from 'vitest';
import { wageFor, wageOf } from '../../src/content/recruits';
import { spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import { UNIQUES, UNIQUE_BY_ID } from '../../src/content/uniques';
import RNG from '../../src/core/rng';
import { itemLines, itemName, makeUnique, rollUnique, socketLimit } from '../../src/gen/loot';
import { EquipSlot, Quality, slotFor } from '../../src/sim/item';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { DREAD, ROOTED } from '../../src/sim/statuses';
import { DamageFlags, DamageKind, Rank, ValuePriority } from '../../src/sim/types';
import type Unit from '../../src/sim/unit';

const wear = (unit: Unit, id: string): ReturnType<typeof makeUnique> => {
  const item = makeUnique(new RNG(1), UNIQUE_BY_ID.get(id)!);
  unit.equip(slotFor(item)!, item);
  return item;
};

describe('uniques', () => {
  it('roll each value in its range, and carry their name and lore', () => {
    const rng = new RNG(3);
    for (const def of UNIQUES) {
      const item = makeUnique(rng, def);
      expect(item.quality).toBe(Quality.Unique);
      expect(itemName(item)).toBe(def.name);
      item.uniqueValues!.forEach((v, i) => {
        expect(v).toBeGreaterThanOrEqual(def.rolls[i].min);
        expect(v).toBeLessThanOrEqual(def.rolls[i].max);
      });
      expect(itemLines(item).at(-1)).toContain(def.lore);
      expect(socketLimit(item)).toBe(def.sockets);
    }
  });

  it('drop rarely, from bosses about a third of the time', () => {
    const rng = new RNG(5);
    let boss = 0;
    let normal = 0;
    for (let i = 0; i < 2000; i++) {
      boss += rollUnique(rng, 20, Rank.Boss) ? 1 : 0;
      normal += rollUnique(rng, 20, Rank.Normal) ? 1 : 0;
    }
    expect(boss / 2000).toBeGreaterThan(0.25);
    expect(boss / 2000).toBeLessThan(0.35);
    expect(normal / 2000).toBeLessThan(0.01);
  });
});

describe('unique effects', () => {
  it('Debtor’s Chain: more attack, and double the wage', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 10, 0, 0);
    const atk = merc.derived.atkMax;
    expect(wageOf(merc)).toBe(wageFor(10));
    wear(merc, 'debtorsChain');
    expect(merc.derived.atkMax).toBeGreaterThan(atk);
    expect(wageOf(merc)).toBe(wageFor(10) * 2);
  });

  it('The Last Contract: its wearer dies in the bearer’s place, once an area', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const merc = spawnMerc(sim, 'vanguard', 10, 1, 0);
    const crawler = spawnMonster(sim, 'crawler', 4, 2, 0);
    wear(merc, 'lastContract');
    crawler.hit(bearer, { kind: DamageKind.True, fixed: 100000 });
    expect(bearer.alive).toBe(true);
    expect(merc.alive).toBe(false);
    expect(merc.torn).toBe(false);
    // Raised, it does not save the bearer again in the same area.
    merc.revive(1);
    bearer.hp = 10;
    crawler.hit(bearer, { kind: DamageKind.True, fixed: 100000 });
    expect(bearer.alive).toBe(false);
  });

  it('Thornhide: melee attackers take part of their blow back', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 10, 0, 0);
    const soldier = spawnMonster(sim, 'hollowSoldier', 4, 1, 0);
    wear(merc, 'thornhide');
    sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
      event.hit = true;
    });
    const hp = soldier.hp;
    soldier.hit(merc, { flags: DamageFlags.BasicAttack });
    expect(soldier.hp).toBeLessThan(hp);
  });

  it('Saint’s Reliquary: its wielder heals for more', () => {
    const healed = (reliquary: boolean): number => {
      const sim = new Sim(1);
      const cleric = spawnMerc(sim, 'cleric', 10, 0, 0);
      const hurt = spawnMerc(sim, 'vanguard', 10, 1, 0);
      if (reliquary) {
        wear(cleric, 'saintsReliquary');
      }
      hurt.hp = 10;
      cleric.heal(hurt, 100);
      return hurt.hp - 10;
    };
    expect(healed(true)).toBeGreaterThan(healed(false));
  });

  it('Mire Treads: cannot be rooted', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 10, 0, 0);
    const crawler = spawnMonster(sim, 'crawler', 4, 5, 0);
    wear(merc, 'mireTreads');
    expect(merc.addStatus(ROOTED, crawler)).toBeNull();
  });

  it('The Hollow Crown: Dread builds up twice as fast', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 40, 0, 0);
    const hollowed = spawnMonster(sim, 'hollowed', 4, 9, 0);
    wear(merc, 'hollowCrown');
    merc.buildUp(DREAD, hollowed, 5);
    expect(merc.buildup.get(DREAD.id)).toBe(10);
  });

  it('Penitent’s Lash: each blow it lands costs its wielder health', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'ranger', 10, 0, 0);
    const husk = spawnMonster(sim, 'husk', 4, 1, 0);
    wear(merc, 'penitentsLash');
    const hp = merc.hp;
    merc.hit(husk, { kind: DamageKind.True, fixed: 5, flags: DamageFlags.BasicAttack });
    expect(merc.hp).toBeLessThan(hp);
    merc.unequip(EquipSlot.Weapon);
    const after = merc.hp;
    merc.hit(husk, { kind: DamageKind.True, fixed: 5, flags: DamageFlags.BasicAttack });
    expect(merc.hp).toBe(after);
  });
});
