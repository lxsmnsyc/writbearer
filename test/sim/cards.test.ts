import { describe, expect, it } from 'vitest';
import { CARD_BY_MONSTER, GEMS } from '../../src/content/cards';
import { BASE_BY_ID } from '../../src/content/items';
import { MONSTERS, spawnBearer, spawnMerc, spawnMonster } from '../../src/content/roster';
import RNG from '../../src/core/rng';
import { Pack, socketCard, unequipToPack } from '../../src/game/inventory';
import { itemLines, plainItem, rollCards } from '../../src/gen/loot';
import { EquipSlot } from '../../src/sim/item';
import { SimEvents } from '../../src/sim/events';
import Sim from '../../src/sim/sim';
import { Category, bonusKey } from '../../src/sim/stats';
import { DREAD, POISON } from '../../src/sim/statuses';
import { DamageFlags, Race, Rank, ValuePriority } from '../../src/sim/types';

const sword = (sockets: number): ReturnType<typeof plainItem> => {
  const item = plainItem(BASE_BY_ID.get('armingSword')!);
  item.sockets = sockets;
  return item;
};

describe('card drops', () => {
  it('every monster but the Creditor has its card', () => {
    for (const kind of Object.keys(MONSTERS)) {
      expect(kind in CARD_BY_MONSTER, kind).toBe(kind !== 'creditor');
    }
  });

  it('come 3% of the time from normal monsters, always from bosses', () => {
    const rng = new RNG(7);
    let cards = 0;
    for (let i = 0; i < 4000; i++) {
      cards += rollCards(rng, 'husk', Rank.Normal).filter(
        (c) => c.base === CARD_BY_MONSTER.husk,
      ).length;
    }
    expect(cards / 4000).toBeGreaterThan(0.02);
    expect(cards / 4000).toBeLessThan(0.04);
    const boss = rollCards(rng, 'gatekeeper', Rank.Boss);
    expect(boss.some((c) => c.base === CARD_BY_MONSTER.gatekeeper)).toBe(true);
  });
});

describe('sockets', () => {
  it('take a card that fits, and its bonus counts while the item is worn', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const merc = spawnMerc(sim, 'vanguard', 5, 1, 0);
    merc.equip(EquipSlot.Weapon, sword(1));
    const pack = new Pack();
    const card = plainItem(CARD_BY_MONSTER.penitent);
    pack.add(card);
    const key = bonusKey(Category.Race, Race.Human);
    expect(merc.stats.amplify.get(key) ?? 0).toBe(0);
    expect(socketCard(sim, bearer, pack, merc, card.uid)).toBeNull();
    expect(pack.items).toHaveLength(0);
    expect(merc.stats.amplify.get(key)).toBe(20);
    const worn = merc.equipment.get(EquipSlot.Weapon)!;
    expect(itemLines(worn).join(' ')).toContain('Penitent Card');
    // Off the merc, the card goes with the sword, and comes back with it.
    unequipToPack(sim, bearer, pack, merc, EquipSlot.Weapon);
    expect(merc.stats.amplify.get(key) ?? 0).toBe(0);
    merc.equip(EquipSlot.Weapon, worn);
    expect(merc.stats.amplify.get(key)).toBe(20);
  });

  it('refuse a card with no fitting item or no free socket; a gem fits anything', () => {
    const sim = new Sim(1);
    const bearer = spawnBearer(sim, 0, 0);
    const merc = spawnMerc(sim, 'vanguard', 5, 1, 0);
    merc.equip(EquipSlot.Weapon, sword(1));
    const pack = new Pack();
    const husk = plainItem(CARD_BY_MONSTER.husk);
    const gem = plainItem(GEMS[0]);
    const second = plainItem(GEMS[1]);
    for (const c of [husk, gem, second]) {
      pack.add(c);
    }
    // The starting hauberk has no socket.
    expect(socketCard(sim, bearer, pack, merc, husk.uid)).toMatch(/free socket/);
    expect(socketCard(sim, bearer, pack, merc, gem.uid)).toBeNull();
    expect(socketCard(sim, bearer, pack, merc, second.uid)).toMatch(/free socket/);
  });
});

describe('card effects', () => {
  it('Crawler: basic attacks add Poison buildup, only while worn', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const target = spawnMonster(sim, 'hollowSoldier', 4, 1, 0);
    sim.on(SimEvents.CheckHit, ValuePriority.Post, (event) => {
      event.hit = true;
    });
    const weapon = sword(1);
    weapon.cards.push(CARD_BY_MONSTER.crawler);
    merc.equip(EquipSlot.Weapon, weapon);
    merc.hit(target, { flags: DamageFlags.BasicAttack });
    expect(target.buildup.get(POISON.id) ?? 0).toBeGreaterThan(0);
    target.buildup.clear();
    merc.unequip(EquipSlot.Weapon);
    merc.hit(target, { flags: DamageFlags.BasicAttack });
    expect(target.buildup.get(POISON.id) ?? 0).toBe(0);
  });

  it('Hollowed: Dread builds up at half the rate', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 30, 0, 0);
    const helm = plainItem(BASE_BY_ID.get('hood')!);
    helm.sockets = 1;
    helm.cards.push(CARD_BY_MONSTER.hollowed);
    merc.equip(EquipSlot.Head, helm);
    const hollowed = spawnMonster(sim, 'hollowed', 4, 9, 0);
    merc.buildUp(DREAD, hollowed, 20);
    expect(merc.buildup.get(DREAD.id)).toBe(10);
  });

  it('Brood Mother: more health, less attack', () => {
    const sim = new Sim(1);
    const merc = spawnMerc(sim, 'vanguard', 5, 0, 0);
    const before = { hp: merc.derived.maxHp, atk: merc.derived.atkMax };
    const body = merc.equipment.get(EquipSlot.Body)!;
    body.sockets = 1;
    body.cards.push(CARD_BY_MONSTER.broodMother);
    merc.recalc();
    expect(merc.derived.maxHp).toBeGreaterThan(before.hp);
    expect(merc.derived.atkMax).toBeLessThan(before.atk);
  });
});
